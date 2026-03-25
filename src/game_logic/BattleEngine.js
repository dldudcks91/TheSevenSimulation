/**
 * 전투 엔진 — 실시간 tick 기반 자동전투
 *
 * 두 가지 모드:
 * 1. tick 모드 (실시간): init() → tick() 반복 → isFinished()
 * 2. simulate 모드 (일괄): 기존 호환 — 내부적으로 tick 반복
 *
 * 병사 시스템:
 * - init()에 soldierCount 전달 → 민병 유닛 자동 생성
 * - 적은 병사를 우선 타겟 (병사 전멸 후 영웅 노출)
 */

const BATTLE_TYPES = { EXPEDITION: 'expedition', DEFENSE: 'defense' };

const MAX_ROUNDS = 20;

/** 민병 기본 스펙 */
const SOLDIER_STATS = { hp: 30, atk: 5, spd: 3 };

class BattleEngine {
    constructor() {
        this._heroUnits = [];
        this._soldierUnits = [];
        this._enemyUnits = [];
        this._round = 0;
        this._turnQueue = [];
        this._turnIndex = 0;
        this._finished = false;
        this._victory = null;
        this._type = BATTLE_TYPES.EXPEDITION;
    }

    // ═══════════════════════════════════
    // tick 모드 (실시간 전투용)
    // ═══════════════════════════════════

    /** 전투 초기화 — 유닛 세팅, 첫 라운드 준비 */
    init(heroes, enemies, type = BATTLE_TYPES.EXPEDITION, soldierCount = 0) {
        this._type = type;
        this._round = 0;
        this._finished = false;
        this._victory = null;
        this._turnQueue = [];
        this._turnIndex = 0;

        this._heroUnits = heroes.map(h => ({
            ...h,
            hp: this._calcHP(h),
            maxHp: this._calcHP(h),
            atk: this._calcATK(h, type),
            isHero: true,
            isSoldier: false,
            alive: true
        }));

        // 병사 유닛 생성
        this._soldierUnits = [];
        for (let i = 0; i < soldierCount; i++) {
            this._soldierUnits.push({
                name: `민병 ${i + 1}`,
                hp: SOLDIER_STATS.hp,
                maxHp: SOLDIER_STATS.hp,
                atk: SOLDIER_STATS.atk,
                spd: SOLDIER_STATS.spd,
                isHero: true,  // 아군 진영
                isSoldier: true,
                alive: true
            });
        }

        this._hasSoldiers = soldierCount > 0;

        this._enemyUnits = enemies.map((e, i) => ({
            ...e,
            name: enemies.filter((_, j) => j < i && _.name === e.name).length > 0
                ? `${e.name} ${String.fromCharCode(65 + i)}`
                : e.name,
            hp: e.hp,
            maxHp: e.hp,
            isHero: false,
            isSoldier: false,
            alive: true
        }));

        this._prepareNextRound();

        return {
            type: 'start',
            heroes: this._heroUnits.map(u => ({ name: u.name, hp: u.hp, maxHp: u.maxHp })),
            soldiers: this._soldierUnits.length,
            enemies: this._enemyUnits.map(u => ({ name: u.name, hp: u.hp, maxHp: u.maxHp }))
        };
    }

    /** 1틱 = 1행동. 다음 유닛이 공격하고 결과 반환 */
    tick() {
        if (this._finished) return null;

        // 현재 라운드의 턴 큐가 비었으면 다음 라운드
        if (this._turnIndex >= this._turnQueue.length) {
            // 승패 판정
            const result = this._checkResult();
            if (result) return result;

            // 라운드 한계
            if (this._round >= MAX_ROUNDS) {
                this._finished = true;
                this._victory = false;
                return { type: 'result', winner: 'timeout', rounds: this._round };
            }

            this._prepareNextRound();
        }

        const unit = this._turnQueue[this._turnIndex++];
        if (!unit || !unit.alive) return this.tick(); // 죽은 유닛 스킵

        // 타겟 선택
        const target = this._selectTarget(unit);

        if (!target) {
            const result = this._checkResult();
            if (result) return result;
            return null;
        }

        // 데미지 계산 (±20%)
        const variance = 0.8 + Math.random() * 0.4;
        const dmg = Math.max(1, Math.floor(unit.atk * variance));
        target.hp -= dmg;

        const events = [];

        events.push({
            type: 'attack',
            round: this._round,
            attacker: unit.name,
            attackerIsSoldier: unit.isSoldier,
            defender: target.name,
            defenderIsSoldier: target.isSoldier,
            damage: dmg,
            remainHp: Math.max(0, target.hp),
            maxHp: target.maxHp
        });

        // 사망 처리
        if (target.hp <= 0) {
            target.alive = false;
            target.hp = 0;

            if (target.isHero && !target.isSoldier) {
                target.status = 'knocked_out';
            }

            events.push({
                type: 'defeat',
                round: this._round,
                name: target.name,
                isHero: target.isHero,
                isSoldier: target.isSoldier
            });

            // 즉시 승패 체크
            const result = this._checkResult();
            if (result) {
                events.push(result);
            }
        }

        return events;
    }

    /** 전투 종료 여부 */
    isFinished() {
        return this._finished;
    }

    /** 전투 결과 */
    getResult() {
        const soldiersAlive = this._soldierUnits.filter(u => u.alive).length;
        const soldiersDead = this._soldierUnits.length - soldiersAlive;

        return {
            victory: this._victory,
            heroResults: this._calcHeroResults(this._heroUnits),
            soldiersDeployed: this._soldierUnits.length,
            soldiersSurvived: soldiersAlive,
            soldiersLost: soldiersDead,
            rounds: this._round
        };
    }

