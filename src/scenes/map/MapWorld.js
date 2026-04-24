/**
 * 맵 영역 렌더링 — 건물 슬롯 + 영외 슬롯 + 접근 경로
 */
import { C, HUD_H, MAP_VP_W, MAP_VP_H, MAP_WORLD_W, MAP_WORLD_H,
    ZONE_INSIDE_END, ZONE_OUTSIDE_START, GATE_X, APPROACH_Y,
    CELL_W, CELL_H, CELL_GAP, BUILDING_SLOTS, PLAZA_INDEX, OUTSIDE_SLOTS
} from './MapConstants.js';
import { FONT, FONT_BOLD } from '../../constants.js';
import store from '../../store/Store.js';
import locale from '../../game_logic/LocaleManager.js';

class MapWorld {
    constructor(scene) {
        this.scene = scene;
        this._approachElements = [];
    }

    draw() {
        const s = this.scene;
        const mc = s.mapContainer;

        // 배경 이미지
        if (s.textures.exists('map_bg')) {
            const bgImg = s.add.image(0, 0, 'map_bg').setOrigin(0, 0);
            const tex = s.textures.get('map_bg').getSourceImage();
            const scale = MAP_WORLD_H / tex.height;
            bgImg.setScale(scale);
            this._bgWidth = tex.width * scale;
            mc.add(bgImg);
        } else {
            const ground = s.add.graphics();
            ground.fillStyle(C.ground, 1);
            ground.fillRect(0, 0, MAP_WORLD_W, MAP_WORLD_H);
            for (let i = 0; i < 80; i++) {
                ground.fillStyle(C.grass, 0.3 + Math.random() * 0.3);
                ground.fillRect(20 + Math.random() * (ZONE_INSIDE_END - 40), 10 + Math.random() * (MAP_WORLD_H - 20), 2, 2);
            }
            ground.fillStyle(0x152015, 0.5);
            ground.fillRect(ZONE_OUTSIDE_START, 0, MAP_WORLD_W - ZONE_OUTSIDE_START, MAP_WORLD_H);
            for (let i = 0; i < 30; i++) {
                const tx = ZONE_OUTSIDE_START + 50 + Math.random() * (MAP_WORLD_W - ZONE_OUTSIDE_START - 100);
                const ty = 30 + Math.random() * (MAP_WORLD_H - 60);
                ground.fillStyle(0x1a3a1a, 0.6);
                ground.fillTriangle(tx, ty - 20, tx - 12, ty + 10, tx + 12, ty + 10);
                ground.fillStyle(0x3a2a1a, 0.8);
                ground.fillRect(tx - 2, ty + 10, 4, 8);
            }
            mc.add(ground);
        }

        // 영내 건물 슬롯 — 5x5
        const hw = CELL_W / 2;
        const hh = CELL_H / 2;
        s.buildingSlots = [];
        BUILDING_SLOTS.forEach((slot, i) => {
            if (i === PLAZA_INDEX) { this._drawPlaza(slot.x, slot.y); return; }
            const slotContainer = s.add.container(slot.x, slot.y);
            const bg = s.add.graphics();
            const isUnlocked = s.baseManager.isCellUnlocked(i);
            if (isUnlocked) {
                this._drawSlotBg(bg, hw, hh, C.emptySlot, 0.35);
            } else {
                this._drawSlotBg(bg, hw, hh, 0x0a0a0a, 0.6, 0x303030);
            }
            slotContainer.add(bg);
            const nameText = s.add.text(0, -8, isUnlocked ? '+건설' : '🔒', { fontSize: '10px', fontFamily: FONT, color: isUnlocked ? C.textMuted : '#505050' }).setOrigin(0.5);
            slotContainer.add(nameText);
            const statusText = s.add.text(0, 8, '', { fontSize: '8px', fontFamily: FONT, color: C.textSecondary }).setOrigin(0.5);
            slotContainer.add(statusText);
            const heroText = s.add.text(0, 22, '', { fontSize: '8px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5);
            slotContainer.add(heroText);
            const zone = s.add.zone(0, 0, CELL_W, CELL_H).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => { this._drawSlotBg(bg, hw, hh, C.buildingHover, 0.5, 0xe03030); });
            zone.on('pointerout', () => { this.updateSlotAppearance(i); });
            zone.on('pointerdown', () => { this.onSlotClick(i); });
            slotContainer.add(zone);
            mc.add(slotContainer);
            s.buildingSlots.push({ bg, nameText, statusText, heroText, slotIndex: i });
        });

        // 영외 행동 슬롯
        const OS_W = 100;
        const OS_H = 80;
        const osHw = OS_W / 2;
        const osHh = OS_H / 2;
        OUTSIDE_SLOTS.forEach((slot) => {
            const container = s.add.container(slot.x, slot.y);
            const bg = s.add.graphics();
            this._drawSlotBg(bg, osHw, osHh, C.emptySlot, 0.3);
            container.add(bg);
            const iconT = s.add.text(0, -14, slot.icon, { fontSize: '22px', fontFamily: FONT }).setOrigin(0.5);
            container.add(iconT);
            const titleT = s.add.text(0, 16, slot.titleKey ? locale.t(slot.titleKey) : slot.title, {
                fontSize: '10px', fontFamily: FONT, color: slot.colorHex,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
            }).setOrigin(0.5);
            container.add(titleT);
            const zone = s.add.zone(0, 0, OS_W, OS_H).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => { this._drawSlotBg(bg, osHw, osHh, C.buildingHover, 0.45, slot.color); });
            zone.on('pointerout', () => { this._drawSlotBg(bg, osHw, osHh, C.emptySlot, 0.3); });
            zone.on('pointerdown', () => { s._showPanelAction(slot.action); });
            container.add(zone);
            mc.add(container);
        });

        this.updateBuildings();
        this.drawApproachPath();
    }

