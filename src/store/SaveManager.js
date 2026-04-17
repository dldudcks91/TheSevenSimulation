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
            playerSins: store.getState('playerSins'),
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
        if (saveData.heroes) store.setState('heroes', saveData.heroes);
        if (saveData.turn) store.setState('turn', saveData.turn);
        if (saveData.gold !== undefined) store.setState('gold', saveData.gold);
        if (saveData.base) {
            // 마이그레이션: building(단수) → buildings(배열)
            if (saveData.base.building !== undefined && !saveData.base.buildings) {
                saveData.base.buildings = saveData.base.building ? [saveData.base.building] : [];
                delete saveData.base.building;
            }
            store.setState('base', saveData.base);
        }
        if (saveData.expedition) store.setState('expedition', saveData.expedition);
        if (saveData.food !== undefined) store.setState('food', saveData.food);
        if (saveData.wood !== undefined) store.setState('wood', saveData.wood);
        if (saveData.inventory) store.setState('inventory', saveData.inventory);
        if (saveData.playerSins) store.setState('playerSins', saveData.playerSins);
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
