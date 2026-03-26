/**
 * 전투 엔진 — 3가지 전투 모드 지원
 *
 * MELEE: 오토배틀 (전원 동시 교전, X축)
 * TAG: 태그매치 (1:1 순차 교전)
 * DUEL: 일기토 (1:1 단판, 오토배틀 중 삽입)
 *
 * 모든 밸런스 상수는 balance 데이터에서 주입
 */

const BATTLE_TYPES = { EXPEDITION: 'expedition', DEFENSE: 'defense' };
const BATTLE_MODES = { MELEE: 'melee', TAG: 'tag', DUEL: 'duel' };

class BattleEngine {
    constructor(balance = {}) {
        this.balance = balance;
        this.MAX_ROUNDS = balance.max_battle_rounds ?? 50;
        this.SOLDIER_HP = balance.soldier_hp ?? 80;
        this.SOLDIER_ATK = balance.soldier_atk ?? 8;
        this.SOLDIER_SPD = balance.soldier_spd ?? 3;
        this.DMG_VAR_MIN = balance.damage_variance_min ?? 0.8;
        this.DMG_VAR_MAX = balance.damage_variance_max ?? 1.2;
        this.HP_BASE = balance.hp_base ?? 200;
        this.HP_VIT = balance.hp_vitality_mult ?? 15;
        this.HP_STR = balance.hp_strength_mult ?? 5;
        this.ATK_DEF_STR = balance.atk_defense_str_mult ?? 0.8;
        this.ATK_DEF_LEAD = balance.atk_defense_lead_mult ?? 0.4;
        this.ATK_EXP_STR = balance.atk_expedition_str_mult ?? 0.7;
        this.ATK_EXP_AGI = balance.atk_expedition_agi_mult ?? 0.4;
        this.DUEL_REQUEST_CHANCE = balance.duel_request_chance ?? 0.25;
        this.DUEL_ACCEPT_CHANCE = balance.duel_accept_chance ?? 0.7;

        this._reset();
    }

    _reset() {
        this._heroUnits = [];
        this._soldierUnits = [];
        this._enemyUnits = [];
        this._round = 0;
        this._turnQueue = [];
        this._turnIndex = 0;
        this._finished = false;
        this._victory = null;
        this._type = BATTLE_TYPES.EXPEDITION;
        this._mode = BATTLE_MODES.MELEE;
        this._hasSoldiers = false;

        // 태그매치 전용
        this._tagHeroIndex = 0;
        this._tagEnemyIndex = 0;
        this._tagCurrentHero = null;
        this._tagCurrentEnemy = null;

        // 일기토 전용
        this._duelActive = false;
        this._duelHero = null;
        this._duelEnemy = null;

        // SP/카드 시스템
        this._sp = 0;
        this._spMax = 100;
        this._spPerTick = 2;
        this._spPerKill = 10;
        this._activeBuffs = []; // { target, effect_type, value, turnsLeft, id }
    }

    // ═══════════════════════════════════
    // 초기화
    // ═══════════════════════════════════

    init(heroes, enemies, type = BATTLE_TYPES.EXPEDITION, soldierCount = 0, mode = BATTLE_MODES.MELEE) {
        this._reset();
        this._type = type;
        this._mode = mode;

        this._heroUnits = heroes.map(h => this._makeHeroUnit(h, type));

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

        if (this._mode === BATTLE_MODES.TAG) {
            this._initTag();
        } else {
            this._prepareNextRound();
        }

        return {
            type: 'start',
            mode: this._mode,
            heroes: this._heroUnits.map(u => ({ name: u.name, hp: u.hp, maxHp: u.maxHp, sinType: u.sinType })),
            soldiers: this._soldierUnits.length,
            enemies: this._enemyUnits.map(u => ({ name: u.name, hp: u.hp, maxHp: u.maxHp }))
        };
    }

