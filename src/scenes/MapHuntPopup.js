/**
 * MapHuntPopup — MapScene 위 1:1 사냥 전투 팝업
 *
 * DuelBattleScene의 전투 로직을 600x400 팝업으로 이식.
 * 별도 씬 전환 없이 MapScene 위에 오버레이.
 *
 * 사용법:
 *   const popup = new MapHuntPopup(scene, { hero, enemy, stageName, onComplete });
 *   popup.start();
 *   // scene.update에서: popup.update(time, delta);
 */
import BattleEngine, { BATTLE_TYPES } from '../game_logic/BattleEngine.js';
import { topSin } from '../game_logic/SinUtils.js';
import SpriteRenderer from './SpriteRenderer.js';
import { FONT } from '../constants.js';
import {
    FRAME_SIZE, ANIM_FPS, SHEET_CONFIG, DIR_EAST, DIR_WEST,
    DEFAULT_SPRITE, MONSTER_SPRITES, BOSS_SPRITES,
    pickEnemySprite, SIN_SPRITE_MAP, HERO_SPRITE_TYPES
} from './SpriteConstants.js';

const SPRITE_SCALE = 1.8;
const TICK_MS_DEFAULT = 700;

// 팝업 크기/위치
const POP_W = 600;
const POP_H = 400;

// 팝업 내 상대 좌표
const GROUND_Y = 160;
const HERO_X = 170;
const ENEMY_X = 430;

class MapHuntPopup {
    /**
     * @param {Phaser.Scene} scene - MapScene
     * @param {Object} config
     * @param {Object} config.hero - 영웅 객체
     * @param {Object} config.enemy - 적 객체 { name, hp, atk, spd }
     * @param {string} config.stageName
     * @param {Object} config.balance - 밸런스 데이터
     * @param {Function} config.onComplete - (result: { victory, heroResult, rounds }) => void
     */
    constructor(scene, config) {
        this.scene = scene;
        this.heroData = config.hero;
        this.enemyData = config.enemy;
        this.stageName = config.stageName || '사냥';
        this.onComplete = config.onComplete || (() => {});
        this.balance = config.balance || {};
        this._tickMs = Number(this.balance.battle_tick_ms) || TICK_MS_DEFAULT;

        this.active = false;
        this.paused = false;
        this.speed = 1;
        this._tickAccumulator = 0;
        this._resultShown = false;
        this._logLines = [];
        this._activeTimers = [];

        this._container = null;
        this._units = {};

        this.engine = new BattleEngine(this.balance);
    }

    // ═══════════════════════════════════
    // 시작 / 종료
    // ═══════════════════════════════════

    start() {
        this.active = true;
        const { width, height } = this.scene.scale;

        // 팝업 좌상단 좌표 (화면 중앙 배치)
        this._ox = Math.floor((width - POP_W) / 2);
        this._oy = Math.floor((height - POP_H) / 2);

        this._container = this.scene.add.container(0, 0).setDepth(4000);

        // 딤 배경
        this._dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);
        this._dim.setInteractive(); // 클릭 통과 방지
        this._container.add(this._dim);

        // 팝업 배경
        const popBg = this.scene.add.graphics();
        popBg.fillStyle(0x0a0a12, 0.95);
        popBg.fillRoundedRect(this._ox, this._oy, POP_W, POP_H, 8);
        popBg.lineStyle(2, 0x303048);
        popBg.strokeRoundedRect(this._ox, this._oy, POP_W, POP_H, 8);
        this._container.add(popBg);

        // 영웅 합성 스프라이트 생성
        this._composedHero = null;
        this._composedHeroId = null;
        if (this.heroData.appearance && this.heroData.appearance.layers) {
            const spriteRenderer = new SpriteRenderer(this.scene);
            const heroId = `hero_${this.heroData.id}`;
            this._composedHero = spriteRenderer.compose(this.heroData.appearance, heroId);
            this._composedHeroId = heroId;
        }

        // 내부 UI
        this._createAnimations();
        this._drawHeader();
        this._drawGround();
        this._drawLogPanel();
        this._drawControls();

        // 엔진 초기화 + 유닛 생성
        this.engine.init([this.heroData], [this.enemyData], BATTLE_TYPES.EXPEDITION);
        this._createHeroUnit();
        this._createEnemyUnit();

