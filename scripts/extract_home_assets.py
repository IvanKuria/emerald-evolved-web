"""The game assets and animation tables the home page uses, on top of extract_assets.py.

Sources, all from the game's own code and graphics:

- The follower (overworld) sheet of Eevee and its two palettes, from pokeemerald-expansion 1.17.2
  (graphics/pokemon/eevee/overworld.png, overworld_normal.pal, overworld_shiny.pal), copied
  unchanged into scripts/sources/expansion/eevee/. Six 32x32 frames: south, south step, north,
  north step, west, west step; east is west mirrored (sAnimTable_Following).
- The ocean, pret pokeemerald data/tilesets/primary/general: metatile 0x170 (tiles 454, 455, 455,
  454, palette 4, the water of Route 105) drawn from each of the eight animation frames in
  anim/water/, which the game swaps into VRAM tile 432 every 16 frames (tileset_anims.c).
- The egg shards, the PC's hand cursor and the overworld shadow, from pret pokeemerald graphics/.
- The hatch timeline and Eevee's front-sprite animation, from the frame-by-frame ports of
  egg_hatch.c and pokemon_animation.c in research/pokemon-genetics/animation (ANIMATION.md there
  cites every line they come from).

usage: python3 scripts/extract_home_assets.py
"""
import json, struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'game'
DATA = ROOT / 'src' / 'data'
DECOMP = Path('/Users/ivankuria/deathnote-lifespan/research/pokemon-genetics/pokeemerald')
ANIM = Path('/Users/ivankuria/deathnote-lifespan/research/pokemon-genetics/animation')
EXP = ROOT / 'scripts' / 'sources' / 'expansion'
DATA.mkdir(parents=True, exist_ok=True)


def jasc(path):
    lines = path.read_text().split()
    n = int(lines[2])
    return [[int(lines[3 + i * 3 + k]) for k in range(3)] for i in range(n)]


def five(pal):
    """8-bit JASC colors to the 5-bit values the GBA stores (gbagfx does v >> 3)."""
    return [[c >> 3 for c in rgb] for rgb in pal]


# ---- follower sheet: palette indices + both palettes in 5-bit, for the ROM's own palette maths
ow = Image.open(EXP / 'eevee' / 'overworld.png')
assert ow.mode == 'P' and ow.size == (192, 32), (ow.mode, ow.size)
px = ow.load()
frames = [[px[f * 32 + x, y] for y in range(32) for x in range(32)] for f in range(6)]
(OUT / 'eevee_ow.json').write_text(json.dumps({
    'source': 'pokeemerald-expansion 1.17.2 graphics/pokemon/eevee/overworld.png + overworld_normal.pal/overworld_shiny.pal',
    'w': 32, 'h': 32, 'frames': frames,
    'palette': five(jasc(EXP / 'eevee' / 'overworld_normal.pal')),
    'shiny': five(jasc(EXP / 'eevee' / 'overworld_shiny.pal')),
}, separators=(',', ':')))

# ---- the ocean: one 16x16 metatile per animation frame, stacked (16 x 128)
gen = DECOMP / 'data' / 'tilesets' / 'primary' / 'general'
pal = [tuple(c) for c in jasc(gen / 'palettes' / '04.pal')]
meta = (gen / 'metatiles.bin').read_bytes()
entries = struct.unpack('<8H', meta[0x170 * 16:0x170 * 16 + 16])
water = Image.new('RGB', (16, 128))
for f in range(8):
    a = Image.open(gen / 'anim' / 'water' / f'{f}.png')
    ap = a.load()
    for q, e in enumerate(entries[:4]):
        t = (e & 0x3FF) - 432
        hf, vf = (e >> 10) & 1, (e >> 11) & 1
        for y in range(8):
            for x in range(8):
                sx, sy = (7 - x if hf else x), (7 - y if vf else y)
                water.putpixel(((q % 2) * 8 + x, f * 16 + (q // 2) * 8 + y), pal[ap[(t % 2) * 8 + sx, (t // 2) * 8 + sy]])
water.save(OUT / 'water.png')


def transparent(path, out):
    """An indexed sprite with index 0 transparent, as the GBA draws it."""
    im = Image.open(path)
    assert im.mode == 'P', (path, im.mode)
    rgba = im.convert('RGBA')
    p = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            if p[x, y] == 0:
                rgba.putpixel((x, y), (0, 0, 0, 0))
    rgba.save(out)


transparent(DECOMP / 'graphics' / 'pokemon_storage' / 'hand_cursor.png', OUT / 'hand_cursor.png')
transparent(DECOMP / 'graphics' / 'field_effects' / 'pics' / 'shadow_medium.png', OUT / 'shadow_medium.png')
# the standard window frame (options frame type 1), nine 8x8 tiles: corners, edges, white middle
transparent(DECOMP / 'graphics' / 'text_window' / '1.png', OUT / 'window_frame.png')

# The PC's hand as the page's own mouse cursor over game things, at 2x (CSS cursors draw 1 image
# pixel per CSS pixel): pointing (frame 0), open (frame 2, sAnim_Cursor_Open), fist (frame 3).
hand = Image.open(OUT / 'hand_cursor.png')
for f, name in [(0, 'point'), (2, 'open'), (3, 'fist')]:
    hand.crop((0, f * 32, 32, f * 32 + 32)).resize((64, 64), Image.NEAREST).save(OUT / f'cursor_{name}.png')
for k in range(4):
    Image.open(ANIM / 'assets' / 'egg' / f'shard_{k}.png').save(OUT / f'shard_{k}.png')

# ---- the hatch, frame by frame (egg_hatch.c), up to the start of the front animation
hatch = json.loads((ANIM / 'data' / 'egg_hatch_togepi.json').read_text())
cut = next(e['frame'] for e in hatch['events'] if e['event'].startswith('DoMonFrontSpriteAnimation'))
rows = []
for fr in hatch['frames'][:cut + 1]:
    rows.append([
        fr['egg']['x2'] if fr['egg']['visible'] else None,
        fr['egg']['crack'],
        fr['mon']['y'] if fr['mon']['visible'] else None,
        fr['mon']['scale'],
        1 if fr['fade']['color'] == 'white' else 0,
        fr['fade']['bg'],
        fr['fade']['obj'],
        [[s['x'], s['y'], s['born']] for s in fr['shards']],
    ])
(DATA / 'hatch.json').write_text(json.dumps({
    'source': 'research/pokemon-genetics/animation/data/egg_hatch_togepi.json (anim_sim.py port of src/egg_hatch.c)',
    'columns': ['eggX2|null', 'crack', 'monY|null', 'monScale|null', 'fadeWhite', 'fadeBg', 'fadeObj', 'shards[x,y,born]'],
    'egg': [120, 75], 'reveal': cut, 'frames': rows,
}, separators=(',', ':')))

# ---- Eevee's front animation: the two-frame image track and ANIM_V_STRETCH, per game frame
fa = json.loads((ANIM / 'data' / 'front_anims.json').read_text())
ev = fa['species']['eevee']
mo = fa['motions'][ev['anim']]
(DATA / 'eevee-front.json').write_text(json.dumps({
    'source': f"{ev['animSource']} {ev['anim']}, {ev['frameAnimSource']}; motion {mo['source']}",
    'image': ev['imageTrack'],
    'motion': [[m['y'], m['xRaw'], m['yRaw']] for m in mo['track']],
}, separators=(',', ':')))

print('wrote eevee_ow.json water.png hand_cursor.png shadow_medium.png shard_0..3.png, src/data/hatch.json eevee-front.json')