    _makeHeroUnit(h, type) {
        return {
            ...h,
            hp: this._calcHP(h),
            maxHp: this._calcHP(h),
            atk: this._calcATK(h, type),
            spd: h.stats?.agility || 10,
            isHero: true,
            isSoldier: false,
            alive: true,
            sinType: h.sinType || null
        };
    }

    // ═══════════════════════════════════
    // 오토배틀 (MELEE) — 기존 + 일기토 삽입
    // ═══════════════════════════════════

    tick() {
        if (this._finished) return null;

        if (this._mode === BATTLE_MODES.TAG) {
            return this._tickTag();
        }

        // 일기토 진행 중이면 일기토 tick
        if (this._duelActive) {
            return this._tickDuel();
        }

        if (this._turnIndex >= this._turnQueue.length) {
            const result = this._checkResult();
            if (result) return result;

            if (this._round >= this.MAX_ROUNDS) {
                this._finished = true;
                this._victory = false;
                return { type: 'result', winner: 'timeout', rounds: this._round };
            }

            this._prepareNextRound();

            // SP 획득 (라운드마다)
            this._sp = Math.min(this._spMax, this._sp + this._spPerTick);

            // 버프 턴 감소
            this._tickBuffs();

            // 라운드 시작 시 일기토 체크 (오토배틀만)
            if (this._mode === BATTLE_MODES.MELEE) {
                const duelEvent = this._checkDuelRequest();
                if (duelEvent) return duelEvent;
            }
        }

        const unit = this._turnQueue[this._turnIndex++];
        if (!unit || !unit.alive) return this.tick();

        const target = this._selectTarget(unit);
        if (!target) {
            const result = this._checkResult();
            if (result) return result;
            return null;
        }

        return this._processAttack(unit, target);
    }

    // ═══════════════════════════════════
    // 일기토 시스템
    // ═══════════════════════════════════

    _checkDuelRequest() {
        if (this._round <= 1) return null; // 첫 라운드는 스킵

        const aliveHeroes = this._heroUnits.filter(u => u.alive && !u.isSoldier);
        const aliveEnemies = this._enemyUnits.filter(u => u.alive);
        if (aliveHeroes.length === 0 || aliveEnemies.length === 0) return null;

        // 죄종별 일기토 성향
        const duelChances = {
            wrath: 0.5,    // 분노: 높음
            pride: 0.35,   // 교만: 강한 적에게
            envy: 0.25,    // 시기: 다른 영웅 활약 시
            greed: 0.2,    // 탐욕: 가끔
            gluttony: 0.15,// 폭식: 약한 적에게
            sloth: 0.05,   // 나태: 거의 안 함
            lust: 0.05     // 색욕: 거의 안 함
        };

        for (const hero of aliveHeroes) {
            const chance = duelChances[hero.sinType] ?? this.DUEL_REQUEST_CHANCE;
            if (Math.random() < chance) {
                // 타겟 선택
                let target;
                if (hero.sinType === 'pride') {
                    // 교만: 가장 강한 적
                    target = aliveEnemies.reduce((a, b) => a.hp > b.hp ? a : b);
                } else if (hero.sinType === 'gluttony') {
                    // 폭식: 가장 약한 적
                    target = aliveEnemies.reduce((a, b) => a.hp < b.hp ? a : b);
                } else {
                    target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                }

                // 적 수락 여부
                const accepted = Math.random() < this.DUEL_ACCEPT_CHANCE;

                if (accepted) {
                    this._duelActive = true;
                    this._duelHero = hero;
                    this._duelEnemy = target;
                    return {
                        type: 'duel_start',
                        hero: { name: hero.name, hp: hero.hp, maxHp: hero.maxHp, sinType: hero.sinType },
                        enemy: { name: target.name, hp: target.hp, maxHp: target.maxHp },
                        round: this._round
                    };
                } else {
                    return {
                        type: 'duel_refused',
                        hero: { name: hero.name, sinType: hero.sinType },
                        enemy: { name: target.name },
                        round: this._round
                    };
                }
            }
        }
        return null;
    }

