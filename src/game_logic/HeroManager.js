/**
 * 영웅 관리 — 랜덤 생성, 사기 관리, 폭주/이탈 체크
 * 모든 상수는 balance 데이터에서 주입
 */

const STAT_KEYS = ['strength', 'agility', 'intellect', 'vitality', 'perception', 'leadership', 'charisma'];
const SUB_STAT_KEYS = ['aggression', 'greediness', 'pride', 'curiosity', 'tenacity', 'sensitivity', 'independence'];

const MORALE_STATE = {
    DESERTION: 'desertion',
    UNHAPPY: 'unhappy',
    STABLE: 'stable',
    ELEVATED: 'elevated',
    RAMPAGE: 'rampage'
};

class HeroManager {
    constructor(store, heroData, balance = {}) {
        this.store = store;
        this.heroData = heroData;
        this.balance = balance;
        this._nextId = 1;
        this._spriteComposer = null;
        this._epithets = [];

        // balance에서 상수 로드 (기본값 폴백)
        this.MORALE_MIN = balance.morale_min ?? 0;
        this.MORALE_MAX = balance.morale_max ?? 100;
        this.MORALE_DEFAULT = balance.morale_default ?? 50;
        this.STAT_MIN = balance.stat_min ?? 1;
        this.STAT_MAX = balance.stat_max ?? 20;
        this.MAX_HEROES = balance.max_heroes ?? 7;
        this.STARTING_HEROES = balance.starting_heroes ?? 3;
        this.STAT_ROLL_DICE = balance.stat_roll_dice ?? 3;
        this.STAT_ROLL_SIDES = balance.stat_roll_sides ?? 8;
        this.STAT_ROLL_BONUS = balance.stat_roll_bonus ?? 3;
    }

    /** SpriteComposer 주입 (런타임 외형 생성용) */
    setSpriteComposer(composer) {
        this._spriteComposer = composer;
    }

    /** 수식어 데이터 주입 */
    setEpithets(epithets) {
        this._epithets = epithets || [];
    }

    /** 게임 시작 시 초기 영웅 생성 */
    initStartingHeroes() {
        const heroes = [];
        const usedSins = [];

        for (let i = 0; i < this.STARTING_HEROES; i++) {
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

        for (let i = 0; i < this.STARTING_HEROES; i++) {
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
        const sinType = this._randomSin(excludeSins);
        const stats = this._rollStats();
        const subStats = this._rollSubStats();
        const epithet = this._pickEpithet(subStats);
        const firstName = this._randomFirstName();
        const name = epithet ? `"${epithet}" ${firstName}` : firstName;

        return {
            id: this._nextId++,
            name,
            sinType: sinType.id,
            sinName: sinType.name_ko,
            sinFlaw: sinType.flaw,
            morale: this.MORALE_DEFAULT,
            stats,
            subStats,
            status: 'idle',
            location: 'base',
            equipment: { weapon: null, armor: null, accessory: null },
            appearance: this._spriteComposer ? this._spriteComposer.generateAppearance() : null,
            daysIdle: 0,
            expeditionFailStreak: 0
        };
    }

    /** 이름(first name)만 랜덤 */
    _randomFirstName() {
        const { first } = this.heroData.name_pool;
        return first[Math.floor(Math.random() * first.length)];
    }

    /** 독립 세부스탯 상위 2개 조합으로 수식어 결정 */
    _pickEpithet(subStats) {
        if (!subStats || this._epithets.length === 0) return null;

        // 상위 2개 스탯 찾기
        const sorted = SUB_STAT_KEYS
            .map(k => ({ key: k, val: subStats[k] || 0 }))
            .sort((a, b) => b.val - a.val);

        const top1 = sorted[0].key;
        const top2 = sorted[1].key;

        // CSV에서 매칭 (순서 무관)
        const match = this._epithets.find(e =>
            (e.stat1 === top1 && e.stat2 === top2) ||
            (e.stat1 === top2 && e.stat2 === top1)
        );

        if (!match) return null;

        // 후보 3개 중 랜덤
        const candidates = [match.epithet1, match.epithet2, match.epithet3].filter(Boolean);
        return candidates[Math.floor(Math.random() * candidates.length)];
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

    /** 메인스탯 굴림 — 총합 70 고정, 최소 2, 최대 18 */
    _rollStats() {
        const TOTAL = 70;
        const MIN = 2;
        const MAX = 18;
        const count = STAT_KEYS.length; // 7

        // 랜덤 분배: 총합 고정 + 범위 제한
        let values;
        for (let attempt = 0; attempt < 100; attempt++) {
            values = this._distributePoints(TOTAL, count, MIN, MAX);
            if (values) break;
        }

        if (!values) {
            // 폴백: 균등 분배
            values = STAT_KEYS.map(() => Math.floor(TOTAL / count));
            values[0] += TOTAL - values.reduce((a, b) => a + b, 0);
        }

        // 셔플하여 스탯에 배정
        for (let i = values.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [values[i], values[j]] = [values[j], values[i]];
        }

        const stats = {};
        STAT_KEYS.forEach((key, i) => { stats[key] = values[i]; });
        return stats;
    }

    /** 총합 고정 포인트 분배 */
    _distributePoints(total, count, min, max) {
        // 모든 스탯을 min으로 시작
        const values = Array(count).fill(min);
        let remaining = total - min * count;

        if (remaining < 0) return null;

        // 남은 포인트를 랜덤 분배
        for (let i = 0; i < remaining; i++) {
            const candidates = [];
            for (let j = 0; j < count; j++) {
                if (values[j] < max) candidates.push(j);
            }
            if (candidates.length === 0) return null;
            const idx = candidates[Math.floor(Math.random() * candidates.length)];
            values[idx]++;
        }

        return values;
    }

    /** 독립 세부스탯 7개 랜덤 굴림 (각 1~20) */
    _rollSubStats() {
        const subStats = {};
        for (const key of SUB_STAT_KEYS) {
            let roll = this.STAT_ROLL_BONUS;
            for (let i = 0; i < this.STAT_ROLL_DICE; i++) {
                roll += Math.floor(Math.random() * this.STAT_ROLL_SIDES);
            }
            subStats[key] = Math.max(1, Math.min(20, roll));
        }
        return subStats;
    }

    /** 파생 관계 스탯 계산 (기본 스탯/독립 세부스탯에서 산출) */
    getDerivedStats(hero) {
        return {
            commandPower: hero.stats.leadership,
            charm: hero.stats.charisma,
            susceptibility: hero.subStats ? (hero.subStats.sensitivity ?? 10) : 10
        };
    }

    /** 사기 변동 */
    updateMorale(heroId, delta) {
        const heroes = this.store.getState('heroes');
        const hero = heroes.find(h => h.id === heroId);
        if (!hero) return null;

        const oldMorale = hero.morale;
        hero.morale = Math.max(this.MORALE_MIN, Math.min(this.MORALE_MAX, hero.morale + delta));

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
        if (heroes.length >= this.MAX_HEROES) return false;
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
export { STAT_KEYS, SUB_STAT_KEYS, MORALE_STATE };
