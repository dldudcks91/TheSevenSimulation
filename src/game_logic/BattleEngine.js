/**
 * 전투 엔진 — 7스탯 기반 자동 계산
 * 원정 전투: 힘+민첩 (공격), 체력 (생존), 지능 (AI)
 * 방어 전투: 힘+통솔 (공격), 체력 (생존)
 */

const BATTLE_TYPES = { EXPEDITION: 'expedition', DEFENSE: 'defense' };

class BattleEngine {
    constructor() {}

    /** 전투 실행 — 영웅 vs 적 파티 */
    simulate(heroes, enemies, type = BATTLE_TYPES.EXPEDITION) {
        const log = [];
        let round = 0;
        const maxRounds = 20;

        // HP 초기화
        const heroUnits = heroes.map(h => ({
            ...h,
            hp: this._calcHP(h),
            maxHp: this._calcHP(h),
            atk: this._calcATK(h, type),
            isHero: true,
            alive: true
        }));

        const enemyUnits = enemies.map(e => ({
            ...e,
            hp: e.hp,
            maxHp: e.hp,
            atk: e.atk,
            isHero: false,
            alive: true
        }));

        log.push({ type: 'start', heroes: heroUnits.map(u => u.name), enemies: enemyUnits.map(u => u.name) });

        while (round < maxRounds) {
            round++;

            // 행동 순서: 민첩 기준 정렬
            const allUnits = [...heroUnits.filter(u => u.alive), ...enemyUnits.filter(u => u.alive)];
            allUnits.sort((a, b) => (b.stats?.agility || b.spd || 5) - (a.stats?.agility || a.spd || 5));

            for (const unit of allUnits) {
                if (!unit.alive) continue;

                // 타겟 선택
                const targets = unit.isHero
                    ? enemyUnits.filter(u => u.alive)
                    : heroUnits.filter(u => u.alive);

                if (targets.length === 0) break;

                const target = targets[Math.floor(Math.random() * targets.length)];

                // 데미지 계산 (±20% 랜덤)
                const variance = 0.8 + Math.random() * 0.4;
                const dmg = Math.max(1, Math.floor(unit.atk * variance));

                target.hp -= dmg;
                log.push({
                    type: 'attack',
                    round,
                    attacker: unit.name,
                    defender: target.name,
                    damage: dmg,
                    remainHp: Math.max(0, target.hp)
                });

                if (target.hp <= 0) {
                    target.alive = false;
                    target.hp = 0;
                    log.push({ type: 'defeat', round, name: target.name, isHero: target.isHero });

                    // 영웅 사망 판정: 기절 → 중상 → 사망
                    if (target.isHero) {
                        target.status = 'knocked_out'; // 기본 기절
                    }
                }
            }

            // 승패 판정
            const heroesAlive = heroUnits.filter(u => u.alive);
            const enemiesAlive = enemyUnits.filter(u => u.alive);

            if (enemiesAlive.length === 0) {
                log.push({ type: 'result', winner: 'heroes', rounds: round });
                return { victory: true, log, heroResults: this._calcHeroResults(heroUnits), rounds: round };
            }
            if (heroesAlive.length === 0) {
                log.push({ type: 'result', winner: 'enemies', rounds: round });
                return { victory: false, log, heroResults: this._calcHeroResults(heroUnits), rounds: round };
            }
        }

        // 제한 라운드 초과: 패배
        log.push({ type: 'result', winner: 'timeout', rounds: round });
        return { victory: false, log, heroResults: this._calcHeroResults(heroUnits), rounds: round };
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
export { BATTLE_TYPES };
