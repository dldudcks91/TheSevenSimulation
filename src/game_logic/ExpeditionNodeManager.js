/**
 * 원정 노드 매니저 — STS 노드 맵 / 주사위 순수 로직
 * Phaser 의존 없음 (Godot 이식 대상)
 *
 * 모드:
 *   'node' — STS 스타일 분기 노드 맵, 구름 가리기, 포탈 체크포인트
 *   'dice' — 직선 경로, 1~3 주사위로 이동, 포탈 체크포인트
 *
 * 포탈 규칙:
 *   포탈 도달 후 귀환 → 다음 원정에서 포탈 이후부터 시작
 *   포탈 미도달 귀환 → 다음 원정에서 처음부터 (포탈 이전 영구 클리어 유지)
 */
class ExpeditionNodeManager {
    constructor(store) {
        this.store = store;
    }

    // ═══════════════════════════════════
    // STS 노드 맵 생성
    // ═══════════════════════════════════

    /**
     * 챕터별 노드 맵 생성 (고정 구조)
     * row 0 = 상단(보스), row 4 = 하단(시작점)
     * col 0/1/2 = 좌/중/우
     */
    generateNodeMap(chapter) {
        return [
            { id: 'start',   type: 'start',  row: 4, col: 1, label: '출발',   icon: '★',  connections: ['n1a', 'n1b'] },
            { id: 'n1a',     type: 'combat', row: 3, col: 0, label: '전투',   icon: '⚔',  connections: ['portal1'] },
            { id: 'n1b',     type: 'event',  row: 3, col: 2, label: '조우',   icon: '?',  connections: ['portal1'] },
            { id: 'portal1', type: 'portal', row: 2, col: 1, label: '포탈',   icon: '🌀', connections: ['n2a', 'n2b'] },
            { id: 'n2a',     type: 'combat', row: 1, col: 0, label: '전투',   icon: '⚔',  connections: ['boss'] },
            { id: 'n2b',     type: 'rest',   row: 1, col: 2, label: '야영',   icon: '🏕', connections: ['boss'] },
            { id: 'boss',    type: 'boss',   row: 0, col: 1, label: '보스',   icon: '💀', connections: [] },
        ];
    }

    // ═══════════════════════════════════
    // 주사위 경로 생성
    // ═══════════════════════════════════

    /** 챕터별 직선 8칸 경로 생성 */
    generateDicePath(chapter) {
        return [
            { id: 'tile_0', type: 'start',  index: 0, label: '출발', icon: '★' },
            { id: 'tile_1', type: 'combat', index: 1, label: '전투', icon: '⚔' },
            { id: 'tile_2', type: 'event',  index: 2, label: '조우', icon: '?' },
            { id: 'tile_3', type: 'rest',   index: 3, label: '야영', icon: '🏕' },
            { id: 'tile_4', type: 'portal', index: 4, label: '포탈', icon: '🌀' },
            { id: 'tile_5', type: 'combat', index: 5, label: '전투', icon: '⚔' },
            { id: 'tile_6', type: 'event',  index: 6, label: '조우', icon: '?' },
            { id: 'tile_7', type: 'boss',   index: 7, label: '보스', icon: '💀' },
        ];
    }

    /** 1~3 주사위 굴리기 */
    rollDice() {
        return Math.ceil(Math.random() * 3);
    }

    // ═══════════════════════════════════
    // 포탈 체크포인트
    // ═══════════════════════════════════

    getCheckpoint() {
        const exp = this.store.getState('expedition') || {};
        return exp.nodeCheckpoint ?? null;
    }

    setCheckpoint(nodeId) {
        const exp = this.store.getState('expedition') || {};
        this.store.setState('expedition', { ...exp, nodeCheckpoint: nodeId });
    }

    clearCheckpoint() {
        const exp = this.store.getState('expedition') || {};
        this.store.setState('expedition', { ...exp, nodeCheckpoint: null });
    }

    // ═══════════════════════════════════
    // 클리어 노드 관리
    // ═══════════════════════════════════

    getClearedNodes() {
        const exp = this.store.getState('expedition') || {};
        return exp.clearedNodes || [];
    }

    markCleared(nodeId) {
        const exp = this.store.getState('expedition') || {};
        const cleared = new Set(exp.clearedNodes || []);
        cleared.add(nodeId);
        this.store.setState('expedition', { ...exp, clearedNodes: [...cleared] });
    }

    /**
     * 포탈 이후 노드 리셋 (포탈 이전은 영구 유지)
     * @param {string} portalNodeId  체크포인트 포탈 id
     * @param {Array}  allNodes      노드 목록 (순서 있음)
     */
    resetAfterPortal(portalNodeId, allNodes) {
        const exp = this.store.getState('expedition') || {};
        const cleared = exp.clearedNodes || [];
        const portalIdx = allNodes.findIndex(n => n.id === portalNodeId);
        if (portalIdx < 0) return;
        const keepIds = new Set(allNodes.slice(0, portalIdx + 1).map(n => n.id));
        this.store.setState('expedition', {
            ...exp,
            clearedNodes: cleared.filter(id => keepIds.has(id)),
        });
    }

    // ═══════════════════════════════════
    // 구름 가리기 (STS 노드 모드)
    // ═══════════════════════════════════

    getRevealedNodes() {
        const exp = this.store.getState('expedition') || {};
        return new Set(exp.revealedNodes || ['start', 'tile_0']);
    }

    /** nodeId 와 그 연결 노드들을 공개 */
    revealConnected(nodeId, allNodes) {
        const node = allNodes.find(n => n.id === nodeId);
        if (!node) return;
        const exp = this.store.getState('expedition') || {};
        const revealed = new Set(exp.revealedNodes || ['start', 'tile_0']);
        revealed.add(nodeId);
        for (const cId of (node.connections || [])) {
            revealed.add(cId);
        }
        this.store.setState('expedition', { ...exp, revealedNodes: [...revealed] });
    }

    // ═══════════════════════════════════
    // 주사위 모드 현재 위치
    // ═══════════════════════════════════

    getDicePosition() {
        const exp = this.store.getState('expedition') || {};
        return exp.dicePosition ?? 0;
    }

    setDicePosition(pos) {
        const exp = this.store.getState('expedition') || {};
        this.store.setState('expedition', { ...exp, dicePosition: pos });
    }

    // ═══════════════════════════════════
    // 헬퍼: 노드 접근 가능 여부 (STS 모드)
    // ═══════════════════════════════════

    isNodeAvailable(node, allNodes, clearedSet) {
        if (node.type === 'start') return true;
        for (const other of allNodes) {
            if (other.connections.includes(node.id) && clearedSet.has(other.id)) return true;
        }
        return false;
    }
}

export default ExpeditionNodeManager;
