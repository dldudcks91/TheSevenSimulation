/**
 * 이벤트/선택지 시스템
 * 매 턴(아침) 이벤트 발생 → 플레이어 판결 → 사기 변동
 */
import { SIN_KEYS, topSin, weightedSinRoll } from './SinUtils.js';

class EventSystem {
    constructor(store, eventsData, balance = {}) {
        this.store = store;
        this.balance = balance;
        this.allEvents = eventsData.events;
        this._usedRecently = new Set(); // 최근 발생한 이벤트 (중복 방지)
    }

    /** 아침 페이즈에 이벤트 1~2개 선택 */
    generateEvents() {
        const heroes = this.store.getState('heroes') || [];
        const turn = this.store.getState('turn');
        if (heroes.length === 0) return [];

        const candidates = this._filterCandidates(heroes, turn);
        const selected = [];

        // 1개 확정, 30% 확률로 2개
        if (candidates.length > 0) {
            const evt = this._pickRandom(candidates);
            const resolved = this._resolveEvent(evt, heroes);
            if (resolved) {
                selected.push(resolved);
                this._usedRecently.add(evt.id);
            }
        }

        if (candidates.length > 1 && Math.random() < (this.balance.event_double_chance ?? 0.3)) {
            const remaining = candidates.filter(e => !this._usedRecently.has(e.id));
            if (remaining.length > 0) {
                const evt2 = this._pickRandom(remaining);
                const resolved2 = this._resolveEvent(evt2, heroes);
                if (resolved2) {
                    selected.push(resolved2);
                    this._usedRecently.add(evt2.id);
                }
            }
        }

        // N턴마다 recently 초기화
        if (turn && turn.day % (this.balance.event_cache_reset_interval ?? 5) === 0) {
            this._usedRecently.clear();
        }

        this.store.setState('currentEvents', selected);
        return selected;
    }

    /** 트리거 조건에 맞는 이벤트 필터링 */
    _filterCandidates(heroes, turn) {
        const day = turn ? turn.day : 1;

        return this.allEvents.filter(evt => {
            if (this._usedRecently.has(evt.id)) return false;

            const t = evt.trigger;

            switch (t.type) {
                case 'sin_elevated': {
                    // 해당 죄종 수치 15+ 영웅이 있을 때 (고수치 = 위험 징후)
                    const elevatedMin = t.min_sin_value || (this.balance.sin_elevated_threshold ?? 15);
                    const hero = heroes.find(h => (h.sinStats?.[t.sin] || 0) >= elevatedMin);
                    if (!hero) return false;
                    if (t.oppose_sin) {
                        const oppose = heroes.find(h => (h.sinStats?.[t.oppose_sin] || 0) >= 8);
                        if (!oppose) return false;
                    }
                    return true;
                }
                case 'sin_frustrated': {
                    // 해당 죄종 수치 5 이하 영웅이 있을 때 (저수치 = 의욕 상실)
                    const frustratedMax = this.balance.sin_frustrated_threshold ?? 5;
                    const hero = heroes.find(h => (h.sinStats?.[t.sin] || 0) <= frustratedMax);
                    return !!hero;
                }
                case 'rampage': {
                    // 폭주 상태인 영웅이 해당 죄종을 가질 때
                    const hero = heroes.find(h =>
                        h.isRampaging && (h.sinStats?.[t.sin] || 0) >= (this.balance.sin_rampage_threshold ?? 18)
                    );
                    return !!hero;
                }
                case 'periodic':
                    return day % (t.interval || (this.balance.default_periodic_interval ?? 4)) === 0;
                case 'random':
                    return day >= (t.min_day || 1) && Math.random() < (t.chance || (this.balance.default_random_chance ?? 0.3));
                case 'roster_available':
                    return day >= (t.min_day || 1) && heroes.length < (this.balance.event_roster_max ?? 7);
                case 'chapter_progress':
                    return day >= (t.min_day || (this.balance.event_chapter_min_day ?? 10));
                case 'after_defense_victory':
                case 'after_defense_defeat':
                case 'after_defense_injury':
                case 'after_defense_defeat_with_expedition':
                    // 밤 습격 후유증 — 밤 페이즈 결과에 따라 외부에서 트리거
                    return false; // 자동 생성 X, 외부 호출
                default:
                    return false;
            }
        });
    }

