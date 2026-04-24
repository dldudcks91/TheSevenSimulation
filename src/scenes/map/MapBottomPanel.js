/**
 * MapBottomPanel — 하단 패널 (탭 바 + 6개 탭 렌더러 + 패널 액션)
 * MapScene에서 분리된 모듈. scene 참조를 통해 매니저/위젯에 접근.
 */
import { C, SIN_COLOR_HEX, PANEL_Y, PANEL_H, PANEL_TAB_H, PANEL_CONTENT_Y, TABS } from './MapConstants.js';
import { FONT, FONT_BOLD } from '../../constants.js';
import store from '../../store/Store.js';
import { topSin, weightedSinRoll, SIN_NAMES_KO } from '../../game_logic/SinUtils.js';
import locale from '../../game_logic/LocaleManager.js';

const SIN_THOUGHTS = {
    wrath: {
        stable: ['훈련장에서 허수아비를 박살내고 있습니다', '칼날에 기름칠을 하며 콧노래를 부릅니다', '아무한테나 팔씨름을 걸고 있습니다'],
        high: ['이를 갈며 무기를 만지작거립니다', '주먹으로 벽을 치기 시작했습니다', '눈이 충혈되어 있습니다'],
        low: ['벽만 바라보며 아무 말도 하지 않습니다', '무기를 내려놓고 멍하니 앉아 있습니다', '싸울 이유를 잃은 눈빛입니다'],
    },
    envy: {
        stable: ['다른 영웅의 장비를 흘끔흘끔 쳐다봅니다', '누군가의 전공 기록을 뒤적이고 있습니다', '거울을 보며 한숨을 쉽니다'],
        high: ['다른 영웅들을 노려보고 있습니다', '누군가의 소지품을 만지다 들켰습니다', '"왜 항상 저 사람만..." 중얼거립니다'],
        low: ['자기 방에서 나오지 않습니다', '아무도 자기를 필요로 하지 않는다고 생각합니다', '존재감을 지우려는 듯 구석에 앉아 있습니다'],
    },
    greed: {
        stable: ['자기 소지품을 세고 또 세고 있습니다', '빈 주머니를 뒤지며 혀를 찹니다', '전리품 분배표를 혼자 작성하고 있습니다'],
        high: ['창고 근처를 서성이고 있습니다', '자원 장부를 자기 멋대로 고치려 합니다', '"이건 내 거야" 라는 말을 자주 합니다'],
        low: ['짐을 싸기 시작했습니다', '여기 있으면 손해라는 계산이 끝난 모양입니다', '가치 없는 것들을 하나씩 버리고 있습니다'],
    },
    sloth: {
        stable: ['양지바른 곳에서 낮잠 중입니다', '하품을 하며 구름을 세고 있습니다', '해먹을 만들어 달라고 요청했습니다'],
        high: ['모두에게 "그만두자"고 말하고 다닙니다', '"뭘 해도 소용없다"는 분위기를 퍼뜨립니다', '다른 영웅의 의욕까지 빨아들이고 있습니다'],
        low: ['며칠째 잠만 자고 있습니다', '숨소리조차 귀찮은 듯합니다', '존재를 잊힐 정도로 조용합니다'],
    },
    gluttony: {
        stable: ['주방에서 뭔가 만들어 먹고 있습니다', '간식을 주머니에 잔뜩 넣고 다닙니다', '오늘 저녁 메뉴를 벌써 세 번 물어봤습니다'],
        high: ['식량을 혼자 끌어안고 있습니다', '배급량을 두 배로 달라고 고함칩니다', '비상 식량에 손을 대기 시작했습니다'],
        low: ['아무것도 먹지 않습니다', '음식을 보고도 손을 뻗지 않습니다', '식욕을 잃었습니다'],
    },
    lust: {
        stable: ['누군가에게 꽃을 꺾어주고 있습니다', '동료에게 노래를 불러주고 있습니다', '손편지를 쓰다 숨기고 있습니다'],
        high: ['특정 동료에게 집착하고 있습니다', '"떨어지면 안 돼"를 반복하고 있습니다', '동료의 일거수일투족을 따라다닙니다'],
        low: ['아무도 만나려 하지 않습니다', '혼자 있으면서도 외로워 보입니다', '관계를 포기한 듯 벽을 세우고 있습니다'],
    },
    pride: {
        stable: ['거울 앞에서 자세를 교정하고 있습니다', '후배 영웅에게 일장 연설 중입니다', '자기 전공 기록을 다듬고 있습니다'],
        high: ['명령을 무시하기 시작했습니다', '"내가 이끌어야 한다"고 주장합니다', '바알의 판단에 공개적으로 이의를 제기합니다'],
        low: ['자존심이 무너져 침묵합니다', '고개를 숙이고 다닙니다', '누구도 자기를 인정하지 않는다고 느낍니다'],
    },
};

