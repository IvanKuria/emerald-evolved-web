import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseSave, SaveError } from '../src/save/gen3'
import { isNewSpecies, pack, scoreVsWild, sizeOf, unpack, hueShift } from '../src/save/genome'
import { applyGenes, type Rgb5 } from '../src/registry/palette'
import { buildCard, toHex } from '../src/registry/card'
import { checkName } from '../src/registry/names'
import { buildSave, NEW_SPECIES, WILD, ALMOST } from './fixtures/build-save'

const save = buildSave({
  trainer: 'MAY',
  trainerId: 0x1a2b3c4d,
  party: [
    { species: 133, personality: 0x12345678, otId: 0x1a2b3c4d, nickname: 'EEVEE', genome: WILD },
    { species: 129, personality: 0x0badf00d, otId: 0x1a2b3c4d, nickname: 'GOLDY', genome: NEW_SPECIES, generation: 23 },
  ],
  boxed: [
    { species: 320, personality: 0xdeadbeef, otId: 0x1a2b3c4d, nickname: 'WAILMER', genome: ALMOST },
    { species: 25, personality: 7, otId: 99, nickname: 'OLD', genome: null },
  ],
})

describe('Gen 3 save', () => {
  const parsed = parseSave(save)

  it('reads the trainer from the newer slot', () => {
    expect(parsed.trainer).toBe('MAY')
    expect(parsed.trainerId).toBe(0x3c4d)
  })

  it('finds party and boxed Pokémon through every substruct order', () => {
    expect(parsed.mons.map((m) => [m.species, m.nickname, m.where])).toEqual([
      [133, 'EEVEE', 'Party, slot 1'],
      [129, 'GOLDY', 'Party, slot 2'],
      [320, 'WAILMER', 'Box 1, slot 1'],
      [25, 'OLD', 'Box 1, slot 2'],
    ])
  })

  it('reads the genome back bit for bit', () => {
    expect(parsed.mons[1].genome).toEqual(NEW_SPECIES)
    expect(parsed.mons[2].genome).toEqual(ALMOST)
    expect(parsed.mons[3].genome.has).toBe(false)
  })

  it('reads the generation only when it was written', () => {
    expect(parsed.mons[1].generation).toBe(23)
    expect(parsed.mons[0].generation).toBeNull()
  })

  it('detects the line that split off and only that one', () => {
    expect(parsed.mons.map((m) => isNewSpecies(m.genome))).toEqual([false, true, false, false])
    expect(scoreVsWild(ALMOST).score).toBe(20)
    expect(scoreVsWild(WILD).score).toBe(70)
  })

  it('rejects damaged files with a reason', () => {
    expect(() => parseSave(new Uint8Array(1000))).toThrow(SaveError)
    const bad = save.slice()
    for (let s = 0; s < 28; s++) bad[s * 0x1000 + 10] ^= 0xff // break every sector's checksum
    expect(() => parseSave(bad)).toThrow(/saved game/)
  })

  it('a Pokémon with a broken checksum is skipped, not misread', () => {
    const bad = save.slice()
    // the newer slot is rotated by 5: SaveBlock1 (id 1) is physical sector 14 + 6
    const sb1 = (14 + 6) * 0x1000
    bad[sb1 + 0x238 + 0x20] ^= 1
    // re-sign that sector so only the Pokémon is damaged
    let s = 0
    for (let i = 0; i < 3968; i += 4) s = (s + (bad[sb1 + i] | (bad[sb1 + i + 1] << 8) | (bad[sb1 + i + 2] << 16) | (bad[sb1 + i + 3] << 24))) >>> 0
    const c = ((s >>> 16) + (s & 0xffff)) & 0xffff
    bad[sb1 + 0xff6] = c & 255
    bad[sb1 + 0xff7] = c >> 8
    expect(parseSave(bad).mons.map((m) => m.species)).toEqual([129, 320, 25])
  })
})

describe('the ROM’s own test saves (BUILD_STATUS.md, web/genome_decode.py)', () => {
  const read = (f: string) => parseSave(new Uint8Array(readFileSync(`tests/fixtures/${f}`)))

  it('01: a wild pair, no new species', () => {
    const s = read('01_wild_pair.sav')
    expect(s.trainer).toBe('EVO')
    const eevee = s.mons.filter((m) => m.species === 133)
    expect(eevee.length).toBe(2)
    expect(eevee.map((m) => m.generation)).toEqual([0, 0])
    expect(eevee.map((m) => sizeOf(m.genome, m.personality))).toEqual([4, 7])
    expect(s.mons.some((m) => isNewSpecies(m.genome))).toBe(false)
  })

  it('02: the line at generation 10, still one species', () => {
    const s = read('02_gen10_pair.sav')
    const line = s.mons.filter((m) => m.generation === 10)
    expect(line.length).toBe(2)
    expect(line.map((m) => sizeOf(m.genome, m.personality))).toEqual([21, 26])
    expect(line.map((m) => hueShift(m.genome))).toEqual([-48, -48])
    expect(s.mons.some((m) => isNewSpecies(m.genome))).toBe(false)
  })

  it('03: the generation-24 line is a new species, the wild Eevee is not', () => {
    const s = read('03_new_species_plus_wild.sav')
    const party = s.mons.filter((m) => m.where.startsWith('Party'))
    expect(party.map((m) => [m.species, m.generation, sizeOf(m.genome, m.personality), isNewSpecies(m.genome)])).toEqual([
      [133, 24, 54, true],
      [133, 24, 62, true],
      [133, 0, 7, false],
    ])
    expect(party.map((m) => m.genome.spec.slice(4).join(''))).toEqual(['3303', '3323', '0000'])
    expect(party.map((m) => m.genome.spec.slice(0, 4).join(''))).toEqual(['0333', '2333', '0000'])
    expect(hueShift(party[0].genome)).toBe(96) // +22.5 degrees
    const card = buildCard({ species: 133, genome: toHex(party[0].packed), personality: party[0].personality, generation: 24, trainer: s.trainer, name: 'Mossling' })
    expect(card.ok).toBe(true)
  })
})

