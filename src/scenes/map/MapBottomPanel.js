/**
 * MapBottomPanel — 하단 패널 (탭 바 + 6개 탭 렌더러 + 패널 액션)
 * MapScene에서 분리된 모듈. scene 참조를 통해 매니저/위젯에 접근.
 */
import { C, SIN_COLOR_HEX, MORALE_COLORS_HEX, PANEL_Y, PANEL_H, PANEL_TAB_H, PANEL_CONTENT_Y, TABS } from './MapConstants.js';
import { FONT, FONT_BOLD } from '../../constants.js';
import store from '../../store/Store.js';

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
            const label = s.add.text(tx + tw / 2 + 10, PANEL_Y + PANEL_TAB_H / 2, tab.label, {
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
            case 'policy': this.renderPolicyTab(); break;
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
                this.p(s.add.text(cx + 8, y + 22, hero.sinName, {
                    fontSize: '10px', fontFamily: FONT, color: C.textMuted
                }));
            }

            const statusMap = { expedition: '원정', injured: '부상', construction: '건설', research: '연구', idle: '대기' };
            this.p(s.add.text(cx + CARD_W - 8, y + 22, statusMap[hero.status] || '대기', {
                fontSize: '10px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(1, 0));

            const st = hero.stats;
            this.p(s.add.text(cx + 8, y + 40, `힘${st.strength} 민${st.agility} 지${st.intellect} 체${st.vitality}`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }));
            this.p(s.add.text(cx + 8, y + 54, `감${st.perception} 솔${st.leadership} 매${st.charisma}`, {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }));

            // 사기 바
            const moraleState = s.heroManager.getMoraleState(hero.morale);
            const moraleColor = MORALE_COLORS_HEX[moraleState];
            const barX = cx + 8;
            const barY = y + CARD_H - 16;
            const barW = CARD_W - 50;
            const barH = 6;

            const mBarBg = this.p(s.add.graphics());
            mBarBg.fillStyle(0x0e0e1a, 1); mBarBg.fillRect(barX, barY, barW, barH);
            mBarBg.lineStyle(1, C.borderPrimary); mBarBg.strokeRect(barX, barY, barW, barH);

            const mBar = this.p(s.add.graphics());
            const fillW = Math.max(0, (hero.morale / 100) * barW);
            mBar.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
            mBar.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);

            this.p(s.add.text(barX + barW + 6, barY - 2, `${hero.morale}`, {
                fontSize: '10px', fontFamily: FONT_BOLD, color: moraleColor
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

        const policyEffect = s.baseManager.getPolicyMoraleEffect();
        const pColor = policyEffect >= 0 ? C.successGreen : C.accentRed;
        this.p(s.add.text(px + 8, y, `포고령 효과: 사기 ${policyEffect >= 0 ? '+' : ''}${policyEffect}/턴`, { fontSize: '11px', fontFamily: FONT, color: pColor }));
        y += 30;

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
    }

    // ═══════════════════════════════════
    // 탭: 정책
    // ═══════════════════════════════════
    renderPolicyTab() {
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        let y = PANEL_CONTENT_Y + 8;

        const base = store.getState('base');
        const policies = base.policies;

        this.p(w.sectionTitle(px, y, '포고령'));
        y += 22;

        const currentEffect = s.baseManager.getPolicyMoraleEffect();
        const eColor = currentEffect >= 0 ? C.successGreen : C.accentRed;
        this.p(s.add.text(px + 8, y, `현재 효과: 전체 사기 ${currentEffect >= 0 ? '+' : ''}${currentEffect}/턴`, { fontSize: '11px', fontFamily: FONT, color: eColor }));
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

            this.p(s.add.text(colX + 8, py, pDef.label, { fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary }));
            py += 20;

            for (const opt of pDef.options) {
                const isCurrent = policies[pDef.key] === opt.value;
                const marker = isCurrent ? '●' : '○';
                const optColor = isCurrent ? opt.color : C.textMuted;

                const optBg = this.p(s.add.graphics());
                optBg.fillStyle(isCurrent ? 0x1e1e34 : C.inputBg, 1);
                optBg.fillRect(colX + 4, py, colW - 8, 22);
                optBg.lineStyle(1, isCurrent ? 0xe03030 : C.borderPrimary);
                optBg.strokeRect(colX + 4, py, colW - 8, 22);

                this.p(s.add.text(colX + 12, py + 4, `${marker} ${opt.label}`, {
                    fontSize: '11px', fontFamily: FONT, color: optColor
                }));

                const zone = this.p(s.add.zone(colX + colW / 2, py + 11, colW - 8, 22)
                    .setInteractive({ useHandCursor: true }));
                const pKey = pDef.key;
                const pVal = opt.value;
                zone.on('pointerdown', () => {
                    s.baseManager.setPolicy(pKey, pVal);
                    this.refreshActiveTab();
                });

                py += 26;
            }
            colX += colW + 16;
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
        const soldiers = store.getState('soldiers') || 0;
        this.p(s.add.text(px + 8, y, `영웅: ${heroes.length}명 | 병사: ${soldiers}명`, {
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
        const soldiers = store.getState('soldiers') || 0;

        this.p(w.sectionTitle(px, y, `원정: ${stage.name}`));
        y += 22;

        this.p(s.add.text(px + 8, y, `영웅: ${heroes.length}명 | 병사: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 20;

        if (heroes.length === 0) {
            this.p(s.add.text(px + 8, y, '파견 가능한 영웅 없음', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }));
        } else if (soldiers === 0) {
            this.p(s.add.text(px + 8, y, '병사가 없습니다', { fontSize: '11px', fontFamily: FONT, color: C.textMuted }));
        } else {
            const party = heroes.slice(0, Math.min(3, heroes.length));
            this.p(s.add.text(px + 8, y, `파티: ${party.map(h => h.name).join(', ')}`, {
                fontSize: '11px', fontFamily: FONT, color: C.infoCyan
            }));
            y += 20;
            this.p(w.panelButton(px + pw / 2, y, '병사 배정 →', () => {
                s._showPanelAction('soldierSelect', { stageIndex, party });
            }));
        }

        y += 40;
        this.p(w.panelButton(px + pw / 2, y, '← 돌아가기', () => s._closePanelAction()));
    }

    // ═══════════════════════════════════
    // 패널 액션: 병사 배정
    // ═══════════════════════════════════
    renderSoldierSelectAction(data) {
        const { stageIndex, party } = data;
        const s = this.scene;
        const w = s.widgets;
        const px = 16;
        const pw = 600;
        let y = PANEL_CONTENT_Y + 8;

        const progress = s.expeditionManager.getProgress();
        const stage = progress.stages[stageIndex];
        const soldiers = store.getState('soldiers') || 0;

        this.p(w.sectionTitle(px, y, '병사 배정'));
        y += 22;

        this.p(s.add.text(px + 8, y, `목표: ${stage.name} | 사용 가능: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }));
        y += 24;

        let selectedCount = Math.min(10, soldiers);
        const countText = this.p(s.add.text(px + 150, y, `${selectedCount}명`, {
            fontSize: '20px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        const btnCx = px + 150;
        this.p(w.smallPanelBtn(btnCx - 80, y, '-10', () => { selectedCount = Math.max(1, selectedCount - 10); countText.setText(`${selectedCount}명`); }));
        this.p(w.smallPanelBtn(btnCx - 30, y, '-1', () => { selectedCount = Math.max(1, selectedCount - 1); countText.setText(`${selectedCount}명`); }));
        this.p(w.smallPanelBtn(btnCx + 30, y, '+1', () => { selectedCount = Math.min(soldiers, selectedCount + 1); countText.setText(`${selectedCount}명`); }));
        this.p(w.smallPanelBtn(btnCx + 80, y, '+10', () => { selectedCount = Math.min(soldiers, selectedCount + 10); countText.setText(`${selectedCount}명`); }));
        y += 26;
        this.p(w.smallPanelBtn(btnCx, y, '전체', () => { selectedCount = soldiers; countText.setText(`${selectedCount}명`); }));
        y += 34;

        this.p(w.panelButton(btnCx, y, '⚔️ 파견 출발', () => {
            const partyIds = party.map(h => h.id);
            const result = s.expeditionManager.dispatch(partyIds, stageIndex, selectedCount);
            if (result.success) {
                this.refreshActiveTab();
                s.hud.updateSoldiers();
                s._closePanelAction();
            }
        }));

        y += 40;
        this.p(w.panelButton(btnCx, y, '← 돌아가기', () => {
            s._showPanelAction('expedition', { stageIndex });
        }));
    }
}

export default MapBottomPanel;