    _tickDuel() {
        const hero = this._duelHero;
        const enemy = this._duelEnemy;

        if (!hero.alive || !enemy.alive) {
            return this._endDuel();
        }

        // 속도 비교 → 선제
        const heroSpd = hero.spd || hero.stats?.agility || 10;
        const enemySpd = enemy.spd || 5;

        let attacker, defender;
        if (heroSpd >= enemySpd) {
            attacker = hero;
            defender = enemy;
        } else {
            attacker = enemy;
            defender = hero;
        }

        const events = [];

        // 선제 공격
        const evt1 = this._processAttack(attacker, defender);
        if (evt1) {
            const evts1 = Array.isArray(evt1) ? evt1 : [evt1];
            events.push(...evts1);
        }

        // 후제 반격 (살아있으면)
        if (defender.alive) {
            const evt2 = this._processAttack(defender, attacker);
            if (evt2) {
                const evts2 = Array.isArray(evt2) ? evt2 : [evt2];
                events.push(...evts2);
            }
        }

        // 일기토 종료 체크
        if (!hero.alive || !enemy.alive) {
            events.push(this._endDuel());
        }

        return events.length > 0 ? events : null;
    }

    _endDuel() {
        const heroWon = this._duelHero.alive;
        const result = {
            type: 'duel_end',
            winner: heroWon ? this._duelHero.name : this._duelEnemy.name,
            heroWon,
            hero: { name: this._duelHero.name, hp: Math.max(0, this._duelHero.hp), maxHp: this._duelHero.maxHp },
            enemy: { name: this._duelEnemy.name, hp: Math.max(0, this._duelEnemy.hp), maxHp: this._duelEnemy.maxHp }
        };
        this._duelActive = false;
        this._duelHero = null;
        this._duelEnemy = null;

        // 오토배틀 결과 체크
        const battleResult = this._checkResult();
        if (battleResult) return [result, battleResult];

        return result;
    }

    // ═══════════════════════════════════
    // 태그매치 (TAG)
    // ═══════════════════════════════════

    _initTag() {
        // 태그매치: 병사가 먼저, 영웅 순서대로
        this._tagAllyQueue = [...this._soldierUnits, ...this._heroUnits];
        this._tagEnemyQueue = [...this._enemyUnits];
        this._tagAllyIndex = 0;
        this._tagEnemyIndex = 0;
        this._advanceTagFighters();
    }

    _advanceTagFighters() {
        // 살아있는 다음 아군 찾기
        while (this._tagAllyIndex < this._tagAllyQueue.length &&
               !this._tagAllyQueue[this._tagAllyIndex].alive) {
            this._tagAllyIndex++;
        }
        this._tagCurrentHero = this._tagAllyIndex < this._tagAllyQueue.length
            ? this._tagAllyQueue[this._tagAllyIndex] : null;

        // 살아있는 다음 적 찾기
        while (this._tagEnemyIndex < this._tagEnemyQueue.length &&
               !this._tagEnemyQueue[this._tagEnemyIndex].alive) {
            this._tagEnemyIndex++;
        }
        this._tagCurrentEnemy = this._tagEnemyIndex < this._tagEnemyQueue.length
            ? this._tagEnemyQueue[this._tagEnemyIndex] : null;
    }

