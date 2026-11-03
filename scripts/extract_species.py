"""Front sprites and palettes for species 1-386 (everything a player can breed in Emerald), from the
pokeemerald-expansion tree the hack is built on. Used by the species card.

Each sprite is written as a 64x64 greyscale PNG whose value is the palette index times 17, so the browser
gets the GBA's palette indices back exactly (round(v / 17)) and recolours by swapping palette entries, the
way the cartridge does. Palettes are kept as the game's 5-bit BGR555 channels.

The sprite set is the one the ROM draws: P_GBA_STYLE_SPECIES_GFX is FALSE in include/config/pokemon.h,
so anim_front.png / normal.pal / shiny.pal, frame 0 (the top 64 rows).

usage (in the WSL build box): python3 extract_species.py <expansion tree> <out dir>
"""
import json, re, sys
from pathlib import Path
from PIL import Image

T, OUT = Path(sys.argv[1]), Path(sys.argv[2])
(OUT / 'species').mkdir(parents=True, exist_ok=True)

enum = (T / 'include/constants/species.h').read_text()
ids = {m.group(1): int(m.group(2)) for m in re.finditer(r'^\s*(SPECIES_\w+)\s*=\s*(\d+),', enum, re.M)}
by_id = {v: k for k, v in ids.items() if 1 <= v <= 386}
assert len(by_id) == 386, len(by_id)

info = ''.join(p.read_text() for p in sorted((T / 'src/data/pokemon/species_info').glob('gen_[123]_families.h')))
gfx = (T / 'src/data/graphics/pokemon.h').read_text()
# the non-GBA-style branch of each #if !P_GBA_STYLE_SPECIES_GFX comes first, so the first definition wins
paths = {}
for sym, path in re.findall(r'const u\d+ (gMon\w+)\[\] = INCGFX_U\d+\("([^"]+)"', gfx):
    paths.setdefault(sym, path)

def block(const):
    m = re.search(r'\[' + const + r'\]\s*=\s*\{(.*?)\n    \},', info, re.S)
    assert m, const
    return m.group(1)

def pal(path):
    w = (T / path).read_text().split()
    return [[int(w[3 + i * 3 + k]) >> 3 for k in range(3)] for i in range(16)]

table = []
for sid in range(1, 387):
    const = by_id[sid]
    if const == 'SPECIES_UNOWN':   # defined through a macro, one entry per letter; the card uses A
        b = '.speciesName = _("Unown") .frontPic = gMonFrontPic_UnownA .palette = gMonPalette_Unown .shinyPalette = gMonShinyPalette_Unown'
    else:
        b = block(const)
    name = re.search(r'\.speciesName = _\("([^"]+)"\)', b).group(1)
    front = paths[re.search(r'\.frontPic = (gMon\w+)', b).group(1)]
    normal = paths[re.search(r'\.palette = (gMon\w+)', b).group(1)]
    shiny = paths[re.search(r'\.shinyPalette = (gMon\w+)', b).group(1)]
    im = Image.open(T / front)
    assert im.mode == 'P', (const, im.mode)
    idx = im.crop((0, 0, 64, 64))
    Image.frombytes('L', (64, 64), bytes(min(15, v) * 17 for v in idx.getdata())).save(OUT / 'species' / f'{sid}.png', optimize=True)
    table.append({'id': sid, 'name': name, 'pal': pal(normal), 'shiny': pal(shiny)})

(OUT / 'species.json').write_text(json.dumps(table, separators=(',', ':')))
print('wrote', len(table), 'species')
