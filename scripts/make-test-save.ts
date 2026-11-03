// Writes a synthetic Emerald Evolved save (tests/fixtures/build-save.ts) for the screenshot run:
// four lines that have split off and one that hasn't. Not a real game's save; never shipped.
//   npx tsx scripts/make-test-save.ts <out.sav>
import { writeFileSync } from 'node:fs'
import { buildSave, ALMOST, NEW_SPECIES } from '../tests/fixtures/build-save'
import type { Genome } from '../src/save/genome'

const g = (hue: [number, number], coat: [number, number, number] = [0, 0, 0], shiny = 0): Genome => ({ ...NEW_SPECIES, hue, coat, shiny })
const out = process.argv[2] ?? 'shots/test-save.sav'
writeFileSync(
  out,
  buildSave({
    trainer: 'MAY',
    trainerId: 0x00012345,
    party: [
      { species: 133, personality: 0x0000a5a1, otId: 0x00012345, nickname: 'EEVEE', genome: g([4, 3]), generation: 23 },
      { species: 320, personality: 0x0000b6b2, otId: 0x00012345, nickname: 'WAILMER', genome: g([-3, -4]), generation: 31 },
      { species: 129, personality: 0x0000c7c3, otId: 0x00012345, nickname: 'MAGIKARP', genome: g([0, 0], [0, 0, 3]), generation: 19 },
      { species: 263, personality: 0x0000d8d4, otId: 0x00012345, nickname: 'ZIGZAGOON', genome: g([7, 6]) },
      { species: 172, personality: 0x0000e9e5, otId: 0x00012345, nickname: 'PICHU', genome: ALMOST },
    ],
    boxed: [],
  }),
)
console.log('wrote', out)
