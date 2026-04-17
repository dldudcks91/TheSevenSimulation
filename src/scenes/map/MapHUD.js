/**
 * 상단 HUD (32px 고정)
 */
import { C, HUD_H } from './MapConstants.js';
import { FONT, FONT_BOLD } from '../../constants.js';
import store from '../../store/Store.js';
import SaveManager from '../../store/SaveManager.js';
import { SIN_KEYS, SIN_NAMES_KO, makeDefaultPlayerSins } from '../../game_logic/SinUtils.js';

class MapHUD {
    constructor(scene) {
        this.scene = scene;
    }

    draw() {
        const s = this.scene;
        const width = 1280;
        const g = s.add.graphics().setDepth(200);
        g.fillStyle(C.bgSecondary, 1);
        g.fillRect(0, 0, width, HUD_H);
        g.lineStyle(1, C.borderDark);
        g.lineBetween(0, HUD_H - 1, width, HUD_H - 1);
        g.lineStyle(2, C.borderSecondary);
        g.lineBetween(0, HUD_H, width, HUD_H);

        s.add.text(10, HUD_H / 2, 'THE SEVEN', {
            fontSize: '13px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 1, offsetY: 1, color: '#400000', blur: 0, fill: true }
        }).setOrigin(0, 0.5).setDepth(201);

        const sep1 = s.add.graphics().setDepth(201);
        sep1.lineStyle(1, C.borderPrimary);
        sep1.lineBetween(100, 6, 100, HUD_H - 6);

        s.dayText = s.add.text(114, HUD_H / 2, '', {
            fontSize: '13px', fontFamily: FONT_BOLD, color: C.textPrimary
        }).setOrigin(0, 0.5).setDepth(201);

        s.phaseText = s.add.text(200, HUD_H / 2, '', {
            fontSize: '13px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0, 0.5).setDepth(201);

        const sep2 = s.add.graphics().setDepth(201);
        sep2.lineStyle(1, C.borderPrimary);
        sep2.lineBetween(290, 6, 290, HUD_H - 6);

        s.foodText = s.add.text(306, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT_BOLD, color: '#80d040'
        }).setOrigin(0, 0.5).setDepth(201);

        s.woodText = s.add.text(380, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT_BOLD, color: '#c89050'
        }).setOrigin(0, 0.5).setDepth(201);

        s.goldText = s.add.text(454, HUD_H / 2, '', {
            fontSize: '12px', fontFamily: FONT_BOLD, color: C.expYellow
        }).setOrigin(0, 0.5).setDepth(201);

        s.defenseText = s.add.text(540, HUD_H / 2, '', {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0, 0.5).setDepth(201);

        // 바알 죄종 — 가장 높은 수치 1개 표시 (클릭 시 전체 팝업)
        s.baalSinText = s.add.text(730, HUD_H / 2, '', {
            fontSize: '11px', fontFamily: FONT, color: '#e040a0'
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(201);
        s.baalSinText.on('pointerdown', () => this._showBaalSinPopup());

        this._drawNavButton(width - 200, 4, 65, HUD_H - 8, '턴 종료', C.accentRed, () => s._onEndTurn());
        this._drawNavButton(width - 128, 4, 45, HUD_H - 8, '저장', C.textMuted, () => { SaveManager.save(store); });

        // 전투씬 A/B 전환
        const currentScene = s.registry.get('battleScene') || 'BattleSceneA';
        const btnLabel = currentScene === 'BattleSceneA' ? '전투:A' : '전투:B';
        s._battleToggleBtn = s.add.text(width - 68, HUD_H / 2, `[${btnLabel}]`, {
            fontSize: '10px', fontFamily: FONT, color: '#f8c830'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(201);
        s._battleToggleBtn.on('pointerdown', () => {
            const cur = s.registry.get('battleScene') || 'BattleSceneA';
            const next = cur === 'BattleSceneA' ? 'BattleSceneB' : 'BattleSceneA';
            s.registry.set('battleScene', next);
            s.expeditionManager.setBattleMode(next === 'BattleSceneA' ? 'melee' : 'tag');
            s._battleToggleBtn.setText(`[${next === 'BattleSceneA' ? '전투:A' : '전투:B'}]`);
        });

        // 원정 모드 토글 레이블
        const expModeLabel = s.add.text(width - 95, HUD_H / 2, '', {
            fontSize: '10px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0.5).setDepth(201);
        const updateExpLabel = () => {
            const mode = s.registry.get('expeditionMode') || 'node';
            expModeLabel.setText(mode === 'node' ? '[원정:노드]' : '[원정:주사위]');
        };
        updateExpLabel();

        const settingsIcon = s.add.text(width - 24, HUD_H / 2, '⚙', {
            fontSize: '18px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(201);
        settingsIcon.on('pointerover', () => settingsIcon.setColor(C.textPrimary));
        settingsIcon.on('pointerout', () => settingsIcon.setColor(C.textMuted));
        settingsIcon.on('pointerdown', () => {
            const cur = s.registry.get('expeditionMode') || 'node';
            s.registry.set('expeditionMode', cur === 'node' ? 'dice' : 'node');
            updateExpLabel();
        });
    }

    _drawNavButton(x, y, w, h, label, accentColor, callback) {
        const s = this.scene;
        const bg = s.add.graphics().setDepth(201);
        bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, C.borderSecondary); bg.strokeRect(x, y, w, h);

        const text = s.add.text(x + w / 2, y + h / 2, label, {
            fontSize: '11px', fontFamily: FONT, color: accentColor
        }).setOrigin(0.5).setDepth(201);

        const zone = s.add.zone(x + w / 2, y + h / 2, w, h)
            .setInteractive({ useHandCursor: true }).setDepth(201);
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);
            text.setColor('#ffffff');
        });
        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(1, C.borderSecondary); bg.strokeRect(x, y, w, h);
            text.setColor(accentColor);
        });
        zone.on('pointerdown', callback);
    }

    updateResources() {
        const s = this.scene;
        s.foodText.setText(`🌾${store.getState('food') || 0}`);
        s.woodText.setText(`🪵${store.getState('wood') || 0}`);
        s.goldText.setText(`💰${store.getState('gold') || 0}`);
    }

    updateBaalSins() {
        const s = this.scene;
        if (!s.baalSinText) return;
        const ps = store.getState('playerSins') || makeDefaultPlayerSins();
        let topKey = SIN_KEYS[0], topVal = -1;
        for (const k of SIN_KEYS) {
            const v = ps[k] ?? 50;
            if (v > topVal) { topVal = v; topKey = k; }
        }
        s.baalSinText.setText(`👑 ${SIN_NAMES_KO[topKey]}(${topVal})`);
    }

    _showBaalSinPopup() {
        const s = this.scene;
        const ps = store.getState('playerSins') || makeDefaultPlayerSins();
        const lines = SIN_KEYS.map(k => `${SIN_NAMES_KO[k]}  ${ps[k] ?? 50}`);
        const w = 240, h = 60 + lines.length * 18;
        const x = (1280 - w) / 2, y = (720 - h) / 2;
        const D = 7000;

        const g = s.add.graphics().setDepth(D);
        g.fillStyle(0x0a0a12, 0.96); g.fillRoundedRect(x, y, w, h, 8);
        g.lineStyle(2, 0xe040a0); g.strokeRoundedRect(x, y, w, h, 8);

        const title = s.add.text(x + w / 2, y + 16, '👑 바알 죄종 수치', {
            fontSize: '13px', fontFamily: FONT_BOLD, color: '#e040a0'
        }).setOrigin(0.5).setDepth(D + 1);

        const texts = [];
        let ty = y + 40;
        for (const line of lines) {
            texts.push(s.add.text(x + 20, ty, line, {
                fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
            }).setDepth(D + 1));
            ty += 18;
        }

        const close = s.add.zone(x + w / 2, y + h / 2, w, h)
            .setInteractive({ useHandCursor: true }).setDepth(D + 2);
        close.on('pointerdown', () => {
            g.destroy(); title.destroy(); texts.forEach(t => t.destroy()); close.destroy();
        });
    }

    updatePhaseDisplay() {
        const s = this.scene;
        const turn = s.turnManager.getCurrentTurn();
        s.dayText.setText(`Day ${turn.day}`);
        s.phaseText.setText(`[${s.turnManager.getPhaseName()}]`);
        if (s.world) s.world.drawApproachPath();
    }
}

export default MapHUD;
