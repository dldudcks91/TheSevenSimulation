/**
 * 영웅 선택 화면 — 새 게임 시작 시
 * 초기 영웅 3명을 미리보고, "다시 뽑기"로 랜덤 재생성 가능
 */
import store from '../store/Store.js';
import HeroManager from '../game_logic/HeroManager.js';
import SaveManager from '../store/SaveManager.js';

const FONT = 'Galmuri11, Galmuri9, monospace';
const FONT_BOLD = 'Galmuri11 Bold, Galmuri11, monospace';

const SIN_COLOR_HEX = {
    wrath: '#e03030', envy: '#30b050', greed: '#d0a020',
    sloth: '#808898', gluttony: '#e07020', lust: '#e03080', pride: '#8040e0'
};

const STAT_LABELS = {
    strength: '힘', agility: '민', intellect: '지',
    vitality: '체', perception: '감', leadership: '솔', charisma: '매'
};

const C = {
    bgPrimary: 0x0a0a12, bgSecondary: 0x12121e, bgTertiary: 0x1a1a2a,
    cardBg: 0x161624, borderPrimary: 0x303048, borderSecondary: 0x484868,
    borderHighlight: 0x6868a0, borderDark: 0x18182a,
    textPrimary: '#e8e8f0', textSecondary: '#a0a0c0', textMuted: '#606080',
    accentRed: '#e03030', expYellow: '#f8c830'
};

class HeroSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HeroSelectScene' });
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(C.bgPrimary);

        const heroData = this.registry.get('heroData');
        const balance = this.registry.get('balance') || {};
        this.heroManager = new HeroManager(store, heroData, balance);

        // 배경 파티클
        this._drawBgParticles(width, height);

        // 제목
        this.add.text(width / 2, 40, '동 료  선 택', {
            fontSize: '28px', fontFamily: FONT_BOLD, color: C.accentRed,
            shadow: { offsetX: 2, offsetY: 2, color: '#400000', blur: 0, fill: true },
            letterSpacing: 6
        }).setOrigin(0.5);

        this.add.text(width / 2, 72, '바알과 함께할 세 명의 부하를 선택하십시오', {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5);

        // 구분선
        const lineG = this.add.graphics();
        lineG.lineStyle(1, C.borderPrimary);
        lineG.lineBetween(width / 2 - 200, 90, width / 2 + 200, 90);
        lineG.lineStyle(1, 0xe03030, 0.3);
        lineG.lineBetween(width / 2 - 80, 90, width / 2 + 80, 90);

        // 영웅 카드 영역
        this._heroes = this.heroManager.previewStartingHeroes();
        this._cardElements = [];
        this._drawHeroCards(width, height);

        // 하단 버튼
        this._drawButtons(width, height);
    }

    _drawBgParticles(w, h) {
        for (let i = 0; i < 25; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const dot = this.add.circle(x, y, 1 + Math.random() * 1.5, 0xe03030, 0.06 + Math.random() * 0.08);
            this.tweens.add({
                targets: dot, y: y - 100 - Math.random() * 100, alpha: 0,
                duration: 4000 + Math.random() * 4000, repeat: -1,
                onRepeat: () => { dot.x = Math.random() * w; dot.y = h + 10; dot.alpha = 0.06; }
            });
        }
    }

    _drawHeroCards(width, height) {
        // 기존 카드 제거
        this._cardElements.forEach(el => el.destroy());
        this._cardElements = [];

        const CARD_W = 260;
        const CARD_H = 370;
        const GAP = 30;
        const totalW = CARD_W * 3 + GAP * 2;
        const startX = (width - totalW) / 2;
        const cardY = 110;

        this._heroes.forEach((hero, i) => {
            const cx = startX + i * (CARD_W + GAP) + CARD_W / 2;
            const cy = cardY;
            this._drawSingleCard(cx, cy, CARD_W, CARD_H, hero);
        });
    }

    _drawSingleCard(cx, cy, w, h, hero) {
        const x = cx - w / 2;
        const y = cy;

        // 카드 배경 (RPG 베벨 outset)
        const bg = this.add.graphics();
        bg.fillStyle(C.bgSecondary, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(2, C.borderSecondary);
        bg.strokeRect(x, y, w, h);
        bg.lineStyle(1, C.borderHighlight, 0.25);
        bg.lineBetween(x + 2, y + 2, x + w - 2, y + 2);
        bg.lineBetween(x + 2, y + 2, x + 2, y + h - 2);
        bg.lineStyle(1, C.borderDark, 0.5);
        bg.lineBetween(x + w - 2, y + 2, x + w - 2, y + h - 2);
        bg.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
        this._cardElements.push(bg);

        // 죄종 색상 상단 바
        const sinColor = Phaser.Display.Color.HexStringToColor(SIN_COLOR_HEX[hero.sinType] || '#606080').color;
        const sinBar = this.add.graphics();
        sinBar.fillStyle(sinColor, 0.6);
        sinBar.fillRect(x + 2, y + 2, w - 4, 4);
        this._cardElements.push(sinBar);

        // 초상화 자리 (왼쪽 위, 카드 가로의 ~절반)
        const PORT_SIZE = Math.floor(w / 2) - 16;
        const PORT_X = x + 12;
        const PORT_Y = y + 16;
        const portG = this.add.graphics();
        portG.fillStyle(0x0e0e1a, 1);
        portG.fillRect(PORT_X, PORT_Y, PORT_SIZE, PORT_SIZE);
        portG.lineStyle(1, C.borderSecondary);
        portG.strokeRect(PORT_X, PORT_Y, PORT_SIZE, PORT_SIZE);
        // 대각선 (빈 초상화 표시)
        portG.lineStyle(1, C.borderPrimary, 0.4);
        portG.lineBetween(PORT_X, PORT_Y, PORT_X + PORT_SIZE, PORT_Y + PORT_SIZE);
        portG.lineBetween(PORT_X + PORT_SIZE, PORT_Y, PORT_X, PORT_Y + PORT_SIZE);
        this._cardElements.push(portG);

        // 이름 (초상화 오른쪽)
        const infoX = PORT_X + PORT_SIZE + 10;
        let ty = PORT_Y + 4;
        this._cardElements.push(this.add.text(infoX, ty, hero.name, {
            fontSize: '18px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }));
        ty += 24;

        // 죄종 (초상화 오른쪽)
        this._cardElements.push(this.add.text(infoX, ty, `[ ${hero.sinName} ]`, {
            fontSize: '13px', fontFamily: FONT_BOLD, color: SIN_COLOR_HEX[hero.sinType] || C.textMuted
        }));
        ty += 22;

        // 결함 설명 (초상화 오른쪽)
        if (hero.sinFlaw) {
            this._cardElements.push(this.add.text(infoX, ty, `"${hero.sinFlaw}"`, {
                fontSize: '10px', fontFamily: FONT, color: C.textMuted,
                fontStyle: 'italic',
                wordWrap: { width: w - PORT_SIZE - 40 }
            }));
        }

        ty = PORT_Y + PORT_SIZE + 14;

        // 구분선
        const divG = this.add.graphics();
        divG.lineStyle(1, C.borderPrimary);
        divG.lineBetween(x + 12, ty, x + w - 12, ty);
        this._cardElements.push(divG);
        ty += 12;

        // 스탯 라벨
        this._cardElements.push(this.add.text(cx, ty, '─ 능력치 ─', {
            fontSize: '9px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5));
        ty += 16;

        // 스탯 바 그리기
        const statKeys = ['strength', 'agility', 'intellect', 'vitality', 'perception', 'leadership', 'charisma'];
        const barW = w - 56;
        const barH = 11;

        for (const key of statKeys) {
            const val = hero.stats[key];
            const label = STAT_LABELS[key];

            // 라벨
            this._cardElements.push(this.add.text(x + 12, ty + 1, label, {
                fontSize: '10px', fontFamily: FONT, color: C.textSecondary
            }));

            // 바 배경 (inset)
            const barBg = this.add.graphics();
            const bx = x + 36;
            barBg.fillStyle(0x0e0e1a, 1);
            barBg.fillRect(bx, ty, barW, barH);
            barBg.lineStyle(1, C.borderPrimary);
            barBg.strokeRect(bx, ty, barW, barH);
            this._cardElements.push(barBg);

            // 바 채움
            const fillW = Math.max(0, (val / 20) * (barW - 2));
            const barColor = val >= 15 ? 0x40d870 : val >= 10 ? 0x40a0f8 : val >= 7 ? 0xf8c830 : 0xf04040;
            const barFill = this.add.graphics();
            barFill.fillStyle(barColor, 0.8);
            barFill.fillRect(bx + 1, ty + 1, fillW, barH - 2);
            this._cardElements.push(barFill);

            // 수치
            this._cardElements.push(this.add.text(x + w - 12, ty + 1, `${val}`, {
                fontSize: '10px', fontFamily: FONT_BOLD, color: C.textPrimary
            }).setOrigin(1, 0));

            ty += barH + 5;
        }

        ty += 8;

        // 사기
        this._cardElements.push(this.add.text(cx, ty, `사기: ${hero.morale}`, {
            fontSize: '11px', fontFamily: FONT, color: '#a0a0c0'
        }).setOrigin(0.5));
    }

    _drawButtons(width, height) {
        const btnY = height - 60;

        // 다시 뽑기
        this._createBtn(width / 2 - 140, btnY, 180, 40, '🎲 다시 뽑기', '#f8c830', () => {
            this._heroes = this.heroManager.previewStartingHeroes();
            this._drawHeroCards(width, height);
        });

        // 시작
        this._createBtn(width / 2 + 140, btnY, 180, 40, '▶ 여정 시작', '#e03030', () => {
            SaveManager.deleteSave();
            const balance = this.registry.get('balance') || {};
            store.setState('gold', balance.starting_gold ?? 500);
            this.heroManager.confirmHeroes(this._heroes);

            // 페이드 아웃
            const fade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
            fade.setDepth(200);
            this.tweens.add({
                targets: fade, alpha: 1, duration: 500,
                onComplete: () => this.scene.start('MainScene')
            });
        });
    }

    _createBtn(cx, cy, w, h, label, accentColor, callback) {
        const x = cx - w / 2;
        const y = cy - h / 2;
        const accentHex = Phaser.Display.Color.HexStringToColor(accentColor).color;

        const bg = this.add.graphics();
        bg.fillStyle(C.cardBg, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(2, accentHex);
        bg.strokeRect(x, y, w, h);
        // 베벨
        bg.lineStyle(1, C.borderHighlight, 0.15);
        bg.lineBetween(x + 2, y + 2, x + w - 2, y + 2);
        bg.lineStyle(1, C.borderDark, 0.4);
        bg.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);

        const text = this.add.text(cx, cy, label, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: accentColor,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(C.bgTertiary, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(2, accentHex); bg.strokeRect(x, y, w, h);
            text.setColor('#ffffff');
        });
        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(C.cardBg, 1); bg.fillRect(x, y, w, h);
            bg.lineStyle(2, accentHex); bg.strokeRect(x, y, w, h);
            bg.lineStyle(1, C.borderHighlight, 0.15); bg.lineBetween(x + 2, y + 2, x + w - 2, y + 2);
            bg.lineStyle(1, C.borderDark, 0.4); bg.lineBetween(x + 2, y + h - 2, x + w - 2, y + h - 2);
            text.setColor(accentColor);
        });
        zone.on('pointerdown', callback);
    }
}

export default HeroSelectScene;
