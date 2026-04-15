/**
 * BattleSceneA — 4×3 격자 오토배틀
 *
 * 아군(4×3) vs 적군(4×3) 격자 전투.
 * 틱마다 1칸 이동, 전열(col3↔col0) 인접 시 자동 공격.
 * BattleFormationPopup에서 formation 데이터를 받아 초기 배치.
 *
 * 모드: realtime (engine tick) / replay (log 재생)
 */
import { BATTLE_MODES, BATTLE_TYPES } from '../game_logic/BattleEngine.js';
import BattleEngine from '../game_logic/BattleEngine.js';
import { topSin } from '../game_logic/SinUtils.js';
import SpriteRenderer from './SpriteRenderer.js';
import { FONT, FONT_BOLD } from '../constants.js';
import {
    FRAME_SIZE, ANIM_FPS, SHEET_CONFIG, DIR_EAST, DIR_WEST,
    DEFAULT_SPRITE, MONSTER_SPRITES, BOSS_SPRITES,
    pickEnemySprite, SIN_SPRITE_MAP, HERO_SPRITE_TYPES,
} from './SpriteConstants.js';

// ── 격자 상수 ────────────────────────────────────
const GRID_COLS  = 4;
const GRID_ROWS  = 3;
const CELL_W     = 150;
const CELL_H     = 155;
const HEADER_H   = 52;
const GRID_PAD   = 6;
const GRID_Y     = HEADER_H + GRID_PAD;          // 58
const ALLY_GX    = 20;                            // 아군 격자 좌단 X
const ENEMY_GX   = ALLY_GX + GRID_COLS * CELL_W + 40;  // 660
const LOG_Y      = GRID_Y + GRID_ROWS * CELL_H;  // 58 + 465 = 523

// ── 스프라이트 ───────────────────────────────────
const SPRITE_SCALE = 1.5;
const DISPLAY_SIZE = FRAME_SIZE * SPRITE_SCALE;

// ── 틱 ──────────────────────────────────────────
const TICK_MS = 500;

// ── 죄종 이름 컬러 ───────────────────────────────
const SIN_NAME_COLORS = {
    wrath: '#f06060', envy: '#50d070', greed: '#e0c040',
    sloth: '#9098a8', gluttony: '#f08030', lust: '#f050a0', pride: '#a060f0',
};

