/**
 * 필드 이동형 전투씬 (B안)
 *
 * 유닛이 필드 위를 자유 이동하며 전투.
 * 가까운 적 탐색 → walk 접근 → slash 교전 → hurt 피격 → 다음 타겟.
 * 증원 버튼으로 대기 영웅 투입 가능.
 *
 * 모드: realtime (engine tick) / replay (log 재생)
 */
const FONT = 'Galmuri11, Galmuri9, monospace';

const FRAME_SIZE = 64;
const SPRITE_SCALE = 1.0;
const DISPLAY_SIZE = FRAME_SIZE * SPRITE_SCALE;
const ANIM_FPS = 8;

const TICK_INTERVAL_BASE = 600;

// 필드 영역
const FIELD_X = 20;
const FIELD_Y = 50;
const FIELD_W = 760;
const FIELD_H = 380;

// 유닛 이동 속도 (px/frame at 60fps)
const MOVE_SPEED = 1.5;
// 교전 거리 (px)
const ENGAGE_RANGE = 50;

// 스프라이트시트 정의
const SHEET_CONFIG = {
    idle:  { frames: 2, rows: 4 },
    walk:  { frames: 9, rows: 4 },
    slash: { frames: 6, rows: 4 },
    hurt:  { frames: 6, rows: 1 }
};

// 방향 인덱스 (LPC: 0=North, 1=West, 2=South, 3=East)
const DIR_NORTH = 0;
const DIR_WEST = 1;
const DIR_SOUTH = 2;
const DIR_EAST = 3;

const DEFAULT_SPRITE = 'warrior_male';

const ENEMY_SPRITES = ['warrior_female', 'base_male', 'base_female'];

// 유닛 상태
const UNIT_STATE = {
    IDLE: 'idle',
    WALKING: 'walking',
    ATTACKING: 'attacking',
    HURT: 'hurt',
    DEAD: 'dead'
};

