/**
 * 거점 시설/건설/연구 관리
 * HOMM3 방식: 턴당 건설 1개, 턴당 연구 1개 진행
 */

class BaseManager {
    constructor(store, facilitiesData) {
        this.store = store;
        this.allFacilities = facilitiesData.facilities;
        this.allResearch = facilitiesData.research;
        this._initState();
    }

    _initState() {
        this.store.setState('base', {
            built: [],              // 완성된 시설 ID 목록
            building: null,         // { facilityId, turnsLeft, assignedHeroId }
            researched: [],         // 완료된 연구 ID 목록
            researching: null,      // { researchId, turnsLeft, assignedHeroId }
            policies: {             // 포고령
                ration: 'normal',       // lavish / normal / austerity
                training: 'normal',     // intense / normal / relaxed
                alert: 'normal'         // max / normal / min
            }
        });
    }

    // ─── 건설 ───

    /** 건설 가능한 시설 목록 */
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

    /** 건설 시작 */
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

    /** 턴 진행 시 건설 처리 */
    processBuildTurn() {
        const base = this.store.getState('base');
        if (!base.building) return null;

        base.building.turnsLeft--;

        if (base.building.turnsLeft <= 0) {
            const completed = base.building;
            base.built.push(completed.facilityId);
            base.building = null;
            this.store.setState('base', { ...base });

            // 시장 완성 시 턴당 수입 시작
            return { type: 'complete', facilityId: completed.facilityId, name: completed.name };
        }

        this.store.setState('base', { ...base });
        return { type: 'progress', turnsLeft: base.building.turnsLeft, name: base.building.name };
    }

    // ─── 연구 ───

    /** 연구 가능한 목록 */
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

    /** 연구 시작 */
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

    /** 턴 진행 시 연구 처리 */
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

    // ─── 포고령 ───

    setPolicy(policyKey, value) {
        const base = this.store.getState('base');
        if (base.policies[policyKey] !== undefined) {
            base.policies[policyKey] = value;
            this.store.setState('base', { ...base });
            return true;
        }
        return false;
    }

    /** 포고령에 의한 턴당 사기 변동 계산 */
    getPolicyMoraleEffect() {
        const base = this.store.getState('base');
        const p = base.policies;
        let delta = 0;

        if (p.ration === 'lavish') delta += 5;
        else if (p.ration === 'austerity') delta -= 3;

        if (p.training === 'intense') delta -= 3;
        else if (p.training === 'relaxed') delta += 3;

        if (p.alert === 'max') delta -= 2;
        else if (p.alert === 'min') delta += 2;

        return delta;
    }

    // ─── 턴 수입 ───

    /** 시장 등 시설에 의한 턴당 수입 */
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

    /** 건설된 시설 목록 (UI용) */
    getBuiltFacilities() {
        const base = this.store.getState('base');
        return base.built.map(id => this.allFacilities.find(f => f.id === id)).filter(Boolean);
    }

    /** 시설이 건설되었는지 확인 */
    hasFacility(facilityId) {
        const base = this.store.getState('base');
        return base.built.includes(facilityId);
    }

    /** 완료된 연구 효과 조회 */
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

    /** 시장 수입 (연구 보너스 적용) */
    getPassiveIncomeWithBonus() {
        let income = this.getPassiveIncome();
        const bonus = this.getResearchEffect('income_bonus');
        if (bonus) {
            income = Math.floor(income * (1 + bonus));
        }
        return income;
    }

    /** 건설 비용 계산 (연구 보너스 적용) */
    getBuildCost(facility) {
        const discount = this.getResearchEffect('build_discount');
        if (discount) {
            return Math.floor(facility.cost * (1 - discount));
        }
        return facility.cost;
    }

    /** 폭주 임계값 (연구 보너스 적용) */
    getRampageThreshold() {
        const threshold = this.getResearchEffect('rampage_threshold');
        return threshold || 100;
    }

    /** 감시탑 레벨 조회 */
    getWatchtowerLevel() {
        const base = this.store.getState('base');
        if (base.built.includes('watchtower_3')) return 3;
        if (base.built.includes('watchtower_2')) return 2;
        if (base.built.includes('watchtower')) return 1;
        return 0;
    }

    /** 감시탑 레벨에 따른 습격 정보 */
    getRaidInfo(day) {
        const level = this.getWatchtowerLevel();
        const scale = Math.floor(day / 3) + 1;
        const enemyCount = scale + 1;
        const sizeDesc = scale <= 2 ? '소규모' : scale <= 4 ? '중규모' : '대규모';

        if (level === 0) return { text: '습격 정보 없음 (감시탑 필요)', detail: '' };
        if (level === 1) return { text: '오늘 밤 습격이 있습니다.', detail: '' };
        if (level === 2) return { text: `오늘 밤 ${sizeDesc} 습격 예상`, detail: `적 약 ${enemyCount}체` };
        return { text: `오늘 밤 ${sizeDesc} 습격 예상`, detail: `적 ${enemyCount}체 (HP:${30 + day * 3}, ATK:${8 + day})` };
    }

    /** 부상 영웅 회복 처리 (턴마다 호출) */
    processHeroRecovery(heroes) {
        const hasHospital = this.hasFacility('hospital');
        const results = [];
        for (const hero of heroes) {
            if (hero.status === 'injured') {
                hero.recoveryTurns = (hero.recoveryTurns || 2) - 1;
                if (hasHospital) hero.recoveryTurns -= 1; // 병원: 회복 2배속
                if (hero.recoveryTurns <= 0) {
                    hero.status = 'idle';
                    hero.recoveryTurns = 0;
                    results.push({ name: hero.name, recovered: true });
                }
            }
        }
        return results;
    }

    /** 현재 건설 상태 */
    getCurrentBuilding() {
        return this.store.getState('base').building;
    }

    /** 현재 연구 상태 */
    getCurrentResearch() {
        return this.store.getState('base').researching;
    }
}

export default BaseManager;
