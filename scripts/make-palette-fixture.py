"""Builds tests/fixtures/palette-expected.json from the ROM's own palette code.

Extracts ApplyGenesTo16Weighted (and everything it uses) from port/src/genetics_palette.c into a small C
harness with the real species palettes, so the TypeScript port (src/registry/palette.ts) is checked against
the C itself rather than against another port. Compile and run the harness with any C compiler:

    python3 scripts/make-palette-fixture.py <genetics_palette.c> harness.c
    gcc -O1 -o harness harness.c && ./harness > tests/fixtures/palette-expected.json
"""
import json, sys

src = open(sys.argv[1]).read().split('\n')
start = next(i for i, l in enumerate(src) if l.startswith('#define OUTLINE_Y'))
end = next(i for i, l in enumerate(src) if 'pal[i] = RGB(To5(out[0])' in l)
body = '\n'.join(src[start:end + 3])
sp = {s['id']: s for s in json.load(open('public/game/species.json'))}
cases = [(0, 240), (0, -384), (0, 96), (1, 0), (1, 240), (2, 0), (2, 384), (3, 0), (3, 240)]
species = [133, 25, 129, 320]
pals = ','.join('{%s}' % ','.join(str(c[0] | (c[1] << 5) | (c[2] << 10)) for c in sp[i]['pal']) for i in species)
head = r'''#include <stdio.h>
#include <string.h>
typedef unsigned short u16; typedef int s32; typedef unsigned char u8;
#define GET_R(c) ((c) & 31)
#define GET_G(c) (((c) >> 5) & 31)
#define GET_B(c) (((c) >> 10) & 31)
#define RGB(r,g,b) ((r) | ((g) << 5) | ((b) << 10))
enum { COAT_NORMAL, COAT_ALBINO, COAT_RED, COAT_BLACK };
void ApplyGenesTo16Weighted(u16 *pal, u8 coat, s32 hueShift, const u16 *weights);
'''
tables = 'static const u16 PALS[][16] = {%s};\nstatic const int SP[] = {%s};\nstatic const int CASES[][2] = {%s};\n' % (
    pals, ','.join(map(str, species)), ','.join('{%d,%d}' % c for c in cases))
main = r'''int main(void) {
  int ns = sizeof(SP) / sizeof(SP[0]), nc = sizeof(CASES) / sizeof(CASES[0]);
  printf("{");
  for (int s = 0; s < ns; s++) for (int k = 0; k < nc; k++) {
    u16 p[16]; memcpy(p, PALS[s], sizeof p);
    ApplyGenesTo16Weighted(p, CASES[k][0], CASES[k][1], 0);
    printf("%s\"%d:%d:%d\":[", (s || k) ? "," : "", SP[s], CASES[k][0], CASES[k][1]);
    for (int i = 0; i < 16; i++) printf("%s[%d,%d,%d]", i ? "," : "", p[i] & 31, (p[i] >> 5) & 31, (p[i] >> 10) & 31);
    printf("]");
  }
  printf("}\n");
  return 0;
}
'''
open(sys.argv[2], 'w').write(head + body + '\n' + tables + main)
