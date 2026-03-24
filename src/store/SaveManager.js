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
            base: store.getState('base'),
            expedition: store.getState('expedition'),
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
        if (saveData.base) store.setState('base', saveData.base);
        if (saveData.expedition) store.setState('expedition', saveData.expedition);
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
