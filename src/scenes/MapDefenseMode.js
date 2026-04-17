/**
 * MapDefenseMode — MapScene 위에서 방어전을 진행하는 오버레이 모듈
 *
 * BattleSceneA의 카드/SP/유닛 전투 로직을 MapScene 위 오버레이로 이식.
 * 별도 씬 전환 없이 맵이 어두워지고 유닛이 맵 영역에서 전투한다.
 *
 * 사용법:
 *   const mode = new MapDefenseMode(scene, { engine, heroes, ... });
 *   mode.start();  // 오버레이 표시 + 전투 시작
 *   // scene.update에서: mode.update(time, delta);
 *   // 종료 시 onComplete 콜백 호출
 */
import BattleEngine, { BATTLE_MODES } from '../game_logic/BattleEngine.js';
import { topSin } from '../game_logic/SinUtils.js';
import SpriteRenderer from './SpriteRenderer.js';
import { FONT } from '../constants.js';
import {
    FRAME_SIZE, ANIM_FPS, SHEET_CONFIG, DIR_EAST, DIR_WEST,
    DEFAULT_SPRITE, MONSTER_SPRITES, BOSS_SPRITES,
    pickEnemySprite, SIN_SPRITE_MAP, HERO_SPRITE_TYPES, UNIT_STATE
} from './SpriteConstants.js';

const SPRITE_SCALE = 0.75;
const DISPLAY_SIZE = FRAME_SIZE * SPRITE_SCALE;
const TICK_MS = 400;

// 맵 영역 기준 전장 좌표
const MAP_TOP = 32;       // HUD 아래
const MAP_H = 440;        // 맵 영역 높이
const GROUND_Y = MAP_TOP + MAP_H * 0.65; // 맵 영역 65% 지점

// 영외 영역(680~1280)에서만 전투 — 영내 건물과 분리
const ZONE_GATE_X = 680;  // 영내/영외 경계
const FIELD_LEFT = 700;
const FIELD_RIGHT = 1260;
const HERO_START_X = 730;
const ENEMY_START_X = 1200;

const Y_OFFSETS = [0, -30, 30, -60, 60];
const MOVE_SPEED = 1.5;
const ENGAGE_RANGE_MELEE = 40;
const ENGAGE_RANGE_RANGED = 160;

class MapDefenseMode {
    /**
     * @param {Phaser.Scene} scene - MapScene 인스턴스
     * @param {Object} config
     * @param {BattleEngine} config.engine - 초기화된 BattleEngine
     * @param {Array} config.heroData - 영웅 데이터 [{id, name, primarySin, appearance}]
     * @param {Array} config.reserveHeroes - 증원 가능 영웅
     * @param {string} config.stageName - 전투 이름
     * @param {Function} config.onComplete - 전투 종료 콜백 (victory: boolean)
     */
    constructor(scene, config) {
        this.scene = scene;
        this.engine = config.engine;
        this.heroData = config.heroData || [];
        this.reserveHeroes = config.reserveHeroes || [];
        this.stageName = config.stageName || '밤 습격';
        this.onComplete = config.onComplete || (() => {});
        this.active = false;
        this.paused = false;
        this.speed = 1;
        this.units = {};
        this._activeTimers = [];

        this._tickAccumulator = 0;
        this._resultShown = false;
        this._duelActive = false;
        this._duelOverlay = null;
        this._logLines = [];
        this._container = null;
        this._spriteRenderer = null;
        this._composedHeroes = {};
        this._cardButtons = [];
        this._reinforcePanel = null;
    }

    // ═══════════════════════════════════
    // 시작 / 종료
    // ═══════════════════════════════════

    start() {
        this.active = true;
        this._container = this.scene.add.container(0, 0).setDepth(3000);

        const { width, height } = this.scene.scale;

        // 영내(좌측)만 어둡게 — 영외는 전투 필드로 밝게 유지
        this._dimBg = this.scene.add.rectangle(
            ZONE_GATE_X / 2, height / 2,
            ZONE_GATE_X, height,
            0x000000, 0.55
        );
        this._container.add(this._dimBg);

        // 영외 전투 필드 배경 (약간 어두운 톤)
        this._fieldBg = this.scene.add.rectangle(
            ZONE_GATE_X + (width - ZONE_GATE_X) / 2,
            MAP_TOP + MAP_H / 2,
            width - ZONE_GATE_X, MAP_H,
            0x000000, 0.25
        );
        this._container.add(this._fieldBg);

        // 런타임 합성
        this._spriteRenderer = new SpriteRenderer(this.scene);
        for (const hero of this.heroData) {
            if (hero.appearance && hero.appearance.layers) {
                const heroId = `hero_${hero.id}`;
                this._composedHeroes[hero.name] = this._spriteRenderer.compose(hero.appearance, heroId);
            }
        }

        this._createAnimations();
        this._drawHeader(width);
        this._drawLog(width, height);
        this._drawControls(width, height);
        this._initUnits();

        this._addLog('[방어전 시작]');
    }

