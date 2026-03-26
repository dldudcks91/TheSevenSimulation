/**
 * 거점 시설/건설/연구 관리 + 포고령
 * 포고령 효과는 policies CSV 데이터에서 로드
 */

class BaseManager {
    constructor(store, facilitiesData, policies = [], balance = {}) {
        this.store = store;
        this.allFacilities = facilitiesData.facilities;
        this.allResearch = facilitiesData.research;
        this.policies = policies;
        this.balance = balance;
        this._initState();
    }

    _initState() {
        this.store.setState('base', {
            built: [],
            building: null,
            researched: [],
            researching: null,
            policies: {
                ration: 'normal',
                training: 'normal',
                alert: 'normal'
            }
        });
    }

    // ─── 건설 ───

    getAvailableBuilds() {
        const base = this.store.getState('base');
        const gold = this.store.getState('gold') || 0;

        return this.allFacilities.filter(f => {
            if (base.built.includes(f.id)) return false;
            if (base.building && base.building.facilityId === f.id) return false;
            const prereqsMet = f.requires.every(req => base.built.includes(req));
            return prereqsMet && gold >= f.cost;
        });
    }

    startBuilding(facilityId, heroId) {
        const base = this.store.getState('base');
        if (base.building) return { success: false, reason: '이미 건설 중' };

        const facility = this.allFacilities.find(f => f.id === facilityId);
        if (!facility) return { success: false, reason: '시설 없음' };

        const gold = this.store.getState('gold') || 0;
        if (gold < facility.cost) return { success: false, reason: '골드 부족' };

        this.store.setState('gold', gold - facility.cost);
        base.building = {
            facilityId: facility.id,
            name: facility.name_ko,
            turnsLeft: facility.build_turns,
            assignedHeroId: heroId
        };
        this.store.setState('base', { ...base });

        return { success: true, facility };
    }

    processBuildTurn() {
        const base = this.store.getState('base');
        if (!base.building) return null;

        base.building.turnsLeft--;

        if (base.building.turnsLeft <= 0) {
            const completed = base.building;
            base.built.push(completed.facilityId);
            base.building = null;
            this.store.setState('base', { ...base });
            return { type: 'complete', facilityId: completed.facilityId, name: completed.name };
        }

        this.store.setState('base', { ...base });
        return { type: 'progress', turnsLeft: base.building.turnsLeft, name: base.building.name };
    }

    // ─── 연구 ───

    getAvailableResearch() {
        const base = this.store.getState('base');
        const gold = this.store.getState('gold') || 0;

        return this.allResearch.filter(r => {
            if (base.researched.includes(r.id)) return false;
            if (base.researching && base.researching.researchId === r.id) return false;
            if (!base.built.includes(r.requires_facility)) return false;
            if (r.requires_research && !base.researched.includes(r.requires_research)) return false;
            return gold >= r.cost;
        });
    }

    startResearch(researchId, heroId) {
        const base = this.store.getState('base');
        if (base.researching) return { success: false, reason: '이미 연구 중' };

        const research = this.allResearch.find(r => r.id === researchId);
        if (!research) return { success: false, reason: '연구 없음' };

        const gold = this.store.getState('gold') || 0;
        if (gold < research.cost) return { success: false, reason: '골드 부족' };

        this.store.setState('gold', gold - research.cost);
        base.researching = {
            researchId: research.id,
            name: research.name_ko,
            turnsLeft: research.turns,
            assignedHeroId: heroId
        };
        this.store.setState('base', { ...base });

        return { success: true, research };
    }

    processResearchTurn() {
        const base = this.store.getState('base');
        if (!base.researching) return null;

        base.researching.turnsLeft--;

        if (base.researching.turnsLeft <= 0) {
            const completed = base.researching;
            base.researched.push(completed.researchId);
            base.researching = null;
            this.store.setState('base', { ...base });
            return { type: 'complete', researchId: completed.researchId, name: completed.name };
        }

        this.store.setState('base', { ...base });
        return { type: 'progress', turnsLeft: base.researching.turnsLeft, name: base.researching.name };
    }

    // ─── 포고령 (CSV 데이터 기반) ───

    setPolicy(policyKey, value) {
        const base = this.store.getState('base');
        if (base.policies[policyKey] !== undefined) {
            base.policies[policyKey] = value;
            this.store.setState('base', { ...base });
            return true;
        }
        return false;
    }

