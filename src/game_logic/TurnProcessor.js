/**
 * 턴 진행 순수 로직 — Phaser 무의존, 백테스팅 가능
 * 모든 manager를 조율하여 낮→저녁→밤→결산을 처리
 *
 * UI 씬(MapTurnFlow)은 이 모듈의 결과를 받아서 연출만 담당
 */
import BattleEngine, { BATTLE_MODES } from './BattleEngine.js';
import { sinChance, sinIntensity } from './SinUtils.js';

class TurnProcessor {
    constructor(store, { turnManager, heroManager, baseManager, sinSystem, expeditionManager, edictManager, balance }) {
        this.store = store;
        this.turnManager = turnManager;
        this.heroManager = heroManager;
        this.baseManager = baseManager;
        this.sinSystem = sinSystem;
        this.expeditionManager = expeditionManager;
        this.edictManager = edictManager;
        this.balance = balance;
    }

    // ─── 낮 페이즈 처리 ───

    /** 낮 → 저녁 전환 시 호출. 건설/연구/수입/영웅 상태 정리 */
    processDayPhase() {
        // 국시 만료/쿨다운 해소 체크 (날이 바뀐 시점 처리)
        if (this.edictManager) {
            const turn = this.turnManager.getCurrentTurn();
            this.edictManager.tickDay(turn.day);
        }

        this.baseManager.processBuildTurn();
        this.baseManager.processResearchTurn();
        this.baseManager.processPioneerTurn();

        // 패시브 수입 (국시 resource_gain_mult 적용)
        const income = this.baseManager.getPassiveIncomeWithBonus();
        const resourceMult = 1 + (this.edictManager ? this.edictManager.getEffect('resource_gain_mult') : 0);
        if (income > 0) {
            this.store.setState('gold', (this.store.getState('gold') || 0) + Math.floor(income * resourceMult));
        }

        // 농장/벌목장 턴당 자원 생산 (resource_gain_mult 적용)
        if (this.baseManager.hasFacility('farm')) {
            const farmFood = (this.balance.farm_food_per_turn ?? 5) * resourceMult;
            this.store.setState('food', (this.store.getState('food') || 0) + Math.floor(farmFood));
        }
        if (this.baseManager.hasFacility('lumber_mill')) {
            const millWood = (this.balance.lumber_mill_wood_per_turn ?? 4) * resourceMult;
            this.store.setState('wood', (this.store.getState('wood') || 0) + Math.floor(millWood));
        }

        // 국시 사기 tick (morale_tick) — 사기 시스템 재도입 시 연결 예정
        // 현재는 HeroManager에 updateMorale이 없으므로 no-op
        // TODO: 사기→죄종 전환 시 해당 국시 죄종에 sinStat +/- tick으로 매핑

        // 영웅 상태 복원 (원정/부상/기절/발병 제외)
        const heroes = this.heroManager.getHeroes();
        for (const h of heroes) {
            if (h.status !== 'expedition' && h.status !== 'injured'
                && h.status !== 'knocked_out' && h.status !== 'sick') {
                h.status = 'idle';
            }
        }
        this.store.setState('heroes', [...heroes]);

        // 부상 회복
        if (this.baseManager.processHeroRecovery(heroes).length > 0) {
            this.store.setState('heroes', [...heroes]);
        }

        // 체력(Stamina) 회복 + HP 자연 회복 + 발병 진행/판정
        for (const h of heroes) {
            if (h.status === 'dead') continue;
            if (h.status === 'sick') {
                this.heroManager.tickSickness(h.id);
            }
            this.heroManager.recoverStaminaTurn(h.id);
            this.heroManager.regenHeroHpTurn(h.id);

            // 발병 판정 (과로일 때만)
            if (h.status !== 'sick' && h.status !== 'injured') {
                this.heroManager.checkSicknessTick(h.id);
            }
        }
        this.store.setState('heroes', [...heroes]);

        // 폭주 중인 영웅 문제 행동 실행
        const rampageResults = [];
        const allHeroes = this.heroManager.getHeroes();
        for (const h of allHeroes) {
            if (h.isRampaging) {
                const r = this.sinSystem.processRampageTick(h, allHeroes);
                if (r) rampageResults.push(r);
            }
        }
        if (rampageResults.length > 0) {
            this.store.setState('heroes', [...allHeroes]);
        }
    }

    // ─── 저녁 페이즈 처리 ───

