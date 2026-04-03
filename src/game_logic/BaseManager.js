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
        // 초기 해금: 3×3 왼쪽 위 (인덱스 0,1,2,5,6,7,10,11,12)
        const initialUnlocked = [0, 1, 2, 5, 6, 7, 10, 11, 12];

        this.store.setState('base', {
            built: [],
            buildings: [],
            researched: [],
            researching: null,
            unlockedCells: [...initialUnlocked],
            pioneering: null, // { cellIndex, assignedHeroId }
            defenseHeroIds: [], // 방어 배치된 영웅 ID 목록
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

        const buildingIds = (base.buildings || []).map(b => b.facilityId);
        return this.allFacilities.filter(f => {
            if (base.built.includes(f.id)) return false;
            if (buildingIds.includes(f.id)) return false;
            const prereqsMet = f.requires.every(req => base.built.includes(req));
            return prereqsMet && gold >= f.cost;
        });
    }

    /** 전제조건 충족 시설 전체 (골드 무관) — 건설 UI용 */
    getPrereqMetBuilds() {
        const base = this.store.getState('base');
        const buildingIds = (base.buildings || []).map(b => b.facilityId);
        return this.allFacilities.filter(f => {
            if (base.built.includes(f.id)) return false;
            if (buildingIds.includes(f.id)) return false;
            return f.requires.every(req => base.built.includes(req));
        });
    }

    startBuilding(facilityId, heroId) {
        const base = this.store.getState('base');
        if (!base.buildings) base.buildings = [];

        const facility = this.allFacilities.find(f => f.id === facilityId);
        if (!facility) return { success: false, reason: '시설 없음' };

        const gold = this.store.getState('gold') || 0;
        if (gold < facility.cost) return { success: false, reason: '골드 부족' };

        this.store.setState('gold', gold - facility.cost);
        base.buildings.push({
            facilityId: facility.id,
            name: facility.name_ko,
            progress: 0,
            buildCost: facility.build_cost,
            assignedHeroId: heroId
        });
        this.store.setState('base', { ...base });

        return { success: true, facility };
    }

    processBuildTurn() {
        const base = this.store.getState('base');
        if (!base.buildings || base.buildings.length === 0) return null;

        const heroes = this.store.getState('heroes') || [];
        const results = [];

        // 역순으로 순회 (완료 시 splice해도 안전)
        for (let i = base.buildings.length - 1; i >= 0; i--) {
            const building = base.buildings[i];
            const hero = building.assignedHeroId
                ? heroes.find(h => h.id === building.assignedHeroId)
                : null;
            if (!hero) {
                results.push({ type: 'no_hero', name: building.name });
                continue;
            }
            const buildPower = Math.floor((hero.stats.strength + hero.stats.agility) / 2);

            building.progress += buildPower;

            if (building.progress >= building.buildCost) {
                base.built.push(building.facilityId);
                base.buildings.splice(i, 1);
                if (hero) hero.status = 'idle';
                results.push({ type: 'complete', facilityId: building.facilityId, name: building.name });
            } else {
                // 매 턴 영웅 해제 — 다음 턴에 재투입 필요
                building.assignedHeroId = null;
                results.push({ type: 'progress', progress: building.progress, buildCost: building.buildCost, name: building.name });
            }
        }

        this.store.setState('base', { ...base });
        if (results.some(r => r.type === 'complete')) {
            this.store.setState('heroes', [...heroes]);
        }
        return results.length > 0 ? results : null;
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
            progress: 0,
            researchCost: research.research_cost,
            assignedHeroId: heroId
        };
        this.store.setState('base', { ...base });

        return { success: true, research };
    }

    processResearchTurn() {
        const base = this.store.getState('base');
        if (!base.researching) return null;

        // 영웅 스탯으로 연구력 계산: 지능
        const heroes = this.store.getState('heroes') || [];
        const hero = heroes.find(h => h.id === base.researching.assignedHeroId);
        const researchPower = hero ? hero.stats.intelligence : 1;

        base.researching.progress += researchPower;

        if (base.researching.progress >= base.researching.researchCost) {
            const completed = base.researching;
            base.researched.push(completed.researchId);
            base.researching = null;
            this.store.setState('base', { ...base });
            return { type: 'complete', researchId: completed.researchId, name: completed.name };
        }

        this.store.setState('base', { ...base });
        return { type: 'progress', progress: base.researching.progress, researchCost: base.researching.researchCost, name: base.researching.name };
    }

    // ─── 개척 (거점 확장) ───

    /** 개척 가능한 셀 목록 (잠긴 셀 중 해금 셀과 인접) */
    getAvailablePioneerCells() {
        const base = this.store.getState('base');
        const unlocked = base.unlockedCells;
        const allCells = Array.from({ length: 25 }, (_, i) => i);
        const locked = allCells.filter(i => !unlocked.includes(i));

        return locked.filter(i => {
            const row = Math.floor(i / 5);
            const col = i % 5;
            const neighbors = [];
            if (row > 0) neighbors.push(i - 5);
            if (row < 4) neighbors.push(i + 5);
            if (col > 0) neighbors.push(i - 1);
            if (col < 4) neighbors.push(i + 1);
            return neighbors.some(n => unlocked.includes(n));
        });
    }

    /** 개척 시작 */
    startPioneering(cellIndex, heroId) {
        const base = this.store.getState('base');
        if (base.pioneering) return { success: false, reason: '이미 개척 중' };
        if (base.unlockedCells.includes(cellIndex)) return { success: false, reason: '이미 해금된 셀' };

        const available = this.getAvailablePioneerCells();
        if (!available.includes(cellIndex)) return { success: false, reason: '인접한 해금 셀 없음' };

        const wood = this.store.getState('wood') || 0;
        const cost = this.balance.pioneer_cost_wood ?? 30;
        if (wood < cost) return { success: false, reason: '나무 부족' };

        this.store.setState('wood', wood - cost);
        const pioneerCost = this.balance.pioneer_build_cost ?? 30;
        base.pioneering = { cellIndex, assignedHeroId: heroId, progress: 0, buildCost: pioneerCost };
        this.store.setState('base', { ...base });
        return { success: true, cellIndex };
    }

    /** 턴 처리: 개척 진행도 (힘+체력)/2 */
    processPioneerTurn() {
        const base = this.store.getState('base');
        if (!base.pioneering) return null;

        const heroes = this.store.getState('heroes') || [];
        const hero = heroes.find(h => h.id === base.pioneering.assignedHeroId);
        const pioneerPower = hero
            ? Math.floor((hero.stats.strength + hero.stats.vitality) / 2)
            : 1;

        base.pioneering.progress += pioneerPower;

        if (base.pioneering.progress >= base.pioneering.buildCost) {
            const completed = base.pioneering;
            base.unlockedCells.push(completed.cellIndex);
            base.pioneering = null;
            this.store.setState('base', { ...base });
            return { type: 'complete', cellIndex: completed.cellIndex };
        }

        this.store.setState('base', { ...base });
        return { type: 'progress', progress: base.pioneering.progress, buildCost: base.pioneering.buildCost };
    }

    isCellUnlocked(cellIndex) {
        const base = this.store.getState('base');
        return base.unlockedCells.includes(cellIndex);
    }

    // ─── 방어 배치 ───

    /** 방어 임무에 영웅 배치 */
    assignDefense(heroId) {
        const base = this.store.getState('base');
        if (!base.defenseHeroIds.includes(heroId)) {
            base.defenseHeroIds.push(heroId);
            this.store.setState('base', { ...base });
        }
    }

    /** 방어 임무에서 영웅 해제 */
    unassignDefense(heroId) {
        const base = this.store.getState('base');
        base.defenseHeroIds = base.defenseHeroIds.filter(id => id !== heroId);
        this.store.setState('base', { ...base });
    }

    /** 방어 배치된 영웅 ID 목록 */
    getDefenseHeroIds() {
        const base = this.store.getState('base');
        return base.defenseHeroIds || [];
    }

    /** 턴 종료 시 방어 배치 초기화 */
    clearDefenseAssignments() {
        const base = this.store.getState('base');
        base.defenseHeroIds = [];
        this.store.setState('base', { ...base });
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

        const raidDivisor = this.balance.raid_scale_divisor ?? 3;
        const scale = Math.floor(day / raidDivisor) + 1;
        const enemyCount = scale + 1;
        const smallMax = this.balance.raid_scale_small ?? 2;
        const mediumMax = this.balance.raid_scale_medium ?? 4;
        const sizeDesc = scale <= smallMax ? '소규모' : scale <= mediumMax ? '중규모' : '대규모';

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
                hero.recoveryTurns = (hero.recoveryTurns || (this.balance.recovery_default_turns ?? 2)) - 1;
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

    assignHeroToBuilding(facilityId, heroId) {
        const base = this.store.getState('base');
        const building = (base.buildings || []).find(b => b.facilityId === facilityId);
        if (!building) return { success: false, reason: '건설중인 시설 없음' };
        if (building.assignedHeroId) return { success: false, reason: '이미 영웅 배정됨' };
        building.assignedHeroId = heroId;
        this.store.setState('base', { ...base });
        return { success: true };
    }

    getCurrentBuildings() { return this.store.getState('base').buildings || []; }
    getCurrentResearch() { return this.store.getState('base').researching; }
    getCurrentPioneering() { return this.store.getState('base').pioneering; }
}

export default BaseManager;
