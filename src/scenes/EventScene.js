/**
 * 이벤트/선택지 화면 (오버레이 씬)
 * MainScene 위에 겹쳐서 표시, 선택 후 닫힘
 */
import { FONT } from '../constants.js';
const C = {
    bgOverlay: 'rgba(0,0,0,0.75)',
    cardBg: '#161624',
    borderPrimary: '#303048',
    borderHighlight: '#a0a0c0',
    borderDark: '#18182a',
    textPrimary: '#e8e8f0',
    textSecondary: '#a0a0c0',
    textMuted: '#606080',
    accentRed: '#e03030',
    expYellow: '#f8c830',
    successGreen: '#40d870',
    warningOrange: '#f8b830'
};

const CATEGORY_LABELS = {
    conflict: '영웅 간 충돌',
    request: '영웅 요청',
    aftermath: '밤 습격 후유증',
    external: '외부 사건',
    rampage: '폭주 대응'
};

const CATEGORY_COLORS = {
    conflict: '#e03030',
    request: '#f8c830',
    aftermath: '#808898',
    external: '#40a0f8',
    rampage: '#e03080'
};

class EventScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EventScene' });
    }

    init(data) {
        this.eventData = data.event;
        this.eventSystem = data.eventSystem;
        this.onComplete = data.onComplete || (() => {});
    }

    create() {
        const { width, height } = this.scale;
        const evt = this.eventData;

        // 반투명 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

        // 이벤트 카드
        const cardX = 80;
        const cardY = 60;
        const cardW = width - 160;
        const cardH = height - 120;

        this._drawBevelPanel(cardX, cardY, cardW, cardH);

        // 카테고리 라벨
        const catLabel = CATEGORY_LABELS[evt.category] || '이벤트';
        const catColor = CATEGORY_COLORS[evt.category] || C.textMuted;
        this.add.text(cardX + 16, cardY + 12, `[ ${catLabel} ]`, {
            fontSize: '9px', fontFamily: FONT, color: catColor
        });

        // 이벤트 제목
        this.add.text(cardX + cardW / 2, cardY + 40, evt.title, {
            fontSize: '16px', fontFamily: FONT, color: C.textPrimary,
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 구분선
        this._drawLine(cardX + 16, cardY + 60, cardX + cardW - 16, cardY + 60);

        // 장면 묘사
        this.add.text(cardX + 24, cardY + 72, evt.scene, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary,
            lineSpacing: 6, wordWrap: { width: cardW - 48 }, fontStyle: 'italic'
        });

        // 선택지 (구분선 아래)
        const choicesY = cardY + 160;
        this._drawLine(cardX + 16, choicesY - 8, cardX + cardW - 16, choicesY - 8);

        this.add.text(cardX + 16, choicesY, '판결하라:', {
            fontSize: '11px', fontFamily: FONT, color: C.accentRed
        });

        const btnStartY = choicesY + 24;
        evt.choices.forEach((choice, i) => {
            this._createChoiceButton(
                cardX + 24,
                btnStartY + i * 44,
                cardW - 48,
                36,
                `▶ ${choice.text}`,
                () => this._onChoice(i)
            );
        });
    }

    _onChoice(index) {
        const result = this.eventSystem.applyChoice(this.eventData, index);
        this.onComplete(result);
        this.scene.stop('EventScene');
    }

    _drawBevelPanel(x, y, w, h) {
        const g = this.add.graphics();
        g.fillStyle(0x161624, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0x303048);
        g.strokeRect(x, y, w, h);
        g.lineStyle(1, 0xa0a0c0, 0.12);
        g.lineBetween(x + 1, y + 1, x + w - 1, y + 1);
        g.lineBetween(x + 1, y + 1, x + 1, y + h - 1);
        g.lineStyle(1, 0x18182a, 0.6);
        g.lineBetween(x + w - 1, y + 1, x + w - 1, y + h - 1);
        g.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);
    }

    _drawLine(x1, y1, x2, y2) {
        const g = this.add.graphics();
        g.lineStyle(1, 0x303048);
        g.lineBetween(x1, y1, x2, y2);
    }

    _createChoiceButton(x, y, w, h, label, callback) {
        const bg = this.add.graphics();
        this._drawChoiceBg(bg, x, y, w, h, false);

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        const text = this.add.text(x + 12, y + h / 2, label, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0, 0.5);

        zone.on('pointerover', () => {
            bg.clear();
            this._drawChoiceBg(bg, x, y, w, h, true);
            text.setColor(C.textPrimary);
        });

        zone.on('pointerout', () => {
            bg.clear();
            this._drawChoiceBg(bg, x, y, w, h, false);
            text.setColor(C.textSecondary);
        });

        zone.on('pointerdown', callback);
    }

    _drawChoiceBg(g, x, y, w, h, hover) {
        g.fillStyle(hover ? 0x1e1e34 : 0x0e0e1a, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, hover ? 0xe03030 : 0x303048);
        g.strokeRect(x, y, w, h);
    }
}

export default EventScene;
