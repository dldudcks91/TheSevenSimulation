/**
 * 낮 행동 순수 로직 — Phaser 무의존, 백테스팅 가능
 * 채집/벌목/연회/안정화/사냥 보상 계산 + 적합도
 */

// sinIntensity 미사용 — 연회 보너스 계산 제거됨

class DayActions {
    constructor(store, heroManager, balance = {}) {
        this.store = store;
        this.heroManager = heroManager;
        this.balance = balance;
    }

    /** 채집 실행 → 식량 획득 + sinStat 변동 + 체력 소모 */
    doGather(hero) {
        const turn = this.store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;
        const baseReward = (b.gather_base_food ?? 8) + Math.floor(Math.random() * day);
        const effMult = this._efficiencyMult(hero);
        const foodReward = Math.max(1, Math.round(baseReward * effMult));

        hero.status = 'gather';
        this.heroManager.consumeStamina(hero.id, b.stamina_cost_gather ?? 10);
        this.store.setState('heroes', [...this.heroManager.getHeroes()]);

        const food = this.store.getState('food') || 0;
        this.store.setState('food', food + foodReward);
        // 채집: 탐욕 상승 (획득), 나태 하락 (몸 움직임)
        this.heroManager.updateSinStat(hero.id, 'greed', b.greed_gather_rise ?? 1);
        this.heroManager.updateSinStat(hero.id, 'sloth', -(b.sloth_action_fall ?? 1));

        return { foodReward };
    }

    /** 벌목 실행 → 나무 획득 + sinStat 변동 + 체력 소모 */
    doLumber(hero) {
        const turn = this.store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;
        const baseReward = (b.lumber_base_wood ?? 6) + Math.floor(Math.random() * day);
        const effMult = this._efficiencyMult(hero);
        const woodReward = Math.max(1, Math.round(baseReward * effMult));

        hero.status = 'lumber';
        this.heroManager.consumeStamina(hero.id, b.stamina_cost_lumber ?? 10);
        this.store.setState('heroes', [...this.heroManager.getHeroes()]);

        const wood = this.store.getState('wood') || 0;
        this.store.setState('wood', wood + woodReward);
        // 벌목: 나태 하락 (몸 움직임)
        this.heroManager.updateSinStat(hero.id, 'sloth', -(b.sloth_action_fall ?? 1));

        return { woodReward };
    }

    /** 체력 구간별 효율 배수 */
    _efficiencyMult(hero) {
        const b = this.balance;
        const stam = hero.stamina ?? (b.stamina_max ?? 100);
        if (stam <= (b.stamina_overwork_threshold ?? 25)) return 0.6;
        if (stam <= (b.stamina_tired_threshold ?? 50)) return 0.8;
        return 1.0;
    }

    /** 연회 실행 → 골드 소비 + 전체 폭식/색욕 sinStat 상승 */
    doFeast() {
        const b = this.balance;
        const feastCost = b.feast_cost ?? 100;
        const gold = this.store.getState('gold') || 0;
        if (gold < feastCost) return { success: false, reason: '골드 부족' };

        this.store.setState('gold', gold - feastCost);
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            // 연회: 폭식 상승 + 색욕 상승 (함께 즐기는 시간)
            this.heroManager.updateSinStat(hero.id, 'gluttony', b.gluttony_feast_rise ?? 2);
            this.heroManager.updateSinStat(hero.id, 'lust', b.lust_feast_rise ?? 1);
            // 탐욕 하락 (풍족해서 움켜쥘 필요 없음)
            this.heroManager.updateSinStat(hero.id, 'greed', -(b.greed_feast_fall ?? 1));
        }
        return { success: true, cost: feastCost };
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
        this.heroManager.consumeStamina(hero.id, b.stamina_cost_hunt ?? 15);
        if (victory) {
            hero.status = 'hunt';
            const gold = this.store.getState('gold') || 0;
            this.store.setState('gold', gold + goldReward);
            // 사냥 승리: 분노 상승 (전투 본능 충족), 교만 상승 (자신감)
            this.heroManager.updateSinStat(hero.id, 'wrath', b.wrath_combat_rise ?? 1);
            this.heroManager.updateSinStat(hero.id, 'pride', b.pride_combat_win_rise ?? 1);
        } else {
            hero.status = 'injured';
            // 사냥 패배: 교만 하락 (자존심 상처)
            this.heroManager.updateSinStat(hero.id, 'pride', -(b.pride_combat_lose_fall ?? 1));
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
