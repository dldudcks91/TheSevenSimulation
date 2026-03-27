/**
 * 원정 관리 — 파티 파견, 자동 전투, 결과 보고
 * 스테이지/적 데이터는 CSV에서 로드된 stagesData로 주입
 * 방어전 스케일링도 balance 데이터 기반
 */
import BattleEngine, { BATTLE_TYPES, BATTLE_MODES } from './BattleEngine.js';

class ExpeditionManager {
    constructor(store, balance = {}) {
        this.store = store;
        this.balance = balance;
        this.battleEngine = new BattleEngine(balance);
        this._stagesData = {};
        this._battleMode = BATTLE_MODES.MELEE;
        this._initState();
    }

    /** 전투 모드 설정 (MELEE / TAG) */
    setBattleMode(mode) {
        this._battleMode = mode;
    }

    /** stagesData 주입 (app.js에서 registry를 통해 전달) */
    setStagesData(stagesData) {
        this._stagesData = stagesData || {};
    }

    _initState() {
        this.store.setState('expedition', {
            active: null,
            progress: 0,
            chapter: 1,
            lastResult: null,
            lastRaidDay: 0,
            nextRaidDay: 0
        });
    }

    /** 습격 발생 여부 판단 (3~5일 간격) */
    shouldRaid(day) {
        const expedition = this.store.getState('expedition');
        if (day < (expedition.nextRaidDay || 0)) return false;

        const min = this.balance.raid_interval_min ?? 3;
        const max = this.balance.raid_interval_max ?? 5;
        const interval = min + Math.floor(Math.random() * (max - min + 1));

        expedition.lastRaidDay = day;
        expedition.nextRaidDay = day + interval;
        this.store.setState('expedition', { ...expedition });
        return true;
    }

    /** 원정 파견 (병사 배정 포함) */
    dispatch(heroIds, stageIndex, soldierCount = 0) {
        const heroes = this.store.getState('heroes') || [];
        const expedition = this.store.getState('expedition');
        const soldiers = this.store.getState('soldiers') || 0;

        const maxParty = this.balance.max_party_size ?? 3;
        const minSoldiers = this.balance.min_soldiers ?? 1;

        if (expedition.active) return { success: false, reason: '이미 원정 중' };
        if (heroIds.length === 0 || heroIds.length > maxParty) return { success: false, reason: `1~${maxParty}명 선택` };
        if (soldierCount < minSoldiers) return { success: false, reason: `최소 병사 ${minSoldiers}명 필요` };
        if (soldierCount > soldiers) return { success: false, reason: '병사 부족' };

        const chapter = `ch${expedition.chapter}`;
        const stages = this._stagesData[chapter];
        if (!stages || stageIndex >= stages.length) return { success: false, reason: '스테이지 없음' };

        for (const id of heroIds) {
            const hero = heroes.find(h => h.id === id);
            if (hero) {
                hero.status = 'expedition';
                hero.location = 'expedition';
            }
        }
        this.store.setState('heroes', [...heroes]);
        this.store.setState('soldiers', soldiers - soldierCount);

        expedition.active = { heroIds, stageIndex, chapter, soldierCount };
        this.store.setState('expedition', { ...expedition });

        return { success: true, stage: stages[stageIndex] };
    }

