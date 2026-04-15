/**
 * MapScene — 코디네이터
 * 모든 페이즈를 하나의 씬에서 처리하는 단일 맵 뷰.
 * 실제 로직/렌더링은 map/ 하위 모듈에 위임.
 *
 * 레이아웃 (1280x720):
 *   상단 HUD:     1280 x 32
 *   맵 영역:      1280 x 440 뷰포트
 *   하단 UI 패널:  1280 x 248 (탭 32px + 콘텐츠 216px)
 */
import store from '../store/Store.js';
import TurnManager from '../game_logic/TurnManager.js';
import HeroManager from '../game_logic/HeroManager.js';
import EventSystem from '../game_logic/EventSystem.js';
import BaseManager from '../game_logic/BaseManager.js';
import SinSystem from '../game_logic/SinSystem.js';
import ExpeditionManager from '../game_logic/ExpeditionManager.js';
import SpriteComposer from '../game_logic/SpriteComposer.js';
import DayActions from '../game_logic/DayActions.js';
import TurnProcessor from '../game_logic/TurnProcessor.js';

import { C, HUD_H, MAP_VP_W, MAP_VP_H } from './map/MapConstants.js';
import MapWidgets from './map/MapWidgets.js';
import MapPopupSystem from './map/MapPopupSystem.js';
import MapHUD from './map/MapHUD.js';
import MapWorld from './map/MapWorld.js';
import MapBottomPanel from './map/MapBottomPanel.js';
import MapActions from './map/MapActions.js';
import MapTurnFlow from './map/MapTurnFlow.js';
import PopupsBuild from './map/popups/PopupsBuild.js';
import PopupsHero from './map/popups/PopupsHero.js';
import PopupsAction from './map/popups/PopupsAction.js';
import MapHeroInspector from './map/MapHeroInspector.js';

class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    preload() {
        this.load.image('map_bg', './assets/map_bg.png');

        // LPC 파츠 프리로드 (세이브 로드 시 HeroSelectScene을 건너뛰므로 여기서도 로드)
        const lpcParts = this.registry.get('lpcParts') || [];
        for (const part of lpcParts) {
            for (const action of ['walk', 'slash']) {
                const key = `lpc_${part.path}_${action}`.replace(/\//g, '_');
                if (!this.textures.exists(key)) {
                    this.load.image(key, `assets/${part.path}_${action}.png`);
                }
            }
        }

        const spriteTypes = [
            'warrior_male', 'warrior_female', 'base_male', 'base_female',
            'hero_wrath', 'hero_envy', 'hero_greed', 'hero_sloth',
            'hero_gluttony', 'hero_lust', 'hero_pride',
            'monster_slime', 'monster_bat', 'monster_snake', 'monster_ghost',
            'monster_eyeball', 'monster_pumpking', 'monster_bee', 'monster_worm',
            'boss_demon', 'boss_shadow',
        ];
        const actions = ['idle', 'walk', 'slash', 'hurt'];
        for (const type of spriteTypes) {
            for (const action of actions) {
                const key = `${type}_${action}`;
                if (!this.textures.exists(key)) {
                    this.load.spritesheet(key, `assets/sprites/${type}/${action}.png`, {
                        frameWidth: 64, frameHeight: 64
                    });
                }
            }
        }

        const bestiarySheets = [
            'monster_wolf', 'monster_goblin', 'monster_spider',
            'monster_bear', 'monster_lion', 'monster_deer',
            'monster_flower', 'monster_bigworm',
        ];
        for (const key of bestiarySheets) {
            if (!this.textures.exists(key)) {
                this.load.spritesheet(key, `assets/sprites/${key}/full.png`, {
                    frameWidth: 64, frameHeight: 64
                });
            }
        }
    }

