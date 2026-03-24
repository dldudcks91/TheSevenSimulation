/**
 * 타이틀 화면 — 새 게임 / 이어하기
 */
import SaveManager from '../store/SaveManager.js';
import store from '../store/Store.js';

const FONT = 'Galmuri11, Galmuri9, monospace';

class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#0a0a12');

        // 파티클 배경 (붉은 먼지)
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const dot = this.add.circle(x, y, 1 + Math.random() * 2, 0xe03030, 0.15 + Math.random() * 0.2);
            this.tweens.add({
                targets: dot, y: y - 100 - Math.random() * 100, alpha: 0,
                duration: 3000 + Math.random() * 4000, repeat: -1,
                onRepeat: () => { dot.x = Math.random() * width; dot.y = height + 10; dot.alpha = 0.2; }
            });
        }

        // 타이틀
        this.add.text(width / 2, 140, 'THE SEVEN', {
            fontSize: '48px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 3, offsetY: 3, color: '#600000', blur: 0, fill: true },
            letterSpacing: 8
        }).setOrigin(0.5);

        this.add.text(width / 2, 195, 'S I M U L A T I O N', {
            fontSize: '16px', fontFamily: FONT, color: '#a0a0c0',
            letterSpacing: 6
        }).setOrigin(0.5);

        this.add.text(width / 2, 230, '7대 죄악의 거점 경영 시뮬레이션', {
            fontSize: '11px', fontFamily: FONT, color: '#606080'
        }).setOrigin(0.5);

        // 구분선
        const g = this.add.graphics();
        g.lineStyle(1, 0x303048);
        g.lineBetween(width / 2 - 120, 260, width / 2 + 120, 260);

        // 버튼
        const hasSave = SaveManager.hasSave();

        this._createBtn(width / 2, 310, '새  게  임', () => {
            SaveManager.deleteSave();
            this.scene.start('MainScene');
        });

        if (hasSave) {
            const saveData = SaveManager.load();
            const info = saveData ? `${saveData.turn?.day || '?'}일차 | ${saveData.savedAt?.split('T')[0] || ''}` : '';

            this._createBtn(width / 2, 370, '이  어  하  기', () => {
                const data = SaveManager.load();
                if (data) {
                    SaveManager.restore(store, data);
                    this.scene.start('MainScene', { loaded: true });
                }
            });

            this.add.text(width / 2, 395, info, {
                fontSize: '9px', fontFamily: FONT, color: '#606080'
            }).setOrigin(0.5);
        }

        // 하단 크레딧
        this.add.text(width / 2, height - 40, 'Based on TheSevenTactics', {
            fontSize: '9px', fontFamily: FONT, color: '#303048'
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 24, 'Phase 1 — Web Prototype (Phaser.js)', {
            fontSize: '9px', fontFamily: FONT, color: '#303048'
        }).setOrigin(0.5);
    }

    _createBtn(cx, cy, label, callback) {
        const w = 200, h = 36;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        this._drawBtn(bg, x, y, w, h, false);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        const text = this.add.text(cx, cy, label, {
            fontSize: '14px', fontFamily: FONT, color: '#e8e8f0',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true },
            letterSpacing: 2
        }).setOrigin(0.5);

        zone.on('pointerover', () => { bg.clear(); this._drawBtn(bg, x, y, w, h, true); });
        zone.on('pointerout', () => { bg.clear(); this._drawBtn(bg, x, y, w, h, false); });
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
}

export default TitleScene;
