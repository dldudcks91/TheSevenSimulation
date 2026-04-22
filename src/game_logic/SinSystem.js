/**
 * 죄종 시스템 — 폭주 상태, 이탈, 연쇄 반응, 후천 특성
 * 모든 상수는 balance + desertionEffects 데이터에서 주입
 *
 * 폭주 방식 (DD 스트레스 방식):
 *   - 죄종 수치 >= 18: 폭주 상태 ON (isRampaging = true)
 *   - 폭주 중 매 낮 페이즈에 죄종별 문제 행동 발생 (processRampageTick)
 *   - 죄종 수치 20 도달 + N턴 유지 → 이탈
 *   - 수치가 17 이하로 내려가면 폭주 자동 해제
 *
 * 행동 결정 방식:
 *   1순위: 특성(선천/후천)에 rampage_action 정의 → 해당 행동 확정
 *   2순위: 특성 없으면 → 폭주 중인 죄종 중 최고값 기준
 *   3순위: 같은 행동 N회 반복 → 후천 폭주 특성 자동 부여
 */

import { weightedSinRoll, sinIntensity, topSin, SIN_NAMES_KO, findRampageTrait, findDesertionTrait } from './SinUtils.js';

const SIN_STAT_KEYS = ['wrath', 'envy', 'greed', 'sloth', 'gluttony', 'lust', 'pride'];

class SinSystem {
    constructor(store, sinRelations, balance = {}, desertionEffects = []) {
        this.store = store;
        this.sinRelations = sinRelations;
        this.balance = balance;
        this.desertionEffects = desertionEffects;

        this.RAMPAGE_THRESHOLD = balance.sin_rampage_threshold ?? 18;
        this.DESERTION_THRESHOLD = balance.sin_max ?? 20;
        this.RECOVER_THRESHOLD = balance.sin_rampage_recover_threshold ?? 17;
        this.DESERTION_TURNS = balance.sin_rampage_desertion_turns ?? 3;
        this.MAX_CHAINS = balance.max_chain_reactions ?? 3;
    }

    /**
     * 밤 결산 시 폭주 상태 갱신 + 임계(20) 이벤트 큐잉
     * 2026-04-21: 기존 "20 + 3턴 이탈"은 CriticalEventSystem으로 이전.
     * 여기서는 폭주 상태 갱신과 임계 감지만 수행하고, 처리는 UI/CriticalEventSystem이 담당.
     */
    checkExtremes() {
        const heroes = this.store.getState('heroes') || [];
        const results = [];
        const pendingCritical = [];

        for (const hero of [...heroes]) {
            // 폭주 상태 갱신 (18+ → ON, 17- → OFF)
            const hadRampage = hero.isRampaging;
            const rampagingSins = SIN_STAT_KEYS.filter(k => (hero.sinStats?.[k] ?? 0) >= this.RAMPAGE_THRESHOLD);
            hero.isRampaging = rampagingSins.length > 0;

            // 폭주 진입 이력 누적 (후천 특성용)
            if (hero.isRampaging && !hadRampage) {
                const triggerSin = this._pickRampageSin(hero);
                if (!hero._rampageHistory) hero._rampageHistory = [];
                hero._rampageHistory.push(triggerSin);
                this._checkRampageAcquiredTrait(hero, triggerSin);
            }

            // 죄종 20 도달 → 임계 이벤트 pending
            for (const sinKey of SIN_STAT_KEYS) {
                const val = hero.sinStats?.[sinKey] ?? 0;
                if (val >= this.DESERTION_THRESHOLD) {
                    pendingCritical.push({ heroId: hero.id, sinKey });
                }
            }
            // 기존 overflow 카운터 완전 정리
            if (hero._sinOverflowTurns) hero._sinOverflowTurns = {};
        }

        if (pendingCritical.length > 0) {
            const existing = this.store.getState('pendingCriticalEvents') || [];
            const keys = new Set(existing.map(e => `${e.heroId}:${e.sinKey}`));
            const merged = [...existing];
            for (const item of pendingCritical) {
                if (!keys.has(`${item.heroId}:${item.sinKey}`)) {
                    merged.push(item);
                    results.push({
                        type: 'critical_event_pending',
                        heroId: item.heroId,
                        sinKey: item.sinKey
                    });
                }
            }
            this.store.setState('pendingCriticalEvents', merged);
        }

        this.store.setState('heroes', [...heroes]);
        return results;
    }

    /**
     * 낮 페이즈에 폭주 중인 영웅의 문제 행동 처리
     * TurnProcessor.processDayPhase()에서 각 영웅에 대해 호출
     * @returns {object|null} 문제 행동 결과 또는 null
     */
    processRampageTick(hero, heroes) {
        if (!hero.isRampaging) return null;

        const triggerSin = this._pickRampageSin(hero);
        if (!triggerSin) return null;

        const intensity = sinIntensity(hero.sinStats, triggerSin);
        const result = {
            type: 'rampage_tick',
            heroId: hero.id,
            heroName: hero.name,
            triggerSin,
            sinName: SIN_NAMES_KO[triggerSin],
            sinValue: hero.sinStats?.[triggerSin] ?? 0,
            description: '',
            affectedHeroes: []
        };

        this._executeRampageAction(triggerSin, hero, heroes, intensity, result);
        return result;
    }

