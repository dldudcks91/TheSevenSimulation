/**
 * BattleFormationPopup — 출정 전 배치 팝업
 *
 * 영웅을 4×3 격자에 드래그 배치 + 병사 배분 (+/-버튼)
 * [출발] → BattleSceneA 실행 / [취소] → onClose 호출
 *
 * init(data):
 *   stageName      string
 *   heroes         Hero[]       출전 가능 영웅 목록
 *   totalSoldiers  number       배분 가능한 총 병사 수
 *   enemies        Enemy[]      적 데이터 (BattleSceneA로 전달)
 *   balance        object       BattleEngine 주입 데이터
 *   onClose        function     취소 콜백
 */
import Phaser from 'phaser';
import { topSin } from '../game_logic/SinUtils.js';
import { FONT, FONT_BOLD } from '../constants.js';

const W = 1280;
const H = 720;

// 격자 설정
const GRID_COLS = 4;
const GRID_ROWS = 3;
const CELL_W = 100;
const CELL_H = 105;

// 죄종 컬러 (hex number)
const SIN_HEX = {
    wrath:    0xf06060,
    envy:     0x50d070,
    greed:    0xe0c040,
    sloth:    0x9098a8,
    gluttony: 0xf08030,
    lust:     0xf050a0,
    pride:    0xa060f0,
};
const SIN_CSS = {
    wrath: '#f06060', envy: '#50d070', greed: '#e0c040',
    sloth: '#9098a8', gluttony: '#f08030', lust: '#f050a0', pride: '#a060f0',
};

