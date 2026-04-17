/**
 * 죄종 수치 유틸리티 — 모든 시스템이 공유하는 sinStats 판정 함수
 *
 * 설계 원칙:
 *   특성 우선 → 특성 없으면 sinStats 가중 확률 → 이력 누적 시 후천 특성 고정
 *   (RimWorld 특성 우선 + DD 이력 누적 패턴)
 */

/** 7대 죄종 키 목록 */
export const SIN_KEYS = ['wrath', 'envy', 'greed', 'sloth', 'gluttony', 'lust', 'pride'];

/** 죄종 한글명 */
export const SIN_NAMES_KO = {
    wrath: '분노', envy: '시기', greed: '탐욕',
    sloth: '나태', gluttony: '폭식', lust: '색욕', pride: '교만'
};

/**
 * sinStats 7수치를 가중치로 사용하여 죄종 키 1개를 확률적으로 뽑는다.
 * 예: {wrath:18, greed:15, ...} → 총합 65, 분노 확률 28%, 탐욕 23%, ...
 * @param {object} sinStats - {wrath:number, envy:number, ...}
 * @returns {string} 뽑힌 죄종 키 (예: 'wrath')
 */
export function weightedSinRoll(sinStats) {
    if (!sinStats) return SIN_KEYS[0];
    let total = 0;
    for (const key of SIN_KEYS) {
        total += (sinStats[key] || 0);
    }
    if (total <= 0) return SIN_KEYS[0];

    let roll = Math.random() * total;
    for (const key of SIN_KEYS) {
        roll -= (sinStats[key] || 0);
        if (roll <= 0) return key;
    }
    return SIN_KEYS[SIN_KEYS.length - 1];
}

/**
 * 특정 죄종의 발현 확률 (0~1).
 * sinStats[key] / 전체합.
 * @param {object} sinStats
 * @param {string} sinKey - 'wrath' 등
 * @returns {number} 0~1
 */
export function sinChance(sinStats, sinKey) {
    if (!sinStats) return 0;
    let total = 0;
    for (const key of SIN_KEYS) {
        total += (sinStats[key] || 0);
    }
    if (total <= 0) return 0;
    return (sinStats[sinKey] || 0) / total;
}

/**
 * 특정 죄종의 강도 계수 (0~1).
 * val / 20 으로 정규화.
 * @param {object} sinStats
 * @param {string} sinKey
 * @returns {number} 0~1
 */
export function sinIntensity(sinStats, sinKey) {
    if (!sinStats) return 0;
    return Math.min(1, Math.max(0, (sinStats[sinKey] || 0) / 20));
}

/**
 * 최고값 죄종 키 반환 (UI 색상/스프라이트 fallback 용도).
 * 시스템 분기에는 사용하지 않는다.
 * @param {object} sinStats
 * @returns {string} 최고값 죄종 키
 */
export function topSin(sinStats) {
    if (!sinStats) return SIN_KEYS[0];
    let max = -1;
    let top = SIN_KEYS[0];
    for (const key of SIN_KEYS) {
        const val = sinStats[key] || 0;
        if (val > max) {
            max = val;
            top = key;
        }
    }
    return top;
}

/**
 * 상위 2개 죄종 키 반환 (수식어 시스템용).
 * @param {object} sinStats
 * @returns {string[]} [top1Key, top2Key]
 */
export function topTwoSins(sinStats) {
    if (!sinStats) return [SIN_KEYS[0], SIN_KEYS[1]];
    const sorted = SIN_KEYS
        .map(k => ({ key: k, val: sinStats[k] || 0 }))
        .sort((a, b) => b.val - a.val);
    return [sorted[0].key, sorted[1].key];
}

/**
 * 영웅의 특성(선천+후천)에서 폭주 행동을 결정하는 특성을 찾는다.
 * @param {object} hero - 영웅 객체
 * @returns {object|null} { sin: 'wrath', action: 'rampage_destroy' } 또는 null
 */
export function findRampageTrait(hero) {
    const traits = _collectTraits(hero);
    for (const t of traits) {
        if (t.rampage_action) {
            return { sin: t.rampage_sin, action: t.rampage_action, traitName: t.name };
        }
    }
    return null;
}

/**
 * 영웅의 특성(선천+후천)에서 이탈 행동을 결정하는 특성을 찾는다.
 * @param {object} hero - 영웅 객체
 * @returns {object|null} { sin: 'greed', action: 'desertion_steal' } 또는 null
 */
export function findDesertionTrait(hero) {
    const traits = _collectTraits(hero);
    for (const t of traits) {
        if (t.desertion_action) {
            return { sin: t.desertion_sin, action: t.desertion_action, traitName: t.name };
        }
    }
    return null;
}

/**
 * 영웅의 모든 특성(선천 + 후천)을 배열로 모은다.
 * @param {object} hero
 * @returns {object[]}
 */
function _collectTraits(hero) {
    const result = [];
    // 선천 특성 (단일 또는 배열)
    if (hero.trait) {
        if (Array.isArray(hero.trait)) {
            result.push(...hero.trait);
        } else {
            result.push(hero.trait);
        }
    }
    // 후천 특성
    if (hero.acquiredTraits) {
        if (Array.isArray(hero.acquiredTraits)) {
            result.push(...hero.acquiredTraits);
        } else {
            result.push(hero.acquiredTraits);
        }
    }
    return result;
}

export default {
    SIN_KEYS,
    SIN_NAMES_KO,
    weightedSinRoll,
    sinChance,
    sinIntensity,
    topSin,
    topTwoSins,
    findRampageTrait,
    findDesertionTrait
};