    /** 원정 결과 해소 → 결과 객체 또는 null */
    resolveExpedition() {
        return this.expeditionManager.resolveExpedition();
    }

    // ─── 밤 페이즈 처리 ───

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
    createDefenseEngine(baseHeroes, enemies) {
        const engine = new BattleEngine(this.balance);
        if (this.edictManager) {
            engine.setPowerMultDelta(this.edictManager.getEffect('battle_power_mult'));
        }
        engine.init(baseHeroes, enemies, 'defense', BATTLE_MODES.MELEE);
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
            // 방어 결과 플래그 설정 (checkSinConditions에서 교만 변동에 사용)
            for (const h of this.heroManager.getHeroes()) {
                h._lastDefenseWin = defenseResult.victory;
            }

            if (defenseResult.victory) {
                const goldReward = (b.defense_victory_gold_base ?? 10) + turn.day * (b.defense_victory_gold_per_day ?? 2);
                this.store.setState('gold', (this.store.getState('gold') || 0) + goldReward);
            } else {
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

        // 죄종 조건 체크 (sinStat 변동)
        this.checkSinConditions();

        // 폭주 상태 갱신 + 이탈 판정
        const extremeResults = this.sinSystem.checkExtremes();

        // 게임 오버 체크
        const gameOver = this.heroManager.getHeroes().length === 0;

        return { extremeResults, gameOver };
    }

    /** 죄종별 조건 체크 → sinStat 수치 변동 (밤 결산 시) */
    checkSinConditions() {
        const b = this.balance;
        const heroes = this.heroManager.getHeroes();
        const expeditionCount = heroes.filter(h => h.status === 'expedition').length;
        const food = this.store.getState('food') || 0;
        const foodLow = food < (b.food_shortage_threshold ?? 30);

        for (const hero of heroes) {
            // ── 분노(wrath) ──
            if (hero.location === 'base') {
                hero.daysIdle = (hero.daysIdle || 0) + 1;
                // idle 유지 → wrath 감소 (싸울 곳이 없어 에너지 방전)
                if (hero.status === 'idle') {
                    this.heroManager.updateSinStat(hero.id, 'wrath', -(b.wrath_idle_fall ?? 1));
                }
            } else {
                hero.daysIdle = 0;
                // 전투 참여 → wrath 상승
                if (hero.status === 'expedition' || hero.status === 'hunt' || hero.status === 'defense') {
                    this.heroManager.updateSinStat(hero.id, 'wrath', b.wrath_combat_rise ?? 1);
                }
            }

            // ── 나태(sloth) ──
            if (hero.status === 'idle') {
                this.heroManager.updateSinStat(hero.id, 'sloth', b.sloth_idle_rise ?? 1);
            } else if (hero.status === 'defense') {
                this.heroManager.updateSinStat(hero.id, 'sloth', -(b.sloth_defense_fall ?? 2));
            } else if (hero.status !== 'injured' && hero.status !== 'sick') {
                this.heroManager.updateSinStat(hero.id, 'sloth', -(b.sloth_action_fall ?? 1));
            }

            // ── 시기(envy) ──
            // 거점에 idle인데 다른 영웅이 원정 중 → envy 상승
            if (hero.status === 'idle' && expeditionCount > 0) {
                this.heroManager.updateSinStat(hero.id, 'envy', b.envy_bench_rise ?? 1);
            }

            // ── 폭식(gluttony) ──
            // 식량 부족 → gluttony 하락 (못 먹어서 불만)
            if (foodLow) {
                this.heroManager.updateSinStat(hero.id, 'gluttony', -(b.gluttony_food_shortage_fall ?? 1));
            }

            // ── 색욕(lust) ──
            // 원정 중 파티원 있음 → lust 상승 / 혼자 idle → lust 하락
            if (hero.status === 'expedition') {
                this.heroManager.updateSinStat(hero.id, 'lust', b.lust_party_rise ?? 1);
            } else if (hero.status === 'idle') {
                this.heroManager.updateSinStat(hero.id, 'lust', -(b.lust_solo_fall ?? 1));
            }

            // ── 교만(pride) ──
            if (hero._lastDefenseWin === true) {
                this.heroManager.updateSinStat(hero.id, 'pride', b.pride_defense_win_rise ?? 2);
            } else if (hero._lastDefenseWin === false) {
                this.heroManager.updateSinStat(hero.id, 'pride', -(b.pride_defense_lose_fall ?? 2));
            }
        }
    }
}

export default TurnProcessor;
