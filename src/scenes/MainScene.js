import store from '../store/Store.js';
import TurnManager from '../game_logic/TurnManager.js';
import HeroManager from '../game_logic/HeroManager.js';
import EventSystem from '../game_logic/EventSystem.js';
import BaseManager from '../game_logic/BaseManager.js';
import SinSystem from '../game_logic/SinSystem.js';
import ExpeditionManager from '../game_logic/ExpeditionManager.js';
import SaveManager from '../store/SaveManager.js';

/** TheSevenRPG 스타일 상수 */
const FONT = 'Galmuri11, Galmuri9, monospace';

const C = {
    bgPrimary: '#0a0a12',
    bgSecondary: '#12121e',
    bgTertiary: '#1a1a2a',
    cardBg: '#161624',
    inputBg: '#0e0e1a',
    borderPrimary: '#303048',
    borderHighlight: '#a0a0c0',
    borderDark: '#18182a',
    textPrimary: '#e8e8f0',
    textSecondary: '#a0a0c0',
    textMuted: '#606080',
    accentRed: '#e03030',
    hpRed: '#e83030',
    hpRedBg: '#3a1018',
    expYellow: '#f8c830',
    infoCyan: '#40a0f8',
    successGreen: '#40d870'
};

const SIN_COLORS = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0'
};

const MORALE_COLORS = {
    desertion: '#f04040', unhappy: '#f8b830', stable: '#a0a0c0',
    elevated: '#40d870', rampage: '#e03030'
};

const PHASE_BG = { morning: '#12121e', day: '#161624', evening: '#12121e', night: '#0a0a12' };
const PHASE_ACCENT = { morning: '#f8c830', day: '#40a0f8', evening: '#e07020', night: '#808898' };

/**
 * 거점 메인 화면
 * 좌: 영웅 패널 (25%) | 우: 턴 진행 + 로그 (75%)
 */
