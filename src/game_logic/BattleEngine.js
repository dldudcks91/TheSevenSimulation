/**
 * 전투 엔진 — 실시간 tick 기반 자동전투
 * 모든 밸런스 상수는 balance 데이터에서 주입
 */

const BATTLE_TYPES = { EXPEDITION: 'expedition', DEFENSE: 'defense' };

class BattleEngine {
    constructor(balance = {}) {
        this.balance = balance;
        this.MAX_ROUNDS = balance.max_battle_rounds ?? 20;
        this.SOLDIER_HP = balance.soldier_hp ?? 30;
        this.SOLDIER_ATK = balance.soldier_atk ?? 5;
        this.SOLDIER_SPD = balance.soldier_spd ?? 3;
        this.DMG_VAR_MIN = balance.damage_variance_min ?? 0.8;
        this.DMG_VAR_MAX = balance.damage_variance_max ?? 1.2;
        this.HP_BASE = balance.hp_base ?? 50;
        this.HP_VIT = balance.hp_vitality_mult ?? 5;
        this.HP_STR = balance.hp_strength_mult ?? 2;
        this.ATK_DEF_STR = balance.atk_defense_str_mult ?? 1.5;
        this.ATK_DEF_LEAD = balance.atk_defense_lead_mult ?? 0.8;
        this.ATK_EXP_STR = balance.atk_expedition_str_mult ?? 1.2;
        this.ATK_EXP_AGI = balance.atk_expedition_agi_mult ?? 0.8;

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

    /** 전투 초기화 */
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

        this._soldierUnits = [];
        for (let i = 0; i < soldierCount; i++) {
            this._soldierUnits.push({
                name: `민병 ${i + 1}`,
                hp: this.SOLDIER_HP,
                maxHp: this.SOLDIER_HP,
                atk: this.SOLDIER_ATK,
                spd: this.SOLDIER_SPD,
                isHero: true,
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

    /** 1틱 = 1행동 */
    tick() {
        if (this._finished) return null;

        if (this._turnIndex >= this._turnQueue.length) {
            const result = this._checkResult();
            if (result) return result;

            if (this._round >= this.MAX_ROUNDS) {
                this._finished = true;
                this._victory = false;
                return { type: 'result', winner: 'timeout', rounds: this._round };
            }

            this._prepareNextRound();
        }

        const unit = this._turnQueue[this._turnIndex++];
        if (!unit || !unit.alive) return this.tick();

        const target = this._selectTarget(unit);
        if (!target) {
            const result = this._checkResult();
            if (result) return result;
            return null;
        }

        const variance = this.DMG_VAR_MIN + Math.random() * (this.DMG_VAR_MAX - this.DMG_VAR_MIN);
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

            const result = this._checkResult();
            if (result) {
                events.push(result);
            }
        }

        return events;
    }

    isFinished() { return this._finished; }

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

    getUnits() {
        return {
            heroes: this._heroUnits.map(u => ({ name: u.name, hp: u.hp, maxHp: u.maxHp, alive: u.alive, isHero: true })),
            soldiers: { total: this._soldierUnits.length, alive: this._soldierUnits.filter(u => u.alive).length },
            enemies: this._enemyUnits.map(u => ({ name: u.name, hp: u.hp, maxHp: u.maxHp, alive: u.alive, isHero: false }))
        };
    }

    /** 전투 일괄 실행 */
    simulate(heroes, enemies, type = BATTLE_TYPES.EXPEDITION, soldierCount = 0) {
        const startEvent = this.init(heroes, enemies, type, soldierCount);
        const log = [];
        log.push({ type: 'start', heroes: startEvent.heroes.map(u => u.name), soldiers: startEvent.soldiers, enemies: startEvent.enemies.map(u => u.name) });

        while (!this._finished) {
            const events = this.tick();
            if (!events) break;
            const eventArray = Array.isArray(events) ? events : [events];
            for (const evt of eventArray) log.push(evt);
        }

        const result = this.getResult();
        return { victory: result.victory, log, heroResults: result.heroResults, soldiersDeployed: result.soldiersDeployed, soldiersSurvived: result.soldiersSurvived, soldiersLost: result.soldiersLost, rounds: result.rounds };
    }

    _selectTarget(unit) {
        if (unit.isHero) {
            const targets = this._enemyUnits.filter(u => u.alive);
            if (targets.length === 0) return null;
            return targets[Math.floor(Math.random() * targets.length)];
        }
        if (this._hasSoldiers) {
            const soldiers = this._soldierUnits.filter(u => u.alive);
            if (soldiers.length === 0) return null;
            return soldiers[Math.floor(Math.random() * soldiers.length)];
        }
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
            const soldiersAlive = this._soldierUnits.filter(u => u.alive);
            if (soldiersAlive.length === 0) {
                this._finished = true;
                this._victory = false;
                return { type: 'result', winner: 'retreat', rounds: this._round };
            }
        }
        const alliesAlive = [...this._heroUnits.filter(u => u.alive), ...this._soldierUnits.filter(u => u.alive)];
        if (alliesAlive.length === 0) {
            this._finished = true;
            this._victory = false;
            return { type: 'result', winner: 'enemies', rounds: this._round };
        }
        return null;
    }

    _calcHP(hero) {
        return this.HP_BASE + hero.stats.vitality * this.HP_VIT + hero.stats.strength * this.HP_STR;
    }

    _calcATK(hero, type) {
        if (type === BATTLE_TYPES.DEFENSE) {
            return Math.floor(hero.stats.strength * this.ATK_DEF_STR + hero.stats.leadership * this.ATK_DEF_LEAD);
        }
        return Math.floor(hero.stats.strength * this.ATK_EXP_STR + hero.stats.agility * this.ATK_EXP_AGI);
    }

    _calcHeroResults(heroUnits) {
        return heroUnits.map(u => ({
            id: u.id, name: u.name, alive: u.alive,
            hpPercent: Math.max(0, Math.floor((u.hp / u.maxHp) * 100)),
            status: u.alive ? 'ok' : 'knocked_out'
        }));
    }
}

export default BattleEngine;
export { BATTLE_TYPES };