    /** 포고령에 의한 턴당 사기 변동 계산 — policies CSV 기반 */
    getPolicyMoraleEffect() {
        const base = this.store.getState('base');
        const p = base.policies;
        let delta = 0;

        for (const [key, val] of Object.entries(p)) {
            const policyRow = this.policies.find(r => r.policy === key && r.value === val);
            if (policyRow) {
                delta += policyRow.morale_delta;
            }
        }

        return delta;
    }

    // ─── 턴 수입 ───

    getPassiveIncome() {
        const base = this.store.getState('base');
        let income = 0;
        for (const builtId of base.built) {
            const facility = this.allFacilities.find(f => f.id === builtId);
            if (facility && facility.effects.gold_per_turn) {
                income += facility.effects.gold_per_turn;
            }
        }
        return income;
    }

    getBuiltFacilities() {
        const base = this.store.getState('base');
        return base.built.map(id => this.allFacilities.find(f => f.id === id)).filter(Boolean);
    }

    hasFacility(facilityId) {
        const base = this.store.getState('base');
        return base.built.includes(facilityId);
    }

    getResearchEffect(effectType) {
        const base = this.store.getState('base');
        for (const resId of base.researched) {
            const research = this.allResearch.find(r => r.id === resId);
            if (research && research.effect && research.effect.type === effectType) {
                return research.effect.value;
            }
        }
        return null;
    }

    getPassiveIncomeWithBonus() {
        let income = this.getPassiveIncome();
        const bonus = this.getResearchEffect('income_bonus');
        if (bonus) income = Math.floor(income * (1 + bonus));
        return income;
    }

    getBuildCost(facility) {
        const discount = this.getResearchEffect('build_discount');
        if (discount) return Math.floor(facility.cost * (1 - discount));
        return facility.cost;
    }

    getRampageThreshold() {
        const threshold = this.getResearchEffect('rampage_threshold');
        return threshold || 100;
    }

    getWatchtowerLevel() {
        const base = this.store.getState('base');
        if (base.built.includes('watchtower_3')) return 3;
        if (base.built.includes('watchtower_2')) return 2;
        if (base.built.includes('watchtower')) return 1;
        return 0;
    }

    /** 감시탑 레벨에 따른 습격 정보 — defense_scaling CSV 기반 */
    getRaidInfo(day) {
        const level = this.getWatchtowerLevel();

        // balance에서 방어 스케일링 값 사용
        const b = this.balance;
        const defHpBase = b.defense_enemy_hp_base ?? 30;
        const defHpPerDay = b.defense_enemy_hp_per_day ?? 3;
        const defAtkBase = b.defense_enemy_atk_base ?? 8;
        const defAtkPerDay = b.defense_enemy_atk_per_day ?? 1;

        const scale = Math.floor(day / 3) + 1;
        const enemyCount = scale + 1;
        const sizeDesc = scale <= 2 ? '소규모' : scale <= 4 ? '중규모' : '대규모';

        if (level === 0) return { text: '습격 정보 없음 (감시탑 필요)', detail: '' };
        if (level === 1) return { text: '오늘 밤 습격이 있습니다.', detail: '' };
        if (level === 2) return { text: `오늘 밤 ${sizeDesc} 습격 예상`, detail: `적 약 ${enemyCount}체` };
        return { text: `오늘 밤 ${sizeDesc} 습격 예상`, detail: `적 ${enemyCount}체 (HP:${defHpBase + day * defHpPerDay}, ATK:${defAtkBase + day * defAtkPerDay})` };
    }

    processHeroRecovery(heroes) {
        const hasHospital = this.hasFacility('hospital');
        const results = [];
        for (const hero of heroes) {
            if (hero.status === 'injured') {
                hero.recoveryTurns = (hero.recoveryTurns || 2) - 1;
                if (hasHospital) hero.recoveryTurns -= 1;
                if (hero.recoveryTurns <= 0) {
                    hero.status = 'idle';
                    hero.recoveryTurns = 0;
                    results.push({ name: hero.name, recovered: true });
                }
            }
        }
        return results;
    }

    getCurrentBuilding() { return this.store.getState('base').building; }
    getCurrentResearch() { return this.store.getState('base').researching; }
}

export default BaseManager;
