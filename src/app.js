import TitleScene from './scenes/TitleScene.js';
import MainScene from './scenes/MainScene.js';
import EventScene from './scenes/EventScene.js';
import ActionScene from './scenes/ActionScene.js';
import BattleScene from './scenes/BattleScene.js';
import GameOverScene from './scenes/GameOverScene.js';

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
        width: 800,
        height: 600,
        parent: 'game-container',
        backgroundColor: '#0a0a12',
        scene: [TitleScene, MainScene, EventScene, ActionScene, BattleScene, GameOverScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };

    const game = new Phaser.Game(config);

    game.registry.set('heroData', heroData);
    game.registry.set('sinRelations', sinRelations);
    game.registry.set('eventsData', eventsData);
    game.registry.set('facilitiesData', facilitiesData);
    game.registry.set('stagesData', stagesData);
}

boot();
