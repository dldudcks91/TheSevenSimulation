/**
 * SpriteRenderer — Phaser RenderTexture를 이용한 LPC 레이어 합성
 *
 * 파츠 PNG를 일반 이미지로 로드 → RenderTexture에 레이어 합성
 * → 결과를 스프라이트시트로 등록 → 애니메이션 생성
 */

const FRAME_SIZE = 64;
const ANIM_FPS = 12;

// idle은 walk 텍스처를 공유 (별도 파일 없음)
const ACTIONS = ['walk', 'slash'];
const ACTION_FRAMES = { walk: 9, slash: 6 };

class SpriteRenderer {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * 파츠를 일반 이미지로 preload (스프라이트시트가 아님)
     */
    preloadParts(lpcParts) {
        for (const part of lpcParts) {
            for (const action of ACTIONS) {  // walk, slash만
                const key = `lpc_${part.path}_${action}`.replace(/\//g, '_');
                if (!this.scene.textures.exists(key)) {
                    this.scene.load.image(key, `assets/${part.path}_${action}.png`);
                }
            }
        }
    }

    /**
     * appearance의 파츠를 preload (특정 영웅용)
     */
    preloadAppearance(appearance, heroId) {
        for (const layerPath of appearance.layers) {
            for (const action of ACTIONS) {  // walk, slash만
                const key = `lpc_${layerPath}_${action}`.replace(/\//g, '_');
                if (!this.scene.textures.exists(key)) {
                    this.scene.load.image(key, `assets/${layerPath}_${action}.png`);
                }
            }
        }
    }

    /**
     * 파츠 레이어를 합성하여 액션별 스프라이트시트 텍스처 생성
     */
    compose(appearance, heroId) {
        const result = {};

        for (const action of ACTIONS) {
            const frames = ACTION_FRAMES[action];
            const width = frames * FRAME_SIZE;
            const height = FRAME_SIZE;
            const textureKey = `composed_${heroId}_${action}`;

            if (this.scene.textures.exists(textureKey)) {
                result[action] = textureKey;
                continue;
            }

            // RenderTexture 생성
            const rt = this.scene.add.renderTexture(-9999, -9999, width, height);

            // 레이어 합성: 임시 이미지 origin(0,0)으로 정확히 겹치기
            for (const layerPath of appearance.layers) {
                const imgKey = `lpc_${layerPath}_${action}`.replace(/\//g, '_');

                if (!this.scene.textures.exists(imgKey)) continue;

                const tmp = this.scene.make.image({ key: imgKey, add: false });
                tmp.setOrigin(0, 0);
                rt.draw(tmp, 0, 0);
            }

            // 합성 결과를 텍스처로 저장
            rt.saveTexture(textureKey);
            rt.destroy();

            // 프레임 수동 등록 (스프라이트시트화)
            const tex = this.scene.textures.get(textureKey);
            if (tex) {
                for (let i = 0; i < frames; i++) {
                    tex.add(i, 0, i * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE);
                }
            }

            result[action] = textureKey;
        }

        // idle = walk 공유
        result['idle'] = result['walk'];

        // 애니메이션 생성
        this._createAnimations(heroId, result);

        return result;
    }

    _createAnimations(heroId, textures) {
        // walk + slash
        for (const action of ACTIONS) {
            const key = textures[action];
            if (!key) continue;

            const frames = ACTION_FRAMES[action];
            const animKey = `${heroId}_${action}`;

            if (this.scene.anims.exists(animKey)) continue;

            this.scene.anims.create({
                key: animKey,
                frames: Array.from({ length: frames }, (_, i) => ({
                    key,
                    frame: i,
                })),
                frameRate: action === 'slash' ? ANIM_FPS * 1.5 : ANIM_FPS,
                repeat: action === 'slash' ? 0 : -1,
            });
        }

        // idle = walk 동일 (느린 속도)
        const walkKey = textures['walk'];
        if (walkKey) {
            const idleAnimKey = `${heroId}_idle`;
            if (!this.scene.anims.exists(idleAnimKey)) {
                this.scene.anims.create({
                    key: idleAnimKey,
                    frames: Array.from({ length: ACTION_FRAMES['walk'] }, (_, i) => ({
                        key: walkKey,
                        frame: i,
                    })),
                    frameRate: ANIM_FPS * 0.7,  // walk보다 약간 느리게
                    repeat: -1,
                });
            }
        }
    }

    /**
     * 합성된 idle 스프라이트 생성
     */
    createSprite(heroId, x, y) {
        const idleKey = `composed_${heroId}_idle`;
        if (!this.scene.textures.exists(idleKey)) return null;

        const sprite = this.scene.add.sprite(x, y, idleKey, 0);
        sprite.play(`${heroId}_idle`);
        return sprite;
    }
}

export default SpriteRenderer;
export { FRAME_SIZE, ANIM_FPS, ACTIONS, ACTION_FRAMES };
