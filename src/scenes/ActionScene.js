/**
 * 낮 페이즈 행동 선택 오버레이
 * 건설 / 연구 / 원정 / 고용 / 포고령 / 시설별 행동
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

/** 행동별 핵심 스탯 가중치 */
const ACTION_STATS = {
    build: { primary: ['strength', 'vitality'], label: '건설' },
    research: { primary: ['intellect', 'perception'], label: '연구' },
    production: { primary: ['agility', 'perception'], label: '생산' },
    expedition: { primary: ['strength', 'agility'], label: '원정' }
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
        this.initialMode = data.initialMode || 'menu';
        this.facilityData = data.facilityData || null;
        this.mode = 'menu';
    }

    create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

        switch (this.initialMode) {
            case 'build': this._showBuild(); break;
            case 'research': this._showResearch(); break;
            case 'expedition': this._showExpedition(); break;
            case 'recruit': this._showRecruit(); break;
            case 'policy': this._showPolicy(); break;
            case 'facility': this._showFacilityAction(); break;
            default: this._showMenu(); break;
        }
    }

    _clearUI() {
        this.children.list.slice(1).forEach(c => c.destroy());
    }

    // ─── 메인 메뉴 ───
    _showMenu() {
        this._clearUI();
        this.mode = 'menu';
        const { width } = this.scale;

        this._panel(width / 2 - 200, 40, 400, 520);
        this.add.text(width / 2, 60, '[ 낮 — 행동 선택 ]', {
            fontSize: '16px', fontFamily: FONT, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        const gold = store.getState('gold') || 0;
        this.add.text(width / 2, 84, `보유 골드: ${gold}G`, {
            fontSize: '11px', fontFamily: FONT, color: C.expYellow
        }).setOrigin(0.5);

        // 현재 상태
        const building = this.baseManager.getCurrentBuilding();
        const researching = this.baseManager.getCurrentResearch();
        const expedition = store.getState('expedition');
        let statusY = 104;
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

        const btnY = Math.max(statusY + 16, 140);
        const hasTavern = this.baseManager.hasFacility('tavern');
        const actions = [
            { label: '🔨 건설', action: () => this._showBuild(), enabled: !building },
            { label: '📖 연구', action: () => this._showResearch(), enabled: !researching },
            { label: '🏹 사냥', action: () => this._showHunt(), enabled: true },
            { label: '⚔️ 원정 파견', action: () => this._showExpedition(), enabled: !(expedition && expedition.active) },
            { label: '🍺 영웅 고용', action: () => this._showRecruit(), enabled: hasTavern },
            { label: '📜 포고령', action: () => this._showPolicy(), enabled: true },
            { label: '🎉 연회 개최', action: () => this._doFeast(), enabled: hasTavern },
            { label: '▶ 턴 넘기기', action: () => this._finish(), enabled: true }
        ];

        actions.forEach((a, i) => {
            this._menuBtn(width / 2, btnY + i * 44, a.label, a.action, a.enabled);
        });
    }

    // ─── 건설 ───
    _showBuild() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        this.add.text(width / 2, 46, '[ 건설 ]', {
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
                const y = 70 + i * 50;
                const cost = this.baseManager.getBuildCost(f);
                this._itemBtn(80, y, width - 160, 42,
                    `${f.name_ko} (T${f.tier})`,
                    `${f.description} — ${cost}G, ${f.build_turns}턴`,
                    () => this._selectHeroForAction('build', f, heroes)
                );
            });
        }

        this._backBtn(width / 2, 540);
    }

    // ─── 연구 ───
    _showResearch() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        this.add.text(width / 2, 46, '[ 연구 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const available = this.baseManager.getAvailableResearch();
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        if (available.length === 0) {
            this.add.text(width / 2, 120, '연구 가능한 항목이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            available.slice(0, 8).forEach((r, i) => {
                const y = 70 + i * 50;
                this._itemBtn(80, y, width - 160, 42,
                    r.name_ko,
                    `${r.description} — ${r.cost}G, ${r.turns}턴`,
                    () => this._selectHeroForAction('research', r, heroes)
                );
            });
        }

        this._backBtn(width / 2, 540);
    }

    // ─── 영웅 선택 (건설/연구에 투입) ───
    _selectHeroForAction(actionType, target, availableHeroes) {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        const statConfig = ACTION_STATS[actionType];
        this.add.text(width / 2, 46, `[ ${statConfig.label} — 영웅 선택 ]`, {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        this.add.text(width / 2, 68, `대상: ${target.name_ko || target.name}`, {
            fontSize: '11px', fontFamily: FONT, color: C.infoCyan
        }).setOrigin(0.5);

        if (availableHeroes.length === 0) {
            this.add.text(width / 2, 140, '투입 가능한 영웅이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            availableHeroes.forEach((hero, i) => {
                const y = 90 + i * 56;
                const stars = this._calcFitness(hero, statConfig.primary);
                const sinColor = SIN_COLORS[hero.sinType] || C.textMuted;

                this._panel(80, y, width - 160, 48);
                this.add.text(92, y + 6, `${hero.name}`, {
                    fontSize: '11px', fontFamily: FONT, color: C.textPrimary
                });
                this.add.text(92, y + 22, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                });
                this.add.text(200, y + 22, `적합도: ${stars}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                });

                const s = hero.stats;
                this.add.text(92, y + 34, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality} 감${s.perception} 솔${s.leadership} 매${s.charisma}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                });

                this._smallBtn(width - 120, y + 20, '투입', () => {
                    let result;
                    if (actionType === 'build') {
                        result = this.baseManager.startBuilding(target.id, hero.id);
                        if (result.success) {
                            hero.status = 'construction';
                            store.setState('heroes', [...this.heroManager.getHeroes()]);
                            this.onComplete({ log: `${hero.name}가 ${target.name_ko} 건설 시작` });
                        }
                    } else if (actionType === 'research') {
                        result = this.baseManager.startResearch(target.id, hero.id);
                        if (result.success) {
                            hero.status = 'research';
                            store.setState('heroes', [...this.heroManager.getHeroes()]);
                            this.onComplete({ log: `${hero.name}가 ${target.name_ko} 연구 시작` });
                        }
                    }
                    this._showMenu();
                });
            });
        }

        this._backBtn(width / 2, 540);
    }

    /** 적합도 계산 (★) */
    _calcFitness(hero, primaryStats) {
        let total = 0;
        for (const stat of primaryStats) {
            total += hero.stats[stat] || 0;
        }
        const avg = total / primaryStats.length;
        if (avg >= 16) return '★★★★★';
        if (avg >= 13) return '★★★★☆';
        if (avg >= 10) return '★★★☆☆';
        if (avg >= 7) return '★★☆☆☆';
        return '★☆☆☆☆';
    }

    // ─── 원정 ───
    _showExpedition() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        this.add.text(width / 2, 46, '[ 원정 파견 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const progress = this.expeditionManager.getProgress();
        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');
        const soldiers = store.getState('soldiers') || 0;

        this.add.text(width / 2, 68, `챕터 ${progress.chapter} — 영웅: ${heroes.length}명 | 병사: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);

        if (heroes.length === 0) {
            this.add.text(width / 2, 140, '파견 가능한 영웅이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else if (soldiers === 0) {
            this.add.text(width / 2, 140, '병사가 없습니다. 병사 없이 출격할 수 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            progress.stages.forEach((stage, i) => {
                if (!stage.unlocked) return;
                const y = 90 + i * 52;
                const label = stage.isBoss ? `👑 ${stage.name}` : stage.name;
                this._itemBtn(80, y, width - 160, 44, label,
                    `적 ${stage.enemies}체${stage.isBoss ? ' (보스)' : ''}`,
                    () => this._showExpeditionSoldierSelect(i, heroes)
                );
            });
        }

        this._backBtn(width / 2, 540);
    }

    /** 원정 병사 배정 화면 */
    _showExpeditionSoldierSelect(stageIndex, heroes) {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        const progress = this.expeditionManager.getProgress();
        const stage = progress.stages[stageIndex];
        const party = heroes.slice(0, Math.min(3, heroes.length));
        const soldiers = store.getState('soldiers') || 0;

        this.add.text(width / 2, 46, '[ 병사 배정 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        this.add.text(width / 2, 68, `목표: ${stage.name} | 영웅: ${party.map(h => h.name).join(', ')}`, {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, `사용 가능 병사: ${soldiers}명`, {
            fontSize: '11px', fontFamily: FONT, color: C.expYellow
        }).setOrigin(0.5);

        // 병사 수 선택
        let selectedCount = Math.min(10, soldiers);

        const countText = this.add.text(width / 2, 150, `${selectedCount}명`, {
            fontSize: '28px', fontFamily: FONT, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // - 버튼
        this._smallBtn(width / 2 - 120, 150, '-10', () => {
            selectedCount = Math.max(1, selectedCount - 10);
            countText.setText(`${selectedCount}명`);
        });
        this._smallBtn(width / 2 - 60, 150, '-1', () => {
            selectedCount = Math.max(1, selectedCount - 1);
            countText.setText(`${selectedCount}명`);
        });

        // + 버튼
        this._smallBtn(width / 2 + 60, 150, '+1', () => {
            selectedCount = Math.min(soldiers, selectedCount + 1);
            countText.setText(`${selectedCount}명`);
        });
        this._smallBtn(width / 2 + 120, 150, '+10', () => {
            selectedCount = Math.min(soldiers, selectedCount + 10);
            countText.setText(`${selectedCount}명`);
        });

        // 전체 투입
        this._smallBtn(width / 2, 190, '전체', () => {
            selectedCount = soldiers;
            countText.setText(`${selectedCount}명`);
        });

        // 파견 버튼
        this._menuBtn(width / 2, 250, '⚔️ 파견 출발', () => {
            const partyIds = party.map(h => h.id);
            const result = this.expeditionManager.dispatch(partyIds, stageIndex, selectedCount);
            if (result.success) {
                const names = party.map(h => h.name).join(', ');
                this.onComplete({ log: `원정 파견: ${names} + 민병 ${selectedCount}명 → ${stage.name}` });
                this._showMenu();
            }
        });

        this._backBtn(width / 2, 540);
    }

    // ─── 사냥 ───
    _showHunt() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        this.add.text(width / 2, 46, '[ 사냥 — 영웅 선택 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        this.add.text(width / 2, 68, '영웅 1명을 사냥에 보냅니다', {
            fontSize: '11px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);

        const heroes = this.heroManager.getBaseHeroes().filter(h => h.status === 'idle');

        if (heroes.length === 0) {
            this.add.text(width / 2, 140, '파견 가능한 영웅이 없습니다.', {
                fontSize: '11px', fontFamily: FONT, color: C.textMuted
            }).setOrigin(0.5);
        } else {
            heroes.forEach((hero, i) => {
                const y = 90 + i * 56;
                const stars = this._calcFitness(hero, ['strength', 'agility']);
                const sinColor = SIN_COLORS[hero.sinType] || C.textMuted;

                this._panel(80, y, width - 160, 48);
                this.add.text(92, y + 6, hero.name, {
                    fontSize: '11px', fontFamily: FONT, color: C.textPrimary
                });
                this.add.text(92, y + 22, `[${hero.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                });
                this.add.text(200, y + 22, `사냥 적합도: ${stars}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.expYellow
                });

                const s = hero.stats;
                this.add.text(92, y + 34, `힘${s.strength} 민${s.agility} 지${s.intellect} 체${s.vitality} 감${s.perception} 솔${s.leadership} 매${s.charisma}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                });

                this._smallBtn(width - 120, y + 20, '파견', () => {
                    this._launchHunt(hero);
                });
            });
        }

        this._backBtn(width / 2, 540);
    }

    _launchHunt(hero) {
        // 랜덤 사냥 적 생성 (day 기반 스케일링)
        const turn = this.heroManager.store
            ? this.heroManager.store.getState('turn')
            : null;
        const day = (turn && turn.day) || 1;

        const HUNT_ENEMIES = [
            { name: '들늑대', baseHp: 40, baseAtk: 8, spd: 7 },
            { name: '야생 멧돼지', baseHp: 55, baseAtk: 10, spd: 5 },
            { name: '독거미', baseHp: 30, baseAtk: 12, spd: 9 },
            { name: '어둠 박쥐', baseHp: 25, baseAtk: 14, spd: 10 },
            { name: '변이 곰', baseHp: 70, baseAtk: 11, spd: 4 },
        ];

        const template = HUNT_ENEMIES[Math.floor(Math.random() * HUNT_ENEMIES.length)];
        const scale = 1 + (day - 1) * 0.1;
        const enemy = {
            name: template.name,
            hp: Math.floor(template.baseHp * scale),
            atk: Math.floor(template.baseAtk * scale),
            spd: template.spd
        };

        // 사냥 보상 (승리 시)
        const goldReward = 15 + day * 3;

        // ActionScene 닫고 DuelBattleScene 실행
        this.scene.stop('ActionScene');

        this.scene.launch('DuelBattleScene', {
            hero,
            enemy,
            stageName: `사냥 — ${template.name}`,
            onClose: (result) => {
                if (result.victory) {
                    const gold = store.getState('gold') || 0;
                    store.setState('gold', gold + goldReward);
                    this.heroManager.updateMorale(hero.id, 3);
                } else {
                    hero.status = 'injured';
                    store.setState('heroes', [...this.heroManager.getHeroes()]);
                    this.heroManager.updateMorale(hero.id, -5);
                }
                this.onComplete({ log: result.victory
                    ? `${hero.name}이(가) ${template.name} 사냥 성공! (+${goldReward}G)`
                    : `${hero.name}이(가) ${template.name} 사냥에 실패했다...`
                });
            }
        });
    }

    // ─── 영웅 고용 ───
    _showRecruit() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        this.add.text(width / 2, 46, '[ 주점 — 영웅 고용 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const currentCount = this.heroManager.getHeroes().length;
        const gold = store.getState('gold') || 0;

        this.add.text(width / 2, 68, `현재 ${currentCount}/7명 | 고용비: 100G | 보유: ${gold}G`, {
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
                const y = 90 + i * 100;
                const sinColor = SIN_COLORS[recruit.sinType] || C.textMuted;

                this._panel(80, y, width - 160, 88);
                this.add.text(92, y + 8, recruit.name, {
                    fontSize: '11px', fontFamily: FONT, color: C.textPrimary
                });
                this.add.text(92, y + 24, `[${recruit.sinName}]`, {
                    fontSize: '9px', fontFamily: FONT, color: sinColor
                });

                // 스탯은 비공개 (기획: 고용 후 확인)
                this.add.text(92, y + 40, '스탯: 고용 후 확인', {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted
                });

                // 죄종별 만족/불만 힌트
                this.add.text(92, y + 56, `성격: ${recruit.sinFlaw || ''}`, {
                    fontSize: '9px', fontFamily: FONT, color: C.textMuted,
                    wordWrap: { width: width - 280 }
                });

                this._smallBtn(width - 120, y + 30, '고 용', () => {
                    if ((store.getState('gold') || 0) >= 100 && this.heroManager.getHeroes().length < 7) {
                        store.setState('gold', (store.getState('gold') || 0) - 100);
                        this.heroManager.recruitHero(recruit);
                        this.onComplete({ log: `${recruit.name} [${recruit.sinName}]를 고용했습니다.` });
                        this._showRecruit();
                    }
                });
            });
        }

        this._backBtn(width / 2, 540);
    }

    // ─── 포고령 ───
    _showPolicy() {
        this._clearUI();
        const { width } = this.scale;
        this._panel(60, 30, width - 120, 540);

        this.add.text(width / 2, 46, '[ 포고령 ]', {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        const base = store.getState('base');
        const policies = base.policies;
        const currentEffect = this.baseManager.getPolicyMoraleEffect();

        this.add.text(width / 2, 68, `현재 효과: 전체 사기 ${currentEffect >= 0 ? '+' : ''}${currentEffect}/턴`, {
            fontSize: '11px', fontFamily: FONT, color: currentEffect >= 0 ? C.successGreen : C.accentRed
        }).setOrigin(0.5);

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
            const y = 96 + pi * 130;
            this.add.text(100, y, pDef.label, {
                fontSize: '11px', fontFamily: FONT, color: C.textPrimary
            });

            pDef.options.forEach((opt, oi) => {
                const oy = y + 20 + oi * 30;
                const isCurrent = policies[pDef.key] === opt.value;

                this._optionBtn(120, oy, width - 240, 24, opt.label, isCurrent, opt.color, () => {
                    this.baseManager.setPolicy(pDef.key, opt.value);
                    this._showPolicy();
                });
            });
        });

        this._backBtn(width / 2, 540);
    }

    // ─── 시설별 행동 ───
    _showFacilityAction() {
        this._clearUI();
        const { width } = this.scale;
        const facility = this.facilityData;

        if (!facility) { this._showMenu(); return; }

        this._panel(60, 30, width - 120, 540);
        this.add.text(width / 2, 46, `[ ${facility.name_ko} ]`, {
            fontSize: '14px', fontFamily: FONT, color: C.accentRed
        }).setOrigin(0.5);

        this.add.text(width / 2, 68, facility.description, {
            fontSize: '9px', fontFamily: FONT, color: C.textSecondary
        }).setOrigin(0.5);

        let y = 100;
        const actions = [];

        // 시설별 가능한 행동
        if (facility.id === 'tavern') {
            actions.push({ label: '🍺 영웅 고용', action: () => this._showRecruit() });
            actions.push({ label: '🎉 연회 개최', action: () => this._doFeast() });
        } else if (facility.id === 'smithy') {
            actions.push({ label: '🔧 장비 수리 (미구현)', action: () => {}, enabled: false });
        } else if (facility.id === 'hospital') {
            actions.push({ label: '💊 사기 안정화', action: () => this._doStabilize() });
        } else if (facility.id === 'stagecoach') {
            actions.push({ label: '🛒 교역 (미구현)', action: () => {}, enabled: false });
        }

        actions.forEach((a, i) => {
            this._menuBtn(width / 2, y + i * 44, a.label, a.action, a.enabled !== false);
        });

        this._backBtn(width / 2, 540);
    }

    // ─── 연회 ───
    _doFeast() {
        const gold = store.getState('gold') || 0;
        if (gold < 100) {
            this.onComplete({ log: '연회 비용(100G)이 부족합니다.' });
            return;
        }

        store.setState('gold', gold - 100);
        const heroes = this.heroManager.getHeroes();
        for (const hero of heroes) {
            let delta = 15;
            if (hero.sinType === 'gluttony' || hero.sinType === 'lust') {
                delta = 25; // 폭식/색욕 더 올라감 (폭주 위험)
            }
            this.heroManager.updateMorale(hero.id, delta);
        }

        this.onComplete({ log: '연회를 개최했습니다! 전체 사기 상승 (폭식/색욕 주의)' });
        this._showMenu();
    }

    // ─── 사기 안정화 (성당/병원) ───
    _doStabilize() {
        const heroes = this.heroManager.getHeroes();
        let stabilized = 0;
        for (const hero of heroes) {
            if (hero.morale < 30 || hero.morale > 80) {
                const target = 50;
                const delta = Math.round((target - hero.morale) * 0.3);
                this.heroManager.updateMorale(hero.id, delta);
                stabilized++;
            }
        }

        this.onComplete({ log: stabilized > 0 ? `${stabilized}명의 사기를 안정화했습니다.` : '안정화할 영웅이 없습니다.' });
        this._showMenu();
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

        bg.fillStyle(enabled ? 0x1e1e34 : 0x12121e, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(1, enabled ? 0x484868 : 0x303048);
        bg.strokeRect(x, y, w, h);

        const text = this.add.text(cx, cy, label, {
            fontSize: '14px', fontFamily: FONT, color: enabled ? C.textPrimary : C.textMuted,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5).setAlpha(enabled ? 1 : 0.4);

        if (enabled) {
            const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => {
                bg.clear(); bg.fillStyle(0x2a1a1a, 1); bg.fillRect(x, y, w, h);
                bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);
            });
            zone.on('pointerout', () => {
                bg.clear(); bg.fillStyle(0x1e1e34, 1); bg.fillRect(x, y, w, h);
                bg.lineStyle(1, 0x484868); bg.strokeRect(x, y, w, h);
            });
            zone.on('pointerdown', callback);
        }
    }

    _itemBtn(x, y, w, h, title, desc, callback) {
        const bg = this.add.graphics();
        bg.fillStyle(0x0e0e1a, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0x303048); bg.strokeRect(x, y, w, h);

        this.add.text(x + 12, y + 6, title, { fontSize: '11px', fontFamily: FONT, color: C.textPrimary });
        this.add.text(x + 12, y + 22, desc, { fontSize: '9px', fontFamily: FONT, color: C.textMuted });

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            bg.clear(); bg.fillStyle(0x1e1e34, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);
        });
        zone.on('pointerout', () => {
            bg.clear(); bg.fillStyle(0x0e0e1a, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(1, 0x303048); bg.strokeRect(x, y, w, h);
        });
        zone.on('pointerdown', callback);
    }

    _smallBtn(cx, cy, label, callback) {
        const w = 60, h = 24;
        const x = cx - w / 2, y = cy - h / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x2a0808, 1); bg.fillRect(x, y, w, h);
        bg.lineStyle(1, 0xe03030); bg.strokeRect(x, y, w, h);

        this.add.text(cx, cy, label, { fontSize: '11px', fontFamily: FONT, color: '#e8e8f0' }).setOrigin(0.5);

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
