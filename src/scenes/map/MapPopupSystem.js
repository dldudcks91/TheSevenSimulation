/**
 * 팝업 스택 관리 + 공통 버튼 위젯
 */
import { C } from './MapConstants.js';
import { FONT } from '../../constants.js';

class MapPopupSystem {
    constructor(scene) {
        this.scene = scene;
        this._popupStack = [];
    }

    /** 팝업 쌓기 — 현재 팝업 위에 새 팝업 추가 */
    pushPopup(mode, data = {}) {
        const s = this.scene;
        const level = this._popupStack.length;
        const baseDepth = 300 + level * 100;
        const layer = { elements: [], baseDepth };
        this._popupStack.push(layer);

        const width = 1280, height = 720;
        const overlay = s.add.rectangle(width / 2, height / 2, width, height, 0x000000, level > 0 ? 0.5 : 0.6)
            .setInteractive().setDepth(baseDepth);
        if (level > 0) overlay.on('pointerdown', () => this.closePopup());
        layer.elements.push(overlay);

        const PW = (mode === '_confirm' || mode === 'buildingInfo') ? 400 : 560;
        const PH = mode === 'heroDetail' ? 680 : (mode === '_confirm' || mode === 'buildingInfo') ? 220 : 520;
        const px = (width - PW) / 2;
        const py = (height - PH) / 2;

        const popBg = s.add.graphics().setDepth(baseDepth + 1);
        popBg.fillStyle(C.bgSecondary, 1);
        popBg.fillRoundedRect(px, py, PW, PH, 6);
        popBg.lineStyle(2, C.borderSecondary);
        popBg.strokeRoundedRect(px, py, PW, PH, 6);
        popBg.lineStyle(1, C.borderHighlight, 0.25);
        popBg.lineBetween(px + 3, py + 3, px + PW - 3, py + 3);
        popBg.lineBetween(px + 3, py + 3, px + 3, py + PH - 3);
        popBg.lineStyle(1, C.borderDark, 0.5);
        popBg.lineBetween(px + PW - 3, py + 3, px + PW - 3, py + PH - 3);
        popBg.lineBetween(px + 3, py + PH - 3, px + PW - 3, py + PH - 3);
        layer.elements.push(popBg);

        return { px, py, pw: PW, ph: PH };
    }

    /** 최상위 팝업 1개만 닫기 */
    closePopup() {
        if (this._popupStack.length === 0) return;
        const layer = this._popupStack.pop();
        layer.elements.forEach(el => el.destroy());
    }

    /** 모든 팝업 닫기 */
    closeAllPopups() {
        while (this._popupStack.length > 0) {
            const layer = this._popupStack.pop();
            layer.elements.forEach(el => el.destroy());
        }
    }

    /** 현재 최상위 레이어에 요소 추가 */
    pp(element) {
        if (this._popupStack.length === 0) {
            element.setDepth(302);
            return element;
        }
        const layer = this._popupStack[this._popupStack.length - 1];
        element.setDepth(layer.baseDepth + 2);
        layer.elements.push(element);
        return element;
    }

    /** 팝업 닫기 버튼 */
    popupCloseBtn(px, py, pw, ph) {
        const cx = px + pw / 2;
        const y = py + ph - 40;
        this.pp(this.popupButton(cx, y, '닫기', () => {
            this.closeAllPopups();
            this.scene._actionMode = null;
            this.scene._actionData = null;
        }));
    }

    /** 팝업용 버튼 */
    popupButton(cx, cy, label, callback) {
        const s = this.scene;
        const bw = 140, bh = 30;
        const x = cx - bw / 2, y = cy - bh / 2;
        const container = s.add.container(0, 0);

        const bg = s.add.graphics();
        bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh);
        bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh);
        bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2);
        bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2);
        container.add(bg);

        const text = s.add.text(cx, cy, label, { fontSize: '11px', fontFamily: FONT, color: C.textSecondary }).setOrigin(0.5);
        container.add(text);

        const zone = s.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, 0xe03030); bg.strokeRect(x, y, bw, bh); text.setColor('#fff'); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, bw, bh); bg.lineStyle(2, C.borderSecondary); bg.strokeRect(x, y, bw, bh); bg.lineStyle(1, C.borderHighlight, 0.2); bg.lineBetween(x + 2, y + 2, x + bw - 2, y + 2); bg.lineStyle(1, C.borderDark, 0.5); bg.lineBetween(x + 2, y + bh - 2, x + bw - 2, y + bh - 2); text.setColor(C.textSecondary); });
        zone.on('pointerdown', callback);
        container.add(zone);
        return container;
    }

    /** 팝업용 작은 버튼 */
    popupSmallBtn(cx, cy, label, callback) {
        const s = this.scene;
        const w = 60, h = 26;
        const x = cx - w / 2, y = cy - h / 2;
        const container = s.add.container(0, 0);

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

    get hasPopups() {
        return this._popupStack.length > 0;
    }
}

export default MapPopupSystem;
