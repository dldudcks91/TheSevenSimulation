/**
 * MorningReport — 아침 보고 데이터 생성 (순수 로직, Phaser 의존 없음)
 *
 * 영웅별 심리 상태를 분석하고 서사적 텍스트를 생성한다.
 * 위험 영웅(죄종 수치 18+ = 폭주 위험 / 3- = 의욕 상실)과 안정 영웅을 분류.
 */

import { weightedSinRoll, topSin, sinIntensity, SIN_NAMES_KO, SIN_KEYS } from './SinUtils.js';

const DANGER_HIGH_SIN = 18; // 폭주 위험 임계값
const DANGER_LOW_SIN = 3;   // 의욕 상실 임계값

/** 죄종별 서사 텍스트 (안정 / 고양·폭주위험 / 불만·이탈위험) */
const SIN_TEXTS = {
    wrath: {
        stable: [
            '훈련장에서 허수아비를 박살내고 있습니다',
            '칼날에 기름칠을 하며 콧노래를 부릅니다',
            '아무한테나 팔씨름을 걸고 있습니다',
        ],
        high: [
            '이를 갈며 무기를 만지작거립니다',
            '주먹으로 벽을 치기 시작했습니다',
            '눈이 충혈되어 있습니다. 잠을 못 잔 모양입니다',
        ],
        low: [
            '벽만 바라보며 아무 말도 하지 않습니다',
            '무기를 내려놓고 멍하니 앉아 있습니다',
            '싸울 이유를 잃은 눈빛입니다',
        ],
    },
    envy: {
        stable: [
            '다른 영웅의 장비를 흘끔흘끔 쳐다봅니다',
            '누군가의 전공 기록을 뒤적이고 있습니다',
            '거울을 보며 한숨을 쉽니다',
        ],
        high: [
            '다른 영웅들을 노려보고 있습니다',
            '누군가의 소지품을 만지다 들켰습니다',
            '"왜 항상 저 사람만..." 중얼거립니다',
        ],
        low: [
            '자기 방에서 나오지 않습니다',
            '아무도 자기를 필요로 하지 않는다고 생각합니다',
            '존재감을 지우려는 듯 구석에 앉아 있습니다',
        ],
    },
    greed: {
        stable: [
            '자기 소지품을 세고 또 세고 있습니다',
            '빈 주머니를 뒤지며 혀를 찹니다',
            '전리품 분배표를 혼자 작성하고 있습니다',
        ],
        high: [
            '창고 근처를 서성이고 있습니다',
            '자원 장부를 자기 멋대로 고치려 합니다',
            '"이건 내 거야" 라는 말을 자주 합니다',
        ],
        low: [
            '짐을 싸기 시작했습니다',
            '여기 있으면 손해라는 계산이 끝난 모양입니다',
            '가치 없는 것들을 하나씩 버리고 있습니다',
        ],
    },
    sloth: {
        stable: [
            '양지바른 곳에서 낮잠 중입니다',
            '하품을 하며 구름을 세고 있습니다',
            '해먹을 만들어 달라고 요청했습니다',
        ],
        high: [
            '모두에게 "그만두자"고 말하고 다닙니다',
            '"뭘 해도 소용없다"는 분위기를 퍼뜨립니다',
            '다른 영웅의 의욕까지 빨아들이고 있습니다',
        ],
        low: [
            '며칠째 잠만 자고 있습니다',
            '숨소리조차 귀찮은 듯합니다',
            '존재를 잊힐 정도로 조용합니다',
        ],
    },
    gluttony: {
        stable: [
            '주방에서 뭔가 만들어 먹고 있습니다',
            '간식을 주머니에 잔뜩 넣고 다닙니다',
            '오늘 저녁 메뉴를 벌써 세 번 물어봤습니다',
        ],
        high: [
            '식량을 혼자 끌어안고 있습니다',
            '배급량을 두 배로 달라고 고함칩니다',
            '비상 식량에 손을 대기 시작했습니다',
        ],
        low: [
            '아무것도 먹지 않습니다',
            '음식을 보고도 손을 뻗지 않습니다',
            '식욕을 잃었습니다. 좋은 신호가 아닙니다',
        ],
    },
    lust: {
        stable: [
            '누군가에게 꽃을 꺾어주고 있습니다',
            '동료에게 노래를 불러주고 있습니다',
            '손편지를 쓰다 숨기고 있습니다',
        ],
        high: [
            '특정 동료에게 집착하고 있습니다',
            '"떨어지면 안 돼"를 반복하고 있습니다',
            '동료의 일거수일투족을 따라다닙니다',
        ],
        low: [
            '아무도 만나려 하지 않습니다',
            '혼자 있으면서도 외로워 보입니다',
            '관계를 포기한 듯 벽을 세우고 있습니다',
        ],
    },
    pride: {
        stable: [
            '거울 앞에서 자세를 교정하고 있습니다',
            '후배 영웅에게 일장 연설 중입니다',
            '자기 전공 기록을 다듬고 있습니다',
        ],
        high: [
            '명령을 무시하기 시작했습니다',
            '"내가 이끌어야 한다"고 주장합니다',
            '바알의 판단에 공개적으로 이의를 제기합니다',
        ],
        low: [
            '자존심이 무너져 침묵합니다',
            '고개를 숙이고 다닙니다. 낯선 모습입니다',
            '누구도 자기를 인정하지 않는다고 느낍니다',
        ],
    },
};

