"""
LPC 몬스터 스프라이트시트 → 게임 포맷 변환기

LPC monsters: 64×64 그리드, N cols × 4 rows (방향: South/West/East/North)
게임 포맷:
  idle.png  : 2 frames × 4 rows = 128×256
  walk.png  : 9 frames × 4 rows = 576×256
  slash.png : 6 frames × 4 rows = 384×256
  hurt.png  : 6 frames × 1 row  = 384×64
"""

from PIL import Image
import os
import sys

FRAME = 64
DEST_BASE = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'sprites')

# LPC monster sources
LPC_MONSTERS = os.path.join(os.path.dirname(__file__), '..', '..', 'lpc_temp', 'lpc-monsters', 'lpc-monsters')
BOSS_MONSTERS = os.path.join(os.path.dirname(__file__), '..', '..', 'lpc_temp', 'bosses-monsters-spritesheets', 'spritesheets')

# Monster definitions: (source_file, output_folder, frame_w, frame_h, cols, rows)
MONSTERS = {
    # From lpc-monsters (64×64 grid, 4 rows)
    'monster_slime':   ('slime.png',   LPC_MONSTERS, 64, 64, 8, 4),
    'monster_bat':     ('bat.png',     LPC_MONSTERS, 64, 64, 7, 4),
    'monster_snake':   ('snake.png',   LPC_MONSTERS, 64, 64, 7, 4),
    'monster_ghost':   ('ghost.png',   LPC_MONSTERS, 64, 64, 6, 4),
    'monster_eyeball': ('eyeball.png', LPC_MONSTERS, 64, 64, 7, 4),
    'monster_pumpking':('pumpking.png',LPC_MONSTERS, 64, 64, 6, 4),
    'monster_bee':     ('bee.png',     LPC_MONSTERS, 64, 64, 3, 2),
    'monster_worm':    ('small_worm.png', LPC_MONSTERS, 64, 64, 11, 4),
}

# Boss definitions (non-64 frame sizes)
BOSSES = {
    'boss_demon':   ('andromalius-57x88.png', BOSS_MONSTERS, 57, 88, 8, 3),
    'boss_shadow':  ('shadow-80x70.png',      BOSS_MONSTERS, 80, 70, 4, 5),
    'boss_minion':  ('minion-45x66.png',      BOSS_MONSTERS, 45, 66, 3, 2),  # smaller
}


def extract_frame(src_img, col, row, fw, fh):
    """Extract a single frame from spritesheet."""
    x = col * fw
    y = row * fh
    return src_img.crop((x, y, x + fw, y + fh))


def resize_frame_to_64(frame, fw, fh):
    """Resize a frame to fit in 64×64 while keeping aspect ratio, centered."""
    if fw == 64 and fh == 64:
        return frame

    canvas = Image.new('RGBA', (64, 64), (0, 0, 0, 0))

    # Scale to fit in 64×64
    scale = min(64 / fw, 64 / fh)
    new_w = int(fw * scale)
    new_h = int(fh * scale)
    resized = frame.resize((new_w, new_h), Image.NEAREST)

    # Center
    ox = (64 - new_w) // 2
    oy = 64 - new_h  # bottom-align for ground contact
    canvas.paste(resized, (ox, oy))
    return canvas


def create_idle(src_img, fw, fh, cols, rows):
    """Create idle.png: 2 frames × 4 rows = 128×256."""
    out = Image.new('RGBA', (2 * 64, 4 * 64), (0, 0, 0, 0))

    for row in range(min(rows, 4)):
        for f in range(2):
            col = f % cols  # wrap if not enough frames
            frame = extract_frame(src_img, col, row, fw, fh)
            frame = resize_frame_to_64(frame, fw, fh)
            out.paste(frame, (f * 64, row * 64))

    # If only 2 rows (like bee), duplicate South→East, West→North
    if rows < 4:
        for row in range(rows, 4):
            src_row = row % rows
            for f in range(2):
                col = f % cols
                frame = extract_frame(src_img, col, src_row, fw, fh)
                frame = resize_frame_to_64(frame, fw, fh)
                out.paste(frame, (f * 64, row * 64))

    return out


def create_walk(src_img, fw, fh, cols, rows):
    """Create walk.png: 9 frames × 4 rows = 576×256.

    Use all available columns, loop to fill 9 frames.
    """
    out = Image.new('RGBA', (9 * 64, 4 * 64), (0, 0, 0, 0))

    for row in range(min(rows, 4)):
        for f in range(9):
            col = f % cols
            frame = extract_frame(src_img, col, row, fw, fh)
            frame = resize_frame_to_64(frame, fw, fh)
            out.paste(frame, (f * 64, row * 64))

    if rows < 4:
        for row in range(rows, 4):
            src_row = row % rows
            for f in range(9):
                col = f % cols
                frame = extract_frame(src_img, col, src_row, fw, fh)
                frame = resize_frame_to_64(frame, fw, fh)
                out.paste(frame, (f * 64, row * 64))

    return out


