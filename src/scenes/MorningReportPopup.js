/**
 * MorningReportPopup — MapScene 위 아침 보고 팝업
 *
 * 매 턴 아침, 이벤트 전에 표시.
 * 위험 영웅(사기 80+/25-)은 개별 서사 표시, 안정 영웅은 "더보기"로 접힘.
 * 감시탑 습격 예고 포함.
 */
import { FONT } from '../constants.js';

const POP_W = 620;
const POP_MIN_H = 200;
const POP_MAX_H = 580;

const SIN_COLORS = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0',
};

class MorningReportPopup {
    /**
     * @param {Phaser.Scene} scene - MapScene
     * @param {Object} reportData - MorningReport.generate() 결과
     * @param {Function} onClose - 닫기 콜백
     */
    constructor(scene, reportData, onClose) {
        this.scene = scene;
        this.data = reportData;
        this.onClose = onClose || (() => {});
        this._container = null;
        this._expanded = false;
        this._stableContainer = null;
        this._expandBtn = null;
    }

    show() {
        const { width, height } = this.scene.scale;

        // 콘텐츠 높이 계산
        let contentH = 60; // 헤더
        contentH += this.data.alerts.length * 52;
        if (this.data.stables.length > 0) contentH += 36; // 더보기 버튼
        if (this.data.raidInfo && this.data.raidInfo.text) contentH += 40;
        contentH += 50; // 확인 버튼
        contentH = Math.max(POP_MIN_H, Math.min(POP_MAX_H, contentH));

        const popH = contentH;
        const ox = Math.floor((width - POP_W) / 2);
        const oy = Math.floor((height - popH) / 2);

        this._container = this.scene.add.container(0, 0).setDepth(5000);

        // 딤
        const dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5);
        dim.setInteractive();
        this._container.add(dim);

        // 팝업 배경
        this._popBg = this.scene.add.graphics();
        this._drawPopBg(ox, oy, POP_W, popH);
        this._container.add(this._popBg);

        this._ox = ox;
        this._oy = oy;
        this._popH = popH;

        let y = oy + 12;

        // 헤더
        const dayText = this.scene.registry.get('currentDay') || '';
        const title = this.scene.add.text(ox + POP_W / 2, y, `☀ 아침 보고${dayText ? ' — ' + dayText + '일차' : ''}`, {
            fontSize: '14px', fontFamily: FONT, color: '#f8c830',
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);
        this._container.add(title);
        y += 28;

        // 구분선
        const line1 = this.scene.add.graphics();
        line1.lineStyle(1, 0x484868);
        line1.lineBetween(ox + 16, y, ox + POP_W - 16, y);
        this._container.add(line1);
        y += 8;

        // 위험 영웅 (alerts)
        if (this.data.alerts.length === 0 && this.data.stables.length > 0) {
            const peaceful = this.scene.add.text(ox + POP_W / 2, y + 6, '거점은 평온합니다', {
                fontSize: '12px', fontFamily: FONT, color: '#a0a0c0'
            }).setOrigin(0.5);
            this._container.add(peaceful);
            y += 28;
        }

        for (const alert of this.data.alerts) {
            y = this._drawHeroEntry(ox, y, alert, true);
        }

        // 더보기 (안정 영웅)
        if (this.data.stables.length > 0) {
            y += 4;
            const stableLabel = `▸ 나머지 ${this.data.stables.length}명 (안정)`;
            this._expandBtn = this.scene.add.text(ox + 20, y, stableLabel, {
                fontSize: '10px', fontFamily: FONT, color: '#606080'
            }).setInteractive({ useHandCursor: true });
            this._expandBtn.on('pointerdown', () => this._toggleExpand());
            this._container.add(this._expandBtn);
            this._expandY = y + 18;
            y += 24;

            // 접힌 안정 영웅 컨테이너 (초기 숨김)
            this._stableContainer = this.scene.add.container(0, 0);
            this._stableContainer.setVisible(false);
            this._container.add(this._stableContainer);

            let sy = this._expandY;
            for (const stable of this.data.stables) {
                sy = this._drawHeroEntry(ox, sy, stable, false, this._stableContainer);
            }
            this._stableEndY = sy;
        }

        // 감시탑 습격 정보
        if (this.data.raidInfo && this.data.raidInfo.text) {
            y += 4;
            const raidLine = this.scene.add.graphics();
            raidLine.lineStyle(1, 0x303048);
            raidLine.lineBetween(ox + 16, y, ox + POP_W - 16, y);
            this._container.add(raidLine);
            y += 8;

            const raidIcon = this.scene.add.text(ox + 20, y, '🏰', { fontSize: '12px' });
            this._container.add(raidIcon);

            const raidText = this.scene.add.text(ox + 40, y, this.data.raidInfo.text, {
                fontSize: '10px', fontFamily: FONT, color: '#f8b830'
            });
            this._container.add(raidText);

            if (this.data.raidInfo.detail) {
                const detailText = this.scene.add.text(ox + 40, y + 16, this.data.raidInfo.detail, {
                    fontSize: '9px', fontFamily: FONT, color: '#808898'
                });
                this._container.add(detailText);
                y += 32;
            } else {
                y += 18;
            }
        }

        // 확인 버튼
        y += 12;
        this._drawConfirmBtn(ox + POP_W / 2, y);
    }

