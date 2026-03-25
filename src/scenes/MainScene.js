/**
 * 거점 메인 화면 — TheSevenRPG 스타일
 * 상단 HUD | 좌측 탑뷰 거점 맵 | 우측 탭 패널 | 하단 탭 바
 * 탭: 거점 / 영웅 / 장비 / 원정 / 정책
 */
import store from '../store/Store.js';
import TurnManager from '../game_logic/TurnManager.js';
import HeroManager from '../game_logic/HeroManager.js';
import EventSystem from '../game_logic/EventSystem.js';
import BaseManager from '../game_logic/BaseManager.js';
import SinSystem from '../game_logic/SinSystem.js';
import ExpeditionManager from '../game_logic/ExpeditionManager.js';
import SaveManager from '../store/SaveManager.js';

const FONT = 'Galmuri11, Galmuri9, monospace';
const FONT_BOLD = 'Galmuri11 Bold, Galmuri11, monospace';

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

// ═══ 레이아웃 (1280x720) ═══
const HUD_H = 40;
const PANEL_W = 300;
const MAP_W = 980; // 1280 - 300
const PANEL_TAB_H = 36; // 우측 패널 내 탭 높이

// 탭 정의
const TABS = [
    { id: 'base', icon: '🏰', label: '거점' },
    { id: 'hero', icon: '⚔', label: '영웅' },
    { id: 'equip', icon: '🛡', label: '장비' },
    { id: 'expedition', icon: '🗺', label: '원정' },
    { id: 'policy', icon: '📜', label: '정책' },
];

