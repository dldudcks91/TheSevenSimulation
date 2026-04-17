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
    constructor(store, nodesData = null, diceData = null) {
        this.store = store;
        this._nodesData = nodesData || null; // { [chapter]: [nodes...] }
        this._diceData  = diceData  || null; // { [chapter]: [tiles...] }
    }

    // ═══════════════════════════════════
    // STS 노드 맵 생성
    // ═══════════════════════════════════

    /**
     * 챕터별 노드 맵 생성
     * CSV(expedition_nodes.csv) 우선, 없으면 기본 구조로 폴백
     * row 0 = 상단(보스), row 4 = 하단(시작점) / col 0/1/2 = 좌/중/우
     */
    generateNodeMap(chapter) {
        if (this._nodesData && this._nodesData[chapter]) {
            // 깊은 복제 (connections 배열 공유 방지)
            return this._nodesData[chapter].map(n => ({
                ...n,
                connections: [...(n.connections || [])],
            }));
        }
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

    /**
     * 챕터별 25칸 스네이크 경로 생성 (포탈 1개, 보스 마지막)
     * CSV(expedition_dice.csv) 우선, 없으면 기본 시퀀스로 폴백
     */
    generateDicePath(chapter) {
        if (this._diceData && this._diceData[chapter]) {
            return this._diceData[chapter].map(t => ({ ...t }));
        }
        const SEQ = [
            ['start',  '출발', '★'],
            ['combat', '전투', '⚔'],
            ['event',  '조우', '?'],
            ['combat', '전투', '⚔'],
            ['rest',   '야영', '🏕'],
            ['combat', '전투', '⚔'],
            ['event',  '조우', '?'],
            ['combat', '전투', '⚔'],
            ['rest',   '야영', '🏕'],
            ['combat', '전투', '⚔'],
            ['event',  '조우', '?'],
            ['rest',   '야영', '🏕'],
            ['portal', '포탈', '🌀'],
            ['combat', '전투', '⚔'],
            ['event',  '조우', '?'],
            ['combat', '전투', '⚔'],
            ['rest',   '야영', '🏕'],
            ['combat', '전투', '⚔'],
            ['event',  '조우', '?'],
            ['combat', '전투', '⚔'],
            ['rest',   '야영', '🏕'],
            ['combat', '전투', '⚔'],
            ['event',  '조우', '?'],
            ['combat', '전투', '⚔'],
            ['boss',   '보스', '💀'],
        ];
        return SEQ.map(([type, label, icon], i) => ({
            id: `tile_${i}`, type, index: i, label, icon,
        }));
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

    /**
     * 감시탑 레벨에 따라 START에서 N스텝 앞까지 미리 공개 (STS 노드 모드)
     *   Lv.0: 효과 없음
     *   Lv.1: +1 스텝
     *   Lv.2: +2 스텝
     *   Lv.3: 전체 공개
     */
    revealByWatchtower(level, allNodes) {
        if (!level || level <= 0) return;
        const exp = this.store.getState('expedition') || {};
        const revealed = new Set(exp.revealedNodes || ['start']);

        if (level >= 3) {
            for (const n of allNodes) revealed.add(n.id);
        } else {
            // BFS level-by-level from 'start'
            let frontier = ['start'];
            revealed.add('start');
            for (let step = 0; step < level; step++) {
                const next = [];
                for (const id of frontier) {
                    const node = allNodes.find(n => n.id === id);
                    if (!node) continue;
                    for (const cId of (node.connections || [])) {
                        if (!revealed.has(cId)) {
                            revealed.add(cId);
                            next.push(cId);
                        }
                    }
                }
                frontier = next;
                if (frontier.length === 0) break;
            }
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

    // ═══════════════════════════════════
    // 노드 결과 Store 반영
    // ═══════════════════════════════════

    /**
     * 전투 결과 Store 반영
     * - 영웅 부상 상태 (alive=false → status='injured')
     * - 영웅 HP 반영
     * - 승리/패배 시 sinStat 변동
     * @returns {object} { goldReward, sinDeltas, injuredIds[] }
     */
    applyCombatResult(heroIds, battleResult, isBoss, balance = {}) {
        const heroes = this.store.getState('heroes') || [];
        const day = this.store.getState('turn')?.day ?? 1;

        const injuredIds = [];
        for (const hr of (battleResult.heroResults || [])) {
            const hero = heroes.find(h => h.id === hr.id);
            if (!hero) continue;
            if (hr.hp !== undefined) hero.hp = hr.hp;
            if (hr.maxHp !== undefined) hero.maxHp = hr.maxHp;
            if (!hr.alive) {
                hero.status = 'injured';
                injuredIds.push(hero.id);
            }
        }
        this.store.setState('heroes', [...heroes]);

        let goldReward = 0;
        const sinDeltas = [];
        if (battleResult.victory) {
            const base = isBoss
                ? (balance.exp_node_boss_gold_base ?? 120)
                : (balance.exp_node_combat_gold_base ?? 40);
            const perDay = isBoss
                ? (balance.exp_node_boss_gold_per_day ?? 10)
                : (balance.exp_node_combat_gold_per_day ?? 4);
            goldReward = base + day * perDay;
            this.store.setState('gold', (this.store.getState('gold') || 0) + goldReward);

            // 승리: 분노 상승 (전투 충족), 교만 상승 (자신감)
            this._applySinDeltaToParty(heroIds, 'wrath', balance.wrath_combat_rise ?? 1);
            this._applySinDeltaToParty(heroIds, 'pride', balance.pride_combat_win_rise ?? 1);
            sinDeltas.push({ sinKey: 'wrath', delta: 1 }, { sinKey: 'pride', delta: 1 });
        } else {
            // 패배: 교만 하락
            this._applySinDeltaToParty(heroIds, 'pride', -(balance.pride_combat_lose_fall ?? 1));
            sinDeltas.push({ sinKey: 'pride', delta: -1 });
        }

        return { goldReward, sinDeltas, injuredIds };
    }

    /** 야영 노드 — 파티 영웅 sinStat 변동 */
    applyRestNode(heroIds, balance = {}) {
        // 야영: 나태 상승 (쉼), 폭식 상승 (먹고 쉬는 시간)
        this._applySinDeltaToParty(heroIds, 'sloth', balance.sloth_idle_rise ?? 1);
        this._applySinDeltaToParty(heroIds, 'gluttony', balance.gluttony_feast_rise ?? 1);
        return { sinDeltas: [{ sinKey: 'sloth', delta: 1 }, { sinKey: 'gluttony', delta: 1 }] };
    }

    /** 보스 격파 시 다음 챕터 해금 */
    advanceChapterOnBoss(balance = {}) {
        const exp = this.store.getState('expedition') || {};
        const maxChapters = balance.max_chapters ?? 7;
        const nextChapter = Math.min(maxChapters, (exp.chapter || 1) + 1);
        this.store.setState('expedition', {
            ...exp,
            chapter: nextChapter,
            progress: 0,
            clearedNodes: [],
            revealedNodes: [],
            nodeCheckpoint: null,
            dicePosition: 0,
        });
        return { newChapter: nextChapter };
    }

    /**
     * 귀환 — 원정 영웅을 거점 상태로 복구
     * @param {string[]} heroIds  원정 파티 영웅 id
     */
    finalizeReturn(heroIds) {
        const heroes = this.store.getState('heroes') || [];
        for (const id of heroIds) {
            const hero = heroes.find(h => h.id === id);
            if (!hero) continue;
            // 이미 injured면 유지, 아니면 idle 복귀
            if (hero.status === 'expedition') hero.status = 'idle';
            hero.location = 'base';
        }
        this.store.setState('heroes', [...heroes]);
    }

    /** 내부 헬퍼 — 파티 전원 sinStat 변동 */
    _applySinDeltaToParty(heroIds, sinKey, delta) {
        if (!delta || !sinKey) return;
        const heroes = this.store.getState('heroes') || [];
        for (const id of heroIds) {
            const hero = heroes.find(h => h.id === id);
            if (!hero?.sinStats || !(sinKey in hero.sinStats)) continue;
            hero.sinStats[sinKey] = Math.max(1, Math.min(20, (hero.sinStats[sinKey] ?? 1) + delta));
            hero.isRampaging = Object.values(hero.sinStats).some(v => v >= 18);
        }
        this.store.setState('heroes', [...heroes]);
    }
}

export default ExpeditionNodeManager;
