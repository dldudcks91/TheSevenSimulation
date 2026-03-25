import TitleScene from './scenes/TitleScene.js';
import HeroSelectScene from './scenes/HeroSelectScene.js';
import MainScene from './scenes/MainScene.js';
import EventScene from './scenes/EventScene.js';
import ActionScene from './scenes/ActionScene.js';
import BattleSceneA from './scenes/BattleSceneA.js';
import BattleSceneB from './scenes/BattleSceneB.js';
import ResultScene from './scenes/ResultScene.js';
import SettlementScene from './scenes/SettlementScene.js';
import DuelBattleScene from './scenes/DuelBattleScene.js';
import GameOverScene from './scenes/GameOverScene.js';

/**
 * 전투씬 A/B 전환
 * 'BattleSceneA' = 돌진형 (카드 배치)
 * 'BattleSceneB' = 필드 이동형 (자유 이동)
 */
const BATTLE_SCENE = 'BattleSceneB';

/**
 * 게임 데이터 로드 후 Phaser 초기화
 */
async function boot() {
    const [heroData, sinRelations, eventsData, facilitiesData, stagesData] = await Promise.all([
        fetch('./data/heroes.json').then(r => r.json()),
        fetch('./data/sin_relations.json').then(r => r.json()),
        fetch('./data/events.json').then(r => r.json()),
        fetch('./data/facilities.json').then(r => r.json()),
        fetch('./data/stages.json').then(r => r.json())
    ]);

    const config = {
        type: Phaser.AUTO,
        width: 1280,
        height: 720,
        parent: 'game-container',
        backgroundColor: '#0a0a12',
        scene: [TitleScene, HeroSelectScene, MainScene, EventScene, ActionScene, BattleSceneA, BattleSceneB, DuelBattleScene, ResultScene, SettlementScene, GameOverScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 1280,
            height: 720
        }
    };

    const game = new Phaser.Game(config);

    game.registry.set('heroData', heroData);
    game.registry.set('sinRelations', sinRelations);
    game.registry.set('eventsData', eventsData);
    game.registry.set('facilitiesData', facilitiesData);
    game.registry.set('stagesData', stagesData);
    game.registry.set('battleScene', BATTLE_SCENE);
}

boot();