    create() {
        // ─── game_logic 매니저 초기화 ───
        const heroData = this.registry.get('heroData');
        const eventsData = this.registry.get('eventsData');
        const facilitiesData = this.registry.get('facilitiesData');
        const balance = this.registry.get('balance') || {};
        const policies = this.registry.get('policies') || [];
        const phases = this.registry.get('phases') || [];
        const desertionEffects = this.registry.get('desertionEffects') || [];
        const stagesData = this.registry.get('stagesData') || {};

        this.balance = balance;
        this.turnManager = new TurnManager(store, phases);
        this.heroManager = new HeroManager(store, heroData, balance);
        const lpcParts = this.registry.get('lpcParts') || [];
        const spriteComposer = new SpriteComposer(lpcParts);
        this.heroManager.setSpriteComposer(spriteComposer);
        this.heroManager.setEpithets(this.registry.get('heroEpithets') || []);
        this.heroManager.setItemsData(this.registry.get('itemsData') || []);
        this.heroManager.setTraitsData(this.registry.get('traitsData') || []);
        this.eventSystem = new EventSystem(store, eventsData, balance);
        this.baseManager = new BaseManager(store, facilitiesData, policies, balance);
        this.sinSystem = new SinSystem(store, this.registry.get('sinRelations'), balance, desertionEffects);
        this.expeditionManager = new ExpeditionManager(store, balance);
        this.expeditionManager.setStagesData(stagesData);
        this.expeditionManager.setBattleMode('melee');

        // game_logic 순수 로직 (백테스팅 가능)
        this.dayActions = new DayActions(store, this.heroManager, balance);
        this.turnProcessor = new TurnProcessor(store, {
            turnManager: this.turnManager,
            heroManager: this.heroManager,
            baseManager: this.baseManager,
            sinSystem: this.sinSystem,
            expeditionManager: this.expeditionManager,
            balance
        });

        // ─── 초기 상태 ───
        const startingGold = balance.starting_gold ?? 500;
        const loaded = this.scene.settings.data?.loaded;
        if (!loaded) {
            if (!store.getState('heroes') || store.getState('heroes').length === 0) {
                store.setState('gold', startingGold);
                store.setState('food', balance.starting_food ?? 100);
                store.setState('wood', balance.starting_wood ?? 50);
                this.heroManager.initStartingHeroes();
            }
        }

        // ─── 씬 모듈 초기화 ───
        this.widgets = new MapWidgets(this);
        this.popupSystem = new MapPopupSystem(this);
        this.hud = new MapHUD(this);
        this.world = new MapWorld(this);
        this.bottomPanel = new MapBottomPanel(this);
        this.actions = new MapActions(this);
        this.turnFlow = new MapTurnFlow(this);
        this.popupsBuild = new PopupsBuild(this);
        this.popupsHero = new PopupsHero(this);
        this.popupsAction = new PopupsAction(this);
        this.heroInspector = new MapHeroInspector(this);

        // ─── 카메라 / 컨테이너 ───
        this.cameras.main.setBackgroundColor(C.bgPrimary);
        this.cameras.main.setBounds(0, 0, 1280, 720);
        this.cameras.main.setScroll(0, 0);

        this.mapContainer = this.add.container(0, HUD_H);
        const maskShape = this.make.graphics({ x: 0, y: 0 });
        maskShape.fillRect(0, HUD_H, MAP_VP_W, MAP_VP_H);
        this.mapContainer.setMask(new Phaser.Display.Masks.GeometryMask(this, maskShape));

        // ─── 렌더링 ───
        this.hud.draw();
        this.world.draw();
        this.bottomPanel.draw();

        // ─── Store 구독 ───
        this._unsubscribers = [
            store.subscribe('heroes', () => this.bottomPanel.refreshActiveTab()),
            store.subscribe('base', () => { this.world.updateBuildings(); this.bottomPanel.refreshActiveTab(); }),
            store.subscribe('gold', () => this.hud.updateResources()),
            store.subscribe('food', () => this.hud.updateResources()),
            store.subscribe('wood', () => this.hud.updateResources()),
            store.subscribe('soldiers', () => this.hud.updateSoldiers()),
        ];

        this.events.once('shutdown', () => this._cleanup());

        // ─── 초기 UI 갱신 ───
        this.hud.updateResources();
        this.hud.updateSoldiers();
        this.hud.updatePhaseDisplay();
        this.bottomPanel.switchTab('base');
        // this.world.initDebugMode();

        // ─── 게임 시작 ───
        if (!loaded) {
            this.turnFlow.startMorningPhase();
        } else {
            const turn = this.turnManager.getCurrentTurn();
            if (turn.phase === 'morning') this.turnFlow.startMorningPhase();
        }
    }

    _cleanup() {
        if (this._unsubscribers) {
            this._unsubscribers.forEach(unsub => unsub());
            this._unsubscribers = [];
        }
        if (this._defenseMode) {
            this._defenseMode.destroy();
            this._defenseMode = null;
        }
        if (this._huntPopup) {
            this._huntPopup.destroy();
            this._huntPopup = null;
        }
        if (this._actionPopup) {
            this._actionPopup.destroy();
            this._actionPopup = null;
        }
        if (this.heroInspector && this.heroInspector.active) {
            this.heroInspector.close();
        }
        for (const key of ['EventScene', 'ResultScene', 'SettlementScene']) {
            if (this.scene.isActive(key)) this.scene.stop(key);
        }
    }

