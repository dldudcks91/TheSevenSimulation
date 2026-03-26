"""
LPC 파츠 추출기 — East 행만 추출하여 프로젝트 내부에 저장
외부 폴더 의존성 제거, 게임에서 필요한 파츠만 단일 행으로 추출

출력:
  src/assets/lpc/{category}/{name}_{color}_{action}.png  (64px 높이, 단일 행)
  src/data/lpc_parts.csv  (파츠 매니페스트)
"""
import os
import csv
from PIL import Image

# =====================================================
# 설정
# =====================================================

SOURCES = [
    r"C:\Users\user\Desktop\python_text\git\TheSevenRPG\fastapi\public\img\lpc\assets",
    r"C:\Users\user\Desktop\python_text\git\lpc_temp\spritesheets",
]
COMPOSED = r"C:\Users\user\Desktop\python_text\git\TheSevenRPG\fastapi\public\img\lpc\composed"
OUT_LPC = r"C:\Users\user\Desktop\python_text\git\TheSevenSimulation\src\assets\lpc"
OUT_CSV = r"C:\Users\user\Desktop\python_text\git\TheSevenSimulation\src\data\lpc_parts.csv"

FRAME_SIZE = 64
EAST_ROW = 3
# idle 제거 — walk가 idle 역할을 겸함
ACTIONS = ['walk', 'slash']
ACTION_FRAMES = {'walk': 9, 'slash': 6}

# =====================================================
# 추출할 파츠 정의
# =====================================================

# (category, rel_path, variants[], gender_filter)
# variants = 색상 목록 or None(단일 파일)

SKIN_COLORS = ['light', 'olive', 'bronze', 'pale', 'brown', 'dark']
HAIR_COLORS = ['black', 'blonde', 'carrot', 'dark_brown', 'ash', 'gold', 'white', 'pink', 'chestnut', 'ginger', 'red']
ARMOR_COLORS = ['bronze', 'gold', 'iron', 'silver', 'steel', 'brass']
CLOTH_COLORS = ['black', 'brown', 'blue', 'gray', 'forest', 'white', 'maroon', 'charcoal']

