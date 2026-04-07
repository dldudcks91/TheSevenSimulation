/**
 * MapHeroInspector — 맵 영역 가로 오버레이 영웅 상세
 *
 * MapPopupSystem과 별도로 동작.
 * 맵 영역 중앙(820×440)을 덮지만, 하단 패널은 그대로 노출.
 * 레이아웃: 좌측 프로필(260px) | 우측 스탯 + 장비(528px)
 */
import {
    C, SIN_COLOR_HEX, MORALE_COLORS_HEX,
    INSP_X, INSP_Y, INSP_W, INSP_H, INSP_DEPTH,
    INSP_PROFILE_W, INSP_RIGHT_W, MAP_VP_W, MAP_VP_H, HUD_H
} from './MapConstants.js';
import { FONT, FONT_BOLD } from '../../constants.js';
import store from '../../store/Store.js';
import SpriteRenderer from '../SpriteRenderer.js';
import { topSin, SIN_NAMES_KO } from '../../game_logic/SinUtils.js';

const STAT_MAX = 20;

class MapHeroInspector {
    constructor(scene) {
        this.scene = scene;
        this._elements = [];
        this._hero = null;
        this._active = false;
    }

    get active() { return this._active; }
    get hero() { return this._hero; }

    open(hero) {
        if (this._active) this.close();
        this._hero = hero;
        this._active = true;
        this._draw();
    }

    close() {
        this._elements.forEach(el => el.destroy());
        this._elements = [];
        this._hero = null;
        this._active = false;
    }

    refresh() {
        if (!this._active || !this._hero) return;
        const heroId = this._hero.id;
        const heroes = this.scene.heroManager.getHeroes();
        const updated = heroes.find(h => h.id === heroId);
        if (!updated) { this.close(); return; }
        this._hero = updated;
        this._elements.forEach(el => el.destroy());
        this._elements = [];
        this._draw();
    }

    // ═══════════════════════════════════
    // 전체 그리기
    // ═══════════════════════════════════

    _draw() {
        const s = this.scene;
        const hero = this._hero;

        // 딤 배경 (맵 영역 전체)
        const dim = s.add.rectangle(
            MAP_VP_W / 2, HUD_H + MAP_VP_H / 2,
            MAP_VP_W, MAP_VP_H, 0x000000, 0.75
        ).setDepth(INSP_DEPTH).setInteractive();
        dim.on('pointerdown', () => this.close());
        this._p(dim);

        // 패널 배경 (중앙 820px)
        const bg = s.add.graphics().setDepth(INSP_DEPTH + 1);
        bg.fillStyle(C.bgPrimary, 0.97);
        bg.fillRoundedRect(INSP_X, INSP_Y + 4, INSP_W, INSP_H - 8, 6);
        bg.lineStyle(2, C.borderSecondary);
        bg.strokeRoundedRect(INSP_X, INSP_Y + 4, INSP_W, INSP_H - 8, 6);
        this._p(bg);

        // 패널 클릭이 딤으로 전파되지 않게
        const blocker = s.add.zone(
            INSP_X + INSP_W / 2, INSP_Y + INSP_H / 2, INSP_W, INSP_H
        ).setDepth(INSP_DEPTH + 1).setInteractive();
        this._p(blocker);

        const baseX = INSP_X + 12;
        const baseY = INSP_Y + 12;

        this._drawProfile(baseX, baseY, hero);
        const rightX = baseX + INSP_PROFILE_W;
        const statEndY = this._drawStats(rightX, baseY, hero);
        this._drawEquipment(rightX, statEndY + 6, hero);
    }

    // ═══════════════════════════════════
    // 좌측: 프로필 (260px)
    // ═══════════════════════════════════