    _tickTag() {
        if (this._finished) return null;

        if (!this._tagCurrentHero || !this._tagCurrentEnemy) {
            const result = this._checkResult();
            if (result) return result;
            this._advanceTagFighters();
            if (!this._tagCurrentHero || !this._tagCurrentEnemy) {
                return this._checkResult();
            }
        }

        this._round++;

        const hero = this._tagCurrentHero;
        const enemy = this._tagCurrentEnemy;

        // 속도 비교
        const heroSpd = hero.spd || hero.stats?.agility || 10;
        const enemySpd = enemy.spd || 5;

        let first, second;
        if (heroSpd >= enemySpd) {
            first = hero;
            second = enemy;
        } else {
            first = enemy;
            second = hero;
        }

        const events = [];

        // 선제 공격
        const evt1 = this._processAttack(first, second);
        if (evt1) {
            const evts1 = Array.isArray(evt1) ? evt1 : [evt1];
            events.push(...evts1);
        }

        // 후제 반격
        if (second.alive) {
            const evt2 = this._processAttack(second, first);
            if (evt2) {
                const evts2 = Array.isArray(evt2) ? evt2 : [evt2];
                events.push(...evts2);
            }
        }

        // 교대 체크
        if (!hero.alive || !enemy.alive) {
            if (!hero.alive) {
                events.push({ type: 'tag_next', side: 'ally', fallen: hero.name });
                this._tagAllyIndex++;
            }
            if (!enemy.alive) {
                events.push({ type: 'tag_next', side: 'enemy', fallen: enemy.name });
                this._tagEnemyIndex++;
            }
            this._advanceTagFighters();

            if (!this._tagCurrentHero || !this._tagCurrentEnemy) {
                const result = this._checkResult();
                if (result) events.push(result);
            } else {
                events.push({
                    type: 'tag_enter',
                    ally: this._tagCurrentHero ? {
                        name: this._tagCurrentHero.name,
                        hp: this._tagCurrentHero.hp,
                        maxHp: this._tagCurrentHero.maxHp,
                        isSoldier: this._tagCurrentHero.isSoldier
                    } : null,
                    enemy: this._tagCurrentEnemy ? {
                        name: this._tagCurrentEnemy.name,
                        hp: this._tagCurrentEnemy.hp,
                        maxHp: this._tagCurrentEnemy.maxHp
                    } : null
                });
            }
        }

        // 타임아웃
        if (this._round >= this.MAX_ROUNDS && !this._finished) {
            this._finished = true;
            this._victory = false;
            events.push({ type: 'result', winner: 'timeout', rounds: this._round });
        }

        return events.length > 0 ? events : null;
    }

    // ═══════════════════════════════════
    // 공통 로직
    // ═══════════════════════════════════

    _processAttack(attacker, defender) {
        const variance = this.DMG_VAR_MIN + Math.random() * (this.DMG_VAR_MAX - this.DMG_VAR_MIN);

        // 버프 적용: ATK 배율
        let atkMult = 1;
        for (const buff of this._activeBuffs) {
            if (buff.effect_type === 'atk_mult' && buff.target === 'ally_all' && attacker.isHero) {
                atkMult *= buff.value;
            }
            if (buff.effect_type === 'atk_mult' && buff.target === 'enemy_all' && !attacker.isHero) {
                atkMult *= buff.value;
            }
        }

        // 버프 적용: 피해 경감
        let dmgReduce = 0;
        for (const buff of this._activeBuffs) {
            if (buff.effect_type === 'dmg_reduce' && buff.target === 'ally_all' && defender.isHero) {
                dmgReduce = Math.max(dmgReduce, buff.value);
            }
        }

        let rawDmg = Math.floor(attacker.atk * atkMult * variance);
        const dmg = Math.max(1, Math.floor(rawDmg * (1 - dmgReduce)));
        defender.hp -= dmg;

        const events = [];

        events.push({
            type: 'attack',
            round: this._round,
            attacker: attacker.name,
            attackerIsSoldier: attacker.isSoldier,
            attackerIsHero: attacker.isHero,
            defender: defender.name,
            defenderIsSoldier: defender.isSoldier,
            defenderIsHero: defender.isHero,
            damage: dmg,
            remainHp: Math.max(0, defender.hp),
            maxHp: defender.maxHp
        });

        if (defender.hp <= 0) {
            defender.alive = false;
            defender.hp = 0;

            if (defender.isHero && !defender.isSoldier) {
                defender.status = 'knocked_out';
            }

            events.push({
                type: 'defeat',
                round: this._round,
                name: defender.name,
                isHero: defender.isHero,
                isSoldier: defender.isSoldier
            });

            // SP 획득 (적 처치 시)
            if (!defender.isHero) {
                this._sp = Math.min(this._spMax, this._sp + this._spPerKill);
                events.push({ type: 'sp_gain', sp: this._sp, gained: this._spPerKill, reason: 'kill' });
            }

            const result = this._checkResult();
            if (result) events.push(result);
        }

        return events;
    }