    /** 폭주 중인 죄종 중 최고값 선택 (특성 우선) */
    _pickRampageSin(hero) {
        const traitAction = findRampageTrait(hero);
        if (traitAction) return traitAction.sin;

        const rampagingSins = SIN_STAT_KEYS.filter(k => (hero.sinStats?.[k] ?? 0) >= this.RAMPAGE_THRESHOLD);
        if (rampagingSins.length === 0) return weightedSinRoll(hero.sinStats);

        return rampagingSins.reduce((best, k) =>
            (hero.sinStats?.[k] ?? 0) > (hero.sinStats?.[best] ?? 0) ? k : best
        , rampagingSins[0]);
    }

    /** 죄종별 문제 행동 실행 */
    _executeRampageAction(sinKey, hero, heroes, intensity, result) {
        const b = this.balance;
        const others = heroes.filter(h => h.id !== hero.id);

        switch (sinKey) {
            case 'wrath': {
                // 랜덤 영웅에게 도발 → 그 영웅 wrath +1
                if (others.length > 0) {
                    const target = others[Math.floor(Math.random() * others.length)];
                    target.sinStats.wrath = Math.min(20, (target.sinStats.wrath ?? 1) + (b.rampage_wrath_contagion ?? 1));
                    target.isRampaging = SIN_STAT_KEYS.some(k => (target.sinStats?.[k] ?? 0) >= this.RAMPAGE_THRESHOLD);
                    result.description = `${hero.name}가 ${target.name}에게 시비를 겁니다`;
                    result.affectedHeroes.push({ id: target.id, name: target.name, sinKey: 'wrath', delta: 1 });
                }
                break;
            }
            case 'envy': {
                // 가장 강한 영웅의 죄종 수치 -1 (깎아내리기)
                const strongest = others.sort((a, b_) => {
                    const sumA = Object.values(a.stats || {}).reduce((s, v) => s + v, 0);
                    const sumB = Object.values(b_.stats || {}).reduce((s, v) => s + v, 0);
                    return sumB - sumA;
                })[0];
                if (strongest) {
                    const targetSin = topSin(strongest.sinStats);
                    if (targetSin) {
                        strongest.sinStats[targetSin] = Math.max(1, (strongest.sinStats[targetSin] ?? 1) - (b.rampage_envy_sabotage_sin_drain ?? 1));
                        result.description = `${hero.name}가 ${strongest.name}을 은밀히 방해합니다`;
                        result.affectedHeroes.push({ id: strongest.id, name: strongest.name, sinKey: targetSin, delta: -1 });
                    }
                }
                break;
            }
            case 'greed': {
                // 거점 자원 소량 횡령
                const foodSteal = b.rampage_greed_steal_food ?? 2;
                const goldSteal = b.rampage_greed_steal_gold ?? 5;
                const food = this.store.getState('food') || 0;
                const gold = this.store.getState('gold') || 0;
                this.store.setState('food', Math.max(0, food - foodSteal));
                this.store.setState('gold', Math.max(0, gold - goldSteal));
                result.description = `${hero.name}가 창고에서 몰래 챙겼습니다 (식량 -${foodSteal}, 골드 -${goldSteal})`;
                break;
            }
            case 'sloth': {
                // 행동 결과 효율 감소 플래그 (DayActions에서 참조) + 주변 슬로스 전파
                hero._slothRampaging = true;
                const propagate = b.rampage_sloth_propagation ?? 1;
                const nearbyTarget = others[Math.floor(Math.random() * Math.max(1, others.length))];
                if (nearbyTarget) {
                    nearbyTarget.sinStats.sloth = Math.min(20, (nearbyTarget.sinStats.sloth ?? 1) + propagate);
                    nearbyTarget.isRampaging = SIN_STAT_KEYS.some(k => (nearbyTarget.sinStats?.[k] ?? 0) >= this.RAMPAGE_THRESHOLD);
                    result.description = `${hero.name}의 무기력이 ${nearbyTarget.name}에게 전염됩니다`;
                    result.affectedHeroes.push({ id: nearbyTarget.id, name: nearbyTarget.name, sinKey: 'sloth', delta: propagate });
                }
                break;
            }
            case 'gluttony': {
                // 식량 추가 소비
                const extraFood = b.rampage_gluttony_extra_food_cost ?? 3;
                const food2 = this.store.getState('food') || 0;
                this.store.setState('food', Math.max(0, food2 - extraFood));
                result.description = `${hero.name}가 비상 식량에 손을 댑니다 (식량 -${extraFood})`;
                break;
            }
            case 'lust': {
                // 집착 대상 영웅 배치 거부 플래그
                hero._lustObsessionTarget = others.length > 0
                    ? others[Math.floor(Math.random() * others.length)].id
                    : null;
                const targetHero = others.find(h => h.id === hero._lustObsessionTarget);
                result.description = targetHero
                    ? `${hero.name}가 ${targetHero.name}에게 집착합니다`
                    : `${hero.name}가 혼자 있으려 하지 않습니다`;
                break;
            }
            case 'pride': {
                // 명령 거부 플래그 (DayActions/TurnProcessor에서 참조)
                hero._prideDefiance = true;
                result.description = `${hero.name}가 명령에 공개적으로 이의를 제기합니다`;
                break;
            }
        }
    }