    _drawPopBg(x, y, w, h) {
        this._popBg.clear();
        this._popBg.fillStyle(0x0a0a12, 0.95);
        this._popBg.fillRoundedRect(x, y, w, h, 8);
        this._popBg.lineStyle(2, 0x484868);
        this._popBg.strokeRoundedRect(x, y, w, h, 8);
    }

    _drawHeroEntry(ox, y, entry, isAlert, container) {
        const target = container || this._container;
        const sinColor = SIN_COLORS[entry.sinType] || '#a0a0c0';

        // 아이콘 + 이름
        const icon = isAlert ? (entry.level === 'high' ? '⚠' : '⚠') : '·';
        const iconColor = entry.level === 'high' ? '#e03030' : entry.level === 'low' ? '#f8b830' : '#606080';

        const iconText = this.scene.add.text(ox + 18, y + 2, icon, {
            fontSize: isAlert ? '12px' : '10px', fontFamily: FONT, color: iconColor
        });
        target.add(iconText);

        // 이름 (수식어 포함)
        const displayName = entry.epithet ? `"${entry.epithet}" ${entry.name}` : entry.name;
        const nameText = this.scene.add.text(ox + 36, y + 2, displayName, {
            fontSize: isAlert ? '11px' : '10px', fontFamily: FONT, color: '#e8e8f0'
        });
        target.add(nameText);

        // 죄종 태그
        const sinTag = this.scene.add.text(ox + 36 + nameText.width + 8, y + 3, `[${entry.sinName}]`, {
            fontSize: '9px', fontFamily: FONT, color: sinColor
        });
        target.add(sinTag);

        // 사기 수치
        if (isAlert) {
            const moraleColor = entry.level === 'high' ? '#e03030' : '#f8b830';
            const arrow = entry.level === 'high' ? '▲' : '▼';
            const moraleText = this.scene.add.text(ox + POP_W - 80, y + 3, `사기 ${entry.morale} ${arrow}`, {
                fontSize: '9px', fontFamily: FONT, color: moraleColor
            });
            target.add(moraleText);
        }

        // 서사 텍스트
        const desc = this.scene.add.text(ox + 36, y + (isAlert ? 18 : 16), entry.text, {
            fontSize: '9px', fontFamily: FONT, color: isAlert ? '#c0c0d0' : '#606080',
            fontStyle: 'italic'
        });
        target.add(desc);

        // 부상 표시
        if (entry.status === 'injured') {
            const injText = this.scene.add.text(ox + 36 + desc.width + 8, y + (isAlert ? 18 : 16), '[부상]', {
                fontSize: '8px', fontFamily: FONT, color: '#e03030'
            });
            target.add(injText);
        }

        let extraH = 0;

        // 죄종 조건 텍스트 (현재 상태 원인)
        if (entry.condition) {
            const condY = y + (isAlert ? 32 : 28);
            const condColor = entry.condition.type === 'unhappy' ? '#f8b830' : '#40d870';
            const condIcon = entry.condition.type === 'unhappy' ? '▸' : '▸';
            const condText = this.scene.add.text(ox + 42, condY, `${condIcon} ${entry.condition.text}`, {
                fontSize: '8px', fontFamily: FONT, color: condColor
            });
            target.add(condText);
            extraH = 14;
        }

        return y + (isAlert ? 44 : 36) + extraH;
    }

    _toggleExpand() {
        this._expanded = !this._expanded;
        this._stableContainer.setVisible(this._expanded);
        this._expandBtn.setText(
            this._expanded
                ? `▾ 나머지 ${this.data.stables.length}명 (안정) — 접기`
                : `▸ 나머지 ${this.data.stables.length}명 (안정)`
        );

        // 팝업 높이 재계산
        if (this._expanded) {
            const extraH = this._stableEndY - this._expandY;
            const newH = Math.min(POP_MAX_H, this._popH + extraH);
            this._drawPopBg(this._ox, this._oy, POP_W, newH);
        } else {
            this._drawPopBg(this._ox, this._oy, POP_W, this._popH);
        }
    }

    _drawConfirmBtn(cx, cy) {
        const btnW = 100;
        const btnH = 28;

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x1a1a2a, 1);
        bg.fillRect(cx - btnW / 2, cy, btnW, btnH);
        bg.lineStyle(1, 0x484868);
        bg.strokeRect(cx - btnW / 2, cy, btnW, btnH);
        this._container.add(bg);

        const text = this.scene.add.text(cx, cy + btnH / 2, '확 인', {
            fontSize: '11px', fontFamily: FONT, color: '#e8e8f0'
        }).setOrigin(0.5);
        this._container.add(text);

        const zone = this.scene.add.zone(cx, cy + btnH / 2, btnW, btnH)
            .setInteractive({ useHandCursor: true }).setDepth(5001);
        zone.on('pointerdown', () => {
            this._container.destroy();
            this._container = null;
            this.onClose();
        });
        this._container.add(zone);
    }

    destroy() {
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}

export default MorningReportPopup;