    drawApproachPath() {
        if (this._approachElements) {
            this._approachElements.forEach(el => el.destroy());
        }
        this._approachElements = [];

        const endX = (this._bgWidth || MAP_WORLD_W) - 16;
        const pathLen = endX - GATE_X;
        const dotCount = 7;
        const dotSize = 6;
        const gap = (pathLen - dotCount * dotSize) / (dotCount + 1);

        const g = this.scene.add.graphics();
        g.fillStyle(0xffffff, 0.4);
        for (let i = 0; i < dotCount; i++) {
            const x = GATE_X + gap + i * (dotSize + gap);
            g.fillRect(x, APPROACH_Y - dotSize / 2, dotSize, dotSize);
        }
        this.scene.mapContainer.add(g);
        this._approachElements.push(g);
    }

    initDebugMode() {
        const s = this.scene;
        s._debugOn = true;
        s._debugMarkers = [];

        s._debugCoordText = s.add.text(1270, HUD_H + 4, '', {
            fontSize: '11px', fontFamily: FONT, color: '#00ff88',
            backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(1, 0).setDepth(999).setScrollFactor(0);

        const debugZone = s.add.zone(0, HUD_H, MAP_VP_W, MAP_VP_H)
            .setOrigin(0, 0).setInteractive().setDepth(998);

        debugZone.on('pointermove', (pointer) => {
            if (!s._debugOn) return;
            const mx = Math.round(pointer.x);
            const my = Math.round(pointer.y - HUD_H);
            s._debugCoordText.setText(`x:${mx}  y:${my}`);
        });

        debugZone.on('pointerdown', (pointer) => {
            if (!s._debugOn) return;
            const mx = Math.round(pointer.x);
            const my = Math.round(pointer.y - HUD_H);
            const g = s.add.graphics().setDepth(999);
            g.lineStyle(1, 0x00ff88, 0.8);
            g.lineBetween(mx - 8, pointer.y, mx + 8, pointer.y);
            g.lineBetween(mx, pointer.y - 8, mx, pointer.y + 8);
            const label = s.add.text(mx + 10, pointer.y - 6, `(${mx},${my})`, {
                fontSize: '9px', fontFamily: FONT, color: '#00ff88',
                backgroundColor: '#000000cc', padding: { x: 2, y: 1 }
            }).setDepth(999);
            s._debugMarkers.push(g, label);
        });

        s._debugHint = s.add.text(640, HUD_H + MAP_VP_H - 12,
            '[DEBUG] 맵 클릭 → 좌표 찍기  |  D키: 마커 초기화  |  Shift+D: 디버그 끄기', {
                fontSize: '10px', fontFamily: FONT, color: '#00ff88',
                backgroundColor: '#000000aa', padding: { x: 6, y: 2 }
            }).setOrigin(0.5, 1).setDepth(999);

        s.input.keyboard.on('keydown-D', (event) => {
            if (event.shiftKey) {
                s._debugOn = false;
                s._debugMarkers.forEach(m => m.destroy());
                s._debugMarkers = [];
                s._debugCoordText.setVisible(false);
                s._debugHint.setVisible(false);
                debugZone.disableInteractive();
            } else {
                s._debugMarkers.forEach(m => m.destroy());
                s._debugMarkers = [];
            }
        });
    }

    _drawPlaza(x, y) {
        const s = this.scene;
        const mc = s.mapContainer;
        const hw = CELL_W / 2, hh = CELL_H / 2;
        const g = s.add.graphics();
        g.fillStyle(0x2a1020, 0.45);
        g.fillRoundedRect(-hw, -hh, CELL_W, CELL_H, 3);
        g.lineStyle(1, 0xe03030, 0.4);
        g.strokeRoundedRect(-hw, -hh, CELL_W, CELL_H, 3);
        const container = s.add.container(x, y);
        container.add(g);
        container.add(s.add.text(0, -8, '바알', { fontSize: '12px', fontFamily: FONT_BOLD, color: C.accentRed, shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true } }).setOrigin(0.5));
        container.add(s.add.text(0, 10, '(판결자)', { fontSize: '8px', fontFamily: FONT, color: C.textMuted }).setOrigin(0.5));
        const zone = s.add.zone(0, 0, CELL_W, CELL_H).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => { s._showPanelAction('edict'); });
        container.add(zone);
        mc.add(container);
    }