const STATUS_ACTIVITY = {
    idle: { location: '거점', activity: '대기 중' },
    expedition: { location: '영외', activity: '원정 중' },
    hunt: { location: '영외', activity: '사냥 중' },
    gather: { location: '영외', activity: '채집 중' },
    lumber: { location: '영외', activity: '벌목 중' },
    construction: { location: '거점', activity: '건설 중' },
    research: { location: '거점', activity: '연구 중' },
    injured: { location: '거점', activity: '부상 치료 중' },
    defense: { location: '거점', activity: '방어 배치' },
};

function getHeroThought(hero) {
    const sin = weightedSinRoll(hero.sinStats);
    const domSinVal = hero.sinStats?.[weightedSinRoll(hero.sinStats)] ?? 10;
    const level = domSinVal >= 15 ? 'high' : domSinVal <= 5 ? 'low' : 'stable';
    const pool = SIN_THOUGHTS[sin]?.[level];
    if (!pool || pool.length === 0) return '특이사항 없음';
    return pool[Math.floor(Math.random() * pool.length)];
}

function getHeroActivity(hero) {
    const info = STATUS_ACTIVITY[hero.status] || STATUS_ACTIVITY.idle;
    return `📍${info.location} — ${info.activity}`;
}

class MapBottomPanel {
    constructor(scene) {
        this.scene = scene;
        this._panelElements = [];
        this._activeTab = 'hero';
        this._actionMode = null;
        this._actionData = null;
        this._tabButtons = [];
    }