    /** 이벤트 텍스트의 {placeholder}를 실제 영웅 이름으로 치환 */
    _resolveEvent(evt, heroes) {
        // 각 죄종별 해당 수치 최고 영웅 매핑
        const sinHeroes = {};
        for (const sin of SIN_KEYS) {
            let best = null;
            let bestVal = -1;
            for (const h of heroes) {
                const val = h.sinStats?.[sin] || 0;
                if (val > bestVal) {
                    bestVal = val;
                    best = h;
                }
            }
            if (best) sinHeroes[sin] = best;
        }

        // 이벤트에 관련된 주요 영웅 결정
        const triggerSin = evt.trigger.sin;
        // 해당 죄종 수치 8+ 영웅 중 sinStats 가중 확률로 선택
        const triggerCandidates = heroes.filter(h => (h.sinStats?.[triggerSin] || 0) >= 8);
        let mainHero;
        if (triggerCandidates.length > 0) {
            // sinStats[triggerSin] 가중치로 확률 선택
            let total = 0;
            for (const h of triggerCandidates) total += (h.sinStats?.[triggerSin] || 0);
            let roll = Math.random() * total;
            mainHero = triggerCandidates[triggerCandidates.length - 1];
            for (const h of triggerCandidates) {
                roll -= (h.sinStats?.[triggerSin] || 0);
                if (roll <= 0) { mainHero = h; break; }
            }
        } else {
            mainHero = sinHeroes[triggerSin] || null;
        }
        const mainHeroId = mainHero ? mainHero.id : -1;
        const otherHeroes = heroes.filter(h => h.id !== mainHeroId);
        const otherHero = otherHeroes.length > 0 ? otherHeroes[Math.floor(Math.random() * otherHeroes.length)] : null;
        const strongest = heroes.reduce((a, b) => {
            const aSum = Object.values(a.stats).reduce((s, v) => s + v, 0);
            const bSum = Object.values(b.stats).reduce((s, v) => s + v, 0);
            return aSum >= bSum ? a : b;
        });

        // heroA, heroB (색욕 폭주용)
        const nonMainHeroes = heroes.filter(h => h.id !== (mainHero ? mainHero.id : -1));
        const heroA = nonMainHeroes[0] || null;
        const heroB = nonMainHeroes[1] || null;

        const replacements = {
            '{wrath}': sinHeroes.wrath ? sinHeroes.wrath.name : '???',
            '{envy}': sinHeroes.envy ? sinHeroes.envy.name : '???',
            '{greed}': sinHeroes.greed ? sinHeroes.greed.name : '???',
            '{sloth}': sinHeroes.sloth ? sinHeroes.sloth.name : '???',
            '{gluttony}': sinHeroes.gluttony ? sinHeroes.gluttony.name : '???',
            '{lust}': sinHeroes.lust ? sinHeroes.lust.name : '???',
            '{pride}': sinHeroes.pride ? sinHeroes.pride.name : '???',
            '{other}': otherHero ? otherHero.name : '동료',
            '{strongest}': strongest ? strongest.name : '???',
            '{injured}': otherHero ? otherHero.name : '동료',
            '{heroA}': heroA ? heroA.name : '영웅A',
            '{heroB}': heroB ? heroB.name : '영웅B'
        };

        const replaceAll = (str) => {
            let result = str;
            for (const [key, val] of Object.entries(replacements)) {
                result = result.split(key).join(val);
            }
            return result;
        };

        // 타겟 → 실제 heroId 매핑
        const targetMap = {
            'wrath': sinHeroes.wrath ? sinHeroes.wrath.id : null,
            'envy': sinHeroes.envy ? sinHeroes.envy.id : null,
            'greed': sinHeroes.greed ? sinHeroes.greed.id : null,
            'sloth': sinHeroes.sloth ? sinHeroes.sloth.id : null,
            'gluttony': sinHeroes.gluttony ? sinHeroes.gluttony.id : null,
            'lust': sinHeroes.lust ? sinHeroes.lust.id : null,
            'pride': sinHeroes.pride ? sinHeroes.pride.id : null,
            'other': otherHero ? otherHero.id : null,
            'strongest': strongest ? strongest.id : null,
            'injured': otherHero ? otherHero.id : null,
            'heroA': heroA ? heroA.id : null,
            'heroB': heroB ? heroB.id : null
        };

        return {
            id: evt.id,
            category: evt.category,
            title: replaceAll(evt.title),
            scene: replaceAll(evt.scene),
            choices: evt.choices.map(c => ({
                text: replaceAll(c.text),
                effects: c.effects,
                log: replaceAll(c.log),
                targetMap
            }))
        };
    }

    /**
     * 조우(encounter) 이벤트 1개 선택 — 원정 event 노드에서 호출
     * @param {number[]} partyHeroIds 파티 영웅 id (문구/효과 적용 범위)
     * @returns {object|null} resolved event
     */
    pickEncounterEvent(partyHeroIds = []) {
        const pool = this.allEvents.filter(e => e.category === 'encounter');
        if (pool.length === 0) return null;
        const evt = this._pickRandom(pool);

        const heroes = this.store.getState('heroes') || [];
        const party = partyHeroIds.length > 0
            ? heroes.filter(h => partyHeroIds.includes(h.id))
            : heroes;
        if (party.length === 0) return null;

        return this._resolveEvent(evt, party);
    }

