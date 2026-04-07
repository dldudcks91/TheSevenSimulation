/**
 * 죄종/사기 시스템 — 폭주, 이탈, 연쇄 반응, 타락/구원
 * 모든 상수는 balance + desertionEffects 데이터에서 주입
 *
 * 행동 결정 방식 (2단계 재설계):
 *   1순위: 특성(선천/후천)에 rampage_action 정의 → 해당 행동 확정
 *   2순위: 특성 없으면 → sinStats 가중 확률로 죄종 뽑기
 *   3순위: 같은 행동 2회 반복 → 후천 폭주 특성 자동 부여 → 이후 고정
 */

import { weightedSinRoll, sinIntensity, topSin, SIN_NAMES_KO, findRampageTrait, findDesertionTrait } from './SinUtils.js';

class SinSystem {
    constructor(store, sinRelations, balance = {}, desertionEffects = []) {
        this.store = store;
        this.sinRelations = sinRelations;
        this.balance = balance;
        this.desertionEffects = desertionEffects;

        this.CORRUPTION_CHANCE = balance.corruption_chance ?? 0.7;
        this.SALVATION_CHANCE = balance.salvation_chance ?? 0.3;
        this.RAMPAGE_RESET = balance.rampage_morale_reset ?? 70;
        this.SALVATION_RESET = balance.salvation_morale_reset ?? 50;
        this.MAX_CHAINS = balance.max_chain_reactions ?? 3;
    }

    /** 폭주 임계값 설정 (연구 보너스 적용 가능) */
    setRampageThreshold(threshold) {
        this._rampageThreshold = threshold;
    }

    /** 밤 결산 시 폭주/이탈 체크 → 연쇄 반응 */
    checkExtremes() {
        const heroes = this.store.getState('heroes') || [];
        const results = [];
        const threshold = this._rampageThreshold || 100;

        for (const hero of [...heroes]) {
            if (hero.morale >= threshold) {
                results.push(this._processRampage(hero, heroes));
            } else if (hero.morale <= 0) {
                results.push(this._processDesertion(hero, heroes));
            }
        }

        const chainResults = this._processChainReactions(results, heroes);
        results.push(...chainResults);

        this.store.setState('heroes', [...heroes]);
        return results;
    }

    /** 폭주 처리 — 특성 우선 → sinStats 확률 fallback → 이력 누적 */
    _processRampage(hero, heroes) {
        // 1순위: 특성에 폭주 행동이 정의되어 있는가?
        const traitAction = findRampageTrait(hero);
        let triggerSin;
        if (traitAction) {
            triggerSin = traitAction.sin;
        } else {
            // 2순위: sinStats 가중 확률로 죄종 뽑기
            triggerSin = weightedSinRoll(hero.sinStats);
        }

        const chain = this.sinRelations.rampage_chain[triggerSin];
        const intensity = sinIntensity(hero.sinStats, triggerSin);
        const result = {
            type: 'rampage',
            heroId: hero.id,
            heroName: hero.name,
            triggerSin,
            sinName: SIN_NAMES_KO[triggerSin],
            fromTrait: traitAction ? traitAction.traitName : null,
            intensity,
            description: chain ? chain.description : '폭주!',
            corruptionResult: null,
            affectedHeroes: []
        };

        // 3순위: 이력 누적 → 후천 폭주 특성 자동 부여
        if (!hero._rampageHistory) hero._rampageHistory = [];
        hero._rampageHistory.push(triggerSin);
        this._checkRampageAcquiredTrait(hero, triggerSin);

        // 타락/구원 판정
        if (Math.random() < this.CORRUPTION_CHANCE) {
            result.corruptionResult = 'corruption';
            hero.morale = this.RAMPAGE_RESET;
        } else {
            result.corruptionResult = 'salvation';
            hero.morale = this.SALVATION_RESET;
        }

        // 연쇄 반응 — 강도 스케일링 적용
        if (chain) {
            const scaledDelta = Math.round(chain.morale_delta * (0.5 + intensity * 0.5));
            if (chain.target === 'all') {
                for (const h of heroes) {
                    if (h.id !== hero.id) {
                        h.morale = Math.max(0, Math.min(100, h.morale + scaledDelta));
                        result.affectedHeroes.push({ id: h.id, name: h.name, delta: scaledDelta });
                    }
                }
            } else if (chain.target === 'random_2') {
                const others = heroes.filter(h => h.id !== hero.id);
                const targets = this._pickRandom(others, 2);
                for (const t of targets) {
                    t.morale = Math.max(0, Math.min(100, t.morale + scaledDelta));
                    result.affectedHeroes.push({ id: t.id, name: t.name, delta: scaledDelta });
                }
            } else {
                // 타겟: 해당 죄종 수치가 가장 높은 영웅 (primarySin 대신)
                const candidates = heroes.filter(h => h.id !== hero.id);
                const target = candidates.length > 0
                    ? candidates.sort((a, b) => (b.sinStats?.[chain.target] || 0) - (a.sinStats?.[chain.target] || 0))[0]
                    : null;
                if (target) {
                    target.morale = Math.max(0, Math.min(100, target.morale + scaledDelta));
                    result.affectedHeroes.push({ id: target.id, name: target.name, delta: scaledDelta });
                }
            }
        }

        return result;
    }