    _selectTarget(unit) {
        if (unit.isHero) {
            const targets = this._enemyUnits.filter(u => u.alive);
            if (targets.length === 0) return null;
            return targets[Math.floor(Math.random() * targets.length)];
        }
        // 적 → 병사 우선
        if (this._hasSoldiers) {
            const soldiers = this._soldierUnits.filter(u => u.alive);
            if (soldiers.length > 0) {
                return soldiers[Math.floor(Math.random() * soldiers.length)];
            }
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
                // 병사 전멸 → 영웅도 체크
                const heroesAlive = this._heroUnits.filter(u => u.alive);
                if (heroesAlive.length === 0) {
                    this._finished = true;
                    this._victory = false;
                    return { type: 'result', winner: 'enemies', rounds: this._round };
                }
                // 병사 전멸 but 영웅 생존 → 영웅이 직접 싸움 (hasSoldiers 해제)
                this._hasSoldiers = false;
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
        return this.HP_BASE + (hero.stats?.vitality || 10) * this.HP_VIT + (hero.stats?.strength || 10) * this.HP_STR;
    }

    _calcATK(hero, type) {
        if (type === BATTLE_TYPES.DEFENSE) {
            return Math.floor((hero.stats?.strength || 10) * this.ATK_DEF_STR + (hero.stats?.leadership || 10) * this.ATK_DEF_LEAD);
        }
        return Math.floor((hero.stats?.strength || 10) * this.ATK_EXP_STR + (hero.stats?.agility || 10) * this.ATK_EXP_AGI);
    }

    // ═══════════════════════════════════
    // 외부 API
    // ═══════════════════════════════════

    isFinished() { return this._finished; }
    isDuelActive() { return this._duelActive; }
    getMode() { return this._mode; }
    getSP() { return this._sp; }
    getSPMax() { return this._spMax; }
    getActiveBuffs() { return [...this._activeBuffs]; }

    /** 카드 사용 — 씬에서 호출 */
    useCard(card, partySinTypes = []) {
        if (this._sp < card.sp_cost) return null;
        this._sp -= card.sp_cost;

        const events = [];

        // 죄종 시너지 체크
        const hasSinBonus = partySinTypes.includes(card.sin_bonus_type);

        switch (card.effect_type) {
            case 'atk_mult': {
                const value = hasSinBonus ? card.sin_bonus_value : card.effect_value;
                const duration = (card.target === 'ally_all' && hasSinBonus && card.sin_bonus_type === 'sloth')
                    ? 5 : card.duration;
                this._activeBuffs.push({
                    id: card.id, target: card.target, effect_type: card.effect_type,
                    value, turnsLeft: duration
                });
                events.push({
                    type: 'card_used', card: card.id, name: card.name_ko,
                    sp: this._sp, sinBonus: hasSinBonus
                });
                break;
            }
            case 'dmg_reduce': {
                const value = card.effect_value;
                const duration = (hasSinBonus && card.sin_bonus_type === 'sloth') ? 5 : card.duration;
                this._activeBuffs.push({
                    id: card.id, target: card.target, effect_type: card.effect_type,
                    value, turnsLeft: duration
                });
                events.push({
                    type: 'card_used', card: card.id, name: card.name_ko,
                    sp: this._sp, sinBonus: hasSinBonus
                });
                break;
            }
            case 'heal_percent': {
                const percent = hasSinBonus ? card.sin_bonus_value : card.effect_value;
                const healed = [];
                for (const hero of this._heroUnits) {
                    if (!hero.alive) continue;
                    const amount = Math.floor(hero.maxHp * percent);
                    hero.hp = Math.min(hero.maxHp, hero.hp + amount);
                    healed.push({ name: hero.name, hp: hero.hp, maxHp: hero.maxHp, amount });
                }
                events.push({
                    type: 'card_used', card: card.id, name: card.name_ko,
                    sp: this._sp, sinBonus: hasSinBonus, healed
                });
                break;
            }
            case 'spd_mult': {
                const value = hasSinBonus ? card.sin_bonus_value : card.effect_value;
                this._activeBuffs.push({
                    id: card.id, target: card.target, effect_type: card.effect_type,
                    value, turnsLeft: card.duration
                });
                // 교만 보너스: 첫타 2배 (간단히 ATK 버프 1턴 추가)
                if (hasSinBonus && card.sin_bonus_type === 'pride') {
                    this._activeBuffs.push({
                        id: card.id + '_pride', target: 'ally_all', effect_type: 'atk_mult',
                        value: 2.0, turnsLeft: 1
                    });
                }
                events.push({
                    type: 'card_used', card: card.id, name: card.name_ko,
                    sp: this._sp, sinBonus: hasSinBonus
                });
                break;
            }
            default:
                events.push({
                    type: 'card_used', card: card.id, name: card.name_ko,
                    sp: this._sp, sinBonus: hasSinBonus
                });
        }

        return events;
    }

    /** 버프 턴 감소 */
    _tickBuffs() {
        for (let i = this._activeBuffs.length - 1; i >= 0; i--) {
            if (this._activeBuffs[i].turnsLeft > 0) {
                this._activeBuffs[i].turnsLeft--;
                if (this._activeBuffs[i].turnsLeft <= 0) {
                    this._activeBuffs.splice(i, 1);
                }
            }
        }
    }

    getResult() {
        const soldiersAlive = this._soldierUnits.filter(u => u.alive).length;
        const soldiersDead = this._soldierUnits.length - soldiersAlive;
        return {
            victory: this._victory,
            heroResults: this._heroUnits.map(u => ({
                id: u.id, name: u.name, alive: u.alive,
                hpPercent: Math.max(0, Math.floor((u.hp / u.maxHp) * 100)),
                status: u.alive ? 'ok' : 'knocked_out'
            })),
            soldiersDeployed: this._soldierUnits.length,
            soldiersSurvived: soldiersAlive,
            soldiersLost: soldiersDead,
            rounds: this._round
        };
    }

    getUnits() {
        return {
            heroes: this._heroUnits.map(u => ({
                name: u.name, hp: u.hp, maxHp: u.maxHp, alive: u.alive,
                isHero: true, sinType: u.sinType
            })),
            soldiers: { total: this._soldierUnits.length, alive: this._soldierUnits.filter(u => u.alive).length },
            enemies: this._enemyUnits.map(u => ({
                name: u.name, hp: u.hp, maxHp: u.maxHp, alive: u.alive, isHero: false
            }))
        };
    }

    /** 태그매치: 현재 교전 중인 유닛 */
    getTagFighters() {
        return {
            ally: this._tagCurrentHero,
            enemy: this._tagCurrentEnemy
        };
    }

    /** 전투 일괄 실행 (리플레이용) */
    simulate(heroes, enemies, type = BATTLE_TYPES.EXPEDITION, soldierCount = 0, mode = BATTLE_MODES.MELEE) {
        const startEvent = this.init(heroes, enemies, type, soldierCount, mode);
        const log = [];
        log.push({
            type: 'start',
            mode,
            heroes: startEvent.heroes.map(u => u.name),
            soldiers: startEvent.soldiers,
            enemies: startEvent.enemies.map(u => u.name)
        });

        while (!this._finished) {
            const events = this.tick();
            if (!events) break;
            const eventArray = Array.isArray(events) ? events : [events];
            for (const evt of eventArray) log.push(evt);
        }

        const result = this.getResult();
        return {
            victory: result.victory, log, heroResults: result.heroResults,
            soldiersDeployed: result.soldiersDeployed,
            soldiersSurvived: result.soldiersSurvived,
            soldiersLost: result.soldiersLost,
            rounds: result.rounds
        };
    }
}

export default BattleEngine;
export { BATTLE_TYPES, BATTLE_MODES };