// 건물 슬롯 (맵 전체 높이 사용: HUD_H ~ 720)
const BUILDING_SLOTS = [
    { x: 170, y: 160 }, { x: 400, y: 160 }, { x: 630, y: 160 },
    { x: 170, y: 370 }, { x: 400, y: 370 }, { x: 630, y: 370 },
    { x: 170, y: 570 }, { x: 400, y: 570 }, { x: 630, y: 570 },
];
const PLAZA_INDEX = 4;

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this._activeTab = 'hero';
        this._panelElements = [];
    }

    create() {
        const heroData = this.registry.get('heroData');
        const eventsData = this.registry.get('eventsData');
        const facilitiesData = this.registry.get('facilitiesData');
        this.turnManager = new TurnManager(store);
        this.heroManager = new HeroManager(store, heroData);
        this.eventSystem = new EventSystem(store, eventsData);
        this.baseManager = new BaseManager(store, facilitiesData);
        this.sinSystem = new SinSystem(store, this.registry.get('sinRelations'));
        this.expeditionManager = new ExpeditionManager(store);

        const loaded = this.scene.settings.data?.loaded;
        if (!loaded) {
            // HeroSelectScene에서 골드+영웅 설정 완료
            // 폴백: heroes가 없으면 초기화
            if (!store.getState('heroes') || store.getState('heroes').length === 0) {
                store.setState('gold', 500);
                this.heroManager.initStartingHeroes();
            }
        }

        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(C.bgPrimary);

        this._drawHUD(width);
        this._drawMap(width, height);
        this._drawPanel(width, height);
        this._drawBuildings();
        this._drawGate(height);

        store.subscribe('heroes', () => this._refreshActiveTab());
        store.subscribe('base', () => { this._updateBuildings(); this._refreshActiveTab(); });
        store.subscribe('gold', () => this._updateGold());
        store.subscribe('soldiers', () => this._updateSoldiers());

        this._updateBuildings();
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
        // 배경
        g.fillStyle(C.bgSecondary, 1);
        g.fillRect(0, 0, width, HUD_H);
        // 하단 베벨 라인
        g.lineStyle(1, C.borderDark);
        g.lineBetween(0, HUD_H - 1, width, HUD_H - 1);
        g.lineStyle(2, C.borderSecondary);
        g.lineBetween(0, HUD_H, width, HUD_H);
        // 상단 하이라이트
        g.lineStyle(1, C.borderHighlight, 0.15);
        g.lineBetween(0, 1, width, 1);

        // ── 좌측: 게임 정보 ──
        // 게임 타이틀
        this.add.text(12, HUD_H / 2, 'THE SEVEN', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 1, offsetY: 1, color: '#400000', blur: 0, fill: true }
        }).setOrigin(0, 0.5);

        // 구분선
        const sepG = this.add.graphics();
        sepG.lineStyle(1, C.borderPrimary);
        sepG.lineBetween(120, 8, 120, HUD_H - 8);

        this.dayText = this.add.text(136, HUD_H / 2, '', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: C.textPrimary
        }).setOrigin(0, 0.5);

        this.phaseText = this.add.text(240, HUD_H / 2, '', {
            fontSize: '14px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0, 0.5);

        // 구분선
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

        // ── 우측: 턴종료 + 저장 + 설정 ──
        // 턴 종료 버튼
        this._drawNavButton(width - 220, 6, 70, HUD_H - 12, '턴 종료', C.accentRed, () => this._onEndTurn());

        // 저장 버튼
        this._drawNavButton(width - 140, 6, 50, HUD_H - 12, '저장', C.textMuted, () => {
            SaveManager.save(store);
        });

        // 설정 아이콘
        const settingsIcon = this.add.text(width - 28, HUD_H / 2, '⚙', {
            fontSize: '20px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        settingsIcon.on('pointerover', () => settingsIcon.setColor(C.textPrimary));
        settingsIcon.on('pointerout', () => settingsIcon.setColor(C.textMuted));
        settingsIcon.on('pointerdown', () => {
            // 설정 메뉴 (추후 구현)
        });

        // 구분선 (설정 앞)
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
        // 인셋 하이라이트
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
    // 거점 맵 (좌측)
    // ═══════════════════════════════════
    _drawMap(width, height) {
        const mapH = height - HUD_H;
        const g = this.add.graphics();
        g.fillStyle(C.ground, 1);
        g.fillRect(0, HUD_H, MAP_W, mapH);

        for (let i = 0; i < 60; i++) {
            const x = 30 + Math.random() * (MAP_W - 60);
            const y = HUD_H + 20 + Math.random() * (mapH - 40);
            g.fillStyle(C.grass, 0.3 + Math.random() * 0.3);
            g.fillRect(x, y, 2, 2);
        }

        // 성벽 (RPG 베벨)
        g.fillStyle(C.wall, 1);
        g.fillRect(20, HUD_H + 10, MAP_W - 40, 6);
        g.fillRect(20, HUD_H + mapH - 16, MAP_W - 40, 6);
        g.fillRect(20, HUD_H + 10, 6, mapH - 26);
        g.fillRect(MAP_W - 26, HUD_H + 10, 6, mapH - 26);
        // 하이라이트
        g.lineStyle(1, 0x606878, 0.4);
        g.lineBetween(21, HUD_H + 11, MAP_W - 21, HUD_H + 11);
        g.lineBetween(21, HUD_H + 11, 21, HUD_H + mapH - 17);

        // 패널 구분선
        const divG = this.add.graphics();
        divG.lineStyle(2, C.borderSecondary);
        divG.lineBetween(MAP_W, HUD_H, MAP_W, HUD_H + mapH);
    }

    // ═══════════════════════════════════
    // 우측 패널 (배경 + 탭)
    // ═══════════════════════════════════
    _drawPanel(width, height) {
        const panelX = MAP_W;
        const panelY = HUD_H;
        const panelH = height - HUD_H;

        // 패널 배경
        const g = this.add.graphics();
        g.fillStyle(C.bgPrimary, 1);
        g.fillRect(panelX, panelY, PANEL_W, panelH);

        // 구분선 (맵 | 패널)
        g.lineStyle(2, C.borderSecondary);
        g.lineBetween(panelX, panelY, panelX, panelY + panelH);

        // ── 탭 바 (패널 상단) ──
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

            // 구분선
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

        // 탭 버튼 시각 업데이트
        this._tabButtons.forEach(tb => {
            const isActive = tb.id === tabId;
            tb.bg.clear();
            if (isActive) {
                tb.bg.fillStyle(C.bgTertiary, 1);
                tb.bg.fillRect(tb.x, tb.y, tb.w, PANEL_TAB_H);
                // 하단 빨간 인디케이터
                tb.bg.fillStyle(0xe03030, 1);
                tb.bg.fillRect(tb.x + 2, tb.y + PANEL_TAB_H - 2, tb.w - 4, 2);
            } else {
                tb.bg.fillStyle(C.cardBg, 1);
                tb.bg.fillRect(tb.x, tb.y, tb.w, PANEL_TAB_H);
            }
            tb.label.setColor(isActive ? C.textPrimary : C.textMuted);
        });

        // 패널 콘텐츠 교체
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
        this._clearPanel();
        this._switchTab(this._activeTab);
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

        // 건설/연구 버튼
        this._p(this._panelButton(px + pw / 2, y, '건 설', () => this._openActionOverlay('build')));
        y += 36;
        this._p(this._panelButton(px + pw / 2, y, '연 구', () => this._openActionOverlay('research')));
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
            // 카드 배경 (RPG 베벨)
            this._p(this._outsetPanel(px, y, pw, CARD_H));

            // 이름
            this._p(this.add.text(px + 8, y + 6, hero.name, {
                fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }));

            // 죄종 + 상태
            const sinColor = SIN_COLOR_HEX[hero.sinType] || C.textMuted;
            this._p(this.add.text(px + 8, y + 24, `[${hero.sinName}]`, {
                fontSize: '11px', fontFamily: FONT, color: sinColor
            }));

            const statusMap = { expedition: '원정', injured: '부상', construction: '건설', research: '연구', idle: '대기' };
            this._p(this.add.text(px + pw - 8, y + 24, statusMap[hero.status] || '대기', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));

            // 스탯
            const s = hero.stats;
            this._p(this.add.text(px + 8, y + 40, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality} 감${s.perception} 솔${s.leadership} 매${s.charisma}`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }));

            // 사기 바
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

            y += CARD_H + 6;
        }

        // 고용 버튼
        if (heroes.length < 7) {
            y += 4;
            this._p(this._panelButton(px + pw / 2, y, '영웅 고용', () => this._openActionOverlay('recruit')));
        }

        // HUD 방어 인원
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

        // 스테이지 목록
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

        // 감시탑 정보
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
        this._p(this._panelButton(px + pw / 2, y, '원정 파견', () => this._openActionOverlay('expedition')));
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
        // 외곽
        g.lineStyle(2, C.borderSecondary);
        g.strokeRect(x, y, w, h);
        // 베벨 outset
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
        // 베벨 inset
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

    // ═══════════════════════════════════
    // 건물 + 정문 (기존과 동일)
    // ═══════════════════════════════════
    _drawBuildings() {
        this.buildingSlots = [];
        BUILDING_SLOTS.forEach((slot, i) => {
            if (i === PLAZA_INDEX) { this._drawPlaza(slot.x, slot.y); return; }
            const container = this.add.container(slot.x, slot.y);
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
            const zone = this.add.zone(slot.x, slot.y, 110, 90).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => { bg.clear(); bg.fillStyle(C.buildingHover, 1); bg.fillRoundedRect(-55, -45, 110, 90, 4); bg.lineStyle(1, 0xe03030); bg.strokeRoundedRect(-55, -45, 110, 90, 4); });
            zone.on('pointerout', () => { const built = this._getSlotBuilding(i); const fc = built ? C.building : C.emptySlot; bg.clear(); bg.fillStyle(fc, 1); bg.fillRoundedRect(-55, -45, 110, 90, 4); bg.lineStyle(1, C.borderPrimary); bg.strokeRoundedRect(-55, -45, 110, 90, 4); });
            zone.on('pointerdown', () => this._onSlotClick(i));
            this.buildingSlots.push({ bg, nameText, statusText, heroText, slotIndex: i });
        });
    }

    _drawPlaza(x, y) {
        const g = this.add.graphics();
        g.fillStyle(0x2a2a3a, 0.5); g.fillCircle(x, y, 45);
        g.lineStyle(1, C.borderPrimary, 0.5); g.strokeCircle(x, y, 45);
        this.add.text(x, y - 10, '바알', { fontSize: '14px', fontFamily: FONT_BOLD, color: C.accentRed, shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true } }).setOrigin(0.5);
        this.add.text(x, y + 10, '(판결자)', { fontSize: '9px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5);
        const zone = this.add.zone(x, y, 90, 90).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this._openActionOverlay('policy'));
    }

    _drawGate(height) {
        const gateY = height - 20;
        const gateX = MAP_W / 2;
        const g = this.add.graphics();
        g.fillStyle(C.gate, 1); g.fillRect(gateX - 25, gateY - 3, 50, 5);
        const gateText = this.add.text(gateX, gateY + 8, '[ 원정 ]', { fontSize: '9px', fontFamily: FONT, color: C.expYellow }).setOrigin(0.5);
        const zone = this.add.zone(gateX, gateY + 4, 80, 20).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => gateText.setColor('#ffffff'));
        zone.on('pointerout', () => gateText.setColor(C.expYellow));
        zone.on('pointerdown', () => this._openActionOverlay('expedition'));
    }

    // ═══════════════════════════════════
    // 업데이트 / 턴 진행 (기존 로직 유지)
    // ═══════════════════════════════════
    _updateBuildings() {
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
        built ? this._openActionOverlay('facility', { facility: built }) : this._openActionOverlay('build');
    }

    _startMorningPhase() {
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
        this._processDayPhase(); this.turnManager.advancePhase(); this._updatePhaseDisplay(); this._processEveningPhase();
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
    _startNightPhase() { this.turnManager.advancePhase(); this._updatePhaseDisplay(); this._processNightPhase(); }
    _processNightPhase() {
        const policyDelta = this.baseManager.getPolicyMoraleEffect();
        if (policyDelta !== 0) for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, policyDelta);
        const turn = this.turnManager.getCurrentTurn();
        const defenseResult = this.expeditionManager.simulateDefense(turn.day);
        const baseHeroes = this.heroManager.getBaseHeroes().filter(h => h.status !== 'injured');
        const heroData = baseHeroes.map(h => ({ id: h.id, name: h.name, sinType: h.sinType }));
        const battleSceneKey = this.registry.get('battleScene') || 'BattleSceneB';
        this.scene.launch(battleSceneKey, { log: defenseResult.log || [], victory: defenseResult.victory, stageName: `밤 습격 — ${turn.day}일차`, heroes: heroData,
            onClose: () => {
                if (defenseResult.victory) { store.setState('gold', (store.getState('gold') || 0) + 10 + turn.day * 2); for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, 5); }
                else { for (const h of this.heroManager.getHeroes()) this.heroManager.updateMorale(h.id, -10); }
                this._checkSinConditions(); this.sinSystem.setRampageThreshold(this.baseManager.getRampageThreshold()); const extremeResults = this.sinSystem.checkExtremes();
                this.scene.launch('SettlementScene', { defenseResult, extremeResults, turn, heroes: this.heroManager.getHeroes(),
                    onComplete: () => { this._refreshActiveTab(); this._updateGold(); this._updateSoldiers(); this._updateBuildings();
                        if (this.heroManager.getHeroes().length === 0) { this.scene.start('GameOverScene', { reason: 'defeat', day: turn.day, details: '모든 영웅이 떠났습니다.' }); return; }
                        SaveManager.save(store); this.turnManager.advancePhase(); this._updatePhaseDisplay(); this._startMorningPhase(); } });
            } });
    }
    _checkSinConditions() {
        for (const hero of this.heroManager.getHeroes()) {
            if (hero.sinType === 'wrath' && hero.location === 'base') { hero.daysIdle = (hero.daysIdle || 0) + 1; if (hero.daysIdle >= 3) this.heroManager.updateMorale(hero.id, -5); } else if (hero.sinType === 'wrath') { hero.daysIdle = 0; }
            if (hero.sinType === 'sloth' && hero.status !== 'idle') this.heroManager.updateMorale(hero.id, -3);
            else if (hero.sinType === 'sloth' && hero.status === 'idle') this.heroManager.updateMorale(hero.id, 3);
        }
    }
    _openActionOverlay(mode, data = {}) {
        if (this.turnManager.getCurrentTurn().phase !== 'day') return;
        this.scene.launch('ActionScene', { baseManager: this.baseManager, heroManager: this.heroManager, expeditionManager: this.expeditionManager, initialMode: mode, facilityData: data.facility || null,
            onComplete: () => { this._updateBuildings(); this._refreshActiveTab(); this._updateGold(); this._updateSoldiers(); } });
    }
}

export default MainScene;