class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
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

        // 세이브에서 로드한 경우 스킵, 아니면 초기화
        const loaded = this.scene.settings.data?.loaded;
        if (!loaded) {
            store.setState('gold', 500);
            this.heroManager.initStartingHeroes();
        }

        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(C.bgPrimary);

        // 레이아웃 상수
        this.LEFT_W = 220;
        this.RIGHT_X = this.LEFT_W;
        this.RIGHT_W = width - this.LEFT_W;

        this._drawTopBar(width);
        this._drawHeroPanel(height);
        this._drawTurnPanel(height);
        this._drawLogPanel(height);

        // Store 구독
        store.subscribe('turn', () => this._updateTurnDisplay());
        store.subscribe('heroes', () => this._updateHeroDisplay());

        // 초기 표시
        this._updateTurnDisplay();
        this._updateHeroDisplay();
        this._updateFacilityDisplay();

        if (!loaded) {
            this._addLog('림보에 도착했습니다.');
            this._addLog('바알의 여정이 시작됩니다.');
        } else {
            const turn = this.turnManager.getCurrentTurn();
            this._addLog(`세이브를 불러왔습니다. (${turn.day}일차)`);
        }
    }

    _updateFacilityDisplay() {
        const built = this.baseManager.getBuiltFacilities();
        if (built.length === 0) {
            this.facilityText.setText('없음');
        } else {
            this.facilityText.setText(built.map(f => f.name_ko).join(', '));
        }
    }

    // ─── 상단 바 ───
    _drawTopBar(width) {
        this._fillRect(0, 0, width, 32, C.bgSecondary);
        this._line(0, 32, width, 32, C.borderPrimary);

        this.add.text(8, 8, 'THE SEVEN SIMULATION', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true }
        });

        this.goldText = this.add.text(width - 8, 8, `${store.getState('gold') || 500}G`, {
            fontSize: '11px', fontFamily: FONT, color: C.expYellow,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true }
        }).setOrigin(1, 0);

        // 세이브 버튼
        const saveBtn = this.add.text(width - 80, 8, '[저장]', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        saveBtn.on('pointerdown', () => {
            SaveManager.save(store);
            this._addLog('게임이 저장되었습니다.');
            saveBtn.setColor(C.successGreen);
            this.time.delayedCall(1000, () => saveBtn.setColor(C.textMuted));
        });
        saveBtn.on('pointerover', () => saveBtn.setColor(C.textPrimary));
        saveBtn.on('pointerout', () => saveBtn.setColor(C.textMuted));
    }

    // ─── 좌측: 영웅 패널 ───
    _drawHeroPanel(height) {
        // 패널 배경
        this._fillRect(0, 32, this.LEFT_W, height - 32, C.bgTertiary);
        this._line(this.LEFT_W, 32, this.LEFT_W, height, C.borderPrimary);

        this.add.text(8, 42, '[ 영웅 ]', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted
        });
        this._line(8, 58, this.LEFT_W - 8, 58, C.borderPrimary);

        // 영웅 카드 컨테이너 (최대 7개, 축소)
        this.heroCards = [];
        for (let i = 0; i < 7; i++) {
            const y = 64 + i * 62;
            this.heroCards.push(this._createHeroCard(4, y, this.LEFT_W - 8, 56));
        }

        // 거점 시설 표시 영역
        const facilityY = 64 + 7 * 62 + 4;
        this._line(8, facilityY, this.LEFT_W - 8, facilityY, C.borderPrimary);
        this.add.text(8, facilityY + 4, '[ 시설 ]', {
            fontSize: '9px', fontFamily: FONT, color: C.textMuted
        });
        this.facilityText = this.add.text(8, facilityY + 18, '', {
            fontSize: '9px', fontFamily: FONT, color: C.textSecondary,
            lineSpacing: 2, wordWrap: { width: this.LEFT_W - 16 }
        });

        // Store 구독 — 시설 변경 시 갱신
        store.subscribe('base', () => this._updateFacilityDisplay());
    }

    _createHeroCard(x, y, w, h) {
        const card = {
            x, y, w, h,
            bg: this.add.graphics(),
            nameText: this.add.text(x + 8, y + 6, '', {
                fontSize: '11px', fontFamily: FONT, color: C.textPrimary,
                shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true }
            }),
            classText: this.add.text(x + w - 8, y + 6, '', {
                fontSize: '9px', fontFamily: FONT, color: C.textSecondary
            }).setOrigin(1, 0),
            sinText: this.add.text(x + 8, y + 22, '', {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }),
            moraleBarBg: this.add.graphics(),
            moraleBar: this.add.graphics(),
            moraleText: this.add.text(x + w - 8, y + 22, '', {
                fontSize: '9px', fontFamily: FONT, color: C.textSecondary
            }).setOrigin(1, 0),
            statText: this.add.text(x + 8, y + 40, '', {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted, lineSpacing: 2
            }),
            visible: false
        };

        this._setCardVisible(card, false);
        return card;
    }

    _setCardVisible(card, visible) {
        card.visible = visible;
        card.bg.setVisible(visible);
        card.nameText.setVisible(visible);
        card.classText.setVisible(visible);
        card.sinText.setVisible(visible);
        card.moraleBarBg.setVisible(visible);
        card.moraleBar.setVisible(visible);
        card.moraleText.setVisible(visible);
        card.statText.setVisible(visible);
    }

    _updateHeroDisplay() {
        const heroes = this.heroManager.getHeroes();
        const statNames = this.registry.get('heroData').stat_names;

        for (let i = 0; i < 7; i++) {
            const card = this.heroCards[i];
            if (i >= heroes.length) {
                this._setCardVisible(card, false);
                continue;
            }

            const hero = heroes[i];
            this._setCardVisible(card, true);

            // 카드 배경 (베벨)
            card.bg.clear();
            this._drawBevel(card.bg, card.x, card.y, card.w, card.h, C.cardBg);

            // 이름, 직업
            card.nameText.setText(hero.name);
            card.classText.setText(hero.className);

            // 죄종
            const sinColor = SIN_COLORS[hero.sinType] || C.textMuted;
            card.sinText.setText(`[${hero.sinName}]`);
            card.sinText.setColor(sinColor);

            // 사기 바
            const moraleState = this.heroManager.getMoraleState(hero.morale);
            const moraleColor = MORALE_COLORS[moraleState];
            const barX = card.x + 8;
            const barY = card.y + 35;
            const barW = card.w - 56;
            const barH = 4;

            card.moraleBarBg.clear();
            card.moraleBarBg.fillStyle(0x1a1a2a, 1);
            card.moraleBarBg.fillRect(barX, barY, barW, barH);
            card.moraleBarBg.lineStyle(1, 0x303048);
            card.moraleBarBg.strokeRect(barX, barY, barW, barH);

            card.moraleBar.clear();
            const fillW = Math.max(0, (hero.morale / 100) * barW);
            card.moraleBar.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
            card.moraleBar.fillRect(barX, barY, fillW, barH);

            // 사기 수치
            const stateName = this.heroManager.getMoraleStateName(hero.morale);
            card.moraleText.setText(`${hero.morale} ${stateName}`);
            card.moraleText.setColor(moraleColor);

            // 상태 아이콘
            const statusIcon = hero.status === 'expedition' ? ' ⚔️' : hero.status === 'injured' ? ' 💤' : '';
            card.classText.setText(hero.className + statusIcon);

            // 스탯 (한 줄 요약)
            const s = hero.stats;
            const statLine = `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality} 감${s.perception} 솔${s.leadership} 매${s.charisma}`;
            card.statText.setText(statLine);
            card.statText.setY(card.y + 44);
        }
    }

    // ─── 우측 상단: 턴 패널 ───
    _drawTurnPanel(height) {
        const x = this.RIGHT_X + 12;
        const pw = this.RIGHT_W - 24;

        this._drawBevelPanel(x, 44, pw, 160);

        this.add.text(x + 12, 52, '— 림보 (Limbo) —', {
            fontSize: '9px', fontFamily: FONT, color: C.textMuted, letterSpacing: 4
        });

        this.dayText = this.add.text(x + pw / 2, 82, '', {
            fontSize: '28px', fontFamily: FONT, color: C.textPrimary,
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this.phaseText = this.add.text(x + pw / 2, 116, '', {
            fontSize: '16px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        this.descText = this.add.text(x + pw / 2, 140, '', {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);

        // 페이즈 인디케이터
        this.phaseIndicators = [];
        const phases = ['아침', '낮', '저녁', '밤'];
        const dotStartX = x + pw / 2 - 36;
        for (let i = 0; i < 4; i++) {
            const dot = this.add.circle(dotStartX + i * 24, 168, 5, 0x303048);
            dot.setStrokeStyle(1, 0x484868);
            this.phaseIndicators.push(dot);
            this.add.text(dotStartX + i * 24, 180, phases[i], {
                fontSize: '9px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        }

        // 다음 단계 버튼
        this._createButton(x + pw / 2, 218, '다 음 단 계', () => this._onAdvance());
    }

    // ─── 우측 하단: 로그 패널 ───
    _drawLogPanel(height) {
        const x = this.RIGHT_X + 12;
        const pw = this.RIGHT_W - 24;
        const py = 250;
        const ph = height - py - 12;

        this._drawBevelPanel(x, py, pw, ph);

        this.add.text(x + 12, py + 8, '[ 기록 ]', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted
        });
        this._line(x + 8, py + 26, x + pw - 8, py + 26, C.borderPrimary);

        this.logText = this.add.text(x + 12, py + 32, '', {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary,
            lineSpacing: 6, wordWrap: { width: pw - 24 }
        });

        this._logs = [];
    }

    // ─── 유틸리티 ───
    _fillRect(x, y, w, h, colorHex) {
        const g = this.add.graphics();
        g.fillStyle(Phaser.Display.Color.HexStringToColor(colorHex).color, 1);
        g.fillRect(x, y, w, h);
        return g;
    }

    _line(x1, y1, x2, y2, colorHex) {
        const g = this.add.graphics();
        g.lineStyle(1, Phaser.Display.Color.HexStringToColor(colorHex).color);
        g.lineBetween(x1, y1, x2, y2);
        return g;
    }

    _drawBevel(g, x, y, w, h, bgColor) {
        g.fillStyle(Phaser.Display.Color.HexStringToColor(bgColor).color, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, Phaser.Display.Color.HexStringToColor(C.borderPrimary).color);
        g.strokeRect(x, y, w, h);
        // 인셋 하이라이트
        g.lineStyle(1, Phaser.Display.Color.HexStringToColor(C.borderHighlight).color, 0.12);
        g.lineBetween(x + 1, y + 1, x + w - 1, y + 1);
        g.lineBetween(x + 1, y + 1, x + 1, y + h - 1);
        // 인셋 그림자
        g.lineStyle(1, Phaser.Display.Color.HexStringToColor(C.borderDark).color, 0.6);
        g.lineBetween(x + w - 1, y + 1, x + w - 1, y + h - 1);
        g.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);
    }

    _drawBevelPanel(x, y, w, h) {
        const g = this.add.graphics();
        this._drawBevel(g, x, y, w, h, C.cardBg);
        return g;
    }

    _createButton(cx, cy, label, callback) {
        const bw = 152, bh = 32;
        const x = cx - bw / 2, y = cy - bh / 2;
        const bg = this.add.graphics();
        this._drawBtn(bg, x, y, bw, bh, false);

        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
        this.add.text(cx, cy, label, {
            fontSize: '14px', fontFamily: FONT, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
            letterSpacing: 2
        }).setOrigin(0.5);

        zone.on('pointerover', () => { bg.clear(); this._drawBtn(bg, x, y, bw, bh, true); });
        zone.on('pointerout', () => { bg.clear(); this._drawBtn(bg, x, y, bw, bh, false); });
        zone.on('pointerdown', callback);
    }

    _drawBtn(g, x, y, w, h, hover) {
        g.fillStyle(hover ? 0x401010 : 0x2a0808, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, hover ? 0xe04040 : 0xe03030);
        g.strokeRect(x, y, w, h);
        g.lineStyle(1, 0xa0a0c0, hover ? 0.2 : 0.1);
        g.lineBetween(x + 2, y + 2, x + w - 2, y + 2);
        g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        g.lineStyle(1, 0x18182a, 0.8);
        g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2);
        g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
    }

    // ─── 로직 ───
    _onAdvance() {
        const before = this.turnManager.getCurrentTurn();
        const after = this.turnManager.advancePhase();

        if (after.day > before.day) {
            this._addLog(`━━ ${after.day}일차가 밝았습니다 ━━`);
        }
        this._addLog(`[${this.turnManager.getPhaseName()}] ${this.turnManager.getPhaseDescription()}`);

        // 페이즈별 처리
        if (after.phase === 'morning') {
            this._triggerMorningEvents();
        } else if (after.phase === 'day') {
            this._processDayPhase();
            this._openActionScene();
        } else if (after.phase === 'evening') {
            this._processEveningPhase();
        } else if (after.phase === 'night') {
            this._processNightPhase();
        }

        // 골드 표시 갱신
        const gold = store.getState('gold') || 0;
        this.goldText.setText(`${gold}G`);
    }

    _triggerMorningEvents() {
        const events = this.eventSystem.generateEvents();
        if (events.length === 0) {
            this._addLog('조용한 아침입니다.');
            return;
        }

        // 이벤트 큐: 하나씩 순서대로 표시
        this._eventQueue = [...events];
        this._showNextEvent();
    }

    _showNextEvent() {
        if (this._eventQueue.length === 0) return;

        const evt = this._eventQueue.shift();
        this._addLog(`⚡ ${evt.title}`);

        this.scene.launch('EventScene', {
            event: evt,
            eventSystem: this.eventSystem,
            onComplete: (result) => {
                // 결과 로그
                if (result && result.log) {
                    this._addLog(result.log);
                }
                if (result && result.results) {
                    for (const r of result.results) {
                        if (r.type === 'gold') {
                            this._addLog(`  골드 ${r.delta > 0 ? '+' : ''}${r.delta}`);
                        } else if (r.type === 'dismissed') {
                            this._addLog(`  ${r.name} — 영구 이탈`);
                        } else if (r.delta) {
                            this._addLog(`  ${r.name} 사기 ${r.delta > 0 ? '+' : ''}${r.delta}`);
                        }
                    }
                }

                // 골드 표시 갱신
                const gold = store.getState('gold') || 0;
                this.goldText.setText(`${gold}G`);

                // 다음 이벤트 or 끝
                if (this._eventQueue.length > 0) {
                    this.time.delayedCall(300, () => this._showNextEvent());
                }
            }
        });
    }

    _processDayPhase() {
        // 건설 턴 진행
        const buildResult = this.baseManager.processBuildTurn();
        if (buildResult) {
            if (buildResult.type === 'complete') {
                this._addLog(`🔨 ${buildResult.name} 건설 완료!`);
            } else {
                this._addLog(`🔨 ${buildResult.name} 건설 중... (${buildResult.turnsLeft}턴 남음)`);
            }
        }

        // 연구 턴 진행
        const researchResult = this.baseManager.processResearchTurn();
        if (researchResult) {
            if (researchResult.type === 'complete') {
                this._addLog(`📖 ${researchResult.name} 연구 완료!`);
            } else {
                this._addLog(`📖 ${researchResult.name} 연구 중... (${researchResult.turnsLeft}턴 남음)`);
            }
        }

        // 시장 수입
        const income = this.baseManager.getPassiveIncome();
        if (income > 0) {
            const gold = store.getState('gold') || 0;
            store.setState('gold', gold + income);
            this._addLog(`시장 수입: +${income}G`);
        }
    }

    _processEveningPhase() {
        // 원정 결과 보고
        const expResult = this.expeditionManager.resolveExpedition();
        if (expResult) {
            if (expResult.victory) {
                this._addLog(`⚔️ 원정 승리! [${expResult.stageName}] — +${expResult.goldReward}G`);
            } else {
                this._addLog(`⚔️ 원정 패배... [${expResult.stageName}]`);
            }
            for (const hr of expResult.heroResults) {
                if (!hr.alive) {
                    this._addLog(`  ${hr.name} — 기절 (부상 치료 필요)`);
                }
            }

            // 전투 리플레이
            this.scene.launch('BattleScene', {
                log: expResult.log,
                victory: expResult.victory,
                stageName: expResult.stageName,
                onClose: () => {
                    // 보스 승리 → 엔딩
                    if (expResult.isBoss && expResult.victory) {
                        const turn = this.turnManager.getCurrentTurn();
                        this.scene.start('GameOverScene', {
                            reason: 'victory',
                            day: turn.day
                        });
                    }
                }
            });
        } else {
            this._addLog('원정대가 없습니다.');
        }

        // 습격 예고
        const turn = this.turnManager.getCurrentTurn();
        const scale = Math.floor(turn.day / 3) + 1;
        const sizeDesc = scale <= 2 ? '소규모' : scale <= 4 ? '중규모' : '대규모';
        this._addLog(`감시탑: 오늘 밤 ${sizeDesc} 습격 예상 (적 ${scale + 1}체)`);
    }

    _processNightPhase() {
        // 포고령에 의한 사기 변동
        const policyDelta = this.baseManager.getPolicyMoraleEffect();
        if (policyDelta !== 0) {
            const heroes = this.heroManager.getHeroes();
            for (const hero of heroes) {
                this.heroManager.updateMorale(hero.id, policyDelta);
            }
            this._addLog(`포고령 효과: 전체 사기 ${policyDelta > 0 ? '+' : ''}${policyDelta}`);
        }

        // 밤 습격 방어전
        const turn = this.turnManager.getCurrentTurn();
        const defenseResult = this.expeditionManager.simulateDefense(turn.day);
        if (defenseResult.victory) {
            this._addLog(`🛡️ 방어 성공! (${defenseResult.rounds}라운드, 적 ${defenseResult.enemyCount}체)`);
            // 방어 승리 보상
            const gold = store.getState('gold') || 0;
            const reward = 10 + turn.day * 2;
            store.setState('gold', gold + reward);
            this._addLog(`  방어 보상: +${reward}G`);
            // 전체 사기 소폭 상승
            const heroes = this.heroManager.getHeroes();
            for (const h of heroes) {
                this.heroManager.updateMorale(h.id, 5);
            }
        } else {
            this._addLog(`🛡️ 방어 실패... 시설 피해 발생`);
            const heroes = this.heroManager.getHeroes();
            for (const h of heroes) {
                this.heroManager.updateMorale(h.id, -10);
            }
        }
        for (const hr of (defenseResult.heroResults || [])) {
            if (!hr.alive) {
                this._addLog(`  ${hr.name} — 부상`);
            }
        }

        // 죄종 만족/불만 체크
        this._checkSinConditions();

        // 폭주/이탈/연쇄 반응 체크
        const extremeResults = this.sinSystem.checkExtremes();
        for (const r of extremeResults) {
            if (r.type === 'rampage') {
                this._addLog(`💥 [폭주] ${r.heroName} (${r.sinName}): ${r.description}`);
                if (r.corruptionResult === 'corruption') {
                    this._addLog(`  → 타락! 더 강해졌지만 더 위험합니다.`);
                } else {
                    this._addLog(`  → 구원! 죄를 극복했습니다.`);
                }
                for (const a of r.affectedHeroes) {
                    this._addLog(`  ${a.name} 사기 ${a.delta > 0 ? '+' : ''}${a.delta}`);
                }
            } else if (r.type === 'desertion') {
                this._addLog(`🚪 [이탈] ${r.description}`);
                for (const a of r.affectedHeroes) {
                    this._addLog(`  ${a.name} 사기 ${a.delta > 0 ? '+' : ''}${a.delta}`);
                }
            }
        }

        // 게임오버 체크: 영웅 0명
        const remainingHeroes = this.heroManager.getHeroes();
        if (remainingHeroes.length === 0) {
            const turn = this.turnManager.getCurrentTurn();
            this.time.delayedCall(1500, () => {
                this.scene.start('GameOverScene', {
                    reason: 'defeat',
                    day: turn.day,
                    details: '모든 영웅이 떠났습니다. 림보에 남은 자는 아무도 없습니다.'
                });
            });
        }

        // 자동 세이브
        SaveManager.save(store);
    }

    _checkSinConditions() {
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            // 분노: 3일 미파견 → 불만
            if (hero.sinType === 'wrath' && hero.location === 'base') {
                hero.daysIdle = (hero.daysIdle || 0) + 1;
                if (hero.daysIdle >= 3) {
                    this.heroManager.updateMorale(hero.id, -5);
                }
            } else if (hero.sinType === 'wrath') {
                hero.daysIdle = 0;
            }

            // 나태: 연속 배치 → 불만
            if (hero.sinType === 'sloth' && hero.status !== 'idle') {
                this.heroManager.updateMorale(hero.id, -3);
            } else if (hero.sinType === 'sloth' && hero.status === 'idle') {
                this.heroManager.updateMorale(hero.id, 3);
            }
        }
    }

    _openActionScene() {
        this.scene.launch('ActionScene', {
            baseManager: this.baseManager,
            heroManager: this.heroManager,
            expeditionManager: this.expeditionManager,
            onComplete: (result) => {
                if (result && result.log) {
                    this._addLog(result.log);
                }
                const gold = store.getState('gold') || 0;
                this.goldText.setText(`${gold}G`);
            }
        });
    }

    _updateTurnDisplay() {
        const turn = this.turnManager.getCurrentTurn();
        this.dayText.setText(`${turn.day}일차`);
        this.phaseText.setText(`[ ${this.turnManager.getPhaseName()} ]`);
        this.descText.setText(this.turnManager.getPhaseDescription());
        this.cameras.main.setBackgroundColor(PHASE_BG[turn.phase]);

        const accent = PHASE_ACCENT[turn.phase];
        const accentColor = Phaser.Display.Color.HexStringToColor(accent).color;
        this.phaseText.setColor(accent);

        this.phaseIndicators.forEach((dot, i) => {
            if (i === turn.phaseIndex) {
                dot.setFillStyle(accentColor);
                dot.setStrokeStyle(1, accentColor, 0.5);
            } else if (i < turn.phaseIndex) {
                dot.setFillStyle(0x484868);
                dot.setStrokeStyle(1, 0x484868);
            } else {
                dot.setFillStyle(0x303048);
                dot.setStrokeStyle(1, 0x484868);
            }
        });
    }

    _addLog(message) {
        this._logs.unshift(message);
        if (this._logs.length > 12) this._logs.pop();
        this.logText.setText(this._logs.join('\n'));
    }
}

export default MainScene;
