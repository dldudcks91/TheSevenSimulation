/**
 * 영웅 관리 — 랜덤 생성, 죄종 수치 관리, 폭주/이탈 체크
 * 모든 상수는 balance 데이터에서 주입
 */

import { topSin, topTwoSins, SIN_NAMES_KO, getSinStatBonuses } from './SinUtils.js';

const STAT_KEYS = ['strength', 'agility', 'intellect', 'vitality', 'perception', 'leadership', 'charisma'];
const SIN_STAT_KEYS = ['wrath', 'envy', 'greed', 'sloth', 'gluttony', 'lust', 'pride'];

// 하위 호환: 기존 SUB_STAT_KEYS → SIN_STAT_KEYS 매핑
const SUB_STAT_KEYS = SIN_STAT_KEYS;

class HeroManager {
    constructor(store, heroData, balance = {}) {
        this.store = store;
        this.heroData = heroData;
        this.balance = balance;
        this._nextId = 1;
        this._spriteComposer = null;
        this._epithets = [];
        this._itemsData = [];
        this._traitsData = [];

        // balance에서 상수 로드 (기본값 폴백)
        this.STAT_MIN = balance.stat_min ?? 1;
        this.STAT_MAX = balance.stat_max ?? 20;
        this.SIN_MIN = balance.sin_min ?? 0;
        this.SIN_MAX = balance.sin_max ?? 20;
        this.SIN_RAMPAGE_THRESHOLD = balance.sin_rampage_threshold ?? 18;
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

    /** 아이템 데이터 주입 */
    setItemsData(itemsData) {
        this._itemsData = itemsData || [];
    }

    /** 특성 데이터 주입 */
    setTraitsData(traitsData) {
        this._traitsData = traitsData || [];
    }

    /** 게임 시작 시 초기 영웅 생성 */
    initStartingHeroes() {
        const heroes = [];

        for (let i = 0; i < this.STARTING_HEROES; i++) {
            const hero = this._generateHero();
            heroes.push(hero);
        }

        this.store.setState('heroes', heroes);
        this.grantStartingItem();
        return heroes;
    }

    /** 게임 시작 시 인벤토리에 일반 등급 아이템 1개 랜덤 지급 */
    grantStartingItem() {
        const equippable = this._itemsData.filter(
            item => item.grade === 'normal' && item.type !== 'consumable'
        );
        if (equippable.length === 0) return;

        const pick = equippable[Math.floor(Math.random() * equippable.length)];
        const inventory = this.store.getState('inventory') || [];
        inventory.push({ ...pick });
        this.store.setState('inventory', inventory);
    }

    /** 미리보기용 초기 영웅 생성 (Store에 저장하지 않음) */
    previewStartingHeroes() {
        const heroes = [];

        for (let i = 0; i < this.STARTING_HEROES; i++) {
            const hero = this._generateHero();
            heroes.push(hero);
        }

        return heroes;
    }

    /** 미리보기 영웅을 확정하여 Store에 저장 */
    confirmHeroes(heroes) {
        this.store.setState('heroes', heroes);
    }

    /** 영웅 1명 랜덤 생성 */
    _generateHero() {
        const stats = this._rollStats();
        const sinStats = this._rollSinStats();
        const primarySin = this._derivePrimarySin(sinStats);
        const sinDef = this.heroData.sin_types.find(s => s.id === primarySin);
        const trait = this._randomTrait();
        const epithet = this._pickEpithet(sinStats);
        const firstName = this._randomFirstName();
        const name = epithet ? `"${epithet}" ${firstName}` : firstName;
        const maxHp = this._calcMaxHp(stats);

        return {
            id: this._nextId++,
            name,
            sinStats,
            primarySin, // DEPRECATED: UI fallback only
            sinName: sinDef?.name_ko || '',
            sinFlaw: sinDef?.flaw || '',
            trait: trait ? {
                id: trait.id, name: trait.name, category: trait.category,
                pro_effect: trait.pro_effect, con_effect: trait.con_effect,
                sin_category: trait.sin_category || 'neutral',
                target_sin: trait.target_sin || null,
                sin_mult: typeof trait.sin_mult === 'number' ? trait.sin_mult : 1.0,
                rampage_sin: trait.rampage_sin || null,
                rampage_action: trait.rampage_action || null,
                desertion_sin: trait.desertion_sin || null,
                desertion_action: trait.desertion_action || null
            } : null,
            acquiredTraits: [],
            stats,
            subStats: sinStats,
            foodCost: this.calcFoodCost(stats),
            status: 'idle',
            location: 'base',
            equipment: [null, null, null],
            appearance: this._spriteComposer ? this._spriteComposer.generateAppearance() : null,
            daysIdle: 0,
            expeditionFailStreak: 0,
            _rampageHistory: [],
            _sinOverflowTurns: {},
            isRampaging: false,
            hp: maxHp,
            maxHp,
            stamina: this.balance.stamina_max ?? 100,
            sickTurns: 0,
            bonds: {},
        };
    }

    /**
     * 영웅의 "현재 발휘되는 스탯" — 기본 스탯 + 죄종 수치 보너스 (발현/고양/폭주 치환)
     * @param {object} hero
     * @returns {object} {strength, agility, intellect, ...}
     */
    getEffectiveStats(hero) {
        if (!hero || !hero.stats) return {};
        const result = { ...hero.stats };
        const bonuses = getSinStatBonuses(hero, this.balance);
        for (const [stat, bonus] of Object.entries(bonuses)) {
            if (stat in result) result[stat] = (result[stat] || 0) + bonus;
        }
        return result;
    }

    /**
     * 관계(bonds) 변동 — A → B 방향.
     * @param {number} fromHeroId
     * @param {number} toHeroId
     * @param {number} delta - 양수/음수
     * @returns {number} 변경된 값
     */
    adjustBonds(fromHeroId, toHeroId, delta) {
        const hero = this.getHero(fromHeroId);
        if (!hero || !delta || fromHeroId === toHeroId) return 0;
        if (!hero.bonds) hero.bonds = {};
        const min = this.balance.bonds_min ?? 0;
        const max = this.balance.bonds_max ?? 100;
        const init = this.balance.bonds_initial ?? 50;
        const cur = (toHeroId in hero.bonds) ? hero.bonds[toHeroId] : init;
        const next = Math.max(min, Math.min(max, cur + delta));
        hero.bonds[toHeroId] = next;
        this.store.setState('heroes', [...(this.store.getState('heroes') || [])]);
        return next;
    }

    /**
     * 영웅의 bonds 평균값 (타인들 기준, 미접촉은 초기값 50으로 가정).
     * @param {object} hero
     * @param {number[]} allHeroIds - 자신을 제외한 영웅 ID 목록
     * @returns {number}
     */
    getAverageBonds(hero, allHeroIds = []) {
        if (!hero) return 0;
        const init = this.balance.bonds_initial ?? 50;
        const others = allHeroIds.filter(id => id !== hero.id);
        if (others.length === 0) return init;
        const bonds = hero.bonds || {};
        const sum = others.reduce((acc, id) => acc + ((id in bonds) ? bonds[id] : init), 0);
        return sum / others.length;
    }

    /** HP 최대치 계산 — base + vitality × per_vit */
    _calcMaxHp(stats) {
        const base = this.balance.hero_hp_base ?? 50;
        const perVit = this.balance.hero_hp_per_vitality ?? 5;
        const vitality = stats?.vitality ?? 10;
        return base + vitality * perVit;
    }

    /** 외부 API — 영웅의 최대 HP */
    calcMaxHp(hero) {
        return this._calcMaxHp(hero?.stats);
    }

    /** 이름(first name)만 랜덤 */
    _randomFirstName() {
        const { first } = this.heroData.name_pool;
        return first[Math.floor(Math.random() * first.length)];
    }

    /** 죄종 수치 상위 2개 조합으로 수식어 결정 */
    _pickEpithet(sinStats) {
        if (!sinStats || this._epithets.length === 0) return null;

        // 쌓임 프레임: 모든 수치가 0이면 수식어 없음 (의미 없는 조합 방지)
        const maxVal = Math.max(...SIN_STAT_KEYS.map(k => sinStats[k] || 0));
        if (maxVal === 0) return null;

        // 상위 2개 스탯 찾기
        const sorted = SIN_STAT_KEYS
            .map(k => ({ key: k, val: sinStats[k] || 0 }))
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

    /** sinStats에서 가장 높은 죄종 파생 — SinUtils.topSin() 위임 */
    _derivePrimarySin(sinStats) {
        return topSin(sinStats);
    }

    /** 선천 특성 1개 랜덤 선택 (innate 타입만, 구원 제외) */
    _randomTrait() {
        const innate = this._traitsData.filter(t => t.type === 'innate' && t.sin_category !== 'salvation');
        if (innate.length === 0) return null;
        return innate[Math.floor(Math.random() * innate.length)];
    }

    /** 메인스탯 굴림 — 총합 60~80 랜덤, 최소 2, 최대 18 */
    _rollStats() {
        const totalMin = this.balance.stat_total_min ?? 60;
        const totalMax = this.balance.stat_total_max ?? 80;
        const TOTAL = totalMin + Math.floor(Math.random() * (totalMax - totalMin + 1));
        const MIN = this.balance.stat_main_min ?? 1;
        const MAX = this.balance.stat_main_max ?? 20;
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

    /**
     * 체력 소모 (행동 시 호출)
     * @returns {number} 소모된 실제 양 (음수 보정 후)
     */
    consumeStamina(heroId, amount) {
        const hero = this.getHero(heroId);
        if (!hero) return 0;
        if (!amount) return 0;
        const max = this.balance.stamina_max ?? 100;
        const mult = this._getStaminaCostMult(hero);
        const adjusted = Math.round(amount * mult);
        const cur = hero.stamina ?? max;
        const next = Math.max(0, Math.min(max, cur - adjusted));
        const actualUsed = cur - next;
        hero.stamina = next;
        this.store.setState('heroes', [...(this.store.getState('heroes') || [])]);
        return actualUsed;
    }

    /**
     * 매 턴 체력(Stamina) 회복 (TurnProcessor에서 호출)
     * 회복량 = base + vitality × bonus, 죄종 보정 적용
     */
    recoverStaminaTurn(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) return 0;
        const max = this.balance.stamina_max ?? 100;
        const base = this.balance.stamina_recovery_base ?? 4;
        const bonus = this.balance.stamina_recovery_health_bonus ?? 0.5;
        const vitality = hero.stats?.vitality ?? 5;
        const mult = this._getStaminaRecoverMult(hero);
        const recover = Math.round((base + vitality * bonus) * mult);
        const cur = hero.stamina ?? max;
        hero.stamina = Math.min(max, cur + recover);
        return hero.stamina - cur;
    }

    /**
     * 매 턴 HP 자연 회복 (TurnProcessor에서 호출)
     * 회복량 = hero_hp_regen_per_turn
     */
    regenHeroHpTurn(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) return 0;
        const regen = this.balance.hero_hp_regen_per_turn ?? 10;
        const maxHp = hero.maxHp ?? this._calcMaxHp(hero.stats);
        const cur = hero.hp ?? maxHp;
        const next = Math.min(maxHp, cur + regen);
        hero.hp = next;
        hero.maxHp = maxHp;
        return next - cur;
    }

    /** 주 성향(topSin) 기반 Stamina 소모 배율 */
    _getStaminaCostMult(hero) {
        const sin = topSin(hero?.sinStats);
        if (!sin) return 1.0;
        const key = `stamina_mult_${sin}_cost`;
        return this.balance[key] ?? 1.0;
    }

    /** 주 성향(topSin) 기반 Stamina 회복 배율 */
    _getStaminaRecoverMult(hero) {
        const sin = topSin(hero?.sinStats);
        if (!sin) return 1.0;
        const key = `stamina_mult_${sin}_recover`;
        return this.balance[key] ?? 1.0;
    }

    /**
     * 과로 상태 발병 판정 (TurnProcessor에서 매턴 호출)
     * @returns {boolean} 발병 여부
     */
    checkSicknessTick(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) return false;
        const overwork = this.balance.stamina_overwork_threshold ?? 25;
        const stamina = hero.stamina ?? 100;
        if (stamina > overwork) return false;

        const baseChance = this.balance.sickness_chance_base ?? 0.15;
        const healthRed = this.balance.sickness_health_reduction ?? 0.01;
        const vitality = hero.stats?.vitality ?? 5;
        const chance = Math.max(0.02, baseChance - vitality * healthRed);
        if (Math.random() >= chance) return false;

        const minT = this.balance.sickness_min_turns ?? 2;
        const maxT = this.balance.sickness_max_turns ?? 3;
        hero.sickTurns = minT + Math.floor(Math.random() * (maxT - minT + 1));
        hero.status = 'sick';
        // 발병 시 주 성향 죄종 수치 상승 (스트레스 반응)
        const primarySin = topSin(hero.sinStats);
        if (primarySin) this.updateSinStat(heroId, primarySin, 1);
        return true;
    }

