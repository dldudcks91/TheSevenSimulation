/**
 * LocaleManager — i18n 로컬라이제이션 매니저 (순수 JS, Phaser 의존 없음)
 *
 * 구조: Godot 스타일 Wide CSV (key, ko, en, ...)
 *   - locale_ui.csv   → uiDict   (UI 고정 문구 + 로그 템플릿)
 *   - locale_data.csv → dataDict (게임 데이터 텍스트)
 *
 * 사용:
 *   locale.t('ui.btn.new_game')                 → '새  게  임' / 'NEW  GAME'
 *   locale.t('log.hero.rampage', { hero: '김철수' })
 *     ko: '김철수가 분노로 폭발했다!' (조사 자동)
 *     en: '김철수 erupts in rage!'
 *   locale.dataText('sin.wrath.name')           → '분노' / 'Wrath'
 *   locale.field(obj, 'name')                   → obj.name_key가 있으면 조회
 *
 * 언어 전환: locale.setLang('en') → store.setState('lang', 'en') → 씬들이 구독
 */

import store from '../store/Store.js';
import {
    SUPPORTED_LANGS,
    DEFAULT_LANG,
    LANG_KO,
    LANG_STORAGE_KEY
} from '../constants.js';

// ─── 한글 받침 감지 ───

/** 마지막 글자에 받침이 있는지 (ㄹ 포함) */
function hasBatchim(word) {
    if (!word) return false;
    const last = word.charCodeAt(word.length - 1);
    if (last < 0xAC00 || last > 0xD7A3) return false; // 한글 완성형 범위 밖
    return ((last - 0xAC00) % 28) !== 0;
}

/** 마지막 글자에 ㄹ을 제외한 받침이 있는지 ('으로' vs '로' 판별용) */
function hasBatchimExceptR(word) {
    if (!word) return false;
    const last = word.charCodeAt(word.length - 1);
    if (last < 0xAC00 || last > 0xD7A3) return false;
    const jongseong = (last - 0xAC00) % 28;
    return jongseong !== 0 && jongseong !== 8; // 8 = ㄹ
}

// 조사 규칙표: 템플릿 마커 → 받침 유무에 따른 조사 반환
const JOSA_MAP = {
    '이':   (w) => hasBatchim(w) ? '이' : '가',
    '가':   (w) => hasBatchim(w) ? '이' : '가',
    '을':   (w) => hasBatchim(w) ? '을' : '를',
    '를':   (w) => hasBatchim(w) ? '을' : '를',
    '은':   (w) => hasBatchim(w) ? '은' : '는',
    '는':   (w) => hasBatchim(w) ? '은' : '는',
    '와':   (w) => hasBatchim(w) ? '과' : '와',
    '과':   (w) => hasBatchim(w) ? '과' : '와',
    '으로': (w) => hasBatchimExceptR(w) ? '으로' : '로',
    '로':   (w) => hasBatchimExceptR(w) ? '으로' : '로',
    '이나': (w) => hasBatchim(w) ? '이나' : '나',
    '나':   (w) => hasBatchim(w) ? '이나' : '나',
    '아':   (w) => hasBatchim(w) ? '아' : '야',
    '야':   (w) => hasBatchim(w) ? '아' : '야',
};

// ─── LocaleManager 본체 ───

class LocaleManager {
    constructor() {
        this.lang = this._detectLang();
        this.uiDict = {};
        this.dataDict = {};
    }

    /** 저장된 언어 > 브라우저 언어 > DEFAULT_LANG 순 */
    _detectLang() {
        try {
            const saved = typeof localStorage !== 'undefined'
                ? localStorage.getItem(LANG_STORAGE_KEY) : null;
            if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
        } catch (e) { /* LocalStorage 접근 실패 */ }

        if (typeof navigator !== 'undefined' && navigator.language) {
            const nav = navigator.language.toLowerCase();
            if (nav.startsWith('ko')) return LANG_KO;
        }
        return DEFAULT_LANG === LANG_KO ? LANG_KO : 'en';
    }

    /**
     * CSV에서 로드한 dict 주입
     * @param {Object} uiDict   - { key: { ko, en }, ... }
     * @param {Object} dataDict - { key: { ko, en }, ... }
     */
    init(uiDict, dataDict) {
        this.uiDict = uiDict || {};
        this.dataDict = dataDict || {};
        // Store에도 현재 언어 반영 (씬 구독용)
        store.setState('lang', this.lang);
    }