    /** 모든 유닛 상태 (씬 초기화용) */
    getUnits() {
        return {
            heroes: this._heroUnits.map(u => ({
                name: u.name, hp: u.hp, maxHp: u.maxHp, alive: u.alive, isHero: true
            })),
            soldiers: {
                total: this._soldierUnits.length,
                alive: this._soldierUnits.filter(u => u.alive).length
            },
            enemies: this._enemyUnits.map(u => ({
                name: u.name, hp: u.hp, maxHp: u.maxHp, alive: u.alive, isHero: false
            }))
        };
    }

    // ═══════════════════════════════════
    // simulate 모드 (기존 호환)
    // ═══════════════════════════════════

    /** 전투 일괄 실행 — 원정 결과용 */
    simulate(heroes, enemies, type = BATTLE_TYPES.EXPEDITION, soldierCount = 0) {
        const startEvent = this.init(heroes, enemies, type, soldierCount);

        const log = [];
        log.push({
            type: 'start',
            heroes: startEvent.heroes.map(u => u.name),
            soldiers: startEvent.soldiers,
            enemies: startEvent.enemies.map(u => u.name)
        });

        while (!this._finished) {
            const events = this.tick();
            if (!events) break;

            const eventArray = Array.isArray(events) ? events : [events];
            for (const evt of eventArray) {
                log.push(evt);
            }
        }

        const result = this.getResult();
        return {
            victory: result.victory,
            log,
            heroResults: result.heroResults,
            soldiersDeployed: result.soldiersDeployed,
            soldiersSurvived: result.soldiersSurvived,
            soldiersLost: result.soldiersLost,
            rounds: result.rounds
        };
    }

    // ═══════════════════════════════════
    // 내부 로직
    // ═══════════════════════════════════

    /**
     * 타겟 선택
     * - 병사가 배치된 전투: 적은 병사만 공격 가능 (영웅은 타겟 불가)
     *   병사 전멸 시 영웅 이탈 → _checkResult에서 패배 처리
     * - 병사 없는 전투 (사냥 등): 적이 영웅 직접 공격
     */
    _selectTarget(unit) {
        if (unit.isHero) {
            // 아군(영웅/병사) → 적 공격 (랜덤)
            const targets = this._enemyUnits.filter(u => u.alive);
            if (targets.length === 0) return null;
            return targets[Math.floor(Math.random() * targets.length)];
        }

        // 적 → 아군 공격
        if (this._hasSoldiers) {
            // 병사 배치된 전투: 병사만 타겟 가능
            const soldiers = this._soldierUnits.filter(u => u.alive);
            if (soldiers.length === 0) return null; // 병사 전멸 → 타겟 없음
            return soldiers[Math.floor(Math.random() * soldiers.length)];
        }

        // 병사 없는 전투: 영웅 직접 타겟
        const heroes = this._heroUnits.filter(u => u.alive);
        if (heroes.length === 0) return null;
        return heroes[Math.floor(Math.random() * heroes.length)];
    }

    _prepareNextRound() {
        this._round++;
        this._turnIndex = 0;

        const allAlive = [
            ...this._heroUnits.filter(u => u.alive),
            ...this._soldierUnits.filter(u => u.alive),
            ...this._enemyUnits.filter(u => u.alive)
        ];

        // 행동 순서: 민첩(spd) 기준 내림차순
        allAlive.sort((a, b) => {
            const spdA = a.stats?.agility || a.spd || 5;
            const spdB = b.stats?.agility || b.spd || 5;
            return spdB - spdA;
        });

        this._turnQueue = allAlive;
    }

    _checkResult() {
        const enemiesAlive = this._enemyUnits.filter(u => u.alive);

        if (enemiesAlive.length === 0) {
            this._finished = true;
            this._victory = true;
            return { type: 'result', winner: 'heroes', rounds: this._round };
        }

        if (this._hasSoldiers) {
            // 병사 전멸 → 영웅 이탈 (패배)
            const soldiersAlive = this._soldierUnits.filter(u => u.alive);
            if (soldiersAlive.length === 0) {
                this._finished = true;
                this._victory = false;
                return { type: 'result', winner: 'retreat', rounds: this._round };
            }
        }

        // 병사 없는 전투: 영웅 전멸 시 패배
        const alliesAlive = [
            ...this._heroUnits.filter(u => u.alive),
            ...this._soldierUnits.filter(u => u.alive)
        ];

        if (alliesAlive.length === 0) {
            this._finished = true;
            this._victory = false;
            return { type: 'result', winner: 'enemies', rounds: this._round };
        }

        return null;
    }

    _calcHP(hero) {
        return 50 + hero.stats.vitality * 5 + hero.stats.strength * 2;
    }

    _calcATK(hero, type) {
        if (type === BATTLE_TYPES.DEFENSE) {
            return Math.floor(hero.stats.strength * 1.5 + hero.stats.leadership * 0.8);
        }
        return Math.floor(hero.stats.strength * 1.2 + hero.stats.agility * 0.8);
    }

    _calcHeroResults(heroUnits) {
        return heroUnits.map(u => ({
            id: u.id,
            name: u.name,
            alive: u.alive,
            hpPercent: Math.max(0, Math.floor((u.hp / u.maxHp) * 100)),
            status: u.alive ? 'ok' : 'knocked_out'
        }));
    }
}

export default BattleEngine;
export { BATTLE_TYPES, SOLDIER_STATS };
