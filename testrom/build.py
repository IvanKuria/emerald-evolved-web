"""Build evotest.gba and its mutated twin evotest-mutant.gba, then a .bps between them.
usage: python3 build.py  (needs arm-none-eabi-gcc on PATH)"""
import subprocess, sys
from pathlib import Path
H = Path(__file__).parent
def run(*a): subprocess.run(a, check=True, cwd=H)
run('arm-none-eabi-gcc', '-mcpu=arm7tdmi', '-mthumb', '-mthumb-interwork', '-O2', '-ffreestanding', '-nostdlib',
    '-nostartfiles', '-T', 'gba.ld', '-Wl,--no-warn-rwx-segments', 'crt0.s', 'main.c', '-o', 'evotest.elf', '-lgcc')
run('arm-none-eabi-objcopy', '-O', 'binary', 'evotest.elf', 'evotest.bin')
rom = bytearray((H / 'evotest.bin').read_bytes())
rom += bytes((-len(rom)) % 1024)            # pad to a 1 KB boundary
def fix(r):
    r[0xBD] = (-(sum(r[0xA0:0xBD]) + 0x19)) & 0xFF
    return r
fix(rom)
(H / 'evotest.gba').write_bytes(rom)
i = rom.index(b'EVOGENE!')
mut = bytearray(rom)
mut[i + 8:i + 10] = (31 | (12 << 5) | (6 << 10)).to_bytes(2, 'little')   # a warm orange
mut[i + 10:i + 12] = (40).to_bytes(2, 'little')                         # and bigger
mut[0xA0:0xAC] = b'EVOTEST MUT '
fix(mut)
(H / 'evotest-mutant.gba').write_bytes(mut)
print('rom', len(rom), 'bytes; gene at', hex(i))
