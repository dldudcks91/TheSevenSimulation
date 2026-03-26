"""
LPC 스프라이트 합성 v6 - 중세 전사 테마
- composed 기본 몸체 사용
- idle 누락 시 walk 첫 프레임으로 대체
- East 행만 추출 -> 단일 행 스프라이트시트
"""
from PIL import Image
import os

COMPOSED = r"C:\Users\user\Desktop\python_text\git\TheSevenRPG\fastapi\public\img\lpc\composed"
ASSETS = [
    r"C:\Users\user\Desktop\python_text\git\TheSevenRPG\fastapi\public\img\lpc\assets",
    r"C:\Users\user\Desktop\python_text\git\lpc_temp\spritesheets",
]
OUT = r"C:\Users\user\Desktop\python_text\git\TheSevenSimulation\src\assets\sprites"

FRAME_SIZE = 64
EAST_ROW = 3

ACTIONS = ['idle', 'walk', 'slash']
ACTION_FRAMES = {'idle': 2, 'walk': 9, 'slash': 6}


def find_png(rel_path, action, color=None):
    act_aliases = [action]
    if action == 'idle':
        act_aliases += ['combat_idle']
    if action == 'slash':
        act_aliases += ['attack_slash']

    for src in ASSETS:
        base = os.path.join(src, rel_path)
        for act in act_aliases:
            if color:
                p = os.path.join(base, act, f"{color}.png")
                if os.path.exists(p): return p
                p = os.path.join(base, "bg", act, f"{color}.png")
                if os.path.exists(p): return p
            p = os.path.join(base, f"{act}.png")
            if os.path.exists(p): return p
            parent = os.path.basename(base)
            p = os.path.join(base, act, f"{parent}.png")
            if os.path.exists(p): return p

    # idle 못 찾으면 walk로 대체
    if action == 'idle':
        return find_png(rel_path, 'walk', color)

    return None


def extract_east_row(img, num_frames):
    w, h = img.size
    rows = h // FRAME_SIZE
    cols = w // FRAME_SIZE
    strip = Image.new("RGBA", (num_frames * FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))

    src_row = EAST_ROW if rows > EAST_ROW else 0
    y = src_row * FRAME_SIZE

    for i in range(min(num_frames, cols)):
        frame = img.crop((i * FRAME_SIZE, y, (i + 1) * FRAME_SIZE, y + FRAME_SIZE))
        strip.paste(frame, (i * FRAME_SIZE, 0), frame)
    return strip


def compose_action(base_type, parts, action):
    num_frames = ACTION_FRAMES.get(action, 6)

    base_path = os.path.join(COMPOSED, base_type, f"{action}.png")
    # composed에 없으면 walk로 대체
    if not os.path.exists(base_path) and action == 'idle':
        base_path = os.path.join(COMPOSED, base_type, "walk.png")
    if not os.path.exists(base_path):
        print(f"    BASE MISSING: {base_path}")
        return None, 0

    base_img = Image.open(base_path).convert("RGBA")
    result = extract_east_row(base_img, num_frames)
    found = 1

    for entry in parts:
        png = find_png(entry["path"], action, entry.get("color"))
        if not png:
            continue

        layer = Image.open(png).convert("RGBA")
        layer_strip = extract_east_row(layer, num_frames)

        if layer_strip.size != result.size:
            layer_strip = layer_strip.resize(result.size, Image.NEAREST)
        result = Image.alpha_composite(result, layer_strip)
        found += 1

    return result, found


# =====================================================
# 7 영웅 — 중세 전사 테마
# =====================================================

