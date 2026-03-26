"""
LPC Sprite Composer — 전문 스프라이트 합성 도구

사용법:
  python tools/lpc_composer.py list [category]     # 사용 가능한 파츠 목록
  python tools/lpc_composer.py compose <config>     # JSON 설정으로 합성
  python tools/lpc_composer.py preview <name>       # 기존 영웅 미리보기 (파일 경로 출력)
  python tools/lpc_composer.py rebuild              # 전체 영웅 재생성
  python tools/lpc_composer.py create <name> <base> <parts...>  # 빠른 생성

예시:
  python tools/lpc_composer.py list hair
  python tools/lpc_composer.py list weapon
  python tools/lpc_composer.py create hero_test warrior_male "hair/buzzcut/adult:carrot" "torso/armour/plate/male:gold"
"""
import os
import sys
import json
import glob
from PIL import Image

# =====================================================
# 경로 설정
# =====================================================

COMPOSED = r"C:\Users\user\Desktop\python_text\git\TheSevenRPG\fastapi\public\img\lpc\composed"
ASSETS = [
    r"C:\Users\user\Desktop\python_text\git\TheSevenRPG\fastapi\public\img\lpc\assets",
    r"C:\Users\user\Desktop\python_text\git\lpc_temp\spritesheets",
]
OUT = r"C:\Users\user\Desktop\python_text\git\TheSevenSimulation\src\assets\sprites"
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "lpc_heroes.json")

FRAME_SIZE = 64
EAST_ROW = 3

ACTIONS = ['idle', 'walk', 'slash']
ACTION_FRAMES = {'idle': 2, 'walk': 9, 'slash': 6}

# =====================================================
# 영웅 설정 (JSON으로도 관리 가능)
# =====================================================

