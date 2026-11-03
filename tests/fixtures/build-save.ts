/* A synthetic Emerald Evolved save, built from the layout module, for the parser's tests and for the
   screenshot run. Two slots (the newer one holds the real data), rotated sector order, real footers,
   checksums and box-Pokémon encryption. Nothing here comes from a real game. */
import * as L from '../../src/save/layout'
import { encodeText } from '../../src/save/text'
import { bits, pack, type Genome, type Packed } from '../../src/save/genome'

export interface MonSpec {
  species: number
  personality: number
  otId: number
  nickname: string
  genome: Genome | null
  generation?: number
}

const w16 = (b: Uint8Array, o: number, v: number) => ((b[o] = v & 255), (b[o + 1] = (v >>> 8) & 255))
const w32 = (b: Uint8Array, o: number, v: number) => {
  for (let i = 0; i < 4; i++) b[o + i] = (v >>> (i * 8)) & 255
}
const r32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

function writeField(subs: Uint8Array[], f: L.Field, v: number) {
  const s = subs[f.sub]
  const get = () => (f.size === 1 ? s[f.byte] : f.size === 2 ? s[f.byte] | (s[f.byte + 1] << 8) : r32(s, f.byte))
  const mask = (f.bits === 32 ? 0xffffffff : ((1 << f.bits) - 1)) << f.shift
  const word = ((get() & ~mask) | ((v << f.shift) & mask)) >>> 0
  if (f.size === 1) s[f.byte] = word & 255
  else if (f.size === 2) w16(s, f.byte, word)
  else w32(s, f.byte, word)
}

export function boxMon(m: MonSpec, trainer: string): Uint8Array {
  const b = new Uint8Array(80)
  w32(b, L.BOX.personality, m.personality)
  w32(b, L.BOX.otId, m.otId)
  b.set(encodeText(m.nickname, 10), L.BOX.nickname)
  b.set(encodeText(trainer, 7), L.BOX.otName)
  const subs = [0, 1, 2, 3].map(() => new Uint8Array(12))
  writeField(subs, L.SUB.species, m.species)
  const gen = m.generation ?? 0xffff
  writeField(subs, L.SUB.nickname11, gen & 255)
  writeField(subs, L.SUB.nickname12, gen >>> 8)
  let flags = 2 // hasSpecies
  let w1e = 0
  if (m.genome) {
    const p: Packed = pack(m.genome)
    let pos = 0
    for (const [src, n] of L.GENOME_SOURCES) {
      const v = bits(p, pos, n)
      pos += n
      if (src === 'unused13') flags |= v << 7
      else if (src === 'blockBoxRS') flags |= v << 3
      else if (src === 'unused1E') w1e |= v << 15
      else writeField(subs, L.SUB[src], v)
    }
  }
  b[L.BOX.flags19] = flags
  w16(b, L.BOX.word1e, w1e)
  // place substructs, checksum the plain words, then encrypt
  const order = m.personality % 24
  const plain = new Uint8Array(48)
  for (let t = 0; t < 4; t++) plain.set(subs[t], L.SUBSTRUCT_SLOT[t][order] * 12)
  let sum = 0
  for (let i = 0; i < 48; i += 2) sum = (sum + (plain[i] | (plain[i + 1] << 8))) & 0xffff
  w16(b, L.BOX.checksum, sum)
  const key = (m.personality ^ m.otId) >>> 0
  for (let i = 0; i < 48; i += 4) w32(b, L.BOX.secure + i, (r32(plain, i) ^ key) >>> 0)
  return b
}

export function buildSave(opts: { trainer: string; trainerId: number; party: MonSpec[]; boxed: MonSpec[] }): Uint8Array {
  const sb2 = new Uint8Array(L.SECTOR_DATA)
  sb2.set(encodeText(opts.trainer, 8), L.SB2_PLAYER_NAME)
  w32(sb2, L.SB2_TRAINER_ID, opts.trainerId)
  const sb1 = new Uint8Array(L.SECTOR_DATA * 4)
  sb1[L.SB1_PARTY_COUNT] = opts.party.length
  opts.party.forEach((m, i) => sb1.set(boxMon(m, opts.trainer), L.SB1_PARTY + i * L.POKEMON_SIZE))
  const storage = new Uint8Array(L.SECTOR_DATA * 9)
  opts.boxed.forEach((m, i) => storage.set(boxMon(m, opts.trainer), L.STORAGE_BOXES + i * L.BOX_MON_SIZE))
  const chunks: Uint8Array[] = [sb2, ...[0, 1, 2, 3].map((i) => sb1.subarray(i * L.SECTOR_DATA, (i + 1) * L.SECTOR_DATA)), ...[...Array(9).keys()].map((i) => storage.subarray(i * L.SECTOR_DATA, (i + 1) * L.SECTOR_DATA))]

  const save = new Uint8Array(0x20000).fill(0xff)
  const writeSlot = (slot: number, counter: number, rotate: number, data: Uint8Array[]) => {
    for (let id = 0; id < L.SECTORS_PER_SLOT; id++) {
      const o = (slot * L.SECTORS_PER_SLOT + ((id + rotate) % L.SECTORS_PER_SLOT)) * L.SECTOR
      save.fill(0, o, o + L.SECTOR)
      save.set(data[id], o)
      let s = 0
      for (let i = 0; i < L.SECTOR_DATA; i += 4) s = (s + r32(save, o + i)) >>> 0
      w16(save, o + L.FOOTER.id, id)
      w16(save, o + L.FOOTER.checksum, ((s >>> 16) + (s & 0xffff)) & 0xffff)
      w32(save, o + L.FOOTER.signature, L.SIGNATURE)
      w32(save, o + L.FOOTER.counter, counter)
    }
  }
  // slot 0: an older save with nothing in it; slot 1: the newer one, sectors rotated as the game does
  writeSlot(0, 6, 0, chunks.map((c) => new Uint8Array(c.length)))
  writeSlot(1, 7, 5, chunks)
  return save
}

/* Genomes for the fixtures. spec: A1-A4 then B1-B4. */
export const WILD: Genome = { shiny: 0, coat: [0, 0, 0], hue: [0, 0], spec: [0, 0, 0, 0, 0, 0, 0, 0], has: true }
export const NEW_SPECIES: Genome = { shiny: 0, coat: [0, 0, 0], hue: [3, 2], spec: [3, 3, 3, 1, 3, 3, 3, 0], has: true }
export const ALMOST: Genome = { shiny: 0, coat: [0, 0, 0], hue: [1, 0], spec: [3, 3, 1, 0, 3, 3, 1, 0], has: true }
