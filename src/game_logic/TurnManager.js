/**
 * 턴 진행 관리
 * 페이즈 정의는 phases CSV에서 로드
 */

class TurnManager {
    constructor(store, phases = []) {
        this.store = store;

        // phases CSV에서 로드, 없으면 기본값
        if (phases.length > 0) {
            this.PHASES = phases.map(p => p.id);
            this.PHASE_NAMES_KO = {};
            this.PHASE_DESCRIPTIONS_KO = {};
            for (const p of phases) {
                this.PHASE_NAMES_KO[p.id] = p.name_ko;
                this.PHASE_DESCRIPTIONS_KO[p.id] = p.description;
            }
        } else {
            this.PHASES = ['morning', 'day', 'evening', 'night'];
            this.PHASE_NAMES_KO = { morning: '아침', day: '낮', evening: '저녁', night: '밤' };
            this.PHASE_DESCRIPTIONS_KO = { morning: '소식 & 이벤트', day: '거점 운영', evening: '원정 결과', night: '적 습격' };
        }

        this._initState();
    }

    _initState() {
        this.store.setState('turn', {
            day: 1,
            phaseIndex: 0,
            phase: this.PHASES[0]
        });
    }

    getCurrentTurn() {
        return this.store.getState('turn');
    }

    getPhaseName() {
        const { phase } = this.getCurrentTurn();
        return this.PHASE_NAMES_KO[phase];
    }

    getPhaseDescription() {
        const { phase } = this.getCurrentTurn();
        return this.PHASE_DESCRIPTIONS_KO[phase];
    }

    advancePhase() {
        const turn = this.getCurrentTurn();
        const nextIndex = turn.phaseIndex + 1;

        if (nextIndex >= this.PHASES.length) {
            this.store.setState('turn', {
                day: turn.day + 1,
                phaseIndex: 0,
                phase: this.PHASES[0]
            });
        } else {
            this.store.setState('turn', {
                day: turn.day,
                phaseIndex: nextIndex,
                phase: this.PHASES[nextIndex]
            });
        }

        return this.getCurrentTurn();
    }

    isNightPhase() {
        return this.getCurrentTurn().phase === 'night';
    }
}

export default TurnManager;
