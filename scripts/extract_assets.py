"""Copy the real game assets this site uses into public/game/.

Every pixel comes from pret's pokeemerald decomp (graphics/...) or from the film's own extraction of it
(deathnote-lifespan/video/public/mc-chem-v2/poke, see PROVENANCE.md there). Nothing is redrawn.
Sprites that the site recolours at runtime are written as palette-index maps plus their 16-colour
palette, because that is how the GBA stores them and how a palette swap actually works.

usage: python3 scripts/extract_assets.py
"""
import json, shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'game'
DECOMP = Path('/Users/ivankuria/deathnote-lifespan/research/pokemon-genetics/pokeemerald')
FILM = Path('/Users/ivankuria/deathnote-lifespan/video/public/mc-chem-v2')
OUT.mkdir(parents=True, exist_ok=True)


def jasc(path):
    lines = path.read_text().split()
    n = int(lines[2])
    return [[int(lines[3 + i * 3 + k]) for k in range(3)] for i in range(n)]


def indexed_sprite(species):
    d = DECOMP / 'graphics' / 'pokemon' / species
    im = Image.open(d / 'anim_front.png')
    assert im.mode == 'P', im.mode
    w, h = im.size
    px = list(im.getdata())
    frames = [px[i * w * w:(i + 1) * w * w] for i in range(h // w)]
    return {'source': f'pokeemerald graphics/pokemon/{species}/anim_front.png + normal.pal/shiny.pal',
            'w': w, 'h': w, 'frames': frames,
            'palette': jasc(d / 'normal.pal'), 'shiny': jasc(d / 'shiny.pal')}


for sp in ['eevee']:
    (OUT / f'{sp}.json').write_text(json.dumps(indexed_sprite(sp), separators=(',', ':')))

copies = {
    'poke/text/dialogue_box.png': 'dialogue_box.png',
    'poke/text/window_frame_1.png': 'window_frame.png',
    'poke/text/font_normal_message.png': 'font_message.png',
    'poke/text/down_arrow_sheet.png': 'down_arrow.png',
    'poke/egg/egg_front_sheet.png': 'egg.png',
    'poke/egg/hatch_0_normal.png': 'hatch_0.png',
    'poke/egg/hatch_1_cracked1.png': 'hatch_1.png',
    'poke/egg/hatch_2_cracked2.png': 'hatch_2.png',
    'poke/ui/ball_poke_0_closed.png': 'ball.png',
    'poke/ui/hpbar_label_HP.png': 'hp_label.png',
    'poke/ui/glyph_normal_No_summary.png': 'glyph_No.png',
    'poke/cry/eevee.wav': 'eevee_cry.wav',
    'g2.png': 'grain.png',
}
for k in range(9):
    copies[f'poke/ui/hpbar_green_{k}.png'] = f'hp_{k}.png'
for src, dst in copies.items():
    shutil.copyfile(FILM / src, OUT / dst)

font = json.loads((FILM / 'poke/text/font_normal.json').read_text())
(OUT / 'font.json').write_text(json.dumps({'cell': font['cell'], 'widths': font['widths'],
                                           'charmap': font['charmap']}, ensure_ascii=False, separators=(',', ':')))
print('wrote', sorted(p.name for p in OUT.iterdir()))

# The page grain: a 300px tile of the thumbnails' own grain plate (g2.png), greyscale, so it can repeat.
g = Image.open(OUT / 'grain.png').convert('L')
g.crop((0, 0, 300, 300)).save(OUT / 'grain.png', optimize=True)
