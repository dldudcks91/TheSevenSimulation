/**
 * 전투 리플레이 화면 — 전투 로그를 한 줄씩 표시
 */
const FONT = 'Galmuri11, Galmuri9, monospace';

class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    init(data) {
        this.battleLog = data.log || [];
        this.victory = data.victory;
        this.stageName = data.stageName || '전투';
        this.onClose = data.onClose || (() => {});
    }

    create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

        // 패널
        this._panel(40, 30, width - 80, height - 60);

        // 타이틀
        this.add.text(width / 2, 50, this.stageName, {
            fontSize: '16px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 로그 영역
        this.logLines = [];
        this.logText = this.add.text(56, 80, '', {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0',
            lineSpacing: 4, wordWrap: { width: width - 120 }
        });

        // 로그 한 줄씩 표시
        this._logIndex = 0;
        this._displayTimer = this.time.addEvent({
            delay: 150,
            callback: this._showNextLog,
            callbackScope: this,
            repeat: this.battleLog.length - 1
        });

        // 결과 표시 (로그 끝나면)
        const totalDelay = this.battleLog.length * 150 + 500;
        this.time.delayedCall(totalDelay, () => this._showResult());

        // 스킵 버튼
        const skipZone = this.add.zone(width / 2, height / 2, width, height).setInteractive();
        skipZone.on('pointerdown', () => {
            if (this._displayTimer) this._displayTimer.remove();
            // 전부 표시
            while (this._logIndex < this.battleLog.length) {
                this._showNextLog();
            }
            this._showResult();
            skipZone.disableInteractive();
        });
    }

    _showNextLog() {
        if (this._logIndex >= this.battleLog.length) return;
        const entry = this.battleLog[this._logIndex++];
        let line = '';

        switch (entry.type) {
            case 'start':
                line = `[전투 시작] 아군: ${entry.heroes.join(', ')} vs 적: ${entry.enemies.join(', ')}`;
                break;
            case 'attack':
                line = `R${entry.round} ${entry.attacker} → ${entry.defender} (${entry.damage} dmg, HP:${entry.remainHp})`;
                break;
            case 'defeat':
                line = entry.isHero
                    ? `  ▼ ${entry.name} 쓰러졌다!`
                    : `  ★ ${entry.name} 격파!`;
                break;
            case 'result':
                line = entry.winner === 'heroes' ? '━━ 승리! ━━' : '━━ 패배... ━━';
                break;
        }

        this.logLines.push(line);
        // 최근 20줄만 표시
        const display = this.logLines.slice(-20);
        this.logText.setText(display.join('\n'));
    }

    _showResult() {
        const { width, height } = this.scale;

        const resultColor = this.victory ? '#40d870' : '#e03030';
        const resultText = this.victory ? '승 리' : '패 배';

        this.add.text(width / 2, height - 100, resultText, {
            fontSize: '28px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 닫기 버튼
        this._closeBtn(width / 2, height - 52);
    }

    _closeBtn(cx, cy) {
        const w = 120, h = 28;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, '닫 기', {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
            this.onClose();
            this.scene.stop('BattleScene');
        });
    }

    _panel(x, y, w, h) {
        const g = this.add.graphics();
        g.fillStyle(0x0e0e1a, 1); g.fillRect(x, y, w, h);
        g.lineStyle(2, 0x303048); g.strokeRect(x, y, w, h);
        g.lineStyle(1, 0xa0a0c0, 0.1);
        g.lineBetween(x + 1, y + 1, x + w - 1, y + 1);
        g.lineBetween(x + 1, y + 1, x + 1, y + h - 1);
    }
}

export default BattleScene;
