/**
 * 임계(20 도달) 결정적 순간 이벤트 시스템 — 2026-04-21
 *
 * 영웅의 죄종 수치가 20에 도달하면 즉시 이벤트 발동.
 * 플레이어가 3개 선택지 중 선택: 이탈 수용 / 구원 시도 / 극단 조치
 *   - 이탈 수용/극단 조치: 확정 결과
 *   - 구원 시도: roll (기본 20%, bonds/특성으로 5~65% 보정)
 *     → 성공: 구원 특성 획득 + 해당 죄종 0
 *     → 실패: 극단 분기로 귀결
 *
 * 기존 "20 + 3턴 = 자동 이탈" 로직을 대체한다.
 */

import { SIN_NAMES_KO } from './SinUtils.js';

/** 죄종별 구원 특성 */
const SALVATION_TRAITS = {
    wrath: { id: 'salv_composure', name: '평정', sin: 'wrath' },
    pride: { id: 'salv_sage', name: '현자', sin: 'pride' },
    greed: { id: 'salv_ascetic', name: '청빈', sin: 'greed' },
    envy: { id: 'salv_magnanimous', name: '대범', sin: 'envy' },
    lust: { id: 'salv_chaste', name: '순결', sin: 'lust' },
    gluttony: { id: 'salv_faster', name: '단식자', sin: 'gluttony' },
    sloth: { id: 'salv_meditator', name: '명상가', sin: 'sloth' }
};

/** 죄종별 임계 이벤트 정의 */
const CRITICAL_EVENTS = {
    wrath: {
        title: '피의 맹세',
        narrative: '{name}이(가) 더 이상 참을 수 없다며 검을 뽑아 들었다. 눈에서 이성이 사라졌다.',
        choices: [
            { key: 'accept', text: '가게 둬라. 손댈 수 없다.', outcome: 'desertion' },
            { key: 'salvation', text: '막아서라 — 설득할 수 있다.', outcome: 'salvation_roll' },
            { key: 'extreme', text: '제압하라. 피를 보더라도.', outcome: 'extreme' }
        ]
    },
    pride: {
        title: '반역의 선언',
        narrative: '{name}이(가) 모두 앞에서 바알의 권위에 정면 도전했다.',
        choices: [
            { key: 'accept', text: '쫓아내라. 내 권위는 흔들리지 않는다.', outcome: 'desertion' },
            { key: 'salvation', text: '단둘이 이야기하자.', outcome: 'salvation_roll' },
            { key: 'extreme', text: '결투로 결판내자.', outcome: 'extreme' }
        ]
    },
    greed: {
        title: '최후의 강탈',
        narrative: '{name}이(가) 밤중에 창고를 털려다 발각됐다.',
        choices: [
            { key: 'accept', text: '놔줘라. 어차피 믿을 수 없었다.', outcome: 'desertion' },
            { key: 'salvation', text: '왜 이런 짓을 했는지 듣고 싶다.', outcome: 'salvation_roll' },
            { key: 'extreme', text: '자원을 돌려받는 조건으로 거래하라.', outcome: 'extreme' }
        ]
    },
    envy: {
        title: '어둠의 계약',
        narrative: '{name}이(가) 경쟁자를 독살하려 한다는 정황이 포착됐다.',
        choices: [
            { key: 'accept', text: '막지 마라. 일이 터진 다음에 처리하면 된다.', outcome: 'desertion' },
            { key: 'salvation', text: '경쟁 구도를 끊어라.', outcome: 'salvation_roll' },
            { key: 'extreme', text: '범행 전에 격리하라.', outcome: 'extreme' }
        ]
    },
    lust: {
        title: '금단의 서약',
        narrative: '{name}이(가) 집착 대상에게 "함께 떠나자"고 속삭였다는 보고가 들어왔다.',
        choices: [
            { key: 'accept', text: '막을 방법이 없다. 보내줘라.', outcome: 'desertion' },
            { key: 'salvation', text: '집착 대상과 먼저 이야기를 나누게 하라.', outcome: 'salvation_roll' },
            { key: 'extreme', text: '집착 대상을 당장 분리하라.', outcome: 'extreme' }
        ]
    },
    gluttony: {
        title: '끝없는 갈증',
        narrative: '{name}이(가) 새벽 홀로 식량 창고를 비워가고 있었다.',
        choices: [
            { key: 'accept', text: '잡을 수가 없다. 이미 늦었다.', outcome: 'desertion' },
            { key: 'salvation', text: '왜 이렇게 됐는지 듣고 싶다.', outcome: 'salvation_roll' },
            { key: 'extreme', text: '식량을 못 가져가도록 막아라.', outcome: 'extreme' }
        ]
    },
    sloth: {
        title: '심연의 잠',
        narrative: '며칠째 {name}이(가) 숙소에서 나오지 않는다.',
        choices: [
            { key: 'accept', text: '억지로 깨울 수 없다. 그냥 두자.', outcome: 'desertion' },
            { key: 'salvation', text: '누군가 들어가 손을 내밀어라.', outcome: 'salvation_roll' },
            { key: 'extreme', text: '강제로 끌어내 일을 시켜라.', outcome: 'extreme' }
        ]
    }
};