    getLang() { return this.lang; }

    /** 언어 전환 — localStorage 저장 + Store 알림 */
    setLang(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        if (this.lang === lang) return;
        this.lang = lang;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(LANG_STORAGE_KEY, lang);
            }
        } catch (e) { /* 저장 실패 무시 */ }
        store.setState('lang', lang);
    }

    /** 순환 토글 (KO ↔ EN) */
    toggle() {
        const next = this.lang === LANG_KO ? 'en' : LANG_KO;
        this.setLang(next);
    }

    // ─── 편의 헬퍼 (자주 쓰는 데이터 텍스트) ───
    sinName(sinKey)     { return this.dataText(`sin.${sinKey}.name`); }
    sinFlaw(sinKey)     { return this.dataText(`sin.${sinKey}.flaw`); }
    sinRampage(sinKey)  { return this.dataText(`sin.${sinKey}.rampage`); }
    sinDesertion(sinKey){ return this.dataText(`sin.${sinKey}.desertion`); }
    statName(statKey)   { return this.dataText(`stat.${statKey}.name`); }
    traitName(traitId)  { return this.dataText(`trait.${traitId}.name`); }
    edictName(sin)      { return this.dataText(`edict.${sin}.name`); }
    edictDesc(sin)      { return this.dataText(`edict.${sin}.desc`); }
    phaseName(id)       { return this.dataText(`phase.${id}.name`); }

    /**
     * UI 문구 조회 + 파라미터 치환
     * @param {string} key    - 'ui.btn.new_game', 'log.hero.rampage'
     * @param {Object} params - { hero: '김철수' } — 템플릿 치환 변수
     */
    t(key, params = null) {
        const entry = this.uiDict[key];
        let text;
        if (!entry) {
            console.warn(`[locale] missing UI key: ${key}`);
            text = key;
        } else {
            text = entry[this.lang] ?? entry[DEFAULT_LANG] ?? key;
        }
        if (params) text = this._interpolate(text, params);
        return text;
    }

    /**
     * 데이터 문구 조회 (게임 데이터 — 죄종명/시설명/아이템명 등)
     * @param {string} key      - 'sin.wrath.name'
     * @param {string} fallback - 키 누락 시 대체 문자열
     */
    dataText(key, fallback = null) {
        if (!key) return fallback ?? '';
        const entry = this.dataDict[key];
        if (!entry) {
            console.warn(`[locale] missing data key: ${key}`);
            return fallback ?? key;
        }
        return entry[this.lang] ?? entry[DEFAULT_LANG] ?? fallback ?? key;
    }

    /**
     * CSV 객체에서 현재 언어 문자열 추출.
     * obj[baseKey + '_key']가 있으면 dataText 조회,
     * 없으면 obj[baseKey]를 그대로 반환 (레거시 호환).
     *
     * 예: field(sinType, 'name') → sinType.name_key로 dataText
     */
    field(obj, baseKey) {
        if (!obj) return '';
        const keyField = obj[`${baseKey}_key`];
        if (keyField) return this.dataText(keyField, obj[baseKey]);
        return obj[baseKey] ?? '';
    }

    /**
     * 한국어 조사 선택
     * @param {string} word - 앞 단어 (받침 판정 대상)
     * @param {string} type - '이', '을', '은', '와', '로', ... (JOSA_MAP 키)
     * @returns {string} 선택된 조사
     */
    josa(word, type) {
        if (!word) return type;
        const fn = JOSA_MAP[type];
        if (!fn) return type;
        return fn(String(word));
    }

    /**
     * 템플릿 치환
     *   {name}        → params.name
     *   {name|을}     → params.name + josa(params.name, '을')  (ko만)
     * 영어 모드에서는 조사 마커를 무시하고 값만 치환.
     */
    _interpolate(text, params) {
        return text.replace(/\{([^}|]+)(?:\|([^}]+))?\}/g, (match, name, josaType) => {
            if (!(name in params)) return match;
            const value = params[name];
            if (value == null) return match;
            const str = String(value);
            if (josaType && this.lang === LANG_KO) {
                return `${str}${this.josa(str, josaType)}`;
            }
            return str;
        });
    }
}

export default new LocaleManager();
