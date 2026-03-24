/**
 * 게임오버 / 엔딩 화면
 */
const FONT = 'Galmuri11, Galmuri9, monospace';

class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.reason = data.reason || 'defeat'; // defeat, victory
        this.details = data.details || '';
        this.day = data.day || 0;
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#0a0a12');

        if (this.reason === 'victory') {
            this._showVictory(width, height);
        } else {
            this._showDefeat(width, height);
        }

        // 타이틀로 돌아가기
        this.time.delayedCall(2000, () => {
            this._createBtn(width / 2, height - 80, '타 이 틀 로', () => {
                this.scene.start('TitleScene');
            });
        });
    }

    _showDefeat(w, h) {
        this.add.text(w / 2, 150, 'GAME OVER', {
            fontSize: '48px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 3, offsetY: 3, color: '#600000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this.add.text(w / 2, 220, `${this.day}일차에 림보가 몰락했습니다.`, {
            fontSize: '14px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);

        this.add.text(w / 2, 260, this.details, {
            fontSize: '11px', fontFamily: FONT, color: '#606080',
            align: 'center', wordWrap: { width: w - 100 }
        }).setOrigin(0.5);
    }

    _showVictory(w, h) {
        this.add.text(w / 2, 100, '사탄을 쓰러뜨렸다.', {
            fontSize: '16px', fontFamily: FONT, color: '#f8c830',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this.add.text(w / 2, 150, 'CHAPTER 1 CLEAR', {
            fontSize: '40px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 3, offsetY: 3, color: '#600000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 보스 유언
        this.add.text(w / 2, 230, '사탄의 유언:', {
            fontSize: '11px', fontFamily: FONT, color: '#808898'
        }).setOrigin(0.5);

        this.add.text(w / 2, 260, '"분노란... 결국 무력함의 다른 이름이었다."', {
            fontSize: '14px', fontFamily: FONT, color: '#e03030',
            fontStyle: 'italic',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this.add.text(w / 2, 320, `${this.day}일 만에 분노의 챕터를 종결했습니다.`, {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);

        this.add.text(w / 2, 360, 'Phase 1 프로토타입은 여기까지입니다.\n나머지 6챕터는 Phase 2에서 계속됩니다.', {
            fontSize: '11px', fontFamily: FONT, color: '#606080',
            align: 'center'
        }).setOrigin(0.5);
    }

    _createBtn(cx, cy, label, callback) {
        const w = 180, h = 32;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(2, 0xe03030); bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '14px', fontFamily: FONT, color: '#e8e8f0',
            letterSpacing: 2
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }
}

export default GameOverScene;
