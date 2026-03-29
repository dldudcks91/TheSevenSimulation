/**
 * 단일 맵 뷰 — 가로 스크롤 거점 + 하단 UI 패널
 * MainScene을 대체. 모든 페이즈를 하나의 씬에서 처리.
 *
 * 레이아웃 (1280x720):
 *   상단 HUD:     1280 x 32
 *   맵 영역:      1280 x 440 뷰포트, 2560 x 440 월드 (카메라 스크롤)
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
import SaveManager from '../store/SaveManager.js';
import MapDefenseMode from './MapDefenseMode.js';
import MapHuntPopup from './MapHuntPopup.js';
import BattleEngine, { BATTLE_MODES } from '../game_logic/BattleEngine.js';
import { FONT, FONT_BOLD } from '../constants.js';

// ═══ 색상 ═══
const C = {
    bgPrimary: 0x0a0a12, bgSecondary: 0x12121e, bgTertiary: 0x1a1a2a,
    cardBg: 0x161624, inputBg: 0x0e0e1a,
    borderPrimary: 0x303048, borderSecondary: 0x484868,
    borderHighlight: 0x6868a0, borderLight: 0xa0a0c0, borderDark: 0x18182a,
    textPrimary: '#e8e8f0', textSecondary: '#a0a0c0', textMuted: '#606080',
    accentRed: '#e03030', expYellow: '#f8c830', infoCyan: '#40a0f8',
    successGreen: '#40d870', warningOrange: '#f8b830',
    ground: 0x1a2a1a, grass: 0x2a3a2a, wall: 0x484858, gate: 0x6a5a3a,
    building: 0x2a2a3a, buildingHover: 0x3a3a4a, emptySlot: 0x1e1e2e
};

const SIN_COLOR_HEX = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0'
};

const MORALE_COLORS_HEX = {
    desertion: '#f04040', unhappy: '#f8b830', stable: '#a0a0c0',
    elevated: '#40d870', rampage: '#e03030'
};

const ACTION_STATS = {
    build: { primary: ['strength', 'vitality'], label: '건설' },
    research: { primary: ['intellect', 'perception'], label: '연구' },
    hunt: { primary: ['strength', 'agility'], label: '사냥' }
};

// ═══ 레이아웃 ═══
const HUD_H = 32;
const MAP_VP_W = 1280;   // 맵 뷰포트 폭 (화면 전폭)
const MAP_VP_H = 440;    // 맵 뷰포트 높이
const MAP_WORLD_W = 1280; // 맵 월드 폭 = 화면 폭 (스크롤 없음)
const MAP_WORLD_H = MAP_VP_H;
const PANEL_Y = HUD_H + MAP_VP_H; // 472
const PANEL_H = 248;
const PANEL_TAB_H = 32;
const PANEL_CONTENT_Y = PANEL_Y + PANEL_TAB_H; // 504
const PANEL_CONTENT_H = PANEL_H - PANEL_TAB_H; // 216

// 맵 영역 구간 (1280 안에 배치)
const ZONE_INSIDE_END = 680;   // 영내: 0~680
const ZONE_OUTSIDE_START = 680; // 영외: 680~1280

// 탭 정의
const TABS = [
    { id: 'base', icon: '🏰', label: '시설' },
    { id: 'hero', icon: '⚔', label: '영웅' },
    { id: 'item', icon: '🎒', label: '아이템' },
    { id: 'expedition', icon: '🗺', label: '원정' },
    { id: 'policy', icon: '📜', label: '정책' },
];

// 건물 슬롯 — 이미지 좌측 성벽 안 5x5 그리드 (디버그로 확정)
const GRID_X = 34;
const GRID_Y = 70;
const GRID_COLS = 5;
const GRID_ROWS = 5;
const CELL_W = 65;
const CELL_H = 65;
const CELL_GAP = 4;

const BUILDING_SLOTS = [];
for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
        BUILDING_SLOTS.push({
            x: GRID_X + c * (CELL_W + CELL_GAP) + CELL_W / 2,
            y: GRID_Y + r * (CELL_H + CELL_GAP) + CELL_H / 2,
        });
    }
}
const PLAZA_INDEX = 12; // 중앙 (2,2)

// 영외 행동 슬롯 (가운데 상단, 4개 나란히)
const _OS_GAP = 10;
const _OS_W = 100;
const _OS_COUNT = 5;
const _OS_TOTAL = _OS_COUNT * _OS_W + (_OS_COUNT - 1) * _OS_GAP;
const _OS_START_X = (1280 - _OS_TOTAL) / 2 + _OS_W / 2;
const _OS_Y = 60;
const OUTSIDE_SLOTS = [
    { x: _OS_START_X + 0 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🛡️', title: '방어 배치', color: 0x4080e0, colorHex: '#4080e0', action: 'defense' },
    { x: _OS_START_X + 1 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🌿', title: '채집', color: 0x30b050, colorHex: '#30b050', action: 'gather' },
    { x: _OS_START_X + 2 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🪓', title: '벌목', color: 0x8a6a3a, colorHex: '#8a6a3a', action: 'lumber' },
    { x: _OS_START_X + 3 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🏹', title: '사냥', color: 0xd0a020, colorHex: '#d0a020', action: 'hunt' },
    { x: _OS_START_X + 4 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '⚔️', title: '원정', color: 0xe03030, colorHex: '#e03030', action: 'expeditionList' },
];

class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
        this._activeTab = 'base';
        this._panelElements = [];
        this._mapElements = [];
    }

    preload() {
        // 맵 배경 이미지
        this.load.image('map_bg', './assets/map_bg.png');

        // 방어전/사냥용 몬스터 + 영웅 스프라이트
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
    }

    create() {
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
        this.eventSystem = new EventSystem(store, eventsData, balance);
        this.baseManager = new BaseManager(store, facilitiesData, policies, balance);
        this.sinSystem = new SinSystem(store, this.registry.get('sinRelations'), balance, desertionEffects);
        this.expeditionManager = new ExpeditionManager(store, balance);
        this.expeditionManager.setStagesData(stagesData);
        const battleSceneKey = this.registry.get('battleScene') || 'BattleSceneB';
        this.expeditionManager.setBattleMode(battleSceneKey === 'BattleSceneA' ? 'melee' : 'tag');

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

        this.cameras.main.setBackgroundColor(C.bgPrimary);
        this.cameras.main.setBounds(0, 0, 1280, 720);
        this.cameras.main.setScroll(0, 0);

        // 맵 컨테이너 (스크롤 대상) — 화면 좌표 (0, HUD_H)에 배치
        this.mapContainer = this.add.container(0, HUD_H);

        // 맵 마스크: HUD~패널 사이만 보이도록
        const maskShape = this.make.graphics({ x: 0, y: 0 });
        maskShape.fillRect(0, HUD_H, MAP_VP_W, MAP_VP_H);
        this.mapContainer.setMask(new Phaser.Display.Masks.GeometryMask(this, maskShape));

        this._drawHUD();
        this._drawMapWorld();
        this._drawBottomPanel();

        this._unsubscribers = [
            store.subscribe('heroes', () => this._refreshActiveTab()),
            store.subscribe('base', () => { this._updateBuildings(); this._refreshActiveTab(); }),
            store.subscribe('gold', () => this._updateResources()),
            store.subscribe('food', () => this._updateResources()),
            store.subscribe('wood', () => this._updateResources()),
            store.subscribe('soldiers', () => this._updateSoldiers()),
        ];

        // 씬 종료 시 리소스 정리
        this.events.once('shutdown', () => this._cleanup());

        this._updateResources();
        this._updateSoldiers();
        this._updatePhaseDisplay();
        this._switchTab('base');

        if (!loaded) {
            this._startMorningPhase();
        } else {
            const turn = this.turnManager.getCurrentTurn();
            if (turn.phase === 'morning') this._startMorningPhase();
        }

    }

    /** 씬 종료 시 리소스 정리 */
    _cleanup() {
        // store 구독 해제
        if (this._unsubscribers) {
            this._unsubscribers.forEach(unsub => unsub());
            this._unsubscribers = [];
        }
        // 방어전/사냥 모듈 정리
        if (this._defenseMode) {
            this._defenseMode.destroy();
            this._defenseMode = null;
        }
        if (this._huntPopup) {
            this._huntPopup.destroy();
            this._huntPopup = null;
        }
        // 오버레이 씬 정리
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
    }

    // 스크롤 없음 — 1280 한 화면에 모두 표시

    // ═══════════════════════════════════
    // 상단 HUD (32px, 고정)
    // ═══════════════════════════════════
    _drawHUD() {
        const width = 1280;
        const g = this.add.graphics().setDepth(200);
        g.fillStyle(C.bgSecondary, 1);
        g.fillRect(0, 0, width, HUD_H);
        g.lineStyle(1, C.borderDark);
        g.lineBetween(0, HUD_H - 1, width, HUD_H - 1);
        g.lineStyle(2, C.borderSecondary);
        g.lineBetween(0, HUD_H, width, HUD_H);

        this.add.text(10, HUD_H / 2, 'THE SEVEN', {
            fontSize: '13px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 1, offsetY: 1, color: '#400000', blur: 0, fill: true }
        }).setOrigin(0, 0.5).setDepth(201);

        const sep1 = this.add.graphics().setDepth(201);
        sep1.lineStyle(1, C.borderPrimary);
        sep1.lineBetween(100, 6, 100, HUD_H - 6);

        this.dayText = this.add.text(114, HUD_H / 2, '', {
            fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
        }).setOrigin(0, 0.5).setDepth(201);

        this.phaseText = this.add.text(200, HUD_H / 2, '', {
            fontSize: '13px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0, 0.5).setDepth(201);

        const sep2 = this.add.graphics().setDepth(201);
        sep2.lineStyle(1, C.borderPrimary);
        sep2.lineBetween(290, 6, 290, HUD_H - 6);

        this.foodText = this.add.text(306, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT_BOLD, color: '#80d040'
        }).setOrigin(0, 0.5).setDepth(201);

        this.woodText = this.add.text(380, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT_BOLD, color: '#c89050'
        }).setOrigin(0, 0.5).setDepth(201);

        this.goldText = this.add.text(454, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT_BOLD, color: C.expYellow
        }).setOrigin(0, 0.5).setDepth(201);

        this.defenseText = this.add.text(540, HUD_H / 2, '', {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0, 0.5).setDepth(201);

        this.soldierText = this.add.text(640, HUD_H / 2, '', {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0, 0.5).setDepth(201);

        this._drawNavButton(width - 200, 4, 65, HUD_H - 8, '턴 종료', C.accentRed, () => this._onEndTurn());
        this._drawNavButton(width - 128, 4, 45, HUD_H - 8, '저장', C.textMuted, () => { SaveManager.save(store); });

        // 전투씬 A/B 전환
        const currentScene = this.registry.get('battleScene') || 'BattleSceneA';
        const btnLabel = currentScene === 'BattleSceneA' ? '전투:A' : '전투:B';
        this._battleToggleBtn = this.add.text(width - 68, HUD_H / 2, `[${btnLabel}]`, {
            fontSize: '10px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(201);
        this._battleToggleBtn.on('pointerdown', () => {
            const cur = this.registry.get('battleScene') || 'BattleSceneA';
            const next = cur === 'BattleSceneA' ? 'BattleSceneB' : 'BattleSceneA';
            this.registry.set('battleScene', next);
            this.expeditionManager.setBattleMode(next === 'BattleSceneA' ? 'melee' : 'tag');
            this._battleToggleBtn.setText(`[${next === 'BattleSceneA' ? '전투:A' : '전투:B'}]`);
        });

        const settingsIcon = this.add.text(width - 24, HUD_H / 2, '⚙', {
            fontSize: '18px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(201);
        settingsIcon.on('pointerover', () => settingsIcon.setColor(C.textPrimary));
        settingsIcon.on('pointerout', () => settingsIcon.setColor(C.textMuted));
    }

    _drawNavButton(x, y, w, h, label, accentColor, callback) {
        const bg = this.add.graphics().setDepth(201);
        bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, C.borderSecondary); bg.strokeRect(x, y, w, h);

        const text = this.add.text(x + w / 2, y + h / 2, label, {
            fontSize: '11px', fontFamily: FONT, color: accentColor
        }).setOrigin(0.5).setDepth(201);

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
            .setInteractive({ useHandCursor: true }).setDepth(201);
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);
            text.setColor('#ffffff');
        });
        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(1, C.borderSecondary); bg.strokeRect(x, y, w, h);
            text.setColor(accentColor);
        });
        zone.on('pointerdown', callback);
    }

    // ═══════════════════════════════════
    // 맵 월드 (2560x440, mapContainer 안에 배치)
    // ═══════════════════════════════════
    _drawMapWorld() {
        const mc = this.mapContainer;

        // 배경 이미지 (높이 기준 비율 유지, 가로는 맵 폭에 맞춤)
        if (this.textures.exists('map_bg')) {
            const bgImg = this.add.image(0, 0, 'map_bg').setOrigin(0, 0);
            const tex = this.textures.get('map_bg').getSourceImage();
            const scale = MAP_WORLD_H / tex.height;
            bgImg.setScale(scale);
            mc.add(bgImg);
        } else {
            const ground = this.add.graphics();
            ground.fillStyle(C.ground, 1);
            ground.fillRect(0, 0, MAP_WORLD_W, MAP_WORLD_H);
            for (let i = 0; i < 80; i++) {
                ground.fillStyle(C.grass, 0.3 + Math.random() * 0.3);
                ground.fillRect(20 + Math.random() * (ZONE_INSIDE_END - 40), 10 + Math.random() * (MAP_WORLD_H - 20), 2, 2);
            }
            ground.fillStyle(0x152015, 0.5);
            ground.fillRect(ZONE_OUTSIDE_START, 0, MAP_WORLD_W - ZONE_OUTSIDE_START, MAP_WORLD_H);
            for (let i = 0; i < 30; i++) {
                const tx = ZONE_OUTSIDE_START + 50 + Math.random() * (MAP_WORLD_W - ZONE_OUTSIDE_START - 100);
                const ty = 30 + Math.random() * (MAP_WORLD_H - 60);
                ground.fillStyle(0x1a3a1a, 0.6);
                ground.fillTriangle(tx, ty - 20, tx - 12, ty + 10, tx + 12, ty + 10);
                ground.fillStyle(0x3a2a1a, 0.8);
                ground.fillRect(tx - 2, ty + 10, 4, 8);
            }
            mc.add(ground);
        }

        // 영내 건물 슬롯 — 5x5 반투명 그리드 (초기 3x3 해금, 나머지 잠금)
        const hw = CELL_W / 2;
        const hh = CELL_H / 2;
        this.buildingSlots = [];
        BUILDING_SLOTS.forEach((slot, i) => {
            if (i === PLAZA_INDEX) { this._drawPlaza(slot.x, slot.y); return; }
            const slotContainer = this.add.container(slot.x, slot.y);
            const bg = this.add.graphics();
            const isUnlocked = this.baseManager.isCellUnlocked(i);
            if (isUnlocked) {
                this._drawSlotBg(bg, hw, hh, C.emptySlot, 0.35);
            } else {
                this._drawSlotBg(bg, hw, hh, 0x0a0a0a, 0.6, 0x303030);
            }
            slotContainer.add(bg);
            const nameText = this.add.text(0, -8, isUnlocked ? '+건설' : '🔒', { fontSize: '10px', fontFamily: FONT, color: isUnlocked ? C.textMuted : '#505050' }).setOrigin(0.5);
            slotContainer.add(nameText);
            const statusText = this.add.text(0, 8, '', { fontSize: '8px', fontFamily: FONT, color: C.textSecondary }).setOrigin(0.5);
            slotContainer.add(statusText);
            const heroText = this.add.text(0, 22, '', { fontSize: '8px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5);
            slotContainer.add(heroText);
            const zone = this.add.zone(0, 0, CELL_W, CELL_H).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => { this._drawSlotBg(bg, hw, hh, C.buildingHover, 0.5, 0xe03030); });
            zone.on('pointerout', () => { this._updateSlotAppearance(i); });
            zone.on('pointerdown', () => { this._onSlotClick(i); });
            slotContainer.add(zone);
            mc.add(slotContainer);
            this.buildingSlots.push({ bg, nameText, statusText, heroText, slotIndex: i });
        });

        // 영외 행동 슬롯 (건물 슬롯과 동일 반투명 스타일)
        const OS_W = 100;
        const OS_H = 80;
        const osHw = OS_W / 2;
        const osHh = OS_H / 2;
        OUTSIDE_SLOTS.forEach((slot) => {
            const container = this.add.container(slot.x, slot.y);

            const bg = this.add.graphics();
            this._drawSlotBg(bg, osHw, osHh, C.emptySlot, 0.3);
            container.add(bg);

            const iconT = this.add.text(0, -14, slot.icon, { fontSize: '22px', fontFamily: FONT }).setOrigin(0.5);
            container.add(iconT);

            const titleT = this.add.text(0, 16, slot.title, {
                fontSize: '10px', fontFamily: FONT, color: slot.colorHex,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5);
            container.add(titleT);

            const zone = this.add.zone(0, 0, OS_W, OS_H).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => { this._drawSlotBg(bg, osHw, osHh, C.buildingHover, 0.45, slot.color); });
            zone.on('pointerout', () => { this._drawSlotBg(bg, osHw, osHh, C.emptySlot, 0.3); });
            zone.on('pointerdown', () => { this._showPanelAction(slot.action); });
            container.add(zone);

            mc.add(container);
        });

        this._updateBuildings();
    }

    _drawPlaza(x, y) {
        const mc = this.mapContainer;
        const hw = CELL_W / 2, hh = CELL_H / 2;
        const g = this.add.graphics();
        g.fillStyle(0x2a1020, 0.45);
        g.fillRoundedRect(-hw, -hh, CELL_W, CELL_H, 3);
        g.lineStyle(1, 0xe03030, 0.4);
        g.strokeRoundedRect(-hw, -hh, CELL_W, CELL_H, 3);
        const container = this.add.container(x, y);
        container.add(g);
        container.add(this.add.text(0, -8, '바알', { fontSize: '12px', fontFamily: FONT_BOLD, color: C.accentRed, shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true } }).setOrigin(0.5));
        container.add(this.add.text(0, 10, '(판결자)', { fontSize: '8px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5));
        const zone = this.add.zone(0, 0, CELL_W, CELL_H).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => { this._showPanelAction('policy'); });
        container.add(zone);
        mc.add(container);
    }

    /** 반투명 슬롯 배경 그리기 */
    _drawSlotBg(bg, hw, hh, fillColor, alpha, borderColor) {
        bg.clear();
        bg.fillStyle(fillColor, alpha);
        bg.fillRoundedRect(-hw, -hh, hw * 2, hh * 2, 3);
        bg.lineStyle(1, borderColor || C.borderPrimary, 0.5);
        bg.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, 3);
    }


    // ═══════════════════════════════════
    // 하단 UI 패널 (고정)
    // ═══════════════════════════════════
    _drawBottomPanel() {
        // 패널 배경
        const panelBg = this.add.graphics().setDepth(200);
        panelBg.fillStyle(C.bgPrimary, 1);
        panelBg.fillRect(0, PANEL_Y, 1280, PANEL_H);
        panelBg.lineStyle(2, C.borderSecondary);
        panelBg.lineBetween(0, PANEL_Y, 1280, PANEL_Y);


        // 탭 바 배경
        const tabBg = this.add.graphics().setDepth(200);
        tabBg.fillStyle(C.bgSecondary, 1);
        tabBg.fillRect(0, PANEL_Y, 1280, PANEL_TAB_H);
        tabBg.lineStyle(1, C.borderSecondary);
        tabBg.lineBetween(0, PANEL_Y + PANEL_TAB_H, 1280, PANEL_Y + PANEL_TAB_H);

        this._tabButtons = [];
        const tabW = Math.floor(1280 / TABS.length);

        TABS.forEach((tab, i) => {
            const tx = i * tabW;
            const tw = i === TABS.length - 1 ? 1280 - tx : tabW;

            const bg = this.add.graphics().setDepth(201);
            const icon = this.add.text(tx + tw / 2 - 10, PANEL_Y + PANEL_TAB_H / 2, tab.icon, {
                fontSize: '13px', fontFamily: FONT
            }).setOrigin(0.5).setDepth(201);
            const label = this.add.text(tx + tw / 2 + 10, PANEL_Y + PANEL_TAB_H / 2, tab.label, {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0, 0.5).setDepth(201);

            if (i > 0) {
                const divG = this.add.graphics().setDepth(201);
                divG.lineStyle(1, C.borderPrimary);
                divG.lineBetween(tx, PANEL_Y + 4, tx, PANEL_Y + PANEL_TAB_H - 4);
            }

            const zone = this.add.zone(tx + tw / 2, PANEL_Y + PANEL_TAB_H / 2, tw, PANEL_TAB_H)
                .setInteractive({ useHandCursor: true }).setDepth(201);
            zone.on('pointerdown', () => this._switchTab(tab.id));

            this._tabButtons.push({ id: tab.id, bg, icon, label, x: tx, w: tw });
        });
    }

    _switchTab(tabId) {
        this._activeTab = tabId;
        this._actionMode = null;

        this._tabButtons.forEach(tb => {
            const isActive = tb.id === tabId;
            tb.bg.clear();
            if (isActive) {
                tb.bg.fillStyle(C.bgTertiary, 1);
                tb.bg.fillRect(tb.x, PANEL_Y, tb.w, PANEL_TAB_H);
                tb.bg.fillStyle(0xe03030, 1);
                tb.bg.fillRect(tb.x + 2, PANEL_Y + PANEL_TAB_H - 2, tb.w - 4, 2);
            } else {
                tb.bg.fillStyle(C.cardBg, 1);
                tb.bg.fillRect(tb.x, PANEL_Y, tb.w, PANEL_TAB_H);
            }
            tb.label.setColor(isActive ? C.textPrimary : C.textMuted);
        });

        this._clearPanel();
        switch (tabId) {
            case 'base': this._renderBaseTab(); break;
            case 'hero': this._renderHeroTab(); break;
            case 'item': this._renderItemTab(); break;
            case 'expedition': this._renderExpeditionTab(); break;
            case 'policy': this._renderPolicyTab(); break;
        }
    }

    _refreshActiveTab() {
        if (this._actionMode) {
            this._showPanelAction(this._actionMode, this._actionData);
        } else {
            this._clearPanel();
            this._switchTab(this._activeTab);
        }
    }

    _clearPanel() {
        this._panelElements.forEach(el => el.destroy());
        this._panelElements = [];
    }

    _p(element) {
        if (element) element.setDepth(202);
        this._panelElements.push(element);
        return element;
    }

    // ═══════════════════════════════════
    // 행동 분기
    // ═══════════════════════════════════
    _showPanelAction(mode, data = {}) {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;
        this._actionMode = mode;
        this._actionData = data;

        const popupModes = ['build', 'research', 'facility', 'policy', 'recruit', 'heroSelect', 'heroDetail', 'hunt', 'gather', 'lumber', 'pioneer', 'defense', 'buildingInfo'];
        if (popupModes.includes(mode)) {
            this._showPopup(mode, data);
            return;
        }

        this._clearPanel();
        switch (mode) {
            case 'expedition': this._renderExpeditionAction(data.stageIndex); break;
            case 'expeditionList': this._renderExpeditionListAction(); break;
            case 'soldierSelect': this._renderSoldierSelectAction(data); break;
        }
    }

    _closePanelAction() {
        this._actionMode = null;
        this._actionData = null;
        this._closeAllPopups();
        this._switchTab(this._activeTab);
    }

    // ═══════════════════════════════════
    // 중앙 팝업 시스템 (스택 기반)
    // ═══════════════════════════════════

    /** 팝업 열기 — 기존 팝업 모두 닫고 새로 열기 */
    _showPopup(mode, data = {}) {
        this._closeAllPopups();
        this._pushPopup(mode, data);
    }

    /** 팝업 쌓기 — 현재 팝업 위에 새 팝업 추가 */
    _pushPopup(mode, data = {}) {
        if (!this._popupStack) this._popupStack = [];
        const level = this._popupStack.length;
        const baseDepth = 300 + level * 100;
        const layer = { elements: [], baseDepth };
        this._popupStack.push(layer);

        const width = 1280, height = 720;
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, level > 0 ? 0.5 : 0.6)
            .setInteractive().setDepth(baseDepth);
        if (level > 0) overlay.on('pointerdown', () => this._closePopup());
        layer.elements.push(overlay);

        const PW = (mode === '_confirm' || mode === 'buildingInfo') ? 400 : 560;
        const PH = mode === 'heroDetail' ? 680 : (mode === '_confirm' || mode === 'buildingInfo') ? 220 : 520;
        const px = (width - PW) / 2;
        const py = (height - PH) / 2;

        const popBg = this.add.graphics().setDepth(baseDepth + 1);
        popBg.fillStyle(C.bgSecondary, 1);
        popBg.fillRoundedRect(px, py, PW, PH, 6);
        popBg.lineStyle(2, C.borderSecondary);
        popBg.strokeRoundedRect(px, py, PW, PH, 6);
        popBg.lineStyle(1, C.borderHighlight, 0.25);
        popBg.lineBetween(px + 3, py + 3, px + PW - 3, py + 3);
        popBg.lineBetween(px + 3, py + 3, px + 3, py + PH - 3);
        popBg.lineStyle(1, C.borderDark, 0.5);
        popBg.lineBetween(px + PW - 3, py + 3, px + PW - 3, py + PH - 3);
        popBg.lineBetween(px + 3, py + PH - 3, px + PW - 3, py + PH - 3);
        layer.elements.push(popBg);

        // overlay가 팝업 밖 클릭을 차단하므로 별도 blocker 불필요

        switch (mode) {
            case 'build': this._popupBuild(px, py, PW, PH); break;
            case 'research': this._popupResearch(px, py, PW, PH); break;
            case 'facility': this._popupFacility(px, py, PW, PH, data.facility); break;
            case 'policy': this._popupPolicy(px, py, PW, PH); break;
            case 'recruit': this._popupRecruit(px, py, PW, PH); break;
            case 'heroSelect': this._popupHeroSelect(px, py, PW, PH, data); break;
            case 'heroDetail': this._popupHeroDetail(px, py, PW, PH, data.hero); break;
            case 'hunt': this._popupHunt(px, py, PW, PH); break;
            case 'gather': this._popupGather(px, py, PW, PH); break;
            case 'lumber': this._popupLumber(px, py, PW, PH); break;
            case 'pioneer': this._popupPioneer(px, py, PW, PH, data); break;
            case 'defense': this._popupDefense(px, py, PW, PH); break;
            case 'buildingInfo': this._popupBuildingInfo(px, py, PW, PH, data.building); break;
            case '_confirm': this._popupConfirm(px, py, PW, PH, data); break;
        }
    }

    /** 최상위 팝업 1개만 닫기 */
    _closePopup() {
        if (!this._popupStack || this._popupStack.length === 0) return;
        const layer = this._popupStack.pop();
        layer.elements.forEach(el => el.destroy());
    }

    /** 모든 팝업 닫기 */
    _closeAllPopups() {
        if (!this._popupStack) return;
        while (this._popupStack.length > 0) {
            const layer = this._popupStack.pop();
            layer.elements.forEach(el => el.destroy());
        }
    }

    /** 현재 최상위 레이어에 요소 추가 */
    _pp(element) {
        if (!this._popupStack || this._popupStack.length === 0) {
            element.setDepth(302);
            return element;
        }
        const layer = this._popupStack[this._popupStack.length - 1];
        element.setDepth(layer.baseDepth + 2);
        layer.elements.push(element);
        return element;
    }

    _popupCloseBtn(px, py, pw, ph) {
        const cx = px + pw / 2;
        const y = py + ph - 40;
        this._pp(this._popupButton(cx, y, '닫기', () => {
            this._closeAllPopups();
            this._actionMode = null;
            this._actionData = null;
        }));
    }

    _popupButton(cx, cy, label, callback) {
        const bw = 140, bh = 30;
        const x = cx - bw / 2, y = cy - bh / 2;
        const container = this.add.container(0, 0);

        const bg = this.add.graphics();
        bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh);
        bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh);
        bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2);
        bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2);
        container.add(bg);

        const text = this.add.text(cx, cy, label, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }).setOrigin(0.5);
        container.add(text);

        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, 0xe03030); bg.strokeRect(x, y, bw, bh); text.setColor('#fff'); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh); bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2); bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2); text.setColor(C.textSecondary); });
        zone.on('pointerdown', callback);
        container.add(zone);
        return container;
    }

    _popupSmallBtn(cx, cy, label, callback) {
        const w = 60, h = 26;
        const x = cx - w / 2, y = cy - h / 2;
        const container = this.add.container(0, 0);

        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);
        container.add(bg);
        container.add(this.add.text(cx, cy, label, { fontSize: '11px', fontFamily: FONT, color: '#e8e8f0' }).setOrigin(0.5));

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x401010, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe04040); bg.strokeRect(x, y, w, h); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h); });
        zone.on('pointerdown', callback);
        container.add(zone);
        return container;
    }

    // ═══════════════════════════════════
    // 팝업: 건설
    // ═══════════════════════════════════
    _popupBuild(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '[ 건설 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 30;

        const available = this.baseManager.getAvailableBuilds();
        const gold = store.getState('gold') || 0;

        if (available.length === 0) {
            this._pp(this.add.text(cx, y + 40, '건설 가능한 시설이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            const iw = pw - 40;
            for (const f of available.slice(0, 8)) {
                const cost = this.baseManager.getBuildCost(f);
                const canAfford = gold >= cost;

                const ibg = this._pp(this.add.graphics());
                ibg.fillStyle(C.inputBg, 1); ibg.fillRect(px + 20, y, iw, 44);
                ibg.lineStyle(1, C.borderPrimary); ibg.strokeRect(px + 20, y, iw, 44);

                this._pp(this.add.text(px + 32, y + 6, `${f.name_ko} (T${f.tier})`, {
                    fontSize: '13px', fontFamily: FONT_BOLD, color: canAfford ? C.textPrimary : C.textMuted
                }));
                this._pp(this.add.text(px + 32, y + 26, f.description, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted,
                    wordWrap: { width: iw - 120 }
                }));
                this._pp(this.add.text(px + iw - 8, y + 6, `${cost}G / 진행도 ${f.build_cost}`, {
                    fontSize: '11px', fontFamily: FONT, color: canAfford ? C.expYellow : '#f04040'
                }).setOrigin(1, 0));

                if (canAfford) {
                    const zone = this._pp(this.add.zone(px + 20 + iw / 2, y + 22, iw, 44).setInteractive({ useHandCursor: true }));
                    const facility = f;
                    zone.on('pointerover', () => { ibg.clear(); ibg.fillStyle(0x1e1e34, 1); ibg.fillRect(px + 20, y, iw, 44); ibg.lineStyle(1, 0xe03030); ibg.strokeRect(px + 20, y, iw, 44); });
                    zone.on('pointerout', () => { ibg.clear(); ibg.fillStyle(C.inputBg, 1); ibg.fillRect(px + 20, y, iw, 44); ibg.lineStyle(1, C.borderPrimary); ibg.strokeRect(px + 20, y, iw, 44); });
                    zone.on('pointerdown', () => {
                        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
                        this._showPopup('heroSelect', { actionType: 'build', target: facility, heroes });
                    });
                }
                y += 50;
            }
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 연구
    // ═══════════════════════════════════
    _popupResearch(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '[ 연구 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 30;

        const available = this.baseManager.getAvailableResearch();
        const gold = store.getState('gold') || 0;
        const iw = pw - 40;

        if (available.length === 0) {
            this._pp(this.add.text(cx, y + 40, '연구 가능한 항목이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const r of available.slice(0, 8)) {
                const canAfford = gold >= r.cost;

                const ibg = this._pp(this.add.graphics());
                ibg.fillStyle(C.inputBg, 1); ibg.fillRect(px + 20, y, iw, 44);
                ibg.lineStyle(1, C.borderPrimary); ibg.strokeRect(px + 20, y, iw, 44);

                this._pp(this.add.text(px + 32, y + 6, r.name_ko, {
                    fontSize: '13px', fontFamily: FONT_BOLD, color: canAfford ? C.textPrimary : C.textMuted
                }));
                this._pp(this.add.text(px + 32, y + 26, r.description, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted,
                    wordWrap: { width: iw - 120 }
                }));
                this._pp(this.add.text(px + iw - 8, y + 6, `${r.cost}G / 진행도 ${r.research_cost}`, {
                    fontSize: '11px', fontFamily: FONT, color: canAfford ? C.expYellow : '#f04040'
                }).setOrigin(1, 0));

                if (canAfford) {
                    const zone = this._pp(this.add.zone(px + 20 + iw / 2, y + 22, iw, 44).setInteractive({ useHandCursor: true }));
                    const research = r;
                    zone.on('pointerover', () => { ibg.clear(); ibg.fillStyle(0x1e1e34, 1); ibg.fillRect(px + 20, y, iw, 44); ibg.lineStyle(1, 0xe03030); ibg.strokeRect(px + 20, y, iw, 44); });
                    zone.on('pointerout', () => { ibg.clear(); ibg.fillStyle(C.inputBg, 1); ibg.fillRect(px + 20, y, iw, 44); ibg.lineStyle(1, C.borderPrimary); ibg.strokeRect(px + 20, y, iw, 44); });
                    zone.on('pointerdown', () => {
                        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
                        this._showPopup('heroSelect', { actionType: 'research', target: research, heroes });
                    });
                }
                y += 50;
            }
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 영웅 선택 (건설/연구 투입)
    // ═══════════════════════════════════
    _popupHeroSelect(px, py, pw, ph, data) {
        const { actionType, target, heroes } = data;
        const cx = px + pw / 2;
        let y = py + 16;

        const statConfig = ACTION_STATS[actionType];
        this._pp(this.add.text(cx, y, `[ ${statConfig.label} — 영웅 선택 ]`, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        this._pp(this.add.text(cx, y, `대상: ${target.name_ko || target.name}`, {
            fontSize: '11px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0.5));
        y += 24;

        const iw = pw - 40;
        if (heroes.length === 0) {
            this._pp(this.add.text(cx, y + 40, '투입 가능한 영웅이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const stars = this._calcFitness(hero, statConfig.primary);
                const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;

                const ibg = this._pp(this.add.graphics());
                ibg.fillStyle(C.bgSecondary, 1); ibg.fillRoundedRect(px + 20, y, iw, 32, 4);
                ibg.lineStyle(1, C.borderSecondary); ibg.strokeRoundedRect(px + 20, y, iw, 32, 4);

                this._pp(this.add.text(px + 32, y + 8, `${hero.name}`, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._pp(this.add.text(px + 200, y + 9, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));
                this._pp(this.add.text(px + 290, y + 9, `${statConfig.label}력 ${stars}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                }));

                const heroRef = hero;
                this._pp(this._popupSmallBtn(px + iw - 70, y + 16, '정보', () => {
                    this._pushPopup('heroDetail', { hero: heroRef });
                }));
                this._pp(this._popupSmallBtn(px + iw - 10, y + 16, '투입', () => {
                    let result;
                    if (actionType === 'build') {
                        result = this.baseManager.startBuilding(target.id, hero.id);
                        if (result.success) { hero.status = 'construction'; store.setState('heroes', [...this.heroManager.getHeroes()]); }
                    } else if (actionType === 'research') {
                        result = this.baseManager.startResearch(target.id, hero.id);
                        if (result.success) { hero.status = 'research'; store.setState('heroes', [...this.heroManager.getHeroes()]); }
                    }
                    this._updateBuildings();
                    this._closePanelAction();
                }));

                y += 38;
            }
        }

        this._pp(this._popupButton(cx - 80, py + ph - 40, '← 뒤로', () => {
            this._showPopup(actionType === 'build' ? 'build' : 'research');
        }));
        this._pp(this._popupButton(cx + 80, py + ph - 40, '닫기', () => {
            this._closeAllPopups(); this._actionMode = null; this._actionData = null;
        }));
    }

    // ═══════════════════════════════════
    // 팝업: 시설 행동
    // ═══════════════════════════════════
    _popupFacility(px, py, pw, ph, facility) {
        if (!facility) { this._closePanelAction(); return; }
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, `[ ${facility.name_ko} ]`, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        this._pp(this.add.text(cx, y, facility.description, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 34;

        if (facility.id === 'tavern') {
            this._pp(this._popupButton(cx, y, '🍺 영웅 고용', () => this._showPopup('recruit')));
            y += 40;
            this._pp(this._popupButton(cx, y, '🎉 연회 개최', () => this._doFeast()));
        } else if (facility.id === 'hospital') {
            this._pp(this._popupButton(cx, y, '💊 사기 안정화', () => this._doStabilize()));
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 포고령
    // ═══════════════════════════════════
    _popupPolicy(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '[ 포고령 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        const base = store.getState('base');
        const policies = base.policies;
        const currentEffect = this.baseManager.getPolicyMoraleEffect();
        const eColor = currentEffect >= 0 ? C.successGreen : C.accentRed;

        this._pp(this.add.text(cx, y, `현재 효과: 전체 사기 ${currentEffect >= 0 ? '+' : ''}${currentEffect}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: eColor
        }).setOrigin(0.5));
        y += 28;

        const iw = pw - 40;
        const policyDefs = [
            { key: 'ration', label: '배급', options: [
                { value: 'lavish', label: '풍족 (사기+5, 비용↑)', color: C.successGreen },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'austerity', label: '긴축 (사기-3, 비용↓)', color: C.warningOrange }
            ]},
            { key: 'training', label: '훈련', options: [
                { value: 'intense', label: '강화 (경험↑, 사기-3)', color: C.accentRed },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'relaxed', label: '완화 (경험↓, 사기+3)', color: C.successGreen }
            ]},
            { key: 'alert', label: '경계', options: [
                { value: 'max', label: '최대 (방어↑, 사기-2)', color: C.accentRed },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'min', label: '최소 (방어↓, 사기+2)', color: C.successGreen }
            ]}
        ];

        for (const pDef of policyDefs) {
            this._pp(this.add.text(px + 24, y, pDef.label, {
                fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
            }));
            y += 22;

            for (const opt of pDef.options) {
                const isCurrent = policies[pDef.key] === opt.value;
                const marker = isCurrent ? '●' : '○';
                const optColor = isCurrent ? opt.color : C.textMuted;

                const optBg = this._pp(this.add.graphics());
                optBg.fillStyle(isCurrent ? 0x1e1e34 : C.inputBg, 1);
                optBg.fillRect(px + 20, y, iw, 24);
                optBg.lineStyle(1, isCurrent ? 0xe03030 : C.borderPrimary);
                optBg.strokeRect(px + 20, y, iw, 24);

                this._pp(this.add.text(px + 32, y + 5, `${marker} ${opt.label}`, {
                    fontSize: '11px', fontFamily: FONT, color: optColor
                }));

                const zone = this._pp(this.add.zone(px + 20 + iw / 2, y + 12, iw, 24).setInteractive({ useHandCursor: true }));
                const pKey = pDef.key;
                const pVal = opt.value;
                zone.on('pointerdown', () => {
                    this.baseManager.setPolicy(pKey, pVal);
                    this._showPopup('policy');
                });
                y += 28;
            }
            y += 6;
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 영웅 상세
    // ═══════════════════════════════════
    _popupHeroDetail(px, py, pw, ph, hero) {
        const cx = px + pw / 2;
        let y = py + 12;
        const s = hero.stats;
        const sub = hero.subStats || {};
        const derived = this.heroManager.getDerivedStats(hero);
        const sinColorHex = SIN_COLOR_HEX[hero.sinType] || C.textMuted;
        const sinColor = Phaser.Display.Color.HexStringToColor(sinColorHex).color;

        const cardX = px + 16;
        const cardW = pw - 32;
        const cardH = 140;
        const cardBg = this._pp(this.add.graphics());
        cardBg.fillStyle(C.cardBg, 1);
        cardBg.fillRect(cardX, y, cardW, cardH);
        cardBg.lineStyle(2, C.borderSecondary);
        cardBg.strokeRect(cardX, y, cardW, cardH);
        cardBg.lineStyle(1, C.borderHighlight, 0.25);
        cardBg.lineBetween(cardX + 2, y + 2, cardX + cardW - 2, y + 2);
        cardBg.lineStyle(1, C.borderDark, 0.5);
        cardBg.lineBetween(cardX + 2, y + cardH - 2, cardX + cardW - 2, y + cardH - 2);

        const sinBarG = this._pp(this.add.graphics());
        sinBarG.fillStyle(sinColor, 0.6);
        sinBarG.fillRect(cardX + 2, y + 2, cardW - 4, 4);

        const portSize = 100;
        const portX = cardX + 12;
        const portY = y + 18;
        const portG = this._pp(this.add.graphics());
        portG.fillStyle(0x0e0e1a, 1);
        portG.fillRect(portX, portY, portSize, portSize);
        portG.lineStyle(1, C.borderSecondary);
        portG.strokeRect(portX, portY, portSize, portSize);

        if (hero.appearance && hero.appearance.layers && this._spriteRenderer) {
            const heroId = `hero_${hero.id}`;
            const textures = this._spriteRenderer.compose(hero.appearance, heroId);
            if (textures && textures.walk) {
                const spr = this._pp(this.add.sprite(portX + portSize / 2, portY + portSize / 2 + 6, textures.walk, 0));
                spr.setScale((portSize - 8) / 64);
                if (this.anims.exists(`${heroId}_walk`)) spr.play(`${heroId}_walk`);
            }
        } else {
            portG.lineStyle(1, C.borderPrimary, 0.4);
            portG.lineBetween(portX, portY, portX + portSize, portY + portSize);
            portG.lineBetween(portX + portSize, portY, portX, portY + portSize);
        }

        const infoX = portX + portSize + 16;
        let ty = portY + 4;
        const nameObj = this._pp(this.add.text(infoX, ty, hero.name, {
            fontSize: '22px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }));
        this._pp(this.add.text(infoX + nameObj.width + 10, ty + 4, `[${hero.sinName}]`, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: sinColorHex
        }));
        this._pp(this.add.text(infoX + nameObj.width + 10, ty + 22, `🌾${hero.foodCost ?? '?'}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: '#a08040'
        }));
        ty += 30;

        const storyText = this._getHeroStory(hero.sinType);
        this._pp(this.add.text(infoX, ty, storyText, {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted,
            lineSpacing: 3,
            wordWrap: { width: cardW - portSize - 46 }
        }));

        const statusMap = { expedition: '원정', injured: '부상', construction: '건설', research: '연구', idle: '대기', hunt: '사냥', gather: '채집', lumber: '벌목' };
        this._pp(this.add.text(cardX + cardW - 12, y + 10, statusMap[hero.status] || '대기', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(1, 0));

        y += cardH + 10;

        // 사기 바
        const moraleState = this.heroManager.getMoraleState(hero.morale);
        const moraleColor = MORALE_COLORS_HEX[moraleState];
        const moraleName = this.heroManager.getMoraleStateName(hero.morale);
        const mBarX = px + 32;
        const mBarW = pw - 160;
        this._pp(this.add.text(mBarX, y - 2, '사기', { fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary }));
        const mBarStartX = mBarX + 36;
        const mBg = this._pp(this.add.graphics());
        mBg.fillStyle(0x0e0e1a, 1); mBg.fillRect(mBarStartX, y + 2, mBarW, 10);
        mBg.lineStyle(1, C.borderPrimary); mBg.strokeRect(mBarStartX, y + 2, mBarW, 10);
        const mFill = this._pp(this.add.graphics());
        const mfw = Math.max(0, (hero.morale / 100) * (mBarW - 2));
        mFill.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
        mFill.fillRect(mBarStartX + 1, y + 3, mfw, 8);
        this._pp(this.add.text(mBarStartX + mBarW + 8, y - 2, `${hero.morale} (${moraleName})`, {
            fontSize: '13px', fontFamily: FONT_BOLD, color: moraleColor
        }));
        y += 22;

        // 스탯
        const margin = 24;
        const col1X = px + margin + 8;
        const col2X = px + pw / 2 + 8;
        const statBarMaxW = pw / 2 - margin - 72;
        const statMax = 20;
        const rowH = 22;
        const sectionGap = 6;

        const _drawSectionHeader = (label) => {
            const lineY = y + 8;
            const tx = px + margin + 12;
            const textObj = this.add.text(tx, y, ` ${label} `, { fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary });
            this._pp(textObj);
            const tw = textObj.width;
            const lineG = this._pp(this.add.graphics());
            lineG.lineStyle(1, C.borderSecondary, 0.6);
            lineG.lineBetween(px + margin, lineY, tx - 6, lineY);
            lineG.lineBetween(tx + tw + 6, lineY, px + pw - margin, lineY);
            y += 22;
        };

        const _drawStatRow = (xPos, yPos, label, val, labelW = 36, barW = statBarMaxW) => {
            const valColor = val >= 15 ? '#40d870' : val >= 10 ? '#40a0f8' : val >= 7 ? '#f8b830' : '#f04040';
            const valColorHex = Phaser.Display.Color.HexStringToColor(valColor).color;
            this._pp(this.add.text(xPos, yPos, label, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }));
            const bx = xPos + labelW;
            const bw = barW;
            const bh = 10;
            const by = yPos + 3;
            const g = this._pp(this.add.graphics());
            g.fillStyle(0x0e0e1a, 1); g.fillRect(bx, by, bw, bh);
            g.lineStyle(1, C.borderPrimary, 0.6); g.strokeRect(bx, by, bw, bh);
            const fw = Math.max(0, Math.min(1, val / statMax)) * (bw - 2);
            g.fillStyle(valColorHex, 1); g.fillRect(bx + 1, by + 1, fw, bh - 2);
            this._pp(this.add.text(bx + bw + 6, yPos, `${val}`, { fontSize: '11px', fontFamily: FONT_BOLD, color: valColor }));
        };

        _drawSectionHeader('기본');
        const statLabels = [
            { key: 'strength', label: '힘' }, { key: 'agility', label: '민첩' },
            { key: 'intellect', label: '지능' }, { key: 'vitality', label: '체력' },
            { key: 'perception', label: '감각' }, { key: 'leadership', label: '통솔' },
            { key: 'charisma', label: '매력' }
        ];
        for (let i = 0; i < statLabels.length; i++) {
            const st = statLabels[i];
            const xPos = i % 2 === 0 ? col1X : col2X;
            _drawStatRow(xPos, y, st.label, s[st.key]);
            if (i % 2 === 1 || i === statLabels.length - 1) y += rowH;
        }
        y += sectionGap;

        _drawSectionHeader('행동');
        const actionStats = [
            { label: '사냥', a: 'strength', b: 'agility' },
            { label: '채집', a: 'agility', b: 'perception' },
            { label: '건설', a: 'strength', b: 'leadership' },
            { label: '대장간', a: 'strength', b: 'perception' },
            { label: '연금술', a: 'agility', b: 'perception' },
            { label: '연구', a: 'intellect', b: null },
            { label: '외교', a: 'intellect', b: 'charisma' },
            { label: '교역', a: 'intellect', b: 'charisma' },
            { label: '고용', a: 'leadership', b: 'charisma' }
        ];
        for (let i = 0; i < actionStats.length; i++) {
            const act = actionStats[i];
            const xPos = i % 2 === 0 ? col1X : col2X;
            const val = act.b ? Math.round((s[act.a] + s[act.b]) / 2) : s[act.a];
            _drawStatRow(xPos, y, act.label, val, 44);
            if (i % 2 === 1 || i === actionStats.length - 1) y += rowH;
        }
        y += sectionGap;

        _drawSectionHeader('감정');
        const subLabels = [
            { key: 'aggression', label: '공격성', src: 'sub' },
            { key: 'greediness', label: '욕심', src: 'sub' },
            { key: 'pride', label: '자존심', src: 'sub' },
            { key: 'curiosity', label: '호기심', src: 'sub' },
            { key: 'tenacity', label: '집요함', src: 'sub' },
            { key: 'sensitivity', label: '감수성', src: 'sub' },
            { key: 'independence', label: '독립심', src: 'sub' },
            { key: 'commandPower', label: '통솔력', src: 'derived' },
            { key: 'charm', label: '매력도', src: 'derived' },
            { key: 'susceptibility', label: '민감도', src: 'derived' }
        ];
        for (let i = 0; i < subLabels.length; i++) {
            const st = subLabels[i];
            const xPos = i % 2 === 0 ? col1X : col2X;
            const val = st.src === 'sub' ? (sub[st.key] ?? 0) : (derived[st.key] ?? 0);
            _drawStatRow(xPos, y, st.label, val, 44);
            if (i % 2 === 1 || i === subLabels.length - 1) y += rowH;
        }
        y += sectionGap;
        const endLineG = this._pp(this.add.graphics());
        endLineG.lineStyle(1, C.borderSecondary, 0.6);
        endLineG.lineBetween(px + margin, y, px + pw - margin, y);

        this._pp(this._popupButton(cx - 80, py + ph - 40, '해고', () => {
            this.heroManager.dismissHero(hero.id);
            this._closeAllPopups();
            this._refreshActiveTab();
        }));
        this._pp(this._popupButton(cx + 80, py + ph - 40, '닫기', () => {
            this._closePopup();
        }));
    }

    _getHeroStory(sinType) {
        const stories = {
            wrath: '전쟁에서 돌아온 뒤로 분노를 멈출 수 없었다.\n칼을 내려놓으면 손이 떨렸고,\n결국 바알의 부름에 응했다.',
            envy: '언제나 형의 그림자 속에 있었다.\n인정받지 못한 재능은 독이 되어\n결국 그를 이곳으로 이끌었다.',
            greed: '가진 것을 모두 잃은 날,\n다시는 빈손이 되지 않겠다고 맹세했다.\n그 집착이 바알의 눈에 띄었다.',
            sloth: '한때 뛰어난 학자였으나 모든 것을 포기했다.\n세상에 지쳐 쓰러진 그를\n바알이 주워 담았다.',
            gluttony: '굶주림의 기억은 지워지지 않았다.\n아무리 채워도 부족했고,\n결국 악마의 식탁에 앉게 되었다.',
            lust: '사랑에 실패한 뒤 혼자가 되는 것이 두려웠다.\n누군가 곁에 있어야만 했고,\n그 절박함이 이곳까지 왔다.',
            pride: '왕좌에서 쫓겨난 지휘관.\n자신이 옳다는 확신은 변하지 않았고,\n바알 아래서라도 증명하려 한다.',
        };
        return stories[sinType] || '어둠 속에서 바알의 부름을 들었다.\n갈 곳 없는 자에게 선택지란 없었다.';
    }

    // ═══════════════════════════════════
    // 팝업: 영웅 고용
    // ═══════════════════════════════════
    _popupRecruit(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '[ 주점 — 영웅 고용 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        const currentCount = this.heroManager.getHeroes().length;
        const gold = store.getState('gold') || 0;

        this._pp(this.add.text(cx, y, `${currentCount}/7명 | 고용비: 💰100 | 보유: 💰${gold}`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const iw = pw - 40;
        if (currentCount >= 7) {
            this._pp(this.add.text(cx, y + 40, '로스터가 가득 찼습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else if (gold < 100) {
            this._pp(this.add.text(cx, y + 40, '돈이 부족합니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            const recruits = this.heroManager.generateRecruits(3);
            for (const recruit of recruits) {
                const sinColor = SIN_COLOR_HEX[recruit.sinType] || C.textMuted;

                const ibg = this._pp(this.add.graphics());
                ibg.fillStyle(C.bgSecondary, 1); ibg.fillRect(px + 20, y, iw, 80);
                ibg.lineStyle(1, C.borderSecondary); ibg.strokeRect(px + 20, y, iw, 80);

                this._pp(this.add.text(px + 32, y + 8, recruit.name, {
                    fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._pp(this.add.text(px + 32, y + 26, `[${recruit.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));
                this._pp(this.add.text(px + 32, y + 42, '스탯: 고용 후 확인', {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                }));
                this._pp(this.add.text(px + 32, y + 58, `${recruit.sinFlaw || ''}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted,
                    wordWrap: { width: iw - 100 }
                }));

                this._pp(this._popupSmallBtn(px + iw - 10, y + 30, '고용', () => {
                    if ((store.getState('gold') || 0) >= 100 && this.heroManager.getHeroes().length < 7) {
                        store.setState('gold', (store.getState('gold') || 0) - 100);
                        this.heroManager.recruitHero(recruit);
                        this._showPopup('recruit');
                    }
                }));

                y += 86;
            }
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 하단 패널 행동들
    // ═══════════════════════════════════
    _renderExpeditionListAction() {
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = this.expeditionManager.getProgress();
        const expedition = store.getState('expedition');
        const isActive = expedition && expedition.active;

        this._p(this._sectionTitle(px, y, `원정 — 챕터 ${progress.chapter}`));
        y += 22;

        if (isActive) {
            this._p(this.add.text(px + 8, y, '원정 진행 중...', { fontSize: '11px', fontFamily: FONT, color: C.warningOrange }));
            y += 24;
        }

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const soldiers = store.getState('soldiers') || 0;
        this._p(this.add.text(px + 8, y, `영웅: ${heroes.length}명 | 병사: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 22;

        progress.stages.forEach((stage, i) => {
            const unlocked = stage.unlocked;
            const color = unlocked ? C.textPrimary : C.textMuted;
            const icon = stage.isBoss ? '👑 ' : unlocked ? '▸ ' : '✕ ';

            this._p(this._insetPanel(px, y, pw, 32));
            this._p(this.add.text(px + 8, y + 8, `${icon}${stage.name}`, {
                fontSize: '11px', fontFamily: FONT_BOLD, color
            }));
            this._p(this.add.text(px + pw - 8, y + 8, `적 ${stage.enemies}체`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));

            if (unlocked && !isActive) {
                const zone = this._p(this.add.zone(px + pw / 2, y + 16, pw, 32).setInteractive({ useHandCursor: true }));
                const stageIndex = i;
                zone.on('pointerdown', () => this._showPanelAction('expedition', { stageIndex }));
            }

            y += 38;
        });

        y += 10;
        this._p(this._panelButton(px + pw / 2, y, '← 돌아가기', () => this._closePanelAction()));
    }

    _popupGather(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '🌿 채집 — 영웅 선택', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#30b050'
        }).setOrigin(0.5));
        y += 24;

        this._pp(this.add.text(cx, y, '영웅 1명을 채집에 보냅니다. 식량을 획득합니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            this._pp(this.add.text(cx, y + 30, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;

                const rowBg = this.add.graphics();
                rowBg.fillStyle(C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 32, 4);
                rowBg.lineStyle(1, C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 32, 4);
                this._pp(rowBg);

                this._pp(this.add.text(listX + 12, y + 8, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._pp(this.add.text(listX + 180, y + 9, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));

                const heroRef = hero;
                this._pp(this._popupSmallBtn(listX + listW - 70, y + 16, '정보', () => {
                    this._pushPopup('heroDetail', { hero: heroRef });
                }));
                this._pp(this._popupSmallBtn(listX + listW - 10, y + 16, '파견', () => {
                    this._closeAllPopups();
                    this._doGather(hero);
                }));
                y += 38;
            }
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    _doGather(hero) {
        const turn = store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;
        const foodReward = (b.gather_base_food ?? 8) + Math.floor(Math.random() * day);

        hero.status = 'gather';
        store.setState('heroes', [...this.heroManager.getHeroes()]);

        const food = store.getState('food') || 0;
        store.setState('food', food + foodReward);
        this.heroManager.updateMorale(hero.id, b.gather_morale ?? 2);

        this._actionMode = null;
        this._actionData = null;
        this._updateResources();
        this._refreshActiveTab();
    }

    // ═══════════════════════════════════
    // 팝업: 벌목
    // ═══════════════════════════════════
    _popupLumber(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '🪓 벌목 — 영웅 선택', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#8a6a3a'
        }).setOrigin(0.5));
        y += 24;

        this._pp(this.add.text(cx, y, '영웅 1명을 벌목에 보냅니다. 나무를 획득합니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            this._pp(this.add.text(cx, y + 30, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;

                const rowBg = this.add.graphics();
                rowBg.fillStyle(C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 32, 4);
                rowBg.lineStyle(1, C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 32, 4);
                this._pp(rowBg);

                this._pp(this.add.text(listX + 12, y + 8, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._pp(this.add.text(listX + 180, y + 9, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));

                const heroRef = hero;
                this._pp(this._popupSmallBtn(listX + listW - 70, y + 16, '정보', () => {
                    this._pushPopup('heroDetail', { hero: heroRef });
                }));
                this._pp(this._popupSmallBtn(listX + listW - 10, y + 16, '파견', () => {
                    this._closeAllPopups();
                    this._doLumber(hero);
                }));
                y += 38;
            }
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    _doLumber(hero) {
        const turn = store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;
        const woodReward = (b.lumber_base_wood ?? 6) + Math.floor(Math.random() * day);

        hero.status = 'lumber';
        store.setState('heroes', [...this.heroManager.getHeroes()]);

        const wood = store.getState('wood') || 0;
        store.setState('wood', wood + woodReward);
        this.heroManager.updateMorale(hero.id, b.lumber_morale ?? 1);

        this._actionMode = null;
        this._actionData = null;
        this._updateResources();
        this._refreshActiveTab();
    }

    // ─── 개척 팝업 ───
    _popupPioneer(px, py, pw, ph, data) {
        const cx = px + pw / 2;
        let y = py + 16;
        const cellIndex = data.cellIndex;
        const cost = this.balance.pioneer_cost_wood ?? 30;
        const wood = store.getState('wood') || 0;
        const available = this.baseManager.getAvailablePioneerCells();
        const canPioneer = available.includes(cellIndex);
        const pioneering = this.baseManager.getCurrentPioneering();

        this._pp(this.add.text(cx, y, '🪓 개척 — 거점 확장', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#c89050'
        }).setOrigin(0.5));
        y += 24;

        const row = Math.floor(cellIndex / 5);
        const col = cellIndex % 5;
        this._pp(this.add.text(cx, y, `셀 [${row},${col}] 개척 | 비용: 나무 ${cost}`, {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        if (pioneering) {
            this._pp(this.add.text(cx, y + 30, '이미 개척 진행 중', {
                fontSize: '11px', fontFamily: FONT, color: '#f8b830'
            }).setOrigin(0.5));
        } else if (!canPioneer) {
            this._pp(this.add.text(cx, y + 30, '인접한 해금 셀이 없어 개척 불가', {
                fontSize: '11px', fontFamily: FONT, color: '#f04040'
            }).setOrigin(0.5));
        } else if (wood < cost) {
            this._pp(this.add.text(cx, y + 30, `나무 부족 (보유: ${wood} / 필요: ${cost})`, {
                fontSize: '11px', fontFamily: FONT, color: '#f04040'
            }).setOrigin(0.5));
        } else {
            const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
            const listX = px + 16;
            const listW = pw - 32;
            if (heroes.length === 0) {
                this._pp(this.add.text(cx, y + 30, '투입 가능한 영웅 없음', {
                    fontSize: '11px', fontFamily: FONT, color: C.textMuted
                }).setOrigin(0.5));
            } else {
                this._pp(this.add.text(px + 16, y, '영웅 선택 (힘+체력)', {
                    fontSize: '10px', fontFamily: FONT, color: C.textSecondary
                }));
                y += 20;
                for (const hero of heroes) {
                    const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;
                    const rowBg = this.add.graphics();
                    rowBg.fillStyle(C.cardBg, 1);
                    rowBg.fillRoundedRect(listX, y, listW, 36, 4);
                    rowBg.lineStyle(1, C.borderPrimary);
                    rowBg.strokeRoundedRect(listX, y, listW, 36, 4);
                    this._pp(rowBg);
                    this._pp(this.add.text(listX + 12, y + 10, hero.name, {
                        fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                    }));
                    this._pp(this.add.text(listX + 120, y + 10, `[${hero.sinName}]`, {
                        fontSize: '9px', fontFamily: FONT, color: sinColor
                    }));
                    const eff = Math.round((hero.stats.strength + hero.stats.vitality) / 2);
                    this._pp(this.add.text(listX + 200, y + 10, `효율: ${eff}`, {
                        fontSize: '9px', fontFamily: FONT, color: C.infoCyan
                    }));
                    this._pp(this._popupButton(listX + listW - 40, y + 18, '투입', () => {
                        this._closeAllPopups();
                        const result = this.baseManager.startPioneering(cellIndex, hero.id);
                        if (result.success) {
                            hero.status = 'pioneer';
                            store.setState('heroes', [...this.heroManager.getHeroes()]);
                        }
                        this._updateBuildings();
                        this._refreshActiveTab();
                        this._updateResources();
                    }));
                    y += 42;
                }
            }
        }
        this._popupCloseBtn(px, py, pw, ph);
    }

    // ─── 방어 배치 팝업 ───
    _popupDefense(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '🛡️ 방어 배치', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#4080e0'
        }).setOrigin(0.5));
        y += 24;

        this._pp(this.add.text(cx, y, '밤 습격에 참전할 영웅을 배치합니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status !== 'injured');
        const defenseIds = this.baseManager.getDefenseHeroIds();
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            this._pp(this.add.text(cx, y + 30, '배치 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;
                const isAssigned = defenseIds.includes(hero.id);

                const rowBg = this.add.graphics();
                rowBg.fillStyle(isAssigned ? 0x1a2040 : C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 36, 4);
                rowBg.lineStyle(1, isAssigned ? 0x4080e0 : C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 36, 4);
                this._pp(rowBg);

                this._pp(this.add.text(listX + 12, y + 10, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._pp(this.add.text(listX + 120, y + 10, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));

                const statusLabel = isAssigned ? '🛡️ 배치됨' : hero.status === 'idle' ? '대기' : hero.status;
                this._pp(this.add.text(listX + 200, y + 10, statusLabel, {
                    fontSize: '9px', fontFamily: FONT, color: isAssigned ? '#4080e0' : C.textMuted
                }));

                if (isAssigned) {
                    this._pp(this._popupButton(listX + listW - 40, y + 18, '해제', () => {
                        this.baseManager.unassignDefense(hero.id);
                        this._closeAllPopups();
                        this._showPopup('defense', {});
                        this._refreshActiveTab();
                    }));
                } else if (hero.status === 'idle') {
                    this._pp(this._popupButton(listX + listW - 40, y + 18, '배치', () => {
                        this.baseManager.assignDefense(hero.id);
                        hero.status = 'defense';
                        store.setState('heroes', [...this.heroManager.getHeroes()]);
                        this._closeAllPopups();
                        this._showPopup('defense', {});
                        this._refreshActiveTab();
                    }));
                }
                y += 42;
            }
        }

        const defCount = defenseIds.length;
        this._pp(this.add.text(cx, py + ph - 60, `현재 방어 배치: ${defCount}명`, {
            fontSize: '12px', fontFamily: FONT_BOLD, color: defCount > 0 ? '#4080e0' : '#f04040'
        }).setOrigin(0.5));

        this._popupCloseBtn(px, py, pw, ph);
    }

    _popupBuildingInfo(px, py, pw, ph, building) {
        const cx = px + pw / 2;
        const pct = Math.floor((building.progress / building.buildCost) * 100);
        const heroes = this.heroManager.getHeroes();
        const hero = heroes.find(h => h.id === building.assignedHeroId);
        const heroName = hero ? hero.name : '없음';

        this._pp(this.add.text(cx, py + 20, `🔨 ${building.name}`, {
            fontSize: '14px', fontFamily: FONT_BOLD, color: C.infoCyan
        }).setOrigin(0.5));

        this._pp(this.add.text(cx, py + 50, `건설 진행: ${pct}% (${building.progress}/${building.buildCost})`, {
            fontSize: '11px', fontFamily: FONT, color: C.textPrimary
        }).setOrigin(0.5));

        this._pp(this.add.text(cx, py + 72, `담당: ${heroName}`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));

        this._popupCloseBtn(px, py, pw, ph);
    }

    _renderExpeditionAction(stageIndex) {
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = this.expeditionManager.getProgress();
        const stage = progress.stages[stageIndex];
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const soldiers = store.getState('soldiers') || 0;

        this._p(this._sectionTitle(px, y, `원정: ${stage.name}`));
        y += 22;

        this._p(this.add.text(px + 8, y, `영웅: ${heroes.length}명 | 병사: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 20;

        if (heroes.length === 0) {
            this._p(this.add.text(px + 8, y, '파견 가능한 영웅 없음', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }));
        } else if (soldiers === 0) {
            this._p(this.add.text(px + 8, y, '병사가 없습니다', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }));
        } else {
            const party = heroes.slice(0, Math.min(3, heroes.length));
            this._p(this.add.text(px + 8, y, `파티: ${party.map(h => h.name).join(', ')}`, {
                fontSize: '11px', fontFamily: FONT, color: C.infoCyan
            }));
            y += 20;
            this._p(this._panelButton(px + pw / 2, y, '병사 배정 →', () => {
                this._showPanelAction('soldierSelect', { stageIndex, party });
            }));
        }

        y += 40;
        this._p(this._panelButton(px + pw / 2, y, '← 돌아가기', () => this._closePanelAction()));
    }

    _renderSoldierSelectAction(data) {
        const { stageIndex, party } = data;
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = this.expeditionManager.getProgress();
        const stage = progress.stages[stageIndex];
        const soldiers = store.getState('soldiers') || 0;

        this._p(this._sectionTitle(px, y, '병사 배정'));
        y += 22;

        this._p(this.add.text(px + 8, y, `목표: ${stage.name} | 사용 가능: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 24;

        let selectedCount = Math.min(10, soldiers);
        const countText = this._p(this.add.text(px + 150, y, `${selectedCount}명`, {
            fontSize: '20px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        const btnCx = px + 150;
        this._p(this._smallPanelBtn(btnCx - 80, y, '-10', () => { selectedCount = Math.max(1, selectedCount - 10); countText.setText(`${selectedCount}명`); }));
        this._p(this._smallPanelBtn(btnCx - 30, y, '-1', () => { selectedCount = Math.max(1, selectedCount - 1); countText.setText(`${selectedCount}명`); }));
        this._p(this._smallPanelBtn(btnCx + 30, y, '+1', () => { selectedCount = Math.min(soldiers, selectedCount + 1); countText.setText(`${selectedCount}명`); }));
        this._p(this._smallPanelBtn(btnCx + 80, y, '+10', () => { selectedCount = Math.min(soldiers, selectedCount + 10); countText.setText(`${selectedCount}명`); }));
        y += 26;
        this._p(this._smallPanelBtn(btnCx, y, '전체', () => { selectedCount = soldiers; countText.setText(`${selectedCount}명`); }));
        y += 34;

        this._p(this._panelButton(btnCx, y, '⚔️ 파견 출발', () => {
            const partyIds = party.map(h => h.id);
            const result = this.expeditionManager.dispatch(partyIds, stageIndex, selectedCount);
            if (result.success) {
                this._refreshActiveTab();
                this._updateSoldiers();
                this._closePanelAction();
            }
        }));

        y += 40;
        this._p(this._panelButton(btnCx, y, '← 돌아가기', () => {
            this._showPanelAction('expedition', { stageIndex });
        }));
    }

    _popupHunt(px, py, pw, ph) {
        const cx = px + pw / 2;
        let y = py + 16;

        this._pp(this.add.text(cx, y, '🏹 사냥 — 영웅 선택', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#d0a020'
        }).setOrigin(0.5));
        y += 24;

        this._pp(this.add.text(cx, y, '영웅 1명을 사냥에 보냅니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            this._pp(this.add.text(cx, y + 30, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const stars = this._calcFitness(hero, ACTION_STATS.hunt.primary);
                const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;

                const rowBg = this.add.graphics();
                rowBg.fillStyle(C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 32, 4);
                rowBg.lineStyle(1, C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 32, 4);
                this._pp(rowBg);

                this._pp(this.add.text(listX + 12, y + 8, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._pp(this.add.text(listX + 180, y + 9, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));
                this._pp(this.add.text(listX + 270, y + 9, `사냥력 ${stars}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                }));

                const heroRef = hero;
                this._pp(this._popupSmallBtn(listX + listW - 70, y + 16, '정보', () => {
                    this._pushPopup('heroDetail', { hero: heroRef });
                }));
                this._pp(this._popupSmallBtn(listX + listW - 10, y + 16, '파견', () => {
                    this._closeAllPopups();
                    this._launchHunt(hero);
                }));
                y += 38;
            }
        }

        this._popupCloseBtn(px, py, pw, ph);
    }

    _launchHunt(hero) {
        const turn = store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;

        const huntEnemies = this.registry.get('huntEnemies') || [];
        const template = huntEnemies[Math.floor(Math.random() * huntEnemies.length)];
        if (!template) return;

        // 사냥 출발 시 영웅 상태 변경 → 이번 턴 다른 행동 불가
        hero.status = 'hunt';
        store.setState('heroes', [...this.heroManager.getHeroes()]);

        const scale = 1 + (day - 1) * 0.1;
        const enemy = {
            name: template.name,
            hp: Math.floor(template.base_hp * scale),
            atk: Math.floor(template.base_atk * scale),
            spd: template.spd
        };

        const goldReward = (b.hunt_gold_base ?? 15) + day * (b.hunt_gold_per_day ?? 3);

        this._huntPopup = new MapHuntPopup(this, {
            hero,
            enemy,
            balance: b,
            stageName: `사냥 — ${template.name}`,
            onComplete: (result) => {
                this._huntPopup = null;
                if (result.victory) {
                    hero.status = 'hunt';
                    const gold = store.getState('gold') || 0;
                    store.setState('gold', gold + goldReward);
                    this.heroManager.updateMorale(hero.id, b.hunt_win_morale ?? 3);
                } else {
                    hero.status = 'injured';
                    this.heroManager.updateMorale(hero.id, b.hunt_lose_morale ?? -5);
                }
                store.setState('heroes', [...this.heroManager.getHeroes()]);
                this._refreshActiveTab();
                this._updateResources();
            }
        });
        this._huntPopup.start();
    }

    // ═══════════════════════════════════
    // 행동: 연회 / 안정화
    // ═══════════════════════════════════
    _doFeast() {
        const b = this.balance;
        const feastCost = b.feast_cost ?? 100;
        const gold = store.getState('gold') || 0;
        if (gold < feastCost) return;

        store.setState('gold', gold - feastCost);
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            let delta = b.feast_morale_normal ?? 15;
            if (hero.sinType === 'gluttony' || hero.sinType === 'lust') delta = b.feast_morale_gluttony_lust ?? 25;
            this.heroManager.updateMorale(hero.id, delta);
        }
        this._closeAllPopups();
        this._actionMode = null;
        this._actionData = null;
        this._refreshActiveTab();
        this._updateResources();
    }

    _doStabilize() {
        const b = this.balance;
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            if (hero.morale < (b.stabilize_low_threshold ?? 30) || hero.morale > (b.stabilize_high_threshold ?? 80)) {
                const target = b.stabilize_target ?? 50;
                const delta = Math.round((target - hero.morale) * (b.stabilize_factor ?? 0.3));
                this.heroManager.updateMorale(hero.id, delta);
            }
        }
        this._closeAllPopups();
        this._actionMode = null;
        this._actionData = null;
        this._refreshActiveTab();
    }

    // ═══════════════════════════════════
    // 탭: 영웅
    // ═══════════════════════════════════
    _renderHeroTab() {
        const px = 16;
        const pw = 400;
        let y = PANEL_CONTENT_Y + 8;

        const heroes = this.heroManager.getHeroes();
        this._p(this._sectionTitle(px, y, `영웅 (${heroes.length}/7)`));
        y += 22;

        // 가로 배치 (하단 패널은 넓으므로)
        const CARD_W = 180;
        const CARD_H = 170;
        const GAP = 8;
        let cx = px;

        for (const hero of heroes) {
            if (cx + CARD_W > 1260) { cx = px; y += CARD_H + GAP; }

            this._p(this._outsetPanel(cx, y, CARD_W, CARD_H));

            this._p(this.add.text(cx + 8, y + 6, hero.name, {
                fontSize: '12px', fontFamily: FONT_BOLD, color: C.textPrimary,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }));

            const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;
            this._p(this.add.text(cx + 8, y + 22, `[${hero.sinName}]`, {
                fontSize: '10px', fontFamily: FONT, color: sinColor
            }));

            const statusMap = { expedition: '원정', injured: '부상', construction: '건설', research: '연구', idle: '대기' };
            this._p(this.add.text(cx + CARD_W - 8, y + 22, statusMap[hero.status] || '대기', {
                fontSize: '10px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));

            const s = hero.stats;
            this._p(this.add.text(cx + 8, y + 40, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality}`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }));
            this._p(this.add.text(cx + 8, y + 54, `감${s.perception} 솔${s.leadership} 매${s.charisma}`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }));

            // 사기 바
            const moraleState = this.heroManager.getMoraleState(hero.morale);
            const moraleColor = MORALE_COLORS_HEX[moraleState];
            const barX = cx + 8;
            const barY = y + CARD_H - 16;
            const barW = CARD_W - 50;
            const barH = 6;

            const mBarBg = this._p(this.add.graphics());
            mBarBg.fillStyle(0x0e0e1a, 1); mBarBg.fillRect(barX, barY, barW, barH);
            mBarBg.lineStyle(1, C.borderPrimary); mBarBg.strokeRect(barX, barY, barW, barH);

            const mBar = this._p(this.add.graphics());
            const fillW = Math.max(0, (hero.morale / 100) * barW);
            mBar.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
            mBar.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);

            this._p(this.add.text(barX + barW + 6, barY - 2, `${hero.morale}`, {
                fontSize: '10px', fontFamily: FONT_BOLD, color: moraleColor
            }));

            const cardZone = this._p(this.add.zone(cx + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true }));
            const heroRef = hero;
            cardZone.on('pointerdown', () => this._showPopup('heroDetail', { hero: heroRef }));

            cx += CARD_W + GAP;
        }

        if (heroes.length < 7) {
            this._p(this._smallPanelBtn(cx + 40, y + 40, '고용', () => this._showPanelAction('recruit')));
        }

        const defenseCount = this.baseManager.getDefenseHeroIds().length;
        this.defenseText.setText(`방어:${defenseCount}명`);
        this.defenseText.setColor(defenseCount === 0 ? '#f04040' : C.textSecondary);
    }

    // ═══════════════════════════════════
    // 탭: 시설
    // ═══════════════════════════════════
    _renderBaseTab() {
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        this._p(this._sectionTitle(px, y, '시설 현황'));
        y += 22;

        const built = this.baseManager.getBuiltFacilities();
        const buildings = this.baseManager.getCurrentBuildings();
        const researching = this.baseManager.getCurrentResearch();

        if (built.length === 0 && buildings.length === 0) {
            this._p(this.add.text(px + 8, y, '건설된 시설 없음', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }));
            y += 20;
        } else {
            for (const f of built) {
                this._p(this._insetPanel(px, y, pw, 24));
                this._p(this.add.text(px + 8, y + 5, `✓ ${f.name_ko}`, { fontSize: '11px', fontFamily: FONT, color: C.successGreen }));
                y += 30;
            }
        }

        for (const building of buildings) {
            this._p(this._insetPanel(px, y, pw, 24));
            const bPct = Math.floor((building.progress / building.buildCost) * 100);
            this._p(this.add.text(px + 8, y + 5, `🔨 ${building.name} (${bPct}% — ${building.progress}/${building.buildCost})`, { fontSize: '11px', fontFamily: FONT, color: C.infoCyan }));
            y += 30;
        }

        if (researching) {
            this._p(this._insetPanel(px, y, pw, 24));
            const rPct = Math.floor((researching.progress / researching.researchCost) * 100);
            this._p(this.add.text(px + 8, y + 5, `📖 ${researching.name} (${rPct}% — ${researching.progress}/${researching.researchCost})`, { fontSize: '11px', fontFamily: FONT, color: C.infoCyan }));
            y += 30;
        }

        y += 10;
        const income = this.baseManager.getPassiveIncomeWithBonus();
        this._p(this.add.text(px + 8, y, `턴당 수입: 💰${income}`, { fontSize: '11px', fontFamily: FONT, color: C.expYellow }));
        y += 20;

        const policyEffect = this.baseManager.getPolicyMoraleEffect();
        const pColor = policyEffect >= 0 ? C.successGreen : C.accentRed;
        this._p(this.add.text(px + 8, y, `포고령 효과: 사기 ${policyEffect >= 0 ? '+' : ''}${policyEffect}/턴`, { fontSize: '11px', fontFamily: FONT, color: pColor }));
        y += 30;

        this._p(this._panelButton(px + 100, y, '건 설', () => this._showPanelAction('build')));
        if (!researching) {
            this._p(this._panelButton(px + 280, y, '연 구', () => this._showPanelAction('research')));
        }
    }

    // ═══════════════════════════════════
    // 탭: 아이템
    // ═══════════════════════════════════
    _renderItemTab() {
        const y = PANEL_CONTENT_Y + 60;
        this._p(this.add.text(640, y, '🎒 아이템 — 준비 중', {
            fontSize: '16px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setDepth(301));
        this._p(this.add.text(640, y + 30, '장비 시스템은 추후 업데이트됩니다.', {
            fontSize: '12px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setDepth(301));
    }

    // ═══════════════════════════════════
    // 탭: 원정
    // ═══════════════════════════════════
    _renderExpeditionTab() {
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = this.expeditionManager.getProgress();
        const expedition = store.getState('expedition');

        this._p(this._sectionTitle(px, y, `원정 — 챕터 ${progress.chapter}`));
        y += 22;

        if (expedition && expedition.active) {
            this._p(this._insetPanel(px, y, pw, 30));
            this._p(this.add.text(px + 8, y + 8, '원정 진행 중...', { fontSize: '11px', fontFamily: FONT, color: C.warningOrange }));
            y += 40;
        }

        // 가로 배치 스테이지
        let sx = px;
        progress.stages.forEach((stage) => {
            const unlocked = stage.unlocked;
            const color = unlocked ? C.textPrimary : C.textMuted;
            const icon = stage.isBoss ? '👑 ' : unlocked ? '▸ ' : '✕ ';

            this._p(this._insetPanel(sx, y, 280, 28));
            this._p(this.add.text(sx + 8, y + 7, `${icon}${stage.name}`, { fontSize: '11px', fontFamily: FONT, color }));
            this._p(this.add.text(sx + 272, y + 7, `적 ${stage.enemies}체`, { fontSize: '9px', fontFamily: FONT, color: C.textMuted }).setOrigin(1, 0));
            sx += 290;
            if (sx > 900) { sx = px; y += 34; }
        });
        if (sx !== px) y += 34;

        y += 10;
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        this._p(this.add.text(px + 8, y, `파견 가능: ${heroes.length}명`, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }));

        const turn = this.turnManager.getCurrentTurn();
        const raidInfo = this.baseManager.getRaidInfo(turn.day);
        this._p(this.add.text(px + 200, y, `감시탑: ${raidInfo.text}`, { fontSize: '11px', fontFamily: FONT, color: C.warningOrange }));
    }

    // ═══════════════════════════════════
    // 탭: 정책
    // ═══════════════════════════════════
    _renderPolicyTab() {
        const px = 16;
        let y = PANEL_CONTENT_Y + 8;

        const base = store.getState('base');
        const policies = base.policies;

        this._p(this._sectionTitle(px, y, '포고령'));
        y += 22;

        const currentEffect = this.baseManager.getPolicyMoraleEffect();
        const eColor = currentEffect >= 0 ? C.successGreen : C.accentRed;
        this._p(this.add.text(px + 8, y, `현재 효과: 전체 사기 ${currentEffect >= 0 ? '+' : ''}${currentEffect}/턴`, { fontSize: '11px', fontFamily: FONT, color: eColor }));
        y += 24;

        const policyDefs = [
            { key: 'ration', label: '배급', options: [
                { value: 'lavish', label: '풍족 (사기+5, 비용↑)', color: C.successGreen },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'austerity', label: '긴축 (사기-3, 비용↓)', color: C.warningOrange }
            ]},
            { key: 'training', label: '훈련', options: [
                { value: 'intense', label: '강화 (경험↑, 사기-3)', color: C.accentRed },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'relaxed', label: '완화 (경험↓, 사기+3)', color: C.successGreen }
            ]},
            { key: 'alert', label: '경계', options: [
                { value: 'max', label: '최대 (방어↑, 사기-2)', color: C.accentRed },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'min', label: '최소 (방어↓, 사기+2)', color: C.successGreen }
            ]}
        ];

        // 3열 가로 배치
        let colX = px;
        for (const pDef of policyDefs) {
            const colW = 380;
            let py = y;

            this._p(this.add.text(colX + 8, py, pDef.label, { fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary }));
            py += 20;

            for (const opt of pDef.options) {
                const isCurrent = policies[pDef.key] === opt.value;
                const marker = isCurrent ? '●' : '○';
                const optColor = isCurrent ? opt.color : C.textMuted;

                const optBg = this._p(this.add.graphics());
                optBg.fillStyle(isCurrent ? 0x1e1e34 : C.inputBg, 1);
                optBg.fillRect(colX + 4, py, colW - 8, 22);
                optBg.lineStyle(1, isCurrent ? 0xe03030 : C.borderPrimary);
                optBg.strokeRect(colX + 4, py, colW - 8, 22);

                this._p(this.add.text(colX + 12, py + 4, `${marker} ${opt.label}`, {
                    fontSize: '11px', fontFamily: FONT, color: optColor
                }));

                const zone = this._p(this.add.zone(colX + colW / 2, py + 11, colW - 8, 22)
                    .setInteractive({ useHandCursor: true }));
                const pKey = pDef.key;
                const pVal = opt.value;
                zone.on('pointerdown', () => {
                    this.baseManager.setPolicy(pKey, pVal);
                    this._refreshActiveTab();
                });

                py += 26;
            }
            colX += colW + 16;
        }
    }

    // ═══════════════════════════════════
    // 적합도 계산
    // ═══════════════════════════════════
    _calcFitness(hero, primaryStats) {
        let total = 0;
        for (const stat of primaryStats) total += hero.stats[stat] || 0;
        return Math.floor(total / primaryStats.length);
    }

    // ═══════════════════════════════════
    // 패널 UI 헬퍼
    // ═══════════════════════════════════
    _sectionTitle(x, y, text) {
        const t = this.add.text(x + 4, y, text, {
            fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
        }).setDepth(202);
        const g = this.add.graphics().setDepth(202);
        g.lineStyle(1, C.borderPrimary);
        g.lineBetween(x, y + 18, x + 580, y + 18);
        this._panelElements.push(g);
        return t;
    }

    _outsetPanel(x, y, w, h) {
        const g = this.add.graphics().setDepth(202);
        g.fillStyle(C.bgSecondary, 1); g.fillRect(x, y, w, h);
        g.lineStyle(2, C.borderSecondary); g.strokeRect(x, y, w, h);
        g.lineStyle(1, C.borderHighlight, 0.3); g.lineBetween(x + 2, y + 2, x + w - 2, y + 2); g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        g.lineStyle(1, C.borderDark, 0.6); g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2); g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
        return g;
    }

    _insetPanel(x, y, w, h) {
        const g = this.add.graphics().setDepth(202);
        g.fillStyle(C.inputBg, 1); g.fillRect(x, y, w, h);
        g.lineStyle(2, C.borderPrimary); g.strokeRect(x, y, w, h);
        g.lineStyle(1, C.borderDark, 0.6); g.lineBetween(x + 2, y + 2, x + w - 2, y + 2); g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        g.lineStyle(1, C.borderHighlight, 0.3); g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2); g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
        return g;
    }

    _panelButton(cx, y, label, callback) {
        const bw = 160, bh = 28;
        const x = cx - bw / 2;
        const container = this.add.container(0, 0).setDepth(202);

        const bg = this.add.graphics();
        bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh);
        bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh);
        bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2);
        bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2);
        container.add(bg);

        const text = this.add.text(cx, y + bh / 2, label, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }).setOrigin(0.5);
        container.add(text);

        const zone = this.add.zone(cx, y + bh / 2, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, 0xe03030); bg.strokeRect(x, y, bw, bh); text.setColor('#fff'); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh); bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2); bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2); text.setColor(C.textSecondary); });
        zone.on('pointerdown', callback);
        container.add(zone);
        return container;
    }

    _smallPanelBtn(cx, cy, label, callback) {
        const w = 50, h = 24;
        const x = cx - w / 2, y = cy - h / 2;
        const container = this.add.container(0, 0).setDepth(202);

        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);
        container.add(bg);
        container.add(this.add.text(cx, cy, label, { fontSize: '11px', fontFamily: FONT, color: '#e8e8f0' }).setOrigin(0.5));

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x401010, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe04040); bg.strokeRect(x, y, w, h); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h); });
        zone.on('pointerdown', callback);
        container.add(zone);
        return container;
    }

    // ═══════════════════════════════════
    // 건물 업데이트
    // ═══════════════════════════════════
    _updateBuildings() {
        if (!this.buildingSlots) return;
        const hw = CELL_W / 2, hh = CELL_H / 2;
        const builtFacilities = this.baseManager.getBuiltFacilities();
        const buildings = this.baseManager.getCurrentBuildings();
        const pioneering = this.baseManager.getCurrentPioneering();
        // 건설 중인 시설을 슬롯에 매핑 (built 다음 순서로 배치)
        const buildingBySlot = {};
        buildings.forEach((b, idx) => { buildingBySlot[builtFacilities.length + idx] = b; });

        this.buildingSlots.forEach((slot, i) => {
            const builtItem = builtFacilities[i] || null;
            const buildingItem = buildingBySlot[i] || null;
            const isPioneering = pioneering && pioneering.cellIndex === slot.slotIndex;
            const isUnlocked = this.baseManager.isCellUnlocked(slot.slotIndex);

            if (builtItem) {
                slot.nameText.setText(builtItem.name_ko).setColor(C.textPrimary);
                slot.statusText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, C.building, 0.5);
            } else if (buildingItem) {
                slot.nameText.setText(buildingItem.name).setColor(C.infoCyan);
                const bPct2 = Math.floor((buildingItem.progress / buildingItem.buildCost) * 100);
                slot.statusText.setText(`건설 ${bPct2}%`);
                this._drawSlotBg(slot.bg, hw, hh, 0x1e2e1e, 0.6, 0x40a060);
            } else if (isPioneering) {
                slot.nameText.setText('개척 중').setColor('#c89050');
                slot.statusText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, 0x2a2010, 0.6, 0xc89050);
            } else if (!isUnlocked) {
                slot.nameText.setText('🔒').setColor('#505050');
                slot.statusText.setText(''); slot.heroText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, 0x0a0a0a, 0.6, 0x303030);
            } else {
                slot.nameText.setText('+건설').setColor(C.textMuted); slot.statusText.setText(''); slot.heroText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, C.emptySlot, 0.35);
            }
        });
    }

    /** 슬롯 외형 복원 (pointerout용) */
    _updateSlotAppearance(i) {
        const slot = this.buildingSlots.find(s => s.slotIndex === i);
        if (!slot) return;
        const hw = CELL_W / 2, hh = CELL_H / 2;
        const built = this._getSlotBuilding(i);
        const isUnlocked = this.baseManager.isCellUnlocked(i);
        if (built) {
            this._drawSlotBg(slot.bg, hw, hh, C.building, 0.5);
        } else if (!isUnlocked) {
            this._drawSlotBg(slot.bg, hw, hh, 0x0a0a0a, 0.6, 0x303030);
        } else {
            this._drawSlotBg(slot.bg, hw, hh, C.emptySlot, 0.35);
        }
    }

    _updateResources() {
        this.foodText.setText(`🌾${store.getState('food') || 0}`);
        this.woodText.setText(`🪵${store.getState('wood') || 0}`);
        this.goldText.setText(`💰${store.getState('gold') || 0}`);
    }
    _updateSoldiers() { this.soldierText.setText(`병사:${store.getState('soldiers') || 0}명`); }
    _updatePhaseDisplay() {
        const turn = this.turnManager.getCurrentTurn();
        this.dayText.setText(`Day ${turn.day}`);
        this.phaseText.setText(`[${this.turnManager.getPhaseName()}]`);
    }

    _getSlotBuilding(i) { return this.baseManager.getBuiltFacilities()[i] || null; }
    _onSlotClick(i) {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;
        const isUnlocked = this.baseManager.isCellUnlocked(i);
        if (!isUnlocked) {
            this._showPanelAction('pioneer', { cellIndex: i });
            return;
        }
        const built = this._getSlotBuilding(i);
        if (built) {
            this._showPanelAction('facility', { facility: built });
            return;
        }
        // 건설 중인 시설 확인
        const builtCount = this.baseManager.getBuiltFacilities().length;
        const buildings = this.baseManager.getCurrentBuildings();
        const buildingItem = buildings[i - builtCount];
        if (buildingItem) {
            this._showPanelAction('buildingInfo', { building: buildingItem });
            return;
        }
        this._showPanelAction('build');
    }

    // ═══════════════════════════════════
    // 턴 진행
    // ═══════════════════════════════════
    _startMorningPhase() {
        SaveManager.save(store);  // 아침 시작 자동 저장
        this._updatePhaseDisplay();
        const events = this.eventSystem.generateEvents();
        if (events.length > 0) { this._eventQueue = [...events]; this._showNextEvent(); }
        else { this.turnManager.advancePhase(); this._updatePhaseDisplay(); }
    }

    _showNextEvent() {
        if (this._eventQueue.length === 0) { this.turnManager.advancePhase(); this._updatePhaseDisplay(); return; }
        const evt = this._eventQueue.shift();
        this.scene.launch('EventScene', {
            event: evt, eventSystem: this.eventSystem,
            onComplete: () => { this._refreshActiveTab(); this._updateResources(); this.time.delayedCall(300, () => this._showNextEvent()); }
        });
    }

    _onEndTurn() {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;

        // 방어 배치 0명 경고
        const defenseCount = this.baseManager.getDefenseHeroIds().length;
        if (defenseCount === 0) {
            this._showConfirmPopup(
                '⚠️ 방어 인원 없음',
                '방어에 배치된 영웅이 없습니다.\n습격 시 무방비 상태로 패배합니다.\n\n그래도 턴을 종료하시겠습니까?',
                () => this._doEndTurn()
            );
            return;
        }
        this._doEndTurn();
    }

    _doEndTurn() {
        this._processDayPhase();
        SaveManager.save(store);
        this.turnManager.advancePhase();
        this._updatePhaseDisplay();
        this._processEveningPhase();
    }

    _showConfirmPopup(title, message, onConfirm) {
        this._closeAllPopups();
        this._pushPopup('_confirm', { title, message, onConfirm });
    }

    _popupConfirm(px, py, pw, ph, data) {
        const cx = px + pw / 2;
        this._pp(this.add.text(cx, py + 20, data.title, {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#f04040'
        }).setOrigin(0.5));

        this._pp(this.add.text(cx, py + 70, data.message, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0', align: 'center',
            wordWrap: { width: pw - 40 }
        }).setOrigin(0.5));

        const btnY = py + ph - 45;
        this._pp(this._popupButton(cx - 80, btnY, '취소', () => this._closeAllPopups()));
        this._pp(this._popupButton(cx + 80, btnY, '강행', () => {
            this._closeAllPopups();
            data.onConfirm();
        }));
    }

    _processDayPhase() {
        this.baseManager.processBuildTurn();
        this.baseManager.processResearchTurn();
        this.baseManager.processPioneerTurn();
        const income = this.baseManager.getPassiveIncomeWithBonus();
        if (income > 0) store.setState('gold', (store.getState('gold') || 0) + income);
        // 농장/벌목장 턴당 자원 생산
        if (this.baseManager.hasFacility('farm')) {
            const farmFood = this.balance.farm_food_per_turn ?? 5;
            store.setState('food', (store.getState('food') || 0) + farmFood);
        }
        if (this.baseManager.hasFacility('lumber_mill')) {
            const millWood = this.balance.lumber_mill_wood_per_turn ?? 4;
            store.setState('wood', (store.getState('wood') || 0) + millWood);
        }
        const heroes = this.heroManager.getHeroes();
        // 사냥/채집 상태 → idle 복원 (턴 종료 시)
        for (const h of heroes) {
            if (h.status === 'hunt' || h.status === 'gather' || h.status === 'lumber') h.status = 'idle';
        }
        store.setState('heroes', [...heroes]);
        if (this.baseManager.processHeroRecovery(heroes).length > 0) store.setState('heroes', [...heroes]);
        this._updateBuildings();
    }

    _processEveningPhase() {
        const expResult = this.expeditionManager.resolveExpedition();
        if (expResult) {
            this.scene.launch('ResultScene', {
                expeditionResult: expResult, turn: this.turnManager.getCurrentTurn(), baseManager: this.baseManager,
                onComplete: () => {
                    this._refreshActiveTab(); this._updateResources();
                    if (expResult.isBoss && expResult.victory) {
                        this.scene.start('GameOverScene', { reason: 'victory', day: this.turnManager.getCurrentTurn().day });
                        return;
                    }
                    this._startNightPhase();
                }
            });
        } else { this._startNightPhase(); }
    }

    _startNightPhase() { SaveManager.save(store); this.turnManager.advancePhase(); this._updatePhaseDisplay(); this._processNightPhase(); }

    _processNightPhase() {
        const policyDelta = this.baseManager.getPolicyMoraleEffect();
        if (policyDelta !== 0) for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, policyDelta);
        const turn = this.turnManager.getCurrentTurn();

        // 습격 빈도 체크 (3~5일 간격)
        if (!this.expeditionManager.shouldRaid(turn.day)) {
            // 습격 없는 밤 → 바로 결산
            this._finishNightPhase(turn, null);
            return;
        }

        // 방어 배치된 영웅만 참전
        const defenseHeroIds = this.baseManager.getDefenseHeroIds();
        const allHeroes = this.heroManager.getHeroes();
        const baseHeroes = allHeroes.filter(h =>
            defenseHeroIds.includes(h.id) && h.status !== 'injured'
        );
        const soldiers = store.getState('soldiers') || 0;
        const heroData = baseHeroes.map(h => ({ id: h.id, name: h.name, sinType: h.sinType, appearance: h.appearance || null }));

        if (baseHeroes.length === 0 && soldiers === 0) {
            // 방어 불가 (방어 배치 0명)
            this._finishNightPhase(turn, { victory: false, reason: 'no_defenders', log: [], soldiersLost: 0 });
            return;
        }

        // 적 생성 (balance 기반 스케일링)
        const b = this.balance;
        const raidDivisor = b.raid_scale_divisor ?? 3;
        const scale = Math.floor(turn.day / raidDivisor) + 1;
        const enemies = [];
        for (let i = 0; i < scale + 1; i++) {
            enemies.push({
                name: `습격병 ${i + 1}`,
                hp: (b.defense_enemy_hp_base ?? 30) + turn.day * (b.defense_enemy_hp_per_day ?? 3),
                atk: (b.defense_enemy_atk_base ?? 8) + turn.day * (b.defense_enemy_atk_per_day ?? 1),
                spd: b.defense_enemy_spd ?? 5
            });
        }

        // BattleEngine 실시간 모드로 초기화
        const engine = new BattleEngine(this.balance);
        engine.init(baseHeroes, enemies, 'defense', soldiers, BATTLE_MODES.MELEE);

        const cards = this.registry.get('battleCards') || [];

        // MapDefenseMode 오버레이 시작
        this._defenseMode = new MapDefenseMode(this, {
            engine,
            heroData,
            reserveHeroes: [],
            stageName: `밤 습격 — ${turn.day}일차`,
            cards,
            onComplete: (victory) => {
                this._defenseMode = null;

                // 전투 결과 반영 (영웅 상태 + 병사)
                const result = engine.getResult();
                const heroes = this.heroManager.store.getState('heroes') || [];
                for (const hr of result.heroResults) {
                    const hero = heroes.find(h => h.id === hr.id);
                    if (hero && !hr.alive) hero.status = 'injured';
                }
                this.heroManager.store.setState('heroes', [...heroes]);
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
        this._defenseMode.start();
    }

    /** 밤 페이즈 종료 처리 (방어전 결과 반영 + 결산) */
    _finishNightPhase(turn, defenseResult) {
        // 밤 종료 시 방어 배치 초기화 + 영웅 status 복원
        const defHeroIds = this.baseManager.getDefenseHeroIds();
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            if (hero.status === 'defense' || defHeroIds.includes(hero.id)) {
                hero.status = 'idle';
            }
        }
        store.setState('heroes', [...heroes]);
        this.baseManager.clearDefenseAssignments();

        const b = this.balance;
        if (defenseResult) {
            if (defenseResult.victory) {
                store.setState('gold', (store.getState('gold') || 0) + (b.defense_victory_gold_base ?? 10) + turn.day * (b.defense_victory_gold_per_day ?? 2));
                for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, b.defense_victory_morale ?? 5);
            } else {
                for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, b.defense_defeat_morale ?? -10);
            }
        }
        this._checkSinConditions();
        this.sinSystem.setRampageThreshold(this.baseManager.getRampageThreshold());
        const extremeResults = this.sinSystem.checkExtremes();
        this.scene.launch('SettlementScene', {
            defenseResult: defenseResult || { victory: true, noRaid: true },
            extremeResults, turn, heroes: this.heroManager.getHeroes(),
            onComplete: () => {
                this._refreshActiveTab(); this._updateResources(); this._updateSoldiers(); this._updateBuildings();
                if (this.heroManager.getHeroes().length === 0) {
                    this.scene.start('GameOverScene', { reason: 'defeat', day: turn.day, details: '모든 영웅이 떠났습니다.' });
                    return;
                }
                SaveManager.save(store);
                this.turnManager.advancePhase();
                this._updatePhaseDisplay();
                this._startMorningPhase();
            }
        });
    }

    _checkSinConditions() {
        const b = this.balance;
        for (const hero of this.heroManager.getHeroes()) {
            if (hero.sinType === 'wrath' && hero.location === 'base') {
                hero.daysIdle = (hero.daysIdle || 0) + 1;
                if (hero.daysIdle >= (b.wrath_idle_threshold ?? 3)) this.heroManager.updateMorale(hero.id, b.wrath_idle_morale ?? -5);
            } else if (hero.sinType === 'wrath') { hero.daysIdle = 0; }
            if (hero.sinType === 'sloth' && hero.status !== 'idle') this.heroManager.updateMorale(hero.id, b.sloth_work_morale ?? -3);
            else if (hero.sinType === 'sloth' && hero.status === 'idle') this.heroManager.updateMorale(hero.id, b.sloth_rest_morale ?? 3);
        }
    }
}

export default MapScene;