PARTS_DEF = [
    # === 베이스 몸체 (composed에서) ===
    # composed는 별도 처리

    # === 바디 스킨 ===
    ("body", "body/bodies/male", SKIN_COLORS, "male"),
    ("body", "body/bodies/female", SKIN_COLORS, "female"),

    # === 헤어 ===
    ("hair", "hair/buzzcut/adult", HAIR_COLORS, None),
    ("hair", "hair/bedhead/adult", HAIR_COLORS, None),
    ("hair", "hair/bangslong/adult", HAIR_COLORS, None),
    ("hair", "hair/curly_long/adult", HAIR_COLORS, None),
    ("hair", "hair/cowlick_tall/adult", HAIR_COLORS, None),
    ("hair", "hair/afro/adult", HAIR_COLORS, None),
    ("hair", "hair/bob/adult", HAIR_COLORS, None),
    ("hair", "hair/braid/adult", HAIR_COLORS, None),  # bg 폴더
    ("hair", "hair/cornrows/adult", HAIR_COLORS, None),
    ("hair", "hair/mohawk/adult", HAIR_COLORS, None),

    # === 상체 갑옷 ===
    ("torso", "torso/armour/plate/male", ARMOR_COLORS, "male"),
    ("torso", "torso/armour/plate/female", ARMOR_COLORS, "female"),
    ("torso", "torso/armour/legion/male", ARMOR_COLORS, "male"),
    ("torso", "torso/armour/legion/female", ARMOR_COLORS, "female"),
    ("torso", "torso/armour/leather/male", CLOTH_COLORS, "male"),
    ("torso", "torso/armour/leather/female", CLOTH_COLORS, "female"),
    ("torso", "torso/chainmail/male", ['gray'], "male"),
    ("torso", "torso/chainmail/female", ['gray'], "female"),

    # === 상체 의류 ===
    ("torso", "torso/clothes/longsleeve/laced/male", CLOTH_COLORS, "male"),
    ("torso", "torso/clothes/longsleeve/formal/male", ['white'], "male"),

    # === 하체 ===
    ("legs", "legs/pants/male", CLOTH_COLORS, "male"),
    ("legs", "legs/pants/female", CLOTH_COLORS, "female"),
    ("legs", "legs/formal/male", CLOTH_COLORS, "male"),
    ("legs", "legs/armour/plate/male", ARMOR_COLORS, "male"),
    ("legs", "legs/armour/plate/female", ARMOR_COLORS, "female"),

    # === 드레스 ===
    ("dress", "dress/bodice/female", CLOTH_COLORS + ['purple', 'lavender'], "female"),

    # === 어깨갑 ===
    ("shoulders", "shoulders/epaulets/male", ['bronze', 'gold', 'silver', 'red', 'blue'], "male"),

    # === 망토 ===
    ("cape", "cape/solid/male", ['black', 'blue', 'brown', 'white', 'red', 'green', 'maroon'], "male"),
    ("cape", "cape/solid/female", ['black', 'blue', 'brown', 'white', 'red', 'green', 'forest'], "female"),

    # === 무기 (색상 없음, 단일) ===
    ("weapon", "weapon/blunt/waraxe", None, None),
    ("weapon", "weapon/blunt/mace", None, None),
    ("weapon", "weapon/sword/dagger", None, None),
    ("weapon", "weapon/sword/rapier", None, None),
    ("weapon", "weapon/sword/longsword", None, None),
    ("weapon", "weapon/polearm/cane/male", None, "male"),
    ("weapon", "weapon/polearm/spear", None, None),
    ("weapon", "weapon/polearm/halberd", None, None),
    ("weapon", "weapon/magic/wand/female", None, "female"),
    ("weapon", "weapon/magic/wand/male", None, "male"),

    # === 방패 ===
    ("shield", "shield/heater/original/paint/fg", ['blue', 'red', 'black', 'white', 'gold', 'green'], None),
    ("shield", "shield/crusader/fg/male", ['crusader'], "male"),
]


def find_png(rel_path, action, color=None):
    """소스에서 PNG 찾기. (path, is_fallback) 튜플 반환"""
    act_aliases = [action]
    if action == 'idle':
        act_aliases += ['combat_idle']
    if action == 'slash':
        act_aliases += ['attack_slash']

    for src in SOURCES:
        base = os.path.join(src, rel_path)
        for act in act_aliases:
            if color:
                p = os.path.join(base, act, f"{color}.png")
                if os.path.exists(p): return p, False
                p = os.path.join(base, "bg", act, f"{color}.png")
                if os.path.exists(p): return p, False
            p = os.path.join(base, f"{act}.png")
            if os.path.exists(p): return p, False
            parent = os.path.basename(base)
            p = os.path.join(base, act, f"{parent}.png")
            if os.path.exists(p): return p, False

    return None, False