    _drawSlotBg(bg, hw, hh, fillColor, alpha, borderColor) {
        bg.clear();
        bg.fillStyle(fillColor, alpha);
        bg.fillRoundedRect(-hw, -hh, hw * 2, hh * 2, 3);
        bg.lineStyle(1, borderColor || C.borderPrimary, 0.5);
        bg.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, 3);
    }

    updateBuildings() {
        const s = this.scene;
        if (!s.buildingSlots) return;
        const hw = CELL_W / 2, hh = CELL_H / 2;
        const builtFacilities = s.baseManager.getBuiltFacilities();
        const buildings = s.baseManager.getCurrentBuildings();
        const pioneering = s.baseManager.getCurrentPioneering();
        const buildingBySlot = {};
        buildings.forEach((b, idx) => { buildingBySlot[builtFacilities.length + idx] = b; });

        s.buildingSlots.forEach((slot, i) => {
            const builtItem = builtFacilities[i] || null;
            const buildingItem = buildingBySlot[i] || null;
            const isPioneering = pioneering && pioneering.cellIndex === slot.slotIndex;
            const isUnlocked = s.baseManager.isCellUnlocked(slot.slotIndex);

            if (builtItem) {
                slot.nameText.setText(builtItem.name_ko).setColor(C.textPrimary);
                slot.statusText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, C.building, 0.5);
            } else if (buildingItem) {
                slot.nameText.setText(buildingItem.name).setColor(C.infoCyan);
                const hasHero = !!buildingItem.assignedHeroId;
                slot.statusText.setText(hasHero
                    ? `건설 ${buildingItem.progress}/${buildingItem.buildCost}`
                    : `대기 ${buildingItem.progress}/${buildingItem.buildCost}`);
                this._drawSlotBg(slot.bg, hw, hh, hasHero ? 0x1e2e1e : 0x2e2e1e, 0.6, hasHero ? 0x40a060 : 0xa0a040);
            } else if (isPioneering) {
                slot.nameText.setText('개척 중').setColor('#c89050');
                slot.statusText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, 0x2a2010, 0.6, 0xc89050);
            } else if (!isUnlocked) {
                slot.nameText.setText('🔒').setColor('#505050');
                slot.statusText.setText(''); slot.heroText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, 0x0a0a0a, 0.6, 0x303030);
            } else {
                slot.nameText.setText('+건설').setColor(C.textMuted); slot.statusText.setText(''); slot.heroText.setText('');
                this._drawSlotBg(slot.bg, hw, hh, C.emptySlot, 0.35);
            }
        });
    }

    updateSlotAppearance(i) {
        const s = this.scene;
        const slot = s.buildingSlots.find(sl => sl.slotIndex === i);
        if (!slot) return;
        const hw = CELL_W / 2, hh = CELL_H / 2;
        const built = this.getSlotBuilding(i);
        const isUnlocked = s.baseManager.isCellUnlocked(i);
        if (built) {
            this._drawSlotBg(slot.bg, hw, hh, C.building, 0.5);
        } else if (!isUnlocked) {
            this._drawSlotBg(slot.bg, hw, hh, 0x0a0a0a, 0.6, 0x303030);
        } else {
            this._drawSlotBg(slot.bg, hw, hh, C.emptySlot, 0.35);
        }
    }

    getSlotBuilding(i) {
        return this.scene.baseManager.getBuiltFacilities()[i] || null;
    }

    onSlotClick(i) {
        const s = this.scene;
        if (s.turnManager.getCurrentTurn().phase !== 'day') return;
        const isUnlocked = s.baseManager.isCellUnlocked(i);
        if (!isUnlocked) {
            s._showPanelAction('pioneer', { cellIndex: i });
            return;
        }
        const built = this.getSlotBuilding(i);
        if (built) {
            s._showPanelAction('facility', { facility: built });
            return;
        }
        const builtCount = s.baseManager.getBuiltFacilities().length;
        const buildings = s.baseManager.getCurrentBuildings();
        const buildingItem = buildings[i - builtCount];
        if (buildingItem) {
            s._showPanelAction('buildingInfo', { building: buildingItem });
            return;
        }
        s._showPanelAction('build');
    }
}

export default MapWorld;
