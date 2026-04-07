/**
 * MapActionPopup -- MapScene 위 채집/벌목 미니 결과 팝업
 *
 * MapHuntPopup과 동일 위치/크기(600x400)로 UX 일관성 확보.
 * 프로그레스 바 애니메이션(1.5초) → 결과(자원/사기/대사) 표시.
 *
 * 사용법:
 *   const popup = new MapActionPopup(scene, {
 *       hero, actionType: 'gather', result: { foodReward: 12 },
 *       moraleDelta: 2, onComplete: () => {}
 *   });
 *   popup.start();
 *   // scene.update에서: popup.update(time, delta);
 */
import { topSin } from '../game_logic/SinUtils.js';
import SpriteRenderer from './SpriteRenderer.js';
import { FONT } from '../constants.js';
import {
    FRAME_SIZE, ANIM_FPS, SHEET_CONFIG, DIR_EAST,
    DEFAULT_SPRITE, SIN_SPRITE_MAP, HERO_SPRITE_TYPES
} from './SpriteConstants.js';

const SPRITE_SCALE = 1.8;
const POP_W = 600;
const POP_H = 400;
const PROGRESS_DURATION = 1500; // 1.5초

// 행동별 설정
const ACTION_CONFIG = {
    gather: {
        icon: '\u{1F33F}', title: '채집', color: '#30b050', colorHex: 0x30b050,
        resourceKey: 'food', resourceIcon: '\u{1F33E}', resourceLabel: '식량',
        workingText: '풀과 열매를 채집하는 중...'
    },
    lumber: {
        icon: '\u{1FA93}', title: '벌목', color: '#8a6a3a', colorHex: 0x8a6a3a,
        resourceKey: 'wood', resourceIcon: '\u{1FAB5}', resourceLabel: '나무',
        workingText: '나무를 베는 중...'
    }
};

// 죄종별 대사
const SIN_QUOTES = {
    wrath: [
        '"이런 잡일은 지긋지긋하군."',
        '"빨리 끝내고 싸우러 가자."',
        '"...짜증나는 일이다."'
    ],
    envy: [
        '"다른 놈들은 편하게 쉬고 있겠지."',
        '"나만 이런 일을 하는 건가."',
        '"...더 많이 가져와야 해."'
    ],
    greed: [
        '"이 정도면 부족해..."',
        '"더, 더 많이 모아야 한다."',
        '"쓸만한 것들이 있군."'
    ],
    sloth: [
        '"벌써 지친다..."',
        '"낮잠이나 자고 싶다."',
        '"...하아, 힘들어."'
    ],
    gluttony: [
        '"배가 고프군. 빨리 끝내자."',
        '"이걸로 맛있는 걸 만들 수 있으려나."',
        '"...먹을 건 없나?"'
    ],
    lust: [
        '"이런 단조로운 일이라니."',
        '"좀 더 자극적인 일은 없나."',
        '"...심심하군."'
    ],
    pride: [
        '"이런 하찮은 일을... 내가?"',
        '"나에게 이런 일을 시키다니."',
        '"...이 정도는 식은 죽 먹기지."'
    ]
};

class MapActionPopup {
    /**
     * @param {Phaser.Scene} scene
     * @param {Object} config
     * @param {Object} config.hero
     * @param {string} config.actionType - 'gather' | 'lumber'
     * @param {Object} config.result - { foodReward } or { woodReward }
     * @param {number} config.moraleDelta
     * @param {Function} config.onComplete
     */
    constructor(scene, config) {
        this.scene = scene;
        this.heroData = config.hero;
        this.actionType = config.actionType;
        this.result = config.result;
        this.moraleDelta = config.moraleDelta;
        this.onComplete = config.onComplete || (() => {});

        this.active = false;
        this._container = null;
        this._progressElapsed = 0;
        this._progressDone = false;
        this._resultShown = false;
    }

