/**
 * 영웅 관련 팝업 — 영웅 선택, 상세, 고용
 */
import { C, ACTION_STATS, SIN_COLOR_HEX, MORALE_COLORS_HEX } from '../MapConstants.js';
import { FONT, FONT_BOLD } from '../../../constants.js';
import store from '../../../store/Store.js';
import { topSin, SIN_NAMES_KO } from '../../../game_logic/SinUtils.js';

class PopupsHero {
    constructor(scene) {
        this.scene = scene;
    }

    // ═══════════════════════════════════
    // 팝업: 영웅 선택 (건설/연구 투입)
    // ═══════════════════════════════════
    popupHeroSelect(px, py, pw, ph, data) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const { actionType, target, heroes } = data;
        const cx = px + pw / 2;
        let y = py + 16;

        const statConfig = ACTION_STATS[actionType];
        pp(s.add.text(cx, y, `[ ${statConfig.label} — 영웅 선택 ]`, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        pp(s.add.text(cx, y, `대상: ${target.name_ko || target.name}`, {
            fontSize: '11px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0.5));
        y += 24;

        const iw = pw - 40;
        if (heroes.length === 0) {
            pp(s.add.text(cx, y + 40, '투입 가능한 영웅이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            for (const hero of heroes) {
                const stars = s.dayActions.calcFitness(hero, statConfig.primary);
                const sinColor = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;

                const ibg = pp(s.add.graphics());
                ibg.fillStyle(C.bgSecondary, 1); ibg.fillRoundedRect(px + 20, y, iw, 32, 4);
                ibg.lineStyle(1, C.borderSecondary); ibg.strokeRoundedRect(px + 20, y, iw, 32, 4);

                pp(s.add.text(px + 32, y + 8, `${hero.name}`, {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                if (hero.trait) {
                    s.widgets.traitLabel(px + 200, y + 9, hero.trait, { pp });
                } else {
                    pp(s.add.text(px + 200, y + 9, SIN_NAMES_KO[topSin(hero.sinStats)], { fontSize: '9px', fontFamily: FONT, color: sinColor }));
                }
                pp(s.add.text(px + 290, y + 9, `${statConfig.label}력 ${stars}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                }));

                const heroRef = hero;
                pp(s.popupSystem.popupSmallBtn(px + iw - 70, y + 16, '정보', () => {
                    s._showPopup('heroDetail', { hero: heroRef });
                }));
                pp(s.popupSystem.popupSmallBtn(px + iw - 10, y + 16, '투입', () => {
                    let result;
                    if (actionType === 'build') {
                        result = s.baseManager.startBuilding(target.id, hero.id);
                        if (result.success) { hero.status = 'construction'; store.setState('heroes', [...s.heroManager.getHeroes()]); }
                    } else if (actionType === 'buildAssign') {
                        result = s.baseManager.assignHeroToBuilding(target.facilityId, hero.id);
                        if (result.success) { hero.status = 'construction'; store.setState('heroes', [...s.heroManager.getHeroes()]); }
                    } else if (actionType === 'research') {
                        result = s.baseManager.startResearch(target.id, hero.id);
                        if (result.success) { hero.status = 'research'; store.setState('heroes', [...s.heroManager.getHeroes()]); }
                    }
                    s.world.updateBuildings();
                    s._closePanelAction();
                }));

                y += 38;
            }
        }

        pp(s.popupSystem.popupButton(cx - 80, py + ph - 40, '← 뒤로', () => {
            if (actionType === 'buildAssign') {
                s._closePanelAction();
            } else {
                s._showPopup(actionType === 'build' ? 'build' : 'research');
            }
        }));
        pp(s.popupSystem.popupButton(cx + 80, py + ph - 40, '닫기', () => {
            s.popupSystem.closeAllPopups();
            s.bottomPanel._actionMode = null;
            s.bottomPanel._actionData = null;
        }));
    }

    // ═══════════════════════════════════
    // 팝업: 영웅 상세
    // ═══════════════════════════════════
    popupHeroDetail(px, py, pw, ph, hero) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 12;
        const st = hero.stats;
        const sub = hero.subStats || {};
        const derived = s.heroManager.getDerivedStats(hero);
        const sinColorHex = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;
        const sinColor = Phaser.Display.Color.HexStringToColor(sinColorHex).color;

        // ─── 상단 카드 ───
        const cardX = px + 16;
        const cardW = pw - 32;
        const cardH = 140;
        const cardBg = pp(s.add.graphics());
        cardBg.fillStyle(C.cardBg, 1);
        cardBg.fillRect(cardX, y, cardW, cardH);
        cardBg.lineStyle(2, C.borderSecondary);
        cardBg.strokeRect(cardX, y, cardW, cardH);
        cardBg.lineStyle(1, C.borderHighlight, 0.25);
        cardBg.lineBetween(cardX + 2, y + 2, cardX + cardW - 2, y + 2);
        cardBg.lineStyle(1, C.borderDark, 0.5);
        cardBg.lineBetween(cardX + 2, y + cardH - 2, cardX + cardW - 2, y + cardH - 2);

        // 죄종 컬러 바
        const sinBarG = pp(s.add.graphics());
        sinBarG.fillStyle(sinColor, 0.6);
        sinBarG.fillRect(cardX + 2, y + 2, cardW - 4, 4);

        // 초상화
        const portSize = 100;
        const portX = cardX + 12;
        const portY = y + 18;
        const portG = pp(s.add.graphics());
        portG.fillStyle(0x0e0e1a, 1);
        portG.fillRect(portX, portY, portSize, portSize);
        portG.lineStyle(1, C.borderSecondary);
        portG.strokeRect(portX, portY, portSize, portSize);

        if (hero.appearance && hero.appearance.layers && s._spriteRenderer) {
            const heroId = `hero_${hero.id}`;
            const textures = s._spriteRenderer.compose(hero.appearance, heroId);
            if (textures && textures.walk) {
                const spr = pp(s.add.sprite(portX + portSize / 2, portY + portSize / 2 + 6, textures.walk, 0));
                spr.setScale((portSize - 8) / 64);
                if (s.anims.exists(`${heroId}_walk`)) spr.play(`${heroId}_walk`);
            }
        } else {
            portG.lineStyle(1, C.borderPrimary, 0.4);
            portG.lineBetween(portX, portY, portX + portSize, portY + portSize);
            portG.lineBetween(portX + portSize, portY, portX, portY + portSize);
        }

        // 이름 + 죄종
        const infoX = portX + portSize + 16;
        let ty = portY + 4;
        const nameObj = pp(s.add.text(infoX, ty, hero.name, {
            fontSize: '22px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }));
        if (hero.trait) {
            s.widgets.traitLabel(infoX + nameObj.width + 10, ty + 6, hero.trait, { fontSize: '14px', pp });
        } else {
            pp(s.add.text(infoX + nameObj.width + 10, ty + 4, SIN_NAMES_KO[topSin(hero.sinStats)], { fontSize: '16px', fontFamily: FONT_BOLD, color: sinColorHex }));
        }
        pp(s.add.text(infoX + nameObj.width + 10, ty + 22, `🌾${hero.foodCost ?? '?'}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: '#a08040'
        }));
        ty += 30;

        // 스토리
        const storyText = this.getHeroStory(topSin(hero.sinStats));
        pp(s.add.text(infoX, ty, storyText, {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted,
            lineSpacing: 3,
            wordWrap: { width: cardW - portSize - 46 }
        }));

        // 상태
        const statusMap = { expedition: '원정', injured: '부상', construction: '건설', research: '연구', idle: '대기', hunt: '사냥', gather: '채집', lumber: '벌목' };
        pp(s.add.text(cardX + cardW - 12, y + 10, statusMap[hero.status] || '대기', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(1, 0));

        y += cardH + 10;

        // ─── 사기 바 ───
        const moraleState = s.heroManager.getMoraleState(hero.morale);
        const moraleColor = MORALE_COLORS_HEX[moraleState];
        const moraleName = s.heroManager.getMoraleStateName(hero.morale);
        const mBarX = px + 32;
        const mBarW = pw - 160;
        pp(s.add.text(mBarX, y - 2, '사기', { fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary }));
        const mBarStartX = mBarX + 36;
        const mBg = pp(s.add.graphics());
        mBg.fillStyle(0x0e0e1a, 1); mBg.fillRect(mBarStartX, y + 2, mBarW, 10);
        mBg.lineStyle(1, C.borderPrimary); mBg.strokeRect(mBarStartX, y + 2, mBarW, 10);
        const mFill = pp(s.add.graphics());
        const mfw = Math.max(0, (hero.morale / 100) * (mBarW - 2));
        mFill.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
        mFill.fillRect(mBarStartX + 1, y + 3, mfw, 8);
        pp(s.add.text(mBarStartX + mBarW + 8, y - 2, `${hero.morale} (${moraleName})`, {
            fontSize: '13px', fontFamily: FONT_BOLD, color: moraleColor
        }));
        y += 22;

        // ─── 스탯 ───
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
            const textObj = s.add.text(tx, y, ` ${label} `, { fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary });
            pp(textObj);
            const tw = textObj.width;
            const lineG = pp(s.add.graphics());
            lineG.lineStyle(1, C.borderSecondary, 0.6);
            lineG.lineBetween(px + margin, lineY, tx - 6, lineY);
            lineG.lineBetween(tx + tw + 6, lineY, px + pw - margin, lineY);
            y += 22;
        };

        const _drawStatRow = (xPos, yPos, label, val, labelW = 36, barW = statBarMaxW) => {
            const valColor = val >= 15 ? '#40d870' : val >= 10 ? '#40a0f8' : val >= 7 ? '#f8b830' : '#f04040';
            const valColorHex = Phaser.Display.Color.HexStringToColor(valColor).color;
            pp(s.add.text(xPos, yPos, label, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }));
            const bx = xPos + labelW;
            const bw = barW;
            const bh = 10;
            const by = yPos + 3;
            const g = pp(s.add.graphics());
            g.fillStyle(0x0e0e1a, 1); g.fillRect(bx, by, bw, bh);
            g.lineStyle(1, C.borderPrimary, 0.6); g.strokeRect(bx, by, bw, bh);
            const fw = Math.max(0, Math.min(1, val / statMax)) * (bw - 2);
            g.fillStyle(valColorHex, 1); g.fillRect(bx + 1, by + 1, fw, bh - 2);
            pp(s.add.text(bx + bw + 6, yPos, `${val}`, { fontSize: '11px', fontFamily: FONT_BOLD, color: valColor }));
        };

        // 기본 스탯
        _drawSectionHeader('기본');
        const statLabels = [
            { key: 'strength', label: '힘' }, { key: 'agility', label: '민첩' },
            { key: 'intellect', label: '지능' }, { key: 'vitality', label: '체력' },
            { key: 'perception', label: '감각' }, { key: 'leadership', label: '통솔' },
            { key: 'charisma', label: '매력' }
        ];
        for (let i = 0; i < statLabels.length; i++) {
            const stat = statLabels[i];
            const xPos = i % 2 === 0 ? col1X : col2X;
            _drawStatRow(xPos, y, stat.label, st[stat.key]);
            if (i % 2 === 1 || i === statLabels.length - 1) y += rowH;
        }
        y += sectionGap;

        // 행동 스탯
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
            const val = act.b ? Math.round((st[act.a] + st[act.b]) / 2) : st[act.a];
            _drawStatRow(xPos, y, act.label, val, 44);
            if (i % 2 === 1 || i === actionStats.length - 1) y += rowH;
        }
        y += sectionGap;

        // 감정 스탯
        _drawSectionHeader('감정');
        const subLabels = [
            { key: 'wrath', label: '분노', src: 'sub' },
            { key: 'greed', label: '탐욕', src: 'sub' },
            { key: 'pride', label: '교만', src: 'sub' },
            { key: 'envy', label: '시기', src: 'sub' },
            { key: 'gluttony', label: '폭식', src: 'sub' },
            { key: 'lust', label: '색욕', src: 'sub' },
            { key: 'sloth', label: '나태', src: 'sub' }
        ];
        for (let i = 0; i < subLabels.length; i++) {
            const sl = subLabels[i];
            const xPos = i % 2 === 0 ? col1X : col2X;
            const val = sl.src === 'sub' ? (sub[sl.key] ?? 0) : (derived[sl.key] ?? 0);
            _drawStatRow(xPos, y, sl.label, val, 44);
            if (i % 2 === 1 || i === subLabels.length - 1) y += rowH;
        }
        y += sectionGap;

        // 마무리 선
        const endLineG = pp(s.add.graphics());
        endLineG.lineStyle(1, C.borderSecondary, 0.6);
        endLineG.lineBetween(px + margin, y, px + pw - margin, y);

        // 하단 버튼
        pp(s.popupSystem.popupButton(cx - 80, py + ph - 40, '해고', () => {
            s.heroManager.dismissHero(hero.id);
            s.popupSystem.closeAllPopups();
            s.bottomPanel.refreshActiveTab();
        }));
        pp(s.popupSystem.popupButton(cx + 80, py + ph - 40, '닫기', () => {
            s.popupSystem.closePopup();
        }));
    }

    // ═══════════════════════════════════
    // 영웅 스토리 텍스트
    // ═══════════════════════════════════
    getHeroStory(primarySin) {
        const stories = {
            wrath: '전쟁에서 돌아온 뒤로 분노를 멈출 수 없었다.\n칼을 내려놓으면 손이 떨렸고,\n결국 바알의 부름에 응했다.',
            envy: '언제나 형의 그림자 속에 있었다.\n인정받지 못한 재능은 독이 되어\n결국 그를 이곳으로 이끌었다.',
            greed: '가진 것을 모두 잃은 날,\n다시는 빈손이 되지 않겠다고 맹세했다.\n그 집착이 바알의 눈에 띄었다.',
            sloth: '한때 뛰어난 학자였으나 모든 것을 포기했다.\n세상에 지쳐 쓰러진 그를\n바알이 주워 담았다.',
            gluttony: '굶주림의 기억은 지워지지 않았다.\n아무리 채워도 부족했고,\n결국 악마의 식탁에 앉게 되었다.',
            lust: '사랑에 실패한 뒤 혼자가 되는 것이 두려웠다.\n누군가 곁에 있어야만 했고,\n그 절박함이 이곳까지 왔다.',
            pride: '왕좌에서 쫓겨난 지휘관.\n자신이 옳다는 확신은 변하지 않았고,\n바알 아래서라도 증명하려 한다.',
        };
        return stories[primarySin] || '어둠 속에서 바알의 부름을 들었다.\n갈 곳 없는 자에게 선택지란 없었다.';
    }

    // ═══════════════════════════════════
    // 팝업: 영웅 고용
    // ═══════════════════════════════════
    popupRecruit(px, py, pw, ph) {
        const s = this.scene;
        const pp = s.popupSystem.pp.bind(s.popupSystem);
        const cx = px + pw / 2;
        let y = py + 16;

        pp(s.add.text(cx, y, '[ 주점 — 영웅 고용 ]', {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5));
        y += 28;

        const currentCount = s.heroManager.getHeroes().length;
        const gold = store.getState('gold') || 0;

        pp(s.add.text(cx, y, `${currentCount}/7명 | 고용비: 💰100 | 보유: 💰${gold}`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5));
        y += 24;

        const iw = pw - 40;
        if (currentCount >= 7) {
            pp(s.add.text(cx, y + 40, '로스터가 가득 찼습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else if (gold < 100) {
            pp(s.add.text(cx, y + 40, '돈이 부족합니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            const recruits = s.heroManager.generateRecruits(3);
            for (const recruit of recruits) {
                const sinColor = SIN_COLOR_HEX[topSin(recruit.sinStats)] || C.textMuted;

                const ibg = pp(s.add.graphics());
                ibg.fillStyle(C.bgSecondary, 1); ibg.fillRect(px + 20, y, iw, 80);
                ibg.lineStyle(1, C.borderSecondary); ibg.strokeRect(px + 20, y, iw, 80);

                pp(s.add.text(px + 32, y + 8, recruit.name, {
                    fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
                }));
                if (recruit.trait) {
                    s.widgets.traitLabel(px + 32, y + 26, recruit.trait, { pp });
                } else {
                    pp(s.add.text(px + 32, y + 26, SIN_NAMES_KO[topSin(recruit.sinStats)], { fontSize: '9px', fontFamily: FONT, color: sinColor }));
                }
                pp(s.add.text(px + 32, y + 42, '스탯: 고용 후 확인', {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                }));
                pp(s.add.text(px + 32, y + 58, `${recruit.sinFlaw || ''}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted,
                    wordWrap: { width: iw - 100 }
                }));

                pp(s.popupSystem.popupSmallBtn(px + iw - 10, y + 30, '고용', () => {
                    if ((store.getState('gold') || 0) >= 100 && s.heroManager.getHeroes().length < 7) {
                        store.setState('gold', (store.getState('gold') || 0) - 100);
                        s.heroManager.recruitHero(recruit);
                        s._showPopup('recruit');
                    }
                }));

                y += 86;
            }
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }
}

export default PopupsHero;
