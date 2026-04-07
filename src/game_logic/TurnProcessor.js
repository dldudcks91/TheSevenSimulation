/**
 * 턴 진행 순수 로직 — Phaser 무의존, 백테스팅 가능
 * 모든 manager를 조율하여 낮→저녁→밤→결산을 처리
 *
 * UI 씬(MapTurnFlow)은 이 모듈의 결과를 받아서 연출만 담당
 */
import BattleEngine, { BATTLE_MODES } from './BattleEngine.js';
import { sinChance, sinIntensity } from './SinUtils.js';

class TurnProcessor {
    constructor(store, { turnManager, heroManager, baseManager, sinSystem, expeditionManager, balance }) {
        this.store = store;
        this.turnManager = turnManager;
        this.heroManager = heroManager;
        this.baseManager = baseManager;
        this.sinSystem = sinSystem;
        this.expeditionManager = expeditionManager;
        this.balance = balance;
    }

    // ─── 낮 페이즈 처리 ───

    /** 낮 → 저녁 전환 시 호출. 건설/연구/수입/영웅 상태 정리 */
    processDayPhase() {
        this.baseManager.processBuildTurn();
        this.baseManager.processResearchTurn();
        this.baseManager.processPioneerTurn();

        // 패시브 수입
        const income = this.baseManager.getPassiveIncomeWithBonus();
        if (income > 0) {
            this.store.setState('gold', (this.store.getState('gold') || 0) + income);
        }

        // 농장/벌목장 턴당 자원 생산
        if (this.baseManager.hasFacility('farm')) {
            const farmFood = this.balance.farm_food_per_turn ?? 5;
            this.store.setState('food', (this.store.getState('food') || 0) + farmFood);
        }
        if (this.baseManager.hasFacility('lumber_mill')) {
            const millWood = this.balance.lumber_mill_wood_per_turn ?? 4;
            this.store.setState('wood', (this.store.getState('wood') || 0) + millWood);
        }

        // 영웅 상태 복원 (원정/부상/기절 제외)
        const heroes = this.heroManager.getHeroes();
        for (const h of heroes) {
            if (h.status !== 'expedition' && h.status !== 'injured' && h.status !== 'knocked_out') {
                h.status = 'idle';
            }
        }
        this.store.setState('heroes', [...heroes]);

        // 부상 회복
        if (this.baseManager.processHeroRecovery(heroes).length > 0) {
            this.store.setState('heroes', [...heroes]);
        }
    }

    // ─── 저녁 페이즈 처리 ───

    /** 원정 결과 해소 → 결과 객체 또는 null */
    resolveExpedition() {
        return this.expeditionManager.resolveExpedition();
    }

    // ─── 밤 페이즈 처리 ───

    /** 정책 사기 효과 적용 */
    applyPolicyMorale() {
        const policyDelta = this.baseManager.getPolicyMoraleEffect();
        if (policyDelta !== 0) {
            for (const h of this.heroManager.getHeroes()) {
                this.heroManager.updateMorale(h.id, policyDelta);
            }
        }
    }

    /** 습격 여부 판단 */
    shouldRaid(day) {
        return this.expeditionManager.shouldRaid(day);
    }

    /** 방어전 적 생성 */
    generateRaidEnemies(day) {
        const b = this.balance;
        const raidDivisor = b.raid_scale_divisor ?? 3;
        const scale = Math.floor(day / raidDivisor) + 1;
        const enemies = [];
        for (let i = 0; i < scale + 1; i++) {
            enemies.push({
                name: `습격병 ${i + 1}`,
                hp: (b.defense_enemy_hp_base ?? 30) + day * (b.defense_enemy_hp_per_day ?? 3),
                atk: (b.defense_enemy_atk_base ?? 8) + day * (b.defense_enemy_atk_per_day ?? 1),
                spd: b.defense_enemy_spd ?? 5
            });
        }
        return enemies;
    }

    /** 방어전 BattleEngine 초기화 (씬에서 시각화용으로 사용) */
    createDefenseEngine(baseHeroes, enemies, soldiers) {
        const engine = new BattleEngine(this.balance);
        engine.init(baseHeroes, enemies, 'defense', soldiers, BATTLE_MODES.MELEE);
        return engine;
    }

    /** 방어전 참전 영웅 목록 추출 */
    getDefenseParty() {
        const defenseHeroIds = this.baseManager.getDefenseHeroIds();
        const allHeroes = this.heroManager.getHeroes();
        return allHeroes.filter(h =>
            defenseHeroIds.includes(h.id) && h.status !== 'injured'
        );
    }

    // ─── 밤 결산 ───