class CriticalEventSystem {
    constructor(store, heroManager, balance = {}) {
        this.store = store;
        this.heroManager = heroManager;
        this.balance = balance;
    }

    /**
     * 모든 영웅 중 어떤 죄종이든 20 도달한 영웅 탐지.
     * @returns {Array<{heroId, sinKey}>}
     */
    detectPending() {
        const heroes = this.store.getState('heroes') || [];
        const critical = this.balance.sin_critical_threshold ?? 20;
        const alreadyPending = this.store.getState('pendingCriticalEvents') || [];
        const pendingKeys = new Set(alreadyPending.map(e => `${e.heroId}:${e.sinKey}`));

        const found = [];
        for (const hero of heroes) {
            if (!hero.sinStats) continue;
            for (const [sinKey, val] of Object.entries(hero.sinStats)) {
                if (val >= critical && !pendingKeys.has(`${hero.id}:${sinKey}`)) {
                    found.push({ heroId: hero.id, sinKey });
                }
            }
        }
        return found;
    }

    /**
     * 이벤트 데이터 생성 (UI 노출용).
     * @returns {object|null}
     */
    buildEventData(heroId, sinKey) {
        const hero = this.heroManager.getHero(heroId);
        if (!hero) return null;
        const tmpl = CRITICAL_EVENTS[sinKey];
        if (!tmpl) return null;

        const heroes = this.store.getState('heroes') || [];
        const salvChance = this.calculateSalvationChance(hero, sinKey, heroes);

        return {
            heroId,
            heroName: hero.name,
            sinKey,
            sinName: SIN_NAMES_KO[sinKey] || sinKey,
            title: tmpl.title,
            narrative: tmpl.narrative.replace('{name}', hero.name),
            choices: tmpl.choices.map(c => ({
                ...c,
                chance: c.outcome === 'salvation_roll' ? salvChance : 1.0
            })),
            salvationChance: salvChance
        };
    }

    /**
     * 구원 성공 확률 (0~1).
     */
    calculateSalvationChance(hero, sinKey, heroes) {
        const b = this.balance;
        let chance = b.critical_event_base_chance ?? 0.20;

        const allIds = (heroes || []).map(h => h.id);
        const avgBonds = this.heroManager.getAverageBonds(hero, allIds);
        const highT = b.bonds_high_threshold ?? 70;
        const lowT = b.bonds_low_threshold ?? 30;
        if (avgBonds >= highT) chance += (b.critical_event_bonds_high_bonus ?? 0.20);
        else if (avgBonds <= lowT) chance -= (b.critical_event_bonds_low_penalty ?? 0.10);

        const trait = hero.trait;
        if (trait) {
            if (trait.category === 'resist' && (trait.resist_sin === sinKey || trait.resist_sin === 'all')) {
                chance += (b.critical_event_resist_trait_bonus ?? 0.20);
            } else if (trait.category === 'bias' && (trait.bias_sin === sinKey || trait.bias_sin === 'all')) {
                chance -= (b.critical_event_bias_trait_penalty ?? 0.10);
            }
        }

        const hasSalvation = (hero.acquiredTraits || []).some(t => t.id === SALVATION_TRAITS[sinKey]?.id);
        if (hasSalvation) chance += (b.critical_event_salvation_trait_bonus ?? 0.15);

        const minC = b.critical_event_min_chance ?? 0.05;
        const maxC = b.critical_event_max_chance ?? 0.65;
        return Math.max(minC, Math.min(maxC, chance));
    }