class BattleSceneA extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleSceneA' });
    }

    init(data) {
        this.stageName    = data.stageName    || '전투';
        this.onClose      = data.onClose      || (() => {});
        this.speed        = 1;
        this.paused       = false;
        this.heroData     = data.heroes       || [];
        this.formation    = data.formation    || {};  // { heroId: { col, row } }
        this.enemyData    = data.enemies      || [];
        this.balance      = data.balance      || {};

        // 리플레이 모드
        this.engine       = data.engine       || null;
        this.battleLog    = data.log          || null;
        this.victory      = data.victory;

        this._mode = this.engine ? 'realtime' : 'replay';
    }

    preload() {
        const types = [
            'warrior_male', 'warrior_female', 'base_male', 'base_female',
            ...HERO_SPRITE_TYPES,
            ...MONSTER_SPRITES,
            ...BOSS_SPRITES,
        ];
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

        // 런타임 합성 파츠 프리로드
        this._spriteRenderer = new SpriteRenderer(this);
        for (const hero of this.heroData) {
            if (hero.appearance?.layers) {
                this._spriteRenderer.preloadAppearance(hero.appearance, `hero_${hero.id}`);
            }
        }
    }

    create() {
        this.events.once('shutdown', () => this._cleanup());

        const { width, height } = this.scale;
        this._createAnimations();

        // 런타임 합성 실행
        this._composedHeroes = {};
        for (const hero of this.heroData) {
            if (hero.appearance?.layers) {
                const heroId = `hero_${hero.id}`;
                this._composedHeroes[hero.name] =
                    this._spriteRenderer.compose(hero.appearance, heroId);
            }
        }

        // ── 배경 ─────────────────────────────────
        this._drawBackground(width, height);

        // ── 격자 ─────────────────────────────────
        this._drawGrid();

        // ── 헤더 ─────────────────────────────────
        this.add.text(width / 2, HEADER_H / 2, this.stageName, {
            fontSize: '14px', fontFamily: FONT_BOLD, color: '#e03030',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this._currentRound = 0;
        this._roundText = this.add.text(width - 30, HEADER_H / 2, '', {
            fontSize: '11px', fontFamily: FONT, color: '#606080'
        }).setOrigin(1, 0.5);

        // ── 로그 패널 ─────────────────────────────
        const logG = this.add.graphics();
        logG.fillStyle(0x08080e, 0.88);
        logG.fillRoundedRect(20, LOG_Y + 4, width - 40, 78, 4);
        logG.lineStyle(1, 0x20203a, 0.6);
        logG.strokeRoundedRect(20, LOG_Y + 4, width - 40, 78, 4);

        this.add.text(30, LOG_Y + 8, '전투 로그', {
            fontSize: '8px', fontFamily: FONT, color: '#404060'
        });
        this.logText = this.add.text(30, LOG_Y + 20, '', {
            fontSize: '9px', fontFamily: FONT, color: '#a0a0c0',
            lineSpacing: 3, wordWrap: { width: width - 80 }
        });
        this._logLines = [];

        // ── 컨트롤 ───────────────────────────────
        this._drawControls(width);

        // ── 일기토 오버레이 초기화 ────────────────
        this._duelOverlay  = null;
        this._duelActive   = false;

        // ── 유닛 맵 ──────────────────────────────
        this.units = {};  // name → unit object

        // ── 초기화 ────────────────────────────────
        if (this._mode === 'realtime') {
            this._initRealtime();
        } else {
            this._initReplay();
        }

        this._tickAccumulator = 0;
        this._resultShown     = false;
    }

    update(time, delta) {
        if (this._resultShown || this.paused) return;

        // 격자 이동 (일기토 중 제외)
        if (!this._duelActive) {
            this._updateGridMovement();
        }

        // 틱 처리
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

    // ═══════════════════════════════════════════════
    // 격자 렌더링
    // ═══════════════════════════════════════════════

    _drawGrid() {
        const g = this.add.graphics();

        // 아군 격자
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const rx = ALLY_GX + col * CELL_W;
                const ry = GRID_Y + row * CELL_H;
                g.fillStyle(0x0e1020, 0.7);
                g.fillRect(rx + 1, ry + 1, CELL_W - 2, CELL_H - 2);
                g.lineStyle(1, 0x1e2040, 0.5);
                g.strokeRect(rx + 1, ry + 1, CELL_W - 2, CELL_H - 2);
            }
        }

        // 적군 격자
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const rx = ENEMY_GX + col * CELL_W;
                const ry = GRID_Y + row * CELL_H;
                g.fillStyle(0x200e0e, 0.7);
                g.fillRect(rx + 1, ry + 1, CELL_W - 2, CELL_H - 2);
                g.lineStyle(1, 0x401e1e, 0.5);
                g.strokeRect(rx + 1, ry + 1, CELL_W - 2, CELL_H - 2);
            }
        }

        // 중앙 구분선
        const centerX = ALLY_GX + GRID_COLS * CELL_W + 20;
        g.lineStyle(2, 0x303050, 0.8);
        g.lineBetween(centerX, GRID_Y, centerX, GRID_Y + GRID_ROWS * CELL_H);

        // 레이블
        this.add.text(ALLY_GX + GRID_COLS * CELL_W / 2, GRID_Y - 14,
            '← 후열             전열 →', {
            fontSize: '9px', fontFamily: FONT, color: '#303050'
        }).setOrigin(0.5);

        this.add.text(ENEMY_GX + GRID_COLS * CELL_W / 2, GRID_Y - 14,
            '← 전열             후열 →', {
            fontSize: '9px', fontFamily: FONT, color: '#503030'
        }).setOrigin(0.5);
    }

    // ── 셀 픽셀 중앙 좌표 ─────────────────────────
    _cellCX(side, col) {
        const gx = side === 'ally' ? ALLY_GX : ENEMY_GX;
        return gx + col * CELL_W + CELL_W / 2;
    }

    _cellCY(row) {
        return GRID_Y + row * CELL_H + CELL_H / 2;
    }

    // ═══════════════════════════════════════════════
    // 격자 이동 (틱마다 1칸)
    // ═══════════════════════════════════════════════

    _updateGridMovement() {
        // 이미 이동 트윈 중인 유닛은 skip
        for (const name of Object.keys(this.units)) {
            const unit = this.units[name];
            if (!unit.alive || unit.moving) continue;

            // 가장 가까운 적 탐색
            const target = this._nearestEnemy(unit);
            if (!target) continue;

            // 인접 여부 체크
            if (this._isAdjacent(unit, target)) continue;

            // 1칸 이동 방향 결정
            const dir = this._moveDir(unit, target);
            if (!dir) continue;

            const newCol = unit.gridCol + dir.dc;
            const newRow = unit.gridRow + dir.dr;

            // 아군 칸 충돌 체크
            if (this._cellOccupied(unit.side, newCol, newRow, name)) continue;

            // 격자 범위 체크
            if (newCol < 0 || newCol >= GRID_COLS) continue;
            if (newRow < 0 || newRow >= GRID_ROWS) continue;

            // 위치 갱신 + 트윈
            unit.gridCol = newCol;
            unit.gridRow = newRow;

            const tx = this._cellCX(unit.side, newCol);
            const ty = this._cellCY(newRow);
            unit.moving = true;

            const moveDur = Math.max(80, 280 / this.speed);
            this.tweens.add({
                targets: unit.container,
                x: tx, y: ty,
                duration: moveDur,
                ease: 'Power1',
                onComplete: () => {
                    unit.moving = false;
                    unit.screenX = tx;
                    unit.screenY = ty;
                }
            });

            // 걷기 애니메이션 (이동 방향에 따라)
            if (unit.sprite && !unit.useComposed) {
                const walkDir = (unit.side === 'ally') ? DIR_EAST : DIR_WEST;
                const walkKey = `${unit.spriteType}_walk_${walkDir}`;
                if (this.anims.exists(walkKey)) unit.sprite.play(walkKey, true);
            }
        }
    }

    /** 가장 가까운 적 유닛 */
    _nearestEnemy(unit) {
        const enemySide = unit.side === 'ally' ? 'enemy' : 'ally';
        let nearest = null;
        let minDist  = Infinity;

        for (const name of Object.keys(this.units)) {
            const other = this.units[name];
            if (!other.alive || other.side !== enemySide) continue;
            const dist = this._gridDist(unit, other);
            if (dist < minDist) { minDist = dist; nearest = other; }
        }
        return nearest;
    }

    _gridDist(a, b) {
        // 아군 col3 ↔ 적군 col0 가 인접. 통합 거리 계산.
        const ax = a.side === 'ally' ? a.gridCol : (GRID_COLS * 2 + 1 - a.gridCol);
        const bx = b.side === 'ally' ? b.gridCol : (GRID_COLS * 2 + 1 - b.gridCol);
        return Math.abs(ax - bx) + Math.abs(a.gridRow - b.gridRow);
    }

    /** 아군 col3 ↔ 적군 col0, 같은 행 → 인접 */
    _isAdjacent(unit, target) {
        if (unit.side === 'ally' && target.side === 'enemy') {
            return unit.gridCol === GRID_COLS - 1 && target.gridCol === 0
                && unit.gridRow === target.gridRow;
        }
        if (unit.side === 'enemy' && target.side === 'ally') {
            return unit.gridCol === 0 && target.gridCol === GRID_COLS - 1
                && unit.gridRow === target.gridRow;
        }
        return false;
    }

    /** 이동 방향 결정 — X축(전열) 우선, 막히면 Y축 */
    _moveDir(unit, target) {
        // X 방향: ally → col 증가, enemy → col 감소
        const xDir = unit.side === 'ally' ? 1 : -1;

        // 전열에 도달하지 않았으면 전진
        const atFront = unit.side === 'ally'
            ? unit.gridCol >= GRID_COLS - 1
            : unit.gridCol <= 0;

        if (!atFront) {
            return { dc: xDir, dr: 0 };
        }

        // 전열 도달 → 행 정렬
        if (unit.gridRow < target.gridRow) return { dc: 0, dr: 1 };
        if (unit.gridRow > target.gridRow) return { dc: 0, dr: -1 };

        return null; // 같은 행이지만 적이 아직 전열에 없음 → 대기
    }

    /** 해당 칸을 같은 편 유닛이 점거 중인지 */
    _cellOccupied(side, col, row, excludeName) {
        for (const name of Object.keys(this.units)) {
            if (name === excludeName) continue;
            const u = this.units[name];
            if (!u.alive || u.side !== side) continue;
            if (u.gridCol === col && u.gridRow === row) return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════
    // 실시간 모드
    // ═══════════════════════════════════════════════

    _initRealtime() {
        // engine이 없으면 직접 생성
        if (!this.engine) {
            this.engine = new BattleEngine(this.balance);
            this.engine.init(
                this.heroData,
                this.enemyData,
                BATTLE_TYPES.EXPEDITION,
                0,
                BATTLE_MODES.MELEE
            );
        }

        const unitsData = this.engine.getUnits();

        // 아군 배치 (formation 우선, 없으면 순서대로)
        unitsData.heroes.forEach((u, i) => {
            const heroInfo = this.heroData.find(h => h.name === u.name);
            const heroId   = heroInfo ? `hero_${heroInfo.id}` : null;
            const composed = this._composedHeroes[u.name];
            const sin      = topSin(u.sinStats) || u.primarySin;
            const spriteType = composed
                ? heroId
                : (SIN_SPRITE_MAP[sin] || DEFAULT_SPRITE);

            // formation에서 위치 가져오기
            const pos = heroInfo ? this.formation[heroInfo.id] : null;
            const col = pos ? pos.col : Math.min(i, GRID_COLS - 1);
            const row = pos ? pos.row : (i % GRID_ROWS);

            this._createUnit(u.name, 'ally', col, row, spriteType, true,
                u.maxHp, !!composed, sin);
        });

        // 적군 배치 (고정 패턴)
        unitsData.enemies.forEach((u, i) => {
            const spriteType = pickEnemySprite(u.name, i);
            const col = 0;  // 전열부터 시작
            const row = i % GRID_ROWS;
            this._createUnit(u.name, 'enemy', col, row, spriteType, false,
                u.maxHp, false, null);
        });

        this._addLog('[격자 전투 시작]');
    }

    _tickRealtime() {
        if (this.engine.isFinished()) {
            this._showResult(this.engine.getResult().victory);
            return;
        }
        const events = this.engine.tick();
        if (!events) return;
        const arr = Array.isArray(events) ? events : [events];
        for (const evt of arr) this._processEvent(evt);
    }

    // ═══════════════════════════════════════════════
    // 리플레이 모드
    // ═══════════════════════════════════════════════

    _initReplay() {
        this._logIndex = 0;
        const startEntry = this.battleLog?.find(e => e.type === 'start');
        if (!startEntry) return;

        startEntry.heroes.forEach((name, i) => {
            const heroInfo   = this.heroData.find(h => h.name === name);
            const sin        = heroInfo ? topSin(heroInfo.sinStats) : null;
            const spriteType = SIN_SPRITE_MAP[sin] || DEFAULT_SPRITE;
            const pos = heroInfo ? this.formation[heroInfo.id] : null;
            const col = pos ? pos.col : Math.min(i, GRID_COLS - 1);
            const row = pos ? pos.row : (i % GRID_ROWS);
            this._createUnit(name, 'ally', col, row, spriteType, true, 100, false, sin);
        });

        startEntry.enemies.forEach((name, i) => {
            const spriteType = pickEnemySprite(name, i);
            this._createUnit(name, 'enemy', 0, i % GRID_ROWS, spriteType, false, 100, false, null);
        });

        this._addLog('[격자 전투 시작]');
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

    // ═══════════════════════════════════════════════
    // 이벤트 처리
    // ═══════════════════════════════════════════════

    _processEvent(evt) {
        if (evt.round && evt.round !== this._currentRound) {
            this._currentRound = evt.round;
            this._roundText.setText(`R${this._currentRound}`);
        }

        switch (evt.type) {
            case 'start':
                break;

            case 'attack':
                this._animateAttack(evt);
                this._addLog(
                    `R${evt.round}  ${evt.attacker} → ${evt.defender}  -${evt.damage}`,
                    '#c0c0d0'
                );
                break;

            case 'defeat':
                if (evt.isHero) {
                    this._animateDefeat(evt);
                    this._addLog(`▼ ${evt.name} 쓰러졌다!`, '#f04040');
                } else if (!evt.isSoldier) {
                    this._animateDefeat(evt);
                    this._addLog(`★ ${evt.name} 격파!`, '#40d870');
                }
                break;

            case 'duel_start':
                this._startDuelVisual(evt);
                this._addLog(`⚔ ${evt.hero.name} ↔ ${evt.enemy.name} 일기토!`, '#f8c830');
                break;

            case 'duel_refused':
                this._addLog(`✗ ${evt.enemy.name}(이)가 일기토를 거부!`, '#f08040');
                break;

            case 'duel_end':
                this._endDuelVisual(evt);
                if (evt.heroWon) {
                    this._addLog(`⚔ 일기토 승리! ${evt.winner}`, '#40d870');
                } else {
                    this._addLog(`⚔ 일기토 패배... ${evt.winner}`, '#f04040');
                }
                break;

            case 'result':
                break;
        }
    }

    // ═══════════════════════════════════════════════
    // 유닛 생성
    // ═══════════════════════════════════════════════

    _createUnit(name, side, gridCol, gridRow, spriteType, isHero, maxHp,
                useComposed = false, primarySin = null) {

        const sx = this._cellCX(side, gridCol);
        const sy = this._cellCY(gridRow);

        const container = this.add.container(sx, sy);

        // 스프라이트
        let sprite;
        const dir = side === 'ally' ? DIR_EAST : DIR_WEST;
        if (useComposed) {
            const idleKey = `composed_${spriteType}_idle`;
            sprite = this.add.sprite(0, 0, idleKey, 0);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle`);
        } else {
            sprite = this.add.sprite(0, 0, `${spriteType}_idle`);
            sprite.setScale(SPRITE_SCALE);
            sprite.play(`${spriteType}_idle_${dir}`);
        }
        container.add(sprite);

        const halfH = DISPLAY_SIZE / 2;

        // HP 바
        const hpBarW = DISPLAY_SIZE + 12;
        const hpBarH = 6;
        const hpBarY = -halfH - 10;

        const hpBorder = this.add.graphics();
        hpBorder.lineStyle(1, 0x606080, 0.5);
        hpBorder.strokeRect(-hpBarW / 2 - 1, hpBarY - hpBarH / 2 - 1, hpBarW + 2, hpBarH + 2);
        container.add(hpBorder);

        const hpBg = this.add.rectangle(0, hpBarY, hpBarW, hpBarH, 0x1a1a2a);
        container.add(hpBg);

        const hpBar = this.add.rectangle(
            -hpBarW / 2, hpBarY, hpBarW, hpBarH,
            isHero ? 0x40d870 : 0xe03030
        );
        hpBar.setOrigin(0, 0.5);
        container.add(hpBar);

        // 이름
        const nameColor = isHero
            ? (SIN_NAME_COLORS[primarySin] || '#a0c0f0')
            : '#f0a0a0';
        const nameText = this.add.text(0, halfH + 4, name, {
            fontSize: '9px', fontFamily: FONT, color: nameColor
        }).setOrigin(0.5);
        container.add(nameText);

        container.setDepth(sy);

        this.units[name] = {
            name,
            container,
            sprite,
            hpBar,
            hpBg,
            nameText,
            side,
            gridCol,
            gridRow,
            screenX: sx,
            screenY: sy,
            maxHp: maxHp || 100,
            maxHpBarWidth: hpBarW,
            alive: true,
            moving: false,
            isHero,
            spriteType,
            useComposed,
            primarySin,
        };
    }

    // ═══════════════════════════════════════════════
    // 일기토 시각 연출
    // ═══════════════════════════════════════════════

    _startDuelVisual(evt) {
        this._duelActive = true;
        const { width, height } = this.scale;
        const duelY = GRID_Y + (GRID_ROWS * CELL_H) / 2;

        this._duelOverlay = this.add.container(0, 0).setDepth(5000);

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this._duelOverlay.add(bg);

        const vsText = this.add.text(width / 2, duelY - 80, '⚔ 일기토 ⚔', {
            fontSize: '22px', fontFamily: FONT_BOLD, color: '#f8c830',
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
        }).setOrigin(0.5).setScale(0.1);
        this._duelOverlay.add(vsText);
        this.tweens.add({ targets: vsText, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });

        const heroName  = this.add.text(width / 2 - 110, duelY - 50, evt.hero?.name || '', {
            fontSize: '12px', fontFamily: FONT, color: '#a0c0f0'
        }).setOrigin(0.5).setAlpha(0);
        const vsLabel   = this.add.text(width / 2, duelY - 50, 'VS', {
            fontSize: '13px', fontFamily: FONT, color: '#e03030'
        }).setOrigin(0.5).setAlpha(0);
        const enemyName = this.add.text(width / 2 + 110, duelY - 50, evt.enemy?.name || '', {
            fontSize: '12px', fontFamily: FONT, color: '#f0a0a0'
        }).setOrigin(0.5).setAlpha(0);
        this._duelOverlay.add([heroName, vsLabel, enemyName]);
        this.tweens.add({ targets: [heroName, vsLabel, enemyName], alpha: 1, duration: 300, delay: 200 });

        // 비참가 유닛 어둡게
        for (const name of Object.keys(this.units)) {
            const u = this.units[name];
            if (name !== evt.hero?.name && name !== evt.enemy?.name) {
                u.container.setAlpha(0.15);
            }
        }

        // 참가자 중앙 이동
        const heroUnit  = this.units[evt.hero?.name];
        const enemyUnit = this.units[evt.enemy?.name];
        if (heroUnit) {
            heroUnit._savedScreenX = heroUnit.screenX;
            heroUnit._savedScreenY = heroUnit.screenY;
            this.tweens.add({ targets: heroUnit.container, x: width / 2 - 110, y: duelY, duration: 500, ease: 'Power2' });
            heroUnit.container.setDepth(5001);
        }
        if (enemyUnit) {
            enemyUnit._savedScreenX = enemyUnit.screenX;
            enemyUnit._savedScreenY = enemyUnit.screenY;
            this.tweens.add({ targets: enemyUnit.container, x: width / 2 + 110, y: duelY, duration: 500, ease: 'Power2' });
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
            const u = this.units[name];
            u.container.setAlpha(u.alive ? 1 : 0.3);
            u.container.setDepth(u.screenY);
            if (u._savedScreenX !== undefined) {
                u.screenX = u._savedScreenX;
                u.screenY = u._savedScreenY;
                u.container.setPosition(u.screenX, u.screenY);
                delete u._savedScreenX;
                delete u._savedScreenY;
            }
        }
    }

    // ═══════════════════════════════════════════════
    // 전투 애니메이션
    // ═══════════════════════════════════════════════

    _animateAttack(entry) {
        const attacker = this.units[entry.attacker];
        const defender = this.units[entry.defender];
        if (!attacker || !defender) return;

        const dir      = attacker.side === 'ally' ? DIR_EAST : DIR_WEST;
        const slashKey = attacker.useComposed
            ? `${attacker.spriteType}_slash`
            : `${attacker.spriteType}_slash_${dir}`;
        const idleKey  = attacker.useComposed
            ? `${attacker.spriteType}_idle`
            : `${attacker.spriteType}_idle_${dir}`;

        if (this.anims.exists(slashKey)) {
            attacker.sprite.play(slashKey);
            attacker.sprite.once('animationcomplete', () => {
                if (attacker.alive && this.anims.exists(idleKey)) {
                    attacker.sprite.play(idleKey);
                }
            });
        }

        // 돌진 트윈 (상대 방향으로 살짝)
        const dashX = attacker.side === 'ally' ? 22 : -22;
        const durMs = Math.max(50, 140 / this.speed);
        this.tweens.add({
            targets: attacker.container,
            x: attacker.container.x + dashX,
            duration: durMs, yoyo: true, ease: 'Power2',
            onComplete: () => {
                attacker.container.setPosition(attacker.screenX, attacker.screenY);
            }
        });

        // 피격
        this.time.delayedCall(durMs, () => {
            if (!defender.alive) return;

            // hurt 애니메이션
            const defDir    = defender.side === 'ally' ? DIR_EAST : DIR_WEST;
            const hurtKey   = `${defender.spriteType}_hurt`;
            const defIdle   = defender.useComposed
                ? `${defender.spriteType}_idle`
                : `${defender.spriteType}_idle_${defDir}`;
            if (this.anims.exists(hurtKey)) {
                defender.sprite.play(hurtKey);
                defender.sprite.once('animationcomplete', () => {
                    if (defender.alive && this.anims.exists(defIdle)) {
                        defender.sprite.play(defIdle);
                    }
                });
            }

            // 넉백
            const kb = defender.side === 'ally' ? -8 : 8;
            this.tweens.add({
                targets: defender.container,
                x: defender.container.x + kb,
                duration: 50, yoyo: true,
                onComplete: () => {
                    defender.container.setPosition(defender.screenX, defender.screenY);
                }
            });

            // HP 갱신
            const maxHp    = entry.maxHp || defender.maxHp || 100;
            const hpPct    = Math.max(0, entry.remainHp / maxHp);
            defender.hpBar.width = Math.max(0, hpPct * defender.maxHpBarWidth);
            defender.hpBar.setFillStyle(this._hpColor(hpPct, defender.isHero));

            // 데미지 텍스트
            const dmgRatio = entry.damage / maxHp;
            const fontSize = dmgRatio >= 0.3 ? '18px' : dmgRatio >= 0.15 ? '14px' : '11px';
            const dmgText  = this.add.text(
                defender.screenX, defender.screenY - 55,
                `-${entry.damage}`, {
                    fontSize, fontFamily: FONT, color: '#f04040',
                    shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
                }
            ).setOrigin(0.5).setDepth(9999);

            this.tweens.add({
                targets: dmgText,
                y: dmgText.y - 30, alpha: 0,
                duration: 600, ease: 'Power2',
                onComplete: () => dmgText.destroy()
            });
        });
    }

    _animateDefeat(entry) {
        const unit = this.units[entry.name];
        if (!unit) return;

        unit.alive = false;
        unit.hpBar.width = 0;

        const hurtKey = `${unit.spriteType}_hurt`;
        if (this.anims.exists(hurtKey)) {
            unit.sprite.play(hurtKey);
            unit.sprite.once('animationcomplete', () => unit.sprite.stop());
        }

        // 스케일 다운 + 페이드 아웃 후 격자에서 제거
        this.tweens.add({
            targets: unit.sprite,
            alpha: 0, scaleY: SPRITE_SCALE * 0.2,
            duration: 400,
        });
        this.tweens.add({
            targets: unit.nameText,
            alpha: 0, duration: 400
        });
        this.time.delayedCall(420, () => {
            unit.container.setVisible(false);
        });
    }

    // ═══════════════════════════════════════════════
    // 배경 / 컨트롤 / 결과
    // ═══════════════════════════════════════════════

    _drawBackground(width, height) {
        const bg = this.add.graphics();
        // 헤더
        bg.fillStyle(0x0a0a14, 1);
        bg.fillRect(0, 0, width, HEADER_H);
        // 전장 영역
        bg.fillStyle(0x0c0c18, 1);
        bg.fillRect(0, HEADER_H, width, GRID_ROWS * CELL_H + GRID_PAD * 2);
        // 로그/컨트롤 영역
        bg.fillStyle(0x08080e, 1);
        bg.fillRect(0, LOG_Y, width, height - LOG_Y);
        // 헤더 구분선
        bg.lineStyle(1, 0x1e1e30);
        bg.lineBetween(0, HEADER_H, width, HEADER_H);
    }

    _drawControls(width) {
        const btnY = LOG_Y + 84 + 18;

        this.pauseBtn = this.add.text(width - 200, btnY, '[ ⏸ 정지 ]', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.pauseBtn.on('pointerdown', () => {
            this.paused = !this.paused;
            this.pauseBtn.setText(this.paused ? '[ ▶ 시작 ]' : '[ ⏸ 정지 ]');
            this.pauseBtn.setColor(this.paused ? '#40d870' : '#a0a0c0');
        });

        this.speedBtn = this.add.text(width - 110, btnY, '[x1]', {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.speedBtn.on('pointerdown', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this.speedBtn.setText(`[x${this.speed}]`);
        });

        this.add.text(width - 40, btnY, '[스킵]', {
            fontSize: '11px', fontFamily: FONT, color: '#606080'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._skipToEnd());
    }

    _showResult(victory) {
        if (this._resultShown) return;
        this._resultShown = true;
        this.paused = true;

        const { width, height } = this.scale;

        const dimBg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0).setDepth(10000);
        this.tweens.add({ targets: dimBg, fillAlpha: 0.6, duration: 400 });

        const panelW = 360, panelH = 180;
        const px = (width - panelW) / 2;
        const py = (height - panelH) / 2 - 20;
        const borderColor = victory ? 0x40d870 : 0xe03030;

        const panelBg = this.add.graphics().setDepth(10001);
        panelBg.fillStyle(0x0a0a16, 0.95);
        panelBg.fillRoundedRect(px, py, panelW, panelH, 8);
        panelBg.lineStyle(2, borderColor);
        panelBg.strokeRoundedRect(px, py, panelW, panelH, 8);

        const resultText  = victory ? '승 리' : '패 배';
        const resultColor = victory ? '#40d870' : '#e03030';
        const titleText   = this.add.text(width / 2, py + 34, resultText, {
            fontSize: '36px', fontFamily: FONT_BOLD, color: resultColor,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
        }).setOrigin(0.5).setDepth(10002).setScale(0.1);
        this.tweens.add({ targets: titleText, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.easeOut' });

        const aliveHeroes    = Object.values(this.units).filter(u => u.isHero && u.alive).length;
        const totalHeroes    = Object.values(this.units).filter(u => u.isHero).length;
        const defeatedEnemies = Object.values(this.units).filter(u => !u.isHero && !u.alive).length;
        const totalEnemies   = Object.values(this.units).filter(u => !u.isHero).length;

        const st = { fontSize: '11px', fontFamily: FONT, color: '#a0a0c0' };
        let sy = py + 78;
        this.add.text(px + 28, sy, '아군 생존', st).setDepth(10002);
        this.add.text(px + panelW - 28, sy, `${aliveHeroes} / ${totalHeroes}`, {
            ...st, color: aliveHeroes > 0 ? '#40d870' : '#e03030'
        }).setOrigin(1, 0).setDepth(10002);

        sy += 22;
        this.add.text(px + 28, sy, '적 격파', st).setDepth(10002);
        this.add.text(px + panelW - 28, sy, `${defeatedEnemies} / ${totalEnemies}`, {
            ...st, color: '#f8c830'
        }).setOrigin(1, 0).setDepth(10002);

        this._createBtn(width / 2, py + panelH - 26, '닫 기', () => {
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
                            unit.hpBar.width = 0;
                            unit.container.setVisible(false);
                        }
                    }
                    if (evt.type === 'attack' && !evt.attackerIsSoldier) {
                        const def = this.units[evt.defender];
                        if (def?.alive) {
                            const maxHp = evt.maxHp || def.maxHp || 100;
                            const pct   = Math.max(0, evt.remainHp / maxHp);
                            def.hpBar.width = Math.max(0, pct * def.maxHpBarWidth);
                        }
                    }
                }
            }
            if (this._duelOverlay) { this._duelOverlay.destroy(); this._duelOverlay = null; }
            this._duelActive = false;
            for (const name of Object.keys(this.units)) this.units[name].container.setAlpha(1);
            this._showResult(this.engine.getResult().victory);
        } else {
            while (this._logIndex < this.battleLog.length) {
                const entry = this.battleLog[this._logIndex++];
                if (entry.type === 'defeat' && !entry.isSoldier) {
                    const unit = this.units[entry.name];
                    if (unit) { unit.alive = false; unit.container.setVisible(false); }
                }
            }
            this._showResult(this.victory);
        }
    }

    // ═══════════════════════════════════════════════
    // 애니메이션 정의
    // ═══════════════════════════════════════════════

    _createAnimations() {
        const oldTypes = [
            'warrior_male', 'warrior_female', 'base_male', 'base_female',
            ...MONSTER_SPRITES, ...BOSS_SPRITES,
        ];
        const dirs = [DIR_EAST, DIR_WEST];

        for (const type of oldTypes) {
            for (const dir of dirs) {
                const dirStr = dir === DIR_EAST ? 'east' : 'west';

                const idleKey = `${type}_idle_${dirStr}`;
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

                const walkKey = `${type}_walk_${dirStr}`;
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

                const slashKey = `${type}_slash_${dirStr}`;
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

        // 영웅 스프라이트 (단일 행)
        for (const type of HERO_SPRITE_TYPES) {
            for (const dirStr of ['east', 'west']) {
                const idleKey = `${type}_idle_${dirStr}`;
                if (!this.anims.exists(idleKey)) {
                    this.anims.create({
                        key: idleKey,
                        frames: this.anims.generateFrameNumbers(`${type}_idle`, {
                            start: 0, end: SHEET_CONFIG.idle.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const walkKey = `${type}_walk_${dirStr}`;
                if (!this.anims.exists(walkKey)) {
                    this.anims.create({
                        key: walkKey,
                        frames: this.anims.generateFrameNumbers(`${type}_walk`, {
                            start: 0, end: SHEET_CONFIG.walk.frames - 1
                        }),
                        frameRate: ANIM_FPS, repeat: -1
                    });
                }

                const slashKey = `${type}_slash_${dirStr}`;
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
                        start: SHEET_CONFIG.slash.frames - 2,
                        end:   SHEET_CONFIG.slash.frames - 1
                    }),
                    frameRate: ANIM_FPS * 1.5, repeat: 0
                });
            }
        }
    }

    // ═══════════════════════════════════════════════
    // 유틸
    // ═══════════════════════════════════════════════

    _addLog(msg, color) {
        this._logLines.push({ text: msg, color: color || '#a0a0c0' });
        if (this._logLines.length > 5) this._logLines.shift();
        this.logText.setText(this._logLines.map(l => l.text).join('\n'));
    }

    _hpColor(pct, isHero) {
        if (!isHero) return pct > 0.5 ? 0xe03030 : pct > 0.25 ? 0xc02020 : 0x901010;
        if (pct > 0.6) return 0x40d870;
        if (pct > 0.3) return 0xf0c030;
        return 0xe04040;
    }

    _createBtn(cx, cy, label, callback) {
        const w = 100, h = 28;
        const bg = this.add.graphics().setDepth(10001);
        bg.fillStyle(0x2a0808, 1);
        bg.fillRect(cx - w / 2, cy - h / 2, w, h);
        bg.lineStyle(1, 0xe03030);
        bg.strokeRect(cx - w / 2, cy - h / 2, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5).setDepth(10002);

        const zone = this.add.zone(cx, cy, w, h)
            .setInteractive({ useHandCursor: true }).setDepth(10003);
        zone.on('pointerdown', callback);
    }

    _cleanup() {
        this.tweens.killAll();
        if (this._duelOverlay) { this._duelOverlay.destroy(); this._duelOverlay = null; }
        if (this._composedHeroes) {
            for (const composed of Object.values(this._composedHeroes)) {
                for (const texKey of Object.values(composed)) {
                    if (this.textures.exists(texKey)) this.textures.remove(texKey);
                }
            }
            this._composedHeroes = {};
        }
        this.units = {};
    }
}

export default BattleSceneA;
