/**
 * CSV 로더 — 게임 시작 시 모든 CSV를 로드하여 JS 객체로 변환
 * 빌드 도구 없이 fetch + 수동 파서
 */

/**
 * CSV 텍스트를 파싱하여 객체 배열로 반환
 * - 첫 줄 = 헤더 (컬럼명)
 * - 숫자 자동 변환
 * - 빈 셀 = null
 * - 따옴표로 감싼 셀 내 콤마/줄바꿈 지원
 */
function parseCsv(text) {
    const lines = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (inQuotes && text[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === '\n' && !inQuotes) {
            lines.push(current);
            current = '';
        } else if (ch === '\r' && !inQuotes) {
            // skip \r
        } else {
            current += ch;
        }
    }
    if (current.trim()) lines.push(current);

    if (lines.length < 2) return [];

    const headers = splitCsvLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue; // 빈 줄, 주석 스킵

        const values = splitCsvLine(line);
        const obj = {};

        for (let j = 0; j < headers.length; j++) {
            const key = headers[j].trim();
            const raw = (values[j] || '').trim();

            if (raw === '' || raw === 'null') {
                obj[key] = null;
            } else if (raw === 'true') {
                obj[key] = true;
            } else if (raw === 'false') {
                obj[key] = false;
            } else if (!isNaN(raw) && raw !== '') {
                obj[key] = Number(raw);
            } else {
                obj[key] = raw;
            }
        }
        rows.push(obj);
    }

    return rows;
}

/** CSV 라인을 셀 배열로 분리 (따옴표 내 콤마 지원) */
function splitCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells;
}

/**
 * 모든 CSV 파일을 한번에 로드
 * @param {string} basePath - CSV 파일들이 있는 디렉토리 (예: './data/')
 * @returns {Object} 파일명(확장자 제외) → 파싱된 객체 배열
 */
async function loadAllCsv(basePath = './data/') {
    const CSV_FILES = [
        'hero_names',
        'sin_types',
        'stat_names',
        'sin_relations',
        'sin_satisfaction',
        'sin_rampage_chain',
        'events',
        'event_choices',
        'event_effects',
        'facilities',
        'research',
        'chapters',
        'stages',
        'stage_enemies',
        'balance',
        'edicts',
        'hunt_enemies',
        'defense_scaling',
        'phases',
        'morale_states',
        'desertion_effects',
        'lpc_parts',
        'hero_epithets',
        'items',
        'traits',
        'expedition_nodes',
        'expedition_dice',
        'locale_ui',
        'locale_data'
    ];

    const results = {};
    const promises = CSV_FILES.map(async (name) => {
        const url = `${basePath}${name}.csv`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`CSV not found: ${url}`);
                results[name] = [];
                return;
            }
            const text = await response.text();
            results[name] = parseCsv(text);
        } catch (e) {
            console.warn(`CSV load error: ${url}`, e);
            results[name] = [];
        }
    });

    await Promise.all(promises);
    return results;
}

/**
 * 로드된 CSV 데이터를 game_logic이 사용하는 구조로 조립
 */
