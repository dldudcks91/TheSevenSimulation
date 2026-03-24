/**
 * 턴 진행 관리
 * 하루(1턴) = 아침 → 낮 → 저녁 → 밤, 4단계 순환
 */

const PHASES = ['morning', 'day', 'evening', 'night'];

const PHASE_NAMES_KO = {
    morning: '아침',
    day: '낮',
    evening: '저녁',
    night: '밤'
};

const PHASE_DESCRIPTIONS_KO = {
    morning: '소식 & 이벤트 — 판결의 시간',
    day: '거점 운영 & 원정 파견',
    evening: '원정 결과 & 습격 정보',
    night: '적 습격 & 결산'
};

class TurnManager {
    constructor(store) {
        this.store = store;
        this._initState();
    }

    _initState() {
        this.store.setState('turn', {
            day: 1,
            phaseIndex: 0,
            phase: PHASES[0]
        });
    }

    /** 현재 턴 정보 */
    getCurrentTurn() {
        return this.store.getState('turn');
    }

    /** 현재 페이즈 한글명 */
    getPhaseName() {
        const { phase } = this.getCurrentTurn();
        return PHASE_NAMES_KO[phase];
    }

    /** 현재 페이즈 설명 */
    getPhaseDescription() {
        const { phase } = this.getCurrentTurn();
        return PHASE_DESCRIPTIONS_KO[phase];
    }

    /** 다음 페이즈로 진행 */
    advancePhase() {
        const turn = this.getCurrentTurn();
        const nextIndex = turn.phaseIndex + 1;

        if (nextIndex >= PHASES.length) {
            // 밤 끝 → 다음 날 아침
            this.store.setState('turn', {
                day: turn.day + 1,
                phaseIndex: 0,
                phase: PHASES[0]
            });
        } else {
            this.store.setState('turn', {
                day: turn.day,
                phaseIndex: nextIndex,
                phase: PHASES[nextIndex]
            });
        }

        return this.getCurrentTurn();
    }

    /** 현재 페이즈가 마지막(밤)인지 */
    isNightPhase() {
        return this.getCurrentTurn().phase === 'night';
    }
}

export default TurnManager;
export { PHASES, PHASE_NAMES_KO, PHASE_DESCRIPTIONS_KO };