    /** 발병 회복 진행 (매 턴 turn counter -1) */
    tickSickness(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) return;
        if (hero.status !== 'sick' || !hero.sickTurns) return;
        hero.sickTurns -= 1;
        if (hero.sickTurns <= 0) {
            hero.sickTurns = 0;
            hero.status = 'idle';
        }
    }

    /** 영웅 식량 비용 계산 (스탯 총합 기반) */
    calcFoodCost(stats) {
        const total = STAT_KEYS.reduce((sum, k) => sum + (stats[k] || 0), 0);
        const base = this.balance.food_cost_base ?? 5;
        const divisor = this.balance.food_cost_divisor ?? 4;
        const totalMin = this.balance.stat_total_min ?? 60;
        return base + Math.round((total - totalMin) / divisor);
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

    /** 죄종 수치 7개 초기화 — 쌓임 프레임: 모두 0에서 시작 */
    _rollSinStats() {
        const sinStats = {};
        for (const key of SIN_STAT_KEYS) {
            sinStats[key] = 0;
        }
        return sinStats;
    }

    /** 파생 관계 스탯 계산 (기본 스탯/죄종 수치에서 산출) */
    getDerivedStats(hero) {
        const sinStats = hero.sinStats || hero.subStats;
        return {
            commandPower: hero.stats.leadership,
            charm: hero.stats.charisma,
            susceptibility: sinStats ? (sinStats.lust ?? (this.balance.sensitivity_default ?? 10)) : (this.balance.sensitivity_default ?? 10)
        };
    }

    /**
     * 죄종 수치 변동 (0~20 클램프) + 특성 배수 적용 (편향/저항/구원).
     * - delta > 0 (쌓임): 편향 ×1.3 / 저항 ×0.7 / 구원 ×0.5 (target_sin 일치 시)
     * - delta < 0 (정화): 배수 미적용 (정화는 그대로)
     */
    updateSinStat(heroId, sinKey, delta) {
        const heroes = this.store.getState('heroes');
        const hero = heroes.find(h => h.id === heroId);
        if (!hero || !hero.sinStats || !(sinKey in hero.sinStats)) return null;

        let effDelta = delta;
        if (delta > 0) {
            const mult = this._calcSinMult(hero, sinKey);
            effDelta = delta * mult;
            // 정수 단위 유지 (소수점은 확률 라운딩)
            const floor = Math.floor(effDelta);
            const frac = effDelta - floor;
            effDelta = floor + (Math.random() < frac ? 1 : 0);
        }

        const oldVal = hero.sinStats[sinKey];
        hero.sinStats[sinKey] = Math.max(0, Math.min(this.SIN_MAX, oldVal + effDelta));
        hero.isRampaging = this.isRampaging(hero);

        this.store.setState('heroes', [...heroes]);
        return { heroId, sinKey, oldVal, newVal: hero.sinStats[sinKey], effDelta };
    }

    /**
     * 특성(시작 + 후천) 기반 죄종 쌓임 배수 계산.
     * 가장 강한 영향 1개만 적용 (구원 > 저항 > 편향 우선순위).
     */
    _calcSinMult(hero, sinKey) {
        const traits = [];
        if (hero.trait) traits.push(hero.trait);
        if (Array.isArray(hero.acquiredTraits)) traits.push(...hero.acquiredTraits);

        let salvationMult = null;
        let resistMult = null;
        let biasMult = null;
        for (const t of traits) {
            if (!t) continue;
            const tgt = t.target_sin;
            const matches = tgt === sinKey || tgt === 'all';
            if (!matches) continue;
            const mult = (typeof t.sin_mult === 'number') ? t.sin_mult : 1.0;
            if (t.sin_category === 'salvation' && (salvationMult === null || mult < salvationMult)) salvationMult = mult;
            else if (t.sin_category === 'resist' && (resistMult === null || mult < resistMult)) resistMult = mult;
            else if (t.sin_category === 'bias' && (biasMult === null || mult > biasMult)) biasMult = mult;
        }
        if (salvationMult !== null) return salvationMult;
        if (resistMult !== null) return resistMult;
        if (biasMult !== null) return biasMult;
        return 1.0;
    }

    /** 영웅이 폭주 상태인지 판정 (어떤 죄종이든 18 이상이면 폭주) */
    isRampaging(hero) {
        if (!hero?.sinStats) return false;
        return SIN_STAT_KEYS.some(k => (hero.sinStats[k] ?? 0) >= this.SIN_RAMPAGE_THRESHOLD);
    }

    /** 폭주 중인 죄종 키 목록 반환 */
    getRampagingSins(hero) {
        if (!hero?.sinStats) return [];
        return SIN_STAT_KEYS.filter(k => (hero.sinStats[k] ?? 0) >= this.SIN_RAMPAGE_THRESHOLD);
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
        const recruits = [];
        for (let i = 0; i < count; i++) {
            recruits.push(this._generateHero());
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
export { STAT_KEYS, SIN_STAT_KEYS, SUB_STAT_KEYS };
