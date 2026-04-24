/**
 * 타이틀 화면 — TheSevenRPG/Tactics 디자인 품질 맞춤
 * 다크 판타지 분위기, 순차 페이드인 연출, 7죄종 심볼
 */
import SaveManager from '../store/SaveManager.js';
import store from '../store/Store.js';
import locale from '../game_logic/LocaleManager.js';
import { FONT, LANG_KO, LANG_EN } from '../constants.js';

const SIN_SYMBOLS = [
    { name: '분노', color: 0xe03030, char: '⚔' },
    { name: '시기', color: 0x30b050, char: '⊘' },
    { name: '탐욕', color: 0xd0a020, char: '◈' },
    { name: '나태', color: 0x808898, char: '◎' },
    { name: '폭식', color: 0xe07020, char: '◉' },
    { name: '색욕', color: 0xe03080, char: '♦' },
    { name: '교만', color: 0x8040e0, char: '♛' },
];

class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#0a0a12');

        this._drawBackground(width, height);
        this._drawScanlines(width, height);
        this._drawVignette(width, height);
        this._drawParticles(width, height);
        this._drawSinCircle(width, height);
        this._drawTitle(width, height);
        this._drawButtons(width, height);
        this._drawCredits(width, height);
        this._drawLangToggle(width, height);

        // 언어 변경 시 씬 재시작하여 전체 UI 재렌더
        this._langUnsub = store.subscribe('lang', () => {
            this.scene.restart();
        });
        this.events.once('shutdown', () => {
            if (this._langUnsub) this._langUnsub();
        });
    }

    // ─── 배경 ───
    _drawBackground(w, h) {
        // 어두운 그라데이션 배경
        const g = this.add.graphics();
        for (let y = 0; y < h; y += 2) {
            const t = y / h;
            const r = Math.floor(10 + t * 8);
            const gv = Math.floor(10 + t * 5);
            const b = Math.floor(18 + t * 12);
            g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), 1);
            g.fillRect(0, y, w, 2);
        }

        // 붉은 글로우 (중앙 상단)
        const glow = this.add.graphics();
        glow.fillStyle(0xe03030, 0.04);
        glow.fillCircle(w / 2, 180, 250);
        glow.fillStyle(0xe03030, 0.02);
        glow.fillCircle(w / 2, 180, 400);
    }

    _drawScanlines(w, h) {
        const g = this.add.graphics();
        g.setDepth(100);
        for (let y = 0; y < h; y += 2) {
            g.fillStyle(0x000000, 0.06);
            g.fillRect(0, y, w, 1);
        }
    }

    _drawVignette(w, h) {
        const g = this.add.graphics();
        g.setDepth(99);
        // 가장자리 어둡게
        const steps = 20;
        for (let i = 0; i < steps; i++) {
            const alpha = (i / steps) * 0.6;
            const inset = i * 8;
            g.lineStyle(8, 0x000000, alpha);
            g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
        }
    }

    _drawParticles(w, h) {
        // 붉은 먼지 (상승)
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const size = 1 + Math.random() * 2;
            const dot = this.add.circle(x, y, size, 0xe03030, 0.08 + Math.random() * 0.15);

            this.tweens.add({
                targets: dot,
                y: y - 120 - Math.random() * 150,
                x: x + (Math.random() - 0.5) * 40,
                alpha: 0,
                duration: 4000 + Math.random() * 5000,
                repeat: -1,
                onRepeat: () => {
                    dot.x = Math.random() * w;
                    dot.y = h + 10;
                    dot.alpha = 0.1 + Math.random() * 0.1;
                }
            });
        }

        // 회색 재 (느리게 하강)
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const dot = this.add.circle(x, y, 1, 0x606080, 0.1 + Math.random() * 0.1);

            this.tweens.add({
                targets: dot,
                y: y + 80 + Math.random() * 100,
                x: x + (Math.random() - 0.5) * 60,
                alpha: 0,
                duration: 6000 + Math.random() * 4000,
                repeat: -1,
                onRepeat: () => {
                    dot.x = Math.random() * w;
                    dot.y = -10;
                    dot.alpha = 0.1;
                }
            });
        }
    }

    // ─── 7죄종 원형 배치 ───
    _drawSinCircle(w, h) {
        const cx = w / 2;
        const cy = 240;
        const radius = 140;

        SIN_SYMBOLS.forEach((sin, i) => {
            const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;

            // 원형 배경
            const circle = this.add.circle(x, y, 14, sin.color, 0.08);
            circle.setStrokeStyle(1, sin.color, 0.3);
            circle.setAlpha(0);

            // 심볼
            const symbol = this.add.text(x, y, sin.char, {
                fontSize: '16px', fontFamily: FONT, color: `#${sin.color.toString(16).padStart(6, '0')}`
            }).setOrigin(0.5).setAlpha(0);

            // 순차 페이드인 (0.8초 간격)
            const delay = 800 + i * 150;
            this.tweens.add({
                targets: [circle, symbol],
                alpha: 1,
                duration: 600,
                delay,
                ease: 'Power2'
            });

            // 미세한 펄스
            this.tweens.add({
                targets: circle,
                scaleX: 1.15,
                scaleY: 1.15,
                alpha: 0.15,
                duration: 2000 + Math.random() * 1000,
                delay: delay + 600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });

        // 중앙 연결선 (원형)
        const ring = this.add.graphics();
        ring.lineStyle(1, 0x303048, 0.3);
        ring.strokeCircle(cx, cy, radius);
        ring.setAlpha(0);

        this.tweens.add({
            targets: ring,
            alpha: 1,
            duration: 800,
            delay: 600
        });
    }

    // ─── 타이틀 텍스트 ───
    _drawTitle(w, h) {
        // 메인 타이틀
        const title = this.add.text(w / 2, 230, 'THE SEVEN', {
            fontSize: '60px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 0, offsetY: 0, color: '#e03030', blur: 20, fill: false },
            letterSpacing: 10
        }).setOrigin(0.5).setAlpha(0);

        // 타이틀 그림자 (깊이감)
        const titleShadow = this.add.text(w / 2 + 3, 233, 'THE SEVEN', {
            fontSize: '60px', fontFamily: FONT, color: '#400000',
            letterSpacing: 10
        }).setOrigin(0.5).setAlpha(0).setDepth(-1);

        // 서브타이틀
        const subtitle = this.add.text(w / 2, 290, locale.t('ui.title.sub'), {
            fontSize: '16px', fontFamily: FONT, color: '#a0a0c0',
            letterSpacing: 8
        }).setOrigin(0.5).setAlpha(0);

        // 구분선
        const lineG = this.add.graphics();
        lineG.setAlpha(0);

        // 태그라인
        const tagline = this.add.text(w / 2, 336, locale.t('ui.title.tagline'), {
            fontSize: '11px', fontFamily: FONT, color: '#606080',
            fontStyle: 'italic'
        }).setOrigin(0.5).setAlpha(0);

        // 순차 페이드인 연출
        this.tweens.add({
            targets: [title, titleShadow],
            alpha: 1,
            duration: 1200,
            delay: 200,
            ease: 'Power2'
        });

        this.tweens.add({
            targets: subtitle,
            alpha: 1,
            duration: 800,
            delay: 600,
            ease: 'Power2'
        });

        this.tweens.add({
            targets: lineG,
            alpha: 1,
            duration: 600,
            delay: 900,
            onStart: () => {
                lineG.lineStyle(1, 0x303048);
                lineG.lineBetween(w / 2 - 180, 316, w / 2 + 180, 316);
                lineG.lineStyle(1, 0xe03030, 0.3);
                lineG.lineBetween(w / 2 - 80, 316, w / 2 + 80, 316);
            }
        });

        this.tweens.add({
            targets: tagline,
            alpha: 1,
            duration: 600,
            delay: 1100,
            ease: 'Power2'
        });

        // 타이틀 글로우 펄스
        this.tweens.add({
            targets: title,
            alpha: { from: 1, to: 0.85 },
            duration: 3000,
            delay: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    // ─── 버튼 ───
    _drawButtons(w, h) {
        const hasSave = SaveManager.hasSave();
        const btnDelay = 1600;

        // 새 게임
        const newGameBtn = this._createBtn(w / 2, 440, locale.t('ui.btn.new_game'), () => {
            this._fadeOut(() => {
                this.scene.start('IntroScene');
            });
        });
        newGameBtn.container.setAlpha(0);
        this.tweens.add({
            targets: newGameBtn.container,
            alpha: 1,
            duration: 600,
            delay: btnDelay
        });

        // 이어하기
        if (hasSave) {
            const saveData = SaveManager.load();
            const info = saveData
                ? locale.t('ui.title.save_info', {
                    day: saveData.turn?.day ?? '?',
                    date: saveData.savedAt?.split('T')[0] ?? ''
                })
                : '';

            const continueBtn = this._createBtn(w / 2, 510, locale.t('ui.btn.continue'), () => {
                this._fadeOut(() => {
                    const data = SaveManager.load();
                    if (data) {
                        SaveManager.restore(store, data);
                        this.scene.start('MapScene', { loaded: true });
                    }
                });
            });
            continueBtn.container.setAlpha(0);
            this.tweens.add({
                targets: continueBtn.container,
                alpha: 1,
                duration: 600,
                delay: btnDelay + 200
            });

            const infoText = this.add.text(w / 2, 540, info, {
                fontSize: '9px', fontFamily: FONT, color: '#484868'
            }).setOrigin(0.5).setAlpha(0);

            this.tweens.add({
                targets: infoText,
                alpha: 1,
                duration: 400,
                delay: btnDelay + 400
            });
        }
    }

    // ─── 하단 ───
    _drawCredits(w, h) {
        const credit1 = this.add.text(w / 2, h - 44, locale.t('ui.credits.based_on'), {
            fontSize: '9px', fontFamily: FONT, color: '#242438'
        }).setOrigin(0.5).setAlpha(0);

        const credit2 = this.add.text(w / 2, h - 28, locale.t('ui.credits.phase'), {
            fontSize: '9px', fontFamily: FONT, color: '#242438'
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: [credit1, credit2],
            alpha: 1,
            duration: 1000,
            delay: 2200
        });
    }

    // ─── 언어 토글 (우측 상단 KO | EN) ───
    _drawLangToggle(w, h) {
        const cur = locale.getLang();
        const pad = 20;
        const y = 24;
        const gap = 8;

        const makeLangBtn = (label, langId, xRight) => {
            const active = cur === langId;
            const txt = this.add.text(xRight, y, label, {
                fontSize: '12px', fontFamily: FONT,
                color: active ? '#e03030' : '#606080',
                fontStyle: active ? 'bold' : 'normal'
            }).setOrigin(1, 0.5).setAlpha(0);

            const zone = this.add.zone(xRight - txt.width / 2, y, txt.width + 10, 22)
                .setInteractive({ useHandCursor: true });

            zone.on('pointerover', () => { if (!active) txt.setColor('#a0a0c0'); });
            zone.on('pointerout',  () => { if (!active) txt.setColor('#606080'); });
            zone.on('pointerdown', () => {
                if (active) return;
                locale.setLang(langId);
                // store 'lang' 구독이 scene.restart()를 호출
            });

            this.tweens.add({ targets: txt, alpha: 1, duration: 600, delay: 1800 });
            return { txt, zone };
        };

        const en = makeLangBtn('EN', LANG_EN, w - pad);
        const sep = this.add.text(w - pad - en.txt.width - gap / 2, y, '|', {
            fontSize: '12px', fontFamily: FONT, color: '#303048'
        }).setOrigin(1, 0.5).setAlpha(0);
        this.tweens.add({ targets: sep, alpha: 1, duration: 600, delay: 1800 });
        makeLangBtn('KO', LANG_KO, w - pad - en.txt.width - gap);
    }

    // ─── 페이드 아웃 전환 ───
    _fadeOut(callback) {
        const { width, height } = this.scale;
        const fade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
        fade.setDepth(200);

        this.tweens.add({
            targets: fade,
            alpha: 1,
            duration: 500,
            onComplete: callback
        });
    }

    // ─── 버튼 (RPG 베벨 스타일) ───
    _createBtn(cx, cy, label, callback) {
        const bw = 260, bh = 44;
        const x = cx - bw / 2, y = cy - bh / 2;
        const container = this.add.container(0, 0);

        const bg = this.add.graphics();
        this._drawBtnStyle(bg, x, y, bw, bh, false);
        container.add(bg);

        const text = this.add.text(cx, cy, label, {
            fontSize: '16px', fontFamily: FONT, color: '#e8e8f0',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
            letterSpacing: 4
        }).setOrigin(0.5);
        container.add(text);

        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
        container.add(zone);

        zone.on('pointerover', () => {
            bg.clear();
            this._drawBtnStyle(bg, x, y, bw, bh, true);
            text.setColor('#ffffff');
        });
        zone.on('pointerout', () => {
            bg.clear();
            this._drawBtnStyle(bg, x, y, bw, bh, false);
            text.setColor('#e8e8f0');
        });
        zone.on('pointerdown', callback);

        return { container, bg, text, zone };
    }

    _drawBtnStyle(g, x, y, w, h, hover) {
        // 배경
        g.fillStyle(hover ? 0x3a1010 : 0x1e0808, 1);
        g.fillRect(x, y, w, h);

        // 외곽 테두리
        g.lineStyle(2, hover ? 0xe04040 : 0xe03030);
        g.strokeRect(x, y, w, h);

        // 인셋 하이라이트 (상단+좌측 밝은 선)
        g.lineStyle(1, 0xa0a0c0, hover ? 0.2 : 0.08);
        g.lineBetween(x + 2, y + 2, x + w - 2, y + 2);
        g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);

        // 인셋 그림자 (하단+우측 어두운 선)
        g.lineStyle(1, 0x000000, 0.6);
        g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2);
        g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);

        // 호버 시 내부 글로우
        if (hover) {
            g.fillStyle(0xe03030, 0.08);
            g.fillRect(x + 3, y + 3, w - 6, h - 6);
        }
    }
}

export default TitleScene;
