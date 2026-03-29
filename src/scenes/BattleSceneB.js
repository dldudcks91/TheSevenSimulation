/**
 * BattleSceneB — X축 태그매치
 *
 * 1:1 순차 교전. DuelBattleScene과 동일한 좌우 구도.
 * 대기열에서 다음 유닛 투입. 병사→영웅 순서로 출전.
 * 병사는 카운터 표시, 영웅만 스프라이트.
 *
 * 모드: realtime (engine tick) / replay (log 재생)
 */
import { BATTLE_MODES } from '../game_logic/BattleEngine.js';
import { FONT } from '../constants.js';
import {
    FRAME_SIZE, ANIM_FPS, SHEET_CONFIG, DIR_EAST, DIR_WEST,
    DEFAULT_SPRITE, MONSTER_SPRITES, BOSS_SPRITES,
    pickEnemySprite, SIN_SPRITE_MAP, HERO_SPRITE_TYPES
} from './SpriteConstants.js';

const SPRITE_SCALE = 2.0;
const DISPLAY_SIZE = FRAME_SIZE * SPRITE_SCALE;

const TICK_MS = 400;

// 레이아웃
const GROUND_Y = 320;
const HERO_X = 350;
const ENEMY_X = 930;
const QUEUE_Y = 180;

// 스프라이트 상수 → SpriteConstants.js에서 import

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

        this.engine = data.engine || null;
        this.battleLog = data.log || null;
        this.victory = data.victory;

        this._mode = this.engine ? 'realtime' : 'replay';
    }

    preload() {
        const types = [
            'warrior_male', 'warrior_female', 'base_male', 'base_female',
            ...HERO_SPRITE_TYPES,
            ...MONSTER_SPRITES,
            ...BOSS_SPRITES,
        ];
        const actions = ['idle', 'slash', 'hurt'];
        for (const type of types) {
            for (const action of actions) {
                const key = `${type}_${action}`;
                if (!this.textures.exists(key)) {
                    this.load.spritesheet(key, `assets/sprites/${type}/${action}.png`, {
                        frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE
                    });
                }
            }
        }
    }

    create() {
        this.events.once('shutdown', () => this._cleanup());

        const { width, height } = this.scale;
        this._createAnimations();

        // 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a12);

        // 지면
        this._drawGround(width);

        // 헤더
        this.add.text(width / 2, 20, this.stageName, {
            fontSize: '16px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // VS 표시
        this.add.text(width / 2, GROUND_Y - 60, 'VS', {
            fontSize: '28px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setAlpha(0.3);

        // 병사 카운터
        this._soldierAlive = 0;
        this._soldierTotal = 0;
        this.soldierText = this.add.text(140, 50, '', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);

        // 대기열 텍스트
        this._allyQueueText = this.add.text(80, QUEUE_Y, '', {
            fontSize: '10px', fontFamily: FONT, color: '#a0c0f0',
            lineSpacing: 4
        });
        this._enemyQueueText = this.add.text(width - 80, QUEUE_Y, '', {
            fontSize: '10px', fontFamily: FONT, color: '#f0a0a0',
            lineSpacing: 4
        }).setOrigin(1, 0);

        this.add.text(80, QUEUE_Y - 18, '대기열', {
            fontSize: '9px', fontFamily: FONT, color: '#606080'
        });
        this.add.text(width - 80, QUEUE_Y - 18, '대기열', {
            fontSize: '9px', fontFamily: FONT, color: '#606080'
        }).setOrigin(1, 0);

        // 로그 패널
        const logY = height - 130;
        const logG = this.add.graphics();
        logG.fillStyle(0x0e0e1a, 0.92);
        logG.fillRect(40, logY, width - 80, 110);
        logG.lineStyle(1, 0x303048);
        logG.strokeRect(40, logY, width - 80, 110);

        this.add.text(52, logY + 6, '[ 전투 로그 ]', {
            fontSize: '9px', fontFamily: FONT, color: '#606080'
        });
        this.logText = this.add.text(52, logY + 22, '', {
            fontSize: '10px', fontFamily: FONT, color: '#a0a0c0',
            lineSpacing: 4, wordWrap: { width: width - 120 }
        });
        this._logLines = [];

        // 현재 교전 유닛 디스플레이
        this._currentAlly = null;
        this._currentEnemy = null;

        // 컨트롤
        this._drawControls(width, height);

        // 초기화
        if (this._mode === 'realtime') {
            this._initRealtime();
        } else {
            this._initReplay();
        }

        this._tickAccumulator = 0;
        this._resultShown = false;
    }

    update(time, delta) {
        if (this._resultShown || this.paused) return;

        this._tickAccumulator += delta * this.speed;
        while (this._tickAccumulator >= TICK_MS) {
            this._tickAccumulator -= TICK_MS;
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
        const unitsData = this.engine.getUnits();

        // 대기열 구성
        this._allyNames = unitsData.heroes.map(u => u.name);
        this._enemyNames = unitsData.enemies.map(u => u.name);
        this._enemySpriteMap = {};
        unitsData.enemies.forEach((u, i) => {
            this._enemySpriteMap[u.name] = pickEnemySprite(u.name, i);
        });

        if (unitsData.soldiers) {
            this._soldierTotal = unitsData.soldiers.total;
            this._soldierAlive = unitsData.soldiers.alive;
            this._updateSoldierDisplay();
        }

        // 첫 교전자 표시
        const fighters = this.engine.getTagFighters();
        if (fighters.ally) {
            this._showFighter('ally', fighters.ally);
        }
        if (fighters.enemy) {
            this._showFighter('enemy', fighters.enemy);
        }

        this._updateQueueDisplay();
        this._addLog('[태그매치 시작]');
    }

    _tickRealtime() {
        if (this.engine.isFinished()) {
            this._showResult(this.engine.getResult().victory);
            return;
        }
        const events = this.engine.tick();
        if (!events) return;
        const eventArray = Array.isArray(events) ? events : [events];
        for (const evt of eventArray) this._processEvent(evt);
    }

    // ═══════════════════════════════════
    // 리플레이 모드
    // ═══════════════════════════════════

    _initReplay() {
        this._logIndex = 0;
        const startEntry = this.battleLog.find(e => e.type === 'start');
        if (!startEntry) return;

        this._allyNames = [...startEntry.heroes];
        this._enemyNames = [...startEntry.enemies];
        this._enemySpriteMap = {};
        startEntry.enemies.forEach((name, i) => {
            this._enemySpriteMap[name] = pickEnemySprite(name, i);
        });

        if (startEntry.soldiers) {
            this._soldierTotal = startEntry.soldiers;
            this._soldierAlive = startEntry.soldiers;
            this._updateSoldierDisplay();
        }

        // 첫 교전자
        if (this._soldierAlive > 0) {
            this._showFighter('ally', { name: '민병', isSoldier: true, hp: 80, maxHp: 80 });
        } else if (this._allyNames.length > 0) {
            this._showFighter('ally', { name: this._allyNames[0], isSoldier: false, hp: 100, maxHp: 100 });
        }
        if (this._enemyNames.length > 0) {
            this._showFighter('enemy', { name: this._enemyNames[0], hp: 100, maxHp: 100 });
        }

        this._updateQueueDisplay();
        this._addLog('[태그매치 시작]');
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
                break;

            case 'attack':
                if (evt.attackerIsSoldier || evt.defenderIsSoldier) {
                    // 병사 교전: 로그만
                    this._addLog(`${evt.attacker} → ${evt.defender} -${evt.damage}hp (잔여 ${evt.remainHp})`);
                } else {
                    this._animateAttack(evt);
                    this._addLog(`${evt.attacker} → ${evt.defender} -${evt.damage}hp (잔여 ${evt.remainHp})`);
                }
                break;

            case 'defeat':
                if (evt.isSoldier) {
                    this._soldierAlive = Math.max(0, this._soldierAlive - 1);
                    this._updateSoldierDisplay();
                    this._addLog(`▼ ${evt.name} 전사 (잔여: ${this._soldierAlive})`);
                } else if (evt.isHero) {
                    this._animateDefeat('ally');
                    this._addLog(`▼ ${evt.name} 쓰러졌다!`);
                } else {
                    this._animateDefeat('enemy');
                    this._addLog(`★ ${evt.name} 격파!`);
                }
                break;

            case 'tag_next':
                // 누군가 쓰러짐 → 대기열 업데이트
                break;

            case 'tag_enter':
                // 새 교전자 등장
                if (evt.ally) {
                    this._showFighter('ally', evt.ally);
                }
                if (evt.enemy) {
                    this._showFighter('enemy', evt.enemy);
                }
                this._updateQueueDisplay();
                this._addLog(`→ 새 교전자 등장!`);
                break;

            case 'result':
                break;
        }
    }

    // ═══════════════════════════════════
    // 교전자 표시
    // ═══════════════════════════════════

    _showFighter(side, unitData) {
        const x = side === 'ally' ? HERO_X : ENEMY_X;
        const isHero = side === 'ally';
        const dir = isHero ? DIR_EAST : DIR_WEST;

        // 기존 유닛 제거
        if (side === 'ally' && this._currentAlly) {
            this._currentAlly.container.destroy();
            this._currentAlly = null;
        }
        if (side === 'enemy' && this._currentEnemy) {
            this._currentEnemy.container.destroy();
            this._currentEnemy = null;
        }

        // 병사면 이름만 표시
        if (unitData.isSoldier) {
            const container = this.add.container(x, GROUND_Y);
            const nameText = this.add.text(0, -20, '민병', {
                fontSize: '14px', fontFamily: FONT, color: '#a0a0c0'
            }).setOrigin(0.5);
            container.add(nameText);

            const display = {
                container, nameText,
                sprite: null, hpBar: null, hpText: null,
                maxHp: unitData.maxHp || 80,
                isSoldier: true, alive: true
            };

            if (side === 'ally') this._currentAlly = display;
            else this._currentEnemy = display;
            return;
        }

        // 영웅/적 스프라이트
        let spriteType;
        if (isHero) {
            const heroInfo = this.heroData.find(h => h.name === unitData.name);
            spriteType = SIN_SPRITE_MAP[heroInfo?.sinType || unitData.sinType] || DEFAULT_SPRITE;
        } else {
            spriteType = this._enemySpriteMap[unitData.name] || ENEMY_SPRITES[0];
        }

        const container = this.add.container(x, GROUND_Y);

        // 등장 애니메이션
        container.setAlpha(0);
        this.tweens.add({ targets: container, alpha: 1, duration: 300 });

        const sprite = this.add.sprite(0, 0, `${spriteType}_idle`);
        sprite.setScale(SPRITE_SCALE);
        sprite.play(`${spriteType}_idle_${isHero ? 'east' : 'west'}`);
        // 몬스터 전용 스프라이트 사용 — 틴트 불필요
        container.add(sprite);

        const halfH = DISPLAY_SIZE / 2;

        // 이름
        const nameText = this.add.text(0, -halfH - 40, unitData.name, {
            fontSize: '14px', fontFamily: FONT, color: '#e8e8f0',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        container.add(nameText);

        // HP 바
        const HP_BAR_W = 120;
        const hpBarY = -halfH - 20;
        const hpBg = this.add.rectangle(0, hpBarY, HP_BAR_W, 8, 0x1a1a2a);
        container.add(hpBg);
        const hpBar = this.add.rectangle(-HP_BAR_W / 2, hpBarY, HP_BAR_W, 8, isHero ? 0x40d870 : 0xe03030);
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // HP 텍스트
        const hpText = this.add.text(0, hpBarY + 14, `${unitData.hp}/${unitData.maxHp}`, {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);
        container.add(hpText);

        const display = {
            container, sprite, hpBar, hpBg, nameText, hpText,
            baseX: x, baseY: GROUND_Y,
            maxHp: unitData.maxHp,
            hpBarWidth: HP_BAR_W,
            spriteType, alive: true,
            isSoldier: false
        };

        if (side === 'ally') this._currentAlly = display;
        else this._currentEnemy = display;
    }

    _updateQueueDisplay() {
        // 아군 대기열
        if (this._mode === 'realtime' && this.engine) {
            const units = this.engine.getUnits();
            const aliveHeroes = units.heroes.filter(u => u.alive).map(u => u.name);
            this._allyQueueText.setText(aliveHeroes.join('\n'));

            const aliveEnemies = units.enemies.filter(u => u.alive).map(u => u.name);
            this._enemyQueueText.setText(aliveEnemies.join('\n'));
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
    // 전투 애니메이션
    // ═══════════════════════════════════

    _animateAttack(entry) {
        // 어느 쪽이 공격했는지 판별
        const isAllyAttacker = this._currentAlly && this._currentAlly.nameText &&
            this._currentAlly.nameText.text === entry.attacker;

        const attacker = isAllyAttacker ? this._currentAlly : this._currentEnemy;
        const defender = isAllyAttacker ? this._currentEnemy : this._currentAlly;

        if (!attacker || !defender || !attacker.sprite || !defender.sprite) return;

        // slash
        const slashDir = isAllyAttacker ? 'east' : 'west';
        const slashAnim = `${attacker.spriteType}_slash_${slashDir}`;
        const idleAnim = `${attacker.spriteType}_idle_${slashDir}`;

        attacker.sprite.play(slashAnim);
        attacker.sprite.once('animationcomplete', () => {
            if (attacker.alive) attacker.sprite.play(idleAnim);
        });

        // 돌진
        const dx = isAllyAttacker ? 60 : -60;
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
            if (!defender.alive || !defender.sprite) return;

            const hurtAnim = `${defender.spriteType}_hurt`;
            const defDir = isAllyAttacker ? 'west' : 'east';
            const defIdleAnim = `${defender.spriteType}_idle_${defDir}`;

            defender.sprite.play(hurtAnim);
            defender.sprite.once('animationcomplete', () => {
                if (defender.alive) defender.sprite.play(defIdleAnim);
            });

            // 흔들림
            this.tweens.add({
                targets: defender.container,
                x: defender.baseX + (isAllyAttacker ? 12 : -12),
                duration: 60,
                yoyo: true,
                repeat: 1
            });

            // HP 갱신
            const maxHp = entry.maxHp || defender.maxHp;
            const hpPercent = Math.max(0, entry.remainHp / maxHp);
            if (defender.hpBar) {
                defender.hpBar.width = Math.max(0, hpPercent * defender.hpBarWidth);
            }
            if (defender.hpText) {
                defender.hpText.setText(`${Math.max(0, entry.remainHp)}/${maxHp}`);
            }

            // 데미지 텍스트
            const dmgText = this.add.text(
                defender.baseX, defender.baseY - 80,
                `-${entry.damage}`,
                {
                    fontSize: '22px', fontFamily: FONT, color: '#f04040',
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

    _animateDefeat(side) {
        const unit = side === 'ally' ? this._currentAlly : this._currentEnemy;
        if (!unit || !unit.sprite) return;

        unit.alive = false;
        if (unit.hpBar) unit.hpBar.width = 0;
        if (unit.hpText) unit.hpText.setText('0/' + unit.maxHp);

        const hurtAnim = `${unit.spriteType}_hurt`;
        unit.sprite.play(hurtAnim);
        unit.sprite.once('animationcomplete', () => unit.sprite.stop());

        this.tweens.add({
            targets: unit.sprite,
            alpha: 0.3,
            scaleY: SPRITE_SCALE * 0.3,
            duration: 400
        });

        if (unit.nameText) {
            this.tweens.add({ targets: unit.nameText, alpha: 0.3, duration: 400 });
        }
    }

    // ═══════════════════════════════════
    // 애니메이션 정의
    // ═══════════════════════════════════

    _createAnimations() {
        const types = ['warrior_male', 'warrior_female', 'base_male', 'base_female',
            ...MONSTER_SPRITES, ...BOSS_SPRITES];
        const dirs = [DIR_EAST, DIR_WEST];

        for (const type of types) {
            for (const dir of dirs) {
                const idleKey = `${type}_idle_${dir === DIR_EAST ? 'east' : 'west'}`;
                if (!this.anims.exists(idleKey)) {
                    const cfg = SHEET_CONFIG.idle;
                    this.anims.create({
                        key: idleKey,
                        frames: this.anims.generateFrameNumbers(`${type}_idle`, {
                            start: dir * cfg.frames, end: dir * cfg.frames + cfg.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const slashKey = `${type}_slash_${dir === DIR_EAST ? 'east' : 'west'}`;
                if (!this.anims.exists(slashKey)) {
                    const cfg = SHEET_CONFIG.slash;
                    this.anims.create({
                        key: slashKey,
                        frames: this.anims.generateFrameNumbers(`${type}_slash`, {
                            start: dir * cfg.frames, end: dir * cfg.frames + cfg.frames - 1
                        }),
                        frameRate: ANIM_FPS * 1.5, repeat: 0
                    });
                }
            }

            const hurtKey = `${type}_hurt`;
            if (!this.anims.exists(hurtKey)) {
                const cfg = SHEET_CONFIG.hurt;
                this.anims.create({
                    key: hurtKey,
                    frames: this.anims.generateFrameNumbers(`${type}_hurt`, {
                        start: 0, end: cfg.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5, repeat: 0
                });
            }
        }

        // 영웅 스프라이트 (단일 행 — East만)
        for (const type of HERO_SPRITE_TYPES) {
            for (const dirName of ['east', 'west']) {
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
    // 지면 / 컨트롤 / 결과
    // ═══════════════════════════════════

    _drawGround(width) {
        const g = this.add.graphics();
        g.fillStyle(0x1a2a1a, 1);
        g.fillRect(60, GROUND_Y + 40, width - 120, 60);
        g.lineStyle(2, 0x2a3a2a);
        g.lineBetween(60, GROUND_Y + 40, width - 60, GROUND_Y + 40);

        for (let i = 0; i < 30; i++) {
            const gx = 80 + Math.random() * (width - 160);
            const gy = GROUND_Y + 50 + Math.random() * 40;
            g.fillStyle(0x2a3a2a, 0.3 + Math.random() * 0.4);
            g.fillRect(gx, gy, 2, 2);
        }
    }

    _drawControls(width, height) {
        const btnY = 60;

        // 정지/시작
        this.pauseBtn = this.add.text(width - 220, btnY, '[ ⏸ 정지 ]', {
            fontSize: '12px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            this.pauseBtn.setText(this.paused ? '[ ▶ 시작 ]' : '[ ⏸ 정지 ]');
            this.pauseBtn.setColor(this.paused ? '#40d870' : '#a0a0c0');
        });

        // 배속
        this.speedBtn = this.add.text(width - 130, btnY, '[x1]', {
            fontSize: '12px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.speedBtn.on('pointerdown', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this.speedBtn.setText(`[x${this.speed}]`);
        });

        // 스킵
        this.add.text(width - 60, btnY, '[스킵]', {
            fontSize: '12px', fontFamily: FONT, color: '#606080'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._skipToEnd());
    }

    _showResult(victory) {
        if (this._resultShown) return;
        this._resultShown = true;
        this.paused = true;

        const { width, height } = this.scale;
        const overlay = this.add.rectangle(width / 2, height / 2 - 40, 340, 100, 0x0a0a12, 0.92);
        overlay.setStrokeStyle(2, victory ? 0x40d870 : 0xe03030);

        const resultText = victory ? '승 리' : '패 배';
        const resultColor = victory ? '#40d870' : '#e03030';

        this.add.text(width / 2, height / 2 - 60, resultText, {
            fontSize: '36px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this._createBtn(width / 2, height / 2 - 10, '닫 기', () => {
            this.onClose();
            this.scene.stop('BattleSceneB');
        });
    }

    _skipToEnd() {
        if (this._mode === 'realtime') {
            while (!this.engine.isFinished()) {
                const events = this.engine.tick();
                if (!events) break;
            }
            this._showResult(this.engine.getResult().victory);
        } else {
            this._logIndex = this.battleLog.length;
            this._showResult(this.victory);
        }
    }

    // ═══════════════════════════════════
    // 유틸
    // ═══════════════════════════════════

    _addLog(msg) {
        this._logLines.push(msg);
        if (this._logLines.length > 6) this._logLines.shift();
        this.logText.setText(this._logLines.join('\n'));
    }

    _createBtn(cx, cy, label, callback) {
        const w = 120, h = 32;
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1);
        bg.fillRect(cx - w / 2, cy - h / 2, w, h);
        bg.lineStyle(1, 0xe03030);
        bg.strokeRect(cx - w / 2, cy - h / 2, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '12px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }

    _cleanup() {
        this.tweens.killAll();
    }
}

export default BattleSceneB;
