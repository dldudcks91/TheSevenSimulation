/**
 * 영웅 관련 팝업 — 영웅 선택, 상세, 고용
 */
import { C, ACTION_STATS, SIN_COLOR_HEX } from '../MapConstants.js';
import { FONT, FONT_BOLD } from '../../../constants.js';
import store from '../../../store/Store.js';
import { topSin, SIN_NAMES_KO } from '../../../game_logic/SinUtils.js';
import SpriteRenderer from '../../SpriteRenderer.js';

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

        // ─── 죄종 수치 바 (7종) ───
        const mBarX = px + 32;
        const mBarW = pw - 160;
        const sinLblW = 32;
        const sinStartX = mBarX + sinLblW;
        const sinRealW = mBarW - sinLblW - 26;
        const sinBarH = 7;
        const sinKeyList = ['wrath', 'envy', 'greed', 'sloth', 'gluttony', 'lust', 'pride'];
        const sinLabelKo = { wrath: '분노', envy: '시기', greed: '탐욕', sloth: '나태', gluttony: '폭식', lust: '색욕', pride: '교만' };

        pp(s.add.text(mBarX, y - 2, '죄종 수치', { fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary }));
        y += 16;

        for (const sinKey of sinKeyList) {
            const sinVal = hero.sinStats?.[sinKey] ?? 1;
            const isRampage = sinVal >= 18;
            const sinColorHex = isRampage ? '#e03030' : SIN_COLOR_HEX[sinKey];

            pp(s.add.text(mBarX, y, sinLabelKo[sinKey], { fontSize: '10px', fontFamily: FONT_BOLD, color: sinColorHex }));

            const sBg = pp(s.add.graphics());
            sBg.fillStyle(0x0e0e1a, 1); sBg.fillRect(sinStartX, y + 2, sinRealW, sinBarH);
            sBg.lineStyle(1, C.borderPrimary); sBg.strokeRect(sinStartX, y + 2, sinRealW, sinBarH);

            const sFill = pp(s.add.graphics());
            const sfw = Math.max(0, (sinVal / 20) * (sinRealW - 2));
            sFill.fillStyle(Phaser.Display.Color.HexStringToColor(sinColorHex).color, 1);
            sFill.fillRect(sinStartX + 1, y + 3, sfw, sinBarH - 2);

            pp(s.add.text(sinStartX + sinRealW + 6, y, `${sinVal}${isRampage ? '!' : ''}`, {
                fontSize: '10px', fontFamily: isRampage ? FONT_BOLD : FONT, color: sinColorHex
            }));

            y += sinBarH + 5;
        }
        y += 6;

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

        if (currentCount >= 7) {
            pp(s.add.text(cx, y + 40, '로스터가 가득 찼습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else if (gold < 100) {
            pp(s.add.text(cx, y + 40, '돈이 부족합니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5));
        } else {
            const recruits = s.heroManager.generateRecruits(2);
            const spriteRenderer = new SpriteRenderer(s);

            const CARD_W = 240;
            const CARD_H = 380;
            const GAP = 20;
            const totalW = CARD_W * 2 + GAP;
            const startX = cx - totalW / 2;
            const cardY = y;

            const STAT_FULL = {
                strength: '힘', agility: '민첩', intellect: '지능',
                vitality: '체력', perception: '감각', leadership: '통솔', charisma: '매력'
            };
            const statKeys = ['strength', 'agility', 'intellect', 'vitality', 'perception', 'leadership', 'charisma'];
            const FRAME_SIZE = 64;

            for (let i = 0; i < recruits.length; i++) {
                const recruit = recruits[i];
                const cardX = startX + i * (CARD_W + GAP);
                const sinColorHex = SIN_COLOR_HEX[topSin(recruit.sinStats)] || C.textMuted;
                const sinColor = Phaser.Display.Color.HexStringToColor(sinColorHex).color;

                // 카드 배경
                const bg = pp(s.add.graphics());
                bg.fillStyle(C.bgSecondary, 1);
                bg.fillRect(cardX, cardY, CARD_W, CARD_H);
                bg.lineStyle(2, C.borderSecondary);
                bg.strokeRect(cardX, cardY, CARD_W, CARD_H);
                bg.lineStyle(1, C.borderHighlight, 0.25);
                bg.lineBetween(cardX + 2, cardY + 2, cardX + CARD_W - 2, cardY + 2);
                bg.lineStyle(1, C.borderDark, 0.5);
                bg.lineBetween(cardX + 2, cardY + CARD_H - 2, cardX + CARD_W - 2, cardY + CARD_H - 2);

                // 죄종 컬러 바
                const sinBar = pp(s.add.graphics());
                sinBar.fillStyle(sinColor, 0.6);
                sinBar.fillRect(cardX + 2, cardY + 2, CARD_W - 4, 4);

                let ty = cardY + 14;

                // 이름
                pp(s.add.text(cardX + 10, ty, recruit.name, {
                    fontSize: '14px', fontFamily: FONT_BOLD, color: C.textPrimary,
                    shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
                }));
                // 특성
                const traitName = recruit.trait ? `[${recruit.trait.name}]` : SIN_NAMES_KO[topSin(recruit.sinStats)];
                const traitLabel = pp(s.add.text(cardX + CARD_W - 10, ty + 2, traitName, {
                    fontSize: '10px', fontFamily: FONT_BOLD, color: '#c0a0e0'
                }).setOrigin(1, 0));
                if (recruit.trait) {
                    traitLabel.setInteractive({ useHandCursor: true });
                    let tip = null;
                    traitLabel.on('pointerover', (pointer) => {
                        traitLabel.setColor('#ffffff');
                        const lines = [];
                        if (recruit.trait.pro_effect) lines.push(`▲ ${recruit.trait.pro_effect}`);
                        if (recruit.trait.con_effect) lines.push(`▼ ${recruit.trait.con_effect}`);
                        const tipW = 200, tipH = 14 * lines.length + 16;
                        const tx = Math.min(pointer.x, 1280 - tipW - 8);
                        tip = s.add.container(0, 0).setDepth(9999);
                        const tbg = s.add.graphics();
                        tbg.fillStyle(0x1a1a2e, 0.95); tbg.fillRoundedRect(tx, pointer.y - tipH - 8, tipW, tipH, 4);
                        tbg.lineStyle(1, 0xc0a0e0); tbg.strokeRoundedRect(tx, pointer.y - tipH - 8, tipW, tipH, 4);
                        tip.add(tbg);
                        tip.add(s.add.text(tx + 8, pointer.y - tipH - 2, lines.join('\n'), {
                            fontSize: '10px', fontFamily: FONT, color: '#e0e0f0', lineSpacing: 2, wordWrap: { width: tipW - 16 }
                        }));
                    });
                    traitLabel.on('pointerout', () => {
                        traitLabel.setColor('#c0a0e0');
                        if (tip) { tip.destroy(); tip = null; }
                    });
                }
                pp(s.add.text(cardX + CARD_W - 10, ty + 16, `비용 ${recruit.foodCost ?? '?'}/턴`, {
                    fontSize: '9px', fontFamily: FONT, color: '#a08040'
                }).setOrigin(1, 0));
                ty += 40;

                // 배경 스토리
                const storyText = this.getHeroStory(topSin(recruit.sinStats));
                const storyObj = pp(s.add.text(cardX + 10, ty, storyText, {
                    fontSize: '10px', fontFamily: FONT, color: C.textMuted,
                    lineSpacing: 3,
                    wordWrap: { width: CARD_W - 20 }
                }));
                ty += storyObj.height + 10;

                // 구분선
                const divG1 = pp(s.add.graphics());
                divG1.lineStyle(1, C.borderPrimary);
                divG1.lineBetween(cardX + 8, ty, cardX + CARD_W - 8, ty);
                ty += 6;

                // LPC 스프라이트
                const sprW = CARD_W - 20;
                const sprH = 80;
                const sprG = pp(s.add.graphics());
                sprG.fillStyle(0x0e0e1a, 1);
                sprG.fillRect(cardX + 10, ty, sprW, sprH);
                sprG.lineStyle(1, C.borderPrimary);
                sprG.strokeRect(cardX + 10, ty, sprW, sprH);

                if (recruit.appearance && recruit.appearance.layers) {
                    const heroId = `recruit_${recruit.id}`;
                    const textures = spriteRenderer.compose(recruit.appearance, heroId);
                    if (textures && textures.idle) {
                        const sprCX = cardX + 10 + sprW / 2;
                        const sprCY = ty + sprH / 2 + 4;
                        const scale = (sprH - 12) / FRAME_SIZE;
                        const spr = pp(s.add.sprite(sprCX, sprCY, textures.idle, 0));
                        spr.setScale(scale);
                        if (s.anims.exists(`${heroId}_idle`)) spr.play(`${heroId}_idle`);
                    }
                }
                ty += sprH + 6;

                // 구분선
                const divG2 = pp(s.add.graphics());
                divG2.lineStyle(1, C.borderPrimary);
                divG2.lineBetween(cardX + 8, ty, cardX + CARD_W - 8, ty);
                ty += 6;

                // 스탯 바
                const barH = 12;
                const barW = CARD_W - 80;
                for (const key of statKeys) {
                    const val = recruit.stats[key];
                    const label = STAT_FULL[key];

                    pp(s.add.text(cardX + 10, ty, label, {
                        fontSize: '10px', fontFamily: FONT, color: C.textSecondary
                    }));

                    const bx = cardX + 46;
                    const barBg = pp(s.add.graphics());
                    barBg.fillStyle(0x0e0e1a, 1);
                    barBg.fillRect(bx, ty, barW, barH);
                    barBg.lineStyle(1, C.borderPrimary);
                    barBg.strokeRect(bx, ty, barW, barH);

                    const fillW = Math.max(0, (val / 20) * (barW - 2));
                    const barColor = val >= 15 ? 0x40d870 : val >= 10 ? 0x40a0f8 : val >= 7 ? 0xf8c830 : 0xf04040;
                    const barFill = pp(s.add.graphics());
                    barFill.fillStyle(barColor, 0.8);
                    barFill.fillRect(bx + 1, ty + 1, fillW, barH - 2);

                    pp(s.add.text(cardX + CARD_W - 10, ty, `${val}`, {
                        fontSize: '10px', fontFamily: FONT_BOLD, color: C.textPrimary
                    }).setOrigin(1, 0));

                    ty += barH + 3;
                }

                // 고용 버튼
                const btnY = cardY + CARD_H - 28;
                const btnW = CARD_W - 20;
                const btnX = cardX + 10;
                const btnBg = pp(s.add.graphics());
                btnBg.fillStyle(0x2a0808, 1); btnBg.fillRect(btnX, btnY, btnW, 22);
                btnBg.lineStyle(1, 0xe03030); btnBg.strokeRect(btnX, btnY, btnW, 22);
                const btnText = pp(s.add.text(btnX + btnW / 2, btnY + 11, '💰100 고용', {
                    fontSize: '11px', fontFamily: FONT_BOLD, color: '#e8e8f0'
                }).setOrigin(0.5));
                const btnZone = pp(s.add.zone(btnX + btnW / 2, btnY + 11, btnW, 22).setInteractive({ useHandCursor: true }));
                btnZone.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(0x401010, 1); btnBg.fillRect(btnX, btnY, btnW, 22); btnBg.lineStyle(1, 0xe04040); btnBg.strokeRect(btnX, btnY, btnW, 22); });
                btnZone.on('pointerout', () => { btnBg.clear(); btnBg.fillStyle(0x2a0808, 1); btnBg.fillRect(btnX, btnY, btnW, 22); btnBg.lineStyle(1, 0xe03030); btnBg.strokeRect(btnX, btnY, btnW, 22); });
                btnZone.on('pointerdown', () => {
                    if ((store.getState('gold') || 0) >= 100 && s.heroManager.getHeroes().length < 7) {
                        store.setState('gold', (store.getState('gold') || 0) - 100);
                        s.heroManager.recruitHero(recruit);
                        s._showPopup('recruit');
                    }
                });
            }

            // 다시 뽑기 버튼
            pp(s.popupSystem.popupButton(cx - 80, py + ph - 40, '🎲 다시 뽑기', () => {
                s._showPopup('recruit');
            }));
            pp(s.popupSystem.popupButton(cx + 80, py + ph - 40, '닫기', () => {
                s.popupSystem.closeAllPopups();
            }));
            return;
        }

        s.popupSystem.popupCloseBtn(px, py, pw, ph);
    }
}

export default PopupsHero;
