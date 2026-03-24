/**
 * 낮 페이즈 행동 선택 오버레이
 * 건설 / 연구 / 원정 / 고용 / 포고령
 */
import store from '../store/Store.js';

const FONT = 'Galmuri11, Galmuri9, monospace';
const C = {
    cardBg: '#161624', borderPrimary: '#303048', borderHighlight: '#a0a0c0',
    borderDark: '#18182a', textPrimary: '#e8e8f0', textSecondary: '#a0a0c0',
    textMuted: '#606080', accentRed: '#e03030', expYellow: '#f8c830',
    infoCyan: '#40a0f8', successGreen: '#40d870'
};

const SIN_COLORS = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0'
};

class ActionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ActionScene' });
    }

    init(data) {
        this.baseManager = data.baseManager;
        this.heroManager = data.heroManager;
        this.expeditionManager = data.expeditionManager;
        this.onComplete = data.onComplete || (() => {});
        this.mode = 'menu'; // menu, build, research, expedition, recruit
    }

    create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this._showMenu();
    }

    _clearUI() {
        this.children.list.slice(1).forEach(c => c.destroy()); // 배경 유지
    }

    // ─── 메인 메뉴 ───
    _showMenu() {
        this._clearUI();
        this.mode = 'menu';
        const { width, height } = this.scale;

        this._panel(width / 2 - 200, 60, 400, 480);
        this.add.text(width / 2, 80, '[ 낮 — 행동 선택 ]', {
            fontSize: '16px', fontFamily: FONT, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        const gold = store.getState('gold') || 0;
        this.add.text(width / 2, 104, `보유 골드: ${gold}G`, {
            fontSize: '11px', fontFamily: FONT, color: C.expYellow
        }).setOrigin(0.5);

        // 현재 상태 요약
        const building = this.baseManager.getCurrentBuilding();
        const researching = this.baseManager.getCurrentResearch();
        const expedition = store.getState('expedition');
        let statusY = 124;

        if (building) {
            this.add.text(width / 2, statusY, `건설 중: ${building.name} (${building.turnsLeft}턴)`, {
                fontSize: '9px', fontFamily: FONT, color: C.infoCyan
            }).setOrigin(0.5);
            statusY += 16;
        }
        if (researching) {
            this.add.text(width / 2, statusY, `연구 중: ${researching.name} (${researching.turnsLeft}턴)`, {
                fontSize: '9px', fontFamily: FONT, color: C.infoCyan
            }).setOrigin(0.5);
            statusY += 16;
        }
        if (expedition && expedition.active) {
            this.add.text(width / 2, statusY, `원정 진행 중`, {
                fontSize: '9px', fontFamily: FONT, color: C.expYellow
            }).setOrigin(0.5);
            statusY += 16;
        }

        const btnY = Math.max(statusY + 20, 160);
        const actions = [
            { label: '🔨 건설', action: () => this._showBuild(), enabled: !building },
            { label: '📖 연구', action: () => this._showResearch(), enabled: !researching },
            { label: '⚔️ 원정 파견', action: () => this._showExpedition(), enabled: !(expedition && expedition.active) },
            { label: '🍺 영웅 고용', action: () => this._showRecruit(), enabled: true },
            { label: '📜 포고령', action: () => this._showPolicy(), enabled: true },
            { label: '▶ 턴 넘기기', action: () => this._finish(), enabled: true }
        ];

        actions.forEach((a, i) => {
            this._menuBtn(width / 2, btnY + i * 48, a.label, a.action, a.enabled);
        });
    }

    // ─── 건설 ───
    _showBuild() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 40, width - 120, 520);

        this.add.text(width / 2, 56, '[ 건설 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const available = this.baseManager.getAvailableBuilds();
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        if (available.length === 0) {
            this.add.text(width / 2, 120, '건설 가능한 시설이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            available.slice(0, 8).forEach((f, i) => {
                const y = 84 + i * 48;
                this._itemBtn(80, y, width - 160, 40,
                    `${f.name_ko} (T${f.tier})`,
                    `${f.description} — ${f.cost}G, ${f.build_turns}턴`,
                    () => {
                        if (heroes.length > 0) {
                            const hero = heroes[0];
                            const result = this.baseManager.startBuilding(f.id, hero.id);
                            if (result.success) {
                                this.onComplete({ log: `${hero.name}가 ${f.name_ko} 건설을 시작합니다.` });
                                this._showMenu();
                            }
                        }
                    }
                );
            });
        }

        this._backBtn(width / 2, 520);
    }

    // ─── 연구 ───
    _showResearch() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 40, width - 120, 520);

        this.add.text(width / 2, 56, '[ 연구 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const available = this.baseManager.getAvailableResearch();
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        if (available.length === 0) {
            this.add.text(width / 2, 120, '연구 가능한 항목이 없습니다. (시설을 먼저 건설하세요)', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            available.slice(0, 8).forEach((r, i) => {
                const y = 84 + i * 48;
                this._itemBtn(80, y, width - 160, 40,
                    r.name_ko,
                    `${r.description} — ${r.cost}G, ${r.turns}턴`,
                    () => {
                        if (heroes.length > 0) {
                            const hero = heroes[0];
                            const result = this.baseManager.startResearch(r.id, hero.id);
                            if (result.success) {
                                this.onComplete({ log: `${hero.name}가 ${r.name_ko} 연구를 시작합니다.` });
                                this._showMenu();
                            }
                        }
                    }
                );
            });
        }

        this._backBtn(width / 2, 520);
    }

    // ─── 원정 ───
    _showExpedition() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 40, width - 120, 520);

        this.add.text(width / 2, 56, '[ 원정 파견 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const progress = this.expeditionManager.getProgress();
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        this.add.text(width / 2, 78, `챕터 ${progress.chapter} — 사용 가능 영웅: ${heroes.length}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);

        if (heroes.length === 0) {
            this.add.text(width / 2, 140, '파견 가능한 영웅이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            // 스테이지 선택
            progress.stages.forEach((stage, i) => {
                if (!stage.unlocked) return;
                const y = 100 + i * 52;
                const label = stage.isBoss ? `👑 ${stage.name}` : stage.name;
                const desc = `적 ${stage.enemies}체${stage.isBoss ? ' (보스)' : ''}`;

                this._itemBtn(80, y, width - 160, 44, label, desc, () => {
                    // 최대 3명 자동 편성
                    const party = heroes.slice(0, Math.min(3, heroes.length));
                    const partyIds = party.map(h => h.id);
                    const result = this.expeditionManager.dispatch(partyIds, i);
                    if (result.success) {
                        const names = party.map(h => h.name).join(', ');
                        this.onComplete({ log: `원정 파견: ${names} → ${stage.name}` });
                        this._showMenu();
                    }
                });
            });
        }

        this._backBtn(width / 2, 520);
    }

    // ─── 영웅 고용 ───
    _showRecruit() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 40, width - 120, 520);

        this.add.text(width / 2, 56, '[ 주점 — 영웅 고용 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const currentCount = this.heroManager.getHeroes().length;
        const gold = store.getState('gold') || 0;

        this.add.text(width / 2, 78, `현재 ${currentCount}/7명 | 고용비: 100G | 보유: ${gold}G`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);

        if (currentCount >= 7) {
            this.add.text(width / 2, 140, '로스터가 가득 찼습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else if (gold < 100) {
            this.add.text(width / 2, 140, '골드가 부족합니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            const recruits = this.heroManager.generateRecruits(3);
            recruits.forEach((recruit, i) => {
                const y = 100 + i * 80;
                const sinColor = SIN_COLORS[recruit.sinType] || C.textMuted;

                this._panel(80, y, width - 160, 70);
                this.add.text(92, y + 8, recruit.name, {
                    fontSize: '11px', fontFamily: FONT, color: C.textPrimary
                });
                this.add.text(92, y + 24, `${recruit.className} | `, {
                    fontSize: '9px', fontFamily: FONT, color: C.textSecondary
                });
                this.add.text(150, y + 24, `[${recruit.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                });

                const s = recruit.stats;
                this.add.text(92, y + 40, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality} 감${s.perception} 솔${s.leadership} 매${s.charisma}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                });

                // 고용 버튼
                this._smallBtn(width - 120, y + 20, '고 용', () => {
                    if ((store.getState('gold') || 0) >= 100 && this.heroManager.getHeroes().length < 7) {
                        store.setState('gold', (store.getState('gold') || 0) - 100);
                        this.heroManager.recruitHero(recruit);
                        this.onComplete({ log: `${recruit.name} (${recruit.className}, ${recruit.sinName})를 고용했습니다.` });
                        this._showRecruit(); // 새로고침
                    }
                });
            });
        }

        this._backBtn(width / 2, 520);
    }

    // ─── 포고령 ───
    _showPolicy() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 40, width - 120, 520);

        this.add.text(width / 2, 56, '[ 포고령 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const base = store.getState('base');
        const policies = base.policies;

        const policyDefs = [
            { key: 'ration', label: '배급', options: [
                { value: 'lavish', label: '풍족 (사기+5, 유지비 2배)', color: C.successGreen },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'austerity', label: '긴축 (사기-3, 유지비 절반)', color: C.expYellow }
            ]},
            { key: 'training', label: '훈련 강도', options: [
                { value: 'intense', label: '강화 (경험치+50%, 사기-3)', color: C.accentRed },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'relaxed', label: '완화 (경험치-50%, 사기+3)', color: C.successGreen }
            ]},
            { key: 'alert', label: '경계 수준', options: [
                { value: 'max', label: '최대 (방어+30%, 사기-2)', color: C.accentRed },
                { value: 'normal', label: '보통', color: C.textSecondary },
                { value: 'min', label: '최소 (방어-30%, 사기+2)', color: C.successGreen }
            ]}
        ];

        policyDefs.forEach((pDef, pi) => {
            const y = 90 + pi * 130;
            this.add.text(100, y, pDef.label, {
                fontSize: '11px', fontFamily: FONT, color: C.textPrimary
            });

            pDef.options.forEach((opt, oi) => {
                const oy = y + 20 + oi * 30;
                const isCurrent = policies[pDef.key] === opt.value;

                this._optionBtn(120, oy, width - 240, 24, opt.label, isCurrent, opt.color, () => {
                    this.baseManager.setPolicy(pDef.key, opt.value);
                    this._showPolicy(); // 새로고침
                });
            });
        });

        this._backBtn(width / 2, 520);
    }

    _finish() {
        this.onComplete({ log: null });
        this.scene.stop('ActionScene');
    }

    // ─── UI 헬퍼 ───
    _panel(x, y, w, h) {
        const g = this.add.graphics();
        g.fillStyle(0x161624, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0x303048);
        g.strokeRect(x, y, w, h);
        g.lineStyle(1, 0xa0a0c0, 0.12);
        g.lineBetween(x + 1, y + 1, x + w - 1, y + 1);
        g.lineBetween(x + 1, y + 1, x + 1, y + h - 1);
        g.lineStyle(1, 0x18182a, 0.6);
        g.lineBetween(x + w - 1, y + 1, x + w - 1, y + h - 1);
        g.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);
    }

    _menuBtn(cx, cy, label, callback, enabled = true) {
        const w = 280, h = 36;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        const alpha = enabled ? 1 : 0.4;

        bg.fillStyle(enabled ? 0x1e1e34 : 0x12121e, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, enabled ? 0x484868 : 0x303048);
        bg.strokeRect(x, y, w, h);

        const text = this.add.text(cx, cy, label, {
            fontSize: '14px', fontFamily: FONT, color: enabled ? C.textPrimary : C.textMuted,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setAlpha(alpha);

        if (enabled) {
            const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => {
                bg.clear();
                bg.fillStyle(0x2a1a1a, 1);
                bg.fillRect(x, y, w, h);
                bg.lineStyle(1, 0xe03030);
                bg.strokeRect(x, y, w, h);
                text.setColor(C.textPrimary);
            });
            zone.on('pointerout', () => {
                bg.clear();
                bg.fillStyle(0x1e1e34, 1);
                bg.fillRect(x, y, w, h);
                bg.lineStyle(1, 0x484868);
                bg.strokeRect(x, y, w, h);
            });
            zone.on('pointerdown', callback);
        }
    }

    _itemBtn(x, y, w, h, title, desc, callback) {
        const bg = this.add.graphics();
        bg.fillStyle(0x0e0e1a, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0x303048);
        bg.strokeRect(x, y, w, h);

        this.add.text(x + 12, y + 6, title, {
            fontSize: '11px', fontFamily: FONT, color: C.textPrimary
        });
        this.add.text(x + 12, y + 22, desc, {
            fontSize: '9px', fontFamily: FONT, color: C.textMuted
        });

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x1e1e34, 1);
            bg.fillRect(x, y, w, h);
            bg.lineStyle(1, 0xe03030);
            bg.strokeRect(x, y, w, h);
        });
        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x0e0e1a, 1);
            bg.fillRect(x, y, w, h);
            bg.lineStyle(1, 0x303048);
            bg.strokeRect(x, y, w, h);
        });
        zone.on('pointerdown', callback);
    }

    _smallBtn(cx, cy, label, callback) {
        const w = 60, h = 24;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030);
        bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, label, {
            fontSize: '11px', fontFamily: FONT, color: C.textPrimary
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x401010, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe04040); bg.strokeRect(x, y, w, h); });
        zone.on('pointerout', () => { bg.clear(); bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h); bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h); });
        zone.on('pointerdown', callback);
    }

    _optionBtn(x, y, w, h, label, isCurrent, color, callback) {
        const bg = this.add.graphics();
        bg.fillStyle(isCurrent ? 0x1e1e34 : 0x0e0e1a, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, isCurrent ? 0xe03030 : 0x303048);
        bg.strokeRect(x, y, w, h);

        const marker = isCurrent ? '● ' : '○ ';
        this.add.text(x + 8, y + h / 2, marker + label, {
            fontSize: '9px', fontFamily: FONT, color: isCurrent ? color : C.textMuted
        }).setOrigin(0, 0.5);

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', callback);
    }

    _backBtn(cx, y) {
        this._menuBtn(cx, y, '← 돌아가기', () => this._showMenu());
    }
}

export default ActionScene;