    update(time, delta) {
        if (this._defenseMode && this._defenseMode.active) {
            this._defenseMode.update(time, delta);
        }
        if (this._huntPopup && this._huntPopup.active) {
            this._huntPopup.update(time, delta);
        }
        if (this._actionPopup && this._actionPopup.active) {
            this._actionPopup.update(time, delta);
        }
    }

    // ═══════════════════════════════════
    // 라우팅 (코디네이터 책임)
    // ═══════════════════════════════════

    /** 팝업 열기 — 기존 팝업 모두 닫고 새로 열기 */
    _showPopup(mode, data = {}) {
        // heroDetail은 인스펙터로 라우팅 (팝업 대신 맵 영역 오버레이)
        if (mode === 'heroDetail') {
            this.popupSystem.closeAllPopups();
            this.heroInspector.open(data.hero);
            return;
        }
        this.popupSystem.closeAllPopups();
        if (this.heroInspector.active) this.heroInspector.close();
        this._pushPopup(mode, data);
    }

    /** 팝업 쌓기 — 모드에 따라 해당 팝업 모듈 호출 */
    _pushPopup(mode, data = {}) {
        const rect = this.popupSystem.pushPopup(mode, data);
        const { px, py, pw, ph } = rect;

        switch (mode) {
            case 'build': this.popupsBuild.popupBuild(px, py, pw, ph); break;
            case 'research': this.popupsBuild.popupResearch(px, py, pw, ph); break;
            case 'facility': this.popupsBuild.popupFacility(px, py, pw, ph, data.facility); break;
            case 'buildingInfo': this.popupsBuild.popupBuildingInfo(px, py, pw, ph, data.building); break;
            case 'heroSelect': this.popupsHero.popupHeroSelect(px, py, pw, ph, data); break;
            case 'recruit': this.popupsHero.popupRecruit(px, py, pw, ph); break;
            case 'gather': this.popupsAction.popupGather(px, py, pw, ph); break;
            case 'lumber': this.popupsAction.popupLumber(px, py, pw, ph); break;
            case 'hunt': this.popupsAction.popupHunt(px, py, pw, ph); break;
            case 'pioneer': this.popupsAction.popupPioneer(px, py, pw, ph, data); break;
            case 'defense': this.popupsAction.popupDefense(px, py, pw, ph); break;
            case 'policy': this.popupsAction.popupPolicy(px, py, pw, ph); break;
            case '_confirm': this.popupsAction.popupConfirm(px, py, pw, ph, data); break;
        }
    }

    /** 행동 분기 — 패널 vs 팝업 라우팅 */
    _showPanelAction(mode, data = {}) {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;
        this.bottomPanel._actionMode = mode;
        this.bottomPanel._actionData = data;

        const popupModes = ['build', 'research', 'facility', 'policy', 'recruit', 'heroSelect', 'heroDetail', 'hunt', 'gather', 'lumber', 'pioneer', 'defense', 'buildingInfo'];
        // heroDetail은 _showPopup에서 인스펙터로 분기됨
        if (popupModes.includes(mode)) {
            this._showPopup(mode, data);
            return;
        }

        this.bottomPanel.clearPanel();
        switch (mode) {
            case 'expedition': this.bottomPanel.renderExpeditionAction(data.stageIndex); break;
            case 'expeditionList': this.bottomPanel.renderExpeditionListAction(); break;
            case 'soldierSelect': this.bottomPanel.renderSoldierSelectAction(data); break;
        }
    }

    _closePanelAction() {
        this.bottomPanel._actionMode = null;
        this.bottomPanel._actionData = null;
        this.popupSystem.closeAllPopups();
        this.bottomPanel.switchTab(this.bottomPanel._activeTab);
    }

    _showConfirmPopup(title, message, onConfirm) {
        this.popupSystem.closeAllPopups();
        this._pushPopup('_confirm', { title, message, onConfirm });
    }

    /** 턴 종료 (HUD 버튼에서 호출) */
    _onEndTurn() {
        this.turnFlow.onEndTurn();
    }
}

export default MapScene;
