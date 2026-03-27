/**
 * 거점 메인 화면 — 영내/영외 전환
 * 상단 HUD | 좌측 맵(영내/영외) | 우측 탭 패널
 * ActionScene 없이 모든 행동을 우측 패널에서 직접 수행
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
import { FONT, FONT_BOLD } from '../constants.js';

// ═══ 색상 (TheSevenRPG 동일) ═══
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

/** 행동별 핵심 스탯 가중치 */
const ACTION_STATS = {
    build: { primary: ['strength', 'vitality'], label: '건설' },
    research: { primary: ['intellect', 'perception'], label: '연구' },
    hunt: { primary: ['strength', 'agility'], label: '사냥' }
};

// ═══ 레이아웃 (1280x720) ═══
const HUD_H = 40;
const PANEL_W = 300;
const MAP_W = 980;
const PANEL_TAB_H = 36;
const MAP_TAB_H = 32; // 영내/영외 전환 바
const MAP_CONTENT_Y = HUD_H + MAP_TAB_H;

// 탭 정의
const TABS = [
    { id: 'base', icon: '🏰', label: '거점' },
    { id: 'hero', icon: '⚔', label: '영웅' },
    { id: 'equip', icon: '🛡', label: '장비' },
    { id: 'expedition', icon: '🗺', label: '원정' },
    { id: 'policy', icon: '📜', label: '정책' },
];

