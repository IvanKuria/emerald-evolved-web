/* ------------------------------------------------------------------
   Where Emerald Evolved keeps things in a save. ONE module, on purpose:
   the hack's genome layout is still being finalised, and when it moves
   this is the only file that changes (tests/save.test.ts then says
   whether everything still agrees).

   Two layers:

   1. The save file and the box Pokémon, from pokeemerald-expansion
      1.17.2 (include/save.h, include/global.h, include/pokemon.h).
      These are the game's own formats and do not change with the hack.

   2. The genome: 77 bits the hack keeps in fields Emerald never uses,
      packed in the order port/src/genetics.c's PackGenome writes them.

   The single source of truth is research/pokemon-evolution/
   BUILD_STATUS.md ("Save format") and its reference decoder
   web/genome_decode.py, whose offsets were measured with the game's own
   compiler. tests/save.test.ts runs this parser on the ROM's own test
   saves (tests/fixtures/0*.sav) and checks it agrees.
------------------------------------------------------------------ */

/* ---- 1. the save --------------------------------------------------- */

export const SECTOR = 0x1000
export const SECTOR_DATA = 3968
export const FOOTER = { id: 0xff4, checksum: 0xff6, signature: 0xff8, counter: 0xffc }
export const SIGNATURE = 0x08012025
export const SECTORS_PER_SLOT = 14
export const SLOTS = 2
/** sector ids inside a slot */
export const SB2 = 0
export const SB1 = [1, 4] as const
export const STORAGE = [5, 13] as const

/** SaveBlock2 */
export const SB2_PLAYER_NAME = 0x00 // 7 chars + EOS
export const SB2_TRAINER_ID = 0x0a // u32, low 16 = public id
/** SaveBlock1 */
export const SB1_PARTY_COUNT = 0x234 // u32
export const SB1_PARTY = 0x238
export const SB1_DAYCARE = 0x3030 // two DaycareMons, 140 bytes each, each starting with a BoxPokemon
export const DAYCARE_MON_SIZE = 140
export const PARTY_SIZE = 6
export const POKEMON_SIZE = 100 // struct Pokemon: BoxPokemon (80) + status, level, mail, hp, stats
/** PokemonStorage */
export const STORAGE_BOXES = 0x04
export const BOXES = 14
export const IN_BOX = 30
export const BOX_MON_SIZE = 80

/** struct BoxPokemon */
export const BOX = {
  personality: 0x00,
  otId: 0x04,
  nickname: 0x08, // 10 bytes; chars 11-12 live in substruct 0
  flags19: 0x13, // bit0 isBadEgg, bit1 hasSpecies, bit2 isEgg, bit3 blockBoxRS (genome), bit7 unused_13 (genome)
  otName: 0x14, // 7 bytes
  checksum: 0x1c,
  word1e: 0x1e, // hpLost:14 shinyModifier:1 unused_1E:1
  secure: 0x20, // 48 bytes, four 12-byte substructs, encrypted
}

/* Which slot each substruct sits in, by personality % 24
   (src/pokemon.c, sSubstructOffsets). */
export const SUBSTRUCT_SLOT: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 2, 3, 1, 1, 2, 3, 2, 3, 1, 1, 2, 3, 2, 3],
  [1, 1, 2, 3, 2, 3, 0, 0, 0, 0, 0, 0, 2, 3, 1, 1, 3, 2, 2, 3, 1, 1, 3, 2],
  [2, 3, 1, 1, 3, 2, 2, 3, 1, 1, 3, 2, 0, 0, 0, 0, 0, 0, 3, 2, 3, 2, 1, 1],
  [3, 2, 3, 2, 1, 1, 3, 2, 3, 2, 1, 1, 3, 2, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0],
]

/** A field inside a decrypted substruct: little-endian word at `byte`, `bits` wide from `shift`. */
export interface Field {
  sub: 0 | 1 | 2 | 3
  byte: number
  size: 1 | 2 | 4
  shift: number
  bits: number
}
const f = (sub: Field['sub'], byte: number, size: Field['size'], shift: number, bits: number): Field => ({ sub, byte, size, shift, bits })

