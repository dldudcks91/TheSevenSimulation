/**
 * 영웅 관리 — 랜덤 생성, 사기 관리, 폭주/이탈 체크
 */

const MORALE_MIN = 0;
const MORALE_MAX = 100;
const MORALE_DEFAULT = 50;
const STAT_MIN = 1;
const STAT_MAX = 20;
const MAX_HEROES = 7;
const STARTING_HEROES = 3;

const STAT_KEYS = ['strength', 'agility', 'intellect', 'vitality', 'perception', 'leadership', 'charisma'];

const MORALE_STATE = {
    DESERTION: 'desertion',   // 0
    UNHAPPY: 'unhappy',       // 1~30
    STABLE: 'stable',         // 31~70
    ELEVATED: 'elevated',     // 71~99
    RAMPAGE: 'rampage'         // 100
};

class HeroManager {
    constructor(store, heroData) {
        this.store = store;
        this.heroData = heroData;
        this._nextId = 1;
    }

    /** 게임 시작 시 초기 영웅 생성 */
    initStartingHeroes() {
        const heroes = [];
        const usedSins = [];

        for (let i = 0; i < STARTING_HEROES; i++) {
            const hero = this._generateHero(usedSins);
            usedSins.push(hero.sinType);
            heroes.push(hero);
        }

        this.store.setState('heroes', heroes);
        return heroes;
    }

    /** 미리보기용 초기 영웅 생성 (Store에 저장하지 않음) */
    previewStartingHeroes() {
        const heroes = [];
        const usedSins = [];

        for (let i = 0; i < STARTING_HEROES; i++) {
            const hero = this._generateHero(usedSins);
            usedSins.push(hero.sinType);
            heroes.push(hero);
        }

        return heroes;
    }

    /** 미리보기 영웅을 확정하여 Store에 저장 */
    confirmHeroes(heroes) {
        this.store.setState('heroes', heroes);
    }

    /** 영웅 1명 랜덤 생성 */
    _generateHero(excludeSins = []) {
        const name = this._randomName();
        const sinType = this._randomSin(excludeSins);
        const stats = this._rollStats();

        return {
            id: this._nextId++,
            name,
            sinType: sinType.id,
            sinName: sinType.name_ko,
            sinFlaw: sinType.flaw,
            morale: MORALE_DEFAULT,
            stats,
            status: 'idle',
            location: 'base',
            equipment: { weapon: null, armor: null, accessory: null },
            daysIdle: 0,
            expeditionFailStreak: 0
        };
    }

    /** 이름 랜덤 생성 */
    _randomName() {
        const { first, last } = this.heroData.name_pool;
        const f = first[Math.floor(Math.random() * first.length)];
        const l = last[Math.floor(Math.random() * last.length)];
        return `${f} "${l}"`;
    }

    /** 죄종 랜덤 선택 (중복 제외) */
    _randomSin(excludeSins = []) {
        const sins = this.heroData.sin_types;
        const available = sins.filter(s => !excludeSins.includes(s.id));
        if (available.length === 0) {
            return sins[Math.floor(Math.random() * sins.length)];
        }
        return available[Math.floor(Math.random() * available.length)];
    }

    /** 7스탯 랜덤 굴림 */
    _rollStats() {
        const stats = {};
        for (const key of STAT_KEYS) {
            stats[key] = this._rollStat();
        }
        return stats;
    }

    /** 단일 스탯 굴림 (1~20, 정규분포 느낌) */
    _rollStat() {
        // 3d8 → 3~24 → 클램프 1~20 (중앙값 ~13)
        const roll = Math.floor(Math.random() * 8) + Math.floor(Math.random() * 8) + Math.floor(Math.random() * 8) + 3;
        return Math.max(STAT_MIN, Math.min(STAT_MAX, roll));
    }

    /** 사기 변동 */
    updateMorale(heroId, delta) {
        const heroes = this.store.getState('heroes');
        const hero = heroes.find(h => h.id === heroId);
        if (!hero) return null;

        const oldMorale = hero.morale;
        hero.morale = Math.max(MORALE_MIN, Math.min(MORALE_MAX, hero.morale + delta));

        this.store.setState('heroes', [...heroes]);

        return {
            heroId,
            oldMorale,
            newMorale: hero.morale,
            state: this.getMoraleState(hero.morale)
        };
    }

    /** 사기 상태 판정 */
    getMoraleState(morale) {
        if (morale <= 0) return MORALE_STATE.DESERTION;
        if (morale <= 30) return MORALE_STATE.UNHAPPY;
        if (morale <= 70) return MORALE_STATE.STABLE;
        if (morale <= 99) return MORALE_STATE.ELEVATED;
        return MORALE_STATE.RAMPAGE;
    }

    /** 사기 상태 한글명 */
    getMoraleStateName(morale) {
        const state = this.getMoraleState(morale);
        const names = {
            [MORALE_STATE.DESERTION]: '이탈',
            [MORALE_STATE.UNHAPPY]: '불만',
            [MORALE_STATE.STABLE]: '안정',
            [MORALE_STATE.ELEVATED]: '고양',
            [MORALE_STATE.RAMPAGE]: '폭주'
        };
        return names[state];
    }

    /** 영웅 목록 조회 */
    getHeroes() {
        return this.store.getState('heroes') || [];
    }

    /** 특정 영웅 조회 */
    getHero(heroId) {
        const heroes = this.getHeroes();
        return heroes.find(h => h.id === heroId) || null;
    }

    /** 거점에 있는 영웅 목록 */
    getBaseHeroes() {
        return this.getHeroes().filter(h => h.location === 'base');
    }

    /** 고용 후보 생성 (주점용) */
    generateRecruits(count = 3) {
        const heroes = this.getHeroes();
        const usedSins = heroes.map(h => h.sinType);
        const recruits = [];
        for (let i = 0; i < count; i++) {
            recruits.push(this._generateHero(usedSins));
        }
        return recruits;
    }

    /** 영웅 고용 */
    recruitHero(hero) {
        const heroes = this.getHeroes();
        if (heroes.length >= MAX_HEROES) return false;
        heroes.push(hero);
        this.store.setState('heroes', [...heroes]);
        return true;
    }

    /** 영웅 해고 */
    dismissHero(heroId) {
        const heroes = this.getHeroes();
        const filtered = heroes.filter(h => h.id !== heroId);
        this.store.setState('heroes', filtered);
        return heroes.length !== filtered.length;
    }
}

export default HeroManager;
export { MORALE_MIN, MORALE_MAX, MORALE_DEFAULT, STAT_KEYS, MORALE_STATE, MAX_HEROES };
