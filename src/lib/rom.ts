/* What the player dropped in, and whether we can patch it.

   The SHA-1 is the only thing that decides. The header is read as
   well, but only to make the refusal useful: "that is FireRed" is
   something a person can act on, "checksum mismatch" is not. */

export interface PatchTarget {
  /** What we call the base game in the interface. */
  baseName: string
  /** SHA-1 of the one file the patch applies to. */
  sourceSha1: string
  /** SHA-1 the patched result must have; null until the release is built. */
  targetSha1: string | null
  patchUrl: string
  /** Name for the patched file if the player downloads it for a desktop emulator. */
  outName: string
  version: string
}

/* Pokémon Emerald (USA, Europe), the one retail revision. Cross-checked
   against pret/pokeemerald's README ("pokeemerald.gba
   sha1: f3ae088181bf583e55daf962a92bb46f4f1d07b7") and the No-Intro
   entry, and it is the base the owner's shipped Real Genetics patch
   verifies against in tools/realgen/make_patch.sh. */
export const EMERALD: PatchTarget = {
  baseName: 'Pokémon Emerald (US)',
  sourceSha1: 'f3ae088181bf583e55daf962a92bb46f4f1d07b7',
  targetSha1: null,
  patchUrl: '/patch/pokemon-real-evolution.bps',
  outName: 'pokemon-real-evolution.gba',
  version: 'v0.1',
}

/* The homebrew test cartridge in /testrom (ours, CC0). It exists so the
   whole path -- checksum, patch, boot, input, saves -- can be exercised
   without anybody's copy of Emerald. */
export const TEST_CART: PatchTarget = {
  baseName: 'the EVOTEST cartridge',
  sourceSha1: '460d964d260d60c63d2d6b01671dbd27a92cac1a',
  targetSha1: '1d6cd17a755be0df3515505061d16d9d2da7711a',
  patchUrl: '/test/evotest-mutant.bps',
  outName: 'evotest-mutant.gba',
  version: 'test',
}

export interface RomHeader {
  title: string
  code: string
  version: number
}

export function readHeader(rom: Uint8Array): RomHeader | null {
  if (rom.length < 0xc0 || rom[0xb2] !== 0x96) return null
  const ascii = (a: number, b: number) =>
    String.fromCharCode(...rom.subarray(a, b)).replace(/[^\x20-\x7e]/g, '').trim()
  return { title: ascii(0xa0, 0xac), code: ascii(0xac, 0xb0), version: rom[0xbc] }
}

const KNOWN: Record<string, string> = {
  BPEE: 'Pokémon Emerald (US)',
  BPEJ: 'Pokémon Emerald (Japan)',
  BPED: 'Pokémon Emerald (German)',
  BPEF: 'Pokémon Emerald (French)',
  BPEI: 'Pokémon Emerald (Italian)',
  BPES: 'Pokémon Emerald (Spanish)',
  BPRE: 'Pokémon FireRed',
  BPGE: 'Pokémon LeafGreen',
  AXVE: 'Pokémon Ruby',
  AXPE: 'Pokémon Sapphire',
}

export type Verdict =
  | { ok: true }
  | { ok: false; title: string; detail: string }

export function judge(rom: Uint8Array, sha1: string, target: PatchTarget): Verdict {
  if (sha1 === target.sourceSha1) return { ok: true }
  const h = readHeader(rom)
  const looksLike = h ? KNOWN[h.code] : undefined

  if (!h)
    return {
      ok: false,
      title: 'That isn’t a Game Boy Advance game',
      detail: 'Drop in the .gba file itself. If it’s inside a .zip, unzip it first.',
    }
  if (h.code === 'BPEE')
    return {
      ok: false,
      title: 'That’s Emerald, but not an untouched copy',
      detail:
        'It has been changed since it came off the cartridge: another patch, a trainer, or a save written into it. Make a fresh dump and try again.',
    }
  if (looksLike)
    return {
      ok: false,
      title: `That’s ${looksLike}`,
      detail: `The patch is built on ${target.baseName}. Other games and languages won’t work.`,
    }
  return {
    ok: false,
    title: `That’s “${h.title || 'an unknown game'}”`,
    detail: `The patch needs ${target.baseName}.`,
  }
}