    /** 폭주 이력 확인 → 같은 행동 N회 시 후천 폭주 특성 부여 */
    _checkRampageAcquiredTrait(hero, triggerSin) {
        const threshold = this.balance.rampage_history_threshold ?? 2;
        const count = hero._rampageHistory.filter(s => s === triggerSin).length;
        if (count < threshold) return;

        // 이미 후천 폭주 특성이 있으면 무시
        if (!hero.acquiredTraits) hero.acquiredTraits = [];
        const hasRampageTrait = hero.acquiredTraits.some(t => t.rampage_action);
        if (hasRampageTrait) return;

        // 해당 죄종의 후천 폭주 특성 찾기 (traits.csv에서 category=후천폭주)
        const allTraits = this.store.getState('traitsData') || [];
        const rampageTrait = allTraits.find(t => t.category === '후천폭주' && t.rampage_sin === triggerSin);
        if (rampageTrait) {
            hero.acquiredTraits.push({ ...rampageTrait });
        }
    }

    /** 이탈 처리 (사기 0) — 특성 우선 → sinStats 확률 fallback */
    _processDesertion(hero, heroes) {
        // 특성 우선 → 확률 fallback
        const traitAction = findDesertionTrait(hero);
        let triggerSin;
        if (traitAction) {
            triggerSin = traitAction.sin;
        } else {
            triggerSin = weightedSinRoll(hero.sinStats);
        }

        const result = {
            type: 'desertion',
            heroId: hero.id,
            heroName: hero.name,
            triggerSin,
            sinName: SIN_NAMES_KO[triggerSin],
            fromTrait: traitAction ? traitAction.traitName : null,
            description: '',
            affectedHeroes: []
        };

        // CSV에서 이탈 효과 조회
        const effect = this.desertionEffects.find(e => e.sin === triggerSin);

        if (effect) {
            // 이탈 설명 (sin_types에서 desertion 필드)
            result.description = `${hero.name}가 거점을 떠납니다.`;

            if (effect.effect_type === 'morale') {
                if (effect.target === 'all') {
                    for (const h of heroes) {
                        if (h.id !== hero.id) {
                            h.morale = Math.max(0, h.morale + effect.value);
                            result.affectedHeroes.push({ id: h.id, name: h.name, delta: effect.value });
                        }
                    }
                } else if (effect.target === 'random_1') {
                    const others = heroes.filter(h => h.id !== hero.id);
                    if (others.length > 0) {
                        const victim = others[Math.floor(Math.random() * others.length)];
                        victim.morale = Math.max(0, victim.morale + effect.value);
                        result.affectedHeroes.push({ id: victim.id, name: victim.name, delta: effect.value });
                    }
                }
            } else if (effect.effect_type === 'gold') {
                const gold = this.store.getState('gold') || 0;
                this.store.setState('gold', Math.max(0, gold + effect.value));
            }
        }

        // 영웅 제거
        const idx = heroes.indexOf(hero);
        if (idx !== -1) heroes.splice(idx, 1);

        return result;
    }

    /** 연쇄 반응 */
    _processChainReactions(initialResults, heroes) {
        const chainResults = [];
        let maxChains = this.MAX_CHAINS;

        while (maxChains > 0) {
            let triggered = false;
            for (const hero of [...heroes]) {
                const alreadyProcessed = initialResults.some(r => r.heroId === hero.id) ||
                    chainResults.some(r => r.heroId === hero.id);
                if (alreadyProcessed) continue;

                if (hero.morale >= 100) {
                    chainResults.push(this._processRampage(hero, heroes));
                    triggered = true;
                } else if (hero.morale <= 0) {
                    chainResults.push(this._processDesertion(hero, heroes));
                    triggered = true;
                }
            }
            if (!triggered) break;
            maxChains--;
        }

        return chainResults;
    }

    /** 죄종 간 관계에 따른 배치 사기 효과 */
    getRelationEffect(sinA, sinB) {
        if (sinA === sinB) return 0;
        const rel = this.sinRelations.relations[sinA];
        if (!rel) return 0;
        const relType = rel[sinB];
        const effectData = this.sinRelations.relation_effects[relType];
        return effectData ? effectData.morale_delta : 0;
    }

    _pickRandom(arr, count) {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }
}

export default SinSystem;
