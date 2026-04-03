/**
 * 영웅 선택 화면 — 새 게임 시작 시
 * 초기 영웅 3명을 미리보고, "다시 뽑기"로 랜덤 재생성 가능
 */
import store from '../store/Store.js';
import HeroManager from '../game_logic/HeroManager.js';
import SpriteComposer from '../game_logic/SpriteComposer.js';
import SpriteRenderer from './SpriteRenderer.js';
import SaveManager from '../store/SaveManager.js';
import { FONT, FONT_BOLD } from '../constants.js';

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

const FRAME_SIZE = 64;

class HeroSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HeroSelectScene' });
    }

    preload() {
        // 모든 LPC 파츠를 일반 이미지로 프리로드
        const lpcParts = this.registry.get('lpcParts') || [];
        this._spriteRenderer = new SpriteRenderer(this);
        this._spriteRenderer.preloadParts(lpcParts);
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(C.bgPrimary);

        const heroData = this.registry.get('heroData');
        const balance = this.registry.get('balance') || {};
        this.heroManager = new HeroManager(store, heroData, balance);
        const lpcParts = this.registry.get('lpcParts') || [];
        this.heroManager.setSpriteComposer(new SpriteComposer(lpcParts));
        this.heroManager.setEpithets(this.registry.get('heroEpithets') || []);
        this.heroManager.setItemsData(this.registry.get('itemsData') || []);
        this.heroManager.setTraitsData(this.registry.get('traitsData') || []);
        if (!this._spriteRenderer) {
            this._spriteRenderer = new SpriteRenderer(this);
        }

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

        // 이전 합성 텍스처/애니메이션 정리
        if (this._prevHeroIds) {
            for (const heroId of this._prevHeroIds) {
                for (const action of ['idle', 'walk', 'slash']) {
                    const texKey = `composed_${heroId}_${action}`;
                    if (this.textures.exists(texKey)) {
                        this.textures.remove(texKey);
                    }
                    const animKey = `${heroId}_${action}`;
                    if (this.anims.exists(animKey)) {
                        this.anims.remove(animKey);
                    }
                }
            }
        }
        this._prevHeroIds = this._heroes.map(h => `hero_${h.id}`);

        const CARD_W = 280;
        const CARD_H = 420;
        const GAP = 24;
        const totalW = CARD_W * 3 + GAP * 2;
        const startX = (width - totalW) / 2;
        const cardY = 100;

        this._heroes.forEach((hero, i) => {
            const cx = startX + i * (CARD_W + GAP) + CARD_W / 2;
            const cy = cardY;
            this._drawSingleCard(cx, cy, CARD_W, CARD_H, hero);
        });
    }

    _drawSingleCard(cx, cy, w, h, hero) {
        const x = cx - w / 2;
        const y = cy;

        // 카드 배경
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
        const sinColorHex = SIN_COLOR_HEX[hero.primarySin] || '#606080';
        const sinColor = Phaser.Display.Color.HexStringToColor(sinColorHex).color;
        const sinBar = this.add.graphics();
        sinBar.fillStyle(sinColor, 0.6);
        sinBar.fillRect(x + 2, y + 2, w - 4, 4);
        this._cardElements.push(sinBar);

        let ty = y + 18;

        // ── 상단: 이름 + 짧은 스토리 ──
        this._cardElements.push(this.add.text(x + 12, ty, hero.name, {
            fontSize: '16px', fontFamily: FONT_BOLD, color: C.textPrimary,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true }
        }));
        const traitName = hero.trait ? `[${hero.trait.name}]` : hero.sinName;
        const traitLabel = this.add.text(x + w - 12, ty + 2, traitName, {
            fontSize: '11px', fontFamily: FONT_BOLD, color: '#c0a0e0'
        }).setOrigin(1, 0);
        this._cardElements.push(traitLabel);
        if (hero.trait) {
            traitLabel.setInteractive({ useHandCursor: true });
            let tip = null;
            traitLabel.on('pointerover', (pointer) => {
                traitLabel.setColor('#ffffff');
                const lines = [];
                if (hero.trait.pro_effect) lines.push(`▲ ${hero.trait.pro_effect}`);
                if (hero.trait.con_effect) lines.push(`▼ ${hero.trait.con_effect}`);
                const tipW = 220, tipH = 14 * lines.length + 16;
                const tx = Math.min(pointer.x, 1280 - tipW - 8);
                tip = this.add.container(0, 0).setDepth(9999);
                const bg = this.add.graphics();
                bg.fillStyle(0x1a1a2e, 0.95); bg.fillRoundedRect(tx, pointer.y - tipH - 8, tipW, tipH, 4);
                bg.lineStyle(1, 0xc0a0e0); bg.strokeRoundedRect(tx, pointer.y - tipH - 8, tipW, tipH, 4);
                tip.add(bg);
                tip.add(this.add.text(tx + 8, pointer.y - tipH - 2, lines.join('\n'), {
                    fontSize: '10px', fontFamily: FONT, color: '#e0e0f0', lineSpacing: 2, wordWrap: { width: tipW - 16 }
                }));
            });
            traitLabel.on('pointerout', () => {
                traitLabel.setColor('#c0a0e0');
                if (tip) { tip.destroy(); tip = null; }
            });
        }
        this._cardElements.push(this.add.text(x + w - 12, ty + 18, `비용 ${hero.foodCost ?? '?'}/턴`, {
            fontSize: '10px', fontFamily: FONT, color: '#a08040'
        }).setOrigin(1, 0));
        ty += 48;

        // 짧은 배경 스토리
        const storyText = this._getHeroStory(hero.primarySin);
        const storyObj = this.add.text(x + 12, ty, storyText, {
            fontSize: '11px', fontFamily: FONT, color: C.textMuted,
            lineSpacing: 4,
            wordWrap: { width: w - 24 }
        });
        this._cardElements.push(storyObj);
        ty += storyObj.height + 16;

        // ── 중단+하단: 카드 하단에서 역산하여 배치 ──
        const HALF_W = Math.floor((w - 24) / 2);
        const PORT_H = 120;
        const barH = 14;
        const statCount = 7;
        const statTotalH = statCount * (barH + 5);

        // 하단 기준: 카드바닥 - 여백 - 스탯영역 - 구분선 - 사진영역 - 구분선
        const statStartY = y + h - statTotalH - 10;
        const divider2Y = statStartY - 10;
        const portStartY = divider2Y - PORT_H - 6;
        const divider1Y = portStartY - 8;

        // 구분선 1 (스토리 아래)
        const divG1 = this.add.graphics();
        divG1.lineStyle(1, C.borderPrimary);
        divG1.lineBetween(x + 8, divider1Y, x + w - 8, divider1Y);
        this._cardElements.push(divG1);

        ty = portStartY;

        // 왼쪽: 일러스트 (빈 카드)
        const illG = this.add.graphics();
        illG.fillStyle(0x0e0e1a, 1);
        illG.fillRect(x + 8, ty, HALF_W, PORT_H);
        illG.lineStyle(1, C.borderPrimary);
        illG.strokeRect(x + 8, ty, HALF_W, PORT_H);
        // 대각선 (placeholder)
        illG.lineStyle(1, C.borderPrimary, 0.3);
        illG.lineBetween(x + 8, ty, x + 8 + HALF_W, ty + PORT_H);
        illG.lineBetween(x + 8 + HALF_W, ty, x + 8, ty + PORT_H);
        this._cardElements.push(illG);
        this._cardElements.push(this.add.text(x + 8 + HALF_W / 2, ty + PORT_H / 2, 'ILLUST', {
            fontSize: '9px', fontFamily: FONT, color: C.textMuted
        }).setOrigin(0.5).setAlpha(0.4));

        // 오른쪽: LPC 스프라이트
        const sprX = x + 8 + HALF_W + 8;
        const sprG = this.add.graphics();
        sprG.fillStyle(0x0e0e1a, 1);
        sprG.fillRect(sprX, ty, HALF_W, PORT_H);
        sprG.lineStyle(1, C.borderPrimary);
        sprG.strokeRect(sprX, ty, HALF_W, PORT_H);
        this._cardElements.push(sprG);

        if (hero.appearance && hero.appearance.layers) {
            const heroId = `hero_${hero.id}`;
            const textures = this._spriteRenderer.compose(hero.appearance, heroId);
            if (textures.idle) {
                const sprCX = sprX + HALF_W / 2;
                const sprCY = ty + PORT_H / 2 + 8;
                const scale = (PORT_H - 16) / FRAME_SIZE;
                const spr = this.add.sprite(sprCX, sprCY, textures.idle, 0);
                spr.setScale(scale);
                spr.play(`${heroId}_idle`);
                this._cardElements.push(spr);
            }
        }

        // 구분선 2 (사진 아래)
        const divG2 = this.add.graphics();
        divG2.lineStyle(1, C.borderPrimary);
        divG2.lineBetween(x + 8, divider2Y, x + w - 8, divider2Y);
        this._cardElements.push(divG2);

        ty = statStartY;

        // ── 하단: 스탯 (세로 1열, 풀 이름, 크게) ──
        const statKeys = ['strength', 'agility', 'intellect', 'vitality', 'perception', 'leadership', 'charisma'];
        const STAT_FULL = {
            strength: '힘', agility: '민첩', intellect: '지능',
            vitality: '체력', perception: '감각', leadership: '통솔', charisma: '매력'
        };
        const barW = w - 90;

        for (const key of statKeys) {
            const val = hero.stats[key];
            const label = STAT_FULL[key];

            // 라벨
            this._cardElements.push(this.add.text(x + 12, ty, label, {
                fontSize: '12px', fontFamily: FONT, color: C.textSecondary
            }));

            // 바 배경
            const bx = x + 52;
            const barBg = this.add.graphics();
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
            this._cardElements.push(this.add.text(x + w - 12, ty, `${val}`, {
                fontSize: '12px', fontFamily: FONT_BOLD, color: C.textPrimary
            }).setOrigin(1, 0));

            ty += barH + 5;
        }
    }

    _getHeroStory(primarySin) {
        const stories = {
            wrath: '전쟁에서 돌아온 뒤로 분노를 멈출 수 없었다.\n칼을 내려놓으면 손이 떨렸고,\n결국 바알의 부름에 응했다.',
            envy: '언제나 형의 그림자 속에 있었다.\n인정받지 못한 재능은 독이 되어\n결국 그를 이곳으로 이끌었다.',
            greed: '가진 것을 모두 잃은 날,\n다시는 빈손이 되지 않겠다고 맹세했다.\n그 집착이 바알의 눈에 띄었다.',
            sloth: '한때 뛰어난 학자였으나 모든 것을 포기했다.\n세상에 지쳐 쓰러진 그를\n바알이 주워 담았다.',
            gluttony: '굶주림의 기억은 지워지지 않았다.\n아무리 채워도 부족했고,\n결국 악마의 식탁에 앉게 되었다.',
            lust: '사랑에 실패한 뒤 혼자가 되는 것이 두려웠다.\n누군가 곁에 있어야만 했고,\n그 절박함이 이곳까지 왔다.',
            pride: '왕좌에서 쫓겨난 지휘관.\n자신이 옳다는 확신은 변하지 않았고,\n바알 아래서라도 증명하려 한다.',
        };
        return stories[primarySin] || '어둠 속에서 바알의 부름을 들었다.\n갈 곳 없는 자에게 선택지란 없었다.';
    }

    _drawButtons(width, height) {
        const btnY = height - 90;

        // 다시 뽑기
        this._createBtn(width / 2 - 140, btnY, 180, 40, '🎲 다시 뽑기', '#f8c830', () => {
            this._heroes = this.heroManager.previewStartingHeroes();
            this._drawHeroCards(width, height);
        });

        // 시작
        this._createBtn(width / 2 + 140, btnY, 180, 40, '▶ 여정 시작', '#e03030', () => {
            // 기존 세이브를 여기서 삭제하지 않음 — MapScene 진입 시 자동 저장으로 덮어씀
            const balance = this.registry.get('balance') || {};
            store.setState('gold', balance.starting_gold ?? 500);
            store.setState('food', balance.starting_food ?? 100);
            store.setState('wood', balance.starting_wood ?? 50);
            this.heroManager.confirmHeroes(this._heroes);
            this.heroManager.grantStartingItem();

            // 페이드 아웃
            const fade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
            fade.setDepth(200);
            this.tweens.add({
                targets: fade, alpha: 1, duration: 500,
                onComplete: () => this.scene.start('MapScene')
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