def create_slash(src_img, fw, fh, cols, rows):
    """Create slash.png: 6 frames × 4 rows = 384×256.

    Use the later columns as 'attack' animation. If not enough, loop frames.
    """
    out = Image.new('RGBA', (6 * 64, 4 * 64), (0, 0, 0, 0))

    # Use columns starting from col 1 (or 2) for attack animation
    # Prioritize having enough variety
    attack_start = max(0, cols - 6)  # use last 6 columns as attack

    for row in range(min(rows, 4)):
        for f in range(6):
            col = attack_start + (f % (cols - attack_start))
            if col >= cols:
                col = cols - 1
            frame = extract_frame(src_img, col, row, fw, fh)
            frame = resize_frame_to_64(frame, fw, fh)
            out.paste(frame, (f * 64, row * 64))

    # Fill missing rows
    if rows < 4:
        for row in range(rows, 4):
            src_row = row % rows
            for f in range(6):
                col = attack_start + (f % (cols - attack_start))
                if col >= cols:
                    col = cols - 1
                frame = extract_frame(src_img, col, src_row, fw, fh)
                frame = resize_frame_to_64(frame, fw, fh)
                out.paste(frame, (f * 64, row * 64))

    return out


def create_hurt(src_img, fw, fh, cols, rows):
    """Create hurt.png: 6 frames × 1 row = 384×64.

    Use south-facing row, show a 'hit' effect by using last frames.
    """
    out = Image.new('RGBA', (6 * 64, 64), (0, 0, 0, 0))

    # Use row 0 (south facing), pick frames that suggest getting hit
    # Flash effect: alternate between normal and tinted frame
    row = 0
    for f in range(6):
        col = min(f, cols - 1)
        frame = extract_frame(src_img, col, row, fw, fh)
        frame = resize_frame_to_64(frame, fw, fh)

        # Apply red tint on odd frames to simulate hit
        if f % 2 == 1:
            frame = apply_hit_tint(frame)

        out.paste(frame, (f * 64, 0))

    return out


def apply_hit_tint(frame):
    """Apply a white flash tint to simulate being hit."""
    tinted = frame.copy()
    pixels = tinted.load()
    w, h = tinted.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # Shift towards white
                r = min(255, r + 100)
                g = min(255, g + 40)
                b = min(255, b + 40)
                pixels[x, y] = (r, g, b, a)
    return tinted


def process_monster(name, filename, src_dir, fw, fh, cols, rows):
    """Process a single monster spritesheet."""
    src_path = os.path.join(src_dir, filename)
    if not os.path.exists(src_path):
        print(f"  ❌ Source not found: {src_path}")
        return False

    src_img = Image.open(src_path).convert('RGBA')

    # Verify dimensions
    expected_w = cols * fw
    expected_h = rows * fh
    actual_w, actual_h = src_img.size
    if actual_w != expected_w or actual_h != expected_h:
        print(f"  ⚠ Size mismatch: expected {expected_w}×{expected_h}, got {actual_w}×{actual_h}")
        # Recalculate
        cols = actual_w // fw
        rows = actual_h // fh
        print(f"  → Adjusted to {cols}×{rows} grid")

    dest_dir = os.path.join(DEST_BASE, name)
    os.makedirs(dest_dir, exist_ok=True)

    idle = create_idle(src_img, fw, fh, cols, rows)
    walk = create_walk(src_img, fw, fh, cols, rows)
    slash = create_slash(src_img, fw, fh, cols, rows)
    hurt = create_hurt(src_img, fw, fh, cols, rows)

    idle.save(os.path.join(dest_dir, 'idle.png'))
    walk.save(os.path.join(dest_dir, 'walk.png'))
    slash.save(os.path.join(dest_dir, 'slash.png'))
    hurt.save(os.path.join(dest_dir, 'hurt.png'))

    print(f"  ✅ {name}: idle({idle.size}), walk({walk.size}), slash({slash.size}), hurt({hurt.size})")
    return True


def main():
    print("=== LPC Monster → Game Sprite Converter ===\n")

    success = 0
    total = 0

    print("▸ Processing monsters...")
    for name, (filename, src_dir, fw, fh, cols, rows) in MONSTERS.items():
        total += 1
        if process_monster(name, filename, src_dir, fw, fh, cols, rows):
            success += 1

    print("\n▸ Processing bosses...")
    for name, (filename, src_dir, fw, fh, cols, rows) in BOSSES.items():
        total += 1
        if process_monster(name, filename, src_dir, fw, fh, cols, rows):
            success += 1

    print(f"\n=== Done: {success}/{total} converted ===")


if __name__ == '__main__':
    main()