    destroy() {
        this.active = false;
        // 진행 중인 tweens/timers 정리
        for (const u of Object.values(this.units)) {
            if (u.sprite) {
                u.sprite.stop();
                this.scene.tweens.killTweensOf(u.sprite);
            }
            if (u.container) this.scene.tweens.killTweensOf(u.container);
        }
        for (const t of this._activeTimers) {
            if (t && t.remove) t.remove(false);
        }
        this._activeTimers = [];
        if (this._duelOverlay) {
            this._duelOverlay.destroy();
            this._duelOverlay = null;
        }
        if (this._reinforcePanel) {
            this._reinforcePanel.destroy();
            this._reinforcePanel = null;
        }
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
        this.units = {};
        this._cardButtons = [];
        this._logLines = [];
        // 합성 텍스처 정리
        if (this._composedHeroes) {
            for (const composed of Object.values(this._composedHeroes)) {
                for (const texKey of Object.values(composed)) {
                    if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
                }
            }
            this._composedHeroes = {};
        }
    }

    // ═══════════════════════════════════
    // 프레임 업데이트 (MapScene.update에서 호출)
    // ═══════════════════════════════════

    update(time, delta) {
        if (!this.active || this._resultShown || this.paused) return;

        if (!this._duelActive) {
            this._updateMovement(delta);
        }

        this._tickAccumulator += delta * this.speed;
        while (this._tickAccumulator >= TICK_MS) {
            this._tickAccumulator -= TICK_MS;
            this._tickEngine();
            if (this._resultShown) break;
        }
    }

    // ═══════════════════════════════════
    // 엔진 틱
    // ═══════════════════════════════════