    /** 밤 페이즈 종료 처리 — 방어 결과 반영 + 보상/약탈 + 죄종 체크 */
    finishNightPhase(turn, defenseResult) {
        // 방어 배치 초기화 + 영웅 status 복원
        const defHeroIds = this.baseManager.getDefenseHeroIds();
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            if (hero.status === 'defense' || defHeroIds.includes(hero.id)) {
                hero.status = 'idle';
            }
        }
        this.store.setState('heroes', [...heroes]);
        this.baseManager.clearDefenseAssignments();

        const b = this.balance;
        if (defenseResult) {
            // 교만 수치 비례 방어 결과 플래그
            for (const h of this.heroManager.getHeroes()) {
                if (sinIntensity(h.sinStats, 'pride') > 0) h._lastDefenseWin = defenseResult.victory;
            }

            if (defenseResult.victory) {
                const goldReward = (b.defense_victory_gold_base ?? 10) + turn.day * (b.defense_victory_gold_per_day ?? 2);
                this.store.setState('gold', (this.store.getState('gold') || 0) + goldReward);
                for (const h of this.heroManager.getHeroes()) {
                    this.heroManager.updateMorale(h.id, b.defense_victory_morale ?? 5);
                    // 교만 수치 비례 추가 보너스
                    const prideBonus = Math.round(sinIntensity(h.sinStats, 'pride') * (b.pride_defense_win_morale ?? 8));
                    if (prideBonus > 0) this.heroManager.updateMorale(h.id, prideBonus);
                }
            } else {
                for (const h of this.heroManager.getHeroes()) {
                    this.heroManager.updateMorale(h.id, b.defense_defeat_morale ?? -10);
                    // 교만 수치 비례 추가 페널티
                    const pridePenalty = Math.round(sinIntensity(h.sinStats, 'pride') * (b.pride_defense_lose_morale ?? -12));
                    if (pridePenalty !== 0) this.heroManager.updateMorale(h.id, pridePenalty);
                }
                // 패배 시 자원 약탈
                const lootRatio = defenseResult.reason === 'no_defenders'
                    ? (b.defense_nodefender_loot_ratio ?? 0.5)
                    : (b.defense_defeat_loot_ratio ?? 0.3);
                const food = this.store.getState('food') || 0;
                const wood = this.store.getState('wood') || 0;
                const gold = this.store.getState('gold') || 0;
                const lostFood = Math.floor(food * lootRatio);
                const lostWood = Math.floor(wood * lootRatio);
                const lostGold = Math.floor(gold * lootRatio);
                this.store.setState('food', food - lostFood);
                this.store.setState('wood', wood - lostWood);
                this.store.setState('gold', gold - lostGold);
                defenseResult.loot = { food: lostFood, wood: lostWood, gold: lostGold };
            }
        }

        // 죄종 조건 체크
        this.checkSinConditions();

        // 폭주/이탈 극한 체크
        this.sinSystem.setRampageThreshold(this.baseManager.getRampageThreshold());
        const extremeResults = this.sinSystem.checkExtremes();

        // 게임 오버 체크
        const gameOver = this.heroManager.getHeroes().length === 0;

        return { extremeResults, gameOver };
    }

    /** 죄종별 조건 체크 (밤 결산 시) */
    checkSinConditions() {
        const b = this.balance;
        for (const hero of this.heroManager.getHeroes()) {
            // 분노: sinChance 확률로 페널티 발동 + sinIntensity로 강도
            if (hero.location === 'base') {
                hero.daysIdle = (hero.daysIdle || 0) + 1;
                if (hero.daysIdle >= (b.wrath_idle_threshold ?? 3)) {
                    if (Math.random() < sinChance(hero.sinStats, 'wrath')) {
                        const penalty = Math.round(sinIntensity(hero.sinStats, 'wrath') * (b.wrath_idle_morale ?? -5));
                        if (penalty !== 0) this.heroManager.updateMorale(hero.id, penalty);
                    }
                }
            } else {
                hero.daysIdle = 0;
            }
            // 나태: 수치 비례 사기 변동
            const slothInt = sinIntensity(hero.sinStats, 'sloth');
            if (slothInt > 0) {
                if (hero.status !== 'idle') {
                    const workPenalty = Math.round(slothInt * (b.sloth_work_morale ?? -3));
                    if (workPenalty !== 0) this.heroManager.updateMorale(hero.id, workPenalty);
                } else {
                    const restBonus = Math.round(slothInt * (b.sloth_rest_morale ?? 3));
                    if (restBonus !== 0) this.heroManager.updateMorale(hero.id, restBonus);
                }
            }
        }
    }
}

export default TurnProcessor;