function buildGameData(csvData) {
    const data = {};

    // ─── heroData (HeroManager용) ───
    // name_pool: 한글 풀 (기존 소비자 호환용)
    // name_pool_i18n: 언어별 풀 — HeroManager가 생성 시점 언어로 pick
    data.heroData = {
        name_pool: {
            first: csvData.hero_names.filter(r => r.type === 'first').map(r => r.name),
            last: csvData.hero_names.filter(r => r.type === 'last').map(r => r.name)
        },
        name_pool_i18n: {
            ko: {
                first: csvData.hero_names.filter(r => r.type === 'first').map(r => r.name),
                last: csvData.hero_names.filter(r => r.type === 'last').map(r => r.name)
            },
            en: {
                first: csvData.hero_names.filter(r => r.type === 'first').map(r => r.name_en || r.name),
                last: csvData.hero_names.filter(r => r.type === 'last').map(r => r.name_en || r.name)
            }
        },
        sin_types: csvData.sin_types.map(r => ({
            id: r.id, name_ko: r.name_ko, flaw: r.flaw, rampage: r.rampage, desertion: r.desertion,
            name_key: r.name_key, flaw_key: r.flaw_key, rampage_key: r.rampage_key, desertion_key: r.desertion_key
        })),
        stat_names: {},
        stat_name_keys: {}
    };
    for (const r of csvData.stat_names) {
        data.heroData.stat_names[r.id] = r.name_ko;
        if (r.name_key) data.heroData.stat_name_keys[r.id] = r.name_key;
    }

    // ─── sinRelations (SinSystem용) ───
    const sinIds = csvData.sin_types.map(r => r.id);
    const relations = {};
    for (const id of sinIds) relations[id] = {};
    for (const r of csvData.sin_relations) {
        relations[r.from][r.to] = r.relation;
    }

    const relationEffects = {};
    for (const r of csvData.sin_relations) {
        if (!relationEffects[r.relation]) {
            relationEffects[r.relation] = {
                morale_delta: r.morale_delta,
                description: r.description || '',
                description_key: r.description_key || null
            };
        }
    }

    const satisfaction = {};
    for (const r of csvData.sin_satisfaction) {
        satisfaction[r.sin] = {
            satisfy: r.satisfy, frustrate: r.frustrate,
            satisfy_delta: r.satisfy_delta, frustrate_delta: r.frustrate_delta
        };
    }

    const rampageChain = {};
    for (const r of csvData.sin_rampage_chain) {
        rampageChain[r.sin] = {
            target: r.target,
            morale_delta: r.morale_delta,
            description: r.description,
            description_key: r.description_key || null
        };
    }

    data.sinRelations = {
        sin_types: sinIds,
        sin_names_ko: {},
        sin_name_keys: {},
        relations,
        relation_effects: relationEffects,
        satisfaction,
        rampage_chain: rampageChain
    };
    for (const r of csvData.sin_types) {
        data.sinRelations.sin_names_ko[r.id] = r.name_ko;
        if (r.name_key) data.sinRelations.sin_name_keys[r.id] = r.name_key;
    }

    // ─── eventsData (EventSystem용) ───
    const eventsMap = {};
    for (const r of csvData.events) {
        eventsMap[r.id] = {
            id: r.id, category: r.category, title: r.title,
            trigger: {
                type: r.trigger_type, sin: r.trigger_sin || null,
                oppose_sin: r.trigger_oppose_sin || null,
                min_morale: r.trigger_min_morale || null,
                interval: r.trigger_interval || null,
                min_day: r.trigger_min_day || null,
                chance: r.trigger_chance || null
            },
            scene: r.scene,
            title_key: r.title_key || `event.${r.id}.title`,
            scene_key: r.scene_key || `event.${r.id}.scene`,
            choices: []
        };
    }
    for (const r of csvData.event_choices) {
        if (!eventsMap[r.event_id]) continue;
        const choice = {
            text: r.text, log: r.log,
            text_key: `event.${r.event_id}.${r.choice_index}.text`,
            log_key: `event.${r.event_id}.${r.choice_index}.log`,
            effects: []
        };
        const effects = csvData.event_effects.filter(
            e => e.event_id === r.event_id && e.choice_index === r.choice_index
        );
        for (const e of effects) {
            const eff = { target: e.target };
            if (e.sin_delta !== null && e.sin_delta !== undefined) eff.sin_delta = e.sin_delta;
            if (e.morale !== null && e.morale !== undefined) eff.morale = e.morale; // 레거시 세이브 호환
            if (e.amount !== null && e.amount !== undefined) eff.amount = e.amount;
            if (e.action !== null && e.action !== undefined) eff.action = e.action;
            choice.effects.push(eff);
        }
        eventsMap[r.event_id].choices.push(choice);
    }
    data.eventsData = { events: Object.values(eventsMap) };

    // ─── facilitiesData (BaseManager용) ───
    data.facilitiesData = {
        facilities: csvData.facilities.map(r => ({
            id: r.id, name_ko: r.name_ko, tier: r.tier,
            requires: r.requires ? r.requires.split('|').filter(Boolean) : [],
            cost: r.cost, build_cost: r.build_cost,
            description: r.description,
            name_key: r.name_key || null,
            description_key: r.description_key || null,
            effects: {}
        })),
        research: csvData.research.map(r => ({
            id: r.id, name_ko: r.name_ko, category: r.category,
            requires_facility: r.requires_facility, cost: r.cost, research_cost: r.research_cost,
            effect: { type: r.effect_type, value: r.effect_value },
            description: r.description,
            name_key: r.name_key || null,
            description_key: r.description_key || null
        }))
    };
    // 시설 effects 복원
    for (const fRow of csvData.facilities) {
        const fObj = data.facilitiesData.facilities.find(f => f.id === fRow.id);
        if (!fObj) continue;
        if (fRow.recruit_slots) fObj.effects.recruit_slots = fRow.recruit_slots;
        if (fRow.feast_available) fObj.effects.feast_available = true;
        if (fRow.craft_weapon) fObj.effects.craft_weapon = true;
        if (fRow.repair) fObj.effects.repair = true;
        if (fRow.raid_info_level) fObj.effects.raid_info_level = fRow.raid_info_level;
        if (fRow.heal_speed) fObj.effects.heal_speed = fRow.heal_speed;
        if (fRow.morale_stabilize) fObj.effects.morale_stabilize = true;
        if (fRow.trade_available) fObj.effects.trade_available = true;
        if (fRow.alchemy_available) fObj.effects.alchemy_available = true;
        if (fRow.gold_per_turn) fObj.effects.gold_per_turn = fRow.gold_per_turn;
    }

    // ─── expeditionNodesData (ExpeditionNodeManager용) ───
    data.expeditionNodesData = {};
    for (const r of (csvData.expedition_nodes || [])) {
        const ch = r.chapter;
        if (!data.expeditionNodesData[ch]) data.expeditionNodesData[ch] = [];
        data.expeditionNodesData[ch].push({
            id: r.id, type: r.type, row: r.row, col: r.col,
            label: r.label, icon: r.icon,
            connections: r.connections ? String(r.connections).split('|').filter(Boolean) : [],
        });
    }

    // ─── expeditionDiceData (ExpeditionNodeManager용) ───
    data.expeditionDiceData = {};
    const DICE_LABELS = { start: '출발', combat: '전투', event: '조우', rest: '야영', portal: '포탈', boss: '보스' };
    const DICE_ICONS  = { start: '★', combat: '⚔', event: '?', rest: '🏕', portal: '🌀', boss: '💀' };
    for (const r of (csvData.expedition_dice || [])) {
        const ch = r.chapter;
        const seq = String(r.sequence || '').split('|').filter(Boolean);
        data.expeditionDiceData[ch] = seq.map((type, i) => ({
            id: `tile_${i}`, type, index: i,
            label: DICE_LABELS[type] || type,
            icon: DICE_ICONS[type] || '·',
        }));
    }

    // ─── stagesData (ExpeditionManager용) ───
    data.stagesData = {};
    for (const stage of csvData.stages) {
        const chKey = `ch${stage.chapter}`;
        if (!data.stagesData[chKey]) data.stagesData[chKey] = [];
        const enemies = csvData.stage_enemies
            .filter(e => e.stage_id === stage.id)
            .map(e => ({ name: e.name, hp: e.hp, atk: e.atk, spd: e.spd, name_key: e.name_key || null }));
        data.stagesData[chKey].push({
            id: stage.id, name: stage.name, isBoss: stage.is_boss || false,
            enemies, reward: stage.reward,
            name_key: stage.name_key || null
        });
    }

    // ─── chapters ───
    data.chapters = csvData.chapters.map(r => ({
        id: r.id, sin: r.sin, name_ko: r.name_ko, region: r.region,
        boss: r.boss,
        environment: {
            morale_modifier: {},
            description: r.env_description,
            description_key: r.env_description_key || null
        },
        boss_briefing: r.boss_briefing,
        boss_dying_words: r.boss_dying_words,
        name_key: r.name_key || null,
        region_key: r.region_key || null,
        boss_key: r.boss_key || null,
        boss_briefing_key: r.boss_briefing_key || null,
        boss_dying_words_key: r.boss_dying_words_key || null
    }));
    // 챕터별 환경 사기 보정
    for (const r of csvData.chapters) {
        const ch = data.chapters.find(c => c.id === r.id);
        if (ch && r.env_morale_sin1) {
            ch.environment.morale_modifier[r.env_morale_sin1] = r.env_morale_val1;
        }
        if (ch && r.env_morale_sin2) {
            ch.environment.morale_modifier[r.env_morale_sin2] = r.env_morale_val2;
        }
    }

    // ─── balance (전투 공식, 사기 임계값 등) ───
    data.balance = {};
    for (const r of csvData.balance) {
        data.balance[r.key] = r.value;
    }

    // ─── edicts (국시 시스템) ───
    data.edicts = csvData.edicts || [];

    // ─── hunt_enemies ───
    data.huntEnemies = csvData.hunt_enemies;

    // ─── defense_scaling ───
    data.defenseScaling = csvData.defense_scaling;

    // ─── phases ───
    data.phases = csvData.phases;

    // ─── morale_states ───
    data.moraleStates = csvData.morale_states;

    // ─── desertion_effects ───
    data.desertionEffects = csvData.desertion_effects;

    // ─── lpcParts (스프라이트 파츠 매니페스트) ───
    data.lpcParts = csvData.lpc_parts || [];

    // ─── heroEpithets (이름 수식어) ───
    data.heroEpithets = csvData.hero_epithets || [];

    // ─── traitsData (특성) ───
    data.traitsData = (csvData.traits || []).map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        type: r.type,
        pro_effect: r.pro_effect,
        con_effect: r.con_effect,
        earn_condition: r.earn_condition,
        xp_category: r.xp_category || null,
        rampage_sin: r.rampage_sin || null,
        rampage_action: r.rampage_action || null,
        desertion_sin: r.desertion_sin || null,
        desertion_action: r.desertion_action || null,
        sin_category: r.sin_category || 'neutral',
        target_sin: r.target_sin || null,
        sin_mult: (r.sin_mult !== null && r.sin_mult !== undefined) ? Number(r.sin_mult) : 1.0,
        name_key: r.name_key || null
    }));

    // ─── itemsData (아이템) ───
    data.itemsData = (csvData.items || []).map(r => ({
        id: r.id,
        name_ko: r.name_ko,
        type: r.type,
        grade: r.grade,
        description: r.description,
        // 행동 보정 11종
        build: r.build,
        pioneer: r.pioneer,
        gather: r.gather,
        lumber: r.lumber,
        research: r.research,
        smithing: r.smithing,
        alchemy: r.alchemy,
        diplomacy: r.diplomacy,
        trade: r.trade,
        recruit: r.recruit,
        hunt: r.hunt,
        // 전투 보정
        atk: r.atk,
        hp: r.hp,
        damage_reduce: r.damage_reduce,
        atk_speed: r.atk_speed,
        crit: r.crit,
        range: r.range,
        // 특수
        sin_type: r.sin_type,
        morale_per_turn: r.morale_per_turn,
        special: r.special,
        // 경제
        cost: r.cost,
        craft_facility: r.craft_facility,
        craft_stat: r.craft_stat,
        // i18n keys
        name_key: r.name_key || null,
        description_key: r.description_key || null,
        special_key: r.special_key || null
    }));

    // ─── locale dictionaries (Godot 스타일 wide CSV) ───
    // locale_ui.csv, locale_data.csv → { key: { ko, en, ... } }
    data.uiLocale = {};
    for (const r of (csvData.locale_ui || [])) {
        if (!r.key) continue;
        const entry = { ...r };
        delete entry.key;
        data.uiLocale[r.key] = entry;
    }
    data.dataLocale = {};
    for (const r of (csvData.locale_data || [])) {
        if (!r.key) continue;
        const entry = { ...r };
        delete entry.key;
        data.dataLocale[r.key] = entry;
    }

    return data;
}

export { parseCsv, loadAllCsv, buildGameData };