    _drawProfile(x, y, hero) {
        const s = this.scene;
        const sinColorHex = SIN_COLOR_HEX[topSin(hero.sinStats)] || C.textMuted;
        const sinColor = Phaser.Display.Color.HexStringToColor(sinColorHex).color;
        const pw = INSP_PROFILE_W - 12;
        const panelH = INSP_H - 24;

        // 배경
        const cardBg = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
        cardBg.fillStyle(C.bgSecondary, 1);
        cardBg.fillRoundedRect(x, y, pw, panelH, 4);
        cardBg.lineStyle(1, C.borderSecondary);
        cardBg.strokeRoundedRect(x, y, pw, panelH, 4);

        // 죄종 컬러 바
        const sinBar = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
        sinBar.fillStyle(sinColor, 0.6);
        sinBar.fillRect(x + 2, y + 2, pw - 4, 3);

        let ty = y + 12;

        // 초상화
        const portSize = 90;
        const portX = x + (pw - portSize) / 2;
        const portG = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
        portG.fillStyle(0x0e0e1a, 1);
        portG.fillRect(portX, ty, portSize, portSize);
        portG.lineStyle(1, C.borderSecondary);
        portG.strokeRect(portX, ty, portSize, portSize);

        if (hero.appearance && hero.appearance.layers && hero.appearance.layers.length > 0) {
            const spriteRenderer = new SpriteRenderer(s);
            const heroId = `hero_${hero.id}`;
            const textures = spriteRenderer.compose(hero.appearance, heroId);
            if (textures && textures.walk) {
                const spr = this._p(s.add.sprite(
                    portX + portSize / 2, ty + portSize / 2 + 6,
                    textures.walk, 0
                ).setDepth(INSP_DEPTH + 3));
                spr.setScale((portSize - 8) / 64);
                if (s.anims.exists(`${heroId}_walk`)) spr.play(`${heroId}_walk`);
            }
        } else {
            portG.lineStyle(1, C.borderPrimary, 0.4);
            portG.lineBetween(portX, ty, portX + portSize, ty + portSize);
            portG.lineBetween(portX + portSize, ty, portX, ty + portSize);
        }
        ty += portSize + 10;

        // 이름
        this._p(s.add.text(x + pw / 2, ty, hero.name, {
            fontSize: '18px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5, 0).setDepth(INSP_DEPTH + 2));
        ty += 22;

        // 죄종 + 비용
        if (hero.trait) {
            s.widgets.traitLabel(x + pw / 2 - 40, ty, hero.trait, {
                fontSize: '11px', pp: obj => this._p(obj), depth: INSP_DEPTH + 2
            });
        } else {
            this._p(s.add.text(x + pw / 2 - 40, ty, SIN_NAMES_KO[topSin(hero.sinStats)], {
                fontSize: '11px', fontFamily: FONT, color: sinColorHex
            }).setDepth(INSP_DEPTH + 2));
        }
        this._p(s.add.text(x + pw / 2 + 40, ty, `🌾${hero.foodCost ?? '?'}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: '#a08040'
        }).setDepth(INSP_DEPTH + 2));
        ty += 18;

        // 상태
        const statusMap = {
            expedition: '원정', injured: '부상', construction: '건설',
            research: '연구', idle: '대기', hunt: '사냥',
            gather: '채집', lumber: '벌목'
        };
        this._p(s.add.text(x + pw / 2, ty, `상태: ${statusMap[hero.status] || '대기'}`, {
            fontSize: '10px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5, 0).setDepth(INSP_DEPTH + 2));
        ty += 20;

        // 사기 바
        const moraleState = s.heroManager.getMoraleState(hero.morale);
        const moraleColor = MORALE_COLORS_HEX[moraleState];
        const moraleName = s.heroManager.getMoraleStateName(hero.morale);
        const mBarW = pw - 32;
        const mBarX = x + 16;

        this._p(s.add.text(mBarX, ty, '사기', {
            fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
        }).setDepth(INSP_DEPTH + 2));

        const mBarStartX = mBarX + 30;
        const mBarRealW = mBarW - 30;
        const mBg = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
        mBg.fillStyle(0x0e0e1a, 1);
        mBg.fillRect(mBarStartX, ty + 2, mBarRealW, 10);
        mBg.lineStyle(1, C.borderPrimary);
        mBg.strokeRect(mBarStartX, ty + 2, mBarRealW, 10);

        const mFill = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
        const mfw = Math.max(0, (hero.morale / 100) * (mBarRealW - 2));
        mFill.fillStyle(Phaser.Display.Color.HexStringToColor(moraleColor).color, 1);
        mFill.fillRect(mBarStartX + 1, ty + 3, mfw, 8);
        ty += 16;

        this._p(s.add.text(x + pw / 2, ty, `${hero.morale} (${moraleName})`, {
            fontSize: '11px', fontFamily: FONT_BOLD, color: moraleColor
        }).setOrigin(0.5, 0).setDepth(INSP_DEPTH + 2));
        ty += 24;

        // 스토리
        this._p(s.add.text(x + 12, ty, this._getStory(topSin(hero.sinStats)), {
            fontSize: '10px', fontFamily: FONT, color: C.textMuted,
            lineSpacing: 3, wordWrap: { width: pw - 24 }
        }).setDepth(INSP_DEPTH + 2));

        // 하단 버튼
        const btnY = y + panelH - 36;
        this._drawBtn(x + pw / 2 - 68, btnY, 60, '해고', () => {
            s.heroManager.dismissHero(hero.id);
            this.close();
            s.bottomPanel.refreshActiveTab();
        });
        this._drawBtn(x + pw / 2 + 8, btnY, 60, '닫기', () => {
            this.close();
        });
    }

    // ═══════════════════════════════════
    // 우측 상단: 스탯
    // ═══════════════════════════════════

    _drawStats(x, y, hero) {
        const s = this.scene;
        const st = hero.stats;
        const sub = hero.subStats || {};
        const derived = s.heroManager.getDerivedStats(hero);
        const sw = INSP_RIGHT_W;
        let ty = y;

        const COL_W = Math.floor(sw / 3);
        const ROW_H = 20;
        const LABEL_W = 38;
        const BAR_W = COL_W - LABEL_W - 30;

        const _header = (label) => {
            const lineY = ty + 8;
            const tObj = this._p(s.add.text(x + 12, ty, ` ${label} `, {
                fontSize: '12px', fontFamily: FONT_BOLD, color: C.textPrimary
            }).setDepth(INSP_DEPTH + 2));
            const lineG = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
            lineG.lineStyle(1, C.borderSecondary, 0.6);
            lineG.lineBetween(x + 12 + tObj.width + 6, lineY, x + sw - 8, lineY);
            ty += 28;
        };

        const _bar = (col, label, val) => {
            const bx = x + 12 + col * COL_W;
            const valColor = val >= 15 ? '#40d870' : val >= 10 ? '#40a0f8' : val >= 7 ? '#f8b830' : '#f04040';
            const valHex = Phaser.Display.Color.HexStringToColor(valColor).color;

            this._p(s.add.text(bx, ty, label, {
                fontSize: '10px', fontFamily: FONT, color: C.textSecondary
            }).setDepth(INSP_DEPTH + 2));

            const barX = bx + LABEL_W;
            const barY = ty + 4;
            const barH = 11;
            const g = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
            g.fillStyle(0x0e0e1a, 1);
            g.fillRect(barX, barY, BAR_W, barH);
            g.lineStyle(1, C.borderPrimary, 0.5);
            g.strokeRect(barX, barY, BAR_W, barH);
            const fw = Math.max(0, Math.min(1, val / STAT_MAX)) * (BAR_W - 2);
            g.fillStyle(valHex, 1);
            g.fillRect(barX + 1, barY + 1, fw, barH - 2);

            this._p(s.add.text(barX + BAR_W + 4, ty, `${val}`, {
                fontSize: '10px', fontFamily: FONT_BOLD, color: valColor
            }).setDepth(INSP_DEPTH + 2));
        };

        // ── 기본 (7종, 3열) ──
        _header('기본');
        const basicStats = [
            { key: 'strength', label: '힘' }, { key: 'agility', label: '민첩' }, { key: 'intellect', label: '지능' },
            { key: 'vitality', label: '체력' }, { key: 'perception', label: '감각' }, { key: 'leadership', label: '통솔' },
            { key: 'charisma', label: '매력' }
        ];
        basicStats.forEach((stat, i) => {
            _bar(i % 3, stat.label, st[stat.key]);
            if (i % 3 === 2 || i === basicStats.length - 1) ty += ROW_H;
        });
        ty += 6;

        // ── 행동 (9종, 3열) ──
        _header('행동');
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
        actionStats.forEach((act, i) => {
            const val = act.b ? Math.round((st[act.a] + st[act.b]) / 2) : st[act.a];
            _bar(i % 3, act.label, val);
            if (i % 3 === 2 || i === actionStats.length - 1) ty += ROW_H;
        });
        ty += 6;

        // ── 감정 (10종, 3열) ──
        _header('감정');
        const subLabels = [
            { key: 'wrath', label: '분노', src: 'sub' },
            { key: 'greed', label: '탐욕', src: 'sub' },
            { key: 'pride', label: '교만', src: 'sub' },
            { key: 'envy', label: '시기', src: 'sub' },
            { key: 'gluttony', label: '폭식', src: 'sub' },
            { key: 'lust', label: '색욕', src: 'sub' },
            { key: 'sloth', label: '나태', src: 'sub' }
        ];
        subLabels.forEach((sl, i) => {
            const val = sl.src === 'sub' ? (sub[sl.key] ?? 0) : (derived[sl.key] ?? 0);
            _bar(i % 3, sl.label, val);
            if (i % 3 === 2 || i === subLabels.length - 1) ty += ROW_H;
        });

        return ty;
    }

    // ═══════════════════════════════════
    // 우측 하단: 장비 (스탯 아래, 가로 3슬롯)
    // ═══════════════════════════════════

    _drawEquipment(x, y, hero) {
        const s = this.scene;
        const sw = INSP_RIGHT_W;

        // 헤더
        const lineY = y + 8;
        const tObj = this._p(s.add.text(x + 12, y, ' 장비 ', {
            fontSize: '12px', fontFamily: FONT_BOLD, color: C.textPrimary
        }).setDepth(INSP_DEPTH + 2));
        const lineG = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
        lineG.lineStyle(1, C.borderSecondary, 0.6);
        lineG.lineBetween(x + 12 + tObj.width + 6, lineY, x + sw - 8, lineY);

        const ty = y + 28;
        const eq = hero.equipment || [null, null, null];
        const GAP = 8;
        const slotW = Math.floor((sw - 24 - GAP * 2) / 3);
        // 패널 하단에 맞춰 슬롯 높이 계산 (테두리 잘림 방지)
        const panelBottom = INSP_Y + INSP_H - 12;
        const slotH = Math.min(52, panelBottom - ty - 2);

        for (let i = 0; i < 3; i++) {
            const sx = x + 12 + i * (slotW + GAP);
            const item = eq[i];

            const slotBg = this._p(s.add.graphics().setDepth(INSP_DEPTH + 2));
            slotBg.fillStyle(C.inputBg, 1);
            slotBg.fillRoundedRect(sx, ty, slotW, slotH, 4);
            slotBg.lineStyle(1, C.borderPrimary);
            slotBg.strokeRoundedRect(sx, ty, slotW, slotH, 4);

            this._p(s.add.text(sx + 8, ty + 6, `슬롯 ${i + 1}`, {
                fontSize: '10px', fontFamily: FONT_BOLD, color: C.textSecondary
            }).setDepth(INSP_DEPTH + 2));

            if (item) {
                this._p(s.add.text(sx + 8, ty + 24, item.name_ko || '???', {
                    fontSize: '10px', fontFamily: FONT, color: C.expYellow
                }).setDepth(INSP_DEPTH + 2));
            } else {
                this._p(s.add.text(sx + 8, ty + 24, '(비어 있음)', {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                }).setDepth(INSP_DEPTH + 2));
                this._p(s.add.text(sx + 8, ty + 38, '아이템 탭→장착', {
                    fontSize: '8px', fontFamily: FONT, color: '#606050'
                }).setDepth(INSP_DEPTH + 2));
            }
        }
    }

    // ═══════════════════════════════════
    // 유틸
    // ═══════════════════════════════════

    _p(element) {
        this._elements.push(element);
        return element;
    }

    _drawBtn(x, y, w, label, callback) {
        const s = this.scene;
        const h = 26;
        const container = s.add.container(0, 0).setDepth(INSP_DEPTH + 3);

        const bg = s.add.graphics();
        bg.fillStyle(C.cardBg, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, C.borderSecondary);
        bg.strokeRect(x, y, w, h);
        container.add(bg);

        const text = s.add.text(x + w / 2, y + h / 2, label, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);
        container.add(text);

        const zone = s.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(C.bgTertiary, 1);
            bg.fillRect(x, y, w, h);
            bg.lineStyle(1, 0xe03030);
            bg.strokeRect(x, y, w, h);
            text.setColor('#fff');
        });
        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(C.cardBg, 1);
            bg.fillRect(x, y, w, h);
            bg.lineStyle(1, C.borderSecondary);
            bg.strokeRect(x, y, w, h);
            text.setColor(C.textSecondary);
        });
        zone.on('pointerdown', callback);
        container.add(zone);

        this._p(container);
        return container;
    }

    _getStory(primarySin) {
        const stories = {
            wrath: '전쟁에서 돌아온 뒤로\n분노를 멈출 수 없었다.\n칼을 내려놓으면 손이 떨렸다.',
            envy: '언제나 형의 그림자 속에\n있었다. 인정받지 못한 재능은\n독이 되어 이곳으로 이끌었다.',
            greed: '가진 것을 모두 잃은 날,\n다시는 빈손이 되지 않겠다\n맹세했다.',
            sloth: '한때 뛰어난 학자였으나\n모든 것을 포기했다.\n세상에 지쳐 쓰러졌다.',
            gluttony: '굶주림의 기억은\n지워지지 않았다.\n아무리 채워도 부족했다.',
            lust: '사랑에 실패한 뒤\n혼자가 되는 것이 두려웠다.\n그 절박함이 여기까지 왔다.',
            pride: '왕좌에서 쫓겨난 지휘관.\n자신이 옳다는 확신은\n변하지 않았다.',
        };
        return stories[primarySin] || '어둠 속에서 바알의 부름을\n들었다.';
    }
}

export default MapHeroInspector;
