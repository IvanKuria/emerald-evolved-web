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
  /** the .bps itself: its SHA-1 and size (the size is how the site tells the real file from a missing one) */
  patchSha1?: string
  patchSize?: number
  patchUrl: string
  /** Name for the patched file if the player downloads it for a desktop emulator. */
  outName: string
  version: string
  /** Small patches that bring a game stored by an older release up to this one (Continue never sees the base ROM again). */
  upgrades?: { fromSha1: string; url: string }[]
}

/* Pokémon Emerald (USA, Europe), the one retail revision. Cross-checked
   against pret/pokeemerald's README ("pokeemerald.gba
   sha1: f3ae088181bf583e55daf962a92bb46f4f1d07b7") and the No-Intro
   entry, and it is the base the owner's shipped Real Genetics patch
   verifies against in tools/realgen/make_patch.sh. */
export const EMERALD: PatchTarget = {
  baseName: 'Pokémon Emerald (US)',
  sourceSha1: 'f3ae088181bf583e55daf962a92bb46f4f1d07b7',
  // BUILD_STATUS.md "Release artefacts": vanilla + patch == release ROM, byte for byte
  // v1.0.1: trainers no longer Dynamax / Terastallize (their "don't" markers live in genome bits)
  targetSha1: '2e6997928f4186bc3debbf7bf3019455699861ca',
  patchSha1: 'bbfcc8433c93dd884420a5925f8f82bdda8cd9a1',
  patchSize: 24_554_674,
  patchUrl: '/patch/emerald-evolved.bps',
  outName: 'emerald-evolved.gba',
  version: 'v1.0.1',
  upgrades: [{ fromSha1: 'b833daac0573f700ec634b946cbdf55253739755', url: '/patch/upgrade-1.0.0-to-1.0.1.bps' }],
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

/* Is the release patch on this site? It is served from our own origin
   (scripts/fetch-patch.mjs puts it there at build time) and is not in
   the repo. A missing file can come back as the app's HTML page, so the
   answer is "yes" only when the size is the patch's. */
let available: Promise<boolean> | null = null
export function patchAvailable(t: PatchTarget = EMERALD): Promise<boolean> {
  if (t !== EMERALD) return Promise.resolve(true)
  available ??= fetch(t.patchUrl, { method: 'HEAD' })
    // Vercel serves the patch brotli-compressed to browsers, with no content-length, so only a 200 is
    // required here; the patched ROM's SHA-1 is checked after patching anyway.
    .then((r) => {
      if (!r.ok) return false
      const len = r.headers.get('content-length')
      return r.headers.has('content-encoding') || !len || Number(len) === t.patchSize
    })
    .catch(() => false)
  return available
}

/* A ROM dropped on the home page's device, handed to /play in memory only, the way the registry
   takes a save from Play (registry/client.ts handSave). Never stored, never sent. */
let handed: File | 'test' | null = null
/** A file, or 'test' for the site's own test cartridge. */
export const handRom = (f: File | 'test') => void (handed = f)
export const takeRom = () => {
  const f = handed
  handed = null
  return f
}