class BattleFormationPopup extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleFormationPopup' });
    }

    init(data) {
        this.stageName     = data.stageName    || '전투';
        this.heroes        = data.heroes       || [];
        this.totalSoldiers = data.totalSoldiers ?? 0;
        this.enemies       = data.enemies      || [];
        this.balance       = data.balance      || {};
        this.onClose       = data.onClose      || (() => {});
        // BattleSceneA 닫기 시 호출 (onClose와 별개)
        this.onBattleEnd   = data.onBattleEnd  || (() => {});
    }

    create() {
        this.events.once('shutdown', () => this._cleanup());

        // ── 패널 레이아웃 ──────────────────────────────
        const panelW = 960;
        const panelH = 580;
        const panelX = (W - panelW) / 2;   // 160
        const panelY = (H - panelH) / 2;   // 70

        // 배경 딤 + 패널
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72);
        const panelG = this.add.graphics();
        panelG.fillStyle(0x0e0e1a, 0.97);
        panelG.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
        panelG.lineStyle(2, 0x303058);
        panelG.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

        // 제목
        this.add.text(W / 2, panelY + 26, `출정 준비 — ${this.stageName}`, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: '#e8e8f0',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // ── 영역 좌표 계산 ─────────────────────────────
        const gridX  = panelX + 28;          // 배치판 좌상단 X
        const gridY  = panelY + 58;          // 배치판 좌상단 Y
        const listX  = gridX + GRID_COLS * CELL_W + 28;  // 영웅 목록 X
        const listY  = gridY;
        const soldierY = gridY + GRID_ROWS * CELL_H + 18;  // 병사 패널 Y

        // ── 상태 초기화 ────────────────────────────────
        // formation[row][col] = heroId | null
        this._formation = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
        // soldiers[heroId] = count
        this._soldiers = {};
        this.heroes.forEach(h => { this._soldiers[h.id] = 0; });

        // 카드 참조: heroId → { container, baseX, baseY, placed, gridRow, gridCol }
        this._heroCards = {};
        // 격자 셀: [{col, row, cx, cy, left, top, right, bottom, bg}]
        this._cells = [];

        this._dragging    = null;  // 드래그 중인 heroId
        this._dragSprX    = 0;
        this._dragSprY    = 0;

        // ── 그리기 ─────────────────────────────────────
        this._drawGrid(gridX, gridY);
        this._drawHeroList(listX, listY);
        this._soldierPanelX = gridX;
        this._soldierPanelY = soldierY;
        this._soldierPanelW = panelW - 56;
        this._soldierContainer = this.add.container(0, 0);
        this._drawSoldierPanel();
        this._drawBottomBar(panelX, panelY, panelW, panelH);

        // 전역 포인터 이벤트
        this.input.on('pointermove', p => this._onMove(p));
        this.input.on('pointerup',   p => this._onUp(p));
    }

    // ═══════════════════════════════════════════════
    // 격자 렌더링
    // ═══════════════════════════════════════════════

    _drawGrid(gx, gy) {
        // 레이블
        this.add.text(gx + (GRID_COLS * CELL_W) / 2, gy - 18,
            '← 후열                          전열 →', {
            fontSize: '10px', fontFamily: FONT, color: '#505070'
        }).setOrigin(0.5);

        this.add.text(gx - 4, gy + (GRID_ROWS * CELL_H) / 2, '배치판', {
            fontSize: '9px', fontFamily: FONT, color: '#404060'
        }).setOrigin(0.5).setAngle(-90);

        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const left   = gx + col * CELL_W + 2;
                const top    = gy + row * CELL_H + 2;
                const right  = left + CELL_W - 4;
                const bottom = top  + CELL_H - 4;
                const cx     = left + (CELL_W - 4) / 2;
                const cy     = top  + (CELL_H - 4) / 2;

                const bg = this.add.graphics();
                this._fillCell(bg, left, top, CELL_W - 4, CELL_H - 4, false, false);

                // 열 번호 (작게)
                this.add.text(right - 2, top + 2, `${col}`, {
                    fontSize: '8px', fontFamily: FONT, color: '#252540'
                }).setOrigin(1, 0);

                this._cells.push({ col, row, cx, cy, left, top, right, bottom, bg });
            }
        }
    }

    _fillCell(g, left, top, w, h, hover, occupied) {
        g.clear();
        if (hover && !occupied) {
            g.fillStyle(0x203060, 0.9);
            g.lineStyle(2, 0x4060d0, 1);
        } else if (occupied) {
            g.fillStyle(0x182818, 0.9);
            g.lineStyle(1, 0x305030, 0.7);
        } else {
            g.fillStyle(0x141428, 0.9);
            g.lineStyle(1, 0x262646, 0.8);
        }
        g.fillRect(left, top, w, h);
        g.strokeRect(left, top, w, h);
    }

    // ═══════════════════════════════════════════════
    // 영웅 목록
    // ═══════════════════════════════════════════════

    _drawHeroList(lx, ly) {
        this.add.text(lx + 64, ly - 18, '편성 가능 영웅', {
            fontSize: '10px', fontFamily: FONT, color: '#505070'
        }).setOrigin(0.5);

        this.heroes.forEach((hero, i) => {
            const cx = lx + 64;
            const cy = ly + i * 64 + 28;
            this._createHeroCard(hero, cx, cy);
        });
    }

    _createHeroCard(hero, cx, cy) {
        const cw = 128, ch = 48;
        const sin = topSin(hero.sinStats) || 'wrath';
        const sinHex = SIN_HEX[sin] || 0x606080;
        const sinCss = SIN_CSS[sin] || '#606080';

        const container = this.add.container(cx, cy);

        const bg = this.add.graphics();
        bg.fillStyle(0x1a1a30, 1);
        bg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 4);
        bg.lineStyle(1, sinHex, 0.5);
        bg.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 4);
        container.add(bg);

        const nameT = this.add.text(0, -8, hero.name, {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);
        container.add(nameT);

        const sinT = this.add.text(0, 8, `[${sin}]`, {
            fontSize: '9px', fontFamily: FONT, color: sinCss
        }).setOrigin(0.5);
        container.add(sinT);

        // 드래그 히트 영역
        const zone = this.add.rectangle(0, 0, cw, ch, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        container.add(zone);

        zone.on('pointerdown', ptr => this._startDrag(hero.id, ptr));

        this._heroCards[hero.id] = {
            container,
            bg,
            baseX: cx,
            baseY: cy,
            placed: false,
            gridRow: -1,
            gridCol: -1,
            hero,
        };
    }

    // ═══════════════════════════════════════════════
    // 드래그 & 드롭
    // ═══════════════════════════════════════════════

    _startDrag(heroId, ptr) {
        const card = this._heroCards[heroId];
        if (!card) return;

        // 이미 배치된 경우 격자에서 제거
        if (card.placed) {
            this._formation[card.gridRow][card.gridCol] = null;
            card.placed  = false;
            card.gridRow = -1;
            card.gridCol = -1;
            this._refreshCells();
            this._drawSoldierPanel();
        }

        this._dragging = heroId;
        card.container.setDepth(1000);
    }

    _onMove(ptr) {
        if (!this._dragging) return;
        const card = this._heroCards[this._dragging];
        if (!card) return;

        card.container.setPosition(ptr.x, ptr.y);
        this._refreshCells(ptr.x, ptr.y);
    }

    _onUp(ptr) {
        if (!this._dragging) return;
        const heroId = this._dragging;
        this._dragging = null;

        const card = this._heroCards[heroId];
        if (!card) return;

        const cell = this._hitCell(ptr.x, ptr.y);
        if (cell && !this._formation[cell.row][cell.col]) {
            // 배치 성공
            this._formation[cell.row][cell.col] = heroId;
            card.placed  = true;
            card.gridRow = cell.row;
            card.gridCol = cell.col;
            card.container.setPosition(cell.cx, cell.cy).setDepth(10);
            this._drawSoldierPanel();
        } else {
            // 원위치 복귀
            card.container.setPosition(card.baseX, card.baseY).setDepth(0);
        }

        this._refreshCells();
    }

    _hitCell(px, py) {
        for (const c of this._cells) {
            if (px >= c.left && px <= c.right && py >= c.top && py <= c.bottom) {
                return c;
            }
        }
        return null;
    }

    _refreshCells(hoverX, hoverY) {
        for (const c of this._cells) {
            const occupied = !!this._formation[c.row][c.col];
            const isHover  = (hoverX !== undefined)
                && hoverX >= c.left && hoverX <= c.right
                && hoverY >= c.top  && hoverY <= c.bottom;
            this._fillCell(c.bg, c.left, c.top, CELL_W - 4, CELL_H - 4, isHover, occupied);
        }
    }

    // ═══════════════════════════════════════════════
    // 병사 배분 패널
    // ═══════════════════════════════════════════════

    _drawSoldierPanel() {
        this._soldierContainer.removeAll(true);

        const px = this._soldierPanelX;
        const py = this._soldierPanelY;

        const totalAllocated = Object.values(this._soldiers).reduce((a, b) => a + b, 0);
        const remain = this.totalSoldiers - totalAllocated;

        const headerT = this.add.text(px, py,
            `병사 배분  (총 ${this.totalSoldiers}명 / 잔여 ${remain}명)`, {
            fontSize: '11px', fontFamily: FONT, color: '#606080'
        });
        this._soldierContainer.add(headerT);

        const placedHeroes = this.heroes.filter(h => this._heroCards[h.id]?.placed);

        if (placedHeroes.length === 0) {
            const hint = this.add.text(px, py + 24,
                '영웅을 배치하면 병사를 배분할 수 있습니다.', {
                fontSize: '10px', fontFamily: FONT, color: '#404060'
            });
            this._soldierContainer.add(hint);
            return;
        }

        placedHeroes.forEach((hero, i) => {
            const sx = px + i * 210;
            const sy = py + 22;
            const count = this._soldiers[hero.id] ?? 0;

            const nameT = this.add.text(sx, sy, hero.name, {
                fontSize: '10px', fontFamily: FONT, color: '#a0a0c0'
            });
            this._soldierContainer.add(nameT);

            const minusBtn = this.add.text(sx + 80, sy, '[-]', {
                fontSize: '12px', fontFamily: FONT, color: '#e03030'
            }).setInteractive({ useHandCursor: true });
            minusBtn.on('pointerdown', () => {
                if ((this._soldiers[hero.id] ?? 0) > 0) {
                    this._soldiers[hero.id]--;
                    this._drawSoldierPanel();
                }
            });
            this._soldierContainer.add(minusBtn);

            const countT = this.add.text(sx + 110, sy, `${count}명`, {
                fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
            }).setOrigin(0.5, 0);
            this._soldierContainer.add(countT);

            const plusBtn = this.add.text(sx + 136, sy, '[+]', {
                fontSize: '12px', fontFamily: FONT, color: '#40d870'
            }).setInteractive({ useHandCursor: true });
            plusBtn.on('pointerdown', () => {
                const used = Object.values(this._soldiers).reduce((a, b) => a + b, 0);
                if (used < this.totalSoldiers) {
                    this._soldiers[hero.id] = (this._soldiers[hero.id] ?? 0) + 1;
                    this._drawSoldierPanel();
                }
            });
            this._soldierContainer.add(plusBtn);
        });
    }

    // ═══════════════════════════════════════════════
    // 하단 버튼
    // ═══════════════════════════════════════════════

    _drawBottomBar(panelX, panelY, panelW, panelH) {
        const btnY = panelY + panelH - 32;

        this.add.text(panelX + panelW / 2 - 90, btnY, '[  취소  ]', {
            fontSize: '13px', fontFamily: FONT, color: '#606080'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.onClose();
                this.scene.stop('BattleFormationPopup');
            });

        this.add.text(panelX + panelW / 2 + 90, btnY, '[  출발 ▶  ]', {
            fontSize: '13px', fontFamily: FONT, color: '#40d870'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._confirm());
    }

    // ═══════════════════════════════════════════════
    // 출발 확정
    // ═══════════════════════════════════════════════

    _confirm() {
        const placedHeroes = this.heroes.filter(h => this._heroCards[h.id]?.placed);
        if (placedHeroes.length === 0) return;

        // 병사 0명 영웅도 포함 (HP=0이지만 전투 참여 — 즉시 퇴장 가능)
        // 각 영웅에 soldierCount를 maxHp로 주입
        const heroesWithHp = placedHeroes.map(h => ({
            ...h,
            maxHp: Math.max(1, this._soldiers[h.id] ?? 1),
        }));

        // formation: heroId → { col, row }
        const formation = {};
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const heroId = this._formation[row][col];
                if (heroId) formation[heroId] = { col, row };
            }
        }

        const onBattleEnd = this.onBattleEnd;
        this.scene.stop('BattleFormationPopup');
        this.scene.launch('BattleSceneA', {
            stageName:   this.stageName,
            heroes:      heroesWithHp,
            formation,
            enemies:     this.enemies,
            balance:     this.balance,
            onClose:     onBattleEnd,
        });
    }

    _cleanup() {
        this._cells = [];
        this._heroCards = {};
    }
}

export default BattleFormationPopup;
