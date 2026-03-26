/**
 * 죄종/사기 시스템 — 폭주, 이탈, 연쇄 반응, 타락/구원
 * 모든 상수는 balance + desertionEffects 데이터에서 주입
 */

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

    /** 폭주 처리 */
    _processRampage(hero, heroes) {
        const chain = this.sinRelations.rampage_chain[hero.sinType];
        const result = {
            type: 'rampage',
            heroId: hero.id,
            heroName: hero.name,
            sinType: hero.sinType,
            sinName: this.sinRelations.sin_names_ko[hero.sinType],
            description: chain ? chain.description : '폭주!',
            corruptionResult: null,
            affectedHeroes: []
        };

        // 타락/구원 판정
        if (Math.random() < this.CORRUPTION_CHANCE) {
            result.corruptionResult = 'corruption';
            hero.morale = this.RAMPAGE_RESET;
        } else {
            result.corruptionResult = 'salvation';
            hero.morale = this.SALVATION_RESET;
        }

        // 연쇄 반응
        if (chain) {
            if (chain.target === 'all') {
                for (const h of heroes) {
                    if (h.id !== hero.id) {
                        h.morale = Math.max(0, Math.min(100, h.morale + chain.morale_delta));
                        result.affectedHeroes.push({ id: h.id, name: h.name, delta: chain.morale_delta });
                    }
                }
            } else if (chain.target === 'random_2') {
                const others = heroes.filter(h => h.id !== hero.id);
                const targets = this._pickRandom(others, 2);
                for (const t of targets) {
                    t.morale = Math.max(0, Math.min(100, t.morale + chain.morale_delta));
                    result.affectedHeroes.push({ id: t.id, name: t.name, delta: chain.morale_delta });
                }
            } else {
                const target = heroes.find(h => h.sinType === chain.target && h.id !== hero.id);
                if (target) {
                    target.morale = Math.max(0, Math.min(100, target.morale + chain.morale_delta));
                    result.affectedHeroes.push({ id: target.id, name: target.name, delta: chain.morale_delta });
                }
            }
        }

        return result;
    }

    /** 이탈 처리 (사기 0) — CSV desertion_effects 기반 */
    _processDesertion(hero, heroes) {
        const sinData = this.sinRelations.sin_names_ko;
        const result = {
            type: 'desertion',
            heroId: hero.id,
            heroName: hero.name,
            sinType: hero.sinType,
            sinName: sinData[hero.sinType],
            description: '',
            affectedHeroes: []
        };

        // CSV에서 이탈 효과 조회
        const effect = this.desertionEffects.find(e => e.sin === hero.sinType);
        const sinDef = this.sinRelations.sin_names_ko[hero.sinType];

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
