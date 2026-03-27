/**
 * 전투 시각 시뮬레이션 — 실시간 자동전투 (LPC 스프라이트)
 *
 * BattleEngine.tick()을 호출하며 실시간 전투 진행.
 * 정지/시작, 배속, 스킵 지원.
 *
 * 두 가지 모드:
 * - realtime: engine을 직접 받아 tick 구동 (방어전)
 * - replay: log 배열을 받아 재생 (원정 리플레이)
 */
import { FONT } from '../constants.js';

const SIN_COLORS = {
    wrath: 0xe03030, envy: 0x30b050, greed: 0xd0a020,
    sloth: 0x808898, gluttony: 0xe07020, lust: 0xe03080, pride: 0x8040e0
};

const FRAME_SIZE = 64;
const SPRITE_SCALE = 1.2;
const DISPLAY_SIZE = FRAME_SIZE * SPRITE_SCALE;
const HERO_X_BASE = 140;
const ENEMY_X_BASE = 560;
const UNIT_Y_START = 180;
const UNIT_Y_GAP = 70;
const ANIM_FPS = 8;

const TICK_INTERVAL_BASE = 600; // ms (x1 기준)

// 스프라이트시트 정의
const SHEET_CONFIG = {
    idle:  { frames: 2, rows: 4 },
    slash: { frames: 6, rows: 4 },
    hurt:  { frames: 6, rows: 1 }
};

// 방향 행 인덱스 (LPC 표준)
const DIR_SOUTH = 2;
const DIR_EAST = 3;
const DIR_WEST = 1;

// 기본 스프라이트 (직업 없음, 고정)
const DEFAULT_SPRITE = 'warrior_male';

const ENEMY_SPRITES = ['warrior_female', 'base_male', 'base_female'];

class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    init(data) {
        // 공통
        this.stageName = data.stageName || '전투';
        this.onClose = data.onClose || (() => {});
        this.speed = 1;
        this.paused = false;
        this.heroData = data.heroes || [];

        // 실시간 모드
        this.engine = data.engine || null;

        // 리플레이 모드
        this.battleLog = data.log || null;
        this.victory = data.victory;

