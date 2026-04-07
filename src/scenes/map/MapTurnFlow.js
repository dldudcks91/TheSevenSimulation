/**
 * 턴 진행 UI 오케스트레이션 — TurnProcessor(game_logic) 호출 → 씬 전환
 */
import store from '../../store/Store.js';
import SaveManager from '../../store/SaveManager.js';
import MorningReport from '../../game_logic/MorningReport.js';
import MorningReportPopup from '../MorningReportPopup.js';
import MapDefenseMode from '../MapDefenseMode.js';
import { BATTLE_MODES } from '../../game_logic/BattleEngine.js';
import { topSin } from '../../game_logic/SinUtils.js';

class MapTurnFlow {
    constructor(scene) {
        this.scene = scene;
    }

    startMorningPhase() {
        const s = this.scene;
        SaveManager.save(store);
        s.hud.updatePhaseDisplay();

        const turn = s.turnManager.getCurrentTurn();
        const morningReport = new MorningReport(s.balance);
        const heroes = s.heroManager.getHeroes().filter(h => h.status !== 'dead');
        const raidInfo = s.baseManager.getRaidInfo(turn.day);
        const reportData = morningReport.generate(heroes, raidInfo);

        s.registry.set('currentDay', turn.day);

        s._morningReportPopup = new MorningReportPopup(s, reportData, () => {
            s._morningReportPopup = null;
            const events = s.eventSystem.generateEvents();
            if (events.length > 0) {
                this._eventQueue = [...events];
                this._showNextEvent();
            } else {
                s.turnManager.advancePhase();
                s.hud.updatePhaseDisplay();
            }
        });
        s._morningReportPopup.show();
    }

    _showNextEvent() {
        const s = this.scene;
        if (this._eventQueue.length === 0) {
            s.turnManager.advancePhase();
            s.hud.updatePhaseDisplay();
            return;
        }
        const evt = this._eventQueue.shift();
        s.scene.launch('EventScene', {
            event: evt, eventSystem: s.eventSystem,
            onComplete: () => {
                s.bottomPanel.refreshActiveTab();
                s.hud.updateResources();
                s.time.delayedCall(300, () => this._showNextEvent());
            }
        });
    }

    onEndTurn() {
        const s = this.scene;
        if (s.turnManager.getCurrentTurn().phase !== 'day') return;

        const defenseCount = s.baseManager.getDefenseHeroIds().length;
        if (defenseCount === 0) {
            s._showConfirmPopup(
                '⚠️ 방어 인원 없음',
                '방어에 배치된 영웅이 없습니다.\n습격 시 무방비 상태로 패배합니다.\n\n그래도 턴을 종료하시겠습니까?',
                () => this._doEndTurn()
            );
            return;
        }
        this._doEndTurn();
    }

    _doEndTurn() {
        const s = this.scene;
        s.turnProcessor.processDayPhase();
        s.world.updateBuildings();
        SaveManager.save(store);
        s.turnManager.advancePhase();
        s.hud.updatePhaseDisplay();
        this._processEveningPhase();
    }

    _processEveningPhase() {
        const s = this.scene;
        const expResult = s.turnProcessor.resolveExpedition();
        if (expResult) {
            s.scene.launch('ResultScene', {
                expeditionResult: expResult, turn: s.turnManager.getCurrentTurn(), baseManager: s.baseManager,
                onComplete: () => {
                    s.bottomPanel.refreshActiveTab();
                    s.hud.updateResources();
                    if (expResult.isBoss && expResult.victory) {
                        s.scene.start('GameOverScene', { reason: 'victory', day: s.turnManager.getCurrentTurn().day });
                        return;
                    }
                    this._startNightPhase();
                }
            });
        } else {
            this._startNightPhase();
        }
    }

    _startNightPhase() {
        const s = this.scene;
        SaveManager.save(store);
        s.turnManager.advancePhase();
        s.hud.updatePhaseDisplay();
        this._processNightPhase();
    }

    _processNightPhase() {
        const s = this.scene;
        s.turnProcessor.applyPolicyMorale();
        const turn = s.turnManager.getCurrentTurn();

        if (!s.turnProcessor.shouldRaid(turn.day)) {
            this._finishNightPhase(turn, null);
            return;
        }

        const baseHeroes = s.turnProcessor.getDefenseParty();
        const soldiers = store.getState('soldiers') || 0;
        const heroData = baseHeroes.map(h => ({ id: h.id, name: h.name, primarySin: topSin(h.sinStats), appearance: h.appearance || null }));

        if (baseHeroes.length === 0 && soldiers === 0) {
            this._finishNightPhase(turn, { victory: false, reason: 'no_defenders', log: [], soldiersLost: 0 });
            return;
        }

        const enemies = s.turnProcessor.generateRaidEnemies(turn.day);
        const engine = s.turnProcessor.createDefenseEngine(baseHeroes, enemies, soldiers);
        const cards = s.registry.get('battleCards') || [];

        s._defenseMode = new MapDefenseMode(s, {
            engine,
            heroData,
            reserveHeroes: [],
            stageName: `밤 습격 — ${turn.day}일차`,
            cards,
            onComplete: (victory) => {
                s._defenseMode = null;

                const result = engine.getResult();
                const heroes = s.heroManager.store.getState('heroes') || [];
                for (const hr of result.heroResults) {
                    const hero = heroes.find(h => h.id === hr.id);
                    if (hero && !hr.alive) hero.status = 'injured';
                }
                s.heroManager.store.setState('heroes', [...heroes]);
                store.setState('soldiers', result.soldiersSurvived || 0);

                const defenseResult = {
                    victory,
                    heroResults: result.heroResults,
                    soldiersDeployed: result.soldiersDeployed || 0,
                    soldiersSurvived: result.soldiersSurvived || 0,
                    soldiersLost: result.soldiersLost || 0,
                    rounds: result.rounds,
                    log: result.log,
                    enemyCount: enemies.length
                };

                this._finishNightPhase(turn, defenseResult);
            }
        });
        s._defenseMode.start();
    }

    _finishNightPhase(turn, defenseResult) {
        const s = this.scene;
        const { extremeResults, gameOver } = s.turnProcessor.finishNightPhase(turn, defenseResult);

        s.scene.launch('SettlementScene', {
            defenseResult: defenseResult || { victory: true, noRaid: true },
            extremeResults, turn, heroes: s.heroManager.getHeroes(),
            onComplete: () => {
                s.bottomPanel.refreshActiveTab();
                s.hud.updateResources();
                s.hud.updateSoldiers();
                s.world.updateBuildings();
                if (gameOver) {
                    s.scene.start('GameOverScene', { reason: 'defeat', day: turn.day, details: '모든 영웅이 떠났습니다.' });
                    return;
                }
                SaveManager.save(store);
                s.turnManager.advancePhase();
                s.hud.updatePhaseDisplay();
                this.startMorningPhase();
            }
        });
    }
}

export default MapTurnFlow;