    // ═══════════════════════════════════
    // 패널 그리기 (탭 바 + 탭 버튼)
    // ═══════════════════════════════════
    draw() {
        const s = this.scene;
        const panelBg = s.add.graphics().setDepth(200);
        panelBg.fillStyle(C.bgPrimary, 1);
        panelBg.fillRect(0, PANEL_Y, 1280, PANEL_H);
        panelBg.lineStyle(2, C.borderSecondary);
        panelBg.lineBetween(0, PANEL_Y, 1280, PANEL_Y);

        const tabBg = s.add.graphics().setDepth(200);
        tabBg.fillStyle(C.bgSecondary, 1);
        tabBg.fillRect(0, PANEL_Y, 1280, PANEL_TAB_H);
        tabBg.lineStyle(1, C.borderSecondary);
        tabBg.lineBetween(0, PANEL_Y + PANEL_TAB_H, 1280, PANEL_Y + PANEL_TAB_H);

        this._tabButtons = [];
        const tabW = Math.floor(1280 / TABS.length);

        TABS.forEach((tab, i) => {
            const tx = i * tabW;
            const tw = i === TABS.length - 1 ? 1280 - tx : tabW;

            const bg = s.add.graphics().setDepth(201);
            const icon = s.add.text(tx + tw / 2 - 10, PANEL_Y + PANEL_TAB_H / 2, tab.icon, {
                fontSize: '13px', fontFamily: FONT
            }).setOrigin(0.5).setDepth(201);
            const label = s.add.text(tx + tw / 2 + 10, PANEL_Y + PANEL_TAB_H / 2,
                tab.labelKey ? locale.t(tab.labelKey) : tab.label, {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0, 0.5).setDepth(201);

            if (i > 0) {
                const divG = s.add.graphics().setDepth(201);
                divG.lineStyle(1, C.borderPrimary);
                divG.lineBetween(tx, PANEL_Y + 4, tx, PANEL_Y + PANEL_TAB_H - 4);
            }

            const zone = s.add.zone(tx + tw / 2, PANEL_Y + PANEL_TAB_H / 2, tw, PANEL_TAB_H)
                .setInteractive({ useHandCursor: true }).setDepth(201);
            zone.on('pointerdown', () => this.switchTab(tab.id));

            this._tabButtons.push({ id: tab.id, bg, icon, label, x: tx, w: tw });
        });
    }

    // ═══════════════════════════════════
    // 탭 전환
    // ═══════════════════════════════════
    switchTab(tabId) {
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

        this.clearPanel();
        switch (tabId) {
            case 'base': this.renderBaseTab(); break;
            case 'hero': this.renderHeroTab(); break;
            case 'item': this.renderItemTab(); break;
            case 'expedition': this.renderExpeditionTab(); break;
            case 'edict': this.renderEdictTab(); break;
            case 'bestiary': this.renderBestiaryTab(); break;
        }
    }

    // ═══════════════════════════════════
    // 현재 탭 새로고침
    // ═══════════════════════════════════
    refreshActiveTab() {
        if (this._actionMode) {
            this.scene._showPanelAction(this._actionMode, this._actionData);
        } else {
            this.clearPanel();
            this.switchTab(this._activeTab);
        }
    }

    // ═══════════════════════════════════
    // 패널 요소 정리 / 추가
    // ═══════════════════════════════════
    clearPanel() {
        this._panelElements.forEach(el => el.destroy());
        this._panelElements = [];
    }

    p(element) {
        if (element) element.setDepth(202);
        this._panelElements.push(element);
        return element;
    }

    // ═══════════════════════════════════
    // 탭: 영웅
    // ═══════════════════════════════════
    renderHeroTab() {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        const pw = 400;
        let y = PANEL_CONTENT_Y + 8;

        const heroes = s.heroManager.getHeroes();
        this.p(w.sectionTitle(px, y, `영웅 (${heroes.length}/7)`));
        y += 22;

        // 가로 배치 (하단 패널은 넓으므로)
        const CARD_W = 180;
        const CARD_H = 170;
        const GAP = 8;
        let cx = px;

        for (const hero of heroes) {
            if (cx + CARD_W > 1260) { cx = px; y += CARD_H + GAP; }

            this.p(w.outsetPanel(cx, y, CARD_W, CARD_H));

            this.p(s.add.text(cx + 8, y + 6, hero.name, {
                fontSize: '12px', fontFamily: FONT_BOLD, color: C.textPrimary,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }));

            if (hero.trait) {
                this.p(s.widgets.traitLabel(cx + 8, y + 22, hero.trait, { fontSize: '10px', pp: obj => this.p(obj) }));
            } else {
                this.p(s.add.text(cx + 8, y + 22, SIN_NAMES_KO[topSin(hero.sinStats)], {
                    fontSize: '10px', fontFamily: FONT, color: C.textMuted
                }));
            }

            // 현재 위치 + 활동
            const activityText = getHeroActivity(hero);
            const actColor = hero.status === 'injured' ? '#f04040' : hero.status === 'idle' ? C.textMuted : '#40a0f8';
            this.p(s.add.text(cx + 8, y + 38, activityText, {
                fontSize: '9px', fontFamily: FONT_BOLD, color: actColor
            }));

            // 현재 생각 (말풍선 느낌)
            const thought = getHeroThought(hero);
            this.p(s.add.text(cx + 8, y + 54, `"${thought}"`, {
                fontSize: '8px', fontFamily: FONT, color: '#a0a0c0',
                fontStyle: 'italic',
                wordWrap: { width: CARD_W - 16 },
                lineSpacing: 1
            }));

            // 주 죄종 수치 바
            const domSin = topSin(hero.sinStats);
            const domVal = hero.sinStats?.[domSin] ?? 1;
            const isRampaging = hero.isRampaging || domVal >= 18;
            const sinBarColor = isRampaging ? '#e03030' : SIN_COLOR_HEX[domSin];
            const barX = cx + 8;
            const barY = y + CARD_H - 16;
            const barW = CARD_W - 50;
            const barH = 6;

            const mBarBg = this.p(s.add.graphics());
            mBarBg.fillStyle(0x0e0e1a, 1); mBarBg.fillRect(barX, barY, barW, barH);
            mBarBg.lineStyle(1, C.borderPrimary); mBarBg.strokeRect(barX, barY, barW, barH);

            const mBar = this.p(s.add.graphics());
            const fillW = Math.max(0, (domVal / 20) * barW);
            mBar.fillStyle(Phaser.Display.Color.HexStringToColor(sinBarColor).color, 1);
            mBar.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);

            this.p(s.add.text(barX + barW + 6, barY - 2, `${domVal}${isRampaging ? '!' : ''}`, {
                fontSize: '10px', fontFamily: FONT_BOLD, color: sinBarColor
            }));

            const cardZone = this.p(s.add.zone(cx + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true }));
            const heroRef = hero;
            cardZone.on('pointerdown', () => s._showPopup('heroDetail', { hero: heroRef }));

            cx += CARD_W + GAP;
        }