        this._mode = this.engine ? 'realtime' : 'replay';
    }

    preload() {
        const spriteTypes = ['warrior_male', 'warrior_female', 'base_male', 'base_female'];
        const actions = ['idle', 'slash', 'hurt'];

        for (const type of spriteTypes) {
            for (const action of actions) {
                const key = `${type}_${action}`;
                this.load.spritesheet(key, `assets/sprites/${type}/${action}.png`, {
                    frameWidth: FRAME_SIZE,
                    frameHeight: FRAME_SIZE
                });
            }
        }
    }

    create() {
        const { width, height } = this.scale;

        this._createAnimations();

        // 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a12, 1);

        // 전장
        this._drawBattlefield(width, height);

        // 헤더
        this.add.text(width / 2, 20, this.stageName, {
            fontSize: '14px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 로그 패널
        const logY = height - 120;
        const logG = this.add.graphics();
        logG.fillStyle(0x0e0e1a, 0.9);
        logG.fillRect(20, logY, width - 40, 100);
        logG.lineStyle(1, 0x303048);
        logG.strokeRect(20, logY, width - 40, 100);

        this.logText = this.add.text(30, logY + 8, '', {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0',
            lineSpacing: 3, wordWrap: { width: width - 80 }
        });
        this._logLines = [];

        // 유닛 스프라이트
        this.unitSprites = {};

        // 컨트롤 버튼
        this._drawControls(width, logY);

        // 모드별 초기화
        if (this._mode === 'realtime') {
            this._initRealtime();
        } else {
            this._initReplay();
        }

        // tick 타이머
        this._tickAccumulator = 0;
        this._resultShown = false;
    }

    update(time, delta) {
        if (this._resultShown || this.paused) return;

        this._tickAccumulator += delta * this.speed;

        while (this._tickAccumulator >= TICK_INTERVAL_BASE) {
            this._tickAccumulator -= TICK_INTERVAL_BASE;

            if (this._mode === 'realtime') {
                this._tickRealtime();
            } else {
                this._tickReplay();
            }

            if (this._resultShown) break;
        }
    }

    // ═══════════════════════════════════
    // 실시간 모드
    // ═══════════════════════════════════

    _initRealtime() {
        const units = this.engine.getUnits();

        units.heroes.forEach((u, i) => {
            const heroInfo = this.heroData.find(h => h.name === u.name);
            const spriteType = DEFAULT_SPRITE;
            this._createUnit(u.name, HERO_X_BASE, UNIT_Y_START + i * UNIT_Y_GAP, spriteType, true, u.maxHp);
        });

        units.enemies.forEach((u, i) => {
            const spriteType = ENEMY_SPRITES[i % ENEMY_SPRITES.length];
            this._createUnit(u.name, ENEMY_X_BASE, UNIT_Y_START + i * UNIT_Y_GAP, spriteType, false, u.maxHp);
        });

        this._addLog('[전투 시작]');
    }

    _tickRealtime() {
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

    // ═══════════════════════════════════
    // 리플레이 모드
    // ═══════════════════════════════════

    _initReplay() {
        this._logIndex = 0;

        const startEntry = this.battleLog.find(e => e.type === 'start');
        if (!startEntry) return;

        startEntry.heroes.forEach((name, i) => {
            const heroInfo = this.heroData.find(h => h.name === name);
            const spriteType = DEFAULT_SPRITE;
            this._createUnit(name, HERO_X_BASE, UNIT_Y_START + i * UNIT_Y_GAP, spriteType, true, 100);
        });

        startEntry.enemies.forEach((name, i) => {
            const spriteType = ENEMY_SPRITES[i % ENEMY_SPRITES.length];
            this._createUnit(name, ENEMY_X_BASE, UNIT_Y_START + i * UNIT_Y_GAP, spriteType, false, 100);
        });

        this._addLog('[전투 시작]');
        this._logIndex = 1;
    }

    _tickReplay() {
        if (this._logIndex >= this.battleLog.length) {
            this._showResult(this.victory);
            return;
        }

        const entry = this.battleLog[this._logIndex++];
        this._processEvent(entry);
    }

    // ═══════════════════════════════════
    // 이벤트 처리 (공통)
    // ═══════════════════════════════════

    _processEvent(evt) {
        switch (evt.type) {
            case 'start':
                this._addLog('[전투 시작]');
                break;

            case 'attack':
                this._animateAttack(evt);
                this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender} (${evt.damage}dmg)`);
                break;

            case 'defeat':
                this._animateDefeat(evt);
                if (evt.isHero) {
                    this._addLog(`▼ ${evt.name} 쓰러졌다!`);
                } else {
                    this._addLog(`★ ${evt.name} 격파!`);
                }
                break;

            case 'result':
                break;
        }
    }

    // ═══════════════════════════════════
    // 애니메이션 정의
    // ═══════════════════════════════════

    _createAnimations() {
        const spriteTypes = ['warrior_male', 'warrior_female', 'base_male', 'base_female'];

        for (const type of spriteTypes) {
            // idle
            const idleKey = `${type}_idle`;
            if (!this.anims.exists(idleKey)) {
                const idleConfig = SHEET_CONFIG.idle;
                this.anims.create({
                    key: idleKey,
                    frames: this.anims.generateFrameNumbers(`${type}_idle`, {
                        start: DIR_SOUTH * idleConfig.frames,
                        end: DIR_SOUTH * idleConfig.frames + idleConfig.frames - 1
                    }),
                    frameRate: ANIM_FPS,
                    repeat: -1
                });
            }

            // slash east
            const slashEastKey = `${type}_slash_east`;
            if (!this.anims.exists(slashEastKey)) {
                const slashConfig = SHEET_CONFIG.slash;
                this.anims.create({
                    key: slashEastKey,
                    frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                        start: DIR_EAST * slashConfig.frames,
                        end: DIR_EAST * slashConfig.frames + slashConfig.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5,
                    repeat: 0
                });
            }

            // slash west
            const slashWestKey = `${type}_slash_west`;
            if (!this.anims.exists(slashWestKey)) {
                const slashConfig = SHEET_CONFIG.slash;
                this.anims.create({
                    key: slashWestKey,
                    frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                        start: DIR_WEST * slashConfig.frames,
                        end: DIR_WEST * slashConfig.frames + slashConfig.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5,
                    repeat: 0
                });
            }

            // hurt
            const hurtKey = `${type}_hurt`;
            if (!this.anims.exists(hurtKey)) {
                const hurtConfig = SHEET_CONFIG.hurt;
                this.anims.create({
                    key: hurtKey,
                    frames: this.anims.generateFrameNumbers(`${type}_hurt`, {
                        start: 0,
                        end: hurtConfig.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5,
                    repeat: 0
                });
            }
        }
    }

    // ═══════════════════════════════════
    // 전장 / 유닛 렌더링
    // ═══════════════════════════════════

    _drawBattlefield(width, height) {
        const g = this.add.graphics();

        g.fillStyle(0x1a2a1a, 1);
        g.fillRect(20, 50, width - 40, height - 170);

        g.fillStyle(0x484858, 1);
        g.fillRect(width / 2 - 4, 60, 8, height - 190);
        g.lineStyle(1, 0x606878);
        g.strokeRect(width / 2 - 4, 60, 8, height - 190);

        this.add.text(HERO_X_BASE, 55, '아군', {
            fontSize: '11px', fontFamily: FONT, color: '#40d870'
        }).setOrigin(0.5);

        this.add.text(ENEMY_X_BASE, 55, '적군', {
            fontSize: '11px', fontFamily: FONT, color: '#e03030'
        }).setOrigin(0.5);
    }

    _createUnit(name, x, y, spriteType, isHero, maxHp) {
        const container = this.add.container(x, y);

        // LPC 스프라이트
        const sprite = this.add.sprite(0, 0, `${spriteType}_idle`);
        sprite.setScale(SPRITE_SCALE);
        sprite.play(`${spriteType}_idle`);

        if (!isHero) {
            sprite.setTint(0xff8888);
        }
        container.add(sprite);

        const halfH = DISPLAY_SIZE / 2;

        // HP 바
        const hpBarWidth = DISPLAY_SIZE + 10;
        const hpBg = this.add.rectangle(0, -halfH - 8, hpBarWidth, 6, 0x1a1a2a);
        container.add(hpBg);

        const hpBar = this.add.rectangle(
            -hpBarWidth / 2, -halfH - 8,
            hpBarWidth, 6,
            isHero ? 0x40d870 : 0xe03030
        );
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // 이름
        const nameText = this.add.text(0, halfH + 8, name, {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);
        container.add(nameText);

        this.unitSprites[name] = {
            container, sprite, hpBar, hpBg, nameText,
            baseX: x, baseY: y,
            maxHp: maxHp || 100,
            alive: true, isHero,
            maxHpBarWidth: hpBarWidth,
            spriteType
        };
    }

    // ═══════════════════════════════════
    // 전투 애니메이션
    // ═══════════════════════════════════

    _animateAttack(entry) {
        const attacker = this.unitSprites[entry.attacker];
        const defender = this.unitSprites[entry.defender];
        if (!attacker || !defender) return;

        // slash 애니메이션
        const slashDir = attacker.isHero ? 'east' : 'west';
        const slashAnim = `${attacker.spriteType}_slash_${slashDir}`;
        const idleAnim = `${attacker.spriteType}_idle`;

        attacker.sprite.play(slashAnim);
        attacker.sprite.once('animationcomplete', () => {
            attacker.sprite.play(idleAnim);
        });

        // 돌진
        const dx = defender.baseX > attacker.baseX ? 40 : -40;
        const duration = Math.max(60, 200 / this.speed);

        this.tweens.add({
            targets: attacker.container,
            x: attacker.baseX + dx,
            duration: duration,
            yoyo: true,
            ease: 'Power2'
        });

        // 피격
        this.time.delayedCall(duration, () => {
            // hurt 애니메이션
            const hurtAnim = `${defender.spriteType}_hurt`;
            const defIdleAnim = `${defender.spriteType}_idle`;
            defender.sprite.play(hurtAnim);
            defender.sprite.once('animationcomplete', () => {
                if (defender.alive) {
                    defender.sprite.play(defIdleAnim);
                }
            });

            // 흔들림
            this.tweens.add({
                targets: defender.container,
                x: defender.baseX + (defender.isHero ? -8 : 8),
                duration: 50,
                yoyo: true,
                repeat: 1
            });

            // HP 갱신
            if (defender.alive) {
                const maxHp = entry.maxHp || defender.maxHp || this._estimateMaxHp(entry.defender);
                const hpPercent = Math.max(0, entry.remainHp / maxHp);
                const newWidth = hpPercent * defender.maxHpBarWidth;
                defender.hpBar.width = Math.max(0, newWidth);
            }

            // 데미지 숫자
            const dmgText = this.add.text(
                defender.baseX, defender.baseY - 30,
                `-${entry.damage}`,
                {
                    fontSize: '14px', fontFamily: FONT, color: '#f04040',
                    shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
                }
            ).setOrigin(0.5);

            this.tweens.add({
                targets: dmgText,
                y: dmgText.y - 20,
                alpha: 0,
                duration: 600,
                onComplete: () => dmgText.destroy()
            });
        });
    }

    _animateDefeat(entry) {
        const unit = this.unitSprites[entry.name];
        if (!unit) return;

        unit.alive = false;
        unit.hpBar.width = 0;

        // hurt → 정지
        const hurtAnim = `${unit.spriteType}_hurt`;
        unit.sprite.play(hurtAnim);
        unit.sprite.once('animationcomplete', () => {
            unit.sprite.stop();
        });

        this.tweens.add({
            targets: unit.sprite,
            alpha: 0.3,
            scaleX: SPRITE_SCALE * 1.2,
            scaleY: SPRITE_SCALE * 0.3,
            duration: 300
        });

        this.tweens.add({
            targets: unit.nameText,
            alpha: 0.3,
            duration: 300
        });

        const xMark = this.add.text(0, 0, '\u2715', {
            fontSize: '24px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        unit.container.add(xMark);
    }

    _estimateMaxHp(unitName) {
        if (!this.battleLog) return 100;
        for (const entry of this.battleLog) {
            if (entry.type === 'attack' && entry.defender === unitName) {
                return entry.remainHp + entry.damage;
            }
        }
        return 100;
    }

    // ═══════════════════════════════════
    // 컨트롤 UI
    // ═══════════════════════════════════

    _drawControls(width, logY) {
        const btnY = logY + 80;

        // 정지/시작 버튼
        this.pauseBtn = this.add.text(width - 200, btnY, '[ ⏸ 정지 ]', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            if (this.paused) {
                this.pauseBtn.setText('[ ▶ 시작 ]');
                this.pauseBtn.setColor('#40d870');
            } else {
                this.pauseBtn.setText('[ ⏸ 정지 ]');
                this.pauseBtn.setColor('#a0a0c0');
            }
        });

        // 배속 버튼
        this.speedBtn = this.add.text(width - 110, btnY, '[x1]', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.speedBtn.on('pointerdown', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this.speedBtn.setText(`[x${this.speed}]`);
        });

        // 스킵 버튼
        this.add.text(width - 40, btnY, '[스킵]', {
            fontSize: '11px', fontFamily: FONT, color: '#606080'
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

        const overlay = this.add.rectangle(width / 2, height / 2 - 60, 300, 80, 0x0a0a12, 0.9);
        overlay.setStrokeStyle(2, victory ? 0x40d870 : 0xe03030);

        const resultColor = victory ? '#40d870' : '#e03030';
        const resultText = victory ? '승 리' : '패 배';

        this.add.text(width / 2, height / 2 - 70, resultText, {
            fontSize: '32px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this._createBtn(width / 2, height / 2 - 35, '닫 기', () => {
            this.onClose();
            this.scene.stop('BattleScene');
        });
    }

    _skipToEnd() {
        if (this._mode === 'realtime') {
            while (!this.engine.isFinished()) {
                const events = this.engine.tick();
                if (!events) break;

                const eventArray = Array.isArray(events) ? events : [events];
                for (const evt of eventArray) {
                    if (evt.type === 'defeat') {
                        const unit = this.unitSprites[evt.name];
                        if (unit) {
                            unit.alive = false;
                            unit.sprite.setAlpha(0.3).setScale(SPRITE_SCALE * 1.2, SPRITE_SCALE * 0.3);
                            unit.hpBar.width = 0;
                            unit.nameText.setAlpha(0.3);
                        }
                    }
                    if (evt.type === 'attack') {
                        const defender = this.unitSprites[evt.defender];
                        if (defender && defender.alive) {
                            const maxHp = evt.maxHp || defender.maxHp || 100;
                            const hpPercent = Math.max(0, evt.remainHp / maxHp);
                            defender.hpBar.width = Math.max(0, hpPercent * defender.maxHpBarWidth);
                        }
                        this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender} (${evt.damage}dmg)`);
                    }
                }
            }
            this._showResult(this.engine.getResult().victory);
        } else {
            while (this._logIndex < this.battleLog.length) {
                const entry = this.battleLog[this._logIndex++];
                if (entry.type === 'defeat') {
                    const unit = this.unitSprites[entry.name];
                    if (unit) {
                        unit.alive = false;
                        unit.sprite.setAlpha(0.3).setScale(SPRITE_SCALE * 1.2, SPRITE_SCALE * 0.3);
                        unit.hpBar.width = 0;
                        unit.nameText.setAlpha(0.3);
                    }
                }
                if (entry.type === 'attack') {
                    this._addLog(`R${entry.round} ${entry.attacker} → ${entry.defender} (${entry.damage}dmg)`);
                }
            }
            this._showResult(this.victory);
        }
    }

    // ═══════════════════════════════════
    // 유틸
    // ═══════════════════════════════════

    _addLog(msg) {
        this._logLines.push(msg);
        if (this._logLines.length > 5) this._logLines.shift();
        this.logText.setText(this._logLines.join('\n'));
    }

    _createBtn(cx, cy, label, callback) {
        const w = 100, h = 28;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030);
        bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }
}

export default BattleScene;