    /**
     * 플레이어 선택 해결.
     * @returns {object} {type: 'desertion'|'salvation'|'extreme', result}
     */
    resolve(heroId, sinKey, choiceKey) {
        const hero = this.heroManager.getHero(heroId);
        if (!hero) return { type: 'error', message: 'hero_not_found' };
        const tmpl = CRITICAL_EVENTS[sinKey];
        if (!tmpl) return { type: 'error', message: 'no_template' };
        const choice = tmpl.choices.find(c => c.key === choiceKey);
        if (!choice) return { type: 'error', message: 'invalid_choice' };

        if (choice.outcome === 'desertion') {
            return this._applyDesertion(hero, sinKey);
        }
        if (choice.outcome === 'extreme') {
            return this._applyExtreme(hero, sinKey);
        }
        if (choice.outcome === 'salvation_roll') {
            const heroes = this.store.getState('heroes') || [];
            const chance = this.calculateSalvationChance(hero, sinKey, heroes);
            const roll = Math.random();
            if (roll < chance) {
                return this._applySalvation(hero, sinKey, chance);
            } else {
                return this._applyExtreme(hero, sinKey, { fromFailedSalvation: true, rolled: roll, needed: chance });
            }
        }
        return { type: 'error', message: 'unknown_outcome' };
    }

    _applyDesertion(hero, sinKey) {
        const heroes = this.store.getState('heroes') || [];
        const result = {
            type: 'desertion',
            heroId: hero.id,
            heroName: hero.name,
            sinKey,
            sinName: SIN_NAMES_KO[sinKey]
        };
        // 죄종별 이탈 결과 (요약 버전)
        switch (sinKey) {
            case 'wrath': {
                const others = heroes.filter(h => h.id !== hero.id);
                if (others.length > 0) {
                    const target = others[Math.floor(Math.random() * others.length)];
                    target.hp = Math.max(1, Math.floor((target.hp || 50) * 0.5));
                    result.sideEffect = `${target.name} HP -50%`;
                }
                break;
            }
            case 'pride': {
                const gold = this.store.getState('gold') || 0;
                const lost = Math.floor(gold * 0.3);
                this.store.setState('gold', gold - lost);
                result.sideEffect = `명성·자원 하락 (골드 -${lost})`;
                break;
            }
            case 'greed': {
                const gold = this.store.getState('gold') || 0;
                const food = this.store.getState('food') || 0;
                const gLost = Math.floor(gold * 0.5);
                const fLost = Math.floor(food * 0.3);
                this.store.setState('gold', gold - gLost);
                this.store.setState('food', food - fLost);
                result.sideEffect = `골드 -${gLost}, 식량 -${fLost}`;
                break;
            }
            case 'envy': {
                const stats = hero.stats || {};
                const strongest = heroes
                    .filter(h => h.id !== hero.id)
                    .sort((a, b) => Object.values(b.stats || {}).reduce((s, v) => s + v, 0) - Object.values(a.stats || {}).reduce((s, v) => s + v, 0))[0];
                if (strongest) {
                    strongest.hp = Math.max(1, Math.floor((strongest.hp || 50) * 0.2));
                    result.sideEffect = `${strongest.name} HP -80%`;
                }
                break;
            }
            case 'lust': {
                // 집착 대상도 함께 이탈
                const targetId = hero._lustObsessionTarget;
                const target = heroes.find(h => h.id === targetId);
                if (target) {
                    const idx = heroes.indexOf(target);
                    if (idx !== -1) heroes.splice(idx, 1);
                    result.sideEffect = `${target.name}도 함께 이탈`;
                }
                break;
            }
            case 'gluttony': {
                const food = this.store.getState('food') || 0;
                const lost = Math.floor(food * 0.7);
                this.store.setState('food', food - lost);
                result.sideEffect = `식량 -${lost}`;
                break;
            }
            case 'sloth': {
                result.sideEffect = '조용히 잠적';
                break;
            }
        }
        // 영웅 제거
        const idx = heroes.indexOf(hero);
        if (idx !== -1) heroes.splice(idx, 1);
        this.store.setState('heroes', [...heroes]);
        return result;
    }

    _applySalvation(hero, sinKey, chance) {
        const trait = SALVATION_TRAITS[sinKey];
        if (trait) {
            if (!hero.acquiredTraits) hero.acquiredTraits = [];
            const has = hero.acquiredTraits.some(t => t.id === trait.id);
            if (!has) {
                hero.acquiredTraits.push({ id: trait.id, name: trait.name, salvation_sin: sinKey });
            }
        }
        hero.sinStats[sinKey] = 0;
        hero.isRampaging = false;
        const heroes = this.store.getState('heroes') || [];
        this.store.setState('heroes', [...heroes]);
        return {
            type: 'salvation',
            heroId: hero.id,
            heroName: hero.name,
            sinKey,
            sinName: SIN_NAMES_KO[sinKey],
            traitAcquired: trait?.name,
            chance
        };
    }