    start() {
        this.active = true;
        const { width, height } = this.scene.scale;
        this._ox = Math.floor((width - POP_W) / 2);
        this._oy = Math.floor((height - POP_H) / 2);

        this._container = this.scene.add.container(0, 0).setDepth(4000);

        // 딤 배경
        this._dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);
        this._dim.setInteractive();
        this._container.add(this._dim);

        // 팝업 배경
        const popBg = this.scene.add.graphics();
        popBg.fillStyle(0x0a0a12, 0.95);
        popBg.fillRoundedRect(this._ox, this._oy, POP_W, POP_H, 8);
        popBg.lineStyle(2, 0x303048);
        popBg.strokeRoundedRect(this._ox, this._oy, POP_W, POP_H, 8);
        this._container.add(popBg);

        const cfg = ACTION_CONFIG[this.actionType];

        // 헤더
        this._drawHeader(cfg);
        // 영웅 스프라이트
        this._drawHeroSprite();
        // 프로그레스 바
        this._drawProgress(cfg);
        // 스킵 버튼
        this._drawSkipBtn();
    }

    destroy() {
        this.active = false;
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }

    update(time, delta) {
        if (!this.active || this._progressDone) return;

        this._progressElapsed += delta;
        const ratio = Math.min(1, this._progressElapsed / PROGRESS_DURATION);

        // 프로그레스 바 업데이트
        if (this._progressBar) {
            this._progressBar.width = ratio * this._progressBarMaxW;
        }
        if (this._progressPct) {
            this._progressPct.setText(`${Math.floor(ratio * 100)}%`);
        }

        if (ratio >= 1) {
            this._progressDone = true;
            this._showResult();
        }
    }

    // ═══════════════════════════════════
    // UI 생성
    // ═══════════════════════════════════

    _drawHeader(cfg) {
        const cx = this._ox + POP_W / 2;
        const title = this.scene.add.text(cx, this._oy + 24, `${cfg.icon} ${cfg.title}`, {
            fontSize: '16px', fontFamily: FONT, color: cfg.color,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(title);
    }

    _drawHeroSprite() {
        const cx = this._ox + POP_W / 2;
        const sy = this._oy + 110;

        // 합성 스프라이트 우선
        if (this.heroData.appearance && this.heroData.appearance.layers) {
            const spriteRenderer = new SpriteRenderer(this.scene);
            const heroId = `hero_${this.heroData.id}`;
            spriteRenderer.compose(this.heroData.appearance, heroId);

            const idleKey = `composed_${heroId}_walk`;
            const sprite = this.scene.add.sprite(cx, sy, idleKey, 0);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${heroId}_idle`);
            this._container.add(sprite);
        } else {
            const spriteType = SIN_SPRITE_MAP[topSin(this.heroData.sinStats)] || DEFAULT_SPRITE;
            const key = `${spriteType}_idle_east`;
            if (!this.scene.anims.exists(key)) {
                const config = SHEET_CONFIG.idle;
                const isHeroSprite = HERO_SPRITE_TYPES.includes(spriteType);
                const startFrame = isHeroSprite ? 0 : DIR_EAST * config.frames;
                this.scene.anims.create({
                    key,
                    frames: this.scene.anims.generateFrameNumbers(`${spriteType}_idle`, {
                        start: startFrame, end: startFrame + config.frames - 1
                    }),
                    frameRate: ANIM_FPS, repeat: -1
                });
            }
            const sprite = this.scene.add.sprite(cx, sy, `${spriteType}_idle`);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(key);
            this._container.add(sprite);
        }

        // 이름
        const nameText = this.scene.add.text(cx, sy + 55, this.heroData.name, {
            fontSize: '12px', fontFamily: FONT, color: '#e8e8f0',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(nameText);
    }

    _drawProgress(cfg) {
        const cx = this._ox + POP_W / 2;
        const py = this._oy + 200;

        // 작업 중 텍스트
        this._workingText = this.scene.add.text(cx, py, cfg.workingText, {
            fontSize: '10px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);
        this._container.add(this._workingText);

        // 프로그레스 바 배경
        const barW = 300;
        const barH = 14;
        const barX = cx - barW / 2;
        const barY = py + 20;
        this._progressBarMaxW = barW;

        const barBg = this.scene.add.graphics();
        barBg.fillStyle(0x1a1a2a, 1);
        barBg.fillRoundedRect(barX, barY, barW, barH, 4);
        barBg.lineStyle(1, 0x303048);
        barBg.strokeRoundedRect(barX, barY, barW, barH, 4);
        this._container.add(barBg);

        // 프로그레스 바
        this._progressBar = this.scene.add.rectangle(barX, barY, 0, barH, cfg.colorHex);
        this._progressBar.setOrigin(0, 0);
        this._container.add(this._progressBar);

        // 퍼센트
        this._progressPct = this.scene.add.text(cx, barY + barH + 10, '0%', {
            fontSize: '10px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);
        this._container.add(this._progressPct);
    }

    _drawSkipBtn() {
        const cx = this._ox + POP_W / 2;
        const btnY = this._oy + POP_H - 30;

        const skipBtn = this.scene.add.text(cx, btnY, '[스킵]', {
            fontSize: '10px', fontFamily: FONT, color: '#606080'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        skipBtn.on('pointerdown', () => {
            if (!this._progressDone) {
                this._progressDone = true;
                if (this._progressBar) this._progressBar.width = this._progressBarMaxW;
                if (this._progressPct) this._progressPct.setText('100%');
                this._showResult();
            }
        });
        this._container.add(skipBtn);
        this._skipBtn = skipBtn;
    }

    // ═══════════════════════════════════
    // 결과 표시
    // ═══════════════════════════════════

    _showResult() {
        if (this._resultShown) return;
        this._resultShown = true;

        const cfg = ACTION_CONFIG[this.actionType];
        const cx = this._ox + POP_W / 2;
        let y = this._oy + 265;

        // 작업 완료 텍스트 변경
        if (this._workingText) this._workingText.setText('완료!');

        // 구분선
        const divider = this.scene.add.graphics();
        divider.lineStyle(1, 0x303048);
        divider.lineBetween(this._ox + 40, y, this._ox + POP_W - 40, y);
        this._container.add(divider);
        y += 16;

        // 자원 획득
        const reward = this.actionType === 'gather'
            ? this.result.foodReward
            : this.result.woodReward;

        const rewardText = this.scene.add.text(cx, y,
            `획득: ${cfg.resourceIcon} ${cfg.resourceLabel} +${reward}`, {
            fontSize: '14px', fontFamily: FONT, color: cfg.color,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(rewardText);
        y += 24;

        // 사기 변동
        const moraleSign = this.moraleDelta >= 0 ? '+' : '';
        const moraleColor = this.moraleDelta >= 0 ? '#40d870' : '#f04040';
        const moraleText = this.scene.add.text(cx, y,
            `사기: ${moraleSign}${this.moraleDelta}`, {
            fontSize: '11px', fontFamily: FONT, color: moraleColor
        }).setOrigin(0.5);
        this._container.add(moraleText);
        y += 28;

        // 죄종별 대사
        const sinQuotes = SIN_QUOTES[topSin(this.heroData.sinStats)] || SIN_QUOTES.sloth;
        const quote = sinQuotes[Math.floor(Math.random() * sinQuotes.length)];
        const quoteText = this.scene.add.text(cx, y, `\u{1F4AC} ${quote}`, {
            fontSize: '10px', fontFamily: FONT, color: '#808098',
            fontStyle: 'italic', wordWrap: { width: POP_W - 80 }
        }).setOrigin(0.5);
        this._container.add(quoteText);

        // 스킵 버튼 → 확인 버튼으로 교체
        if (this._skipBtn) this._skipBtn.destroy();

        const btnY = this._oy + POP_H - 30;
        const confirmBtn = this.scene.add.text(cx, btnY, '[ 확인 ]', {
            fontSize: '12px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        confirmBtn.on('pointerdown', () => {
            const onComp = this.onComplete;
            this.destroy();
            onComp();
        });
        this._container.add(confirmBtn);
    }
}

export default MapActionPopup;
