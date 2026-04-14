/**
 * 건설/연구/시설 관련 팝업
 */
import { C } from '../MapConstants.js';
import { FONT, FONT_BOLD } from '../../../constants.js';
import store from '../../../store/Store.js';

class PopupsBuild {
    constructor(scene) {
        this.scene = scene;
    }

    // ═══════════════════════════════════
    // 팝업: 건설
    // ═══════════════════════════════════
    popupBuild(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const TIER_COLORS = { 1: 0x40a060, 2: 0x4080e0, 3: 0x8040e0 };
        const cx = px + pw / 2;
        let y = py + 16;

        // 제목
        pp(s.add.text(cx, y, '[ 건설 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 24;

        // 보유 골드
        const gold = store.getState('gold') || 0;
        pp(s.add.text(cx, y, `보유 골드  💰 ${gold}G`, {
            fontSize: '12px', fontFamily: FONT_BOLD, color: C.expYellow
        }).setOrigin(0.5));
        y += 26;

        // 구분선
        const lineG = pp(s.add.graphics());
        lineG.lineStyle(1, C.borderPrimary, 0.5);
        lineG.lineBetween(px + 24, y, px + pw - 24, y);
        y += 10;

        const available = s.baseManager.getPrereqMetBuilds();

        if (available.length === 0) {
            pp(s.add.text(cx, py + ph / 2 - 20, '건설 가능한 시설이 없습니다.', {
                fontSize: '12px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            const iw = pw - 40;
            const ih = 60;
            for (const f of available.slice(0, 7)) {
                const cost = s.baseManager.getBuildCost(f);
                const canAfford = gold >= cost;
                const tierColor = TIER_COLORS[f.tier] || C.borderPrimary;

                // 카드 배경 그리기 함수
                const ibg = pp(s.add.graphics());
                const cardY = y;
                const drawCard = (hover) => {
                    ibg.clear();
                    ibg.fillStyle(hover ? 0x1a1a30 : (canAfford ? C.inputBg : 0x08080e), 1);
                    ibg.fillRoundedRect(px + 20, cardY, iw, ih, 4);
                    ibg.lineStyle(hover ? 2 : 1, hover ? 0xe03030 : (canAfford ? C.borderPrimary : 0x202030));
                    ibg.strokeRoundedRect(px + 20, cardY, iw, ih, 4);
                    // 좌측 티어 악센트 라인
                    ibg.fillStyle(tierColor, canAfford ? 0.6 : 0.2);
                    ibg.fillRect(px + 20, cardY + 4, 3, ih - 8);
                    // 티어 뱃지
                    ibg.fillStyle(tierColor, canAfford ? 0.9 : 0.4);
                    ibg.fillRoundedRect(px + 28, cardY + 6, 30, 16, 3);
                };
                drawCard(false);

                // 티어 텍스트
                pp(s.add.text(px + 43, cardY + 14, `T${f.tier}`, {
                    fontSize: '10px', fontFamily: FONT_BOLD, color: '#fff'
                }).setOrigin(0.5));

                // 시설명
                pp(s.add.text(px + 66, cardY + 8, f.name_ko, {
                    fontSize: '14px', fontFamily: FONT_BOLD,
                    color: canAfford ? C.textPrimary : C.textMuted
                }));

                // 설명
                pp(s.add.text(px + 66, cardY + 30, f.description, {
                    fontSize: '10px', fontFamily: FONT,
                    color: canAfford ? C.textSecondary : '#404060',
                    wordWrap: { width: iw - 200 }
                }));

                // 골드 비용 (우측 상단)
                pp(s.add.text(px + iw + 12, cardY + 10, `💰 ${cost}G`, {
                    fontSize: '12px', fontFamily: FONT_BOLD,
                    color: canAfford ? C.expYellow : '#f04040'
                }).setOrigin(1, 0));

                // 필요 진행도 (우측 하단)
                pp(s.add.text(px + iw + 12, cardY + 30, `🔨 ${f.build_cost}`, {
                    fontSize: '10px', fontFamily: FONT,
                    color: canAfford ? C.textSecondary : '#404060'
                }).setOrigin(1, 0));

                // 골드 부족 라벨
                if (!canAfford) {
                    pp(s.add.text(px + iw + 12, cardY + ih - 8, '골드 부족', {
                        fontSize: '9px', fontFamily: FONT, color: '#f04040'
                    }).setOrigin(1, 0.5));
                }

                // 호버 + 클릭 (골드 충분할 때만)
                if (canAfford) {
                    const zone = pp(s.add.zone(px + 20 + iw / 2, cardY + ih / 2, iw, ih).setInteractive({ useHandCursor: true }));
                    const facility = f;
                    zone.on('pointerover', () => drawCard(true));
                    zone.on('pointerout', () => drawCard(false));
                    zone.on('pointerdown', () => {
                        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
                        s._showPopup('heroSelect', { actionType: 'build', target: facility, heroes });
                    });
                }
                y += ih + 6;
            }
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 연구
    // ═══════════════════════════════════
    popupResearch(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;

        pp(s.add.text(cx, y, '[ 연구 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 30;

        const available = s.baseManager.getAvailableResearch();
        const gold = store.getState('gold') || 0;
        const iw = pw - 40;

        if (available.length === 0) {
            pp(s.add.text(cx, y + 40, '연구 가능한 항목이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const r of available.slice(0, 8)) {
                const canAfford = gold >= r.cost;

                const ibg = pp(s.add.graphics());
                ibg.fillStyle(C.inputBg, 1); ibg.fillRect(px + 20, y, iw, 44);
                ibg.lineStyle(1, C.borderPrimary); ibg.strokeRect(px + 20, y, iw, 44);

                pp(s.add.text(px + 32, y + 6, r.name_ko, {
                    fontSize: '13px', fontFamily: FONT_BOLD, color: canAfford ? C.textPrimary : C.textMuted
                }));
                pp(s.add.text(px + 32, y + 26, r.description, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted,
                    wordWrap: { width: iw - 120 }
                }));
                pp(s.add.text(px + iw - 8, y + 6, `${r.cost}G / 진행도 ${r.research_cost}`, {
                    fontSize: '11px', fontFamily: FONT, color: canAfford ? C.expYellow : '#f04040'
                }).setOrigin(1, 0));

                if (canAfford) {
                    const zone = pp(s.add.zone(px + 20 + iw / 2, y + 22, iw, 44).setInteractive({ useHandCursor: true }));
                    const research = r;
                    const rowY = y;
                    zone.on('pointerover', () => { ibg.clear(); ibg.fillStyle(0x1e1e34, 1); ibg.fillRect(px + 20, rowY, iw, 44); ibg.lineStyle(1, 0xe03030); ibg.strokeRect(px + 20, rowY, iw, 44); });
                    zone.on('pointerout', () => { ibg.clear(); ibg.fillStyle(C.inputBg, 1); ibg.fillRect(px + 20, rowY, iw, 44); ibg.lineStyle(1, C.borderPrimary); ibg.strokeRect(px + 20, rowY, iw, 44); });
                    zone.on('pointerdown', () => {
                        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
                        s._showPopup('heroSelect', { actionType: 'research', target: research, heroes });
                    });
                }
                y += 50;
            }
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 시설 행동
    // ═══════════════════════════════════
    popupFacility(px, py, pw, ph, facility) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        if (!facility) { s._closePanelAction(); return; }
        const cx = px + pw / 2;
        let y = py + 16;

        pp(s.add.text(cx, y, `[ ${facility.name_ko} ]`, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        pp(s.add.text(cx, y, facility.description, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 34;

        if (facility.id === 'tavern') {
            pp(s.popupSystem.popupButton(cx, y, '🍺 영웅 고용', () => s._showPopup('recruit')));
        } else if (facility.id === 'hospital') {
            pp(s.popupSystem.popupButton(cx, y, '💊 사기 안정화', () => s.actions.doStabilize()));
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 건물 정보
    // ═══════════════════════════════════
    popupBuildingInfo(px, py, pw, ph, building) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        const heroes = s.heroManager.getHeroes();
        const hero = heroes.find(h => h.id === building.assignedHeroId);

        pp(s.add.text(cx, py + 20, `🔨 ${building.name}`, {
            fontSize: '14px', fontFamily: FONT_BOLD, color: C.infoCyan
        }).setOrigin(0.5));

        pp(s.add.text(cx, py + 50, `건설 진행: ${building.progress}/${building.buildCost}`, {
            fontSize: '11px', fontFamily: FONT, color: C.textPrimary
        }).setOrigin(0.5));

        if (hero) {
            pp(s.add.text(cx, py + 72, `담당: ${hero.name}`, {
                fontSize: '11px', fontFamily: FONT, color: C.textSecondary
            }).setOrigin(0.5));
        } else {
            pp(s.add.text(cx, py + 72, '담당 영웅 없음 — 영웅을 투입해야 진행됩니다', {
                fontSize: '10px', fontFamily: FONT, color: C.expYellow
            }).setOrigin(0.5));
            pp(s.popupSystem.popupButton(cx, py + 100, '영웅 투입', () => {
                const idle = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
                s._pushPopup('heroSelect', { actionType: 'buildAssign', target: building, heroes: idle });
            }));
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }
}

export default PopupsBuild;
