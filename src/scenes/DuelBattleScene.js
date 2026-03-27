/**
 * 1:1 전투 씬 — Loop Hero 스타일
 *
 * 일직선 평면 위 아군(왼) vs 적(오른), 한 대씩 주고받기.
 * 사냥 / 일기토 공용.
 *
 * init(data):
 *   hero     — 영웅 객체 (name, stats, sinType, id, ...)
 *   enemy    — 적 객체 (name, hp, atk, spd)
 *   stageName — 화면 제목
 *   onClose  — 전투 종료 콜백 (result: { victory, heroResult })
 */
import BattleEngine, { BATTLE_TYPES } from '../game_logic/BattleEngine.js';
import { FONT } from '../constants.js';

// ── 레이아웃 ──
const GROUND_Y = 340;
const HERO_X = 380;
const ENEMY_X = 900;
const SPRITE_SCALE = 2.0;
const FRAME_SIZE = 64;

// ── 타이밍 ──
const TICK_INTERVAL_BASE = 700; // ms (x1 기준)

// ── 스프라이트 ──
const SHEET_CONFIG = {
    idle:  { frames: 2, rows: 4 },
    slash: { frames: 6, rows: 4 },
    hurt:  { frames: 6, rows: 1 }
};
const DIR_EAST = 3;
const DIR_WEST = 1;
const DIR_SOUTH = 2;
const ANIM_FPS = 8;

const DEFAULT_SPRITE = 'warrior_male';
const ENEMY_SPRITE_POOL = ['warrior_female', 'base_male', 'base_female'];

const SIN_SPRITE_MAP = {
    wrath: 'hero_wrath',
    envy: 'hero_envy',
    greed: 'hero_greed',
    sloth: 'hero_sloth',
    gluttony: 'hero_gluttony',
    lust: 'hero_lust',
    pride: 'hero_pride',
};
const HERO_SPRITE_TYPES = Object.values(SIN_SPRITE_MAP);

// ── 색상 ──
const CLR = {
    bg: 0x0a0a12,
    ground: 0x1a2a1a,
    groundLine: 0x2a3a2a,
    hpHero: 0x40d870,
    hpEnemy: 0xe03030,
    hpBg: 0x1a1a2a,
    logBg: 0x0e0e1a,
    logBorder: 0x303048,
    textPrimary: '#e8e8f0',
    textSecondary: '#a0a0c0',
    textMuted: '#606080',
    dmgColor: '#f04040',
    healColor: '#40d870',
    accentRed: '#e03030',
};

class DuelBattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DuelBattleScene' });
    }

    // ═══════════════════════════════════
    // 라이프사이클
    // ═══════════════════════════════════

    init(data) {
        this._heroData = data.hero;
        this._enemyData = data.enemy;
        this.stageName = data.stageName || '사냥';
        this.onClose = data.onClose || (() => {});

        this.speed = 1;
        this.paused = false;
        this._tickAccumulator = 0;
        this._resultShown = false;

        this.engine = new BattleEngine();
    }

    preload() {
        const types = ['warrior_male', 'warrior_female', 'base_male', 'base_female', ...HERO_SPRITE_TYPES];
        const actions = ['idle', 'slash', 'hurt'];

        for (const type of types) {
            for (const action of actions) {
                const key = `${type}_${action}`;
                if (!this.textures.exists(key)) {
                    this.load.spritesheet(key, `assets/sprites/${type}/${action}.png`, {
                        frameWidth: FRAME_SIZE,
                        frameHeight: FRAME_SIZE
                    });
                }
            }
        }
    }

    create() {
        const { width, height } = this.scale;

        this._createAnimations();

        // 배경
        this.add.rectangle(width / 2, height / 2, width, height, CLR.bg);

        // 지면
        this._drawGround(width, height);

        // 헤더
        this.add.text(width / 2, 24, this.stageName, {
            fontSize: '16px', fontFamily: FONT, color: CLR.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 로그 패널
        this._drawLogPanel(width, height);

        // 컨트롤
        this._drawControls(width, height);

        // 엔진 초기화
        this.engine.init([this._heroData], [this._enemyData], BATTLE_TYPES.EXPEDITION);

        // 유닛 생성
        this._units = {};
        this._createHeroUnit();
        this._createEnemyUnit();

        this._addLog('[전투 시작]');
    }

    update(time, delta) {
        if (this._resultShown || this.paused) return;

        this._tickAccumulator += delta * this.speed;

        while (this._tickAccumulator >= TICK_INTERVAL_BASE) {
            this._tickAccumulator -= TICK_INTERVAL_BASE;
            this._tick();
            if (this._resultShown) break;
        }
    }

    // ═══════════════════════════════════
    // 지면 렌더링
    // ═══════════════════════════════════

    _drawGround(width, height) {
        const g = this.add.graphics();

        // 지면 영역
        g.fillStyle(CLR.ground, 1);
        g.fillRect(60, GROUND_Y + 20, width - 120, 80);

        // 지면 라인
        g.lineStyle(2, CLR.groundLine);
        g.lineBetween(60, GROUND_Y + 20, width - 60, GROUND_Y + 20);

        // 잔디 점
        for (let i = 0; i < 30; i++) {
            const gx = 80 + Math.random() * (width - 160);
            const gy = GROUND_Y + 30 + Math.random() * 50;
            g.fillStyle(CLR.groundLine, 0.4 + Math.random() * 0.3);
            g.fillRect(gx, gy, 2, 2);
        }

        // VS 표시
        this.add.text(width / 2, GROUND_Y - 60, 'VS', {
            fontSize: '28px', fontFamily: FONT, color: CLR.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setAlpha(0.3);
    }

    // ═══════════════════════════════════
    // 유닛 생성
    // ═══════════════════════════════════

    _createHeroUnit() {
        const hero = this._heroData;
        const spriteType = SIN_SPRITE_MAP[hero.sinType] || DEFAULT_SPRITE;
        const units = this.engine.getUnits();
        const heroUnit = units.heroes[0];

        this._units.hero = this._createUnitDisplay(
            hero.name, HERO_X, GROUND_Y, spriteType,
            true, heroUnit.maxHp, heroUnit.hp
        );
    }

    _createEnemyUnit() {
        const enemy = this._enemyData;
        const spriteType = ENEMY_SPRITE_POOL[Math.floor(Math.random() * ENEMY_SPRITE_POOL.length)];
        const units = this.engine.getUnits();
        const enemyUnit = units.enemies[0];

        this._units.enemy = this._createUnitDisplay(
            enemy.name, ENEMY_X, GROUND_Y, spriteType,
            false, enemyUnit.maxHp, enemyUnit.hp
        );
    }

    _createUnitDisplay(name, x, y, spriteType, isHero, maxHp, currentHp) {
        const container = this.add.container(x, y);

        // 스프라이트
        const idleDir = isHero ? DIR_EAST : DIR_WEST;
        const idleAnim = `${spriteType}_idle_${isHero ? 'east' : 'west'}`;

        // idle 방향별 애니메이션 (없으면 생성)
        this._ensureDirectionalIdle(spriteType, isHero ? 'east' : 'west', idleDir);

        const sprite = this.add.sprite(0, 0, `${spriteType}_idle`);
        sprite.setScale(SPRITE_SCALE);
        sprite.play(idleAnim);

        if (!isHero) {
            sprite.setTint(0xff8888);
        }
        container.add(sprite);

        const halfH = (FRAME_SIZE * SPRITE_SCALE) / 2;

        // 이름
        const nameText = this.add.text(0, -halfH - 40, name, {
            fontSize: '14px', fontFamily: FONT, color: CLR.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        container.add(nameText);

        // HP 바
        const HP_BAR_W = 120;
        const HP_BAR_H = 8;
        const hpBarY = -halfH - 20;

        const hpBg = this.add.rectangle(0, hpBarY, HP_BAR_W, HP_BAR_H, CLR.hpBg);
        container.add(hpBg);

        const hpColor = isHero ? CLR.hpHero : CLR.hpEnemy;
        const hpBar = this.add.rectangle(-HP_BAR_W / 2, hpBarY, HP_BAR_W, HP_BAR_H, hpColor);
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // HP 텍스트
        const hpText = this.add.text(0, hpBarY + 12, `${currentHp}/${maxHp}`, {
            fontSize: '9px', fontFamily: FONT, color: CLR.textSecondary
        }).setOrigin(0.5);
        container.add(hpText);

        return {
            container, sprite, hpBar, hpBg, nameText, hpText,
            baseX: x, baseY: y,
            maxHp, isHero,
            hpBarWidth: HP_BAR_W,
            spriteType, alive: true
        };
    }

    _ensureDirectionalIdle(spriteType, dirName, dirRow) {
        const key = `${spriteType}_idle_${dirName}`;
        if (this.anims.exists(key)) return;

        const config = SHEET_CONFIG.idle;
        this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(`${spriteType}_idle`, {
                start: dirRow * config.frames,
                end: dirRow * config.frames + config.frames - 1
            }),
            frameRate: ANIM_FPS,
            repeat: -1
        });
    }

    // ═══════════════════════════════════
    // 전투 tick
    // ═══════════════════════════════════

    _tick() {
        if (this.engine.isFinished()) {
            this._showResult(this.engine.getResult().victory);
            return;
        }

        const events = this.engine.tick();
        if (!events) return;

        const eventArray = Array.isArray(events) ? events : [events];
        for (const evt of eventArray) {
            this._processEvent(evt);
        }
    }

    _processEvent(evt) {
        switch (evt.type) {
            case 'attack':
                this._animateAttack(evt);
                this._addLog(`${evt.attacker} → ${evt.defender}  -${evt.damage}hp (잔여 ${evt.remainHp})`);
                break;

            case 'defeat':
                this._animateDefeat(evt);
                this._addLog(evt.isHero
                    ? `▼ ${evt.name} 쓰러졌다!`
                    : `★ ${evt.name} 격파!`);
                break;

            case 'result':
                break;
        }
    }

    // ═══════════════════════════════════
    // 전투 애니메이션
    // ═══════════════════════════════════

    _getUnit(name) {
        if (this._units.hero && this._units.hero.nameText.text === name) return this._units.hero;
        if (this._units.enemy && this._units.enemy.nameText.text === name) return this._units.enemy;
        return null;
    }

    _animateAttack(evt) {
        const attacker = this._getUnit(evt.attacker);
        const defender = this._getUnit(evt.defender);
        if (!attacker || !defender) return;

        // slash 애니메이션
        const slashDir = attacker.isHero ? 'east' : 'west';
        const slashAnim = `${attacker.spriteType}_slash_${slashDir}`;
        const idleAnim = `${attacker.spriteType}_idle_${slashDir}`;

        attacker.sprite.play(slashAnim);
        attacker.sprite.once('animationcomplete', () => {
            if (attacker.alive) attacker.sprite.play(idleAnim);
        });

        // 돌진
        const dx = attacker.isHero ? 60 : -60;
        const duration = Math.max(80, 250 / this.speed);

        this.tweens.add({
            targets: attacker.container,
            x: attacker.baseX + dx,
            duration,
            yoyo: true,
            ease: 'Power2'
        });

        // 피격
        this.time.delayedCall(duration, () => {
            // hurt 애니메이션
            const hurtAnim = `${defender.spriteType}_hurt`;
            const defIdleDir = defender.isHero ? 'east' : 'west';
            const defIdleAnim = `${defender.spriteType}_idle_${defIdleDir}`;

            defender.sprite.play(hurtAnim);
            defender.sprite.once('animationcomplete', () => {
                if (defender.alive) defender.sprite.play(defIdleAnim);
            });

            // 흔들림
            this.tweens.add({
                targets: defender.container,
                x: defender.baseX + (defender.isHero ? -12 : 12),
                duration: 60,
                yoyo: true,
                repeat: 1
            });

            // HP 갱신
            const maxHp = evt.maxHp || defender.maxHp;
            const hpPercent = Math.max(0, evt.remainHp / maxHp);
            defender.hpBar.width = Math.max(0, hpPercent * defender.hpBarWidth);
            defender.hpText.setText(`${Math.max(0, evt.remainHp)}/${maxHp}`);

            // 데미지 숫자
            const dmgText = this.add.text(
                defender.baseX, defender.baseY - 80,
                `-${evt.damage}`,
                {
                    fontSize: '22px', fontFamily: FONT, color: CLR.dmgColor,
                    shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
                }
            ).setOrigin(0.5);

            this.tweens.add({
                targets: dmgText,
                y: dmgText.y - 40,
                alpha: 0,
                duration: 800,
                onComplete: () => dmgText.destroy()
            });
        });
    }

    _animateDefeat(evt) {
        const unit = this._getUnit(evt.name);
        if (!unit) return;

        unit.alive = false;
        unit.hpBar.width = 0;
        unit.hpText.setText('0/' + unit.maxHp);

        // hurt → 정지
        const hurtAnim = `${unit.spriteType}_hurt`;
        unit.sprite.play(hurtAnim);
        unit.sprite.once('animationcomplete', () => {
            unit.sprite.stop();
        });

        // 쓰러짐 연출
        this.tweens.add({
            targets: unit.sprite,
            alpha: 0.3,
            scaleY: SPRITE_SCALE * 0.3,
            duration: 400
        });

        this.tweens.add({
            targets: unit.nameText,
            alpha: 0.3,
            duration: 400
        });

        // X 마크
        const xMark = this.add.text(0, 0, '\u2715', {
            fontSize: '36px', fontFamily: FONT, color: CLR.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        unit.container.add(xMark);
    }

    // ═══════════════════════════════════
    // 로그 패널
    // ═══════════════════════════════════

    _drawLogPanel(width, height) {
        const LOG_H = 130;
        const logY = height - LOG_H - 10;

        const g = this.add.graphics();
        g.fillStyle(CLR.logBg, 0.92);
        g.fillRect(40, logY, width - 80, LOG_H);
        g.lineStyle(1, CLR.logBorder);
        g.strokeRect(40, logY, width - 80, LOG_H);

        this.add.text(52, logY + 6, '[ 전투 로그 ]', {
            fontSize: '9px', fontFamily: FONT, color: CLR.textMuted
        });

        this._logText = this.add.text(52, logY + 22, '', {
            fontSize: '10px', fontFamily: FONT, color: CLR.textSecondary,
            lineSpacing: 4, wordWrap: { width: width - 120 }
        });

        this._logLines = [];
        this._logY = logY;
    }

    _addLog(msg) {
        this._logLines.push(msg);
        if (this._logLines.length > 6) this._logLines.shift();
        this._logText.setText(this._logLines.join('\n'));
    }

    // ═══════════════════════════════════
    // 컨트롤 UI
    // ═══════════════════════════════════

    _drawControls(width, height) {
        const btnY = 60;

        // 정지/시작
        this.pauseBtn = this.add.text(width - 220, btnY, '[ \u23f8 정지 ]', {
            fontSize: '12px', fontFamily: FONT, color: CLR.textSecondary
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            if (this.paused) {
                this.pauseBtn.setText('[ \u25b6 시작 ]');
                this.pauseBtn.setColor(CLR.healColor);
            } else {
                this.pauseBtn.setText('[ \u23f8 정지 ]');
                this.pauseBtn.setColor(CLR.textSecondary);
            }
        });

        // 배속
        this.speedBtn = this.add.text(width - 130, btnY, '[x1]', {
            fontSize: '12px', fontFamily: FONT, color: CLR.textSecondary
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.speedBtn.on('pointerdown', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this.speedBtn.setText(`[x${this.speed}]`);
        });

        // 스킵
        this.add.text(width - 60, btnY, '[스킵]', {
            fontSize: '12px', fontFamily: FONT, color: CLR.textMuted
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._skipToEnd());
    }

    // ═══════════════════════════════════
    // 결과 / 스킵
    // ═══════════════════════════════════

    _showResult(victory) {
        if (this._resultShown) return;
        this._resultShown = true;
        this.paused = true;

        const { width, height } = this.scale;

        // 결과 오버레이
        const overlay = this.add.rectangle(width / 2, height / 2 - 40, 340, 100, 0x0a0a12, 0.92);
        overlay.setStrokeStyle(2, victory ? 0x40d870 : 0xe03030);

        const resultText = victory ? '승 리' : '패 배';
        const resultColor = victory ? CLR.healColor : CLR.accentRed;

        this.add.text(width / 2, height / 2 - 60, resultText, {
            fontSize: '36px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this._createBtn(width / 2, height / 2 - 10, '닫 기', () => {
            const result = this.engine.getResult();
            this.onClose({
                victory: result.victory,
                heroResult: result.heroResults[0] || null,
                rounds: result.rounds
            });
            this.scene.stop('DuelBattleScene');
        });
    }

    _skipToEnd() {
        while (!this.engine.isFinished()) {
            const events = this.engine.tick();
            if (!events) break;

            const eventArray = Array.isArray(events) ? events : [events];
            for (const evt of eventArray) {
                if (evt.type === 'attack') {
                    const defender = this._getUnit(evt.defender);
                    if (defender && defender.alive) {
                        const maxHp = evt.maxHp || defender.maxHp;
                        const hpPercent = Math.max(0, evt.remainHp / maxHp);
                        defender.hpBar.width = Math.max(0, hpPercent * defender.hpBarWidth);
                        defender.hpText.setText(`${Math.max(0, evt.remainHp)}/${maxHp}`);
                    }
                    this._addLog(`${evt.attacker} → ${evt.defender}  -${evt.damage}hp`);
                }
                if (evt.type === 'defeat') {
                    const unit = this._getUnit(evt.name);
                    if (unit) {
                        unit.alive = false;
                        unit.sprite.setAlpha(0.3).setScale(SPRITE_SCALE, SPRITE_SCALE * 0.3);
                        unit.hpBar.width = 0;
                        unit.hpText.setText('0/' + unit.maxHp);
                        unit.nameText.setAlpha(0.3);
                    }
                }
            }
        }
        this._showResult(this.engine.getResult().victory);
    }

    // ═══════════════════════════════════
    // 애니메이션 정의
    // ═══════════════════════════════════

    _createAnimations() {
        const types = ['warrior_male', 'warrior_female', 'base_male', 'base_female'];

        for (const type of types) {
            // slash east
            const slashEastKey = `${type}_slash_east`;
            if (!this.anims.exists(slashEastKey)) {
                const cfg = SHEET_CONFIG.slash;
                this.anims.create({
                    key: slashEastKey,
                    frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                        start: DIR_EAST * cfg.frames,
                        end: DIR_EAST * cfg.frames + cfg.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5,
                    repeat: 0
                });
            }

            // slash west
            const slashWestKey = `${type}_slash_west`;
            if (!this.anims.exists(slashWestKey)) {
                const cfg = SHEET_CONFIG.slash;
                this.anims.create({
                    key: slashWestKey,
                    frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                        start: DIR_WEST * cfg.frames,
                        end: DIR_WEST * cfg.frames + cfg.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5,
                    repeat: 0
                });
            }

            // hurt
            const hurtKey = `${type}_hurt`;
            if (!this.anims.exists(hurtKey)) {
                const cfg = SHEET_CONFIG.hurt;
                this.anims.create({
                    key: hurtKey,
                    frames: this.anims.generateFrameNumbers(`${type}_hurt`, {
                        start: 0,
                        end: cfg.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5,
                    repeat: 0
                });
            }
        }

        // 영웅 스프라이트 (단일 행 — East만)
        for (const type of HERO_SPRITE_TYPES) {
            for (const dirName of ['east', 'west']) {
                const slashKey = `${type}_slash_${dirName}`;
                if (!this.anims.exists(slashKey)) {
                    this.anims.create({
                        key: slashKey,
                        frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                            start: 0, end: SHEET_CONFIG.slash.frames - 1
                        }),
                        frameRate: ANIM_FPS * 1.5, repeat: 0
                    });
                }

                const idleKey = `${type}_idle_${dirName}`;
                if (!this.anims.exists(idleKey)) {
                    this.anims.create({
                        key: idleKey,
                        frames: this.anims.generateFrameNumbers(`${type}_idle`, {
                            start: 0, end: SHEET_CONFIG.idle.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }
            }

            const hurtKey = `${type}_hurt`;
            if (!this.anims.exists(hurtKey)) {
                this.anims.create({
                    key: hurtKey,
                    frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                        start: SHEET_CONFIG.slash.frames - 2, end: SHEET_CONFIG.slash.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5, repeat: 0
                });
            }
        }
    }

    // ═══════════════════════════════════
    // 유틸
    // ═══════════════════════════════════

    _createBtn(cx, cy, label, callback) {
        const w = 120, h = 32;
        const x = cx - w / 2, y = cy - h / 2;

        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030);
        bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '12px', fontFamily: FONT, color: CLR.textPrimary
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }
}

export default DuelBattleScene;