DEFAULT_HEROES = {
    "hero_wrath": {
        "base": "warrior_male",
        "desc": "분노 - 동갑옷 전사, 빨간머리, 도끼",
        "parts": [
            {"path": "legs/pants/male", "color": "brown"},
            {"path": "torso/armour/plate/male", "color": "bronze"},
            {"path": "shoulders/epaulets/male", "color": "bronze"},
            {"path": "hair/buzzcut/adult", "color": "carrot"},
            {"path": "weapon/blunt/waraxe"},
        ]
    },
    "hero_envy": {
        "base": "warrior_female",
        "desc": "시기 - 가죽갑 정찰병, 갈색긴머리, 단검",
        "parts": [
            {"path": "dress/bodice/female", "color": "forest"},
            {"path": "torso/armour/leather/female", "color": "brown"},
            {"path": "hair/bangslong/adult", "color": "dark_brown"},
            {"path": "weapon/sword/dagger"},
        ]
    },
    "hero_greed": {
        "base": "warrior_male",
        "desc": "탐욕 - 레기온 금갑 귀족검사, 금곱슬머리, 레이피어",
        "parts": [
            {"path": "legs/formal/male", "color": "black"},
            {"path": "torso/armour/legion/male", "color": "gold"},
            {"path": "hair/curly_long/adult", "color": "gold"},
            {"path": "weapon/sword/rapier"},
        ]
    },
    "hero_sloth": {
        "base": "base_male",
        "desc": "나태 - 가죽갑 방랑학자, 잠자리머리, 지팡이",
        "parts": [
            {"path": "legs/pants/male", "color": "gray"},
            {"path": "torso/armour/leather/male", "color": "brown"},
            {"path": "hair/bedhead/adult", "color": "ash"},
            {"path": "weapon/polearm/cane"},
        ]
    },
    "hero_gluttony": {
        "base": "warrior_male",
        "desc": "폭식 - 철갑 중장전사, 아프로, 메이스+방패",
        "parts": [
            {"path": "legs/pants/male", "color": "brown"},
            {"path": "torso/armour/plate/male", "color": "iron"},
            {"path": "shoulders/epaulets/male", "color": "silver"},
            {"path": "hair/afro/adult", "color": "dark_brown"},
            {"path": "weapon/blunt/mace"},
            {"path": "shield/heater/original/paint", "color": "blue"},
        ]
    },
    "hero_lust": {
        "base": "base_female",
        "desc": "색욕 - 보라드레스 마법사, 핑크머리",
        "parts": [
            {"path": "dress/bodice/female", "color": "purple"},
            {"path": "hair/braid/adult", "color": "pink"},
            {"path": "weapon/magic/wand/female"},
        ]
    },
    "hero_pride": {
        "base": "warrior_male",
        "desc": "교만 - 금갑 성기사, 흰망토, 흰머리, 롱소드",
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

# =====================================================
# 핵심 함수
# =====================================================

def find_png(rel_path, action, color=None):
    """두 소스에서 파츠 PNG를 찾는다. idle 없으면 walk로 fallback."""
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

    if action == 'idle':
        return find_png(rel_path, 'walk', color)
    return None


def extract_east_row(img, num_frames):
    """스프라이트시트에서 East(row 3) 행만 추출"""
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
    """한 액션에 대해 base + parts 합성"""
    num_frames = ACTION_FRAMES.get(action, 6)
    base_path = os.path.join(COMPOSED, base_type, f"{action}.png")
    if not os.path.exists(base_path) and action == 'idle':
        base_path = os.path.join(COMPOSED, base_type, "walk.png")
    if not os.path.exists(base_path):
        return None, 0

    base_img = Image.open(base_path).convert("RGBA")
    result = extract_east_row(base_img, num_frames)
    found = 1

    for entry in parts:
        path = entry if isinstance(entry, str) else entry.get("path", "")
        color = None if isinstance(entry, str) else entry.get("color")

        if isinstance(entry, str) and ":" in entry:
            path, color = entry.rsplit(":", 1)

        png = find_png(path, action, color)
        if not png:
            continue

        layer = Image.open(png).convert("RGBA")
        layer_strip = extract_east_row(layer, num_frames)
        if layer_strip.size != result.size:
            layer_strip = layer_strip.resize(result.size, Image.NEAREST)
        result = Image.alpha_composite(result, layer_strip)
        found += 1

    return result, found


def compose_hero(name, cfg, output_dir=None):
    """영웅 1명의 전체 스프라이트 생성"""
    hero_dir = os.path.join(output_dir or OUT, name)
    os.makedirs(hero_dir, exist_ok=True)
    results = {}

    for action in ACTIONS:
        img, count = compose_action(cfg["base"], cfg["parts"], action)
        total = 1 + len(cfg["parts"])
        if img:
            out_path = os.path.join(hero_dir, f"{action}.png")
            img.save(out_path)
            frames = img.size[0] // FRAME_SIZE
            results[action] = {"frames": frames, "found": count, "total": total, "path": out_path}
        else:
            results[action] = None

    return results

# =====================================================
# list 명령 — 사용 가능한 파츠 탐색
# =====================================================

CATEGORIES = {
    "hair": "hair",
    "torso": "torso",
    "legs": "legs",
    "dress": "dress",
    "cape": "cape",
    "weapon": "weapon",
    "shield": "shield",
    "shoulders": "shoulders",
    "hat": "hat",
    "body": "body/bodies",
}

def cmd_list(category=None):
    """사용 가능한 파츠 목록 출력"""
    if category and category in CATEGORIES:
        cats = {category: CATEGORIES[category]}
    elif category:
        print(f"Unknown category: {category}")
        print(f"Available: {', '.join(CATEGORIES.keys())}")
        return
    else:
        cats = CATEGORIES

    for cat_name, cat_path in cats.items():
        print(f"\n=== {cat_name} ===")
        seen = set()
        for src in ASSETS:
            base = os.path.join(src, cat_path)
            if not os.path.isdir(base):
                continue

            for root, dirs, files in os.walk(base):
                depth = root.replace(base, "").count(os.sep)
                if depth > 5:
                    dirs.clear()
                    continue

                pngs = [f for f in files if f.endswith('.png')]
                dirname = os.path.basename(root)

                # slash/walk/idle/attack_slash 등의 액션 디렉토리 안의 파일
                if dirname in ('slash', 'walk', 'idle', 'attack_slash', 'combat_idle'):
                    rel = os.path.relpath(os.path.dirname(root), src)
                    if rel in seen:
                        continue
                    seen.add(rel)
                    colors = sorted(set(os.path.splitext(f)[0] for f in pngs))
                    if colors:
                        print(f"  {rel}")
                        print(f"    [{', '.join(colors[:8])}{'...' if len(colors) > 8 else ''}]")

                # 무기 등: 디렉토리에 직접 .png가 있는 경우
                elif pngs and dirname not in ('bg', 'fg', 'behind'):
                    rel = os.path.relpath(root, src)
                    if rel in seen:
                        continue
                    # 하위에 액션 디렉토리가 있는지 확인
                    has_action = any(d in ('slash', 'walk', 'attack_slash') for d in dirs)
                    if has_action and depth < 4:
                        continue  # 이 디렉토리는 파츠 루트, 하위에서 출력될 것
                    seen.add(rel)


def cmd_compose(config_path):
    """JSON 설정 파일로 합성"""
    with open(config_path, 'r', encoding='utf-8') as f:
        heroes = json.load(f)

    for name, cfg in heroes.items():
        print(f"\n=== {name}: {cfg.get('desc', '')} ===")
        results = compose_hero(name, cfg)
        for action, res in results.items():
            if res:
                status = "OK" if res["found"] == res["total"] else f"PARTIAL ({res['found']}/{res['total']})"
                print(f"  {action}: {status} - {res['frames']}f")
            else:
                print(f"  {action}: FAILED")


def cmd_create(name, base, parts_strs):
    """빠른 생성 — CLI에서 직접 파츠 지정"""
    parts = []
    for ps in parts_strs:
        if ":" in ps:
            path, color = ps.rsplit(":", 1)
            parts.append({"path": path, "color": color})
        else:
            parts.append({"path": ps})

    cfg = {"base": base, "desc": f"Custom: {name}", "parts": parts}
    print(f"\n=== {name} (base: {base}) ===")
    results = compose_hero(name, cfg)
    for action, res in results.items():
        if res:
            status = "OK" if res["found"] == res["total"] else f"PARTIAL ({res['found']}/{res['total']})"
            print(f"  {action}: {status} - {res['frames']}f -> {res['path']}")
        else:
            print(f"  {action}: FAILED")


def cmd_rebuild():
    """전체 영웅 재생성"""
    # JSON 설정이 있으면 그걸 사용
    if os.path.exists(CONFIG_FILE):
        print(f"Using config: {CONFIG_FILE}")
        cmd_compose(CONFIG_FILE)
    else:
        print("Using default heroes config")
        for name, cfg in DEFAULT_HEROES.items():
            print(f"\n=== {name}: {cfg.get('desc', '')} ===")
            results = compose_hero(name, cfg)
            for action, res in results.items():
                if res:
                    status = "OK" if res["found"] == res["total"] else f"PARTIAL ({res['found']}/{res['total']})"
                    print(f"  {action}: {status} - {res['frames']}f")
                else:
                    print(f"  {action}: FAILED")


def cmd_preview(name):
    """기존 영웅 스프라이트 경로 출력"""
    hero_dir = os.path.join(OUT, name)
    if not os.path.isdir(hero_dir):
        print(f"Not found: {hero_dir}")
        return
    for action in ACTIONS:
        p = os.path.join(hero_dir, f"{action}.png")
        if os.path.exists(p):
            img = Image.open(p)
            print(f"  {action}: {img.size[0]}x{img.size[1]} ({img.size[0]//FRAME_SIZE}f) -> {p}")
        else:
            print(f"  {action}: MISSING")


def cmd_save_config():
    """현재 DEFAULT_HEROES를 JSON으로 저장"""
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(DEFAULT_HEROES, f, ensure_ascii=False, indent=2)
    print(f"Saved: {CONFIG_FILE}")


# =====================================================
# CLI
# =====================================================

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]

    if cmd == 'list':
        category = sys.argv[2] if len(sys.argv) > 2 else None
        cmd_list(category)
    elif cmd == 'compose':
        if len(sys.argv) < 3:
            print("Usage: compose <config.json>")
            return
        cmd_compose(sys.argv[2])
    elif cmd == 'create':
        if len(sys.argv) < 4:
            print("Usage: create <name> <base> [parts...]")
            print("  parts: 'path:color' or 'path'")
            print("  example: create hero_test warrior_male 'hair/buzzcut/adult:carrot' 'torso/armour/plate/male:gold'")
            return
        cmd_create(sys.argv[2], sys.argv[3], sys.argv[4:])
    elif cmd == 'preview':
        name = sys.argv[2] if len(sys.argv) > 2 else None
        if not name:
            # 전체 목록
            for d in sorted(os.listdir(OUT)):
                if d.startswith('hero_'):
                    print(f"\n{d}:")
                    cmd_preview(d)
        else:
            cmd_preview(name)
    elif cmd == 'rebuild':
        cmd_rebuild()
    elif cmd == 'save-config':
        cmd_save_config()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    main()
