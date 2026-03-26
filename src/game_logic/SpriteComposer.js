/**
 * 스프라이트 합성 — 순수 JS (Phaser 의존 없음)
 *
 * lpcParts 매니페스트를 받아 랜덤 파츠 조합을 결정.
 * 렌더링은 SpriteRenderer(Phaser)가 담당.
 */

class SpriteComposer {
    constructor(lpcParts = []) {
        this._parts = lpcParts;
        this._byCategory = {};

        for (const part of lpcParts) {
            const cat = part.category;
            if (!this._byCategory[cat]) this._byCategory[cat] = [];
            this._byCategory[cat].push(part);
        }
    }

    /**
     * 성별에 맞는 파츠 필터
     */
    _filterGender(parts, gender) {
        return parts.filter(p => p.gender === 'any' || p.gender === gender);
    }

    _pick(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * 랜덤 외형 생성
     * @returns {object} appearance = { base, body, hair, torso, legs, weapon, shield?, cape?, shoulders?, dress? }
     */
    generateAppearance() {
        const gender = Math.random() < 0.5 ? 'male' : 'female';

        // 베이스 몸체 — 날 바디(속옷)만 사용, warrior/composed 제외
        const bases = (this._byCategory.base || []).filter(
            b => b.id === (gender === 'male' ? 'base_male' : 'base_female')
        );
        const base = bases[0] || null;

        // 헤어 (필수)
        const hairs = this._filterGender(this._byCategory.hair || [], gender);
        const hair = this._pick(hairs);

        let appearance;

        if (gender === 'male') {
            appearance = this._composeMale(base, hair);
        } else {
            appearance = this._composeFemale(base, hair);
        }

        appearance.gender = gender;
        return appearance;
    }

    _composeMale(base, hair) {
        const torsos = this._filterGender(this._byCategory.torso || [], 'male');
        const legsList = this._filterGender(this._byCategory.legs || [], 'male');
        const weapons = this._filterGender(this._byCategory.weapon || [], 'male');
        const shoulders = this._filterGender(this._byCategory.shoulders || [], 'male');
        const capes = this._filterGender(this._byCategory.cape || [], 'male');
        const shields = this._filterGender(this._byCategory.shield || [], 'male');

        const torso = this._pick(torsos);
        const legs = this._pick(legsList);
        const weapon = this._pick(weapons);

        // 선택적 파츠 (확률적)
        const shoulder = Math.random() < 0.4 ? this._pick(shoulders) : null;
        const cape = Math.random() < 0.2 ? this._pick(capes) : null;
        const shield = Math.random() < 0.3 ? this._pick(shields) : null;

        // 레이어 순서: base → legs → torso → cape → shoulders → hair → weapon → shield
        const layers = [base, legs, torso, cape, shoulder, hair, weapon, shield].filter(Boolean);

        return {
            base: base?.id,
            hair: hair?.id,
            torso: torso?.id,
            legs: legs?.id,
            weapon: weapon?.id,
            shoulders: shoulder?.id,
            cape: cape?.id,
            shield: shield?.id,
            layers: layers.map(l => l.path),
        };
    }

    _composeFemale(base, hair) {
        const dresses = this._filterGender(this._byCategory.dress || [], 'female');
        const torsos = this._filterGender(this._byCategory.torso || [], 'female');
        const legsList = this._filterGender(this._byCategory.legs || [], 'female');
        const weapons = this._filterGender(this._byCategory.weapon || [], 'female');
        const capes = this._filterGender(this._byCategory.cape || [], 'female');

        // 드레스 vs 갑옷+바지 선택
        const useDress = Math.random() < 0.4;

        let torso = null;
        let legs = null;
        let dress = null;

        if (useDress && dresses.length > 0) {
            dress = this._pick(dresses);
        } else {
            torso = this._pick(torsos);
            legs = this._pick(legsList);
        }

        const weapon = this._pick(weapons);
        const cape = Math.random() < 0.2 ? this._pick(capes) : null;

        const layers = [base, legs, dress, torso, cape, hair, weapon].filter(Boolean);

        return {
            base: base?.id,
            hair: hair?.id,
            torso: torso?.id,
            legs: legs?.id,
            dress: dress?.id,
            weapon: weapon?.id,
            cape: cape?.id,
            layers: layers.map(l => l.path),
        };
    }

    /**
     * 파츠 경로에서 로드해야 할 스프라이트시트 키 목록 반환
     * @param {object} appearance
     * @returns {Array<{key, path, action, frames}>}
     */
    getLoadList(appearance) {
        const list = [];
        const actions = ['idle', 'walk', 'slash'];
        const frameMap = { idle: 2, walk: 9, slash: 6 };

        for (const layerPath of appearance.layers) {
            for (const action of actions) {
                list.push({
                    key: `${layerPath}_${action}`.replace(/\//g, '_'),
                    path: `assets/${layerPath}_${action}.png`,
                    frames: frameMap[action],
                });
            }
        }

        return list;
    }
}

export default SpriteComposer;
