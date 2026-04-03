/**
 * MapScene 공유 상수 — 색상, 레이아웃, 탭 정의, 슬롯 좌표
 */

// ═══ 색상 ═══
export const C = {
    bgPrimary: 0x0a0a12, bgSecondary: 0x12121e, bgTertiary: 0x1a1a2a,
    cardBg: 0x161624, inputBg: 0x0e0e1a,
    borderPrimary: 0x303048, borderSecondary: 0x484868,
    borderHighlight: 0x6868a0, borderLight: 0xa0a0c0, borderDark: 0x18182a,
    textPrimary: '#e8e8f0', textSecondary: '#a0a0c0', textMuted: '#606080',
    accentRed: '#e03030', expYellow: '#f8c830', infoCyan: '#40a0f8',
    successGreen: '#40d870', warningOrange: '#f8b830',
    ground: 0x1a2a1a, grass: 0x2a3a2a, wall: 0x484858, gate: 0x6a5a3a,
    building: 0x2a2a3a, buildingHover: 0x3a3a4a, emptySlot: 0x1e1e2e
};

export const SIN_COLOR_HEX = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0'
};

export const MORALE_COLORS_HEX = {
    desertion: '#f04040', unhappy: '#f8b830', stable: '#a0a0c0',
    elevated: '#40d870', rampage: '#e03030'
};

export const ACTION_STATS = {
    build: { primary: ['strength', 'vitality'], label: '건설' },
    research: { primary: ['intellect', 'perception'], label: '연구' },
    hunt: { primary: ['strength', 'agility'], label: '사냥' }
};

// ═══ 레이아웃 ═══
export const HUD_H = 32;
export const MAP_VP_W = 1280;
export const MAP_VP_H = 440;
export const MAP_WORLD_W = 1280;
export const MAP_WORLD_H = MAP_VP_H;
export const PANEL_Y = HUD_H + MAP_VP_H; // 472
export const PANEL_H = 248;
export const PANEL_TAB_H = 32;
export const PANEL_CONTENT_Y = PANEL_Y + PANEL_TAB_H; // 504
export const PANEL_CONTENT_H = PANEL_H - PANEL_TAB_H; // 216

// 맵 영역 구간
export const ZONE_INSIDE_END = 680;
export const ZONE_OUTSIDE_START = 680;

// 적 접근 경로
export const GATE_X = 445;
export const APPROACH_Y = 213;

// 탭 정의
export const TABS = [
    { id: 'base', icon: '🏰', label: '시설' },
    { id: 'hero', icon: '⚔', label: '영웅' },
    { id: 'item', icon: '🎒', label: '아이템' },
    { id: 'expedition', icon: '🗺', label: '원정' },
    { id: 'policy', icon: '📜', label: '정책' },
    { id: 'bestiary', icon: '📖', label: '도감' },
];

// 건물 슬롯 — 5x5 그리드
export const GRID_X = 34;
export const GRID_Y = 70;
export const GRID_COLS = 5;
export const GRID_ROWS = 5;
export const CELL_W = 65;
export const CELL_H = 65;
export const CELL_GAP = 4;

export const BUILDING_SLOTS = [];
for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
        BUILDING_SLOTS.push({
            x: GRID_X + c * (CELL_W + CELL_GAP) + CELL_W / 2,
            y: GRID_Y + r * (CELL_H + CELL_GAP) + CELL_H / 2,
        });
    }
}
export const PLAZA_INDEX = 12;

// 영외 행동 슬롯
const _OS_GAP = 10;
const _OS_W = 100;
const _OS_COUNT = 5;
const _OS_TOTAL = _OS_COUNT * _OS_W + (_OS_COUNT - 1) * _OS_GAP;
const _OS_START_X = (1280 - _OS_TOTAL) / 2 + _OS_W / 2;
const _OS_Y = 60;
export const OUTSIDE_SLOTS = [
    { x: _OS_START_X + 0 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🛡️', title: '방어 배치', color: 0x4080e0, colorHex: '#4080e0', action: 'defense' },
    { x: _OS_START_X + 1 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🌿', title: '채집', color: 0x30b050, colorHex: '#30b050', action: 'gather' },
    { x: _OS_START_X + 2 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🪓', title: '벌목', color: 0x8a6a3a, colorHex: '#8a6a3a', action: 'lumber' },
    { x: _OS_START_X + 3 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '🏹', title: '사냥', color: 0xd0a020, colorHex: '#d0a020', action: 'hunt' },
    { x: _OS_START_X + 4 * (_OS_W + _OS_GAP), y: _OS_Y, icon: '⚔️', title: '원정', color: 0xe03030, colorHex: '#e03030', action: 'expeditionList' },
];
