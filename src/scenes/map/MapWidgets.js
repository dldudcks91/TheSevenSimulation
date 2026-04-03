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
}

export default MapWidgets;
