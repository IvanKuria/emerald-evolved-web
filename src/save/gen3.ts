import * as L from './layout.js'
import { decodeText } from './text.js'
import { unpack, type Genome, type Packed } from './genome.js'

/* ------------------------------------------------------------------
   Read a Pokémon Emerald (expansion) save, in the browser, and pull
   out every Pokémon with its genome.

   The save is two slots of 14 sectors; each sector's footer says which
   piece it holds, a checksum and a save counter. The newer valid slot
   wins. Party Pokémon live in SaveBlock1, boxed ones in PokemonStorage;
   both are BoxPokemon, whose last 48 bytes are four substructs XORed
   with (personality ^ otId) and shuffled by personality % 24. The
   checksum over the decrypted words tells a real Pokémon from garbage.

   Nothing here touches the network.
------------------------------------------------------------------ */

export class SaveError extends Error {}

export interface FoundMon {
  where: string
  species: number
  personality: number
  otId: number
  nickname: string
  otName: string
  isEgg: boolean
  packed: Packed
  genome: Genome
  /** generations bred; 0 for a wild one, null if unknown (layout.ts GENERATION) */
  generation: number | null
}

export interface ParsedSave {
  trainer: string
  trainerId: number
  mons: FoundMon[]
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

function sectorChecksum(b: Uint8Array, o: number) {
  let sum = 0
  for (let i = 0; i < L.SECTOR_DATA; i += 4) sum = (sum + u32(b, o + i)) >>> 0
  return ((sum >>> 16) + (sum & 0xffff)) & 0xffff
}

/** The newest valid slot, as its pieces stitched back together. */
function readSlot(save: Uint8Array) {
  if (save.length < L.SECTOR * L.SECTORS_PER_SLOT * L.SLOTS) throw new SaveError('That file is too small to be a Pokémon Emerald save.')
  let best: { counter: number; byId: Map<number, number> } | null = null
  for (let slot = 0; slot < L.SLOTS; slot++) {
    const byId = new Map<number, number>()
    let counter = -1
    let ok = true
    for (let s = 0; s < L.SECTORS_PER_SLOT; s++) {
      const o = (slot * L.SECTORS_PER_SLOT + s) * L.SECTOR
      if (u32(save, o + L.FOOTER.signature) !== L.SIGNATURE) { ok = false; break }
      const id = u16(save, o + L.FOOTER.id)
      if (id >= L.SECTORS_PER_SLOT || sectorChecksum(save, o) !== u16(save, o + L.FOOTER.checksum)) { ok = false; break }
      byId.set(id, o)
      counter = u32(save, o + L.FOOTER.counter)
    }
    if (ok && byId.size === L.SECTORS_PER_SLOT && (!best || counter > best.counter)) best = { counter, byId }
  }
  if (!best) throw new SaveError('This doesn’t look like a saved game. Save in the game first, then try again.')
  const join = (from: number, to: number) => {
    const out = new Uint8Array((to - from + 1) * L.SECTOR_DATA)
    for (let id = from; id <= to; id++) {
      const o = best!.byId.get(id)!
      out.set(save.subarray(o, o + L.SECTOR_DATA), (id - from) * L.SECTOR_DATA)
    }
    return out
  }
  return { sb2: join(L.SB2, L.SB2), sb1: join(L.SB1[0], L.SB1[1]), storage: join(L.STORAGE[0], L.STORAGE[1]) }
}

function readField(subs: Uint8Array[], fl: L.Field) {
  const s = subs[fl.sub]
  const word = fl.size === 1 ? s[fl.byte] : fl.size === 2 ? u16(s, fl.byte) : u32(s, fl.byte)
  return (word >>> fl.shift) & (fl.bits === 32 ? 0xffffffff : (1 << fl.bits) - 1)
}

/** One BoxPokemon (80 bytes) -> its data, or null for an empty slot or a bad egg. */
export function readBoxMon(raw: Uint8Array, where: string): FoundMon | null {
  const personality = u32(raw, L.BOX.personality)
  const otId = u32(raw, L.BOX.otId)
  const flags = raw[L.BOX.flags19]
  if ((personality === 0 && otId === 0) || !(flags & 2) || flags & 1) return null
  const key = (personality ^ otId) >>> 0
  const dec = new Uint8Array(48)
  let sum = 0
  for (let i = 0; i < 48; i += 4) {
    const w = (u32(raw, L.BOX.secure + i) ^ key) >>> 0
    dec[i] = w & 255
    dec[i + 1] = (w >>> 8) & 255
    dec[i + 2] = (w >>> 16) & 255
    dec[i + 3] = w >>> 24
    sum = (sum + (w & 0xffff) + (w >>> 16)) & 0xffff
  }
  if (sum !== u16(raw, L.BOX.checksum)) return null
  const order = personality % 24
  const subs = [0, 1, 2, 3].map((t) => {
    const slot = L.SUBSTRUCT_SLOT[t][order]
    return dec.subarray(slot * 12, slot * 12 + 12)
  })
  const header = { unused13: (flags >> 7) & 1, blockBoxRS: (flags >> 3) & 1, unused1E: (u16(raw, L.BOX.word1e) >> 15) & 1 }

  const packed: Packed = [0, 0, 0]
  let pos = 0
  for (const [src, n] of L.GENOME_SOURCES) {
    const v = src in header ? header[src as keyof typeof header] : readField(subs, L.SUB[src as keyof typeof L.SUB])
    for (let i = 0; i < n; i++, pos++) if ((v >>> i) & 1) packed[pos >> 5] = (packed[pos >> 5] | (1 << (pos & 31))) >>> 0
  }

  const gen = readField(subs, L.SUB[L.GENERATION.lo]) | (readField(subs, L.SUB[L.GENERATION.hi]) << 8)
  return {
    where,
    species: readField(subs, L.SUB.species),
    personality,
    otId,
    nickname: decodeText(raw.subarray(L.BOX.nickname, L.BOX.nickname + 10)),
    otName: decodeText(raw.subarray(L.BOX.otName, L.BOX.otName + 7)),
    isEgg: (flags & 4) !== 0,
    packed,
    genome: unpack(packed),
    generation: gen >= L.GENERATION.unset ? null : gen,
  }
}

export function parseSave(save: Uint8Array): ParsedSave {
  const { sb2, sb1, storage } = readSlot(save)
  const mons: FoundMon[] = []
  const count = Math.min(L.PARTY_SIZE, sb1[L.SB1_PARTY_COUNT])
  for (let i = 0; i < count; i++) {
    const o = L.SB1_PARTY + i * L.POKEMON_SIZE
    const m = readBoxMon(sb1.subarray(o, o + L.BOX_MON_SIZE), `Party, slot ${i + 1}`)
    if (m) mons.push(m)
  }
  for (let i = 0; i < 2; i++) {
    const o = L.SB1_DAYCARE + i * L.DAYCARE_MON_SIZE
    const m = readBoxMon(sb1.subarray(o, o + L.BOX_MON_SIZE), `Day Care, ${i === 0 ? 'first' : 'second'} Pokémon`)
    if (m) mons.push(m)
  }
  for (let b = 0; b < L.BOXES; b++)
    for (let i = 0; i < L.IN_BOX; i++) {
      const o = L.STORAGE_BOXES + (b * L.IN_BOX + i) * L.BOX_MON_SIZE
      const m = readBoxMon(storage.subarray(o, o + L.BOX_MON_SIZE), `Box ${b + 1}, slot ${i + 1}`)
      if (m) mons.push(m)
    }
  return { trainer: decodeText(sb2.subarray(L.SB2_PLAYER_NAME, L.SB2_PLAYER_NAME + 8)), trainerId: u32(sb2, L.SB2_TRAINER_ID) & 0xffff, mons }
}