/** 죄종별 현재 진행 중인 조건 텍스트 */
const SIN_CONDITION_TEXTS = {
    wrath: {
        unhappy: (days) => `${days}일 연속 미파견 — 싸울 곳을 찾고 있습니다`,
        happy: () => '최근 전투에 참여하여 활기차 보입니다',
    },
    sloth: {
        unhappy: () => '연속 배치 중 — 쉬고 싶어합니다',
        happy: () => '푹 쉬고 있습니다. 만족스러운 표정입니다',
    },
    pride: {
        unhappy: () => '최근 방어 실패에 자존심이 상했습니다',
        happy: () => '방어 승리에 어깨가 올라가 있습니다',
    },
    envy: {
        unhappy: () => '다른 영웅이 더 활약하는 것에 불만입니다',
        happy: () => '자신의 역할에 만족하고 있습니다',
    },
    greed: {
        unhappy: () => '자원 배분에 불만을 품고 있습니다',
        happy: () => '최근 보상을 받아 기분이 좋습니다',
    },
    gluttony: {
        unhappy: () => '식량이 부족하다고 느끼고 있습니다',
        happy: () => '배불리 먹고 만족한 상태입니다',
    },
    lust: {
        unhappy: () => '동료와 떨어져 외로워하고 있습니다',
        happy: () => '동료들과 잘 어울리고 있습니다',
    },
};

class MorningReport {
    constructor(balance = {}) {
        this.dangerHighSin = balance.sin_rampage_threshold ?? DANGER_HIGH_SIN;
        this.dangerLowSin = balance.sin_frustrated_threshold ?? DANGER_LOW_SIN;
        this.wrathIdleThreshold = balance.wrath_idle_threshold ?? 3;
    }

    /**
     * 아침 보고 데이터 생성
     * @param {Array} heroes - 영웅 목록
     * @param {Object} raidInfo - 감시탑 습격 정보 { text, detail } (없으면 null)
     * @returns {{ alerts: Array, stables: Array, raidInfo: Object|null }}
     */
    generate(heroes, raidInfo = null) {
        const alerts = [];
        const stables = [];

        for (const hero of heroes) {
            if (hero.status === 'dead') continue;

            const dominant = topSin(hero.sinStats);
            const rolledSin = weightedSinRoll(hero.sinStats);

            // 최고 죄종 수치
            const topSinVal = hero.sinStats?.[dominant] ?? 0;
            // 최저 죄종 수치
            const minSinVal = Math.min(...Object.values(hero.sinStats || {}));

            const entry = {
                id: hero.id,
                name: hero.name,
                epithet: hero.epithet || '',
                dominantSin: dominant,
                sinName: SIN_NAMES_KO[dominant],
                sinPeak: { sin: dominant, value: topSinVal },
                isRampaging: hero.isRampaging || false,
                status: hero.status,
                condition: this._getCondition(hero),
            };

            if (hero.isRampaging || topSinVal >= this.dangerHighSin) {
                entry.level = 'high';
                entry.icon = '🔺';
                entry.label = '폭주 위험';
                entry.text = this._pickText(dominant, 'high');
                alerts.push(entry);
            } else if (minSinVal <= this.dangerLowSin) {
                entry.level = 'low';
                entry.icon = '🔻';
                entry.label = '의욕 상실';
                entry.text = this._pickText(rolledSin, 'low');
                alerts.push(entry);
            } else {
                entry.level = 'stable';
                entry.icon = '─';
                entry.label = '안정';
                entry.text = this._pickText(rolledSin, 'stable');
                stables.push(entry);
            }
        }

        return { alerts, stables, raidInfo };
    }

    /** 모든 죄종 조건 병렬 체크, 강도 높은 것 우선 */
    _getCondition(hero) {
        const candidates = [];

        for (const sin of SIN_KEYS) {
            const texts = SIN_CONDITION_TEXTS[sin];
            if (!texts) continue;

            const intensity = sinIntensity(hero.sinStats, sin);
            let result = null;

            switch (sin) {
                case 'wrath': {
                    const days = hero.daysIdle || 0;
                    if (days >= this.wrathIdleThreshold) result = { type: 'unhappy', text: texts.unhappy(days) };
                    else if (hero.status === 'expedition' || hero.status === 'hunt') result = { type: 'happy', text: texts.happy() };
                    break;
                }
                case 'sloth': {
                    if (hero.status !== 'idle' && hero.status !== 'injured') result = { type: 'unhappy', text: texts.unhappy() };
                    else if (hero.status === 'idle') result = { type: 'happy', text: texts.happy() };
                    break;
                }
                case 'pride': {
                    if (hero._lastDefenseWin === true) result = { type: 'happy', text: texts.happy() };
                    else if (hero._lastDefenseWin === false) result = { type: 'unhappy', text: texts.unhappy() };
                    break;
                }
                default: {
                    const sinVal = hero.sinStats?.[sin] ?? 0;
                    if (sinVal <= 5) result = { type: 'unhappy', text: texts.unhappy() };
                    else if (sinVal >= 15) result = { type: 'happy', text: texts.happy() };
                    break;
                }
            }

            if (result) {
                candidates.push({ ...result, sin, intensity });
            }
        }

        if (candidates.length === 0) return null;

        // 강도 높은 죄종의 조건 우선
        candidates.sort((a, b) => b.intensity - a.intensity);
        return { type: candidates[0].type, text: candidates[0].text };
    }

    _pickText(primarySin, level) {
        const pool = SIN_TEXTS[primarySin]?.[level];
        if (!pool || pool.length === 0) return '특이사항 없음';
        return pool[Math.floor(Math.random() * pool.length)];
    }
}

export default MorningReport;
