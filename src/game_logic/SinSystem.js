/**
 * 죄종/사기 시스템 — 폭주, 이탈, 연쇄 반응, 타락/구원
 */

const CORRUPTION_CHANCE = 0.7;  // 타락 확률 70%
const SALVATION_CHANCE = 0.3;   // 구원 확률 30%

class SinSystem {
    constructor(store, sinRelations) {
        this.store = store;
        this.sinRelations = sinRelations;
    }

    /** 밤 결산 시 폭주/이탈 체크 → 연쇄 반응 */
    checkExtremes() {
        const heroes = this.store.getState('heroes') || [];
        const results = [];

        for (const hero of [...heroes]) {
            if (hero.morale >= 100) {
                results.push(this._processRampage(hero, heroes));
            } else if (hero.morale <= 0) {
                results.push(this._processDesertion(hero, heroes));
            }
        }

        // 연쇄 반응 체크 (폭주 결과가 다른 영웅에게 영향)
        const chainResults = this._processChainReactions(results, heroes);
        results.push(...chainResults);

        this.store.setState('heroes', [...heroes]);
        return results;
    }

    /** 폭주 처리 (사기 100) */
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
        if (Math.random() < CORRUPTION_CHANCE) {
            result.corruptionResult = 'corruption';
            hero.morale = 70; // 리셋
            // 타락: 더 강하지만 더 위험 (폭주 임계 낮아짐 등은 Phase 2)
        } else {
            result.corruptionResult = 'salvation';
            hero.morale = 50; // 안정화
            // 구원: 고유 능력 해금 등은 Phase 2
        }

        // 연쇄 반응: 폭주 결과가 다른 영웅에게 영향
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
                // 특정 죄종 타겟
                const target = heroes.find(h => h.sinType === chain.target && h.id !== hero.id);
                if (target) {
                    target.morale = Math.max(0, Math.min(100, target.morale + chain.morale_delta));
                    result.affectedHeroes.push({ id: target.id, name: target.name, delta: chain.morale_delta });
                }
            }
        }

        return result;
    }

    /** 이탈 처리 (사기 0) */
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

        // 죄종별 이탈 효과
        switch (hero.sinType) {
            case 'wrath':
                result.description = `${hero.name}가 폭력적으로 탈영합니다.`;
                // 전체 사기 소폭 하락
                for (const h of heroes) {
                    if (h.id !== hero.id) {
                        h.morale = Math.max(0, h.morale - 5);
                        result.affectedHeroes.push({ id: h.id, name: h.name, delta: -5 });
                    }
                }
                break;
            case 'greed':
                result.description = `${hero.name}가 창고를 털고 도주합니다.`;
                const gold = this.store.getState('gold') || 0;
                this.store.setState('gold', Math.max(0, gold - 80));
                break;
            case 'lust':
                result.description = `${hero.name}가 다른 영웅을 꼬여서 함께 떠나려 합니다.`;
                // 랜덤 1명 사기 급락
                const others = heroes.filter(h => h.id !== hero.id);
                if (others.length > 0) {
                    const victim = others[Math.floor(Math.random() * others.length)];
                    victim.morale = Math.max(0, victim.morale - 20);
                    result.affectedHeroes.push({ id: victim.id, name: victim.name, delta: -20 });
                }
                break;
            case 'envy':
                result.description = `${hero.name}가 사보타주 후 이탈합니다.`;
                break;
            case 'sloth':
                result.description = `${hero.name}가 조용히 사라집니다.`;
                break;
            case 'gluttony':
                result.description = `${hero.name}가 보급품을 갖고 이탈합니다.`;
                break;
            case 'pride':
                result.description = `${hero.name}: "너 밑에 있을 수준이 아니다."`;
                break;
            default:
                result.description = `${hero.name}가 거점을 떠납니다.`;
        }

        // 영웅 제거
        const idx = heroes.indexOf(hero);
        if (idx !== -1) heroes.splice(idx, 1);

        return result;
    }

    /** 연쇄 반응: 폭주/이탈 결과로 다른 영웅이 극단에 도달할 수 있음 */
    _processChainReactions(initialResults, heroes) {
        const chainResults = [];
        let maxChains = 3; // 무한 루프 방지

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