describe('the rebuilt ROM’s Eevee line, milestone by milestone (saves/eevee_line, capture_run.json)', () => {
  const read = (f: string) => parseSave(new Uint8Array(readFileSync(`tests/fixtures/eevee_line/${f}`)))
  const line = (f: string) => read(f).mons.filter((m) => m.where.startsWith('Party') && !m.isEgg && (m.generation ?? 0) > 0)
  const cases: [string, number, number][] = [
    ['01_gen1.sav', 1, 70],
    ['02_first_get_along.sav', 17, 50],
    ['03_first_dont_like.sav', 30, 20],
    ['05_final_species.sav', 36, 0],
  ]
  for (const [file, gen, score] of cases)
    it(`${file}: the Day Care says ${score} against a wild Eevee`, () => {
      const mons = line(file)
      expect(Math.max(...mons.map((m) => m.generation ?? 0))).toBe(gen)
      // the milestone is reached when the first of the pair gets there
      expect(Math.min(...mons.map((m) => scoreVsWild(m.genome).score))).toBe(score)
    })

  it('only the final save holds a new species, and only the line in it', () => {
    for (const f of ['01_gen1.sav', '02_first_get_along.sav', '03_first_dont_like.sav', '04_first_failed_egg.sav'])
      expect(read(f).mons.some((m) => !m.isEgg && isNewSpecies(m.genome))).toBe(false)
    const final = read('05_final_species.sav').mons
    expect(final.map((m) => [m.generation, isNewSpecies(m.genome)])).toEqual([
      [36, true],
      [36, true],
      [0, false],
      [0, false],
    ])
    const m = final[0]
    const card = buildCard({ species: m.species, genome: toHex(m.packed), personality: m.personality, generation: m.generation, trainer: 'EVO', name: 'Tallgrass' })
    expect(card.ok && card.card).toMatchObject({ species: 133, generation: 36, size: 53, d: 3 })
  })
})

describe('genome', () => {
  it('pack and unpack are inverse', () => expect(unpack(pack(NEW_SPECIES))).toEqual(NEW_SPECIES))
  it('size follows sim/SPECIATION.md', () => expect(sizeOf(NEW_SPECIES, 0x0badf00d)).toBe(4 * 13 + 5))
  it('hue is the sum of both alleles in 48-unit steps', () => expect(hueShift(NEW_SPECIES)).toBe(240))
})

describe('palette genes match the ROM (port/src/genetics_palette.c, compiled)', () => {
  const table = new Map((JSON.parse(readFileSync('public/game/species.json', 'utf8')) as { id: number; pal: Rgb5[] }[]).map((s) => [s.id, s.pal]))
  const expected = JSON.parse(readFileSync('tests/fixtures/palette-expected.json', 'utf8')) as Record<string, Rgb5[]>
  for (const [key, pal] of Object.entries(expected)) {
    const [species, coat, shift] = key.split(':').map(Number)
    it(`species ${species}, coat ${coat}, shift ${shift}`, () => expect(applyGenes(table.get(species)!, coat, shift)).toEqual(pal))
  }
})

describe('cards', () => {
  const mon = parseSave(save).mons[1]
  const sub = { species: mon.species, genome: toHex(mon.packed), personality: mon.personality, generation: 23, trainer: 'MAY', name: 'Goldfin' }

  it('builds a card from the genes alone', () => {
    const r = buildCard(sub)
    expect(r.ok && r.card).toMatchObject({ species: 129, size: 57, hue: 240, d: 3, generation: 23, name: 'Goldfin' })
  })
  it('refuses a line that can still breed with wild ones', () => {
    const almost = parseSave(save).mons[2]
    expect(buildCard({ ...sub, genome: toHex(almost.packed) }).ok).toBe(false)
  })
  it('refuses bad names', () => {
    expect(checkName('F.u.c.k', 12, 'a name').ok).toBe(false)
    expect(checkName('Sh1tfish', 12, 'a name').ok).toBe(false)
    expect(checkName('Cockatoo', 12, 'a name').ok).toBe(true)
    expect(checkName('Far too long a name', 12, 'a name').ok).toBe(false)
    expect(checkName('<script>', 12, 'a name').ok).toBe(false)
  })
})