def extract_east_row(img, num_frames, is_idle_fallback=False):
    """East 행 추출. idle_fallback이면 0번 프레임을 반복"""
    w, h = img.size
    rows = h // FRAME_SIZE
    strip = Image.new("RGBA", (num_frames * FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    src_row = EAST_ROW if rows > EAST_ROW else 0
    y = src_row * FRAME_SIZE
    cols = w // FRAME_SIZE

    if is_idle_fallback and cols > 0:
        # walk fallback: 0번 프레임만 반복 (정지 포즈)
        frame = img.crop((0, y, FRAME_SIZE, y + FRAME_SIZE))
        for i in range(num_frames):
            strip.paste(frame, (i * FRAME_SIZE, 0), frame)
    else:
        for i in range(min(num_frames, cols)):
            frame = img.crop((i * FRAME_SIZE, y, (i + 1) * FRAME_SIZE, y + FRAME_SIZE))
            strip.paste(frame, (i * FRAME_SIZE, 0), frame)
    return strip


def make_part_id(rel_path, color=None):
    """파츠 경로를 ID로 변환: torso/armour/plate/male + gold → plate_male_gold"""
    parts = rel_path.replace("\\", "/").split("/")
    # 의미 있는 부분만
    skip = {'torso', 'legs', 'body', 'hair', 'weapon', 'dress', 'cape', 'shoulders', 'shield',
            'clothes', 'armour', 'bodies', 'blunt', 'sword', 'polearm', 'magic', 'adult',
            'original', 'paint', 'heater', 'longsleeve', 'fg', 'bg'}
    meaningful = [p for p in parts if p not in skip]
    name = "_".join(meaningful)
    if color:
        name += f"_{color}"
    return name


def main():
    os.makedirs(OUT_LPC, exist_ok=True)
    manifest = []
    total_files = 0

    # === composed 베이스 몸체 추출 ===
    for base_type in ['base_male', 'base_female', 'warrior_male', 'warrior_female']:
        cat_dir = os.path.join(OUT_LPC, "base")
        os.makedirs(cat_dir, exist_ok=True)

        for action in ACTIONS:
            src_path = os.path.join(COMPOSED, base_type, f"{action}.png")
            if not os.path.exists(src_path):
                continue
            img = Image.open(src_path).convert("RGBA")
            strip = extract_east_row(img, ACTION_FRAMES[action])

            out_name = f"{base_type}_{action}.png"
            strip.save(os.path.join(cat_dir, out_name))
            total_files += 1

        gender = "male" if "male" in base_type else "female"
        manifest.append({
            "id": base_type,
            "category": "base",
            "gender": gender,
            "path": f"lpc/base/{base_type}",
            "frames_walk": ACTION_FRAMES['walk'],
            "frames_slash": ACTION_FRAMES['slash'],
        })
        print(f"  base/{base_type}: OK")

    # === 파츠 추출 ===
    for category, rel_path, variants, gender in PARTS_DEF:
        cat_dir = os.path.join(OUT_LPC, category)
        os.makedirs(cat_dir, exist_ok=True)

        if variants is None:
            # 단일 파츠 (무기 등)
            part_id = make_part_id(rel_path)
            any_found = False

            for action in ACTIONS:
                png, is_fallback = find_png(rel_path, action)
                if not png:
                    continue
                img = Image.open(png).convert("RGBA")
                strip = extract_east_row(img, ACTION_FRAMES[action], is_fallback)
                out_name = f"{part_id}_{action}.png"
                strip.save(os.path.join(cat_dir, out_name))
                total_files += 1
                any_found = True

            if any_found:
                manifest.append({
                    "id": part_id,
                    "category": category,
                    "gender": gender or "any",
                    "path": f"lpc/{category}/{part_id}",
                    "frames_walk": ACTION_FRAMES['walk'],
                    "frames_slash": ACTION_FRAMES['slash'],
                })
                print(f"  {category}/{part_id}: OK")
        else:
            # 색상 변형
            for color in variants:
                part_id = make_part_id(rel_path, color)
                any_found = False

                for action in ACTIONS:
                    png, is_fallback = find_png(rel_path, action, color)
                    if not png:
                        continue
                    img = Image.open(png).convert("RGBA")
                    strip = extract_east_row(img, ACTION_FRAMES[action], is_fallback)
                    out_name = f"{part_id}_{action}.png"
                    strip.save(os.path.join(cat_dir, out_name))
                    total_files += 1
                    any_found = True

                if any_found:
                    manifest.append({
                        "id": part_id,
                        "category": category,
                        "gender": gender or "any",
                        "path": f"lpc/{category}/{part_id}",
                        "frames_walk": ACTION_FRAMES['walk'],
                        "frames_slash": ACTION_FRAMES['slash'],
                    })
                    print(f"  {category}/{part_id}: OK")

    # === CSV 매니페스트 저장 ===
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'category', 'gender', 'path', 'frames_walk', 'frames_slash'])
        writer.writeheader()
        writer.writerows(manifest)

    print(f"\nDone! {total_files} files, {len(manifest)} parts -> {OUT_CSV}")


if __name__ == "__main__":
    main()
