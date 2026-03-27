/**
 * BattleSceneA — X축 오토배틀 + 일기토
 *
 * 영웅(좌) vs 적(우), X축 이동만 (east/west).
 * Y는 겹침 방지 오프셋. 병사는 카운터 표시.
 * 전투 중 죄종 기반 일기토 발동 → 화면 중앙 1:1.
 *
 * 모드: realtime (engine tick) / replay (log 재생)
 */
import { BATTLE_MODES } from '../game_logic/BattleEngine.js';
import SpriteRenderer from './SpriteRenderer.js';
import { FONT } from '../constants.js';
const FRAME_SIZE = 64;
const SPRITE_SCALE = 1.5;
const DISPLAY_SIZE = FRAME_SIZE * SPRITE_SCALE;
const ANIM_FPS = 8;

const TICK_MS = 400;

// X축 전장 영역
const FIELD_LEFT = 40;
const FIELD_RIGHT = 760;
const FIELD_CENTER = 400;
const GROUND_Y = 320;

// 아군/적군 초기 X
const HERO_START_X = 120;
const ENEMY_START_X = 680;

// Y 오프셋 (겹침 방지)
const Y_OFFSETS = [0, -40, 40, -80, 80];

// 이동 속도
const MOVE_SPEED = 1.2;
const ENGAGE_RANGE_MELEE = 40;   // 근접 무기
const ENGAGE_RANGE_RANGED = 180; // 원거리 무기

// 스프라이트별 사거리 매핑
const SPRITE_RANGE = {
    hero_wrath: ENGAGE_RANGE_MELEE,     // 전투도끼 — 근접
    hero_envy: ENGAGE_RANGE_MELEE,      // 단검 — 근접
    hero_greed: ENGAGE_RANGE_MELEE,     // 레이피어 — 근접
    hero_sloth: ENGAGE_RANGE_RANGED,    // 무기 없음 — 원거리 (마법/투석)
    hero_gluttony: ENGAGE_RANGE_MELEE,  // 메이스 — 근접
    hero_lust: ENGAGE_RANGE_RANGED,     // 지팡이 — 원거리
    hero_pride: ENGAGE_RANGE_MELEE,     // 롱소드 — 근접
    // 기존 스프라이트 (적/기본)
    warrior_male: ENGAGE_RANGE_MELEE,
    warrior_female: ENGAGE_RANGE_MELEE,
    base_male: ENGAGE_RANGE_MELEE,
    base_female: ENGAGE_RANGE_RANGED,
};

// 스프라이트
const SHEET_CONFIG = {
    idle:  { frames: 2, rows: 4 },
    walk:  { frames: 9, rows: 4 },
    slash: { frames: 6, rows: 4 },
    hurt:  { frames: 6, rows: 1 }
};
const DIR_EAST = 3;
const DIR_WEST = 1;

const DEFAULT_SPRITE = 'warrior_male';
const ENEMY_SPRITES = ['warrior_female', 'base_male', 'base_female'];

// 죄종 → 영웅 스프라이트 매핑
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

const UNIT_STATE = { IDLE: 'idle', WALKING: 'walking', ATTACKING: 'attacking', HURT: 'hurt', DEAD: 'dead' };