    _tickEngine() {
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
    // 유닛 초기화
    // ═══════════════════════════════════

    _initUnits() {
        const unitsData = this.engine.getUnits();

        unitsData.heroes.forEach((u, i) => {
            const heroInfo = this.heroData.find(h => h.name === u.name);
            const heroId = heroInfo ? `hero_${heroInfo.id}` : null;
            const composed = this._composedHeroes[u.name];
            const sin = topSin(u.sinStats) || u.primarySin;
            const spriteType = composed ? heroId : (SIN_SPRITE_MAP[sin] || DEFAULT_SPRITE);
            const useComposed = !!composed;

            const fx = HERO_START_X + i * 40;
            const fy = GROUND_Y + (Y_OFFSETS[i] || 0);
            this._createUnit(u.name, fx, fy, spriteType, true, u.maxHp, useComposed);
        });

        unitsData.enemies.forEach((u, i) => {
            const spriteType = pickEnemySprite(u.name, i);
            const fx = ENEMY_START_X - i * 40;
            const fy = GROUND_Y + (Y_OFFSETS[i] || 0);
            this._createUnit(u.name, fx, fy, spriteType, false, u.maxHp);
        });

    }

    // ═══════════════════════════════════
    // X축 이동
    // ═══════════════════════════════════

    _updateMovement(delta) {
        const speedMult = this.speed * (delta / 16.67);

        for (const name of Object.keys(this.units)) {
            const unit = this.units[name];
            if (!unit.alive || unit.state === UNIT_STATE.DEAD) continue;
            if (unit.state === UNIT_STATE.ATTACKING || unit.state === UNIT_STATE.HURT) continue;

            if (!unit.target || !unit.target.alive) {
                unit.target = this._findTarget(unit);
                if (!unit.target) { this._setIdle(unit); continue; }
            }

            const dx = unit.target.fieldX - unit.fieldX;
            const dist = Math.abs(dx);
            const range = unit.engageRange || ENGAGE_RANGE_MELEE;

            if (dist <= range) {
                this._setIdle(unit);
            } else {
                const dir = dx > 0 ? 1 : -1;
                unit.fieldX += dir * MOVE_SPEED * speedMult;
                unit.fieldX = Math.max(FIELD_LEFT, Math.min(FIELD_RIGHT, unit.fieldX));
                unit.container.setPosition(unit.fieldX, unit.fieldY);

                const walkDir = dx > 0 ? DIR_EAST : DIR_WEST;
                if (unit.state !== UNIT_STATE.WALKING || unit.currentDir !== walkDir) {
                    unit.state = UNIT_STATE.WALKING;
                    unit.currentDir = walkDir;
                    const walkAnim = unit.useComposed
                        ? `${unit.spriteType}_walk`
                        : `${unit.spriteType}_walk_${walkDir}`;
                    unit.sprite.play(walkAnim);
                }
            }
        }
    }

    _findTarget(unit) {
        let nearest = null;
        let minDist = Infinity;
        for (const name of Object.keys(this.units)) {
            const other = this.units[name];
            if (!other.alive || other.isHero === unit.isHero) continue;
            const dist = Math.abs(other.fieldX - unit.fieldX);
            if (dist < minDist) { minDist = dist; nearest = other; }
        }
        return nearest;
    }

    _setIdle(unit) {
        if (unit.state === UNIT_STATE.IDLE) return;
        unit.state = UNIT_STATE.IDLE;
        if (unit.useComposed) {
            unit.sprite.play(`${unit.spriteType}_idle`);
        } else {
            const dir = unit.isHero ? DIR_EAST : DIR_WEST;
            unit.sprite.play(`${unit.spriteType}_idle_${dir}`);
        }
    }

    _animKey(unit, action) {
        if (unit.useComposed) return `${unit.spriteType}_${action}`;
        const dir = unit.isHero ? DIR_EAST : DIR_WEST;
        return `${unit.spriteType}_${action}_${dir}`;
    }

    // ═══════════════════════════════════
    // 이벤트 처리
    // ═══════════════════════════════════

    _processEvent(evt) {
        switch (evt.type) {
            case 'start': break;

            case 'attack':
                this._animateAttack(evt);
                this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender} (${evt.damage})`);
                break;

            case 'defeat':
                if (evt.isHero) {
                    this._animateDefeat(evt);
                    this._addLog(`▼ ${evt.name} 쓰러졌다!`);
                } else {
                    this._animateDefeat(evt);
                    this._addLog(`★ ${evt.name} 격파!`);
                }
                break;

            case 'duel_start':
                this._startDuelVisual(evt);
                this._addLog(`⚔ ${evt.hero.name}(이)가 ${evt.enemy.name}에게 일기토 신청!`);
                break;

            case 'duel_refused':
                this._addLog(`✗ ${evt.enemy.name}(이)가 일기토를 거부!`);
                break;

            case 'duel_end':
                this._endDuelVisual(evt);
                this._addLog(evt.heroWon
                    ? `⚔ 일기토 승리! ${evt.winner} 승!`
                    : `⚔ 일기토 패배... ${evt.winner} 승`);
                break;

            case 'card_used':
                this._addLog(`🃏 [${evt.name}] 발동!${evt.sinBonus ? ' (죄종 시너지!)' : ''}`);
                this._flashCardEffect(evt);
                break;


            case 'result': break;
        }
    }

    // ═══════════════════════════════════
    // UI 생성
    // ═══════════════════════════════════

    _drawHeader(width) {
        // 헤더 바 — 영외 영역 상단에 배치
        const fieldCenterX = ZONE_GATE_X + (width - ZONE_GATE_X) / 2;
        const fieldW = width - ZONE_GATE_X - 20;
        const headerBg = this.scene.add.rectangle(fieldCenterX, MAP_TOP + 18, fieldW, 30, 0x0a0a12, 0.85);
        headerBg.setStrokeStyle(1, 0x303048);
        this._container.add(headerBg);

        this._headerText = this.scene.add.text(fieldCenterX, MAP_TOP + 18, this.stageName, {
            fontSize: '13px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(this._headerText);
    }

    _drawLog(width, height) {
        const logY = 540;
        const logH = 70;
        const logX = ZONE_GATE_X + 10;
        const logW = width - ZONE_GATE_X - 20;

        const logBg = this.scene.add.graphics();
        logBg.fillStyle(0x0e0e1a, 0.9);
        logBg.fillRect(logX, logY, logW, logH);
        logBg.lineStyle(1, 0x303048);
        logBg.strokeRect(logX, logY, logW, logH);
        this._container.add(logBg);

        this._logText = this.scene.add.text(logX + 10, logY + 5, '', {
            fontSize: '8px', fontFamily: FONT, color: '#a0a0c0',
            lineSpacing: 2, wordWrap: { width: logW - 20 }
        });
        this._container.add(this._logText);
    }

    _drawControls(width, height) {
        const btnY = 625;
        const fieldLeft = ZONE_GATE_X + 20;

        // 증원
        if (this.reserveHeroes.length > 0) {
            this._reinforceBtn = this.scene.add.text(fieldLeft + 40, btnY, `[증원 ${this.reserveHeroes.length}명]`, {
                fontSize: '10px', fontFamily: FONT, color: '#f8c830'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(3001);
            this._reinforceBtn.on('pointerdown', () => this._showReinforcementPanel());
            this._container.add(this._reinforceBtn);
        }

        // 정지
        this._pauseBtn = this.scene.add.text(width - 220, btnY, '[ ⏸ 정지 ]', {
            fontSize: '10px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(3001);
        this._pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            this._pauseBtn.setText(this.paused ? '[ ▶ 시작 ]' : '[ ⏸ 정지 ]');
            this._pauseBtn.setColor(this.paused ? '#40d870' : '#a0a0c0');
        });
        this._container.add(this._pauseBtn);

        // 배속
        this._speedBtn = this.scene.add.text(width - 130, btnY, '[x1]', {
            fontSize: '10px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(3001);
        this._speedBtn.on('pointerdown', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this._speedBtn.setText(`[x${this.speed}]`);
        });
        this._container.add(this._speedBtn);

        // 스킵
        const skipBtn = this.scene.add.text(width - 50, btnY, '[스킵]', {
            fontSize: '10px', fontFamily: FONT, color: '#606080'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(3001);
        skipBtn.on('pointerdown', () => this._skipToEnd());
        this._container.add(skipBtn);
    }

    // ═══════════════════════════════════
    // 전투 애니메이션
    // ═══════════════════════════════════

    _animateAttack(entry) {
        const attacker = this.units[entry.attacker];
        const defender = this.units[entry.defender];
        if (!attacker || !defender) return;

        const slashAnim = this._animKey(attacker, 'slash');
        const idleAnim = this._animKey(attacker, 'idle');

        attacker.state = UNIT_STATE.ATTACKING;
        attacker.sprite.play(slashAnim);
        attacker.sprite.once('animationcomplete', () => {
            if (attacker.alive) {
                attacker.state = UNIT_STATE.IDLE;
                attacker.sprite.play(idleAnim);
            }
        });

        // 근접 돌진 / 원거리 반동
        const isRanged = (attacker.engageRange || ENGAGE_RANGE_MELEE) >= ENGAGE_RANGE_RANGED;
        if (isRanged) {
            const recoil = attacker.isHero ? -6 : 6;
            this.scene.tweens.add({
                targets: attacker.container,
                x: attacker.fieldX + recoil,
                duration: Math.max(30, 80 / this.speed),
                yoyo: true, ease: 'Power1',
                onComplete: () => attacker.container.setPosition(attacker.fieldX, attacker.fieldY)
            });
        } else {
            const dashDist = attacker.isHero ? 30 : -30;
            this.scene.tweens.add({
                targets: attacker.container,
                x: attacker.fieldX + dashDist,
                duration: Math.max(50, 150 / this.speed),
                yoyo: true, ease: 'Power2',
                onComplete: () => attacker.container.setPosition(attacker.fieldX, attacker.fieldY)
            });
        }

        // 피격
        const hitDelay = Math.max(50, 150 / this.speed);
        const timer = this.scene.time.delayedCall(hitDelay, () => {
            if (!this.active || !defender.alive) return;

            defender.state = UNIT_STATE.HURT;
            const hurtAnim = defender.useComposed
                ? `${defender.spriteType}_slash`
                : `${defender.spriteType}_hurt`;
            const defIdleAnim = this._animKey(defender, 'idle');
            defender.sprite.play(hurtAnim);
            defender.sprite.once('animationcomplete', () => {
                if (defender.alive) {
                    defender.state = UNIT_STATE.IDLE;
                    defender.sprite.play(defIdleAnim);
                }
            });

            // 넉백
            const kb = defender.isHero ? -10 : 10;
            this.scene.tweens.add({
                targets: defender.container,
                x: defender.fieldX + kb,
                duration: 50, yoyo: true,
                onComplete: () => defender.container.setPosition(defender.fieldX, defender.fieldY)
            });

            // HP 갱신
            const maxHp = entry.maxHp || defender.maxHp || 100;
            const hpPercent = Math.max(0, entry.remainHp / maxHp);
            defender.hpBar.width = Math.max(0, hpPercent * defender.maxHpBarWidth);

            // 데미지 텍스트
            const dmgText = this.scene.add.text(defender.fieldX, defender.fieldY - 50, `-${entry.damage}`, {
                fontSize: '12px', fontFamily: FONT, color: '#f04040',
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5).setDepth(9999);
            this._container.add(dmgText);

            this.scene.tweens.add({
                targets: dmgText,
                y: dmgText.y - 25, alpha: 0,
                duration: 500,
                onComplete: () => dmgText.destroy()
            });
        });
        this._activeTimers.push(timer);
    }

    _animateDefeat(entry) {
        const unit = this.units[entry.name];
        if (!unit) return;

        unit.alive = false;
        unit.state = UNIT_STATE.DEAD;
        unit.hpBar.width = 0;

        const hurtAnim = `${unit.spriteType}_hurt`;
        unit.sprite.play(hurtAnim);
        unit.sprite.once('animationcomplete', () => unit.sprite.stop());

        this.scene.tweens.add({
            targets: unit.sprite,
            alpha: 0.3, scaleX: SPRITE_SCALE * 1.2, scaleY: SPRITE_SCALE * 0.3,
            duration: 400
        });
        this.scene.tweens.add({
            targets: unit.nameText,
            alpha: 0.3, duration: 400
        });
    }

    _flashCardEffect(evt) {
        const { width } = this.scene.scale;
        const fieldCenterX = ZONE_GATE_X + (width - ZONE_GATE_X) / 2;
        const flashText = this.scene.add.text(fieldCenterX, GROUND_Y - 80, evt.name, {
            fontSize: '18px', fontFamily: FONT,
            color: evt.sinBonus ? '#f8c830' : '#e8e8f0',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setDepth(9999);
        this._container.add(flashText);

        this.scene.tweens.add({
            targets: flashText,
            y: flashText.y - 40, alpha: 0, scaleX: 1.5, scaleY: 1.5,
            duration: 1000, ease: 'Power2',
            onComplete: () => flashText.destroy()
        });
    }

    // ═══════════════════════════════════
    // 일기토 시각 연출
    // ═══════════════════════════════════

    _startDuelVisual(evt) {
        this._duelActive = true;
        const { width, height } = this.scene.scale;
        const fieldCenterX = ZONE_GATE_X + (width - ZONE_GATE_X) / 2;

        this._duelOverlay = this.scene.add.container(0, 0).setDepth(5000);
        this._container.add(this._duelOverlay);

        const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this._duelOverlay.add(bg);

        const vsText = this.scene.add.text(fieldCenterX, GROUND_Y - 60, '⚔ 일기토 ⚔', {
            fontSize: '18px', fontFamily: FONT, color: '#f8c830',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._duelOverlay.add(vsText);

        for (const name of Object.keys(this.units)) {
            const unit = this.units[name];
            if (unit.name !== evt.hero.name && unit.name !== evt.enemy.name) {
                unit.container.setAlpha(0.2);
            }
        }

        const heroUnit = this.units[evt.hero.name];
        const enemyUnit = this.units[evt.enemy.name];

        if (heroUnit) {
            heroUnit._savedX = heroUnit.fieldX;
            heroUnit._savedY = heroUnit.fieldY;
            this.scene.tweens.add({
                targets: heroUnit.container,
                x: fieldCenterX - 80, y: GROUND_Y,
                duration: 400, ease: 'Power2'
            });
            heroUnit.fieldX = fieldCenterX - 80;
            heroUnit.container.setDepth(5001);
        }
        if (enemyUnit) {
            enemyUnit._savedX = enemyUnit.fieldX;
            enemyUnit._savedY = enemyUnit.fieldY;
            this.scene.tweens.add({
                targets: enemyUnit.container,
                x: fieldCenterX + 80, y: GROUND_Y,
                duration: 400, ease: 'Power2'
            });
            enemyUnit.fieldX = fieldCenterX + 80;
            enemyUnit.container.setDepth(5001);
        }
    }

    _endDuelVisual(evt) {
        this._duelActive = false;
        if (this._duelOverlay) {
            this._duelOverlay.destroy();
            this._duelOverlay = null;
        }
        for (const name of Object.keys(this.units)) {
            const unit = this.units[name];
            unit.container.setAlpha(1);
            unit.container.setDepth(unit.fieldY);
            if (unit._savedX !== undefined) {
                unit.fieldX = unit._savedX;
                unit.fieldY = unit._savedY;
                unit.container.setPosition(unit.fieldX, unit.fieldY);
                delete unit._savedX;
                delete unit._savedY;
            }
        }
    }

    // ═══════════════════════════════════
    // 유닛 생성
    // ═══════════════════════════════════

    _createUnit(name, fx, fy, spriteType, isHero, maxHp, useComposed = false) {
        const container = this.scene.add.container(fx, fy);
        const dir = isHero ? DIR_EAST : DIR_WEST;

        let sprite;
        if (useComposed) {
            const idleKey = `composed_${spriteType}_idle`;
            sprite = this.scene.add.sprite(0, 0, idleKey, 0);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle`);
        } else {
            sprite = this.scene.add.sprite(0, 0, `${spriteType}_idle`);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle_${dir}`);
        }
        // 몬스터 전용 스프라이트 사용 — 틴트 불필요
        container.add(sprite);

        const halfH = DISPLAY_SIZE / 2;

        // HP 바
        const hpBarWidth = DISPLAY_SIZE + 4;
        const hpBg = this.scene.add.rectangle(0, -halfH - 6, hpBarWidth, 4, 0x1a1a2a);
        container.add(hpBg);
        const hpBar = this.scene.add.rectangle(-hpBarWidth / 2, -halfH - 6, hpBarWidth, 4, isHero ? 0x40d870 : 0xe03030);
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // 이름
        const nameText = this.scene.add.text(0, halfH + 4, name, {
            fontSize: '8px', fontFamily: FONT, color: isHero ? '#a0c0f0' : '#f0a0a0'
        }).setOrigin(0.5);
        container.add(nameText);

        container.setDepth(Math.floor(fy));
        this._container.add(container);

        this.units[name] = {
            container, sprite, hpBar, hpBg, nameText,
            fieldX: fx, fieldY: fy,
            maxHp: maxHp || 100,
            alive: true, isHero,
            maxHpBarWidth: hpBarWidth,
            spriteType, useComposed,
            state: UNIT_STATE.IDLE,
            currentDir: dir,
            target: null, name,
            engageRange: ENGAGE_RANGE_MELEE
        };
    }

    // ═══════════════════════════════════
    // 증원
    // ═══════════════════════════════════

    _showReinforcementPanel() {
        if (!this.reserveHeroes || this.reserveHeroes.length === 0) return;
        if (this._reinforcePanel) return;

        const { width, height } = this.scene.scale;
        const fieldCenterX = ZONE_GATE_X + (width - ZONE_GATE_X) / 2;
        const panelW = 200;
        const panelH = 30 + this.reserveHeroes.length * 30;
        const px = fieldCenterX - panelW / 2;
        const py = height / 2 - panelH / 2;

        this._reinforcePanel = this.scene.add.container(0, 0).setDepth(10000);
        this._container.add(this._reinforcePanel);

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x0e0e1a, 0.95);
        bg.fillRect(px, py, panelW, panelH);
        bg.lineStyle(1, 0xf8c830);
        bg.strokeRect(px, py, panelW, panelH);
        this._reinforcePanel.add(bg);

        const title = this.scene.add.text(px + panelW / 2, py + 12, '증원 선택', {
            fontSize: '11px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0.5);
        this._reinforcePanel.add(title);

        this.reserveHeroes.forEach((hero, i) => {
            const hy = py + 30 + i * 30;
            const heroText = this.scene.add.text(px + 10, hy + 6, hero.name, {
                fontSize: '10px', fontFamily: FONT, color: '#e8e8f0'
            });
            this._reinforcePanel.add(heroText);

            const zone = this.scene.add.zone(px + panelW / 2, hy + 12, panelW, 28)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                const fx = FIELD_LEFT + 50;
                const fy = GROUND_Y + (Y_OFFSETS[Object.keys(this.units).length] || 0);
                this._createUnit(hero.name, fx, fy, DEFAULT_SPRITE, true, hero.maxHp || 100);
                this._addLog(`★ ${hero.name} 증원!`);
                this.reserveHeroes.splice(i, 1);
                if (this._reinforcePanel) { this._reinforcePanel.destroy(); this._reinforcePanel = null; }
                if (this._reinforceBtn) {
                    if (this.reserveHeroes.length > 0) {
                        this._reinforceBtn.setText(`[증원 ${this.reserveHeroes.length}명]`);
                    } else {
                        this._reinforceBtn.setVisible(false);
                    }
                }
            });
            this._reinforcePanel.add(zone);
        });

        const closeText = this.scene.add.text(px + panelW - 8, py + 4, 'X', {
            fontSize: '10px', fontFamily: FONT, color: '#e03030'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeText.on('pointerdown', () => {
            if (this._reinforcePanel) { this._reinforcePanel.destroy(); this._reinforcePanel = null; }
        });
        this._reinforcePanel.add(closeText);
    }

    // ═══════════════════════════════════
    // 결과 / 스킵
    // ═══════════════════════════════════

    _showResult(victory) {
        if (this._resultShown) return;
        this._resultShown = true;
        this.paused = true;

        const { width } = this.scene.scale;
        const fieldCenterX = ZONE_GATE_X + (width - ZONE_GATE_X) / 2;
        const resultY = GROUND_Y - 30;

        const overlay = this.scene.add.rectangle(fieldCenterX, resultY, 280, 70, 0x0a0a12, 0.9);
        overlay.setStrokeStyle(2, victory ? 0x40d870 : 0xe03030);
        this._container.add(overlay);

        const resultText = victory ? '방 어 성 공' : '방 어 실 패';
        const resultColor = victory ? '#40d870' : '#e03030';

        const text = this.scene.add.text(fieldCenterX, resultY - 10, resultText, {
            fontSize: '24px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(text);

        // 닫기 버튼
        const btnW = 100;
        const btnH = 26;
        const btnBg = this.scene.add.graphics();
        btnBg.fillStyle(0x2a0808, 1);
        btnBg.fillRect(fieldCenterX - btnW / 2, resultY + 10, btnW, btnH);
        btnBg.lineStyle(1, 0xe03030);
        btnBg.strokeRect(fieldCenterX - btnW / 2, resultY + 10, btnW, btnH);
        this._container.add(btnBg);

        const btnText = this.scene.add.text(fieldCenterX, resultY + 23, '계 속', {
            fontSize: '10px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);
        this._container.add(btnText);

        const btnZone = this.scene.add.zone(fieldCenterX, resultY + 23, btnW, btnH)
            .setInteractive({ useHandCursor: true }).setDepth(10003);
        btnZone.on('pointerdown', () => {
            const v = victory;
            this.destroy();
            this.onComplete(v);
        });
        this._container.add(btnZone);
    }

    _skipToEnd() {
        while (!this.engine.isFinished()) {
            const events = this.engine.tick();
            if (!events) break;
            const evts = Array.isArray(events) ? events : [events];
            for (const evt of evts) {
                if (evt.type === 'defeat' && !evt.isSoldier) {
                    const unit = this.units[evt.name];
                    if (unit) {
                        unit.alive = false;
                        unit.state = UNIT_STATE.DEAD;
                        unit.sprite.setAlpha(0.3).setScale(SPRITE_SCALE * 1.2, SPRITE_SCALE * 0.3);
                        unit.hpBar.width = 0;
                        unit.nameText.setAlpha(0.3);
                    }
                }
                if (evt.type === 'attack' && !evt.attackerIsSoldier && !evt.defenderIsSoldier) {
                    const defender = this.units[evt.defender];
                    if (defender && defender.alive) {
                        const maxHp = evt.maxHp || defender.maxHp || 100;
                        const hpPercent = Math.max(0, evt.remainHp / maxHp);
                        defender.hpBar.width = Math.max(0, hpPercent * defender.maxHpBarWidth);
                    }
                }
            }
        }
        if (this._duelOverlay) { this._duelOverlay.destroy(); this._duelOverlay = null; }
        this._duelActive = false;
        for (const name of Object.keys(this.units)) {
            this.units[name].container.setAlpha(1);
        }
        this._showResult(this.engine.getResult().victory);
    }

    // ═══════════════════════════════════
    // 유틸
    // ═══════════════════════════════════

    _addLog(msg) {
        this._logLines.push(msg);
        if (this._logLines.length > 5) this._logLines.shift();
        if (this._logText) this._logText.setText(this._logLines.join('\n'));
    }

    // ═══════════════════════════════════
    // 애니메이션 정의
    // ═══════════════════════════════════

    _createAnimations() {
        const oldTypes = ['warrior_male', 'warrior_female', 'base_male', 'base_female',
            ...MONSTER_SPRITES, ...BOSS_SPRITES];
        const dirs = [DIR_EAST, DIR_WEST];

        for (const type of oldTypes) {
            for (const dir of dirs) {
                const idleKey = `${type}_idle_${dir}`;
                if (!this.scene.anims.exists(idleKey)) {
                    this.scene.anims.create({
                        key: idleKey,
                        frames: this.scene.anims.generateFrameNumbers(`${type}_idle`, {
                            start: dir * SHEET_CONFIG.idle.frames, end: dir * SHEET_CONFIG.idle.frames + SHEET_CONFIG.idle.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const walkKey = `${type}_walk_${dir}`;
                if (!this.scene.anims.exists(walkKey)) {
                    this.scene.anims.create({
                        key: walkKey,
                        frames: this.scene.anims.generateFrameNumbers(`${type}_walk`, {
                            start: dir * SHEET_CONFIG.walk.frames, end: dir * SHEET_CONFIG.walk.frames + SHEET_CONFIG.walk.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const slashKey = `${type}_slash_${dir}`;
                if (!this.scene.anims.exists(slashKey)) {
                    this.scene.anims.create({
                        key: slashKey,
                        frames: this.scene.anims.generateFrameNumbers(`${type}_slash`, {
                            start: dir * SHEET_CONFIG.slash.frames, end: dir * SHEET_CONFIG.slash.frames + SHEET_CONFIG.slash.frames - 1
                        }),
                        frameRate: ANIM_FPS * 1.5, repeat: 0
                    });
                }
            }

            const hurtKey = `${type}_hurt`;
            if (!this.scene.anims.exists(hurtKey)) {
                this.scene.anims.create({
                    key: hurtKey,
                    frames: this.scene.anims.generateFrameNumbers(`${type}_hurt`, {
                        start: 0, end: SHEET_CONFIG.hurt.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5, repeat: 0
                });
            }
        }

        for (const type of HERO_SPRITE_TYPES) {
            for (const dir of dirs) {
                const idleKey = `${type}_idle_${dir}`;
                if (!this.scene.anims.exists(idleKey)) {
                    this.scene.anims.create({
                        key: idleKey,
                        frames: this.scene.anims.generateFrameNumbers(`${type}_idle`, {
                            start: 0, end: SHEET_CONFIG.idle.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const walkKey = `${type}_walk_${dir}`;
                if (!this.scene.anims.exists(walkKey)) {
                    this.scene.anims.create({
                        key: walkKey,
                        frames: this.scene.anims.generateFrameNumbers(`${type}_walk`, {
                            start: 0, end: SHEET_CONFIG.walk.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const slashKey = `${type}_slash_${dir}`;
                if (!this.scene.anims.exists(slashKey)) {
                    this.scene.anims.create({
                        key: slashKey,
                        frames: this.scene.anims.generateFrameNumbers(`${type}_slash`, {
                            start: 0, end: SHEET_CONFIG.slash.frames - 1
                        }),
                        frameRate: ANIM_FPS * 1.5, repeat: 0
                    });
                }
            }

            const hurtKey = `${type}_hurt`;
            if (!this.scene.anims.exists(hurtKey)) {
                this.scene.anims.create({
                    key: hurtKey,
                    frames: this.scene.anims.generateFrameNumbers(`${type}_slash`, {
                        start: SHEET_CONFIG.slash.frames - 2, end: SHEET_CONFIG.slash.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5, repeat: 0
                });
            }
        }
    }
}

export default MapDefenseMode;