        this._addLog('[전투 시작]');
    }

    destroy() {
        this.active = false;
        // 진행 중인 tweens/timers 정리
        for (const u of Object.values(this._units)) {
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
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
        this._units = {};
        this._logLines = [];
        // 합성 텍스처는 재사용을 위해 보존 (같은 영웅이 재사냥할 수 있음)
        this._composedHero = null;
        this._composedHeroId = null;
    }

    // ═══════════════════════════════════
    // 업데이트 (MapScene.update에서 호출)
    // ═══════════════════════════════════

    update(time, delta) {
        if (!this.active || this._resultShown || this.paused) return;

        this._tickAccumulator += delta * this.speed;
        while (this._tickAccumulator >= this._tickMs) {
            this._tickAccumulator -= this._tickMs;
            this._tick();
            if (this._resultShown) break;
        }
    }

    // ═══════════════════════════════════
    // 전투 틱
    // ═══════════════════════════════════

    _tick() {
        if (this.engine.isFinished()) {
            this._showResult(this.engine.getResult().victory);
            return;
        }
        const events = this.engine.tick();
        if (!events) return;
        const eventArray = Array.isArray(events) ? events : [events];
        for (const evt of eventArray) this._processEvent(evt);
    }

    _processEvent(evt) {
        switch (evt.type) {
            case 'attack':
                this._animateAttack(evt);
                this._addLog(`R${evt.round} ${evt.attacker} → ${evt.defender}  -${evt.damage}hp (잔여 ${evt.remainHp})`);
                break;
            case 'defeat':
                this._animateDefeat(evt);
                this._addLog(evt.isHero ? `▼ ${evt.name} 쓰러졌다!` : `★ ${evt.name} 격파!`);
                break;
            case 'result': break;
        }
    }

    // ═══════════════════════════════════
    // UI 생성
    // ═══════════════════════════════════

    _drawHeader() {
        const cx = this._ox + POP_W / 2;
        const titleText = this.scene.add.text(cx, this._oy + 20, this.stageName, {
            fontSize: '14px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(titleText);

        // VS
        const vsText = this.scene.add.text(cx, this._oy + GROUND_Y - 45, 'VS', {
            fontSize: '22px', fontFamily: FONT, color: '#e03030',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setAlpha(0.3);
        this._container.add(vsText);
    }

    _drawGround() {
        const g = this.scene.add.graphics();
        const gx = this._ox + 30;
        const gy = this._oy + GROUND_Y + 25;
        const gw = POP_W - 60;

        g.fillStyle(0x1a2a1a, 1);
        g.fillRect(gx, gy, gw, 50);
        g.lineStyle(1, 0x2a3a2a);
        g.lineBetween(gx, gy, gx + gw, gy);

        for (let i = 0; i < 15; i++) {
            const px = gx + 10 + Math.random() * (gw - 20);
            const py = gy + 5 + Math.random() * 35;
            g.fillStyle(0x2a3a2a, 0.3 + Math.random() * 0.4);
            g.fillRect(px, py, 2, 2);
        }
        this._container.add(g);
    }

    _drawLogPanel() {
        const logX = this._ox + 20;
        const logY = this._oy + GROUND_Y + 85;
        const logW = POP_W - 40;
        const logH = 110;

        const g = this.scene.add.graphics();
        g.fillStyle(0x0e0e1a, 0.9);
        g.fillRect(logX, logY, logW, logH);
        g.lineStyle(1, 0x303048);
        g.strokeRect(logX, logY, logW, logH);
        this._container.add(g);

        const logLabel = this.scene.add.text(logX + 8, logY + 4, '[ 전투 로그 ]', {
            fontSize: '8px', fontFamily: FONT, color: '#606080'
        });
        this._container.add(logLabel);

        this._logText = this.scene.add.text(logX + 8, logY + 18, '', {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0',
            lineSpacing: 3, wordWrap: { width: logW - 16 }
        });
        this._container.add(this._logText);
    }

    _drawControls() {
        const cx = this._ox + POP_W / 2;
        const btnY = this._oy + POP_H - 22;

        // 정지
        this._pauseBtn = this.scene.add.text(cx - 80, btnY, '[ ⏸ 정지 ]', {
            fontSize: '10px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(4001);
        this._pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            this._pauseBtn.setText(this.paused ? '[ ▶ 시작 ]' : '[ ⏸ 정지 ]');
            this._pauseBtn.setColor(this.paused ? '#40d870' : '#a0a0c0');
        });
        this._container.add(this._pauseBtn);

        // 배속
        this._speedBtn = this.scene.add.text(cx, btnY, '[x1]', {
            fontSize: '10px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(4001);
        this._speedBtn.on('pointerdown', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this._speedBtn.setText(`[x${this.speed}]`);
        });
        this._container.add(this._speedBtn);

        // 스킵
        const skipBtn = this.scene.add.text(cx + 80, btnY, '[스킵]', {
            fontSize: '10px', fontFamily: FONT, color: '#606080'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(4001);
        skipBtn.on('pointerdown', () => this._skipToEnd());
        this._container.add(skipBtn);
    }

    // ═══════════════════════════════════
    // 유닛 생성
    // ═══════════════════════════════════

    _createHeroUnit() {
        const units = this.engine.getUnits();
        const heroUnit = units.heroes[0];
        const useComposed = !!this._composedHero;
        const spriteType = useComposed
            ? this._composedHeroId
            : (SIN_SPRITE_MAP[topSin(this.heroData.sinStats)] || DEFAULT_SPRITE);

        this._units.hero = this._createUnitDisplay(
            this.heroData.name, this._ox + HERO_X, this._oy + GROUND_Y,
            spriteType, true, heroUnit.maxHp, heroUnit.hp, useComposed
        );
    }

    _createEnemyUnit() {
        const spriteType = pickEnemySprite(this.enemyData.name);
        const units = this.engine.getUnits();
        const enemyUnit = units.enemies[0];

        this._units.enemy = this._createUnitDisplay(
            this.enemyData.name, this._ox + ENEMY_X, this._oy + GROUND_Y,
            spriteType, false, enemyUnit.maxHp, enemyUnit.hp
        );
    }

    _createUnitDisplay(name, x, y, spriteType, isHero, maxHp, currentHp, useComposed = false) {
        const container = this.scene.add.container(x, y);

        let sprite;
        if (useComposed) {
            const idleKey = `composed_${spriteType}_walk`;
            sprite = this.scene.add.sprite(0, 0, idleKey, 0);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle`);
        } else {
            const dir = isHero ? DIR_EAST : DIR_WEST;
            const dirName = isHero ? 'east' : 'west';
            this._ensureDirectionalIdle(spriteType, dirName, dir);
            sprite = this.scene.add.sprite(0, 0, `${spriteType}_idle`);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle_${dirName}`);
        }
        container.add(sprite);

        const halfH = (FRAME_SIZE * SPRITE_SCALE) / 2;

        // 이름
        const nameText = this.scene.add.text(0, -halfH - 32, name, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        container.add(nameText);

        // HP 바
        const HP_BAR_W = 90;
        const HP_BAR_H = 6;
        const hpBarY = -halfH - 16;

        const hpBg = this.scene.add.rectangle(0, hpBarY, HP_BAR_W, HP_BAR_H, 0x1a1a2a);
        container.add(hpBg);

        const hpColor = isHero ? 0x40d870 : 0xe03030;
        const hpBar = this.scene.add.rectangle(-HP_BAR_W / 2, hpBarY, HP_BAR_W, HP_BAR_H, hpColor);
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // HP 텍스트
        const hpText = this.scene.add.text(0, hpBarY + 10, `${currentHp}/${maxHp}`, {
            fontSize: '8px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5);
        container.add(hpText);

        this._container.add(container);

        return {
            container, sprite, hpBar, hpBg, nameText, hpText,
            baseX: x, baseY: y,
            maxHp, isHero, useComposed,
            hpBarWidth: HP_BAR_W,
            spriteType, alive: true
        };
    }

    _ensureDirectionalIdle(spriteType, dirName, dirRow) {
        const key = `${spriteType}_idle_${dirName}`;
        if (this.scene.anims.exists(key)) return;

        const config = SHEET_CONFIG.idle;
        // hero_* 스프라이트는 단일 행 (East만)
        const isHeroSprite = HERO_SPRITE_TYPES.includes(spriteType);
        const startFrame = isHeroSprite ? 0 : dirRow * config.frames;
        const endFrame = startFrame + config.frames - 1;

        this.scene.anims.create({
            key,
            frames: this.scene.anims.generateFrameNumbers(`${spriteType}_idle`, {
                start: startFrame, end: endFrame
            }),
            frameRate: ANIM_FPS, repeat: -1
        });
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

        let slashKey, idleKey;
        if (attacker.useComposed) {
            slashKey = `${attacker.spriteType}_slash`;
            idleKey = `${attacker.spriteType}_idle`;
        } else {
            const dirName = attacker.isHero ? 'east' : 'west';
            slashKey = `${attacker.spriteType}_slash_${dirName}`;
            idleKey = `${attacker.spriteType}_idle_${dirName}`;
            this._ensureSlash(attacker.spriteType, dirName);
        }

        attacker.sprite.play(slashKey);
        attacker.sprite.once('animationcomplete', () => {
            if (attacker.alive) attacker.sprite.play(idleKey);
        });

        // 돌진
        const dx = attacker.isHero ? 40 : -40;
        const duration = Math.max(60, 200 / this.speed);

        this.scene.tweens.add({
            targets: attacker.container,
            x: attacker.baseX + dx,
            duration, yoyo: true, ease: 'Power2'
        });

        // 피격
        const timer = this.scene.time.delayedCall(duration, () => {
            if (!this.active || !defender.alive) return;

            let hurtKey, defIdleKey;
            if (defender.useComposed) {
                hurtKey = `${defender.spriteType}_slash`;
                defIdleKey = `${defender.spriteType}_idle`;
            } else {
                hurtKey = `${defender.spriteType}_hurt`;
                defIdleKey = `${defender.spriteType}_idle_${defender.isHero ? 'east' : 'west'}`;
                this._ensureHurt(defender.spriteType);
            }

            defender.sprite.play(hurtKey);
            defender.sprite.once('animationcomplete', () => {
                if (defender.alive) defender.sprite.play(defIdleKey);
            });

            // 흔들림
            this.scene.tweens.add({
                targets: defender.container,
                x: defender.baseX + (defender.isHero ? -8 : 8),
                duration: 50, yoyo: true, repeat: 1
            });

            // HP
            const maxHp = evt.maxHp || defender.maxHp;
            const hpPercent = Math.max(0, evt.remainHp / maxHp);
            defender.hpBar.width = Math.max(0, hpPercent * defender.hpBarWidth);
            defender.hpText.setText(`${Math.max(0, evt.remainHp)}/${maxHp}`);

            // 데미지 텍스트
            const dmgText = this.scene.add.text(defender.baseX, defender.baseY - 60, `-${evt.damage}`, {
                fontSize: '16px', fontFamily: FONT, color: '#f04040',
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5).setDepth(9999);
            this._container.add(dmgText);

            this.scene.tweens.add({
                targets: dmgText,
                y: dmgText.y - 30, alpha: 0,
                duration: 600,
                onComplete: () => dmgText.destroy()
            });
        });
        this._activeTimers.push(timer);
    }

    _animateDefeat(evt) {
        const unit = this._getUnit(evt.name);
        if (!unit) return;

        unit.alive = false;
        unit.hpBar.width = 0;
        unit.hpText.setText('0/' + unit.maxHp);

        let hurtKey;
        if (unit.useComposed) {
            hurtKey = `${unit.spriteType}_slash`;
        } else {
            hurtKey = `${unit.spriteType}_hurt`;
            this._ensureHurt(unit.spriteType);
        }
        unit.sprite.play(hurtKey);
        unit.sprite.once('animationcomplete', () => unit.sprite.stop());

        this.scene.tweens.add({
            targets: unit.sprite,
            alpha: 0.3, scaleY: SPRITE_SCALE * 0.3,
            duration: 400
        });
        this.scene.tweens.add({
            targets: unit.nameText,
            alpha: 0.3, duration: 400
        });
    }

    // ═══════════════════════════════════
    // 결과 / 스킵
    // ═══════════════════════════════════

    _showResult(victory) {
        if (this._resultShown) return;
        this._resultShown = true;
        this.paused = true;

        const cx = this._ox + POP_W / 2;
        const cy = this._oy + POP_H / 2 - 20;

        const overlay = this.scene.add.rectangle(cx, cy, 240, 70, 0x0a0a12, 0.92);
        overlay.setStrokeStyle(2, victory ? 0x40d870 : 0xe03030);
        this._container.add(overlay);

        const resultText = victory ? '승 리' : '패 배';
        const resultColor = victory ? '#40d870' : '#e03030';

        const text = this.scene.add.text(cx, cy - 10, resultText, {
            fontSize: '22px', fontFamily: FONT, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(text);

        // 닫기 버튼
        const btnW = 90;
        const btnH = 24;
        const btnBg = this.scene.add.graphics();
        btnBg.fillStyle(0x2a0808, 1);
        btnBg.fillRect(cx - btnW / 2, cy + 10, btnW, btnH);
        btnBg.lineStyle(1, 0xe03030);
        btnBg.strokeRect(cx - btnW / 2, cy + 10, btnW, btnH);
        this._container.add(btnBg);

        const btnText = this.scene.add.text(cx, cy + 22, '닫 기', {
            fontSize: '10px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);
        this._container.add(btnText);

        const zone = this.scene.add.zone(cx, cy + 22, btnW, btnH)
            .setInteractive({ useHandCursor: true }).setDepth(10003);
        zone.on('pointerdown', () => {
            const result = this.engine.getResult();
            const onComp = this.onComplete;
            this.destroy();
            onComp({
                victory: result.victory,
                heroResult: result.heroResults[0] || null,
                rounds: result.rounds
            });
        });
        this._container.add(zone);
    }

    _skipToEnd() {
        while (!this.engine.isFinished()) {
            const events = this.engine.tick();
            if (!events) break;
            const evts = Array.isArray(events) ? events : [events];
            for (const evt of evts) {
                if (evt.type === 'attack') {
                    const defender = this._getUnit(evt.defender);
                    if (defender && defender.alive) {
                        const maxHp = evt.maxHp || defender.maxHp;
                        const hpPercent = Math.max(0, evt.remainHp / maxHp);
                        defender.hpBar.width = Math.max(0, hpPercent * defender.hpBarWidth);
                        defender.hpText.setText(`${Math.max(0, evt.remainHp)}/${maxHp}`);
                    }
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
    // 유틸
    // ═══════════════════════════════════

    _addLog(msg) {
        this._logLines.push(msg);
        if (this._logLines.length > 6) this._logLines.shift();
        if (this._logText) this._logText.setText(this._logLines.join('\n'));
    }

    // ═══════════════════════════════════
    // 애니메이션 보조
    // ═══════════════════════════════════

    _ensureSlash(spriteType, dirName) {
        const key = `${spriteType}_slash_${dirName}`;
        if (this.scene.anims.exists(key)) return;

        const cfg = SHEET_CONFIG.slash;
        const isHeroSprite = HERO_SPRITE_TYPES.includes(spriteType);
        const dirRow = dirName === 'east' ? DIR_EAST : DIR_WEST;
        const startFrame = isHeroSprite ? 0 : dirRow * cfg.frames;

        this.scene.anims.create({
            key,
            frames: this.scene.anims.generateFrameNumbers(`${spriteType}_slash`, {
                start: startFrame, end: startFrame + cfg.frames - 1
            }),
            frameRate: ANIM_FPS * 1.5, repeat: 0
        });
    }

    _ensureHurt(spriteType) {
        const key = `${spriteType}_hurt`;
        if (this.scene.anims.exists(key)) return;

        const isHeroSprite = HERO_SPRITE_TYPES.includes(spriteType);
        if (isHeroSprite) {
            // hero_* 에는 hurt 없음 → slash 마지막 프레임으로 대체
            this.scene.anims.create({
                key,
                frames: this.scene.anims.generateFrameNumbers(`${spriteType}_slash`, {
                    start: SHEET_CONFIG.slash.frames - 2, end: SHEET_CONFIG.slash.frames - 1
                }),
                frameRate: ANIM_FPS * 1.5, repeat: 0
            });
        } else {
            this.scene.anims.create({
                key,
                frames: this.scene.anims.generateFrameNumbers(`${spriteType}_hurt`, {
                    start: 0, end: SHEET_CONFIG.hurt.frames - 1
                }),
                frameRate: ANIM_FPS * 1.5, repeat: 0
            });
        }
    }

    _createAnimations() {
        // 합성 스프라이트 영웅은 SpriteRenderer.compose()에서 이미 애니메이션 생성됨
        if (!this._composedHero) {
            const heroSprite = SIN_SPRITE_MAP[topSin(this.heroData.sinStats)] || DEFAULT_SPRITE;
            this._ensureDirectionalIdle(heroSprite, 'east', DIR_EAST);
        }

        // 적 몬스터 idle 보장
        const enemySprite = pickEnemySprite(this.enemyData.name);
        this._ensureDirectionalIdle(enemySprite, 'west', DIR_WEST);
    }
}

export default MapHuntPopup;