/* Bitfield positions, as GCC lays them out for ARM (each field in its
   declared type's container, never straddling it). */
export const SUB = {
  species: f(0, 0, 2, 0, 11),
  teraType: f(0, 0, 2, 11, 5),
  unused02: f(0, 2, 2, 10, 6),
  nickname11: f(0, 4, 4, 21, 8),
  unused04: f(0, 4, 4, 29, 3),
  nickname12: f(0, 10, 2, 6, 8),
  unused0A: f(0, 10, 2, 14, 2),
  s1unused04: f(1, 4, 2, 11, 5),
  s1unused06: f(1, 6, 2, 11, 3),
  hyperHP: f(1, 6, 2, 14, 1),
  hyperAtk: f(1, 6, 2, 15, 1),
  hyperDef: f(1, 8, 1, 7, 1),
  hyperSpe: f(1, 9, 1, 7, 1),
  hyperSpA: f(1, 10, 1, 7, 1),
  hyperSpD: f(1, 11, 1, 7, 1),
  dynamaxLevel: f(3, 2, 2, 11, 4),
  ivWord: f(3, 4, 4, 0, 30), // six 5-bit IV fields, hp first
  isEgg: f(3, 4, 4, 30, 1),
  gigantamax: f(3, 4, 4, 31, 1),
  ribbonsMarineToWorld: f(3, 8, 4, 20, 7),
  isShadow: f(3, 8, 4, 27, 1),
  unused0B: f(3, 8, 4, 28, 1),
}

/* ---- 2. the genome -------------------------------------------------- */

/* Where the 77 genome bits come from, lowest first (patch_port.py
   ReadGenomeBits). Each entry is [field, width]. 'unused_13',
   'unused_1E' and 'blockBoxRS' are in the unencrypted header. */
export type GenomeSource = keyof typeof SUB | 'unused13' | 'unused1E' | 'blockBoxRS'
export const GENOME_SOURCES: [GenomeSource, number][] = [
  ['ivWord', 30],
  ['unused02', 6],
  ['unused04', 3],
  ['unused0A', 2],
  ['teraType', 5],
  ['s1unused04', 5],
  ['s1unused06', 3],
  ['hyperHP', 1],
  ['hyperAtk', 1],
  ['hyperDef', 1],
  ['hyperSpe', 1],
  ['hyperSpA', 1],
  ['hyperSpD', 1],
  ['unused0B', 1],
  ['isShadow', 1],
  ['ribbonsMarineToWorld', 7],
  ['dynamaxLevel', 4],
  ['gigantamax', 1],
  ['unused13', 1],
  ['unused1E', 1],
  ['blockBoxRS', 1],
]

/* The packed genome (genetics.c PackGenome), BUILD_STATUS.md "Canonical
   layout". Every diploid locus is 2 bits, bit 0 the mother's copy. */
export const G = {
  iv: 0, // 36: 6 stats x 3 loci x 2 copies
  shiny: 36, // 2
  coat: 38, // 6: C, E, A loci x 2 copies
  lethal: 44, // 7
  dead: 51, // 1: inviable egg (two copies of the lethal, or it failed the 2^-n hybrid roll)
  hue: 52, // 8: two signed 4-bit alleles, mother's copy first
  spec: 60, // 16: loci A1-A4 then B1-B4, 2 copies each (1 = derived)
  has: 76, // 1
} as const

export const HUE_STEP = 48 // hue units per allele step; 1536 units = 360 degrees

/* The generation counter: a 16-bit value in nickname characters 11-12
   (MON_DATA_GENERATION). Wild Pokémon are 0; an egg is max(parents) + 1.
   A save from before the hack can hold end-of-string padding there
   (0xFF), which is treated as unknown. */
export const GENERATION = { lo: 'nickname11', hi: 'nickname12', unset: 0xff00 } as const
