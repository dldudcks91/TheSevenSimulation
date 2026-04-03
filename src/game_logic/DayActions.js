/**
 * 낮 행동 순수 로직 — Phaser 무의존, 백테스팅 가능
 * 채집/벌목/연회/안정화/사냥 보상 계산 + 적합도
 */

class DayActions {
    constructor(store, heroManager, balance = {}) {
        this.store = store;
        this.heroManager = heroManager;
        this.balance = balance;
    }

    /** 채집 실행 → 식량 획득 + 사기 변동 */
    doGather(hero) {
        const turn = this.store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;
        const foodReward = (b.gather_base_food ?? 8) + Math.floor(Math.random() * day);

        hero.status = 'gather';
        this.store.setState('heroes', [...this.heroManager.getHeroes()]);

        const food = this.store.getState('food') || 0;
        this.store.setState('food', food + foodReward);
        this.heroManager.updateMorale(hero.id, b.gather_morale ?? 2);

        return { foodReward };
    }

    /** 벌목 실행 → 나무 획득 + 사기 변동 */
    doLumber(hero) {
        const turn = this.store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;
        const woodReward = (b.lumber_base_wood ?? 6) + Math.floor(Math.random() * day);

        hero.status = 'lumber';
        this.store.setState('heroes', [...this.heroManager.getHeroes()]);

        const wood = this.store.getState('wood') || 0;
        this.store.setState('wood', wood + woodReward);
        this.heroManager.updateMorale(hero.id, b.lumber_morale ?? 1);

        return { woodReward };
    }

    /** 연회 실행 → 골드 소비 + 전체 사기 증가 */
    doFeast() {
        const b = this.balance;
        const feastCost = b.feast_cost ?? 100;
        const gold = this.store.getState('gold') || 0;
        if (gold < feastCost) return { success: false, reason: '골드 부족' };

        this.store.setState('gold', gold - feastCost);
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            let delta = b.feast_morale_normal ?? 15;
            if (hero.sinType === 'gluttony' || hero.sinType === 'lust') {
                delta = b.feast_morale_gluttony_lust ?? 25;
            }
            this.heroManager.updateMorale(hero.id, delta);
        }
        return { success: true, cost: feastCost };
    }

    /** 사기 안정화 → 극단 사기를 중앙으로 끌어옴 */
    doStabilize() {
        const b = this.balance;
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            if (hero.morale < (b.stabilize_low_threshold ?? 30) ||
                hero.morale > (b.stabilize_high_threshold ?? 80)) {
                const target = b.stabilize_target ?? 50;
                const delta = Math.round((target - hero.morale) * (b.stabilize_factor ?? 0.3));
                this.heroManager.updateMorale(hero.id, delta);
            }
        }
    }

    /** 사냥 적 생성 + 보상 계산 (전투 자체는 씬에서 처리) */
    createHuntEncounter(huntEnemies, day) {
        const b = this.balance;
        const template = huntEnemies[Math.floor(Math.random() * huntEnemies.length)];
        if (!template) return null;

        const scale = 1 + (day - 1) * 0.1;
        const enemy = {
            name: template.name,
            hp: Math.floor(template.base_hp * scale),
            atk: Math.floor(template.base_atk * scale),
            spd: template.spd
        };
        const goldReward = (b.hunt_gold_base ?? 15) + day * (b.hunt_gold_per_day ?? 3);

        return { enemy, goldReward, stageName: `사냥 — ${template.name}` };
    }

    /** 사냥 결과 반영 */
    applyHuntResult(hero, victory, goldReward) {
        const b = this.balance;
        if (victory) {
            hero.status = 'hunt';
            const gold = this.store.getState('gold') || 0;
            this.store.setState('gold', gold + goldReward);
            this.heroManager.updateMorale(hero.id, b.hunt_win_morale ?? 3);
        } else {
            hero.status = 'injured';
            this.heroManager.updateMorale(hero.id, b.hunt_lose_morale ?? -5);
        }
        this.store.setState('heroes', [...this.heroManager.getHeroes()]);
    }

    /** 적합도 계산 (건설/연구/사냥 투입 시 표시) */
    calcFitness(hero, primaryStats) {
        let total = 0;
        for (const stat of primaryStats) total += hero.stats[stat] || 0;
        return Math.floor(total / primaryStats.length);
    }
}

export default DayActions;
