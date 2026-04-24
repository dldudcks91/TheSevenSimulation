/**
 * 죄종 수치 유틸리티 — 모든 시스템이 공유하는 sinStats 판정 함수
 *
 * 설계 원칙:
 *   특성 우선 → 특성 없으면 sinStats 가중 확률 → 이력 누적 시 후천 특성 고정
 *   (RimWorld 특성 우선 + DD 이력 누적 패턴)
 */

import locale from './LocaleManager.js';

/** 7대 죄종 키 목록 */
export const SIN_KEYS = ['wrath', 'envy', 'greed', 'sloth', 'gluttony', 'lust', 'pride'];

/**
 * 죄종 이름 Proxy — `SIN_NAMES_KO[key]` 접근 시 현재 언어로 조회.
 * 역사적 이름을 유지하되, 실제 값은 locale.sinName(key)로 동적 해석된다.
 */
export const SIN_NAMES_KO = new Proxy({}, {
    get(_, key) {
        if (typeof key !== 'string') return undefined;
        if (!SIN_KEYS.includes(key)) return undefined;
        return locale.sinName(key);
    },
    has(_, key) {
        return typeof key === 'string' && SIN_KEYS.includes(key);
    },
    ownKeys() { return [...SIN_KEYS]; },
    getOwnPropertyDescriptor(_, key) {
        if (typeof key !== 'string' || !SIN_KEYS.includes(key)) return undefined;
        return { enumerable: true, configurable: true, value: locale.sinName(key) };
    }
});

/** 7죄종 × 7영역 매핑 (2026-04-21) */
export const SIN_DOMAIN = {
    wrath: 'combat',        // 전투
    pride: 'command',       // 명성·지휘
    greed: 'economy',       // 자원·경제
    envy: 'scouting',       // 정찰·정보
    lust: 'social',         // 사회·관계
    gluttony: 'food',       // 식량·체력
    sloth: 'recovery'       // 회복·관조
};

/** 7죄종 × 7스탯 매핑 (2026-04-21) */
export const SIN_STAT = {
    wrath: 'strength',      // 힘
    pride: 'leadership',    // 통솔
    greed: 'intellect',     // 지능
    envy: 'agility',        // 민첩
    lust: 'charisma',       // 매력
    gluttony: 'vitality',   // 건강
    sloth: 'perception'     // 감각
};

/** 구간 이름 */
export const SIN_TIER = {
    CLEAN: 'clean',         // 0~4
    MANIFEST: 'manifest',   // 5~11
    ELEVATED: 'elevated',   // 12~17
    RAMPAGE: 'rampage',     // 18~19
    CRITICAL: 'critical'    // 20
};

/**
 * 죄종 수치를 구간으로 판정.
 * @param {number} value - 0~20
 * @param {object} balance - balance.csv
 * @returns {string} SIN_TIER 값
 */
export function getSinTier(value, balance = {}) {
    const v = value || 0;
    const criticalT = balance.sin_critical_threshold ?? 20;
    const rampageT = balance.sin_rampage_threshold ?? 18;
    const elevatedT = balance.sin_elevated_threshold ?? 12;
    const manifestT = balance.sin_manifest_threshold ?? 5;
    if (v >= criticalT) return SIN_TIER.CRITICAL;
    if (v >= rampageT) return SIN_TIER.RAMPAGE;
    if (v >= elevatedT) return SIN_TIER.ELEVATED;
    if (v >= manifestT) return SIN_TIER.MANIFEST;
    return SIN_TIER.CLEAN;
}

/**
 * 구간별 스탯 보너스 (치환형 — 누적 아님).
 * @param {number} value - 죄종 수치
 * @param {object} balance - balance.csv
 * @returns {number} 0, 1, 2, 3
 */
export function getStatBonusForSinValue(value, balance = {}) {
    const tier = getSinTier(value, balance);
    if (tier === SIN_TIER.CRITICAL || tier === SIN_TIER.RAMPAGE) {
        return balance.sin_rampage_stat_bonus ?? 3;
    }
    if (tier === SIN_TIER.ELEVATED) {
        return balance.sin_elevated_stat_bonus ?? 2;
    }
    if (tier === SIN_TIER.MANIFEST) {
        return balance.sin_manifest_stat_bonus ?? 1;
    }
    return 0;
}

/**
 * 영웅의 모든 죄종 수치를 반영한 스탯 보너스 맵.
 * @param {object} hero - hero 객체
 * @param {object} balance - balance.csv
 * @returns {object} {strength: +N, agility: +N, ...}
 */
export function getSinStatBonuses(hero, balance = {}) {
    const result = {};
    if (!hero || !hero.sinStats) return result;
    for (const sinKey of SIN_KEYS) {
        const bonus = getStatBonusForSinValue(hero.sinStats[sinKey], balance);
        if (bonus > 0) {
            const stat = SIN_STAT[sinKey];
            result[stat] = (result[stat] || 0) + bonus;
        }
    }
    return result;
}

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
    SIN_DOMAIN,
    SIN_STAT,
    SIN_TIER,
    weightedSinRoll,
    sinChance,
    sinIntensity,
    topSin,
    topTwoSins,
    findRampageTrait,
    findDesertionTrait,
    getSinTier,
    getStatBonusForSinValue,
    getSinStatBonuses
};