class BattleSceneB extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleSceneB' });
    }

    init(data) {
        this.stageName = data.stageName || '전투';
        this.onClose = data.onClose || (() => {});
        this.speed = 1;
        this.paused = false;
        this.heroData = data.heroes || [];
        this.reserveHeroes = data.reserveHeroes || [];

        // 실시간 모드
        this.engine = data.engine || null;

        // 리플레이 모드
        this.battleLog = data.log || null;
        this.victory = data.victory;

        this._mode = this.engine ? 'realtime' : 'replay';
    }

    preload() {
        const spriteTypes = ['warrior_male', 'warrior_female', 'base_male', 'base_female'];
        const actions = ['idle', 'walk', 'slash', 'hurt'];

        for (const type of spriteTypes) {
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
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a12, 1);

        // 전장 필드
        this._drawField(width, height);

        // 헤더
        this.add.text(width / 2, 20, this.stageName, {
            fontSize: '14px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 병사 인디케이터 (전투 로그에서 업데이트)
        this._soldierAlive = 0;
        this._soldierTotal = 0;
        this.soldierText = this.add.text(width / 2, 38, '', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
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

        // 유닛
        this.units = {};

        // 컨트롤
        this._drawControls(width, logY);

        // 모드별 초기화
        if (this._mode === 'realtime') {
            this._initRealtime();
        } else {
            this._initReplay();
        }

        this._tickAccumulator = 0;
        this._resultShown = false;

        // 이벤트 큐 (전투 이벤트를 시각적으로 처리하기 위한 버퍼)
        this._eventQueue = [];
        this._processingEvent = false;
    }

    update(time, delta) {
        if (this._resultShown) return;
        if (this.paused) return;

        // 유닛 이동 업데이트
        this._updateUnitMovement(delta);

        // tick
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
    // 유닛 이동 시스템
    // ═══════════════════════════════════

    _updateUnitMovement(delta) {
        const speedMult = this.speed * (delta / 16.67);

        for (const name of Object.keys(this.units)) {
            const unit = this.units[name];
            if (!unit.alive || unit.state === UNIT_STATE.DEAD) continue;
            if (unit.state === UNIT_STATE.ATTACKING || unit.state === UNIT_STATE.HURT) continue;

            // 타겟이 없거나 죽었으면 새 타겟 찾기
            if (!unit.target || !unit.target.alive) {
                unit.target = this._findNearestEnemy(unit);
                if (!unit.target) {
                    this._setUnitState(unit, UNIT_STATE.IDLE);
                    continue;
                }
            }

            // 타겟까지 거리
            const dx = unit.target.fieldX - unit.fieldX;
            const dy = unit.target.fieldY - unit.fieldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= ENGAGE_RANGE) {
                // 교전 범위 안 → idle 대기 (엔진이 공격 이벤트 발행)
                this._setUnitState(unit, UNIT_STATE.IDLE);
            } else {
                // 이동
                const moveAmount = MOVE_SPEED * speedMult;
                const nx = dx / dist;
                const ny = dy / dist;
                unit.fieldX += nx * moveAmount;
                unit.fieldY += ny * moveAmount;

                // 필드 범위 제한
                unit.fieldX = Math.max(FIELD_X + 20, Math.min(FIELD_X + FIELD_W - 20, unit.fieldX));
                unit.fieldY = Math.max(FIELD_Y + 20, Math.min(FIELD_Y + FIELD_H - 20, unit.fieldY));

                unit.container.setPosition(unit.fieldX, unit.fieldY);

                // walk 방향 설정
                const dir = this._getDirection(nx, ny);
                if (unit.state !== UNIT_STATE.WALKING || unit.currentDir !== dir) {
                    this._setUnitWalk(unit, dir);
                }
            }
        }
    }

    _findNearestEnemy(unit) {
        let nearest = null;
        let minDist = Infinity;

        for (const name of Object.keys(this.units)) {
            const other = this.units[name];
            if (!other.alive || other.isHero === unit.isHero) continue;

            const dx = other.fieldX - unit.fieldX;
            const dy = other.fieldY - unit.fieldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearest = other;
            }
        }

        return nearest;
    }

    _getDirection(nx, ny) {
        // 4방향 중 가장 가까운 방향
        if (Math.abs(nx) > Math.abs(ny)) {
            return nx > 0 ? DIR_EAST : DIR_WEST;
        }
        return ny > 0 ? DIR_SOUTH : DIR_NORTH;
    }

    _setUnitWalk(unit, dir) {
        unit.state = UNIT_STATE.WALKING;
        unit.currentDir = dir;
        const walkAnim = `${unit.spriteType}_walk_${dir}`;
        unit.sprite.play(walkAnim);
    }

    _setUnitState(unit, state) {
        if (unit.state === state) return;
        unit.state = state;

        if (state === UNIT_STATE.IDLE) {
            const idleAnim = `${unit.spriteType}_idle_${unit.currentDir || DIR_SOUTH}`;
            if (this.anims.exists(idleAnim)) {
                unit.sprite.play(idleAnim);
            } else {
                unit.sprite.play(`${unit.spriteType}_idle_${DIR_SOUTH}`);
            }
        }
    }

    // ═══════════════════════════════════
    // 실시간 모드
    // ═══════════════════════════════════

    _initRealtime() {
        const unitsData = this.engine.getUnits();

        unitsData.heroes.forEach((u, i) => {
            const heroInfo = this.heroData.find(h => h.name === u.name);
            const spriteType = (heroInfo && DEFAULT_SPRITE)
                || ['warrior_male', 'base_male', 'base_female'][i % 3];

            const fx = FIELD_X + 60 + Math.random() * 80;
            const fy = FIELD_Y + 60 + i * (FIELD_H / 4);
            this._createUnit(u.name, fx, fy, spriteType, true, u.maxHp);
        });

        unitsData.enemies.forEach((u, i) => {
            const spriteType = ENEMY_SPRITES[i % ENEMY_SPRITES.length];
            const fx = FIELD_X + FIELD_W - 60 - Math.random() * 80;
            const fy = FIELD_Y + 60 + i * (FIELD_H / 4);
            this._createUnit(u.name, fx, fy, spriteType, false, u.maxHp);
        });

        // 병사 인디케이터
        if (unitsData.soldiers) {
            this._soldierTotal = unitsData.soldiers.total;
            this._soldierAlive = unitsData.soldiers.alive;
            this._updateSoldierDisplay();
        }

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
            const spriteType = (heroInfo && DEFAULT_SPRITE)
                || ['warrior_male', 'base_male', 'base_female'][i % 3];

            const fx = FIELD_X + 60 + Math.random() * 80;
            const fy = FIELD_Y + 60 + i * (FIELD_H / 4);
            this._createUnit(name, fx, fy, spriteType, true, 100);
        });

        startEntry.enemies.forEach((name, i) => {
            const spriteType = ENEMY_SPRITES[i % ENEMY_SPRITES.length];
            const fx = FIELD_X + FIELD_W - 60 - Math.random() * 80;
            const fy = FIELD_Y + 60 + i * (FIELD_H / 4);
            this._createUnit(name, fx, fy, spriteType, false, 100);
        });

        // 병사 인디케이터
        if (startEntry.soldiers) {
            this._soldierTotal = startEntry.soldiers;
            this._soldierAlive = startEntry.soldiers;
            this._updateSoldierDisplay();
        }

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
    // 이벤트 처리
    // ═══════════════════════════════════

    _processEvent(evt) {
        switch (evt.type) {
            case 'start':
                this._addLog('[전투 시작]');
                break;

            case 'attack':
                // 병사 공격/피격은 스프라이트 없이 로그+카운터만
                if (evt.attackerIsSoldier || evt.defenderIsSoldier) {
                    this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender} (${evt.damage}dmg)`);
                } else {
                    this._animateAttack(evt);
                    this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender} (${evt.damage}dmg)`);
                }
                break;

            case 'defeat':
                if (evt.isSoldier) {
                    // 병사 사망: 카운터 감소
                    this._soldierAlive = Math.max(0, this._soldierAlive - 1);
                    this._updateSoldierDisplay();
                    this._addLog(`▼ ${evt.name} 전사 (잔여 민병: ${this._soldierAlive})`);
                } else if (evt.isHero) {
                    this._animateDefeat(evt);
                    this._addLog(`▼ ${evt.name} 쓰러졌다!`);
                } else {
                    this._animateDefeat(evt);
                    this._addLog(`★ ${evt.name} 격파!`);
                }
                break;

            case 'result':
                break;
        }
    }

    _updateSoldierDisplay() {
        if (this._soldierTotal > 0) {
            const color = this._soldierAlive > 0 ? '#40d870' : '#e03030';
            this.soldierText.setText(`민병: ${this._soldierAlive}/${this._soldierTotal}`);
            this.soldierText.setColor(color);
        } else {
            this.soldierText.setText('');
        }
    }

    // ═══════════════════════════════════
    // 애니메이션 정의
    // ═══════════════════════════════════

    _createAnimations() {
        const spriteTypes = ['warrior_male', 'warrior_female', 'base_male', 'base_female'];
        const directions = [DIR_NORTH, DIR_WEST, DIR_SOUTH, DIR_EAST];
        const dirNames = { [DIR_NORTH]: '0', [DIR_WEST]: '1', [DIR_SOUTH]: '2', [DIR_EAST]: '3' };

        for (const type of spriteTypes) {
            // idle 4방향
            for (const dir of directions) {
                const key = `${type}_idle_${dir}`;
                if (!this.anims.exists(key)) {
                    const cfg = SHEET_CONFIG.idle;
                    this.anims.create({
                        key,
                        frames: this.anims.generateFrameNumbers(`${type}_idle`, {
                            start: dir * cfg.frames,
                            end: dir * cfg.frames + cfg.frames - 1
                        }),
                        frameRate: ANIM_FPS,
                        repeat: -1
                    });
                }
            }

            // walk 4방향
            for (const dir of directions) {
                const key = `${type}_walk_${dir}`;
                if (!this.anims.exists(key)) {
                    const cfg = SHEET_CONFIG.walk;
                    this.anims.create({
                        key,
                        frames: this.anims.generateFrameNumbers(`${type}_walk`, {
                            start: dir * cfg.frames,
                            end: dir * cfg.frames + cfg.frames - 1
                        }),
                        frameRate: ANIM_FPS,
                        repeat: -1
                    });
                }
            }

            // slash 4방향
            for (const dir of directions) {
                const key = `${type}_slash_${dir}`;
                if (!this.anims.exists(key)) {
                    const cfg = SHEET_CONFIG.slash;
                    this.anims.create({
                        key,
                        frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                            start: dir * cfg.frames,
                            end: dir * cfg.frames + cfg.frames - 1
                        }),
                        frameRate: ANIM_FPS * 1.5,
                        repeat: 0
                    });
                }
            }

            // hurt (1행만)
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
    }

    // ═══════════════════════════════════
    // 필드 / 유닛
    // ═══════════════════════════════════

    _drawField(width, height) {
        const g = this.add.graphics();

        // 풀밭 바닥
        g.fillStyle(0x1a2a1a, 1);
        g.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);

        // 풀 텍스처
        for (let i = 0; i < 80; i++) {
            const x = FIELD_X + 10 + Math.random() * (FIELD_W - 20);
            const y = FIELD_Y + 10 + Math.random() * (FIELD_H - 20);
            g.fillStyle(0x2a3a2a, 0.3 + Math.random() * 0.4);
            g.fillRect(x, y, 2 + Math.random() * 3, 2);
        }

        // 경계선
        g.lineStyle(1, 0x303048);
        g.strokeRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);

        // 아군 영역 표시 (좌측)
        g.lineStyle(1, 0x40d870, 0.3);
        g.lineBetween(FIELD_X + 140, FIELD_Y, FIELD_X + 140, FIELD_Y + FIELD_H);

        // 적군 영역 표시 (우측)
        g.lineStyle(1, 0xe03030, 0.3);
        g.lineBetween(FIELD_X + FIELD_W - 140, FIELD_Y, FIELD_X + FIELD_W - 140, FIELD_Y + FIELD_H);
    }

    _createUnit(name, fx, fy, spriteType, isHero, maxHp) {
        const container = this.add.container(fx, fy);

        // 스프라이트
        const sprite = this.add.sprite(0, 0, `${spriteType}_idle`);
        sprite.setScale(SPRITE_SCALE);
        sprite.play(`${spriteType}_idle_${DIR_SOUTH}`);

        if (!isHero) {
            sprite.setTint(0xff8888);
        }
        container.add(sprite);

        const halfH = DISPLAY_SIZE / 2;

        // HP 바
        const hpBarWidth = DISPLAY_SIZE + 4;
        const hpBg = this.add.rectangle(0, -halfH - 6, hpBarWidth, 4, 0x1a1a2a);
        container.add(hpBg);

        const hpBar = this.add.rectangle(
            -hpBarWidth / 2, -halfH - 6,
            hpBarWidth, 4,
            isHero ? 0x40d870 : 0xe03030
        );
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // 이름
        const nameText = this.add.text(0, halfH + 4, name, {
            fontSize: '8px', fontFamily: FONT, color: isHero ? '#a0c0f0' : '#f0a0a0'
        }).setOrigin(0.5);
        container.add(nameText);

        // depth (y좌표 기반 정렬)
        container.setDepth(fy);

        this.units[name] = {
            container, sprite, hpBar, hpBg, nameText,
            fieldX: fx, fieldY: fy,
            maxHp: maxHp || 100,
            alive: true, isHero,
            maxHpBarWidth: hpBarWidth,
            spriteType,
            state: UNIT_STATE.IDLE,
            currentDir: isHero ? DIR_EAST : DIR_WEST,
            target: null
        };
    }

    // ═══════════════════════════════════
    // 전투 애니메이션
    // ═══════════════════════════════════

    _animateAttack(entry) {
        const attacker = this.units[entry.attacker];
        const defender = this.units[entry.defender];
        if (!attacker || !defender) return;

        // 공격 방향 계산
        const dx = defender.fieldX - attacker.fieldX;
        const dy = defender.fieldY - attacker.fieldY;
        const dir = this._getDirection(
            dx / (Math.abs(dx) + Math.abs(dy) || 1),
            dy / (Math.abs(dx) + Math.abs(dy) || 1)
        );

        // slash 애니메이션
        attacker.state = UNIT_STATE.ATTACKING;
        attacker.currentDir = dir;
        const slashAnim = `${attacker.spriteType}_slash_${dir}`;
        const idleAnim = `${attacker.spriteType}_idle_${dir}`;

        attacker.sprite.play(slashAnim);
        attacker.sprite.once('animationcomplete', () => {
            if (attacker.alive) {
                attacker.state = UNIT_STATE.IDLE;
                attacker.sprite.play(idleAnim);
            }
        });

        // 살짝 돌진
        const dashDist = 15;
        const nx = dx / (Math.sqrt(dx * dx + dy * dy) || 1);
        const ny = dy / (Math.sqrt(dx * dx + dy * dy) || 1);

        this.tweens.add({
            targets: attacker.container,
            x: attacker.fieldX + nx * dashDist,
            y: attacker.fieldY + ny * dashDist,
            duration: Math.max(50, 150 / this.speed),
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                attacker.container.setPosition(attacker.fieldX, attacker.fieldY);
            }
        });

        // 피격
        const hitDelay = Math.max(50, 150 / this.speed);
        this.time.delayedCall(hitDelay, () => {
            if (!defender.alive) return;

            // hurt 애니메이션
            defender.state = UNIT_STATE.HURT;
            const hurtAnim = `${defender.spriteType}_hurt`;
            const defIdleAnim = `${defender.spriteType}_idle_${defender.currentDir}`;
            defender.sprite.play(hurtAnim);
            defender.sprite.once('animationcomplete', () => {
                if (defender.alive) {
                    defender.state = UNIT_STATE.IDLE;
                    defender.sprite.play(defIdleAnim);
                }
            });

            // 넉백
            this.tweens.add({
                targets: defender.container,
                x: defender.fieldX - nx * 8,
                y: defender.fieldY - ny * 8,
                duration: 50,
                yoyo: true,
                onComplete: () => {
                    defender.container.setPosition(defender.fieldX, defender.fieldY);
                }
            });

            // HP 갱신
            const maxHp = entry.maxHp || defender.maxHp || 100;
            const hpPercent = Math.max(0, entry.remainHp / maxHp);
            defender.hpBar.width = Math.max(0, hpPercent * defender.maxHpBarWidth);

            // 데미지 텍스트
            const dmgText = this.add.text(
                defender.fieldX, defender.fieldY - 40,
                `-${entry.damage}`,
                {
                    fontSize: '12px', fontFamily: FONT, color: '#f04040',
                    shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
                }
            ).setOrigin(0.5).setDepth(9999);

            this.tweens.add({
                targets: dmgText,
                y: dmgText.y - 20,
                alpha: 0,
                duration: 500,
                onComplete: () => dmgText.destroy()
            });
        });
    }

    _animateDefeat(entry) {
        const unit = this.units[entry.name];
        if (!unit) return;

        unit.alive = false;
        unit.state = UNIT_STATE.DEAD;
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
            duration: 400
        });

        this.tweens.add({
            targets: unit.nameText,
            alpha: 0.3,
            duration: 400
        });
    }

    // ═══════════════════════════════════
    // 증원 시스템
    // ═══════════════════════════════════

    _drawReinforcementBtn(width, logY) {
        if (this.reserveHeroes.length === 0) return;

        const btnX = 60;
        const btnY = logY + 80;

        this.reinforceBtn = this.add.text(btnX, btnY, `[증원 ${this.reserveHeroes.length}명]`, {
            fontSize: '11px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.reinforceBtn.on('pointerdown', () => this._showReinforcementPanel());
    }

    _showReinforcementPanel() {
        if (this.reserveHeroes.length === 0) return;
        if (this._reinforcePanel) return;

        const { width, height } = this.scale;
        const panelW = 200;
        const panelH = 30 + this.reserveHeroes.length * 30;
        const px = width / 2 - panelW / 2;
        const py = height / 2 - panelH / 2;

        this._reinforcePanel = this.add.container(0, 0).setDepth(10000);

        // 배경
        const bg = this.add.graphics();
        bg.fillStyle(0x0e0e1a, 0.95);
        bg.fillRect(px, py, panelW, panelH);
        bg.lineStyle(1, 0xf8c830);
        bg.strokeRect(px, py, panelW, panelH);
        this._reinforcePanel.add(bg);

        // 타이틀
        const title = this.add.text(px + panelW / 2, py + 12, '증원 선택', {
            fontSize: '11px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0.5);
        this._reinforcePanel.add(title);

        // 영웅 목록
        this.reserveHeroes.forEach((hero, i) => {
            const hy = py + 30 + i * 30;
            const heroText = this.add.text(px + 10, hy + 6, hero.name, {
                fontSize: '10px', fontFamily: FONT, color: '#e8e8f0'
            });
            this._reinforcePanel.add(heroText);

            const zone = this.add.zone(px + panelW / 2, hy + 12, panelW, 28)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => this._deployReinforcement(hero, i));
            this._reinforcePanel.add(zone);
        });

        // 닫기
        const closeText = this.add.text(px + panelW - 8, py + 4, 'X', {
            fontSize: '10px', fontFamily: FONT, color: '#e03030'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeText.on('pointerdown', () => this._closeReinforcementPanel());
        this._reinforcePanel.add(closeText);
    }

    _deployReinforcement(hero, index) {
        // 필드 왼쪽 가장자리에서 등장
        const fx = FIELD_X + 30;
        const fy = FIELD_Y + 60 + Math.random() * (FIELD_H - 120);
        const spriteType = DEFAULT_SPRITE;

        this._createUnit(hero.name, fx, fy, spriteType, true, hero.maxHp || 100);
        this._addLog(`★ ${hero.name} 증원!`);

        // 목록에서 제거
        this.reserveHeroes.splice(index, 1);
        this._closeReinforcementPanel();

        // 버튼 업데이트
        if (this.reinforceBtn) {
            if (this.reserveHeroes.length > 0) {
                this.reinforceBtn.setText(`[증원 ${this.reserveHeroes.length}명]`);
            } else {
                this.reinforceBtn.setVisible(false);
            }
        }
    }

    _closeReinforcementPanel() {
        if (this._reinforcePanel) {
            this._reinforcePanel.destroy();
            this._reinforcePanel = null;
        }
    }

    // ═══════════════════════════════════
    // 컨트롤 UI
    // ═══════════════════════════════════

    _drawControls(width, logY) {
        const btnY = logY + 80;

        // 증원 버튼
        this._drawReinforcementBtn(width, logY);

        // 정지/시작
        this.pauseBtn = this.add.text(width - 200, btnY, '[ \u23f8 정지 ]', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            if (this.paused) {
                this.pauseBtn.setText('[ \u25b6 시작 ]');
                this.pauseBtn.setColor('#40d870');
            } else {
                this.pauseBtn.setText('[ \u23f8 정지 ]');
                this.pauseBtn.setColor('#a0a0c0');
            }
        });

        // 배속
        this.speedBtn = this.add.text(width - 110, btnY, '[x1]', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.speedBtn.on('pointerdown', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this.speedBtn.setText(`[x${this.speed}]`);
        });

        // 스킵
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
        overlay.setDepth(10000);

        const resultColor = victory ? '#40d870' : '#e03030';
        const resultText = victory ? '승 리' : '패 배';

        this.add.text(width / 2, height / 2 - 70, resultText, {
            fontSize: '32px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setDepth(10001);

        this._createBtn(width / 2, height / 2 - 35, '닫 기', () => {
            this.onClose();
            this.scene.stop('BattleSceneB');
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
                        const unit = this.units[evt.name];
                        if (unit) {
                            unit.alive = false;
                            unit.state = UNIT_STATE.DEAD;
                            unit.sprite.setAlpha(0.3).setScale(SPRITE_SCALE * 1.2, SPRITE_SCALE * 0.3);
                            unit.hpBar.width = 0;
                            unit.nameText.setAlpha(0.3);
                        }
                    }
                    if (evt.type === 'attack') {
                        const defender = this.units[evt.defender];
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
                    const unit = this.units[entry.name];
                    if (unit) {
                        unit.alive = false;
                        unit.state = UNIT_STATE.DEAD;
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
        bg.setDepth(10001);

        this.add.text(cx, cy, label, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5).setDepth(10002);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(10003);
        zone.on('pointerdown', callback);
    }
}

export default BattleSceneB;