    /** 이탈 처리 — 죄종별 이탈 효과 + 영웅 제거 */
    _processDesertion(hero, heroes, triggerSin) {
        const result = {
            type: 'desertion',
            heroId: hero.id,
            heroName: hero.name,
            triggerSin,
            sinName: SIN_NAMES_KO[triggerSin],
            description: '',
            affectedHeroes: []
        };

        // CSV 이탈 효과 조회 (gold 효과는 유지, morale 효과는 sinStat 전파로 전환)
        const effect = this.desertionEffects.find(e => e.sin === triggerSin);
        if (effect) {
            result.description = `${hero.name}가 거점을 떠납니다.`;
            if (effect.effect_type === 'gold') {
                const gold = this.store.getState('gold') || 0;
                this.store.setState('gold', Math.max(0, gold + effect.value));
            } else if (effect.effect_type === 'morale') {
                // 구 morale 효과 → 남은 영웅들의 주 성향 sinStat 변동으로 전환
                const sinDelta = effect.value > 0 ? 1 : -1;
                const targets = effect.target === 'all'
                    ? heroes.filter(h => h.id !== hero.id)
                    : effect.target === 'random_1'
                        ? [heroes.filter(h => h.id !== hero.id)[Math.floor(Math.random() * Math.max(1, heroes.length - 1))]]
                        : [];
                for (const t of targets) {
                    if (!t) continue;
                    const tSin = topSin(t.sinStats);
                    if (tSin) {
                        t.sinStats[tSin] = Math.max(1, Math.min(20, (t.sinStats[tSin] ?? 1) + sinDelta));
                        t.isRampaging = SIN_STAT_KEYS.some(k => (t.sinStats?.[k] ?? 0) >= this.RAMPAGE_THRESHOLD);
                        result.affectedHeroes.push({ id: t.id, name: t.name, sinKey: tSin, delta: sinDelta });
                    }
                }
            }
        } else {
            result.description = `${hero.name}가 거점을 떠납니다.`;
        }

        const idx = heroes.indexOf(hero);
        if (idx !== -1) heroes.splice(idx, 1);
        return result;
    }

    /** 폭주 이력 확인 → 같은 행동 N회 시 후천 폭주 특성 부여 */
    _checkRampageAcquiredTrait(hero, triggerSin) {
        const threshold = this.balance.rampage_history_threshold ?? 2;
        const count = (hero._rampageHistory || []).filter(s => s === triggerSin).length;
        if (count < threshold) return;

        if (!hero.acquiredTraits) hero.acquiredTraits = [];
        const hasRampageTrait = hero.acquiredTraits.some(t => t.rampage_action);
        if (hasRampageTrait) return;

        const allTraits = this.store.getState('traitsData') || [];
        const rampageTrait = allTraits.find(t => t.category === '후천폭주' && t.rampage_sin === triggerSin);
        if (rampageTrait) hero.acquiredTraits.push({ ...rampageTrait });
    }

    /** 연쇄 반응 — 폭주 이탈 후 sin 전파로 다른 영웅 이탈 체크 */
    _processChainReactions(initialResults, heroes) {
        const chainResults = [];
        let maxChains = this.MAX_CHAINS;

        while (maxChains > 0) {
            let triggered = false;
            for (const hero of [...heroes]) {
                const alreadyProcessed = initialResults.some(r => r.heroId === hero.id) ||
                    chainResults.some(r => r.heroId === hero.id);
                if (alreadyProcessed) continue;

                // 이탈 조건: 최고 죄종이 20 + sinOverflowTurns 충족
                for (const sinKey of SIN_STAT_KEYS) {
                    if ((hero.sinStats?.[sinKey] ?? 0) >= this.DESERTION_THRESHOLD &&
                        (hero._sinOverflowTurns?.[sinKey] ?? 0) >= this.DESERTION_TURNS) {
                        chainResults.push(this._processDesertion(hero, heroes, sinKey));
                        triggered = true;
                        break;
                    }
                }
            }
            if (!triggered) break;
            maxChains--;
        }

        return chainResults;
    }

    /** 죄종 간 관계에 따른 배치 효과 (sinStat 기반) */
    getRelationEffect(sinA, sinB) {
        if (sinA === sinB) return 0;
        const rel = this.sinRelations?.relations?.[sinA];
        if (!rel) return 0;
        const relType = rel[sinB];
        const effectData = this.sinRelations?.relation_effects?.[relType];
        return effectData ? (effectData.sin_delta ?? 0) : 0;
    }

    _pickRandom(arr, count) {
        return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
    }
}

export default SinSystem;
