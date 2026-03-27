/**
 * 인트로 씬 — TheSevenRPG 프롤로그 포팅
 * 5씬 텍스트 내레이션 (검정 배경 + 빨간 재 파티클 + 타이핑 효과)
 * 클릭/스페이스로 한 줄씩 진행, 씬 전환
 */

import { FONT } from '../constants.js';

const PROLOGUE_SCENES = [
    {
        title: '왕좌',
        lines: [
            '지옥에는 왕이 있었다.',
            '',
            '바알. 대악마.',
            '이 땅의 모든 것은 그의 것이었고,',
            '7개의 감정을 나누어 부하에게 깃들게 했다.',
            '',
            '분노, 시기, 탐욕, 나태, 폭식, 색욕, 오만.',
            '',
            '그것은 지옥을 유지하는 균형이었다.',
        ],
    },
    {
        title: '배신의 밤',
        lines: [
            '그 밤, 7개의 칼이 등에 꽂혔다.',
            '',
            '뒤를 돌아봤다.',
            '전부 아는 얼굴이었다.',
            '',
            '싸웠다.',
            '하지만 힘의 반이 이미 빠져나간 뒤였다.',
            '묶여있던 것이 풀려있었다. 누군가가 열쇠를 넘겼다.',
            '',
            '밀려난다. 발밑이 무너진다.',
        ],
    },
];

const TYPE_SPEED = 40;
const BLANK_LINE_HEIGHT = 16;
const LINE_HEIGHT = 28;
const EMBER_COUNT = 50;

class IntroScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IntroScene' });
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#000000');

        this._w = width;
        this._h = height;
        this._sceneIdx = 0;
        this._lineIdx = 0;
        this._typing = false;
        this._typeTimer = null;
        this._lineObjects = [];
        this._finished = false;

        this._drawEmbers(width, height);
        this._drawUI(width, height);
        this._renderScene();

        // 클릭으로 진행
        this.input.on('pointerdown', (pointer) => {
            // SKIP 버튼 영역 체크
            if (this._skipZone && this._skipZone.getBounds().contains(pointer.x, pointer.y)) {
                this._goToHeroSelect();
                return;
            }
            this._advance();
        });

        // 키보드 진행
        this.input.keyboard.on('keydown-SPACE', () => this._advance());
        this.input.keyboard.on('keydown-ENTER', () => this._advance());
    }

    _drawEmbers(w, h) {
        for (let i = 0; i < EMBER_COUNT; i++) {
            const x = Math.random() * w;
            const y = h + Math.random() * h;
            const size = 1 + Math.random() * 2.5;
            const alpha = 0.05 + Math.random() * 0.25;
            const colors = [0xe03030, 0xd04020, 0xc02020, 0xff4040, 0xe05030];
            const color = colors[Math.floor(Math.random() * colors.length)];

            const dot = this.add.circle(x, y, size, color, alpha);

            this.tweens.add({
                targets: dot,
                y: -20,
                x: x + (Math.random() - 0.5) * 80,
                alpha: 0,
                duration: 4000 + Math.random() * 5000,
                delay: Math.random() * 3000,
                repeat: -1,
                onRepeat: () => {
                    dot.x = Math.random() * w;
                    dot.y = h + 10 + Math.random() * 40;
                    dot.alpha = 0.05 + Math.random() * 0.25;
                }
            });
        }

    }

    _drawUI(w, h) {
        // 헤더: 씬 번호
        this._sceneNumText = this.add.text(32, 20, '', {
            fontSize: '11px', fontFamily: FONT, color: '#505070'
        }).setDepth(10);

        // 헤더: 씬 타이틀
        this._titleText = this.add.text(90, 17, '', {
            fontSize: '18px', fontFamily: FONT, color: '#e03030',
            letterSpacing: 2
        }).setDepth(10);

        // SKIP 버튼
        const skipText = this.add.text(w - 32, 22, 'SKIP >>', {
            fontSize: '11px', fontFamily: FONT, color: '#505070'
        }).setOrigin(1, 0).setDepth(10);

        this._skipZone = this.add.zone(w - 60, 22, 80, 24)
            .setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setDepth(10);

        this._skipZone.on('pointerover', () => skipText.setColor('#a0a0c0'));
        this._skipZone.on('pointerout', () => skipText.setColor('#505070'));

        // 푸터: 힌트
        this._hintText = this.add.text(w / 2, h - 28, '클릭하여 진행', {
            fontSize: '11px', fontFamily: FONT, color: '#505070'
        }).setOrigin(0.5).setDepth(10);

        // 힌트 깜빡임
        this.tweens.add({
            targets: this._hintText,
            alpha: { from: 1, to: 0.3 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
        });
    }

    /** 현재 씬 렌더링 */
    _renderScene() {
        const scene = PROLOGUE_SCENES[this._sceneIdx];
        this._lineIdx = 0;

        this._sceneNumText.setText(`${this._sceneIdx + 1} / ${PROLOGUE_SCENES.length}`);
        this._titleText.setText(scene.title);

        // 기존 라인 제거
        this._lineObjects.forEach(obj => obj.destroy());
        this._lineObjects = [];
        this._bodyY = this._h / 2 - (scene.lines.length * LINE_HEIGHT) / 2 + 20;

        this._showNextLine();
    }

    /** 클릭/키 동작 */
    _advance() {
        if (this._finished) return;

        if (this._typing) {
            this._finishTyping();
            return;
        }
        this._nextLine();
    }

    /** 다음 라인으로 */
    _nextLine() {
        const scene = PROLOGUE_SCENES[this._sceneIdx];

        if (this._lineIdx < scene.lines.length) {
            this._showNextLine();
        } else {
            // 다음 씬
            this._sceneIdx++;
            if (this._sceneIdx < PROLOGUE_SCENES.length) {
                this._fadeToNextScene();
            } else {
                this._goToHeroSelect();
            }
        }
    }

    /** 라인 하나를 타이핑 효과로 표시 */
    _showNextLine() {
        const scene = PROLOGUE_SCENES[this._sceneIdx];
        const line = scene.lines[this._lineIdx];
        this._lineIdx++;

        const y = this._bodyY;

        // 빈 줄
        if (!line) {
            this._bodyY += BLANK_LINE_HEIGHT;
            this._nextLine();
            return;
        }

        // 대사(따옴표)는 강조 색
        const isQuote = line.startsWith('"');
        const color = isQuote ? '#e8e8f0' : '#a0a0b8';

        const textObj = this.add.text(this._w / 2, y, '', {
            fontSize: '16px',
            fontFamily: FONT,
            color,
            align: 'center',
            lineSpacing: 6,
        }).setOrigin(0.5, 0).setDepth(5);

        this._lineObjects.push(textObj);
        this._bodyY += LINE_HEIGHT;

        // 타이핑 효과
        this._typing = true;
        this._currentTextObj = textObj;
        this._currentFullText = line;
        this._currentCharIdx = 0;
        this._typeNextChar();
    }

    /** 한 글자씩 타이핑 */
    _typeNextChar() {
        if (this._currentCharIdx >= this._currentFullText.length) {
            this._typing = false;
            return;
        }

        this._currentCharIdx++;
        this._currentTextObj.setText(
            this._currentFullText.substring(0, this._currentCharIdx)
        );

        this._typeTimer = this.time.delayedCall(TYPE_SPEED, () => this._typeNextChar());
    }

    /** 타이핑 즉시 완료 */
    _finishTyping() {
        if (this._typeTimer) this._typeTimer.remove(false);
        this._currentTextObj.setText(this._currentFullText);
        this._typing = false;
    }

    /** 씬 전환 (페이드) */
    _fadeToNextScene() {
        const targets = this._lineObjects;

        this.tweens.add({
            targets,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                this._renderScene();
            }
        });

        // 타이틀도 페이드
        this.tweens.add({
            targets: this._titleText,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                this._titleText.setAlpha(1);
            }
        });
    }

    /** HeroSelectScene으로 전환 */
    _goToHeroSelect() {
        if (this._finished) return;
        this._finished = true;

        if (this._typeTimer) this._typeTimer.remove(false);

        const { width, height } = this.scale;
        const fade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
        fade.setDepth(200);

        this.tweens.add({
            targets: fade,
            alpha: 1,
            duration: 600,
            onComplete: () => this.scene.start('HeroSelectScene'),
        });
    }
}

export default IntroScene;