        if (heroes.length < 7 && s.baseManager.hasFacility('tavern')) {
            this.p(w.smallPanelBtn(cx + 40, y + 40, '고용', () => s._showPanelAction('recruit')));
        }

        const defenseCount = s.baseManager.getDefenseHeroIds().length;
        s.defenseText.setText(`방어:${defenseCount}명`);
        s.defenseText.setColor(defenseCount === 0 ? '#f04040' : C.textSecondary);
    }

    // ═══════════════════════════════════
    // 탭: 시설
    // ═══════════════════════════════════
    renderBaseTab() {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        this.p(w.sectionTitle(px, y, '시설 현황'));
        y += 22;

        const built = s.baseManager.getBuiltFacilities();
        const buildings = s.baseManager.getCurrentBuildings();
        const researching = s.baseManager.getCurrentResearch();

        // 완성 시설
        if (built.length === 0 && buildings.length === 0) {
            this.p(s.add.text(px + 8, y, '건설된 시설 없음', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }));
            y += 20;
        } else {
            for (const f of built) {
                this.p(w.insetPanel(px, y, pw, 24));
                this.p(s.add.text(px + 8, y + 5, `✓ ${f.name_ko}`, { fontSize: '11px', fontFamily: FONT, color: C.successGreen }));
                this.p(s.add.text(px + pw - 8, y + 5, `T${f.tier}`, { fontSize: '10px', fontFamily: FONT, color: C.textMuted }).setOrigin(1, 0));
                y += 28;
            }
        }

        // 건설 중 -- 진행도 바
        for (const building of buildings) {
            const bPct = Math.min(building.progress / building.buildCost, 1);
            this.p(w.insetPanel(px, y, pw, 34));
            this.p(s.add.text(px + 8, y + 3, `🔨 ${building.name}`, { fontSize: '11px', fontFamily: FONT_BOLD, color: C.infoCyan }));
            this.p(s.add.text(px + pw - 8, y + 3, `${building.progress}/${building.buildCost}`, { fontSize: '10px', fontFamily: FONT, color: C.textSecondary }).setOrigin(1, 0));
            const barG = this.p(s.add.graphics());
            const barX = px + 28, barY = y + 21, barW = pw - 56, barH = 8;
            barG.fillStyle(0x0a0a14, 1); barG.fillRoundedRect(barX, barY, barW, barH, 3);
            barG.fillStyle(0x40a0f8, 1); barG.fillRoundedRect(barX, barY, Math.max(barW * bPct, 4), barH, 3);
            barG.lineStyle(1, 0x303048); barG.strokeRoundedRect(barX, barY, barW, barH, 3);
            y += 38;
        }

        // 연구 중 -- 진행도 바
        if (researching) {
            const rPct = Math.min(researching.progress / researching.researchCost, 1);
            this.p(w.insetPanel(px, y, pw, 34));
            this.p(s.add.text(px + 8, y + 3, `📖 ${researching.name}`, { fontSize: '11px', fontFamily: FONT_BOLD, color: C.infoCyan }));
            this.p(s.add.text(px + pw - 8, y + 3, `${researching.progress}/${researching.researchCost}`, { fontSize: '10px', fontFamily: FONT, color: C.textSecondary }).setOrigin(1, 0));
            const barG = this.p(s.add.graphics());
            const barX = px + 28, barY = y + 21, barW = pw - 56, barH = 8;
            barG.fillStyle(0x0a0a14, 1); barG.fillRoundedRect(barX, barY, barW, barH, 3);
            barG.fillStyle(0xf8c830, 1); barG.fillRoundedRect(barX, barY, Math.max(barW * rPct, 4), barH, 3);
            barG.lineStyle(1, 0x303048); barG.strokeRoundedRect(barX, barY, barW, barH, 3);
            y += 38;
        }

        y += 10;
        const income = s.baseManager.getPassiveIncomeWithBonus();
        this.p(s.add.text(px + 8, y, `턴당 수입: 💰${income}`, { fontSize: '11px', fontFamily: FONT, color: C.expYellow }));
        y += 20;

        y += 10;

        this.p(w.panelButton(px + 100, y, '건 설', () => s._showPanelAction('build')));
        if (!researching) {
            this.p(w.panelButton(px + 280, y, '연 구', () => s._showPanelAction('research')));
        }
    }

    // ═══════════════════════════════════
    // 탭: 아이템
    // ═══════════════════════════════════
    renderItemTab() {
        const s = this.scene;
        const y = PANEL_CONTENT_Y + 60;
        this.p(s.add.text(640, y, '🎒 아이템 — 준비 중', {
            fontSize: '16px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setDepth(301));
        this.p(s.add.text(640, y + 30, '장비 시스템은 추후 업데이트됩니다.', {
            fontSize: '12px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setDepth(301));
    }

    // ═══════════════════════════════════
    // 탭: 원정
    // ═══════════════════════════════════
    renderExpeditionTab() {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = s.expeditionManager.getProgress();
        const expedition = store.getState('expedition');

        this.p(w.sectionTitle(px, y, `원정 — 챕터 ${progress.chapter}`));
        y += 22;

        if (expedition && expedition.active) {
            this.p(w.insetPanel(px, y, pw, 30));
            this.p(s.add.text(px + 8, y + 8, '원정 진행 중...', { fontSize: '11px', fontFamily: FONT, color: C.warningOrange }));
            y += 40;
        }

        // 가로 배치 스테이지
        let sx = px;
        progress.stages.forEach((stage) => {
            const unlocked = stage.unlocked;
            const color = unlocked ? C.textPrimary : C.textMuted;
            const icon = stage.isBoss ? '👑 ' : unlocked ? '▸ ' : '✕ ';

            this.p(w.insetPanel(sx, y, 280, 28));
            this.p(s.add.text(sx + 8, y + 7, `${icon}${stage.name}`, { fontSize: '11px', fontFamily: FONT, color }));
            this.p(s.add.text(sx + 272, y + 7, `적 ${stage.enemies}체`, { fontSize: '9px', fontFamily: FONT, color: C.textMuted }).setOrigin(1, 0));
            sx += 290;
            if (sx > 900) { sx = px; y += 34; }
        });
        if (sx !== px) y += 34;

        y += 10;
        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        this.p(s.add.text(px + 8, y, `파견 가능: ${heroes.length}명`, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }));

        const turn = s.turnManager.getCurrentTurn();
        const raidInfo = s.baseManager.getRaidInfo(turn.day);
        this.p(s.add.text(px + 200, y, `감시탑: ${raidInfo.text}`, { fontSize: '11px', fontFamily: FONT, color: C.warningOrange }));

        y += 30;
        const mode = s.registry.get('expeditionMode') || 'node';
        const modeLabel = mode === 'node' ? 'STS 노드' : '주사위';
        if (heroes.length > 0 && !(expedition && expedition.active)) {
            this.p(w.panelButton(px + 120, y, `⚔ 원정 맵 열기 (${modeLabel})`, () => {
                const partyIds = heroes.slice(0, 3).map(h => h.id);
                s.scene.launch('ExpeditionScene', { heroIds: partyIds });
            }));
        }
    }

    // ═══════════════════════════════════
    // 탭: 국시(Edict) — 2026-04-17
    // ═══════════════════════════════════
    renderEdictTab() {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        let y = PANEL_CONTENT_Y + 8;

        const em = s.edictManager;
        const day = s.turnManager.getCurrentTurn().day;
        const activeDef = em.getActiveDefinition();
        const activeSin = em.getActiveSin();
        const inCooldown = em.isCooldown(day);

        this.p(w.sectionTitle(px, y, '국시(Edict)'));
        y += 22;

        // 상태 바
        if (activeDef) {
            const remain = em.getRemainingTurns(day);
            this.p(s.add.text(px + 8, y, `선포 중: ${activeDef.name_ko} (잔여 ${remain}턴)`, {
                fontSize: '11px', fontFamily: FONT_BOLD, color: '#f8c830'
            }));
        } else if (inCooldown) {
            const cd = em.getCooldownTurns(day);
            this.p(s.add.text(px + 8, y, `쿨다운: ${cd}턴 남음`, {
                fontSize: '11px', fontFamily: FONT_BOLD, color: '#808098'
            }));
        } else {
            this.p(s.add.text(px + 8, y, '무 국시 — 선포 가능', {
                fontSize: '11px', fontFamily: FONT, color: C.textSecondary
            }));
        }
        y += 22;

        // 국시 7종 가로 배치
        const defs = em.getDefinitions();
        const cardW = 172;
        const cardH = 96;
        const gap = 6;
        let cx = px;

        for (const def of defs) {
            if (cx + cardW > 1260) { cx = px; y += cardH + gap; }
            const isActive = def.sin === activeSin;
            const sinColor = SIN_COLOR_HEX[def.sin] || C.textMuted;

            const bg = this.p(s.add.graphics());
            bg.fillStyle(isActive ? 0x2a2010 : C.cardBg, 1);
            bg.fillRoundedRect(cx, y, cardW, cardH, 4);
            bg.lineStyle(1, isActive ? 0xf8c830 : C.borderPrimary);
            bg.strokeRoundedRect(cx, y, cardW, cardH, 4);

            this.p(s.add.text(cx + 8, y + 6, def.name_ko, {
                fontSize: '12px', fontFamily: FONT_BOLD, color: sinColor
            }));
            this.p(s.add.text(cx + cardW - 8, y + 6, SIN_NAMES_KO[def.sin] || def.sin, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));

            this.p(s.add.text(cx + 8, y + 24, def.description || '', {
                fontSize: '9px', fontFamily: FONT, color: C.textSecondary,
                wordWrap: { width: cardW - 16 },
                lineSpacing: 1
            }));

            const sinKey = def.sin;
            if (isActive) {
                this.p(s.widgets.smallPanelBtn(cx + cardW / 2, y + cardH - 14, '해제', () => {
                    em.revoke(day);
                    this.refreshActiveTab();
                    s.hud.updateEdict();
                }));
            } else if (!inCooldown && !activeDef) {
                this.p(s.widgets.smallPanelBtn(cx + cardW / 2, y + cardH - 14, '선포', () => {
                    em.proclaim(sinKey, day);
                    this.refreshActiveTab();
                    s.hud.updateEdict();
                }));
            }

            cx += cardW + gap;
        }
    }

    // ═══════════════════════════════════
    // 탭: 도감
    // ═══════════════════════════════════
    renderBestiaryTab() {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        let y = PANEL_CONTENT_Y + 8;

        this.p(w.sectionTitle(px, y, '몬스터 도감'));
        y += 24;

        // idle 액션 시트가 있는 기존 몬스터
        const existingMonsters = [
            { key: 'monster_slime', name: '슬라임' },
            { key: 'monster_bat', name: '박쥐' },
            { key: 'monster_snake', name: '뱀' },
            { key: 'monster_ghost', name: '유령' },
            { key: 'monster_eyeball', name: '눈알' },
            { key: 'monster_pumpking', name: '펌프킹' },
            { key: 'monster_bee', name: '벌' },
            { key: 'monster_worm', name: '벌레' },
            { key: 'boss_demon', name: '악마(보스)' },
            { key: 'boss_shadow', name: '그림자(보스)' },
            { key: 'boss_minion', name: '하수인(보스)' },
        ];
        // 풀 스프라이트시트로 로드된 신규 몬스터 (idle = 첫 행 0~3)
        const newMonsters = [
            { key: 'monster_wolf', name: '늑대' },
            { key: 'monster_goblin', name: '고블린' },
            { key: 'monster_spider', name: '거미' },
            { key: 'monster_bear', name: '곰' },
            { key: 'monster_lion', name: '사자' },
            { key: 'monster_deer', name: '사슴' },
            { key: 'monster_flower', name: '식인화' },
            { key: 'monster_bigworm', name: '대형벌레' },
        ];
        const monsters = [...existingMonsters, ...newMonsters];

        const cardW = 80;
        const cardH = 90;
        const gap = 8;
        const cols = Math.floor((1280 - px * 2 + gap) / (cardW + gap));

        monsters.forEach((m, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = px + col * (cardW + gap);
            const cy = y + row * (cardH + gap);

            // 카드 배경
            const bg = this.p(s.add.graphics());
            bg.fillStyle(C.cardBg, 1);
            bg.fillRoundedRect(cx, cy, cardW, cardH, 4);
            bg.lineStyle(1, C.borderPrimary, 0.6);
            bg.strokeRoundedRect(cx, cy, cardW, cardH, 4);

            // 스프라이트 (idle)
            const idleKey = `${m.key}_idle`;  // 기존: 액션별 시트
            const fullKey = m.key;            // 신규: 풀 시트
            const hasIdle = s.textures.exists(idleKey);
            const hasFull = !hasIdle && s.textures.exists(fullKey);
            const texKey = hasIdle ? idleKey : hasFull ? fullKey : null;

            if (texKey) {
                const animKey = `bestiary_${m.key}_idle`;
                if (!s.anims.exists(animKey)) {
                    s.anims.create({
                        key: animKey,
                        frames: s.anims.generateFrameNumbers(texKey, { start: 0, end: 2 }),
                        frameRate: 4,
                        repeat: -1
                    });
                }
                const sprite = this.p(s.add.sprite(cx + cardW / 2, cy + 38, texKey));
                sprite.play(animKey);
                sprite.setScale(1.2);
            }

            // 이름
            this.p(s.add.text(cx + cardW / 2, cy + cardH - 12, m.name, {
                fontSize: '9px', fontFamily: FONT, color: m.key.startsWith('boss_') ? '#e03030' : C.textSecondary,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5));
        });
    }

    // ═══════════════════════════════════
    // 패널 액션: 원정 목록
    // ═══════════════════════════════════
    renderExpeditionListAction() {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = s.expeditionManager.getProgress();
        const expedition = store.getState('expedition');
        const isActive = expedition && expedition.active;

        this.p(w.sectionTitle(px, y, `원정 — 챕터 ${progress.chapter}`));
        y += 22;

        if (isActive) {
            this.p(s.add.text(px + 8, y, '원정 진행 중...', { fontSize: '11px', fontFamily: FONT, color: C.warningOrange }));
            y += 24;
        }

        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        this.p(s.add.text(px + 8, y, `영웅: ${heroes.length}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 22;

        progress.stages.forEach((stage, i) => {
            const unlocked = stage.unlocked;
            const color = unlocked ? C.textPrimary : C.textMuted;
            const icon = stage.isBoss ? '👑 ' : unlocked ? '▸ ' : '✕ ';

            this.p(w.insetPanel(px, y, pw, 32));
            this.p(s.add.text(px + 8, y + 8, `${icon}${stage.name}`, {
                fontSize: '11px', fontFamily: FONT_BOLD, color
            }));
            this.p(s.add.text(px + pw - 8, y + 8, `적 ${stage.enemies}체`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));

            if (unlocked && !isActive) {
                const zone = this.p(s.add.zone(px + pw / 2, y + 16, pw, 32).setInteractive({ useHandCursor: true }));
                const stageIndex = i;
                zone.on('pointerdown', () => s._showPanelAction('expedition', { stageIndex }));
            }

            y += 38;
        });

        y += 10;
        this.p(w.panelButton(px + pw / 2, y, '← 돌아가기', () => s._closePanelAction()));
    }

    // ═══════════════════════════════════
    // 패널 액션: 원정 파견
    // ═══════════════════════════════════
    renderExpeditionAction(stageIndex) {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = s.expeditionManager.getProgress();
        const stage = progress.stages[stageIndex];
        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        this.p(w.sectionTitle(px, y, `원정: ${stage.name}`));
        y += 22;

        this.p(s.add.text(px + 8, y, `영웅: ${heroes.length}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 20;

        if (heroes.length === 0) {
            this.p(s.add.text(px + 8, y, '파견 가능한 영웅 없음', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }));
        } else {
            const party = heroes.slice(0, Math.min(3, heroes.length));
            this.p(s.add.text(px + 8, y, `파티: ${party.map(h => h.name).join(', ')}`, {
                fontSize: '11px', fontFamily: FONT, color: C.infoCyan
            }));
            y += 20;
            this.p(w.panelButton(px + pw / 2, y, '⚔️ 파견 출발', () => {
                const partyIds = party.map(h => h.id);
                const result = s.expeditionManager.dispatch(partyIds, stageIndex);
                if (result.success) {
                    this.refreshActiveTab();
                    s._closePanelAction();
                }
            }));
        }

        y += 40;
        this.p(w.panelButton(px + pw / 2, y, '← 돌아가기', () => s._closePanelAction()));
    }

}

export default MapBottomPanel;