    _applyExtreme(hero, sinKey, meta = {}) {
        const heroes = this.store.getState('heroes') || [];
        const result = {
            type: 'extreme',
            heroId: hero.id,
            heroName: hero.name,
            sinKey,
            sinName: SIN_NAMES_KO[sinKey],
            ...meta
        };
        switch (sinKey) {
            case 'wrath': {
                const others = heroes.filter(h => h.id !== hero.id);
                if (others.length > 0) {
                    const target = others[Math.floor(Math.random() * others.length)];
                    target.hp = Math.max(1, Math.floor((target.hp || 50) * 0.7));
                    result.sideEffect = `${target.name} HP -30% (광란)`;
                }
                hero.sinStats[sinKey] = 15;
                break;
            }
            case 'pride': {
                result.sideEffect = '바알과 결투 (미구현 placeholder — 50% 승/패)';
                if (Math.random() < 0.5) {
                    hero.sinStats[sinKey] = 0;
                } else {
                    const idx = heroes.indexOf(hero);
                    if (idx !== -1) heroes.splice(idx, 1);
                    result.desertion = true;
                }
                break;
            }
            case 'greed': {
                hero.sinStats[sinKey] = 15;
                hero._darkDealTurns = 3;
                result.sideEffect = '밀실 거래 상태 (3턴, 매 턴 골드 -3)';
                break;
            }
            case 'envy': {
                const others = heroes.filter(h => h.id !== hero.id);
                const strongest = others
                    .sort((a, b) => Object.values(b.stats || {}).reduce((s, v) => s + v, 0) - Object.values(a.stats || {}).reduce((s, v) => s + v, 0))[0];
                if (strongest) {
                    strongest.hp = Math.max(1, Math.floor((strongest.hp || 50) * 0.7));
                    result.sideEffect = `${strongest.name} HP -30% (독살 미수)`;
                }
                hero.sinStats[sinKey] = 15;
                break;
            }
            case 'lust': {
                const targetId = hero._lustObsessionTarget;
                const target = heroes.find(h => h.id === targetId);
                if (target) {
                    target._actionLocked = 1;
                    result.sideEffect = `${target.name} 1턴 행동 불가`;
                }
                hero.sinStats[sinKey] = 15;
                break;
            }
            case 'gluttony': {
                const others = heroes.filter(h => h.id !== hero.id);
                if (others.length > 0) {
                    const target = others[Math.floor(Math.random() * others.length)];
                    target.hp = Math.max(1, Math.floor((target.hp || 50) * 0.3));
                    result.sideEffect = `${target.name} HP -70% (카니발)`;
                }
                hero.sinStats[sinKey] = 15;
                break;
            }
            case 'sloth': {
                for (const h of heroes) {
                    if (h.sinStats) h.sinStats.sloth = Math.min(20, (h.sinStats.sloth || 0) + 2);
                }
                hero.sinStats[sinKey] = 15;
                result.sideEffect = '거점 전 영웅 나태 +2';
                break;
            }
        }
        hero.isRampaging = false;
        this.store.setState('heroes', [...heroes]);
        return result;
    }

    /** Store에 pending 이벤트 큐 등록 */
    enqueuePending(list) {
        const cur = this.store.getState('pendingCriticalEvents') || [];
        const merged = [...cur];
        for (const item of list) {
            if (!merged.some(e => e.heroId === item.heroId && e.sinKey === item.sinKey)) {
                merged.push(item);
            }
        }
        this.store.setState('pendingCriticalEvents', merged);
    }

    /** pending 큐에서 다음 이벤트 하나 꺼내기 */
    peekNext() {
        const q = this.store.getState('pendingCriticalEvents') || [];
        return q.length > 0 ? q[0] : null;
    }

    /** 해결된 이벤트 큐에서 제거 */
    dequeue(heroId, sinKey) {
        const q = this.store.getState('pendingCriticalEvents') || [];
        this.store.setState('pendingCriticalEvents', q.filter(e => !(e.heroId === heroId && e.sinKey === sinKey)));
    }
}

export default CriticalEventSystem;
