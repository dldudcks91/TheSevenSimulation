/**
 * ExpeditionScene — 원정 맵 탐색 오버레이 (프로토타입)
 *
 * 두 가지 모드:
 *   'node' — STS 스타일 분기 노드 맵 (구름 가리기)
 *   'dice' — 직선 경로 + 1~3 주사위 이동
 *
 * 모드 전환: 우상단 [모드] 버튼 또는 HUD ⚙ 설정
 * 인게임 registry.get('expeditionMode') 로 모드 유지
 */
import Phaser from 'phaser';
import { FONT, FONT_BOLD } from '../constants.js';
import store from '../store/Store.js';
import ExpeditionNodeManager from '../game_logic/ExpeditionNodeManager.js';
import BattleEngine, { BATTLE_TYPES, BATTLE_MODES } from '../game_logic/BattleEngine.js';

const W = 1280;
const H = 720;
const TITLE_H = 44;
const STATUS_H = 48;
const D = 500; // base depth (모든 MapScene UI 위)

const NODE_COLORS = {
    start:  { bg: 0x1a301a, border: 0x40d870, text: '#40d870' },
    combat: { bg: 0x3a1a1a, border: 0xe03030, text: '#e03030' },
    event:  { bg: 0x1a2a3a, border: 0x40a0f8, text: '#40a0f8' },
    rest:   { bg: 0x1a3a1a, border: 0x40d870, text: '#40d870' },
    portal: { bg: 0x2a1a3a, border: 0xb040e0, text: '#b040e0' },
    boss:   { bg: 0x3a2a0a, border: 0xf8c830, text: '#f8c830' },
    fog:    { bg: 0x141420, border: 0x282838, text: '#303048' },
};

const CHAPTER_NAMES = ['', '불타는 전장', '뒤틀린 숲', '황금의 사막', '망각의 동토', '심연의 동굴', '타락한 궁전', '신의 폐허'];

class ExpeditionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ExpeditionScene' });
    }

    init(data) {
        // 재시작(restart) 시에도 hero/soldier 유지
        if (data.heroIds !== undefined) {
            this.registry.set('_expHeroIds', data.heroIds);
            this.registry.set('_expSoldiers', data.soldierCount ?? 0);
        }
        this._heroIds      = this.registry.get('_expHeroIds') || [];
        this._soldierCount = this.registry.get('_expSoldiers') ?? 0;
    }

    create() {
        this._nm    = new ExpeditionNodeManager(store);
        this._mode  = this.registry.get('expeditionMode') || 'node';
        this._bal   = this.registry.get('balance') || {};

        const exp     = store.getState('expedition') || {};
        this._chapter = exp.chapter || 1;

        this._drawBackground();
        this._drawTitleBar();
        this._drawStatusBar();

        if (this._mode === 'node') {
            this._drawNodeMap();
        } else {
            this._drawDiceBoard();
        }
    }

    // ═══════════════════════════════════
    // 배경 / 타이틀 바
    // ═══════════════════════════════════
    _drawBackground() {
        const bg = this.add.graphics().setDepth(D);
        bg.fillStyle(0x000000, 0.88);
        bg.fillRect(0, 0, W, H);
    }

    _drawTitleBar() {
        const g = this.add.graphics().setDepth(D + 1);
        g.fillStyle(0x0e0e1a, 1);
        g.fillRect(0, 0, W, TITLE_H);
        g.lineStyle(1, 0x303048);
        g.lineBetween(0, TITLE_H, W, TITLE_H);

        // 귀환 버튼
        this._btn(70, TITLE_H / 2, 110, 28, '◀ 귀환', '#a0a0c0', () => this._close());

        // 타이틀
        const chName = CHAPTER_NAMES[this._chapter] || '';
        this.add.text(W / 2, TITLE_H / 2, `⚔ 원정  챕터${this._chapter}: ${chName}`, {
            fontSize: '15px', fontFamily: FONT_BOLD, color: '#e8e8f0',
        }).setOrigin(0.5).setDepth(D + 2);

        // 모드 전환 버튼
        const modeLabel = this._mode === 'node' ? '📍 STS 노드' : '🎲 주사위';
        const modeBtn = this.add.text(W - 80, TITLE_H / 2, `[${modeLabel}]`, {
            fontSize: '12px', fontFamily: FONT, color: '#f8c830',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(D + 2);
        modeBtn.on('pointerdown', () => {
            this.registry.set('expeditionMode', this._mode === 'node' ? 'dice' : 'node');
            this.scene.restart();
        });
    }

    _drawStatusBar() {
        const y = H - STATUS_H;
        const g = this.add.graphics().setDepth(D + 1);
        g.fillStyle(0x0e0e1a, 1);
        g.fillRect(0, y, W, STATUS_H);
        g.lineStyle(1, 0x303048);
        g.lineBetween(0, y, W, y);

        const heroes = (store.getState('heroes') || []).filter(h => this._heroIds.includes(h.id));
        const names  = heroes.length ? heroes.map(h => h.name).join(', ') : '(선택 없음)';

        this.add.text(20, y + STATUS_H / 2, `영웅: ${names}`, {
            fontSize: '12px', fontFamily: FONT, color: '#a0a0c0',
        }).setOrigin(0, 0.5).setDepth(D + 2);

        this.add.text(W - 20, y + STATUS_H / 2,
            `원정 병사: ${this._soldierCount}명  |  거점 잔여: ${store.getState('soldiers') || 0}명`, {
            fontSize: '12px', fontFamily: FONT, color: '#a0a0c0',
        }).setOrigin(1, 0.5).setDepth(D + 2);
    }

    // ═══════════════════════════════════
    // STS 노드 맵 모드
    // ═══════════════════════════════════
    _drawNodeMap() {
        const allNodes = this._nm.generateNodeMap(this._chapter);
        const cleared  = new Set(this._nm.getClearedNodes());
        const checkpoint = this._nm.getCheckpoint();

        // 시작 노드 연결 공개
        this._nm.revealConnected('start', allNodes);
        const revealed = this._nm.getRevealedNodes();

        // 노드 좌표 계산
        const cx   = W / 2;
        const topY = TITLE_H + 60;
        const rowH = 96;
        const colW = 170;

        const pos = (node) => ({
            x: cx + (node.col - 1) * colW,
            y: topY + node.row * rowH,
        });

        // 연결선
        const lineG = this.add.graphics().setDepth(D + 2);
        lineG.lineStyle(1, 0x283038, 1);
        for (const node of allNodes) {
            const { x: nx, y: ny } = pos(node);
            for (const cId of node.connections) {
                const cn = allNodes.find(n => n.id === cId);
                if (!cn) continue;
                const { x: cx2, y: cy2 } = pos(cn);
                lineG.lineBetween(nx, ny, cx2, cy2);
            }
        }

        // 노드
        for (const node of allNodes) {
            const { x: nx, y: ny } = pos(node);
            const isCleared   = cleared.has(node.id);
            const isRevealed  = revealed.has(node.id);
            const isCheckpt   = checkpoint === node.id;
            const isAvailable = this._nm.isNodeAvailable(node, allNodes, cleared);
            this._drawNode(nx, ny, node, isRevealed, isCleared, isCheckpt, isAvailable, allNodes);
        }

        // 범례
        this._drawLegend(20, TITLE_H + 8);
    }

    _drawNode(x, y, node, isRevealed, isCleared, isCheckpt, isAvailable, allNodes) {
        const R     = 28;
        const cols  = isRevealed ? NODE_COLORS[node.type] : NODE_COLORS.fog;
        const borderColor = isCleared ? 0x282838
            : isCheckpt ? 0xd040f0
            : Phaser.Display.Color.HexStringToColor(cols.border).color;

        const g = this.add.graphics().setDepth(D + 3);
        g.fillStyle(isCleared ? 0x0a0a12 : cols.bg, 1);
        g.fillCircle(x, y, R);
        g.lineStyle(isCheckpt ? 3 : 1, borderColor, 1);
        g.strokeCircle(x, y, R);

        // 체크포인트 글로우
        if (isCheckpt) {
            const glow = this.add.graphics().setDepth(D + 2);
            glow.lineStyle(3, 0xb040e0, 0.4);
            glow.strokeCircle(x, y, R + 7);
        }

        // 아이콘 + 라벨
        const textColor = isCleared ? '#282838' : cols.text;
        this.add.text(x, y - 9, isRevealed ? node.icon : '?', {
            fontSize: '16px', fontFamily: FONT, color: isRevealed ? textColor : '#303048',
        }).setOrigin(0.5).setDepth(D + 4);

        this.add.text(x, y + 12, isRevealed ? node.label : '???', {
            fontSize: '9px', fontFamily: FONT, color: textColor,
        }).setOrigin(0.5).setDepth(D + 4);

        // 클리어 표시
        if (isCleared) {
            this.add.text(x, y, '✓', {
                fontSize: '18px', fontFamily: FONT_BOLD, color: '#303048',
            }).setOrigin(0.5).setDepth(D + 5);
        }

        // 인터랙션 (접근 가능 + 미클리어 + 공개)
        if (isAvailable && !isCleared && isRevealed) {
            const zone = this.add.zone(x, y, R * 2, R * 2)
                .setInteractive({ useHandCursor: true }).setDepth(D + 6);

            zone.on('pointerover', () => {
                g.clear();
                g.fillStyle(cols.bg, 1); g.fillCircle(x, y, R);
                g.lineStyle(2, 0xffffff, 1); g.strokeCircle(x, y, R);
            });
            zone.on('pointerout', () => {
                g.clear();
                g.fillStyle(cols.bg, 1); g.fillCircle(x, y, R);
                g.lineStyle(1, borderColor, 1); g.strokeCircle(x, y, R);
            });
            zone.on('pointerdown', () => this._onNodeClick(node, allNodes));
        }
    }

    _onNodeClick(node, allNodes) {
        this._nm.revealConnected(node.id, allNodes);

        switch (node.type) {
            case 'combat':
            case 'boss':
                this._resolveCombat(node.type === 'boss', () => {
                    this._nm.markCleared(node.id);
                    this.scene.restart();
                });
                break;
            case 'portal':
                this._nm.markCleared(node.id);
                this._nm.setCheckpoint(node.id);
                this._showToast('🌀 포탈 확보! 다음 원정은 여기서 출발합니다.', '#b040e0');
                this.time.delayedCall(1800, () => this.scene.restart());
                break;
            case 'rest':
                this._nm.markCleared(node.id);
                this._showToast('🏕 야영 — 영웅 사기 +10', '#40d870');
                this.time.delayedCall(1600, () => this.scene.restart());
                break;
            case 'event':
                this._nm.markCleared(node.id);
                this._showToast('? 조우 이벤트 발생 — (구현 예정)', '#40a0f8');
                this.time.delayedCall(1600, () => this.scene.restart());
                break;
        }
    }

    // ═══════════════════════════════════
    // 주사위 보드 모드
    // ═══════════════════════════════════
    _drawDiceBoard() {
        const path     = this._nm.generateDicePath(this._chapter);
        const pos      = this._nm.getDicePosition();
        const cleared  = new Set(this._nm.getClearedNodes());
        const checkpt  = this._nm.getCheckpoint();

        const tileW = 108;
        const tileH = 72;
        const gap   = 10;
        const totalW = path.length * tileW + (path.length - 1) * gap;
        const startX = (W - totalW) / 2;
        const tileY  = TITLE_H + (H - TITLE_H - STATUS_H) / 2 - 60;

        // 연결선
        const lineG = this.add.graphics().setDepth(D + 2);
        lineG.lineStyle(2, 0x283038);
        for (let i = 0; i < path.length - 1; i++) {
            const x1 = startX + i * (tileW + gap) + tileW;
            const x2 = startX + (i + 1) * (tileW + gap);
            lineG.lineBetween(x1, tileY + tileH / 2, x2, tileY + tileH / 2);
        }

        // 타일
        for (let i = 0; i < path.length; i++) {
            const tile = path[i];
            const tx   = startX + i * (tileW + gap);
            const isCur    = i === pos;
            const isClr    = cleared.has(tile.id);
            const isCheckpt = checkpt === tile.id;
            const cols     = NODE_COLORS[tile.type];

            const g = this.add.graphics().setDepth(D + 3);
            g.fillStyle(isClr ? 0x0a0a12 : cols.bg, 1);
            g.fillRoundedRect(tx, tileY, tileW, tileH, 6);
            g.lineStyle(
                isCheckpt ? 3 : isCur ? 2 : 1,
                isCheckpt ? 0xb040e0 : isCur ? 0xffffff : (isClr ? 0x282838 : Phaser.Display.Color.HexStringToColor(cols.border).color),
                1
            );
            g.strokeRoundedRect(tx, tileY, tileW, tileH, 6);

            const tcx = tx + tileW / 2;
            const tcy = tileY + tileH / 2;

            this.add.text(tcx, tcy - 13, tile.icon, {
                fontSize: '18px', fontFamily: FONT, color: isClr ? '#282838' : cols.text,
            }).setOrigin(0.5).setDepth(D + 4);

            this.add.text(tcx, tcy + 11, tile.label, {
                fontSize: '10px', fontFamily: FONT, color: isClr ? '#282838' : cols.text,
            }).setOrigin(0.5).setDepth(D + 4);

            if (isCur) {
                this.add.text(tcx, tileY - 22, '▼', {
                    fontSize: '14px', fontFamily: FONT_BOLD, color: '#f8c830',
                }).setOrigin(0.5).setDepth(D + 5);
            }
            if (isClr) {
                this.add.text(tcx, tcy, '✓', {
                    fontSize: '22px', fontFamily: FONT_BOLD, color: '#282838',
                }).setOrigin(0.5).setDepth(D + 5);
            }
        }

        // 주사위 버튼
        const btnY    = tileY + tileH + 50;
        const curTile = path[pos];
        const canRoll = curTile && !cleared.has(curTile.id) && pos < path.length - 1;

        this._btn(W / 2, btnY, 220, 44, '🎲  주사위 굴리기  (1~3)', canRoll ? '#f8c830' : '#404058',
            () => { if (canRoll) this._diceRoll(path, pos); });

        if (!canRoll && pos < path.length - 1) {
            this.add.text(W / 2, btnY + 36, '현재 칸을 먼저 처리하세요', {
                fontSize: '10px', fontFamily: FONT, color: '#a0a0c0',
            }).setOrigin(0.5).setDepth(D + 3);
        }

        // 범례
        this._drawLegend(20, TITLE_H + 8);
    }

    _diceRoll(path, curPos) {
        const roll   = this._nm.rollDice();
        const newPos = Math.min(curPos + roll, path.length - 1);
        const tile   = path[newPos];

        this._nm.setDicePosition(newPos);
        this._showToast(`🎲 ${roll}  →  ${tile.icon} ${tile.label}`, '#f8c830');

        this.time.delayedCall(1200, () => {
            switch (tile.type) {
                case 'combat':
                case 'boss':
                    this._resolveCombat(tile.type === 'boss', () => {
                        this._nm.markCleared(tile.id);
                        this.scene.restart();
                    });
                    break;
                case 'portal':
                    this._nm.setCheckpoint(tile.id);
                    this._nm.markCleared(tile.id);
                    this._showToast('🌀 포탈 확보!', '#b040e0');
                    this.time.delayedCall(1600, () => this.scene.restart());
                    break;
                case 'rest':
                    this._nm.markCleared(tile.id);
                    this._showToast('🏕 야영 — 사기 +10', '#40d870');
                    this.time.delayedCall(1600, () => this.scene.restart());
                    break;
                case 'event':
                    this._nm.markCleared(tile.id);
                    this._showToast('? 조우 이벤트 — (구현 예정)', '#40a0f8');
                    this.time.delayedCall(1600, () => this.scene.restart());
                    break;
                default:
                    this.scene.restart();
            }
        });
    }

    // ═══════════════════════════════════
    // 전투 해결 — BattleFormationPopup → BattleSceneA
    // ═══════════════════════════════════
    _resolveCombat(isBoss, onDone) {
        const heroes = (store.getState('heroes') || [])
            .filter(h => this._heroIds.includes(h.id));

        // 임시 적 데이터 (프로토타입)
        const enemies = isBoss
            ? [{ name: '보스', hp: 180, atk: 22, spd: 4 }, { name: '근위병', hp: 60, atk: 14, spd: 6 }]
            : [{ name: '전위병', hp: 70, atk: 11, spd: 5 }, { name: '궁수', hp: 55, atk: 13, spd: 7 }];

        const stageName = isBoss ? '보스 전투' : '전투';

        // BattleFormationPopup 실행
        // onClose: BattleSceneA 종료 시 → onDone 호출
        // BattleFormationPopup의 onClose는 '취소' 버튼 전용
        // BattleSceneA의 onClose는 _confirm()에서 별도로 주입
        this.scene.launch('BattleFormationPopup', {
            stageName,
            heroes,
            totalSoldiers: this._soldierCount,
            enemies,
            balance: this._bal,
            // 취소 시: 아무것도 하지 않음 (노드 클리어 없이 복귀)
            onClose: () => {},
            // BattleSceneA 닫기 버튼 → onDone 연결
            onBattleEnd: () => onDone({ victory: true }),
        });
    }

    _showCombatResult(result, isBoss, onDone) {
        const pw = 560;
        const ph = 320;
        const px = (W - pw) / 2;
        const py = (H - ph) / 2;

        const panelG = this.add.graphics().setDepth(D + 10);
        panelG.fillStyle(0x0e0e1a, 1);
        panelG.fillRoundedRect(px, py, pw, ph, 8);
        panelG.lineStyle(2, result.victory ? 0x40d870 : 0xe03030);
        panelG.strokeRoundedRect(px, py, pw, ph, 8);

        const title = result.victory
            ? (isBoss ? '👑 보스 격파!' : '⚔ 전투 승리')
            : '💀 전투 패배';
        const titleColor = result.victory ? '#40d870' : '#e03030';

        let y = py + 24;
        this.add.text(px + pw / 2, y, title, {
            fontSize: '18px', fontFamily: FONT_BOLD, color: titleColor,
        }).setOrigin(0.5).setDepth(D + 11);
        y += 36;

        this.add.text(px + pw / 2, y,
            `병사 손실: ${result.soldiersLost ?? 0}명  |  생존: ${result.soldiersSurvived ?? 0}명`, {
            fontSize: '12px', fontFamily: FONT, color: '#a0a0c0',
        }).setOrigin(0.5).setDepth(D + 11);
        y += 26;

        // 영웅 결과
        for (const hr of (result.heroResults || [])) {
            const statusColor = hr.alive ? '#e8e8f0' : '#e03030';
            const statusLabel = hr.alive ? '생존' : '부상';
            this.add.text(px + pw / 2, y, `${hr.name}  —  ${statusLabel}`, {
                fontSize: '11px', fontFamily: FONT, color: statusColor,
            }).setOrigin(0.5).setDepth(D + 11);
            y += 22;
        }

        y += 10;
        // 전투 로그 (최대 4줄)
        const logLines = (result.log || []).slice(0, 4);
        for (const line of logLines) {
            this.add.text(px + 20, y, `• ${line}`, {
                fontSize: '10px', fontFamily: FONT, color: '#606080',
            }).setDepth(D + 11);
            y += 18;
        }

        // 확인 버튼
        this._btn(px + pw / 2, py + ph - 28, 120, 32, '확인', '#f8c830', () => {
            panelG.destroy();
            this.children.each(c => {
                if (c.depth >= D + 10 && c !== panelG) c.destroy();
            });
            onDone(result);
        });
    }

    // ═══════════════════════════════════
    // 공통 UI 헬퍼
    // ═══════════════════════════════════
    _btn(x, y, w, h, label, color, cb) {
        const g = this.add.graphics().setDepth(D + 3);
        g.fillStyle(0x161624, 1);
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
        g.lineStyle(1, 0x404060);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);

        this.add.text(x, y, label, {
            fontSize: '13px', fontFamily: FONT, color,
        }).setOrigin(0.5).setDepth(D + 4);

        const zone = this.add.zone(x, y, w, h)
            .setInteractive({ useHandCursor: true }).setDepth(D + 5);
        zone.on('pointerdown', cb);
        return zone;
    }

    _showToast(msg, color = '#f8c830') {
        // 기존 토스트 제거
        this._toastGroup?.forEach(o => o.destroy());
        this._toastGroup = [];

        const tw = 480;
        const th = 48;
        const tx = (W - tw) / 2;
        const ty = H / 2 - 24;

        const bg = this.add.graphics().setDepth(D + 20);
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(tx, ty, tw, th, 6);

        const txt = this.add.text(W / 2, ty + th / 2, msg, {
            fontSize: '14px', fontFamily: FONT_BOLD, color,
        }).setOrigin(0.5).setDepth(D + 21);

        this._toastGroup = [bg, txt];
    }

    _drawLegend(x, y) {
        const items = [
            { icon: '⚔', label: '전투', color: '#e03030' },
            { icon: '?',  label: '조우', color: '#40a0f8' },
            { icon: '🏕', label: '야영', color: '#40d870' },
            { icon: '🌀', label: '포탈', color: '#b040e0' },
            { icon: '💀', label: '보스', color: '#f8c830' },
        ];
        let lx = x;
        for (const item of items) {
            this.add.text(lx, y, `${item.icon} ${item.label}`, {
                fontSize: '10px', fontFamily: FONT, color: item.color,
            }).setDepth(D + 2);
            lx += 90;
        }
    }

    // ═══════════════════════════════════
    // 씬 종료
    // ═══════════════════════════════════
    _close() {
        const mapScene = this.scene.get('MapScene');
        this.scene.stop('ExpeditionScene');
        if (mapScene) {
            this.scene.resume('MapScene');
            mapScene.bottomPanel?.refreshActiveTab();
        }
    }
}

export default ExpeditionScene;
