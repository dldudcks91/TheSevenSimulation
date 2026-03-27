/**
 * 원정 결과 화면 (저녁)
 * 원정 결과 + 감시탑 정보 표시 → 확인 후 밤으로
 */
import { FONT } from '../constants.js';

class ResultScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ResultScene' });
    }

    init(data) {
        this.expeditionResult = data.expeditionResult;
        this.turn = data.turn;
        this.baseManager = data.baseManager;
        this.onComplete = data.onComplete || (() => {});
    }

    create() {
        const { width, height } = this.scale;
        const r = this.expeditionResult;

        // 반투명 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

        // 패널
        this._panel(60, 40, width - 120, height - 80);

        // 헤더
        this.add.text(width / 2, 60, `[ 저녁 — 원정 결과 ]`, {
            fontSize: '16px', fontFamily: FONT, color: '#e07020',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 스테이지 이름
        this.add.text(width / 2, 90, r.stageName || '원정', {
            fontSize: '14px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);

        // 승패
        const resultColor = r.victory ? '#40d870' : '#e03030';
        const resultText = r.victory ? '승 리' : '패 배';
        this.add.text(width / 2, 120, resultText, {
            fontSize: '28px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 파티 상태
        let y = 160;
        if (r.heroResults) {
            for (const hr of r.heroResults) {
                const hpColor = hr.alive ? '#40d870' : '#e03030';
                const status = hr.alive ? `HP: ${hr.remainHp || '?'}` : '기절';
                this.add.text(100, y, `${hr.name}`, {
                    fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
                });
                this.add.text(width - 140, y, status, {
                    fontSize: '11px', fontFamily: FONT, color: hpColor
                });
                y += 20;
            }
        }

        // 전리품
        if (r.victory && r.goldReward) {
            y += 10;
            this.add.text(width / 2, y, `전리품: +${r.goldReward}G`, {
                fontSize: '14px', fontFamily: FONT, color: '#f8c830'
            }).setOrigin(0.5);
            y += 30;
        }

        // 리플레이 버튼
        if (r.log && r.log.length > 0) {
            this._smallBtn(width / 2, y + 10, '전투 리플레이', () => {
                const battleSceneKey = this.registry.get('battleScene') || 'BattleSceneB';
                this.scene.launch(battleSceneKey, {
                    log: r.log,
                    victory: r.victory,
                    stageName: r.stageName,
                    onClose: () => {}
                });
            });
            y += 40;
        }

        // 구분선
        this._line(80, y + 10, width - 80, y + 10);
        y += 25;

        // 감시탑 정보
        const raidInfo = this.baseManager.getRaidInfo(this.turn.day);

        this.add.text(width / 2, y, `감시탑 정보`, {
            fontSize: '11px', fontFamily: FONT, color: '#808898'
        }).setOrigin(0.5);
        y += 20;

        this.add.text(width / 2, y, raidInfo.text, {
            fontSize: '14px', fontFamily: FONT, color: '#f8b830'
        }).setOrigin(0.5);

        if (raidInfo.detail) {
            y += 20;
            this.add.text(width / 2, y, raidInfo.detail, {
                fontSize: '9px', fontFamily: FONT, color: '#a0a0c0'
            }).setOrigin(0.5);
        }

        // 확인 버튼
        this._createBtn(width / 2, height - 60, '확 인', () => {
            this.onComplete();
            this.scene.stop('ResultScene');
        });
    }

    _panel(x, y, w, h) {
        const g = this.add.graphics();
        g.fillStyle(0x0e0e1a, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0x303048);
        g.strokeRect(x, y, w, h);
    }

    _line(x1, y1, x2, y2) {
        const g = this.add.graphics();
        g.lineStyle(1, 0x303048);
        g.lineBetween(x1, y1, x2, y2);
    }

    _createBtn(cx, cy, label, callback) {
        const w = 140, h = 32;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(2, 0xe03030);
        bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '14px', fontFamily: FONT, color: '#e8e8f0',
            letterSpacing: 2
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }

    _smallBtn(cx, cy, label, callback) {
        const w = 160, h = 24;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x1e1e34, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0x484868);
        bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }
}

export default ResultScene;
