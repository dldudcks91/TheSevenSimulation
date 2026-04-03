/**
 * 공유 UI 헬퍼 — Panel과 Popup 양쪽에서 사용하는 위젯
 */
import { C } from './MapConstants.js';
import { FONT, FONT_BOLD } from '../../constants.js';

class MapWidgets {
    constructor(scene) {
        this.scene = scene;
    }

    sectionTitle(x, y, text) {
        const s = this.scene;
        const container = s.add.container(0, 0).setDepth(202);
        const t = s.add.text(x + 4, y, text, {
            fontSize: '11px', fontFamily: FONT_BOLD, color: C.textPrimary
        });
        const g = s.add.graphics();
        g.lineStyle(1, C.borderPrimary);
        g.lineBetween(x, y + 18, x + 580, y + 18);
        container.add([t, g]);
        return container;
    }

    outsetPanel(x, y, w, h) {
        const g = this.scene.add.graphics().setDepth(202);
        g.fillStyle(C.bgSecondary, 1); g.fillRect(x, y, w, h);
        g.lineStyle(2, C.borderSecondary); g.strokeRect(x, y, w, h);
        g.lineStyle(1, C.borderHighlight, 0.3); g.lineBetween(x + 2, y + 2, x + w - 2, y + 2); g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        g.lineStyle(1, C.borderDark, 0.6); g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2); g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
        return g;
    }

    insetPanel(x, y, w, h) {
        const g = this.scene.add.graphics().setDepth(202);
        g.fillStyle(C.inputBg, 1); g.fillRect(x, y, w, h);
        g.lineStyle(2, C.borderPrimary); g.strokeRect(x, y, w, h);
        g.lineStyle(1, C.borderDark, 0.6); g.lineBetween(x + 2, y + 2, x + w - 2, y + 2); g.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        g.lineStyle(1, C.borderHighlight, 0.3); g.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2); g.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
        return g;
    }

    panelButton(cx, y, label, callback) {
        const s = this.scene;
        const bw = 160, bh = 28;
        const x = cx - bw / 2;
        const container = s.add.container(0, 0).setDepth(202);

        const bg = s.add.graphics();
        bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh);
        bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh);
        bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2);
        bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2);
        container.add(bg);

        const text = s.add.text(cx, y + bh / 2, label, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }).setOrigin(0.5);
        container.add(text);

        const zone = s.add.zone(cx, y + bh / 2, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, 0xe03030); bg.strokeRect(x, y, bw, bh); text.setColor('#fff'); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh); bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2); bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2); text.setColor(C.textSecondary); });
        zone.on('pointerdown', callback);
        container.add(zone);
        return container;
    }

    smallPanelBtn(cx, cy, label, callback) {
        const s = this.scene;
        const w = 50, h = 24;
        const x = cx - w / 2, y = cy - h / 2;
        const container = s.add.container(0, 0).setDepth(202);

        const bg = s.add.graphics();
        bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);
        container.add(bg);
        container.add(s.add.text(cx, cy, label, { fontSize: '11px', fontFamily: FONT, color: '#e8e8f0' }).setOrigin(0.5));

        const zone = s.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x401010, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe04040); bg.strokeRect(x, y, w, h); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h); });
        zone.on('pointerdown', callback);
        container.add(zone);
        return container;
    }
    /**
     * 특성 라벨 생성 — [특성명] 대괄호 텍스트 + 호버 시 설명 툴팁
     * @param {number} x - 텍스트 x
     * @param {number} y - 텍스트 y
     * @param {object} trait - { name, pro_effect, con_effect }
     * @param {object} opts - { fontSize, color, origin, depth, pp }
     * @returns {Phaser.GameObjects.Text} 라벨 텍스트
     */
    traitLabel(x, y, trait, opts = {}) {
        const s = this.scene;
        const fontSize = opts.fontSize || '9px';
        const color = opts.color || '#c0a0e0';
        const depth = opts.depth ?? 202;
        const pp = opts.pp || (obj => obj);
        const originX = opts.originX ?? 0;
        const originY = opts.originY ?? 0;

        const label = pp(s.add.text(x, y, `[${trait.name}]`, {
            fontSize, fontFamily: FONT, color
        }).setOrigin(originX, originY).setDepth(depth).setInteractive({ useHandCursor: true }));

        let tip = null;
        label.on('pointerover', (pointer) => {
            label.setColor('#ffffff');
            // 툴팁 생성
            const lines = [];
            if (trait.pro_effect) lines.push(`▲ ${trait.pro_effect}`);
            if (trait.con_effect) lines.push(`▼ ${trait.con_effect}`);
            const tipText = lines.join('\n') || trait.name;
            const tipW = 220;
            const tipH = 14 * lines.length + 16;
            const tx = Math.min(pointer.x, 1280 - tipW - 8);
            const ty = pointer.y - tipH - 8;

            tip = s.add.container(0, 0).setDepth(9999);
            const bg = s.add.graphics();
            bg.fillStyle(0x1a1a2e, 0.95);
            bg.fillRoundedRect(tx, ty, tipW, tipH, 4);
            bg.lineStyle(1, 0xc0a0e0);
            bg.strokeRoundedRect(tx, ty, tipW, tipH, 4);
            tip.add(bg);
            tip.add(s.add.text(tx + 8, ty + 6, tipText, {
                fontSize: '10px', fontFamily: FONT, color: '#e0e0f0',
                lineSpacing: 2, wordWrap: { width: tipW - 16 }
            }));
        });
        label.on('pointerout', () => {
            label.setColor(color);
            if (tip) { tip.destroy(); tip = null; }
        });

        return label;
    }
}

export default MapWidgets;