HEROES = {
    # 분노 — 남, 전사. 플레이트 갑옷(동), 갈색바지, 빨간 짧은머리, 어깨갑, 도끼
    "hero_wrath": {
        "base": "warrior_male",
        "parts": [
            {"path": "legs/pants/male", "color": "brown"},
            {"path": "torso/armour/plate/male", "color": "bronze"},
            {"path": "shoulders/epaulets/male", "color": "bronze"},
            {"path": "hair/buzzcut/adult", "color": "carrot"},
            {"path": "weapon/blunt/waraxe"},
        ]
    },
    # 시기 — 여, 정찰병. 가죽갑, 초록 드레스, 갈색 긴머리, 단검
    "hero_envy": {
        "base": "warrior_female",
        "parts": [
            {"path": "dress/bodice/female", "color": "forest"},
            {"path": "torso/armour/leather/female", "color": "brown"},
            {"path": "hair/bangslong/adult", "color": "dark_brown"},
            {"path": "weapon/sword/dagger"},
        ]
    },
    # 탐욕 — 남, 귀족 검사. 레기온 갑옷(금), 정장바지, 금곱슬머리, 레이피어
    "hero_greed": {
        "base": "warrior_male",
        "parts": [
            {"path": "legs/formal/male", "color": "black"},
            {"path": "torso/armour/legion/male", "color": "gold"},
            {"path": "hair/curly_long/adult", "color": "gold"},
            {"path": "weapon/sword/rapier"},
        ]
    },
    # 나태 — 남, 방랑 학자. 가죽갑, 회색바지, 잠자리머리, 지팡이
    "hero_sloth": {
        "base": "base_male",
        "parts": [
            {"path": "legs/pants/male", "color": "gray"},
            {"path": "torso/armour/leather/male", "color": "brown"},
            {"path": "hair/bedhead/adult", "color": "ash"},
            {"path": "weapon/polearm/cane"},
        ]
    },
    # 폭식 — 남, 중장 전사. 플레이트 갑옷(철), 어깨갑, 아프로, 메이스, 방패
    "hero_gluttony": {
        "base": "warrior_male",
        "parts": [
            {"path": "legs/pants/male", "color": "brown"},
            {"path": "torso/armour/plate/male", "color": "iron"},
            {"path": "shoulders/epaulets/male", "color": "silver"},
            {"path": "hair/afro/adult", "color": "dark_brown"},
            {"path": "weapon/blunt/mace"},
            {"path": "shield/heater/original/paint", "color": "blue"},
        ]
    },
    # 색욕 — 여, 마법사. 보라 드레스, 핑크 브레이드, 마법 지팡이
    "hero_lust": {
        "base": "base_female",
        "parts": [
            {"path": "dress/bodice/female", "color": "purple"},
            {"path": "hair/braid/adult", "color": "pink"},
            {"path": "weapon/magic/wand/female"},
        ]
    },
    # 교만 — 남, 성기사. 금갑옷, 금다리갑, 흰망토, 어깨갑, 흰머리, 롱소드
    "hero_pride": {
        "base": "warrior_male",
        "parts": [
            {"path": "legs/armour/plate/male", "color": "gold"},
            {"path": "torso/armour/plate/male", "color": "gold"},
            {"path": "shoulders/epaulets/male", "color": "gold"},
            {"path": "cape/solid/male", "color": "white"},
            {"path": "hair/cowlick_tall/adult", "color": "white"},
            {"path": "weapon/sword/longsword"},
        ]
    },
}


def main():
    os.makedirs(OUT, exist_ok=True)

    for name, cfg in HEROES.items():
        hero_dir = os.path.join(OUT, name)
        os.makedirs(hero_dir, exist_ok=True)
        print(f"\n=== {name} (base: {cfg['base']}) ===")

        for action in ACTIONS:
            img, count = compose_action(cfg["base"], cfg["parts"], action)
            total = 1 + len(cfg["parts"])
            if img:
                out_path = os.path.join(hero_dir, f"{action}.png")
                img.save(out_path)
                frames = img.size[0] // FRAME_SIZE
                status = "OK" if count == total else f"PARTIAL ({count}/{total})"
                print(f"  {action}: {status} - {frames}f")
            else:
                print(f"  {action}: FAILED")

    print("\nDone!")


if __name__ == "__main__":
    main()
