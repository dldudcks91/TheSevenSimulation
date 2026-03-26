import TitleScene from './scenes/TitleScene.js';
import HeroSelectScene from './scenes/HeroSelectScene.js';
import MainScene from './scenes/MainScene.js';
import EventScene from './scenes/EventScene.js';
import BattleSceneA from './scenes/BattleSceneA.js';
import BattleSceneB from './scenes/BattleSceneB.js';
import ResultScene from './scenes/ResultScene.js';
import SettlementScene from './scenes/SettlementScene.js';
import DuelBattleScene from './scenes/DuelBattleScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import { loadAllCsv, buildGameData } from './data/CsvLoader.js';

/**
 * 전투씬 A/B 전환
 * 'BattleSceneA' = X축 오토배틀 + 일기토 (MELEE 모드)
 * 'BattleSceneB' = X축 태그매치 (TAG 모드)
 */
const BATTLE_SCENE = 'BattleSceneA';

/**
 * 게임 데이터 로드 후 Phaser 초기화
 * CSV 파일을 전부 로드 → JS 객체로 조립 → registry에 등록
 */
async function boot() {
    // 모든 CSV 한번에 로드
    const csvData = await loadAllCsv('./data/');
    const gameData = buildGameData(csvData);

    const config = {
        type: Phaser.AUTO,
        width: 1280,
        height: 720,
        parent: 'game-container',
        backgroundColor: '#0a0a12',
        scene: [TitleScene, HeroSelectScene, MainScene, EventScene, BattleSceneA, BattleSceneB, DuelBattleScene, ResultScene, SettlementScene, GameOverScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 1280,
            height: 720
        }
    };

    const game = new Phaser.Game(config);

    // CSV에서 조립된 데이터를 registry에 등록
    game.registry.set('heroData', gameData.heroData);
    game.registry.set('sinRelations', gameData.sinRelations);
    game.registry.set('eventsData', gameData.eventsData);
    game.registry.set('facilitiesData', gameData.facilitiesData);
    game.registry.set('stagesData', gameData.stagesData);
    game.registry.set('chapters', gameData.chapters);
    game.registry.set('balance', gameData.balance);
    game.registry.set('policies', gameData.policies);
    game.registry.set('huntEnemies', gameData.huntEnemies);
    game.registry.set('defenseScaling', gameData.defenseScaling);
    game.registry.set('phases', gameData.phases);
    game.registry.set('moraleStates', gameData.moraleStates);
    game.registry.set('desertionEffects', gameData.desertionEffects);
    game.registry.set('battleScene', BATTLE_SCENE);
    game.registry.set('battleCards', gameData.battleCards || []);
    game.registry.set('lpcParts', gameData.lpcParts || []);
    game.registry.set('heroEpithets', gameData.heroEpithets || []);
}

boot();
