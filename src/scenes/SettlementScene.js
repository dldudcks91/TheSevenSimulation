/**
 * 결산 화면 (밤 끝)
 * 방어 결과 + 사기 변동 + 폭주/이탈 연쇄 반응 표시
 */
import { topSin } from '../game_logic/SinUtils.js';
import { FONT } from '../constants.js';

const MORALE_COLORS = {
    desertion: '#f04040', unhappy: '#f8b830', stable: '#a0a0c0',
    elevated: '#40d870', rampage: '#e03030'
};

const SIN_COLORS = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0'
};

class SettlementScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettlementScene' });
    }

    init(data) {
        this.defenseResult = data.defenseResult;
        this.extremeResults = data.extremeResults || [];
        this.turn = data.turn;
        this.heroes = data.heroes || [];
        this.onComplete = data.onComplete || (() => {});
    }

    create() {
        const { width, height } = this.scale;

        // 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

        // 패널
        this._panel(40, 20, width - 80, height - 40);

        // 헤더
        this.add.text(width / 2, 40, `[ ${this.turn.day}일차 결산 ]`, {
            fontSize: '16px', fontFamily: FONT, color: '#808898',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        let y = 70;

        // 방어 결과
        const defColor = this.defenseResult.victory ? '#40d870' : '#e03030';
        const defText = this.defenseResult.victory ? '방어 성공' : '방어 실패';
        this.add.text(width / 2, y, defText, {
            fontSize: '14px', fontFamily: FONT, color: defColor
        }).setOrigin(0.5);
        y += 30;

        // 구분선
        this._line(60, y, width - 60, y);
        y += 15;

        // 사기 변동
        this.add.text(60, y, '── 영웅 사기 ──', {
            fontSize: '11px', fontFamily: FONT, color: '#606080'
        });
        y += 20;

        for (const hero of this.heroes) {
            const sinColor = SIN_COLORS[topSin(hero.sinStats)] || '#a0a0c0';
            const moraleColor = hero.morale <= 25 ? '#f8b830' : hero.morale >= 76 ? '#40d870' : '#a0a0c0';
            const warning = hero.morale >= 76 ? ' ★ 고양' : hero.morale <= 25 ? ' ⚠ 불만' : '';

            const traitText = hero.trait ? `[${hero.trait.name}]` : hero.sinName;
            this.add.text(72, y, traitText, {
                fontSize: '9px', fontFamily: FONT, color: sinColor
            });

            this.add.text(130, y, hero.name, {
                fontSize: '9px', fontFamily: FONT, color: '#e8e8f0'
            });

            this.add.text(width - 160, y, `사기: ${hero.morale}`, {
                fontSize: '9px', fontFamily: FONT, color: moraleColor
            });

            if (warning) {
                this.add.text(width - 80, y, warning, {
                    fontSize: '9px', fontFamily: FONT, color: '#e03030'
                });
            }

            y += 18;
        }

        // 구분선
        y += 5;
        this._line(60, y, width - 60, y);
        y += 15;

        // 연쇄 반응
        if (this.extremeResults.length > 0) {
            this.add.text(width / 2, y, '⚡ 연쇄 반응 발생!', {
                fontSize: '14px', fontFamily: FONT, color: '#e03030',
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5);
            y += 24;

            for (const r of this.extremeResults) {
                if (r.type === 'rampage') {
                    this.add.text(72, y, `💥 [폭주] ${r.heroName}: ${r.description}`, {
                        fontSize: '9px', fontFamily: FONT, color: '#e03080',
                        wordWrap: { width: width - 160 }
                    });
                    y += 18;

                    if (r.corruptionResult === 'corruption') {
                        this.add.text(88, y, '→ 타락! 더 강해졌지만 더 위험합니다.', {
                            fontSize: '9px', fontFamily: FONT, color: '#e03030'
                        });
                    } else {
                        this.add.text(88, y, '→ 구원! 죄를 극복했습니다.', {
                            fontSize: '9px', fontFamily: FONT, color: '#40d870'
                        });
                    }
                    y += 18;

                    for (const a of (r.affectedHeroes || [])) {
                        const dSign = a.delta > 0 ? '+' : '';
                        this.add.text(100, y, `${a.name} 사기 ${dSign}${a.delta}`, {
                            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0'
                        });
                        y += 14;
                    }
                } else if (r.type === 'desertion') {
                    this.add.text(72, y, `🚪 [이탈] ${r.description}`, {
                        fontSize: '9px', fontFamily: FONT, color: '#f8b830',
                        wordWrap: { width: width - 160 }
                    });
                    y += 18;

                    for (const a of (r.affectedHeroes || [])) {
                        const dSign = a.delta > 0 ? '+' : '';
                        this.add.text(100, y, `${a.name} 사기 ${dSign}${a.delta}`, {
                            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0'
                        });
                        y += 14;
                    }
                }
                y += 8;
            }
        } else {
            this.add.text(width / 2, y, '조용한 밤이었습니다.', {
                fontSize: '11px', fontFamily: FONT, color: '#606080'
            }).setOrigin(0.5);
        }

        // 다음 날 버튼
        this._createBtn(width / 2, height - 50, '다 음  날 ▶', () => {
            this.onComplete();
            this.scene.stop('SettlementScene');
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
        const w = 160, h = 32;
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
}

export default SettlementScene;
