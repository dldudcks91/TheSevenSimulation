/**
 * Central Store (pub/sub 패턴)
 * 게임 상태 관리 — game_logic과 scenes 간 통신 허브
 */
class Store {
    constructor() {
        this._state = {};
        this._listeners = new Map();
    }

    getState(key) {
        return this._state[key];
    }

    setState(key, value) {
        this._state[key] = value;
        this._notify(key);
    }

    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);
        return () => this._unsubscribe(key, callback);
    }

    _notify(key) {
        const listeners = this._listeners.get(key) || [];
        listeners.forEach(cb => cb(this._state[key]));
    }

    _unsubscribe(key, callback) {
        const listeners = this._listeners.get(key) || [];
        this._listeners.set(key, listeners.filter(cb => cb !== callback));
    }
}

export default new Store();
