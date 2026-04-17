/**
 * 행동 관련 팝업 — 채집, 벌목, 개척, 방어, 사냥, 국시, 확인
 */
import { C, SIN_COLOR_HEX } from '../MapConstants.js';
import { FONT, FONT_BOLD } from '../../../constants.js';
import store from '../../../store/Store.js';
import { topSin, SIN_NAMES_KO } from '../../../game_logic/SinUtils.js';

class PopupsAction {
    constructor(scene) {
        this.scene = scene;
    }

    // ═══════════════════════════════════
    // 팝업: 채집
    // ═══════════════════════════════════
    popupGather(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;

        pp(s.add.text(cx, y, '🌿 채집 — 영웅 선택', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#30b050'
        }).setOrigin(0.5));
        y += 24;

        pp(s.add.text(cx, y, '영웅 1명을 채집에 보냅니다. 식량을 획득합니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            pp(s.add.text(cx, y + 30, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;

                const rowBg = s.add.graphics();
                rowBg.fillStyle(C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 32, 4);
                rowBg.lineStyle(1, C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 32, 4);
                pp(rowBg);

                pp(s.add.text(listX + 12, y + 8, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                hero.trait ? s.widgets.traitLabel(listX + 180, y + 9, hero.trait, { pp }) : pp(s.add.text(listX + 180, y + 9, SIN_NAMES_KO[topSin(hero.sinStats)], { fontSize: '9px', fontFamily: FONT, color: sinColor }));

                const heroRef = hero;
                pp(s.popupSystem.popupSmallBtn(listX + listW - 70, y + 16, '정보', () => {
                    s._pushPopup('heroDetail', { hero: heroRef });
                }));
                pp(s.popupSystem.popupSmallBtn(listX + listW - 10, y + 16, '파견', () => {
                    s.popupSystem.closeAllPopups();
                    s.actions.launchGather(heroRef);
                }));
                y += 38;
            }
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 벌목
    // ═══════════════════════════════════
    popupLumber(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;

        pp(s.add.text(cx, y, '🪓 벌목 — 영웅 선택', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#8a6a3a'
        }).setOrigin(0.5));
        y += 24;

        pp(s.add.text(cx, y, '영웅 1명을 벌목에 보냅니다. 나무를 획득합니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            pp(s.add.text(cx, y + 30, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;

                const rowBg = s.add.graphics();
                rowBg.fillStyle(C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 32, 4);
                rowBg.lineStyle(1, C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 32, 4);
                pp(rowBg);

                pp(s.add.text(listX + 12, y + 8, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                hero.trait ? s.widgets.traitLabel(listX + 180, y + 9, hero.trait, { pp }) : pp(s.add.text(listX + 180, y + 9, SIN_NAMES_KO[topSin(hero.sinStats)], { fontSize: '9px', fontFamily: FONT, color: sinColor }));

                const heroRef = hero;
                pp(s.popupSystem.popupSmallBtn(listX + listW - 70, y + 16, '정보', () => {
                    s._pushPopup('heroDetail', { hero: heroRef });
                }));
                pp(s.popupSystem.popupSmallBtn(listX + listW - 10, y + 16, '파견', () => {
                    s.popupSystem.closeAllPopups();
                    s.actions.launchLumber(heroRef);
                }));
                y += 38;
            }
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 개척
    // ═══════════════════════════════════
    popupPioneer(px, py, pw, ph, data) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;
        const cellIndex = data.cellIndex;
        const cost = s.balance.pioneer_cost_wood ?? 30;
        const wood = store.getState('wood') || 0;
        const available = s.baseManager.getAvailablePioneerCells();
        const canPioneer = available.includes(cellIndex);
        const pioneering = s.baseManager.getCurrentPioneering();

        pp(s.add.text(cx, y, '🪓 개척 — 거점 확장', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#c89050'
        }).setOrigin(0.5));
        y += 24;

        const row = Math.floor(cellIndex / 5);
        const col = cellIndex % 5;
        pp(s.add.text(cx, y, `셀 [${row},${col}] 개척 | 비용: 나무 ${cost}`, {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        if (pioneering) {
            pp(s.add.text(cx, y + 30, '이미 개척 진행 중', {
                fontSize: '11px', fontFamily: FONT, color: '#f8b830'
            }).setOrigin(0.5));
        } else if (!canPioneer) {
            pp(s.add.text(cx, y + 30, '인접한 해금 셀이 없어 개척 불가', {
                fontSize: '11px', fontFamily: FONT, color: '#f04040'
            }).setOrigin(0.5));
        } else if (wood < cost) {
            pp(s.add.text(cx, y + 30, `나무 부족 (보유: ${wood} / 필요: ${cost})`, {
                fontSize: '11px', fontFamily: FONT, color: '#f04040'
            }).setOrigin(0.5));
        } else {
            const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
            const listX = px + 16;
            const listW = pw - 32;
            if (heroes.length === 0) {
                pp(s.add.text(cx, y + 30, '투입 가능한 영웅 없음', {
                    fontSize: '11px', fontFamily: FONT, color: C.textMuted
                }).setOrigin(0.5));
            } else {
                pp(s.add.text(px + 16, y, '영웅 선택 (힘+체력)', {
                    fontSize: '10px', fontFamily: FONT, color: C.textSecondary
                }));
                y += 20;
                for (const hero of heroes) {
                    const sinColor = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;
                    const rowBg = s.add.graphics();
                    rowBg.fillStyle(C.cardBg, 1);
                    rowBg.fillRoundedRect(listX, y, listW, 36, 4);
                    rowBg.lineStyle(1, C.borderPrimary);
                    rowBg.strokeRoundedRect(listX, y, listW, 36, 4);
                    pp(rowBg);
                    pp(s.add.text(listX + 12, y + 10, hero.name, {
                        fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                    }));
                    hero.trait ? s.widgets.traitLabel(listX + 120, y + 10, hero.trait, { pp }) : pp(s.add.text(listX + 120, y + 10, SIN_NAMES_KO[topSin(hero.sinStats)], { fontSize: '9px', fontFamily: FONT, color: sinColor }));
                    const eff = Math.round((hero.stats.strength + hero.stats.vitality) / 2);
                    pp(s.add.text(listX + 200, y + 10, `효율: ${eff}`, {
                        fontSize: '9px', fontFamily: FONT, color: C.infoCyan
                    }));
                    pp(s.popupSystem.popupButton(listX + listW - 40, y + 18, '투입', () => {
                        s.popupSystem.closeAllPopups();
                        const result = s.baseManager.startPioneering(cellIndex, hero.id);
                        if (result.success) {
                            hero.status = 'pioneer';
                            store.setState('heroes', [...s.heroManager.getHeroes()]);
                        }
                        s.world.updateBuildings();
                        s.bottomPanel.refreshActiveTab();
                        s.hud.updateResources();
                    }));
                    y += 42;
                }
            }
        }
        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 방어 배치
    // ═══════════════════════════════════
    popupDefense(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;

        pp(s.add.text(cx, y, '🛡️ 방어 배치', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#4080e0'
        }).setOrigin(0.5));
        y += 24;

        pp(s.add.text(cx, y, '밤 습격에 참전할 영웅을 배치합니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status !== 'injured');
        const defenseIds = s.baseManager.getDefenseHeroIds();
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            pp(s.add.text(cx, y + 30, '배치 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;
                const isAssigned = defenseIds.includes(hero.id);

                const rowBg = s.add.graphics();
                rowBg.fillStyle(isAssigned ? 0x1a2040 : C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 36, 4);
                rowBg.lineStyle(1, isAssigned ? 0x4080e0 : C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 36, 4);
                pp(rowBg);

                pp(s.add.text(listX + 12, y + 10, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                hero.trait ? s.widgets.traitLabel(listX + 120, y + 10, hero.trait, { pp }) : pp(s.add.text(listX + 120, y + 10, SIN_NAMES_KO[topSin(hero.sinStats)], { fontSize: '9px', fontFamily: FONT, color: sinColor }));

                const statusLabel = isAssigned ? '🛡️ 배치됨' : hero.status === 'idle' ? '대기' : hero.status;
                pp(s.add.text(listX + 200, y + 10, statusLabel, {
                    fontSize: '9px', fontFamily: FONT, color: isAssigned ? '#4080e0' : C.textMuted
                }));

                if (isAssigned) {
                    pp(s.popupSystem.popupButton(listX + listW - 40, y + 18, '해제', () => {
                        s.baseManager.unassignDefense(hero.id);
                        s.popupSystem.closeAllPopups();
                        s._showPopup('defense', {});
                        s.bottomPanel.refreshActiveTab();
                    }));
                } else if (hero.status === 'idle') {
                    pp(s.popupSystem.popupButton(listX + listW - 40, y + 18, '배치', () => {
                        s.baseManager.assignDefense(hero.id);
                        hero.status = 'defense';
                        store.setState('heroes', [...s.heroManager.getHeroes()]);
                        s.popupSystem.closeAllPopups();
                        s._showPopup('defense', {});
                        s.bottomPanel.refreshActiveTab();
                    }));
                }
                y += 42;
            }
        }

        const defCount = defenseIds.length;
        pp(s.add.text(cx, py + ph - 60, `현재 방어 배치: ${defCount}명`, {
            fontSize: '12px', fontFamily: FONT_BOLD, color: defCount > 0 ? '#4080e0' : '#f04040'
        }).setOrigin(0.5));

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 사냥
    // ═══════════════════════════════════
    popupHunt(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;

        pp(s.add.text(cx, y, '🏹 사냥 — 영웅 선택', {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#d0a020'
        }).setOrigin(0.5));
        y += 24;

        pp(s.add.text(cx, y, '영웅 1명을 사냥에 보냅니다', {
            fontSize: '10px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const heroes = s.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const listX = px + 16;
        const listW = pw - 32;

        if (heroes.length === 0) {
            pp(s.add.text(cx, y + 30, '파견 가능한 영웅 없음', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const sinColor = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;
                const b = s.balance;
                const atk = Math.floor((hero.stats.strength || 10) * (b.atk_expedition_str_mult ?? 0.7) + (hero.stats.agility || 10) * (b.atk_expedition_agi_mult ?? 0.4));

                const rowBg = s.add.graphics();
                rowBg.fillStyle(C.cardBg, 1);
                rowBg.fillRoundedRect(listX, y, listW, 32, 4);
                rowBg.lineStyle(1, C.borderPrimary);
                rowBg.strokeRoundedRect(listX, y, listW, 32, 4);
                pp(rowBg);

                pp(s.add.text(listX + 12, y + 8, hero.name, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                hero.trait ? s.widgets.traitLabel(listX + 180, y + 9, hero.trait, { pp }) : pp(s.add.text(listX + 180, y + 9, SIN_NAMES_KO[topSin(hero.sinStats)], { fontSize: '9px', fontFamily: FONT, color: sinColor }));
                pp(s.add.text(listX + 240, y + 9, `ATK ${atk}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                }));

                const heroRef = hero;
                pp(s.popupSystem.popupSmallBtn(listX + listW - 70, y + 16, '정보', () => {
                    s._pushPopup('heroDetail', { hero: heroRef });
                }));
                pp(s.popupSystem.popupSmallBtn(listX + listW - 10, y + 16, '파견', () => {
                    s.popupSystem.closeAllPopups();
                    s.actions.launchHunt(hero);
                }));
                y += 38;
            }
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 국시(Edict) — 7종 중 1개 선포, 기간형 5턴
    // ═══════════════════════════════════
    popupEdict(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;

        const em = s.edictManager;
        const day = s.turnManager.getCurrentTurn().day;

        pp(s.add.text(cx, y, '[ 국  시 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: '#f8c830',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 26;

        const activeDef = em.getActiveDefinition();
        const activeSin = em.getActiveSin();
        const inCooldown = em.isCooldown(day);

        // 현재 상태 헤더
        if (activeDef) {
            const remain = em.getRemainingTurns(day);
            pp(s.add.text(cx, y, `선포 중: ${activeDef.name_ko} (잔여 ${remain}턴)`, {
                fontSize: '12px', fontFamily: FONT_BOLD, color: '#f8c830'
            }).setOrigin(0.5));
        } else if (inCooldown) {
            const cd = em.getCooldownTurns(day);
            pp(s.add.text(cx, y, `쿨다운: ${cd}턴 남음`, {
                fontSize: '12px', fontFamily: FONT_BOLD, color: '#808098'
            }).setOrigin(0.5));
        } else {
            pp(s.add.text(cx, y, '무 국시 — 선포 가능', {
                fontSize: '12px', fontFamily: FONT, color: C.textSecondary
            }).setOrigin(0.5));
        }
        y += 24;

        // 국시 목록
        const iw = pw - 40;
        const defs = em.getDefinitions();
        for (const def of defs) {
            const isActive = def.sin === activeSin;
            const sinColor = SIN_COLOR_HEX[def.sin] || C.textMuted;

            const rowBg = pp(s.add.graphics());
            rowBg.fillStyle(isActive ? 0x2a2010 : C.inputBg, 1);
            rowBg.fillRect(px + 20, y, iw, 30);
            rowBg.lineStyle(1, isActive ? 0xf8c830 : C.borderPrimary);
            rowBg.strokeRect(px + 20, y, iw, 30);

            pp(s.add.text(px + 32, y + 4, `${def.name_ko} (${SIN_NAMES_KO[def.sin]})`, {
                fontSize: '11px', fontFamily: FONT_BOLD, color: sinColor
            }));
            pp(s.add.text(px + 32, y + 17, def.description || '', {
                fontSize: '9px', fontFamily: FONT, color: C.textSecondary
            }));

            // 선포/해제 버튼
            const sinKey = def.sin;
            if (isActive) {
                pp(s.popupSystem.popupSmallBtn(px + 20 + iw - 30, y + 15, '해제', () => {
                    em.revoke(day);
                    s._showPopup('edict');
                }));
            } else if (!inCooldown && !activeDef) {
                pp(s.popupSystem.popupSmallBtn(px + 20 + iw - 30, y + 15, '선포', () => {
                    em.proclaim(sinKey, day);
                    s._showPopup('edict');
                }));
            }
            y += 34;
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }

    // ═══════════════════════════════════
    // 팝업: 확인 (범용)
    // ═══════════════════════════════════
    popupConfirm(px, py, pw, ph, data) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;

        pp(s.add.text(cx, py + 20, data.title, {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#f04040'
        }).setOrigin(0.5));

        pp(s.add.text(cx, py + 70, data.message, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0', align: 'center',
            wordWrap: { width: pw - 40 }
        }).setOrigin(0.5));

        const btnY = py + ph - 45;
        pp(s.popupSystem.popupButton(cx - 80, btnY, '취소', () => s.popupSystem.closeAllPopups()));
        pp(s.popupSystem.popupButton(cx + 80, btnY, '강행', () => {
            s.popupSystem.closeAllPopups();
            data.onConfirm();
        }));
    }
}

export default PopupsAction;