// 건물 슬롯 (영내 맵)
const BUILDING_SLOTS = [
    { x: 170, y: 180 }, { x: 400, y: 180 }, { x: 630, y: 180 },
    { x: 170, y: 380 }, { x: 400, y: 380 }, { x: 630, y: 380 },
    { x: 170, y: 580 }, { x: 400, y: 580 }, { x: 630, y: 580 },
];
const PLAZA_INDEX = 4;

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this._activeTab = 'hero';
        this._panelElements = [];
        this._mapView = 'inside'; // 'inside' | 'outside'
        this._mapElements = []; // 영내/영외 전환 시 제거할 요소
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
        this.eventSystem = new EventSystem(store, eventsData);
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

        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(C.bgPrimary);

        this._drawHUD(width);
        this._drawMapTabBar(width);
        this._drawMapBackground(width, height);
        this._drawPanel(width, height);

        this._switchMapView('inside');

        store.subscribe('heroes', () => this._refreshActiveTab());
        store.subscribe('base', () => { this._updateBuildings(); this._refreshActiveTab(); });
        store.subscribe('gold', () => this._updateGold());
        store.subscribe('soldiers', () => this._updateSoldiers());

        this._updateGold();
        this._updateSoldiers();
        this._updatePhaseDisplay();
        this._switchTab('hero');

        if (!loaded) {
            this._startMorningPhase();
        } else {
            const turn = this.turnManager.getCurrentTurn();
            if (turn.phase === 'morning') this._startMorningPhase();
        }
    }

    // ═══════════════════════════════════
    // 네비게이션 바 (상단, 전체 폭)
    // ═══════════════════════════════════
    _drawHUD(width) {
        const g = this.add.graphics();
        g.fillStyle(C.bgSecondary, 1);
        g.fillRect(0, 0, width, HUD_H);
        g.lineStyle(1, C.borderDark);
        g.lineBetween(0, HUD_H - 1, width, HUD_H - 1);
        g.lineStyle(2, C.borderSecondary);
        g.lineBetween(0, HUD_H, width, HUD_H);
        g.lineStyle(1, C.borderHighlight, 0.15);
        g.lineBetween(0, 1, width, 1);

        this.add.text(12, HUD_H / 2, 'THE SEVEN', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 1, offsetY: 1, color: '#400000', blur: 0, fill: true }
        }).setOrigin(0, 0.5);

        const sepG = this.add.graphics();
        sepG.lineStyle(1, C.borderPrimary);
        sepG.lineBetween(120, 8, 120, HUD_H - 8);

        this.dayText = this.add.text(136, HUD_H / 2, '', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: C.textPrimary
        }).setOrigin(0, 0.5);

        this.phaseText = this.add.text(240, HUD_H / 2, '', {
            fontSize: '14px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0, 0.5);

        const sepG2 = this.add.graphics();
        sepG2.lineStyle(1, C.borderPrimary);
        sepG2.lineBetween(340, 8, 340, HUD_H - 8);

        this.goldText = this.add.text(356, HUD_H / 2, '', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: C.expYellow
        }).setOrigin(0, 0.5);

        this.defenseText = this.add.text(480, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0, 0.5);

        this.soldierText = this.add.text(600, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0, 0.5);

        this._drawNavButton(width - 220, 6, 70, HUD_H - 12, '턴 종료', C.accentRed, () => this._onEndTurn());
        this._drawNavButton(width - 140, 6, 50, HUD_H - 12, '저장', C.textMuted, () => { SaveManager.save(store); });

        // 전투씬 A/B 전환 (임시 테스트 버튼)
        const currentScene = this.registry.get('battleScene') || 'BattleSceneA';
        const label = currentScene === 'BattleSceneA' ? '전투:A' : '전투:B';
        this._battleToggleBtn = this.add.text(width - 80, HUD_H / 2, `[${label}]`, {
            fontSize: '10px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this._battleToggleBtn.on('pointerdown', () => {
            const cur = this.registry.get('battleScene') || 'BattleSceneA';
            const next = cur === 'BattleSceneA' ? 'BattleSceneB' : 'BattleSceneA';
            this.registry.set('battleScene', next);
            this.expeditionManager.setBattleMode(next === 'BattleSceneA' ? 'melee' : 'tag');
            const newLabel = next === 'BattleSceneA' ? '전투:A' : '전투:B';
            this._battleToggleBtn.setText(`[${newLabel}]`);
        });

        const settingsIcon = this.add.text(width - 28, HUD_H / 2, '⚙', {
            fontSize: '20px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        settingsIcon.on('pointerover', () => settingsIcon.setColor(C.textPrimary));
        settingsIcon.on('pointerout', () => settingsIcon.setColor(C.textMuted));

        const sepG3 = this.add.graphics();
        sepG3.lineStyle(1, C.borderPrimary);
        sepG3.lineBetween(width - 48, 8, width - 48, HUD_H - 8);
    }

    _drawNavButton(x, y, w, h, label, accentColor, callback) {
        const bg = this.add.graphics();
        bg.fillStyle(C.cardBg, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, C.borderSecondary);
        bg.strokeRect(x, y, w, h);
        bg.lineStyle(1, C.borderHighlight, 0.12);
        bg.lineBetween(x + 1, y + 1, x + w - 1, y + 1);
        bg.lineStyle(1, C.borderDark, 0.4);
        bg.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);

        const text = this.add.text(x + w / 2, y + h / 2, label, {
            fontSize: '11px', fontFamily: FONT, color: accentColor
        }).setOrigin(0.5);

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
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
            bg.lineStyle(1, C.borderHighlight, 0.12); bg.lineBetween(x + 1, y + 1, x + w - 1, y + 1);
            bg.lineStyle(1, C.borderDark, 0.4); bg.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);
            text.setColor(accentColor);
        });
        zone.on('pointerdown', callback);
    }

    // ═══════════════════════════════════
    // 영내/영외 전환 바
    // ═══════════════════════════════════
    _drawMapTabBar(width) {
        const y = HUD_H;
        const g = this.add.graphics();
        g.fillStyle(C.bgSecondary, 1);
        g.fillRect(0, y, MAP_W, MAP_TAB_H);
        g.lineStyle(1, C.borderSecondary);
        g.lineBetween(0, y + MAP_TAB_H, MAP_W, y + MAP_TAB_H);

        const halfW = MAP_W / 2;
        this._mapTabBtns = {};

        ['inside', 'outside'].forEach((view, i) => {
            const label = view === 'inside' ? '🏰 영내' : '🗺 영외';
            const tx = i * halfW;

            const tabBg = this.add.graphics();
            const tabText = this.add.text(tx + halfW / 2, y + MAP_TAB_H / 2, label, {
                fontSize: '13px', fontFamily: FONT_BOLD, color: C.textMuted
            }).setOrigin(0.5);

            const zone = this.add.zone(tx + halfW / 2, y + MAP_TAB_H / 2, halfW, MAP_TAB_H)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => this._switchMapView(view));

            // 구분선
            if (i > 0) {
                const dg = this.add.graphics();
                dg.lineStyle(1, C.borderPrimary);
                dg.lineBetween(tx, y + 4, tx, y + MAP_TAB_H - 4);
            }

            this._mapTabBtns[view] = { bg: tabBg, text: tabText, x: tx, w: halfW, y };
        });
    }

    _switchMapView(view) {
        this._mapView = view;

        // 탭 시각 업데이트
        for (const [key, btn] of Object.entries(this._mapTabBtns)) {
            const isActive = key === view;
            btn.bg.clear();
            if (isActive) {
                btn.bg.fillStyle(C.bgTertiary, 1);
                btn.bg.fillRect(btn.x, btn.y, btn.w, MAP_TAB_H);
                btn.bg.fillStyle(0xe03030, 1);
                btn.bg.fillRect(btn.x + 2, btn.y + MAP_TAB_H - 2, btn.w - 4, 2);
            }
            btn.text.setColor(isActive ? C.textPrimary : C.textMuted);
        }

        // 맵 콘텐츠 전환
        this._clearMapElements();
        if (view === 'inside') {
            this._drawBuildings();
            this._updateBuildings();
        } else {
            this._drawOutsideMap();
        }
    }

    _clearMapElements() {
        this._mapElements.forEach(el => el.destroy());
        this._mapElements = [];
        this.buildingSlots = [];
    }

    _m(element) {
        this._mapElements.push(element);
        return element;
    }

    // ═══════════════════════════════════
    // 맵 배경 (고정)
    // ═══════════════════════════════════
    _drawMapBackground(width, height) {
        const mapH = height - HUD_H - MAP_TAB_H;
        const g = this.add.graphics();
        g.fillStyle(C.ground, 1);
        g.fillRect(0, MAP_CONTENT_Y, MAP_W, mapH);

        for (let i = 0; i < 60; i++) {
            const x = 30 + Math.random() * (MAP_W - 60);
            const y = MAP_CONTENT_Y + 20 + Math.random() * (mapH - 40);
            g.fillStyle(C.grass, 0.3 + Math.random() * 0.3);
            g.fillRect(x, y, 2, 2);
        }

        // 패널 구분선
        const divG = this.add.graphics();
        divG.lineStyle(2, C.borderSecondary);
        divG.lineBetween(MAP_W, HUD_H, MAP_W, height);
    }

    // ═══════════════════════════════════
    // 영내 맵 (건물 + 성벽)
    // ═══════════════════════════════════
    _drawBuildings() {
        const mapH = 720 - MAP_CONTENT_Y;

        // 성벽
        const wallG = this._m(this.add.graphics());
        wallG.fillStyle(C.wall, 1);
        wallG.fillRect(20, MAP_CONTENT_Y + 10, MAP_W - 40, 6);
        wallG.fillRect(20, MAP_CONTENT_Y + mapH - 16, MAP_W - 40, 6);
        wallG.fillRect(20, MAP_CONTENT_Y + 10, 6, mapH - 26);
        wallG.fillRect(MAP_W - 26, MAP_CONTENT_Y + 10, 6, mapH - 26);
        wallG.lineStyle(1, 0x606878, 0.4);
        wallG.lineBetween(21, MAP_CONTENT_Y + 11, MAP_W - 21, MAP_CONTENT_Y + 11);
        wallG.lineBetween(21, MAP_CONTENT_Y + 11, 21, MAP_CONTENT_Y + mapH - 17);

        this.buildingSlots = [];
        BUILDING_SLOTS.forEach((slot, i) => {
            if (i === PLAZA_INDEX) { this._drawPlaza(slot.x, slot.y); return; }
            const container = this._m(this.add.container(slot.x, slot.y));
            const bg = this.add.graphics();
            bg.fillStyle(C.emptySlot, 1);
            bg.fillRoundedRect(-55, -45, 110, 90, 4);
            bg.lineStyle(1, C.borderPrimary);
            bg.strokeRoundedRect(-55, -45, 110, 90, 4);
            container.add(bg);
            const nameText = this.add.text(0, -16, '+건설', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5);
            container.add(nameText);
            const statusText = this.add.text(0, 4, '', { fontSize: '9px', fontFamily: FONT, color: C.textSecondary }).setOrigin(0.5);
            container.add(statusText);
            const heroText = this.add.text(0, 20, '', { fontSize: '9px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5);
            container.add(heroText);
            const zone = this._m(this.add.zone(slot.x, slot.y, 110, 90).setInteractive({ useHandCursor: true }));
            zone.on('pointerover', () => { bg.clear(); bg.fillStyle(C.buildingHover, 1); bg.fillRoundedRect(-55, -45, 110, 90, 4); bg.lineStyle(1, 0xe03030); bg.strokeRoundedRect(-55, -45, 110, 90, 4); });
            zone.on('pointerout', () => { const built = this._getSlotBuilding(i); const fc = built ? C.building : C.emptySlot; bg.clear(); bg.fillStyle(fc, 1); bg.fillRoundedRect(-55, -45, 110, 90, 4); bg.lineStyle(1, C.borderPrimary); bg.strokeRoundedRect(-55, -45, 110, 90, 4); });
            zone.on('pointerdown', () => this._onSlotClick(i));
            this.buildingSlots.push({ bg, nameText, statusText, heroText, slotIndex: i });
        });
    }

    _drawPlaza(x, y) {
        const g = this._m(this.add.graphics());
        g.fillStyle(0x2a2a3a, 0.5); g.fillCircle(x, y, 45);
        g.lineStyle(1, C.borderPrimary, 0.5); g.strokeCircle(x, y, 45);
        this._m(this.add.text(x, y - 10, '바알', { fontSize: '14px', fontFamily: FONT_BOLD, color: C.accentRed, shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true } }).setOrigin(0.5));
        this._m(this.add.text(x, y + 10, '(판결자)', { fontSize: '9px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5));
        const zone = this._m(this.add.zone(x, y, 90, 90).setInteractive({ useHandCursor: true }));
        zone.on('pointerdown', () => this._showPanelAction('policy'));
    }

    // ═══════════════════════════════════
    // 영외 맵 (원정 스테이지 + 사냥)
    // ═══════════════════════════════════
    _drawOutsideMap() {
        const mapH = 720 - MAP_CONTENT_Y;
        const cx = MAP_W / 2;
        const cardCy = MAP_CONTENT_Y + mapH / 2;

        // 3장 카드: 채집 / 원정 / 사냥
        const CARD_W = 240;
        const CARD_H = 360;
        const GAP = 30;
        const totalW = CARD_W * 3 + GAP * 2;
        const startX = (MAP_W - totalW) / 2;

        const cards = [
            { icon: '🌿', title: '채집', desc: '거점 주변에서\n자원을 채집합니다', color: 0x30b050, colorHex: '#30b050', action: () => this._showPanelAction('gather') },
            { icon: '⚔️', title: '원정', desc: '챕터 스테이지로\n파티를 파견합니다', color: 0xe03030, colorHex: '#e03030', action: () => this._showPanelAction('expeditionList') },
            { icon: '🏹', title: '사냥', desc: '영웅 1명을\n사냥에 보냅니다', color: 0xd0a020, colorHex: '#d0a020', action: () => this._showPanelAction('hunt') },
        ];

        cards.forEach((card, i) => {
            const cardX = startX + i * (CARD_W + GAP);
            const cardY = cardCy - CARD_H / 2;

            // 카드 배경
            const bg = this._m(this.add.graphics());
            this._drawOutsideCard(bg, cardX, cardY, CARD_W, CARD_H, card.color, false);

            // 아이콘
            this._m(this.add.text(cardX + CARD_W / 2, cardY + CARD_H * 0.3, card.icon, {
                fontSize: '64px', fontFamily: FONT
            }).setOrigin(0.5));

            // 타이틀
            this._m(this.add.text(cardX + CARD_W / 2, cardY + CARD_H * 0.58, card.title, {
                fontSize: '24px', fontFamily: FONT_BOLD, color: card.colorHex,
                shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5));

            // 설명
            this._m(this.add.text(cardX + CARD_W / 2, cardY + CARD_H * 0.72, card.desc, {
                fontSize: '11px', fontFamily: FONT, color: C.textSecondary,
                align: 'center', lineSpacing: 6
            }).setOrigin(0.5));

            // 상태 정보
            let statusText = '';
            let statusColor = C.textMuted;
            if (i === 1) { // 원정
                const expedition = store.getState('expedition');
                const progress = this.expeditionManager.getProgress();
                if (expedition && expedition.active) { statusText = '원정 진행 중...'; statusColor = C.warningOrange; }
                else { statusText = `챕터 ${progress.chapter}`; statusColor = C.textMuted; }
            }
            if (statusText) {
                this._m(this.add.text(cardX + CARD_W / 2, cardY + CARD_H * 0.85, statusText, {
                    fontSize: '10px', fontFamily: FONT, color: statusColor
                }).setOrigin(0.5));
            }

            // 인터랙션
            const zone = this._m(this.add.zone(cardX + CARD_W / 2, cardCy, CARD_W, CARD_H).setInteractive({ useHandCursor: true }));
            zone.on('pointerover', () => this._drawOutsideCard(bg, cardX, cardY, CARD_W, CARD_H, card.color, true));
            zone.on('pointerout', () => this._drawOutsideCard(bg, cardX, cardY, CARD_W, CARD_H, card.color, false));
            zone.on('pointerdown', card.action);
        });
    }

    _drawOutsideCard(bg, x, y, w, h, accentColor, hover) {
        bg.clear();
        bg.fillStyle(hover ? C.bgTertiary : C.bgSecondary, 1);
        bg.fillRoundedRect(x, y, w, h, 6);
        bg.lineStyle(2, hover ? accentColor : C.borderSecondary);
        bg.strokeRoundedRect(x, y, w, h, 6);
        // 상단 컬러 바
        bg.fillStyle(accentColor, hover ? 0.8 : 0.5);
        bg.fillRect(x + 3, y + 3, w - 6, 4);
        // 베벨
        bg.lineStyle(1, C.borderHighlight, hover ? 0.3 : 0.15);
        bg.lineBetween(x + 3, y + 3, x + w - 3, y + 3);
        bg.lineBetween(x + 3, y + 3, x + 3, y + h - 3);
        bg.lineStyle(1, C.borderDark, 0.5);
        bg.lineBetween(x + w - 3, y + 3, x + w - 3, y + h - 3);
        bg.lineBetween(x + 3, y + h - 3, x + w - 3, y + h - 3);
    }

    // ═══════════════════════════════════
    // 우측 패널 (배경 + 탭)
    // ═══════════════════════════════════
    _drawPanel(width, height) {
        const panelX = MAP_W;
        const panelY = HUD_H;
        const panelH = height - HUD_H;

        const g = this.add.graphics();
        g.fillStyle(C.bgPrimary, 1);
        g.fillRect(panelX, panelY, PANEL_W, panelH);
        g.lineStyle(2, C.borderSecondary);
        g.lineBetween(panelX, panelY, panelX, panelY + panelH);

        const tabY = panelY;
        const tabG = this.add.graphics();
        tabG.fillStyle(C.bgSecondary, 1);
        tabG.fillRect(panelX, tabY, PANEL_W, PANEL_TAB_H);
        tabG.lineStyle(1, C.borderSecondary);
        tabG.lineBetween(panelX, tabY + PANEL_TAB_H, panelX + PANEL_W, tabY + PANEL_TAB_H);

        this._tabButtons = [];
        const tabW = Math.floor(PANEL_W / TABS.length);

        TABS.forEach((tab, i) => {
            const tx = panelX + i * tabW;
            const tw = i === TABS.length - 1 ? panelX + PANEL_W - tx : tabW;

            const tabBg = this.add.graphics();
            const tabIcon = this.add.text(tx + tw / 2, tabY + 10, tab.icon, {
                fontSize: '14px', fontFamily: FONT
            }).setOrigin(0.5);
            const tabLabel = this.add.text(tx + tw / 2, tabY + 26, tab.label, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);

            if (i > 0) {
                const divG = this.add.graphics();
                divG.lineStyle(1, C.borderPrimary);
                divG.lineBetween(tx, tabY + 4, tx, tabY + PANEL_TAB_H - 4);
            }

            const zone = this.add.zone(tx + tw / 2, tabY + PANEL_TAB_H / 2, tw, PANEL_TAB_H)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => this._switchTab(tab.id));

            this._tabButtons.push({ id: tab.id, bg: tabBg, icon: tabIcon, label: tabLabel, x: tx, w: tw, y: tabY });
        });
    }

    _switchTab(tabId) {
        this._activeTab = tabId;
        this._actionMode = null; // 행동 모드 초기화

        this._tabButtons.forEach(tb => {
            const isActive = tb.id === tabId;
            tb.bg.clear();
            if (isActive) {
                tb.bg.fillStyle(C.bgTertiary, 1);
                tb.bg.fillRect(tb.x, tb.y, tb.w, PANEL_TAB_H);
                tb.bg.fillStyle(0xe03030, 1);
                tb.bg.fillRect(tb.x + 2, tb.y + PANEL_TAB_H - 2, tb.w - 4, 2);
            } else {
                tb.bg.fillStyle(C.cardBg, 1);
                tb.bg.fillRect(tb.x, tb.y, tb.w, PANEL_TAB_H);
            }
            tb.label.setColor(isActive ? C.textPrimary : C.textMuted);
        });

        this._clearPanel();
        switch (tabId) {
            case 'base': this._renderBaseTab(); break;
            case 'hero': this._renderHeroTab(); break;
            case 'equip': this._renderEquipTab(); break;
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
        this._panelElements.push(element);
        return element;
    }

    // ═══════════════════════════════════
    // 행동 분기: 건물 관련 → 팝업 / 영외 관련 → 패널
    // ═══════════════════════════════════
    _showPanelAction(mode, data = {}) {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;
        this._actionMode = mode;
        this._actionData = data;

        // 건물 관련 행동 → 중앙 팝업
        const popupModes = ['build', 'research', 'facility', 'policy', 'recruit', 'heroSelect'];
        if (popupModes.includes(mode)) {
            this._showPopup(mode, data);
            return;
        }

        // 영외 관련 행동 → 우측 패널
        this._clearPanel();
        switch (mode) {
            case 'expedition': this._renderExpeditionAction(data.stageIndex); break;
            case 'expeditionList': this._renderExpeditionListAction(); break;
            case 'hunt': this._renderHuntAction(); break;
            case 'gather': this._renderGatherAction(); break;
            case 'soldierSelect': this._renderSoldierSelectAction(data); break;
        }
    }

    _closePanelAction() {
        this._actionMode = null;
        this._actionData = null;
        this._closePopup();
        this._switchTab(this._activeTab);
    }

    // ═══════════════════════════════════
    // 중앙 팝업 시스템
    // ═══════════════════════════════════
    _showPopup(mode, data = {}) {
        this._closePopup();
        this._popupElements = [];

        const { width, height } = this.scale;

        // 반투명 배경
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
            .setInteractive().setDepth(100);
        this._popupElements.push(overlay);

        // 팝업 크기
        const PW = 560;
        const PH = mode === 'heroDetail' ? 680 : 520;
        const px = (width - PW) / 2;
        const py = (height - PH) / 2;

        // 팝업 배경
        const popBg = this.add.graphics().setDepth(101);
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
        this._popupElements.push(popBg);

        switch (mode) {
            case 'build': this._popupBuild(px, py, PW, PH); break;
            case 'research': this._popupResearch(px, py, PW, PH); break;
            case 'facility': this._popupFacility(px, py, PW, PH, data.facility); break;
            case 'policy': this._popupPolicy(px, py, PW, PH); break;
            case 'recruit': this._popupRecruit(px, py, PW, PH); break;
            case 'heroSelect': this._popupHeroSelect(px, py, PW, PH, data); break;
            case 'heroDetail': this._popupHeroDetail(px, py, PW, PH, data.hero); break;
        }
    }

    _closePopup() {
        if (this._popupElements) {
            this._popupElements.forEach(el => el.destroy());
            this._popupElements = [];
        }
    }

    _pp(element) {
        if (!this._popupElements) this._popupElements = [];
        element.setDepth(102);
        this._popupElements.push(element);
        return element;
    }

    _popupCloseBtn(px, py, pw, ph) {
        const cx = px + pw / 2;
        const y = py + ph - 40;
        this._pp(this._popupButton(cx, y, '닫기', () => {
            this._closePopup();
            this._actionMode = null;
            this._actionData = null;
        }));
    }

    _popupButton(cx, cy, label, callback) {
        const bw = 140, bh = 30;
        const x = cx - bw / 2, y = cy - bh / 2;
        const container = this.add.container(0, 0).setDepth(102);

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
        const container = this.add.container(0, 0).setDepth(102);

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
                this._pp(this.add.text(px + iw - 8, y + 6, `${cost}G / ${f.build_turns}턴`, {
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
                this._pp(this.add.text(px + iw - 8, y + 6, `${r.cost}G / ${r.turns}턴`, {
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
                ibg.fillStyle(C.bgSecondary, 1); ibg.fillRect(px + 20, y, iw, 56);
                ibg.lineStyle(1, C.borderSecondary); ibg.strokeRect(px + 20, y, iw, 56);

                this._pp(this.add.text(px + 32, y + 6, hero.name, {
                    fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._pp(this.add.text(px + 32, y + 24, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));
                this._pp(this.add.text(px + 200, y + 24, `적합도: ${stars}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                }));

                const s = hero.stats;
                this._pp(this.add.text(px + 32, y + 40, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality} 감${s.perception} 솔${s.leadership} 매${s.charisma}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                }));

                this._pp(this._popupSmallBtn(px + iw - 10, y + 20, '투입', () => {
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

                y += 62;
            }
        }

        // 뒤로가기
        this._pp(this._popupButton(cx - 80, py + ph - 40, '← 뒤로', () => {
            this._showPopup(actionType === 'build' ? 'build' : 'research');
        }));
        this._pp(this._popupButton(cx + 80, py + ph - 40, '닫기', () => {
            this._closePopup(); this._actionMode = null; this._actionData = null;
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

        // ── 상단 카드 영역 ──
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

        // 죄종 색상 상단 바
        const sinBarG = this._pp(this.add.graphics());
        sinBarG.fillStyle(sinColor, 0.6);
        sinBarG.fillRect(cardX + 2, y + 2, cardW - 4, 4);

        // 초상화
        const portSize = 100;
        const portX = cardX + 12;
        const portY = y + 18;
        const portG = this._pp(this.add.graphics());
        portG.fillStyle(0x0e0e1a, 1);
        portG.fillRect(portX, portY, portSize, portSize);
        portG.lineStyle(1, C.borderSecondary);
        portG.strokeRect(portX, portY, portSize, portSize);

        // 스프라이트 (걷기 애니메이션)
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

        // 이름 + [죄종] (같은 줄)
        const infoX = portX + portSize + 16;
        let ty = portY + 4;
        const nameObj = this._pp(this.add.text(infoX, ty, hero.name, {
            fontSize: '22px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }));
        this._pp(this.add.text(infoX + nameObj.width + 10, ty + 4, `[${hero.sinName}]`, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: sinColorHex
        }));
        this._pp(this.add.text(infoX + nameObj.width + 10, ty + 22, `비용 ${hero.foodCost ?? '?'}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: '#a08040'
        }));
        ty += 30;

        // 배경 스토리
        const storyText = this._getHeroStory(hero.sinType);
        this._pp(this.add.text(infoX, ty, storyText, {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted,
            lineSpacing: 3,
            wordWrap: { width: cardW - portSize - 46 }
        }));

        // 상태
        const statusMap = { expedition: '원정', injured: '부상', construction: '건설', research: '연구', idle: '대기', hunt: '사냥', gather: '채집' };
        this._pp(this.add.text(cardX + cardW - 12, y + 10, statusMap[hero.status] || '대기', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(1, 0));

        y += cardH + 10;

        // ── 사기 바 (기본 스탯 바로 위) ──
        const moraleState = this.heroManager.getMoraleState(hero.morale);
        const moraleColor = MORALE_COLORS_HEX[moraleState];
        const moraleName = this.heroManager.getMoraleStateName(hero.morale);
        const mBarX = px + 32;
        const mBarW = pw - 160;
        this._pp(this.add.text(mBarX, y - 2, '사기', {
            fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
        }));
        const mBarStartX = mBarX + 36;
        const mBg = this._pp(this.add.graphics());
        mBg.fillStyle(0x0e0e1a, 1);
        mBg.fillRect(mBarStartX, y + 2, mBarW, 10);
        mBg.lineStyle(1, C.borderPrimary);
        mBg.strokeRect(mBarStartX, y + 2, mBarW, 10);
        const mFill = this._pp(this.add.graphics());
        const mfw = Math.max(0, (hero.morale / 100) * (mBarW - 2));
        mFill.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
        mFill.fillRect(mBarStartX + 1, y + 3, mfw, 8);
        this._pp(this.add.text(mBarStartX + mBarW + 8, y - 2, `${hero.morale} (${moraleName})`, {
            fontSize: '13px', fontFamily: FONT_BOLD, color: moraleColor
        }));
        y += 22;

        // ── 스탯 영역 ──
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
            const textObj = this.add.text(tx, y, ` ${label} `, {
                fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
            });
            this._pp(textObj);
            const tw = textObj.width;
            // 선: 라벨 왼쪽 + 라벨 오른쪽 (라벨을 피해서 그림)
            const lineG = this._pp(this.add.graphics());
            lineG.lineStyle(1, C.borderSecondary, 0.6);
            lineG.lineBetween(px + margin, lineY, tx - 6, lineY);
            lineG.lineBetween(tx + tw + 6, lineY, px + pw - margin, lineY);
            y += 22;
        };

        const _drawStatRow = (xPos, yPos, label, val, labelW = 36, barW = statBarMaxW) => {
            const valColor = val >= 15 ? '#40d870' : val >= 10 ? '#40a0f8' : val >= 7 ? '#f8b830' : '#f04040';
            const valColorHex = Phaser.Display.Color.HexStringToColor(valColor).color;
            this._pp(this.add.text(xPos, yPos, label, { fontSize: '12px', fontFamily: FONT, color: C.textSecondary }));
            const bx = xPos + labelW;
            const bw = barW;
            const bh = 10;
            const by = yPos + 3;
            const g = this._pp(this.add.graphics());
            g.fillStyle(0x0e0e1a, 1);
            g.fillRect(bx, by, bw, bh);
            g.lineStyle(1, C.borderPrimary, 0.6);
            g.strokeRect(bx, by, bw, bh);
            const fw = Math.max(0, Math.min(1, val / statMax)) * (bw - 2);
            g.fillStyle(valColorHex, 1);
            g.fillRect(bx + 1, by + 1, fw, bh - 2);
            this._pp(this.add.text(bx + bw + 6, yPos, `${val}`, { fontSize: '12px', fontFamily: FONT_BOLD, color: valColor }));
        };

        // ■ 기본
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
            _drawStatRow(xPos, y, st.label, s[st.key], 40);
            if (i % 2 === 1 || i === statLabels.length - 1) y += rowH;
        }
        y += sectionGap;

        // ■ 행동
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
            _drawStatRow(xPos, y, act.label, val, 48);
            if (i % 2 === 1 || i === actionStats.length - 1) y += rowH;
        }
        y += sectionGap;

        // ■ 감정
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
            _drawStatRow(xPos, y, st.label, val, 48);
            if (i % 2 === 1 || i === subLabels.length - 1) y += rowH;
        }
        y += sectionGap;
        const endLineG = this._pp(this.add.graphics());
        endLineG.lineStyle(1, C.borderSecondary, 0.6);
        endLineG.lineBetween(px + margin, y, px + pw - margin, y);

        // 하단 버튼
        this._pp(this._popupButton(cx - 80, py + ph - 40, '해고', () => {
            this.heroManager.dismissHero(hero.id);
            this._closePopup();
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

        this._pp(this.add.text(cx, y, `${currentCount}/7명 | 고용비: 100G | 보유: ${gold}G`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const iw = pw - 40;
        if (currentCount >= 7) {
            this._pp(this.add.text(cx, y + 40, '로스터가 가득 찼습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else if (gold < 100) {
            this._pp(this.add.text(cx, y + 40, '골드가 부족합니다.', {
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
    // 행동: 원정 스테이지 목록 (영외 카드에서 진입)
    // ═══════════════════════════════════
    _renderExpeditionListAction() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        const progress = this.expeditionManager.getProgress();
        const expedition = store.getState('expedition');
        const isActive = expedition && expedition.active;

        this._p(this._sectionTitle(px, y, `원정 — 챕터 ${progress.chapter}`));
        y += 22;

        if (isActive) {
            this._p(this.add.text(px + 8, y, '원정 진행 중...', {
                fontSize: '11px', fontFamily: FONT, color: C.warningOrange
            }));
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

    // ═══════════════════════════════════
    // 행동: 채집
    // ═══════════════════════════════════
    _renderGatherAction() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        this._p(this._sectionTitle(px, y, '채집 — 영웅 선택'));
        y += 22;

        this._p(this.add.text(px + 8, y, '영웅 1명을 채집에 보냅니다\n자원과 소량의 골드를 획득합니다', {
            fontSize: '9px', fontFamily: FONT, color: C.textSecondary,
            lineSpacing: 4
        }));
        y += 34;

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        if (heroes.length === 0) {
            this._p(this.add.text(px + 8, y, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;

                this._p(this._outsetPanel(px, y, pw, 42));
                this._p(this.add.text(px + 8, y + 6, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._p(this.add.text(px + 8, y + 22, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));

                this._p(this._smallPanelBtn(px + pw - 50, y + 8, '파견', () => this._doGather(hero)));
                y += 48;
            }
        }

        y += 10;
        this._p(this._panelButton(px + pw / 2, y, '← 돌아가기', () => this._closePanelAction()));
    }

    _doGather(hero) {
        const turn = store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;
        const goldReward = (b.gather_base_gold ?? 10) + Math.floor(Math.random() * day * 2);

        const gold = store.getState('gold') || 0;
        store.setState('gold', gold + goldReward);
        this.heroManager.updateMorale(hero.id, b.gather_morale ?? 2);

        this._updateGold();
        this._refreshActiveTab();
        this._closePanelAction();
    }

    // ═══════════════════════════════════
    // 행동: 원정 파견
    // ═══════════════════════════════════
    _renderExpeditionAction(stageIndex) {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

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
            this._p(this.add.text(px + 8, y, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }));
        } else if (soldiers === 0) {
            this._p(this.add.text(px + 8, y, '병사가 없습니다', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }));
        } else {
            // 파티 미리보기
            const party = heroes.slice(0, Math.min(3, heroes.length));
            this._p(this.add.text(px + 8, y, `파티: ${party.map(h => h.name).join(', ')}`, {
                fontSize: '11px', fontFamily: FONT, color: C.infoCyan
            }));
            y += 20;

            // 병사 배정으로 이동
            this._p(this._panelButton(px + pw / 2, y, '병사 배정 →', () => {
                this._showPanelAction('soldierSelect', { stageIndex, party });
            }));
        }

        y += 40;
        this._p(this._panelButton(px + pw / 2, y, '← 돌아가기', () => this._closePanelAction()));
    }

    // ═══════════════════════════════════
    // 행동: 병사 배정
    // ═══════════════════════════════════
    _renderSoldierSelectAction(data) {
        const { stageIndex, party } = data;
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        const progress = this.expeditionManager.getProgress();
        const stage = progress.stages[stageIndex];
        const soldiers = store.getState('soldiers') || 0;

        this._p(this._sectionTitle(px, y, '병사 배정'));
        y += 22;

        this._p(this.add.text(px + 8, y, `목표: ${stage.name}`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 16;
        this._p(this.add.text(px + 8, y, `사용 가능: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.expYellow
        }));
        y += 26;

        let selectedCount = Math.min(10, soldiers);
        const countText = this._p(this.add.text(px + pw / 2, y, `${selectedCount}명`, {
            fontSize: '24px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 30;

        // 수량 조절
        const btnCx = px + pw / 2;
        this._p(this._smallPanelBtn(btnCx - 80, y, '-10', () => { selectedCount = Math.max(1, selectedCount - 10); countText.setText(`${selectedCount}명`); }));
        this._p(this._smallPanelBtn(btnCx - 30, y, '-1', () => { selectedCount = Math.max(1, selectedCount - 1); countText.setText(`${selectedCount}명`); }));
        this._p(this._smallPanelBtn(btnCx + 30, y, '+1', () => { selectedCount = Math.min(soldiers, selectedCount + 1); countText.setText(`${selectedCount}명`); }));
        this._p(this._smallPanelBtn(btnCx + 80, y, '+10', () => { selectedCount = Math.min(soldiers, selectedCount + 10); countText.setText(`${selectedCount}명`); }));
        y += 30;
        this._p(this._smallPanelBtn(btnCx, y, '전체', () => { selectedCount = soldiers; countText.setText(`${selectedCount}명`); }));
        y += 36;

        // 파견 버튼
        this._p(this._panelButton(px + pw / 2, y, '⚔️ 파견 출발', () => {
            const partyIds = party.map(h => h.id);
            const result = this.expeditionManager.dispatch(partyIds, stageIndex, selectedCount);
            if (result.success) {
                this._refreshActiveTab();
                this._updateSoldiers();
                if (this._mapView === 'outside') {
                    this._clearMapElements();
                    this._drawOutsideMap();
                }
                this._closePanelAction();
            }
        }));

        y += 40;
        this._p(this._panelButton(px + pw / 2, y, '← 돌아가기', () => {
            this._showPanelAction('expedition', { stageIndex });
        }));
    }

    // ═══════════════════════════════════
    // 행동: 사냥
    // ═══════════════════════════════════
    _renderHuntAction() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        this._p(this._sectionTitle(px, y, '사냥 — 영웅 선택'));
        y += 22;

        this._p(this.add.text(px + 8, y, '영웅 1명을 사냥에 보냅니다', {
            fontSize: '9px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 18;

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        if (heroes.length === 0) {
            this._p(this.add.text(px + 8, y, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }));
        } else {
            for (const hero of heroes) {
                const stars = this._calcFitness(hero, ACTION_STATS.hunt.primary);
                const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;

                this._p(this._outsetPanel(px, y, pw, 52));
                this._p(this.add.text(px + 8, y + 6, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                this._p(this.add.text(px + 8, y + 22, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                }));
                this._p(this.add.text(px + pw / 2, y + 22, `적합도: ${stars}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                }));

                const s = hero.stats;
                this._p(this.add.text(px + 8, y + 36, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                }));

                this._p(this._smallPanelBtn(px + pw - 50, y + 8, '파견', () => this._launchHunt(hero)));
                y += 58;
            }
        }

        y += 10;
        this._p(this._panelButton(px + pw / 2, y, '← 돌아가기', () => this._closePanelAction()));
    }

    _launchHunt(hero) {
        const turn = store.getState('turn');
        const day = (turn && turn.day) || 1;
        const b = this.balance;

        // CSV hunt_enemies 데이터 사용
        const huntEnemies = this.registry.get('huntEnemies') || [];
        const template = huntEnemies[Math.floor(Math.random() * huntEnemies.length)];
        if (!template) return;

        const scale = 1 + (day - 1) * 0.1;
        const enemy = {
            name: template.name,
            hp: Math.floor(template.base_hp * scale),
            atk: Math.floor(template.base_atk * scale),
            spd: template.spd
        };

        const goldReward = (b.hunt_gold_base ?? 15) + day * (b.hunt_gold_per_day ?? 3);

        this.scene.launch('DuelBattleScene', {
            hero,
            enemy,
            stageName: `사냥 — ${template.name}`,
            onClose: (result) => {
                if (result.victory) {
                    const gold = store.getState('gold') || 0;
                    store.setState('gold', gold + goldReward);
                    this.heroManager.updateMorale(hero.id, b.hunt_win_morale ?? 3);
                } else {
                    hero.status = 'injured';
                    store.setState('heroes', [...this.heroManager.getHeroes()]);
                    this.heroManager.updateMorale(hero.id, b.hunt_lose_morale ?? -5);
                }
                this._refreshActiveTab();
                this._updateGold();
            }
        });
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
        this._closePopup();
        this._actionMode = null;
        this._actionData = null;
        this._refreshActiveTab();
        this._updateGold();
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
        this._closePopup();
        this._actionMode = null;
        this._actionData = null;
        this._refreshActiveTab();
    }

    // ═══════════════════════════════════
    // 탭: 거점
    // ═══════════════════════════════════
    _renderBaseTab() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        this._p(this._sectionTitle(px, y, '시설 현황'));
        y += 22;

        const built = this.baseManager.getBuiltFacilities();
        const building = this.baseManager.getCurrentBuilding();
        const researching = this.baseManager.getCurrentResearch();

        if (built.length === 0 && !building) {
            this._p(this.add.text(px + 8, y, '건설된 시설 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }));
            y += 20;
        } else {
            for (const f of built) {
                this._p(this._insetPanel(px, y, pw, 24));
                this._p(this.add.text(px + 8, y + 5, `✓ ${f.name_ko}`, {
                    fontSize: '11px', fontFamily: FONT, color: C.successGreen
                }));
                y += 30;
            }
        }

        if (building) {
            this._p(this._insetPanel(px, y, pw, 24));
            this._p(this.add.text(px + 8, y + 5, `🔨 ${building.name} (${building.turnsLeft}턴)`, {
                fontSize: '11px', fontFamily: FONT, color: C.infoCyan
            }));
            y += 30;
        }

        if (researching) {
            this._p(this._insetPanel(px, y, pw, 24));
            this._p(this.add.text(px + 8, y + 5, `📖 ${researching.name} (${researching.turnsLeft}턴)`, {
                fontSize: '11px', fontFamily: FONT, color: C.infoCyan
            }));
            y += 30;
        }

        y += 10;
        this._p(this._sectionTitle(px, y, '수입/지출'));
        y += 22;
        const income = this.baseManager.getPassiveIncomeWithBonus();
        this._p(this.add.text(px + 8, y, `턴당 수입: ${income}G`, {
            fontSize: '11px', fontFamily: FONT, color: C.expYellow
        }));
        y += 20;

        const policyEffect = this.baseManager.getPolicyMoraleEffect();
        const pColor = policyEffect >= 0 ? C.successGreen : C.accentRed;
        this._p(this.add.text(px + 8, y, `포고령 효과: 사기 ${policyEffect >= 0 ? '+' : ''}${policyEffect}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: pColor
        }));
        y += 30;

        if (!building) {
            this._p(this._panelButton(px + pw / 2, y, '건 설', () => this._showPanelAction('build')));
            y += 36;
        }
        if (!researching) {
            this._p(this._panelButton(px + pw / 2, y, '연 구', () => this._showPanelAction('research')));
        }
    }

    // ═══════════════════════════════════
    // 탭: 영웅
    // ═══════════════════════════════════
    _renderHeroTab() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        const heroes = this.heroManager.getHeroes();
        this._p(this._sectionTitle(px, y, `영웅 (${heroes.length}/7)`));
        y += 22;

        const CARD_H = 78;
        for (const hero of heroes) {
            this._p(this._outsetPanel(px, y, pw, CARD_H));

            this._p(this.add.text(px + 8, y + 6, hero.name, {
                fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }));

            const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;
            this._p(this.add.text(px + 8, y + 24, `[${hero.sinName}]`, {
                fontSize: '11px', fontFamily: FONT, color: sinColor
            }));

            const statusMap = { expedition: '원정', injured: '부상', construction: '건설', research: '연구', idle: '대기' };
            this._p(this.add.text(px + pw - 8, y + 24, statusMap[hero.status] || '대기', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));

            const s = hero.stats;
            this._p(this.add.text(px + 8, y + 40, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality} 감${s.perception} 솔${s.leadership} 매${s.charisma}`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }));

            const moraleState = this.heroManager.getMoraleState(hero.morale);
            const moraleColor = MORALE_COLORS_HEX[moraleState];
            const barX = px + 8;
            const barY = y + CARD_H - 16;
            const barW = pw - 50;
            const barH = 6;

            const mBarBg = this._p(this.add.graphics());
            mBarBg.fillStyle(0x0e0e1a, 1);
            mBarBg.fillRect(barX, barY, barW, barH);
            mBarBg.lineStyle(1, C.borderPrimary);
            mBarBg.strokeRect(barX, barY, barW, barH);

            const mBar = this._p(this.add.graphics());
            const fillW = Math.max(0, (hero.morale / 100) * barW);
            mBar.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
            mBar.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);

            this._p(this.add.text(barX + barW + 6, barY - 2, `${hero.morale}`, {
                fontSize: '11px', fontFamily: FONT_BOLD, color: moraleColor
            }));

            // 카드 클릭 → 영웅 상세 팝업
            const cardZone = this._p(this.add.zone(px + pw / 2, y + CARD_H / 2, pw, CARD_H).setInteractive({ useHandCursor: true }));
            const heroRef = hero;
            cardZone.on('pointerdown', () => this._showPopup('heroDetail', { hero: heroRef }));

            y += CARD_H + 6;
        }

        if (heroes.length < 7) {
            y += 4;
            this._p(this._panelButton(px + pw / 2, y, '영웅 고용', () => this._showPanelAction('recruit')));
        }

        const baseHeroes = this.heroManager.getBaseHeroes().filter(h => h.status !== 'injured');
        this.defenseText.setText(`방어:${baseHeroes.length}명`);
    }

    // ═══════════════════════════════════
    // 탭: 장비
    // ═══════════════════════════════════
    _renderEquipTab() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        this._p(this._sectionTitle(px, y, '장비 (Phase 2)'));
        y += 30;

        this._p(this.add.text(px + pw / 2, y, '장비 시스템은\nPhase 2에서 구현됩니다.', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted,
            align: 'center', lineSpacing: 6
        }).setOrigin(0.5, 0));
    }

    // ═══════════════════════════════════
    // 탭: 원정
    // ═══════════════════════════════════
    _renderExpeditionTab() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        const progress = this.expeditionManager.getProgress();
        const expedition = store.getState('expedition');

        this._p(this._sectionTitle(px, y, `원정 — 챕터 ${progress.chapter}`));
        y += 22;

        if (expedition && expedition.active) {
            this._p(this._insetPanel(px, y, pw, 30));
            this._p(this.add.text(px + 8, y + 8, '원정 진행 중...', {
                fontSize: '11px', fontFamily: FONT, color: C.warningOrange
            }));
            y += 40;
        }

        progress.stages.forEach((stage, i) => {
            const unlocked = stage.unlocked;
            const color = unlocked ? C.textPrimary : C.textMuted;
            const icon = stage.isBoss ? '👑 ' : unlocked ? '▸ ' : '✕ ';

            this._p(this._insetPanel(px, y, pw, 28));
            this._p(this.add.text(px + 8, y + 7, `${icon}${stage.name}`, {
                fontSize: '11px', fontFamily: FONT, color
            }));
            this._p(this.add.text(px + pw - 8, y + 7, `적 ${stage.enemies}체`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));
            y += 34;
        });

        y += 10;
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        this._p(this.add.text(px + 8, y, `파견 가능: ${heroes.length}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 24;

        const turn = this.turnManager.getCurrentTurn();
        const raidInfo = this.baseManager.getRaidInfo(turn.day);
        this._p(this._sectionTitle(px, y, '감시탑 정보'));
        y += 22;
        this._p(this.add.text(px + 8, y, raidInfo.text, {
            fontSize: '11px', fontFamily: FONT, color: C.warningOrange
        }));
        y += 16;
        if (raidInfo.detail) {
            this._p(this.add.text(px + 8, y, raidInfo.detail, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }));
            y += 20;
        }

        y += 10;
        this._p(this.add.text(px + pw / 2, y, '영외 → 원정 카드를\n클릭하여 파견하세요', {
            fontSize: '9px', fontFamily: FONT, color: C.textMuted,
            align: 'center', lineSpacing: 4
        }).setOrigin(0.5, 0));
    }

    // ═══════════════════════════════════
    // 탭: 정책
    // ═══════════════════════════════════
    _renderPolicyTab() {
        const px = MAP_W + 8;
        const pw = PANEL_W - 16;
        let y = HUD_H + PANEL_TAB_H + 10;

        const base = store.getState('base');
        const policies = base.policies;

        this._p(this._sectionTitle(px, y, '포고령'));
        y += 22;

        const currentEffect = this.baseManager.getPolicyMoraleEffect();
        const eColor = currentEffect >= 0 ? C.successGreen : C.accentRed;
        this._p(this.add.text(px + 8, y, `현재 효과: 전체 사기 ${currentEffect >= 0 ? '+' : ''}${currentEffect}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: eColor
        }));
        y += 26;

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
            this._p(this.add.text(px + 8, y, pDef.label, {
                fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
            }));
            y += 20;

            for (const opt of pDef.options) {
                const isCurrent = policies[pDef.key] === opt.value;
                const marker = isCurrent ? '●' : '○';
                const optColor = isCurrent ? opt.color : C.textMuted;

                const optBg = this._p(this.add.graphics());
                optBg.fillStyle(isCurrent ? 0x1e1e34 : C.inputBg, 1);
                optBg.fillRect(px + 4, y, pw - 8, 22);
                optBg.lineStyle(1, isCurrent ? 0xe03030 : C.borderPrimary);
                optBg.strokeRect(px + 4, y, pw - 8, 22);

                this._p(this.add.text(px + 12, y + 4, `${marker} ${opt.label}`, {
                    fontSize: '11px', fontFamily: FONT, color: optColor
                }));

                const zone = this._p(this.add.zone(px + pw / 2, y + 11, pw - 8, 22)
                    .setInteractive({ useHandCursor: true }));
                const pKey = pDef.key;
                const pVal = opt.value;
                zone.on('pointerdown', () => {
                    this.baseManager.setPolicy(pKey, pVal);
                    this._refreshActiveTab();
                });

                y += 26;
            }
            y += 8;
        }
    }

    // ═══════════════════════════════════
    // 적합도 계산
    // ═══════════════════════════════════
    _calcFitness(hero, primaryStats) {
        let total = 0;
        for (const stat of primaryStats) {
            total += hero.stats[stat] || 0;
        }
        const avg = total / primaryStats.length;
        if (avg >= 16) return '★★★★★';
        if (avg >= 13) return '★★★★☆';
        if (avg >= 10) return '★★★☆☆';
        if (avg >= 7) return '★★☆☆☆';
        return '★☆☆☆☆';
    }

    // ═══════════════════════════════════
    // 패널 UI 헬퍼 (RPG 베벨 스타일)
    // ═══════════════════════════════════
    _sectionTitle(x, y, text) {
        const t = this.add.text(x + 4, y, text, {
            fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
        });
        const g = this.add.graphics();
        g.lineStyle(1, C.borderPrimary);
        g.lineBetween(x, y + 18, x + PANEL_W - 16, y + 18);
        this._p(g);
        return t;
    }

    _outsetPanel(x, y, w, h) {
        const g = this.add.graphics();
        g.fillStyle(C.bgSecondary, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, C.borderSecondary);
        g.strokeRect(x, y, w, h);
        g.lineStyle(1, C.borderHighlight, 0.3);
        g.lineBetween(x + 2, y + 2, x + w - 2, y + 2);
        g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        g.lineStyle(1, C.borderDark, 0.6);
        g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2);
        g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
        return g;
    }

    _insetPanel(x, y, w, h) {
        const g = this.add.graphics();
        g.fillStyle(C.inputBg, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, C.borderPrimary);
        g.strokeRect(x, y, w, h);
        g.lineStyle(1, C.borderDark, 0.6);
        g.lineBetween(x + 2, y + 2, x + w - 2, y + 2);
        g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        g.lineStyle(1, C.borderHighlight, 0.3);
        g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2);
        g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
        return g;
    }

    _panelButton(cx, y, label, callback) {
        const bw = 160, bh = 30;
        const x = cx - bw / 2;
        const container = this.add.container(0, 0);

        const bg = this.add.graphics();
        bg.fillStyle(C.cardBg, 1);
        bg.fillRect(x, y, bw, bh);
        bg.lineStyle(2, C.borderSecondary);
        bg.strokeRect(x, y, bw, bh);
        bg.lineStyle(1, C.borderHighlight, 0.2);
        bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2);
        bg.lineStyle(1, C.borderDark, 0.5);
        bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2);
        container.add(bg);

        const text = this.add.text(cx, y + bh / 2, label, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);
        container.add(text);

        const zone = this.add.zone(cx, y + bh / 2, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, bw, bh);
            bg.lineStyle(2, 0xe03030); bg.strokeRect(x, y, bw, bh);
            text.setColor('#fff');
        });
        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh);
            bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh);
            bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2);
            bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2);
            text.setColor(C.textSecondary);
        });
        zone.on('pointerdown', callback);
        container.add(zone);

        return container;
    }

    _smallPanelBtn(cx, cy, label, callback) {
        const w = 50, h = 24;
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
    // 건물 업데이트 / 슬롯 클릭
    // ═══════════════════════════════════
    _updateBuildings() {
        if (this._mapView !== 'inside' || !this.buildingSlots) return;
        const builtFacilities = this.baseManager.getBuiltFacilities();
        const building = this.baseManager.getCurrentBuilding();
        this.buildingSlots.forEach((slot, i) => {
            const builtItem = builtFacilities[i] || null;
            const isBuilding = building && !builtItem && i === builtFacilities.length;
            if (builtItem) {
                slot.nameText.setText(builtItem.name_ko).setColor(C.textPrimary);
                slot.statusText.setText('');
                slot.bg.clear(); slot.bg.fillStyle(C.building, 1); slot.bg.fillRoundedRect(-55, -45, 110, 90, 4); slot.bg.lineStyle(1, C.borderPrimary); slot.bg.strokeRoundedRect(-55, -45, 110, 90, 4);
            } else if (isBuilding) {
                slot.nameText.setText(building.name).setColor(C.infoCyan);
                slot.statusText.setText(`건설 중 (${building.turnsLeft}턴)`);
                slot.bg.clear(); slot.bg.fillStyle(0x1e2e1e, 1); slot.bg.fillRoundedRect(-55, -45, 110, 90, 4); slot.bg.lineStyle(1, 0x40a060); slot.bg.strokeRoundedRect(-55, -45, 110, 90, 4);
            } else {
                slot.nameText.setText('+건설').setColor(C.textMuted); slot.statusText.setText(''); slot.heroText.setText('');
                slot.bg.clear(); slot.bg.fillStyle(C.emptySlot, 1); slot.bg.fillRoundedRect(-55, -45, 110, 90, 4); slot.bg.lineStyle(1, C.borderPrimary); slot.bg.strokeRoundedRect(-55, -45, 110, 90, 4);
            }
        });
    }

    _updateGold() { this.goldText.setText(`${store.getState('gold') || 0}G`); }
    _updateSoldiers() { this.soldierText.setText(`병사:${store.getState('soldiers') || 0}명`); }
    _updatePhaseDisplay() {
        const turn = this.turnManager.getCurrentTurn();
        this.dayText.setText(`Day ${turn.day}`);
        this.phaseText.setText(`[${this.turnManager.getPhaseName()}]`);
    }

    _getSlotBuilding(i) { return this.baseManager.getBuiltFacilities()[i] || null; }
    _onSlotClick(i) {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;
        const built = this._getSlotBuilding(i);
        built ? this._showPanelAction('facility', { facility: built }) : this._showPanelAction('build');
    }

    // ═══════════════════════════════════
    // 턴 진행 (기존 로직 유지)
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
        this.scene.launch('EventScene', { event: evt, eventSystem: this.eventSystem, onComplete: () => { this._refreshActiveTab(); this._updateGold(); this.time.delayedCall(300, () => this._showNextEvent()); } });
    }
    _onEndTurn() {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;
        this._processDayPhase(); SaveManager.save(store); this.turnManager.advancePhase(); this._updatePhaseDisplay(); this._processEveningPhase();
    }
    _processDayPhase() {
        this.baseManager.processBuildTurn(); this.baseManager.processResearchTurn();
        const income = this.baseManager.getPassiveIncomeWithBonus();
        if (income > 0) store.setState('gold', (store.getState('gold') || 0) + income);
        const heroes = this.heroManager.getHeroes();
        if (this.baseManager.processHeroRecovery(heroes).length > 0) store.setState('heroes', [...heroes]);
        this._updateBuildings();
    }
    _processEveningPhase() {
        const expResult = this.expeditionManager.resolveExpedition();
        if (expResult) {
            this.scene.launch('ResultScene', { expeditionResult: expResult, turn: this.turnManager.getCurrentTurn(), baseManager: this.baseManager,
                onComplete: () => { this._refreshActiveTab(); this._updateGold(); if (expResult.isBoss && expResult.victory) { this.scene.start('GameOverScene', { reason: 'victory', day: this.turnManager.getCurrentTurn().day }); return; } this._startNightPhase(); } });
        } else { this._startNightPhase(); }
    }
    _startNightPhase() { SaveManager.save(store); this.turnManager.advancePhase(); this._updatePhaseDisplay(); this._processNightPhase(); }
    _processNightPhase() {
        const policyDelta = this.baseManager.getPolicyMoraleEffect();
        if (policyDelta !== 0) for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, policyDelta);
        const turn = this.turnManager.getCurrentTurn();
        const defenseResult = this.expeditionManager.simulateDefense(turn.day);
        const baseHeroes = this.heroManager.getBaseHeroes().filter(h => h.status !== 'injured');
        const heroData = baseHeroes.map(h => ({ id: h.id, name: h.name, sinType: h.sinType, appearance: h.appearance || null }));
        const battleSceneKey = this.registry.get('battleScene') || 'BattleSceneB';
        this.scene.launch(battleSceneKey, { log: defenseResult.log || [], victory: defenseResult.victory, stageName: `밤 습격 — ${turn.day}일차`, heroes: heroData,
            onClose: () => {
                const b = this.balance;
                if (defenseResult.victory) { store.setState('gold', (store.getState('gold') || 0) + (b.defense_victory_gold_base ?? 10) + turn.day * (b.defense_victory_gold_per_day ?? 2)); for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, b.defense_victory_morale ?? 5); }
                else { for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, b.defense_defeat_morale ?? -10); }
                this._checkSinConditions(); this.sinSystem.setRampageThreshold(this.baseManager.getRampageThreshold()); const extremeResults = this.sinSystem.checkExtremes();
                this.scene.launch('SettlementScene', { defenseResult, extremeResults, turn, heroes: this.heroManager.getHeroes(),
                    onComplete: () => { this._refreshActiveTab(); this._updateGold(); this._updateSoldiers(); this._updateBuildings();
                        if (this.heroManager.getHeroes().length === 0) { this.scene.start('GameOverScene', { reason: 'defeat', day: turn.day, details: '모든 영웅이 떠났습니다.' }); return; }
                        SaveManager.save(store); this.turnManager.advancePhase(); this._updatePhaseDisplay(); this._startMorningPhase(); } });
            } });
    }
    _checkSinConditions() {
        const b = this.balance;
        for (const hero of this.heroManager.getHeroes()) {
            if (hero.sinType === 'wrath' && hero.location === 'base') { hero.daysIdle = (hero.daysIdle || 0) + 1; if (hero.daysIdle >= (b.wrath_idle_threshold ?? 3)) this.heroManager.updateMorale(hero.id, b.wrath_idle_morale ?? -5); } else if (hero.sinType === 'wrath') { hero.daysIdle = 0; }
            if (hero.sinType === 'sloth' && hero.status !== 'idle') this.heroManager.updateMorale(hero.id, b.sloth_work_morale ?? -3);
            else if (hero.sinType === 'sloth' && hero.status === 'idle') this.heroManager.updateMorale(hero.id, b.sloth_rest_morale ?? 3);
        }
    }
}

export default MainScene;