    /**
     * 선택지 실행 → 사기 변동 적용
     * @param {object} event 이벤트 객체
     * @param {number} choiceIndex 선택한 choice index
     * @param {object} context { partyHeroIds?: number[] } — 'party' 타겟 범위 지정
     */
    applyChoice(event, choiceIndex, context = {}) {
        const choice = event.choices[choiceIndex];
        if (!choice) return [];

        const heroes = this.store.getState('heroes') || [];
        const results = [];
        const targetMap = choice.targetMap || {};
        const partyIds = Array.isArray(context.partyHeroIds) ? context.partyHeroIds : null;

        const _applySinStatDelta = (hero, sinKey, delta) => {
            if (!hero?.sinStats || !(sinKey in hero.sinStats)) return;
            hero.sinStats[sinKey] = Math.max(1, Math.min(20, (hero.sinStats[sinKey] ?? 1) + delta));
            hero.isRampaging = Object.values(hero.sinStats).some(v => v >= (this.balance.sin_rampage_threshold ?? 18));
        };

        for (const effect of choice.effects) {
            // sin_delta: 죄종 수치 변동 (단방향 누적 프레임)
            // 구 morale 필드 호환 유지 (세이브/마이그레이션)
            const rawDelta = effect.sin_delta ?? effect.morale ?? 0;
            const sinKey = effect.sin_key || null;
            // target이 죄종 키면 해당 죄종에 직접 적용 (스케일: -5 ~ +5 범위로 축약)
            if (SIN_KEYS.includes(effect.target)) {
                const scaledDelta = Math.max(-5, Math.min(5, Math.round(rawDelta / 4)));
                const pool = partyIds ? heroes.filter(h => partyIds.includes(h.id)) : heroes;
                for (const hero of pool) {
                    if (scaledDelta !== 0) {
                        _applySinStatDelta(hero, effect.target, scaledDelta);
                        results.push({ heroId: hero.id, name: hero.name, sinKey: effect.target, delta: scaledDelta });
                    }
                }
                continue;
            }
            // 기존 로직: all/party/others/gold 등
            const sinDelta = rawDelta > 0 ? 1 : rawDelta < 0 ? -1 : 0;

            if (effect.target === 'all') {
                for (const hero of heroes) {
                    const targetSin = sinKey || topSin(hero.sinStats);
                    if (targetSin && sinDelta !== 0) {
                        _applySinStatDelta(hero, targetSin, sinDelta);
                        results.push({ heroId: hero.id, name: hero.name, sinKey: targetSin, delta: sinDelta });
                    }
                }
            } else if (effect.target === 'party') {
                const targets = partyIds
                    ? heroes.filter(h => partyIds.includes(h.id))
                    : heroes;
                for (const hero of targets) {
                    const targetSin = sinKey || topSin(hero.sinStats);
                    if (targetSin && sinDelta !== 0) {
                        _applySinStatDelta(hero, targetSin, sinDelta);
                        results.push({ heroId: hero.id, name: hero.name, sinKey: targetSin, delta: sinDelta });
                    }
                }
            } else if (effect.target === 'others') {
                const mainSin = event.id.startsWith('A4') ? 'pride' : null;
                for (const hero of heroes) {
                    if (mainSin && topSin(hero.sinStats) === mainSin) continue;
                    const targetSin = sinKey || topSin(hero.sinStats);
                    if (targetSin && sinDelta !== 0) {
                        _applySinStatDelta(hero, targetSin, sinDelta);
                        results.push({ heroId: hero.id, name: hero.name, sinKey: targetSin, delta: sinDelta });
                    }
                }
            } else if (effect.target === 'gold') {
                const gold = this.store.getState('gold') || 500;
                this.store.setState('gold', Math.max(0, gold + (effect.amount || 0)));
                results.push({ type: 'gold', delta: effect.amount || 0 });
            } else if (effect.target === 'recruit') {
                results.push({ type: 'recruit', action: effect.action });
            } else {
                // 특정 영웅 타겟
                const heroId = targetMap[effect.target];
                if (heroId) {
                    const hero = heroes.find(h => h.id === heroId);
                    if (hero) {
                        const delta = effect.sin_delta ?? effect.morale ?? 0;
                        if (delta <= -999) {
                            const idx = heroes.indexOf(hero);
                            if (idx !== -1) heroes.splice(idx, 1);
                            results.push({ heroId: hero.id, name: hero.name, type: 'dismissed' });
                        } else {
                            const targetSin = sinKey || topSin(hero.sinStats);
                            if (targetSin && sinDelta !== 0) {
                                _applySinStatDelta(hero, targetSin, sinDelta);
                                results.push({ heroId: hero.id, name: hero.name, sinKey: targetSin, delta: sinDelta });
                            }
                        }
                    }
                }
            }
        }

        this.store.setState('heroes', [...heroes]);
        return { log: choice.log, results };
    }

    _pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}

export default EventSystem;