    /** 저녁에 원정 결과 처리 */
    resolveExpedition() {
        const expedition = this.store.getState('expedition');
        if (!expedition.active) return null;

        const heroes = this.store.getState('heroes') || [];
        const { heroIds, stageIndex, chapter, soldierCount } = expedition.active;
        const stages = this._stagesData[chapter];
        const stage = stages[stageIndex];

        const partyHeroes = heroIds.map(id => heroes.find(h => h.id === id)).filter(Boolean);

        const battleResult = this.battleEngine.simulate(
            partyHeroes, [...stage.enemies],
            BATTLE_TYPES.EXPEDITION, soldierCount || 0,
            this._battleMode
        );

        for (const hr of battleResult.heroResults) {
            const hero = heroes.find(h => h.id === hr.id);
            if (!hero) continue;
            hero.status = hr.alive ? 'idle' : 'injured';
            hero.location = 'base';
        }

        const soldiersSurvived = battleResult.soldiersSurvived || 0;
        if (soldiersSurvived > 0) {
            const currentSoldiers = this.store.getState('soldiers') || 0;
            this.store.setState('soldiers', currentSoldiers + soldiersSurvived);
        }

        let goldReward = 0;
        if (battleResult.victory) {
            goldReward = stage.reward;
            const gold = this.store.getState('gold') || 0;
            this.store.setState('gold', gold + goldReward);

            if (stageIndex + 1 <= (stages.length - 1)) {
                expedition.progress = Math.max(expedition.progress, stageIndex + 1);
            }
            if (stage.isBoss) {
                const maxChapters = this.balance.max_chapters ?? 7;
                expedition.chapter = Math.min(maxChapters, expedition.chapter + 1);
                expedition.progress = 0;
            }
        }

        const result = {
            victory: battleResult.victory,
            stageName: stage.name,
            isBoss: stage.isBoss || false,
            goldReward,
            heroResults: battleResult.heroResults,
            soldiersDeployed: battleResult.soldiersDeployed || 0,
            soldiersSurvived: battleResult.soldiersSurvived || 0,
            soldiersLost: battleResult.soldiersLost || 0,
            log: battleResult.log,
            rounds: battleResult.rounds
        };

        expedition.active = null;
        expedition.lastResult = result;
        this.store.setState('expedition', { ...expedition });
        this.store.setState('heroes', [...heroes]);

        return result;
    }

    /** 현재 챕터/진행 상태 */
    getProgress() {
        const exp = this.store.getState('expedition');
        const chapter = `ch${exp.chapter}`;
        const stages = this._stagesData[chapter] || [];
        return {
            chapter: exp.chapter,
            progress: exp.progress,
            totalStages: stages.length,
            stages: stages.map((s, i) => ({
                name: s.name,
                isBoss: s.isBoss || false,
                unlocked: i <= exp.progress,
                enemies: s.enemies.length
            })),
            active: exp.active
        };
    }

    /** 방어전 (밤 습격) — balance CSV 기반 스케일링 */
    simulateDefense(day) {
        const heroes = this.store.getState('heroes') || [];
        const baseHeroes = heroes.filter(h => h.location === 'base' && h.status !== 'injured');
        const soldiers = this.store.getState('soldiers') || 0;

        if (baseHeroes.length === 0 && soldiers === 0) {
            return { victory: false, reason: 'no_defenders', log: [], soldiersLost: 0 };
        }

        // balance에서 방어전 스케일링 로드
        const b = this.balance;
        const defHpBase = b.defense_enemy_hp_base ?? 30;
        const defHpPerDay = b.defense_enemy_hp_per_day ?? 3;
        const defAtkBase = b.defense_enemy_atk_base ?? 8;
        const defAtkPerDay = b.defense_enemy_atk_per_day ?? 1;
        const defSpd = b.defense_enemy_spd ?? 5;

        const scale = Math.floor(day / 3) + 1;
        const enemies = [];
        for (let i = 0; i < scale + 1; i++) {
            enemies.push({
                name: `습격병 ${i + 1}`,
                hp: defHpBase + day * defHpPerDay,
                atk: defAtkBase + day * defAtkPerDay,
                spd: defSpd
            });
        }

        const result = this.battleEngine.simulate(baseHeroes, enemies, BATTLE_TYPES.DEFENSE, soldiers, this._battleMode);

        for (const hr of result.heroResults) {
            const hero = heroes.find(h => h.id === hr.id);
            if (hero && !hr.alive) hero.status = 'injured';
        }
        this.store.setState('heroes', [...heroes]);
        this.store.setState('soldiers', result.soldiersSurvived || 0);

        return {
            victory: result.victory,
            heroResults: result.heroResults,
            soldiersDeployed: result.soldiersDeployed || 0,
            soldiersSurvived: result.soldiersSurvived || 0,
            soldiersLost: result.soldiersLost || 0,
            rounds: result.rounds,
            log: result.log,
            enemyCount: enemies.length
        };
    }
}

export default ExpeditionManager;