class BattleSceneA extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleSceneA' });
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
        // 기존 스프라이트 (적 + 폴백)
        const types = ['warrior_male', 'warrior_female', 'base_male', 'base_female', ...HERO_SPRITE_TYPES];
        const actions = ['idle', 'walk', 'slash', 'hurt'];
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

        // 런타임 합성용 파츠 프리로드 (일반 이미지로)
        this._spriteRenderer = new SpriteRenderer(this);
        for (const hero of this.heroData) {
            if (hero.appearance && hero.appearance.layers) {
                this._spriteRenderer.preloadAppearance(hero.appearance, `hero_${hero.id}`);
            }
        }

        // 기존 hero_* 사전합성 스프라이트도 폴백용으로 로드
        for (const type of HERO_SPRITE_TYPES) {
            for (const action of ['idle', 'walk', 'slash']) {
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
        const { width, height } = this.scale;
        this._createAnimations();

        // 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a12);

        // 지면
        this._drawGround(width);

        // 헤더
        this.add.text(width / 2, 20, this.stageName, {
            fontSize: '14px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // 병사 카운터
        this._soldierAlive = 0;
        this._soldierTotal = 0;
        this.soldierText = this.add.text(width / 2, 38, '', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);

        // 런타임 합성 실행
        this._composedHeroes = {};
        for (const hero of this.heroData) {
            if (hero.appearance && hero.appearance.layers) {
                const heroId = `hero_${hero.id}`;
                this._composedHeroes[hero.name] = this._spriteRenderer.compose(hero.appearance, heroId);
            }
        }

        // SP 게이지
        this._drawSPBar(width);

        // 일기토 오버레이 (초기 숨김)
        this._duelOverlay = null;
        this._duelActive = false;

        // 카드 핸드 영역 (로그 위)
        const cardY = height - 190;
        this._drawCardHand(width, cardY);

        // 로그 패널
        const logY = height - 100;
        const logG = this.add.graphics();
        logG.fillStyle(0x0e0e1a, 0.9);
        logG.fillRect(20, logY, width - 40, 80);
        logG.lineStyle(1, 0x303048);
        logG.strokeRect(20, logY, width - 40, 80);
        this.logText = this.add.text(30, logY + 6, '', {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0',
            lineSpacing: 3, wordWrap: { width: width - 80 }
        });
        this._logLines = [];

        // 유닛
        this.units = {};

        // 컨트롤
        this._drawControls(width, logY);

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

        // 유닛 X축 이동
        if (!this._duelActive) {
            this._updateMovement(delta);
        }

        // tick
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
    // X축 이동
    // ═══════════════════════════════════

    _updateMovement(delta) {
        const speedMult = this.speed * (delta / 16.67);

        for (const name of Object.keys(this.units)) {
            const unit = this.units[name];
            if (!unit.alive || unit.state === UNIT_STATE.DEAD) continue;
            if (unit.state === UNIT_STATE.ATTACKING || unit.state === UNIT_STATE.HURT) continue;

            // 타겟 찾기
            if (!unit.target || !unit.target.alive) {
                unit.target = this._findTarget(unit);
                if (!unit.target) {
                    this._setIdle(unit);
                    continue;
                }
            }

            const dx = unit.target.fieldX - unit.fieldX;
            const dist = Math.abs(dx);
            const range = unit.engageRange || ENGAGE_RANGE_MELEE;

            if (dist <= range) {
                this._setIdle(unit);
            } else {
                const dir = dx > 0 ? 1 : -1;
                unit.fieldX += dir * MOVE_SPEED * speedMult;
                unit.fieldX = Math.max(FIELD_LEFT + 20, Math.min(FIELD_RIGHT - 20, unit.fieldX));
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
            if (dist < minDist) {
                minDist = dist;
                nearest = other;
            }
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

    /** 유닛 타입에 맞는 애니메이션 키 반환 */
    _animKey(unit, action) {
        if (unit.useComposed) {
            return `${unit.spriteType}_${action}`;
        }
        const dir = unit.isHero ? DIR_EAST : DIR_WEST;
        return `${unit.spriteType}_${action}_${dir}`;
    }

    // ═══════════════════════════════════
    // 실시간 모드
    // ═══════════════════════════════════

    _initRealtime() {
        const unitsData = this.engine.getUnits();

        unitsData.heroes.forEach((u, i) => {
            const heroInfo = this.heroData.find(h => h.name === u.name);
            const heroId = heroInfo ? `hero_${heroInfo.id}` : null;
            const composed = this._composedHeroes[u.name];

            // 합성 텍스처가 있으면 사용, 없으면 기존 방식
            const spriteType = composed ? heroId : (SIN_SPRITE_MAP[u.sinType] || DEFAULT_SPRITE);
            const useComposed = !!composed;

            const fx = HERO_START_X + i * 30;
            const fy = GROUND_Y + (Y_OFFSETS[i] || 0);
            this._createUnit(u.name, fx, fy, spriteType, true, u.maxHp, useComposed);
        });

        unitsData.enemies.forEach((u, i) => {
            const spriteType = ENEMY_SPRITES[i % ENEMY_SPRITES.length];
            const fx = ENEMY_START_X - i * 30;
            const fy = GROUND_Y + (Y_OFFSETS[i] || 0);
            this._createUnit(u.name, fx, fy, spriteType, false, u.maxHp);
        });

        if (unitsData.soldiers) {
            this._soldierTotal = unitsData.soldiers.total;
            this._soldierAlive = unitsData.soldiers.alive;
            this._updateSoldierDisplay();
        }

        this._addLog('[오토배틀 시작]');
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

        // SP 게이지 업데이트
        this._updateSPDisplay();
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
            const spriteType = SIN_SPRITE_MAP[heroInfo?.sinType] || DEFAULT_SPRITE;
            const fx = HERO_START_X + i * 30;
            const fy = GROUND_Y + (Y_OFFSETS[i] || 0);
            this._createUnit(name, fx, fy, spriteType, true, 100);
        });

        startEntry.enemies.forEach((name, i) => {
            const spriteType = ENEMY_SPRITES[i % ENEMY_SPRITES.length];
            const fx = ENEMY_START_X - i * 30;
            const fy = GROUND_Y + (Y_OFFSETS[i] || 0);
            this._createUnit(name, fx, fy, spriteType, false, 100);
        });

        if (startEntry.soldiers) {
            this._soldierTotal = startEntry.soldiers;
            this._soldierAlive = startEntry.soldiers;
            this._updateSoldierDisplay();
        }

        this._addLog('[오토배틀 시작]');
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
                    this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender} (${evt.damage})`);
                } else {
                    this._animateAttack(evt);
                    this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender} (${evt.damage})`);
                }
                break;

            case 'defeat':
                if (evt.isSoldier) {
                    this._soldierAlive = Math.max(0, this._soldierAlive - 1);
                    this._updateSoldierDisplay();
                    this._addLog(`▼ ${evt.name} 전사 (잔여: ${this._soldierAlive})`);
                } else if (evt.isHero) {
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
                this._addLog(`✗ ${evt.enemy.name}(이)가 일기토를 거부! 비겁하다!`);
                break;

            case 'duel_end':
                this._endDuelVisual(evt);
                if (evt.heroWon) {
                    this._addLog(`⚔ 일기토 승리! ${evt.winner} 승!`);
                } else {
                    this._addLog(`⚔ 일기토 패배... ${evt.winner} 승`);
                }
                break;

            case 'card_used':
                this._addLog(`🃏 [${evt.name}] 발동!${evt.sinBonus ? ' (죄종 시너지!)' : ''}`);
                this._flashCardEffect(evt);
                break;

            case 'sp_gain':
                this._updateSPDisplay();
                break;

            case 'result':
                break;
        }
    }

    _flashCardEffect(evt) {
        const { width } = this.scale;
        const flashText = this.add.text(width / 2, GROUND_Y - 100, evt.name, {
            fontSize: '20px', fontFamily: FONT,
            color: evt.sinBonus ? '#f8c830' : '#e8e8f0',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setDepth(9999);

        this.tweens.add({
            targets: flashText,
            y: flashText.y - 40,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => flashText.destroy()
        });
    }

    // ═══════════════════════════════════
    // 일기토 시각 연출
    // ═══════════════════════════════════

    _startDuelVisual(evt) {
        this._duelActive = true;
        const { width, height } = this.scale;

        // 오버레이
        this._duelOverlay = this.add.container(0, 0).setDepth(5000);

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this._duelOverlay.add(bg);

        // VS 텍스트
        const vsText = this.add.text(width / 2, GROUND_Y - 80, '⚔ 일기토 ⚔', {
            fontSize: '20px', fontFamily: FONT, color: '#f8c830',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._duelOverlay.add(vsText);

        // 기존 유닛 어둡게
        for (const name of Object.keys(this.units)) {
            const unit = this.units[name];
            if (unit.name !== evt.hero.name && unit.name !== evt.enemy.name) {
                unit.container.setAlpha(0.2);
            }
        }

        // 일기토 참여 유닛 하이라이트 + 중앙 이동
        const heroUnit = this.units[evt.hero.name];
        const enemyUnit = this.units[evt.enemy.name];

        if (heroUnit) {
            heroUnit._savedX = heroUnit.fieldX;
            heroUnit._savedY = heroUnit.fieldY;
            this.tweens.add({
                targets: heroUnit.container,
                x: width / 2 - 100,
                y: GROUND_Y,
                duration: 400,
                ease: 'Power2'
            });
            heroUnit.fieldX = width / 2 - 100;
            heroUnit.container.setDepth(5001);
        }
        if (enemyUnit) {
            enemyUnit._savedX = enemyUnit.fieldX;
            enemyUnit._savedY = enemyUnit.fieldY;
            this.tweens.add({
                targets: enemyUnit.container,
                x: width / 2 + 100,
                y: GROUND_Y,
                duration: 400,
                ease: 'Power2'
            });
            enemyUnit.fieldX = width / 2 + 100;
            enemyUnit.container.setDepth(5001);
        }
    }

    _endDuelVisual(evt) {
        this._duelActive = false;

        // 오버레이 제거
        if (this._duelOverlay) {
            this._duelOverlay.destroy();
            this._duelOverlay = null;
        }

        // 유닛 복원
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

        // 근접: 돌진 / 원거리: 제자리 (살짝 반동만)
        const isRanged = (attacker.engageRange || ENGAGE_RANGE_MELEE) >= ENGAGE_RANGE_RANGED;
        if (isRanged) {
            // 원거리 — 제자리 반동
            const recoil = attacker.isHero ? -6 : 6;
            this.tweens.add({
                targets: attacker.container,
                x: attacker.fieldX + recoil,
                duration: Math.max(30, 80 / this.speed),
                yoyo: true,
                ease: 'Power1',
                onComplete: () => attacker.container.setPosition(attacker.fieldX, attacker.fieldY)
            });
        } else {
            // 근접 — 돌진
            const dashDist = attacker.isHero ? 25 : -25;
            this.tweens.add({
                targets: attacker.container,
                x: attacker.fieldX + dashDist,
                duration: Math.max(50, 150 / this.speed),
                yoyo: true,
                ease: 'Power2',
                onComplete: () => attacker.container.setPosition(attacker.fieldX, attacker.fieldY)
            });
        }

        // 피격
        const hitDelay = Math.max(50, 150 / this.speed);
        this.time.delayedCall(hitDelay, () => {
            if (!defender.alive) return;

            defender.state = UNIT_STATE.HURT;
            const hurtAnim = defender.useComposed
                ? `${defender.spriteType}_slash`  // 합성: slash 마지막 프레임으로 대체
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
            const kb = defender.isHero ? -8 : 8;
            this.tweens.add({
                targets: defender.container,
                x: defender.fieldX + kb,
                duration: 50,
                yoyo: true,
                onComplete: () => defender.container.setPosition(defender.fieldX, defender.fieldY)
            });

            // HP 갱신
            const maxHp = entry.maxHp || defender.maxHp || 100;
            const hpPercent = Math.max(0, entry.remainHp / maxHp);
            defender.hpBar.width = Math.max(0, hpPercent * defender.maxHpBarWidth);

            // 데미지 텍스트
            const dmgText = this.add.text(defender.fieldX, defender.fieldY - 50, `-${entry.damage}`, {
                fontSize: '12px', fontFamily: FONT, color: '#f04040',
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5).setDepth(9999);

            this.tweens.add({
                targets: dmgText,
                y: dmgText.y - 25,
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

        const hurtAnim = `${unit.spriteType}_hurt`;
        unit.sprite.play(hurtAnim);
        unit.sprite.once('animationcomplete', () => unit.sprite.stop());

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
    // 유닛 생성 / 지면
    // ═══════════════════════════════════

    // ═══════════════════════════════════
    // SP 게이지
    // ═══════════════════════════════════

    _drawSPBar(width) {
        const spBarX = 30;
        const spBarY = 55;
        const spBarW = 200;
        const spBarH = 10;

        this.add.text(spBarX, spBarY - 12, 'SP', {
            fontSize: '10px', fontFamily: FONT, color: '#f8c830'
        });

        const spBg = this.add.rectangle(spBarX, spBarY, spBarW, spBarH, 0x1a1a2a);
        spBg.setOrigin(0, 0.5);

        this._spBar = this.add.rectangle(spBarX, spBarY, 0, spBarH, 0xf8c830);
        this._spBar.setOrigin(0, 0.5);
        this._spBarWidth = spBarW;

        this._spText = this.add.text(spBarX + spBarW + 8, spBarY, '0/100', {
            fontSize: '10px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0, 0.5);
    }

    _updateSPDisplay() {
        if (!this.engine || this._mode !== 'realtime') return;
        const sp = this.engine.getSP();
        const spMax = this.engine.getSPMax();
        const ratio = sp / spMax;
        this._spBar.width = this._spBarWidth * ratio;
        this._spText.setText(`${sp}/${spMax}`);

        // 카드 활성화 상태 업데이트
        this._updateCardStates();
    }

    // ═══════════════════════════════════
    // 카드 핸드
    // ═══════════════════════════════════

    _drawCardHand(width, y) {
        this._cardButtons = [];
        const cards = this.registry.get('battleCards') || [];
        if (cards.length === 0) return;

        const cardW = 130;
        const cardH = 70;
        const gap = 10;
        const totalW = cards.length * (cardW + gap) - gap;
        const startX = (width - totalW) / 2;

        // 카드 핸드 배경
        const handBg = this.add.graphics();
        handBg.fillStyle(0x0e0e1a, 0.8);
        handBg.fillRect(startX - 10, y - 5, totalW + 20, cardH + 10);
        handBg.lineStyle(1, 0x303048);
        handBg.strokeRect(startX - 10, y - 5, totalW + 20, cardH + 10);

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const cx = startX + i * (cardW + gap);

            // 카드 배경
            const cardBg = this.add.graphics();
            cardBg.fillStyle(0x161624, 1);
            cardBg.fillRect(cx, y, cardW, cardH);
            cardBg.lineStyle(1, 0x484868);
            cardBg.strokeRect(cx, y, cardW, cardH);

            // 카드 이름
            const nameText = this.add.text(cx + cardW / 2, y + 14, card.name_ko, {
                fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
            }).setOrigin(0.5);

            // SP 코스트
            const costText = this.add.text(cx + cardW / 2, y + 32, `SP: ${card.sp_cost}`, {
                fontSize: '9px', fontFamily: FONT, color: '#f8c830'
            }).setOrigin(0.5);

            // 짧은 설명
            const descText = this.add.text(cx + cardW / 2, y + 50, card.description.substring(0, 12), {
                fontSize: '8px', fontFamily: FONT, color: '#606080'
            }).setOrigin(0.5);

            // 인터랙션 영역
            const zone = this.add.zone(cx + cardW / 2, y + cardH / 2, cardW, cardH)
                .setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => this._onCardClick(card));

            // 비활성 오버레이
            const disableOverlay = this.add.rectangle(cx + cardW / 2, y + cardH / 2, cardW, cardH, 0x000000, 0.5);
            disableOverlay.setVisible(true);

            this._cardButtons.push({
                card, cardBg, nameText, costText, descText, zone, disableOverlay
            });
        }
    }

    _updateCardStates() {
        if (!this.engine || !this._cardButtons) return;
        const sp = this.engine.getSP();
        for (const btn of this._cardButtons) {
            const canUse = sp >= btn.card.sp_cost && !this._duelActive && !this._resultShown;
            btn.disableOverlay.setVisible(!canUse);
        }
    }

    _onCardClick(card) {
        if (!this.engine || this._mode !== 'realtime') return;
        if (this.engine.getSP() < card.sp_cost) return;
        if (this._duelActive || this._resultShown) return;

        // 파티 죄종 수집
        const partySinTypes = this._heroUnits
            ? Object.values(this.units).filter(u => u.isHero && u.alive).map(u => {
                const heroInfo = this.heroData.find(h => h.name === u.name);
                return heroInfo?.sinType || null;
            }).filter(Boolean)
            : [];

        const events = this.engine.useCard(card, partySinTypes);
        if (!events) return;

        for (const evt of events) {
            this._processEvent(evt);
        }

        this._updateSPDisplay();

        // 회복 카드: HP 바 업데이트
        if (card.effect_type === 'heal_percent') {
            const units = this.engine.getUnits();
            for (const heroData of units.heroes) {
                const unit = this.units[heroData.name];
                if (unit && unit.alive) {
                    const hpPercent = heroData.hp / heroData.maxHp;
                    unit.hpBar.width = Math.max(0, hpPercent * unit.maxHpBarWidth);
                }
            }
        }
    }

    _drawGround(width) {
        const g = this.add.graphics();
        g.fillStyle(0x1a2a1a, 1);
        g.fillRect(FIELD_LEFT, GROUND_Y + 30, FIELD_RIGHT - FIELD_LEFT, 60);
        g.lineStyle(2, 0x2a3a2a);
        g.lineBetween(FIELD_LEFT, GROUND_Y + 30, FIELD_RIGHT, GROUND_Y + 30);

        for (let i = 0; i < 40; i++) {
            const gx = FIELD_LEFT + 10 + Math.random() * (FIELD_RIGHT - FIELD_LEFT - 20);
            const gy = GROUND_Y + 35 + Math.random() * 40;
            g.fillStyle(0x2a3a2a, 0.3 + Math.random() * 0.4);
            g.fillRect(gx, gy, 2, 2);
        }
    }

    _createUnit(name, fx, fy, spriteType, isHero, maxHp, useComposed = false) {
        const container = this.add.container(fx, fy);
        const dir = isHero ? DIR_EAST : DIR_WEST;

        let sprite;
        if (useComposed) {
            // 런타임 합성 텍스처 사용
            const idleKey = `composed_${spriteType}_idle`;
            sprite = this.add.sprite(0, 0, idleKey, 0);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle`);
        } else {
            sprite = this.add.sprite(0, 0, `${spriteType}_idle`);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle_${dir}`);
        }
        if (!isHero) sprite.setTint(0xff8888);
        container.add(sprite);

        const halfH = DISPLAY_SIZE / 2;

        // HP 바
        const hpBarWidth = DISPLAY_SIZE + 4;
        const hpBg = this.add.rectangle(0, -halfH - 6, hpBarWidth, 4, 0x1a1a2a);
        container.add(hpBg);
        const hpBar = this.add.rectangle(-hpBarWidth / 2, -halfH - 6, hpBarWidth, 4, isHero ? 0x40d870 : 0xe03030);
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // 이름
        const nameText = this.add.text(0, halfH + 4, name, {
            fontSize: '8px', fontFamily: FONT, color: isHero ? '#a0c0f0' : '#f0a0a0'
        }).setOrigin(0.5);
        container.add(nameText);

        container.setDepth(fy);

        this.units[name] = {
            container, sprite, hpBar, hpBg, nameText,
            fieldX: fx, fieldY: fy,
            maxHp: maxHp || 100,
            alive: true, isHero,
            maxHpBarWidth: hpBarWidth,
            spriteType,
            useComposed,
            state: UNIT_STATE.IDLE,
            currentDir: dir,
            target: null,
            name,
            engageRange: SPRITE_RANGE[spriteType] || ENGAGE_RANGE_MELEE
        };
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
        // 기존 4행 스프라이트 (적용)
        const oldTypes = ['warrior_male', 'warrior_female', 'base_male', 'base_female'];
        const dirs = [DIR_EAST, DIR_WEST];

        for (const type of oldTypes) {
            for (const dir of dirs) {
                const idleKey = `${type}_idle_${dir}`;
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

                const walkKey = `${type}_walk_${dir}`;
                if (!this.anims.exists(walkKey)) {
                    const cfg = SHEET_CONFIG.walk;
                    this.anims.create({
                        key: walkKey,
                        frames: this.anims.generateFrameNumbers(`${type}_walk`, {
                            start: dir * cfg.frames, end: dir * cfg.frames + cfg.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const slashKey = `${type}_slash_${dir}`;
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

        // 영웅 스프라이트 (단일 행 — East 방향만)
        for (const type of HERO_SPRITE_TYPES) {
            // idle (단일 행: frame 0~1)
            for (const dir of dirs) {
                const idleKey = `${type}_idle_${dir}`;
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

            // walk (단일 행: frame 0~8)
            for (const dir of dirs) {
                const walkKey = `${type}_walk_${dir}`;
                if (!this.anims.exists(walkKey)) {
                    this.anims.create({
                        key: walkKey,
                        frames: this.anims.generateFrameNumbers(`${type}_walk`, {
                            start: 0, end: SHEET_CONFIG.walk.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }
            }

            // slash (단일 행: frame 0~5)
            for (const dir of dirs) {
                const slashKey = `${type}_slash_${dir}`;
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

            // hurt — hero_*에는 없으므로 slash 마지막 프레임으로 대체
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
    // 컨트롤 / 결과
    // ═══════════════════════════════════

    _drawControls(width, logY) {
        const btnY = logY + 80;

        // 증원
        if (this.reserveHeroes.length > 0) {
            this.reinforceBtn = this.add.text(60, btnY, `[증원 ${this.reserveHeroes.length}명]`, {
                fontSize: '11px', fontFamily: FONT, color: '#f8c830'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            this.reinforceBtn.on('pointerdown', () => this._showReinforcementPanel());
        }

        // 정지/시작
        this.pauseBtn = this.add.text(width - 200, btnY, '[ ⏸ 정지 ]', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            this.pauseBtn.setText(this.paused ? '[ ▶ 시작 ]' : '[ ⏸ 정지 ]');
            this.pauseBtn.setColor(this.paused ? '#40d870' : '#a0a0c0');
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

    _showReinforcementPanel() {
        // 기존 BattleSceneB의 증원 패널과 동일 로직
        if (!this.reserveHeroes || this.reserveHeroes.length === 0) return;
        if (this._reinforcePanel) return;

        const { width, height } = this.scale;
        const panelW = 200;
        const panelH = 30 + this.reserveHeroes.length * 30;
        const px = width / 2 - panelW / 2;
        const py = height / 2 - panelH / 2;

        this._reinforcePanel = this.add.container(0, 0).setDepth(10000);

        const bg = this.add.graphics();
        bg.fillStyle(0x0e0e1a, 0.95);
        bg.fillRect(px, py, panelW, panelH);
        bg.lineStyle(1, 0xf8c830);
        bg.strokeRect(px, py, panelW, panelH);
        this._reinforcePanel.add(bg);

        const title = this.add.text(px + panelW / 2, py + 12, '증원 선택', {
            fontSize: '11px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0.5);
        this._reinforcePanel.add(title);

        this.reserveHeroes.forEach((hero, i) => {
            const hy = py + 30 + i * 30;
            const heroText = this.add.text(px + 10, hy + 6, hero.name, {
                fontSize: '10px', fontFamily: FONT, color: '#e8e8f0'
            });
            this._reinforcePanel.add(heroText);

            const zone = this.add.zone(px + panelW / 2, hy + 12, panelW, 28)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                const fx = FIELD_LEFT + 30;
                const fy = GROUND_Y + (Y_OFFSETS[Object.keys(this.units).length] || 0);
                this._createUnit(hero.name, fx, fy, DEFAULT_SPRITE, true, hero.maxHp || 100);
                this._addLog(`★ ${hero.name} 증원!`);
                this.reserveHeroes.splice(i, 1);
                if (this._reinforcePanel) { this._reinforcePanel.destroy(); this._reinforcePanel = null; }
                if (this.reinforceBtn) {
                    if (this.reserveHeroes.length > 0) {
                        this.reinforceBtn.setText(`[증원 ${this.reserveHeroes.length}명]`);
                    } else {
                        this.reinforceBtn.setVisible(false);
                    }
                }
            });
            this._reinforcePanel.add(zone);
        });

        const closeText = this.add.text(px + panelW - 8, py + 4, 'X', {
            fontSize: '10px', fontFamily: FONT, color: '#e03030'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeText.on('pointerdown', () => {
            if (this._reinforcePanel) { this._reinforcePanel.destroy(); this._reinforcePanel = null; }
        });
        this._reinforcePanel.add(closeText);
    }

    _showResult(victory) {
        if (this._resultShown) return;
        this._resultShown = true;
        this.paused = true;

        const { width, height } = this.scale;
        const overlay = this.add.rectangle(width / 2, height / 2 - 60, 300, 80, 0x0a0a12, 0.9);
        overlay.setStrokeStyle(2, victory ? 0x40d870 : 0xe03030);
        overlay.setDepth(10000);

        const resultText = victory ? '승 리' : '패 배';
        const resultColor = victory ? '#40d870' : '#e03030';

        this.add.text(width / 2, height / 2 - 70, resultText, {
            fontSize: '32px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setDepth(10001);

        this._createBtn(width / 2, height / 2 - 35, '닫 기', () => {
            this.onClose();
            this.scene.stop('BattleSceneA');
        });
    }

    _skipToEnd() {
        if (this._mode === 'realtime') {
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
        } else {
            while (this._logIndex < this.battleLog.length) {
                const entry = this.battleLog[this._logIndex++];
                if (entry.type === 'defeat' && !entry.isSoldier) {
                    const unit = this.units[entry.name];
                    if (unit) {
                        unit.alive = false;
                        unit.state = UNIT_STATE.DEAD;
                        unit.sprite.setAlpha(0.3).setScale(SPRITE_SCALE * 1.2, SPRITE_SCALE * 0.3);
                        unit.hpBar.width = 0;
                        unit.nameText.setAlpha(0.3);
                    }
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
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1);
        bg.fillRect(cx - w / 2, cy - h / 2, w, h);
        bg.lineStyle(1, 0xe03030);
        bg.strokeRect(cx - w / 2, cy - h / 2, w, h);
        bg.setDepth(10001);

        this.add.text(cx, cy, label, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5).setDepth(10002);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(10003);
        zone.on('pointerdown', callback);
    }
}

export default BattleSceneA;
