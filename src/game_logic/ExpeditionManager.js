/**
 * 원정 관리 — 파티 파견, 자동 전투, 결과 보고
 */
import BattleEngine, { BATTLE_TYPES } from './BattleEngine.js';

const STAGES = {
    ch1: [
        { id: 'ch1_s1', name: '불타는 전초기지', enemies: [
            { name: '분노의 졸개', hp: 60, atk: 12, spd: 5 },
            { name: '분노의 졸개', hp: 60, atk: 12, spd: 5 },
            { name: '화염 사냥개', hp: 40, atk: 15, spd: 8 }
        ], reward: 80 },
        { id: 'ch1_s2', name: '재의 계곡', enemies: [
            { name: '분노의 전사', hp: 80, atk: 16, spd: 6 },
            { name: '분노의 전사', hp: 80, atk: 16, spd: 6 },
            { name: '화염 마법사', hp: 50, atk: 20, spd: 4 }
        ], reward: 120 },
        { id: 'ch1_s3', name: '용암의 성채', enemies: [
            { name: '분노의 근위병', hp: 100, atk: 18, spd: 5 },
            { name: '분노의 근위병', hp: 100, atk: 18, spd: 5 },
            { name: '화염의 정예', hp: 70, atk: 22, spd: 7 },
            { name: '불꽃 사냥개', hp: 50, atk: 20, spd: 9 }
        ], reward: 160 },
        { id: 'ch1_boss', name: '사탄의 왕좌', isBoss: true, enemies: [
            { name: '사탄 — 분노의 화신', hp: 300, atk: 30, spd: 6 }
        ], reward: 300 }
    ]
};

class ExpeditionManager {
    constructor(store) {
        this.store = store;
        this.battleEngine = new BattleEngine();
        this._initState();
    }

    _initState() {
        this.store.setState('expedition', {
            active: null,       // { heroIds, stageId, chapter }
            progress: 0,        // 현재 챕터 진행 스테이지 인덱스
            chapter: 1,
            lastResult: null
        });
    }

    /** 원정 파견 */
    dispatch(heroIds, stageIndex) {
        const heroes = this.store.getState('heroes') || [];
        const expedition = this.store.getState('expedition');

        if (expedition.active) return { success: false, reason: '이미 원정 중' };
        if (heroIds.length === 0 || heroIds.length > 3) return { success: false, reason: '1~3명 선택' };

        const chapter = `ch${expedition.chapter}`;
        const stages = STAGES[chapter];
        if (!stages || stageIndex >= stages.length) return { success: false, reason: '스테이지 없음' };

        // 영웅 상태 변경
        for (const id of heroIds) {
            const hero = heroes.find(h => h.id === id);
            if (hero) {
                hero.status = 'expedition';
                hero.location = 'expedition';
            }
        }
        this.store.setState('heroes', [...heroes]);

        expedition.active = { heroIds, stageIndex, chapter };
        this.store.setState('expedition', { ...expedition });

        return { success: true, stage: stages[stageIndex] };
    }

    /** 저녁에 원정 결과 처리 */
    resolveExpedition() {
        const expedition = this.store.getState('expedition');
        if (!expedition.active) return null;

        const heroes = this.store.getState('heroes') || [];
        const { heroIds, stageIndex, chapter } = expedition.active;
        const stages = STAGES[chapter];
        const stage = stages[stageIndex];

        // 원정 영웅 추출
        const partyHeroes = heroIds.map(id => heroes.find(h => h.id === id)).filter(Boolean);

        // 전투 실행
        const battleResult = this.battleEngine.simulate(partyHeroes, [...stage.enemies], BATTLE_TYPES.EXPEDITION);

        // 전투 결과 적용
        for (const hr of battleResult.heroResults) {
            const hero = heroes.find(h => h.id === hr.id);
            if (!hero) continue;

            if (!hr.alive) {
                hero.status = 'injured';
            } else {
                hero.status = 'idle';
            }
            hero.location = 'base';
        }

        // 보상
        let goldReward = 0;
        if (battleResult.victory) {
            goldReward = stage.reward;
            const gold = this.store.getState('gold') || 0;
            this.store.setState('gold', gold + goldReward);

            // 챕터 진행
            if (stageIndex + 1 <= (stages.length - 1)) {
                expedition.progress = Math.max(expedition.progress, stageIndex + 1);
            }
            if (stage.isBoss) {
                expedition.chapter = Math.min(7, expedition.chapter + 1);
                expedition.progress = 0;
            }
        }

        const result = {
            victory: battleResult.victory,
            stageName: stage.name,
            isBoss: stage.isBoss || false,
            goldReward,
            heroResults: battleResult.heroResults,
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
        const stages = STAGES[chapter] || [];
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

    /** 방어전 (밤 습격) */
    simulateDefense(day) {
        const heroes = this.store.getState('heroes') || [];
        const baseHeroes = heroes.filter(h => h.location === 'base' && h.status !== 'injured');

        if (baseHeroes.length === 0) {
            return { victory: false, reason: 'no_defenders', log: [] };
        }

        // 습격 규모: 날이 갈수록 강해짐
        const scale = Math.floor(day / 3) + 1;
        const enemies = [];
        for (let i = 0; i < scale + 1; i++) {
            enemies.push({
                name: `습격병 ${i + 1}`,
                hp: 30 + day * 3,
                atk: 8 + day,
                spd: 5
            });
        }

        const result = this.battleEngine.simulate(baseHeroes, enemies, BATTLE_TYPES.DEFENSE);

        // 방어 결과 → 영웅 상태 반영
        for (const hr of result.heroResults) {
            const hero = heroes.find(h => h.id === hr.id);
            if (hero && !hr.alive) {
                hero.status = 'injured';
            }
        }
        this.store.setState('heroes', [...heroes]);

        return {
            victory: result.victory,
            heroResults: result.heroResults,
            rounds: result.rounds,
            log: result.log,
            enemyCount: enemies.length
        };
    }
}

export default ExpeditionManager;
