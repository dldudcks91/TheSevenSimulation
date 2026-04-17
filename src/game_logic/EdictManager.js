/**
 * 국시(Edict) 매니저 — 바알의 통치 정책
 *
 * 상태 구조 (Store.edict):
 *   null                                                 무(無) 국시 상태
 *   { type, activatedDay, expireDay, cooldownUntilDay }  선포 중 또는 쿨다운 중
 *     - type: 'wrath' 등 (쿨다운 중에는 null)
 *     - expireDay: 자동 만료 예정 day (쿨다운 중에는 null)
 *     - cooldownUntilDay: 다음 선포 가능 day (선포 중에는 null)
 *
 * 기간/쿨다운 값은 balance.csv에서 로드:
 *   edict_duration, edict_cooldown_normal, edict_cooldown_early, edict_cooldown_opposite_bonus
 */

class EdictManager {
    constructor(store, edictsData = [], balance = {}) {
        this.store = store;
        this.edicts = edictsData;
        this.balance = balance;
    }

    /** 현재 Store.edict 상태 (null 또는 객체) */
    getState() {
        return this.store.getState('edict') || null;
    }

    /** 전체 국시 정의 목록 (edicts.csv) */
    getDefinitions() {
        return this.edicts;
    }

    /** 특정 죄종의 국시 정의 */
    getDefinition(sin) {
        return this.edicts.find(e => e.sin === sin) || null;
    }

    /** 선포 중인 국시 죄종 키 반환 (없으면 null) */
    getActiveSin() {
        const s = this.getState();
        return s && s.type ? s.type : null;
    }

    /** 선포 중 여부 */
    isActive() {
        return this.getActiveSin() !== null;
    }

    /** 쿨다운 중 여부 */
    isCooldown(day) {
        const s = this.getState();
        if (!s) return false;
        if (s.type) return false;
        return s.cooldownUntilDay != null && day < s.cooldownUntilDay;
    }

    /** 현재 선포 정의 (없으면 null) */
    getActiveDefinition() {
        const sin = this.getActiveSin();
        return sin ? this.getDefinition(sin) : null;
    }

    /** 선포된 국시의 특정 효과값 (없으면 0) */
    getEffect(effectKey) {
        const def = this.getActiveDefinition();
        if (!def) return 0;
        const v = def[effectKey];
        return (typeof v === 'number') ? v : 0;
    }

    /** 남은 턴 수 (선포 중일 때) */
    getRemainingTurns(day) {
        const s = this.getState();
        if (!s || !s.type || s.expireDay == null) return 0;
        return Math.max(0, s.expireDay - day);
    }

    /** 쿨다운 남은 턴 수 */
    getCooldownTurns(day) {
        const s = this.getState();
        if (!s || s.type || s.cooldownUntilDay == null) return 0;
        return Math.max(0, s.cooldownUntilDay - day);
    }

    /** 선포 가능 여부 (쿨다운 아니고, 선포 중이면 불가) */
    canProclaim(day) {
        if (this.isActive()) return false;
        if (this.isCooldown(day)) return false;
        return true;
    }

    /**
     * 국시 선포
     * @param {string} sin 선포할 죄종 키 ('wrath' 등)
     * @param {number} day 현재 day
     * @returns {object} { success, reason? }
     */
    proclaim(sin, day) {
        if (!this.getDefinition(sin)) return { success: false, reason: '해당 국시 없음' };
        if (!this.canProclaim(day)) return { success: false, reason: '선포 불가 (쿨다운 또는 이미 선포 중)' };

        const duration = this.balance.edict_duration ?? 5;
        this.store.setState('edict', {
            type: sin,
            activatedDay: day,
            expireDay: day + duration,
            cooldownUntilDay: null
        });
        return { success: true };
    }

    /**
     * 조기 해제
     * @param {number} day 현재 day
     * @returns {object} { success, reason? }
     */
    revoke(day) {
        if (!this.isActive()) return { success: false, reason: '선포 중 국시 없음' };
        const cooldown = this.balance.edict_cooldown_early ?? 2;
        this.store.setState('edict', {
            type: null,
            activatedDay: null,
            expireDay: null,
            cooldownUntilDay: day + cooldown
        });
        return { success: true };
    }

    /**
     * 대립 국시로 전환 (선포 중이면 조기 해제 + 추가 쿨다운, 아니면 즉시 선포)
     * @param {string} sin 전환할 죄종 키
     * @param {number} day
     */
    transitionTo(sin, day) {
        const targetDef = this.getDefinition(sin);
        if (!targetDef) return { success: false, reason: '해당 국시 없음' };
        const activeSin = this.getActiveSin();
        if (activeSin && this.isOpposite(activeSin, sin)) {
            const earlyCd = this.balance.edict_cooldown_early ?? 2;
            const oppBonus = this.balance.edict_cooldown_opposite_bonus ?? 1;
            this.store.setState('edict', {
                type: null,
                activatedDay: null,
                expireDay: null,
                cooldownUntilDay: day + earlyCd + oppBonus
            });
            return { success: true, transitioned: true };
        }
        return this.proclaim(sin, day);
    }

    /** 두 죄종이 대립 관계인지 */
    isOpposite(sinA, sinB) {
        if (!sinA || !sinB) return false;
        const defA = this.getDefinition(sinA);
        if (defA && defA.opposite_sin === sinB) return true;
        const defB = this.getDefinition(sinB);
        if (defB && defB.opposite_sin === sinA) return true;
        return false;
    }

    /**
     * 매턴 호출 — 만료 + 쿨다운 해소 체크
     * @param {number} day 현재 day
     * @returns {object|null} { expired: true } | { cooldownEnded: true } | null
     */
    tickDay(day) {
        const s = this.getState();
        if (!s) return null;

        // 선포 중 → 만료 체크
        if (s.type && s.expireDay != null && day >= s.expireDay) {
            const cooldown = this.balance.edict_cooldown_normal ?? 1;
            this.store.setState('edict', {
                type: null,
                activatedDay: null,
                expireDay: null,
                cooldownUntilDay: day + cooldown
            });
            return { expired: true, sin: s.type };
        }

        // 쿨다운 중 → 해소 체크
        if (!s.type && s.cooldownUntilDay != null && day >= s.cooldownUntilDay) {
            this.store.setState('edict', null);
            return { cooldownEnded: true };
        }

        return null;
    }
}

export default EdictManager;
