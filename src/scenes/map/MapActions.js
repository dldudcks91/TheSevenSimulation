/**
 * 행동 UI 브릿지 — DayActions(game_logic) 호출 → UI 갱신
 */
import store from '../../store/Store.js';
import MapHuntPopup from '../MapHuntPopup.js';

class MapActions {
    constructor(scene) {
        this.scene = scene;
    }

    doGather(hero) {
        this.scene.dayActions.doGather(hero);
        this.scene.bottomPanel._actionMode = null;
        this.scene.bottomPanel._actionData = null;
        this.scene.hud.updateResources();
        this.scene.bottomPanel.refreshActiveTab();
    }

    doLumber(hero) {
        this.scene.dayActions.doLumber(hero);
        this.scene.bottomPanel._actionMode = null;
        this.scene.bottomPanel._actionData = null;
        this.scene.hud.updateResources();
        this.scene.bottomPanel.refreshActiveTab();
    }

    doFeast() {
        const result = this.scene.dayActions.doFeast();
        if (!result.success) return;
        this.scene.popupSystem.closeAllPopups();
        this.scene.bottomPanel._actionMode = null;
        this.scene.bottomPanel._actionData = null;
        this.scene.bottomPanel.refreshActiveTab();
        this.scene.hud.updateResources();
    }

    doStabilize() {
        this.scene.dayActions.doStabilize();
        this.scene.popupSystem.closeAllPopups();
        this.scene.bottomPanel._actionMode = null;
        this.scene.bottomPanel._actionData = null;
        this.scene.bottomPanel.refreshActiveTab();
    }

    launchHunt(hero) {
        const s = this.scene;
        const turn = store.getState('turn');
        const day = (turn && turn.day) || 1;
        const huntEnemies = s.registry.get('huntEnemies') || [];

        hero.status = 'hunt';
        store.setState('heroes', [...s.heroManager.getHeroes()]);

        const encounter = s.dayActions.createHuntEncounter(huntEnemies, day);
        if (!encounter) return;

        s._huntPopup = new MapHuntPopup(s, {
            hero,
            enemy: encounter.enemy,
            balance: s.balance,
            stageName: encounter.stageName,
            onComplete: (result) => {
                s._huntPopup = null;
                s.dayActions.applyHuntResult(hero, result.victory, encounter.goldReward);
                s.bottomPanel.refreshActiveTab();
                s.hud.updateResources();
            }
        });
        s._huntPopup.start();
    }
}

export default MapActions;
