/**
 * 스프라이트 관련 공유 상수/유틸
 *
 * BattleSceneA, BattleSceneB, MapDefenseMode, MapHuntPopup에서
 * 중복 선언되던 상수들을 한 곳에서 관리.
 */

export const FRAME_SIZE = 64;
export const ANIM_FPS = 8;

export const SHEET_CONFIG = {
    idle:  { frames: 2, rows: 4 },
    walk:  { frames: 9, rows: 4 },
    slash: { frames: 6, rows: 4 },
    hurt:  { frames: 6, rows: 1 }
};

export const DIR_EAST = 3;
export const DIR_WEST = 1;

export const DEFAULT_SPRITE = 'warrior_male';

export const MONSTER_SPRITES = [
    'monster_slime', 'monster_bat', 'monster_snake', 'monster_ghost',
    'monster_eyeball', 'monster_pumpking', 'monster_bee', 'monster_worm',
];

export const BOSS_SPRITES = ['boss_demon', 'boss_shadow'];

export const ENEMY_NAME_SPRITE_MAP = {
    '박쥐': 'monster_bat',
    '사냥개': 'monster_worm',
    '졸개': 'monster_slime',
    '전사': 'monster_ghost',
    '마법사': 'monster_eyeball',
    '근위병': 'monster_pumpking',
    '정예': 'monster_snake',
    '꽃': 'monster_bee',
    '늑대': 'monster_worm',
    '멧돼지': 'monster_slime',
    '거미': 'monster_bee',
    '곰': 'monster_pumpking',
    '벌레': 'monster_worm',
    '유령': 'monster_ghost',
    '슬라임': 'monster_slime',
    '뱀': 'monster_snake',
    '눈알': 'monster_eyeball',
    '호박': 'monster_pumpking',
};

export function pickEnemySprite(name, index = 0) {
    if (name.includes('—') || name.includes('화신')) {
        return BOSS_SPRITES[index % BOSS_SPRITES.length];
    }
    for (const [keyword, sprite] of Object.entries(ENEMY_NAME_SPRITE_MAP)) {
        if (name.includes(keyword)) return sprite;
    }
    return MONSTER_SPRITES[index % MONSTER_SPRITES.length];
}

export const SIN_SPRITE_MAP = {
    wrath: 'hero_wrath',
    envy: 'hero_envy',
    greed: 'hero_greed',
    sloth: 'hero_sloth',
    gluttony: 'hero_gluttony',
    lust: 'hero_lust',
    pride: 'hero_pride',
};

export const HERO_SPRITE_TYPES = Object.values(SIN_SPRITE_MAP);

export const UNIT_STATE = {
    IDLE: 'idle',
    WALKING: 'walking',
    ATTACKING: 'attacking',
    HURT: 'hurt',
    DEAD: 'dead'
};
