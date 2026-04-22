/**
 * CriticalEventPopup — 죄종 20 도달 시 결정적 순간 이벤트 팝업
 *
 * 표시 시점: 밤 결산 후 또는 낮 페이즈 시작 시 pending 이벤트가 있으면 표시.
 * 3개 선택지: 이탈 수용 / 구원 시도 (확률 표시) / 극단 조치
 */

import { FONT } from '../constants.js';

const POP_W = 620;
const POP_H = 380;

const SIN_COLORS = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0',
};

class CriticalEventPopup {
    /**
     * @param {Phaser.Scene} scene
     * @param {Object} eventData - CriticalEventSystem.buildEventData() 결과
     * @param {Function} onResolve - (choiceKey) => void
     */
    constructor(scene, eventData, onResolve) {
        this.scene = scene;
        this.data = eventData;
        this.onResolve = onResolve || (() => {});
        this._container = null;
        this._resultShown = false;
    }

    show() {
        const { width, height } = this.scene.scale;
        const ox = Math.floor((width - POP_W) / 2);
        const oy = Math.floor((height - POP_H) / 2);

        this._container = this.scene.add.container(0, 0).setDepth(6000);

        const dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        dim.setInteractive();
        this._container.add(dim);

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x1a1014, 0.98);
        bg.fillRoundedRect(ox, oy, POP_W, POP_H, 12);
        bg.lineStyle(2, 0x882244, 1);
        bg.strokeRoundedRect(ox, oy, POP_W, POP_H, 12);
        this._container.add(bg);

        let y = oy + 20;

        // 타이틀
        const sinColor = SIN_COLORS[this.data.sinKey] || '#ffffff';
        const title = this.scene.add.text(ox + POP_W / 2, y, `⚠ 〈${this.data.title}〉`, {
            fontSize: '18px', fontFamily: FONT, color: sinColor, fontStyle: 'bold'
        }).setOrigin(0.5);
        this._container.add(title);
        y += 30;

        const sub = this.scene.add.text(ox + POP_W / 2, y, `${this.data.heroName} — ${this.data.sinName} 임계 도달`, {
            fontSize: '12px', fontFamily: FONT, color: '#b0b0b0'
        }).setOrigin(0.5);
        this._container.add(sub);
        y += 30;

        // 서사
        const narrative = this.scene.add.text(ox + 20, y, this.data.narrative, {
            fontSize: '13px', fontFamily: FONT, color: '#e0d0c0',
            wordWrap: { width: POP_W - 40 }, lineSpacing: 4
        });
        this._container.add(narrative);
        y += narrative.height + 20;

        // 선택지 3개
        for (const choice of this.data.choices) {
            this._addChoiceBtn(ox, y, choice);
            y += 60;
        }
    }

    _addChoiceBtn(ox, y, choice) {
        const btnW = POP_W - 40;
        const btnH = 50;
        const btnX = ox + 20;

        const btn = this.scene.add.graphics();
        btn.fillStyle(0x2a2028, 1);
        btn.fillRoundedRect(btnX, y, btnW, btnH, 6);
        btn.lineStyle(1, 0x6a5060, 1);
        btn.strokeRoundedRect(btnX, y, btnW, btnH, 6);
        this._container.add(btn);

        const label = choice.outcome === 'salvation_roll'
            ? `${choice.text} (성공 확률 ${Math.round(this.data.salvationChance * 100)}%)`
            : choice.text;

        const text = this.scene.add.text(btnX + 12, y + btnH / 2, label, {
            fontSize: '13px', fontFamily: FONT,
            color: choice.outcome === 'salvation_roll' ? '#80e0a0' :
                   choice.outcome === 'extreme' ? '#e08080' : '#c0c0c0',
            wordWrap: { width: btnW - 24 }
        }).setOrigin(0, 0.5);
        this._container.add(text);

        const hit = this.scene.add.rectangle(btnX + btnW / 2, y + btnH / 2, btnW, btnH, 0x000000, 0.01);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
            btn.clear();
            btn.fillStyle(0x3a2838, 1);
            btn.fillRoundedRect(btnX, y, btnW, btnH, 6);
            btn.lineStyle(1, 0xaa7080, 1);
            btn.strokeRoundedRect(btnX, y, btnW, btnH, 6);
        });
        hit.on('pointerout', () => {
            btn.clear();
            btn.fillStyle(0x2a2028, 1);
            btn.fillRoundedRect(btnX, y, btnW, btnH, 6);
            btn.lineStyle(1, 0x6a5060, 1);
            btn.strokeRoundedRect(btnX, y, btnW, btnH, 6);
        });
        hit.on('pointerdown', () => {
            if (this._resultShown) return;
            this._resultShown = true;
            this.close();
            this.onResolve(choice.key);
        });
        this._container.add(hit);
    }

    close() {
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}

export default CriticalEventPopup;
