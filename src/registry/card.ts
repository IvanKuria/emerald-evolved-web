import { coatOf, hueShift, isShiny, scoreVsWild, sizeOf, unpack, type Packed } from '../save/genome.js'
import { checkName, SPECIES_NAME_MAX, TRAINER_NAME_MAX } from './names.js'

/* ------------------------------------------------------------------
   A species card, and how one is made from a submission.

   The browser sends only what the card needs: the species number, the
   77 genome bits, the personality (its low 3 bits are part of size),
   the generation if the ROM recorded one, the trainer's name and the
   name the player chose. Never the save.

   The server runs exactly this function on what it receives and stores
   its result, not the browser's. So a card's colours, size and "new
   species" status are always recomputed from the genes: a forged
   request can lie about a name, but it cannot claim a split the genes
   don't show.
------------------------------------------------------------------ */

export const MAX_SPECIES = 386

export interface Submission {
  species: number
  /** three 32-bit words, hex, little-endian order */
  genome: [string, string, string]
  personality: number
  generation: number | null
  trainer: string
  name: string
}

export interface Card {
  id: string
  /** order of registration, 1 = the first species ever made */
  no: number
  species: number
  name: string
  trainer: string
  generation: number | null
  coat: number
  hue: number
  shiny: boolean
  size: number
  /** completed incompatibilities against the wild type (3+ = new species) */
  d: number
  createdAt: number
}

export type Built = { ok: true; card: Omit<Card, 'id' | 'no' | 'createdAt'> } | { ok: false; error: string }

const word = (h: unknown) => (typeof h === 'string' && /^[0-9a-f]{1,8}$/i.test(h) ? parseInt(h, 16) >>> 0 : NaN)

export function buildCard(sub: Partial<Submission>): Built {
  const species = Number(sub.species)
  if (!Number.isInteger(species) || species < 1 || species > MAX_SPECIES) return { ok: false, error: 'Unknown species.' }
  if (!Array.isArray(sub.genome) || sub.genome.length !== 3) return { ok: false, error: 'Missing genome.' }
  const packed = sub.genome.map(word) as Packed
  if (packed.some(Number.isNaN)) return { ok: false, error: 'Malformed genome.' }
  const personality = Number(sub.personality)
  if (!Number.isInteger(personality) || personality < 0 || personality > 0xffffffff) return { ok: false, error: 'Malformed personality.' }
  const generation = sub.generation == null ? null : Number(sub.generation)
  if (generation !== null && (!Number.isInteger(generation) || generation < 0 || generation > 0xfeff)) return { ok: false, error: 'Malformed generation.' }

  const g = unpack(packed)
  const { d, score } = scoreVsWild(g)
  if (!g.has) return { ok: false, error: 'That Pokémon has no Emerald Evolved genes.' }
  if (score !== 0) return { ok: false, error: 'That line can still breed with wild ones, so it isn’t a new species yet.' }

  const name = checkName(sub.name, SPECIES_NAME_MAX, 'a name')
  if (!name.ok) return name
  const trainer = checkName(sub.trainer, TRAINER_NAME_MAX, 'a trainer name')
  if (!trainer.ok) return trainer

  return {
    ok: true,
    card: {
      species,
      name: name.value,
      trainer: trainer.value,
      generation,
      coat: coatOf(g),
      hue: hueShift(g),
      shiny: isShiny(g),
      size: sizeOf(g, personality),
      d,
    },
  }
}

export const toHex = (p: Packed) => p.map((w) => (w >>> 0).toString(16)) as [string, string, string]
