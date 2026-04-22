/**
 * 세이브/로드 — LocalStorage
 */

const SAVE_KEY = 'theseven_save';

const SaveManager = {
    save(store) {
        const state = {
            heroes: store.getState('heroes'),
            turn: store.getState('turn'),
            gold: store.getState('gold'),
            food: store.getState('food'),
            wood: store.getState('wood'),
            inventory: store.getState('inventory'),
            base: store.getState('base'),
            expedition: store.getState('expedition'),
            edict: store.getState('edict'),
            pendingCriticalEvents: store.getState('pendingCriticalEvents'),
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        return true;
    },

    load() {
        const raw = localStorage.getItem(SAVE_KEY);
        return raw ? JSON.parse(raw) : null;
    },

    restore(store, saveData) {
        if (!saveData) return false;
        if (saveData.heroes) {
            // 2026-04-21 마이그레이션: 기존 세이브에 bonds 필드가 없을 수 있음
            saveData.heroes.forEach(h => {
                if (!h.bonds || typeof h.bonds !== 'object') h.bonds = {};
            });
            store.setState('heroes', saveData.heroes);
        }
        if (saveData.turn) store.setState('turn', saveData.turn);
        if (saveData.gold !== undefined) store.setState('gold', saveData.gold);
        if (saveData.base) {
            // 마이그레이션: building(단수) → buildings(배열)
            if (saveData.base.building !== undefined && !saveData.base.buildings) {
                saveData.base.buildings = saveData.base.building ? [saveData.base.building] : [];
                delete saveData.base.building;
            }
            // 2026-04-17: policies 필드 제거. 기존 세이브에 남아있으면 무시
            if (saveData.base.policies !== undefined) {
                delete saveData.base.policies;
            }
            store.setState('base', saveData.base);
        }
        if (saveData.expedition) store.setState('expedition', saveData.expedition);
        if (saveData.food !== undefined) store.setState('food', saveData.food);
        if (saveData.wood !== undefined) store.setState('wood', saveData.wood);
        if (saveData.inventory) store.setState('inventory', saveData.inventory);
        if (saveData.edict !== undefined) store.setState('edict', saveData.edict);
        if (saveData.pendingCriticalEvents) store.setState('pendingCriticalEvents', saveData.pendingCriticalEvents);
        // 2026-04-17: saveData.playerSins는 로드 시 단순 무시 (바알 죄종 수치 시스템 폐기)
        return true;
    },

    hasSave() {
        return localStorage.getItem(SAVE_KEY) !== null;
    },

    deleteSave() {
        localStorage.removeItem(SAVE_KEY);
    }
};

export default SaveManager;
