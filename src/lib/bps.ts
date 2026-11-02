/* ------------------------------------------------------------------
   BPS ("beat"), the patch format Flips and Rom Patcher JS use.

   The whole reason this file exists is the rule the site is built
   around: the ROM never leaves the player's machine. So the patch is
   applied here, in the tab, against the bytes they dropped in.

   Format (byuu's spec, version 1):
     "BPS1"
     varint sourceSize, varint targetSize, varint metadataSize, metadata
     actions until the footer, each a varint ((length - 1) << 2 | command):
       0 SourceRead   copy source[outputOffset ..] (same position)
       1 TargetRead   literal bytes stored in the patch
       2 SourceCopy   copy from the source at a signed relative cursor
       3 TargetCopy   copy from the output already written (may overlap,
                      which is how runs are encoded, so byte by byte)
     footer: CRC32 source, CRC32 target, CRC32 of the patch minus its
     own last four bytes. All little-endian.

   Every check the format offers is made, and each failure says which
   file is wrong, because "patch failed" is the least useful sentence
   a player can be shown.
------------------------------------------------------------------ */

export class BpsError extends Error {
  constructor(
    message: string,
    /** Which file is at fault, so the UI can point at the right one. */
    public culprit: 'patch' | 'source' | 'output',
  ) {
    super(message)
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array, start = 0, end = data.length): number {
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const u32le = (d: Uint8Array, i: number) =>
  (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0

/** Numbers are arbitrary-length; a ROM is at most 32 MB so a JS number never loses precision here. */
function readNumber(d: Uint8Array, pos: { i: number }, end: number): number {
  let n = 0
  let shift = 1
  for (;;) {
    if (pos.i >= end) throw new BpsError('The patch is cut off part-way through.', 'patch')
    const x = d[pos.i++]
    n += (x & 0x7f) * shift
    if (x & 0x80) return n
    shift *= 128
    n += shift
    if (n > Number.MAX_SAFE_INTEGER) throw new BpsError('The patch contains an impossible size.', 'patch')
  }
}

function readSigned(d: Uint8Array, pos: { i: number }, end: number): number {
  const n = readNumber(d, pos, end)
  return n % 2 ? -Math.floor(n / 2) : Math.floor(n / 2)
}

export interface BpsHeader {
  sourceSize: number
  targetSize: number
  metadata: string
  sourceCrc: number
  targetCrc: number
}

/** Reads and validates the header and footer without touching the source. */
export function readBpsHeader(patch: Uint8Array): BpsHeader & { actionsStart: number; actionsEnd: number } {
  if (patch.length < 4 + 3 + 12 || patch[0] !== 0x42 || patch[1] !== 0x50 || patch[2] !== 0x53 || patch[3] !== 0x31)
    throw new BpsError('This is not a BPS patch.', 'patch')
  const end = patch.length - 12
  if (crc32(patch, 0, patch.length - 4) !== u32le(patch, patch.length - 4))
    throw new BpsError('The patch file is damaged (its checksum does not match). Download it again.', 'patch')
  const pos = { i: 4 }
  const sourceSize = readNumber(patch, pos, end)
  const targetSize = readNumber(patch, pos, end)
  const metaSize = readNumber(patch, pos, end)
  if (pos.i + metaSize > end) throw new BpsError('The patch metadata runs past its end.', 'patch')
  const metadata = new TextDecoder().decode(patch.subarray(pos.i, pos.i + metaSize))
  pos.i += metaSize
  return {
    sourceSize,
    targetSize,
    metadata,
    sourceCrc: u32le(patch, end),
    targetCrc: u32le(patch, end + 4),
    actionsStart: pos.i,
    actionsEnd: end,
  }
}

/**
 * Apply `patch` to `source` and return the patched bytes.
 * `onProgress` gets 0..1 and is called a few hundred times at most.
 */
export function applyBps(
  source: Uint8Array,
  patch: Uint8Array,
  onProgress?: (fraction: number) => void,
): Uint8Array {
  const h = readBpsHeader(patch)
  if (source.length !== h.sourceSize)
    throw new BpsError(
      `This patch expects a ${h.sourceSize.toLocaleString()} byte file, and yours is ${source.length.toLocaleString()} bytes.`,
      'source',
    )
  if (crc32(source) !== h.sourceCrc)
    throw new BpsError('This patch was made for a different file than the one you gave it.', 'source')

  const out = new Uint8Array(h.targetSize)
  const pos = { i: h.actionsStart }
  const end = h.actionsEnd
  let o = 0
  let sourceRel = 0
  let targetRel = 0
  const step = Math.max(1, Math.floor(h.targetSize / 200))
  let nextReport = step

  while (pos.i < end) {
    const data = readNumber(patch, pos, end)
    const command = data & 3
    const length = Math.floor(data / 4) + 1
    if (o + length > out.length) throw new BpsError('The patch writes past the end of the game.', 'patch')

    switch (command) {
      case 0: // SourceRead
        if (o + length > source.length) throw new BpsError('The patch reads past the end of your file.', 'patch')
        out.set(source.subarray(o, o + length), o)
        o += length
        break
      case 1: // TargetRead
        if (pos.i + length > end) throw new BpsError('The patch is cut off part-way through.', 'patch')
        out.set(patch.subarray(pos.i, pos.i + length), o)
        pos.i += length
        o += length
        break
      case 2: // SourceCopy
        sourceRel += readSigned(patch, pos, end)
        if (sourceRel < 0 || sourceRel + length > source.length)
          throw new BpsError('The patch points outside your file.', 'patch')
        out.set(source.subarray(sourceRel, sourceRel + length), o)
        sourceRel += length
        o += length
        break
      default: // TargetCopy: may overlap the bytes it is writing, so it must go one at a time
        targetRel += readSigned(patch, pos, end)
        if (targetRel < 0 || targetRel >= o) throw new BpsError('The patch points outside the game.', 'patch')
        for (let k = 0; k < length; k++) out[o++] = out[targetRel++]
    }
    if (onProgress && o >= nextReport) {
      onProgress(o / out.length)
      nextReport = o + step
    }
  }

  if (o !== out.length) throw new BpsError('The patch ended before the game was finished.', 'patch')
  if (crc32(out) !== h.targetCrc)
    throw new BpsError('The patched game does not match what the patch promised. Nothing was saved.', 'output')
  onProgress?.(1)
  return out
}

/* ------------------------------------------------------------------
   Encoder. The site never needs one at runtime; it is here so the test
   suite can build patches and round-trip them, and so the test
   cartridge's patch is produced by the same code that reads it (and
   then checked against Flips, which is independent of all of this).

   Greedy, and good enough for "most of the ROM is unchanged":
   SourceRead while bytes match in place, otherwise a SourceCopy found
   through a hash of 8-byte windows, otherwise a literal byte.
------------------------------------------------------------------ */

function writeNumber(out: number[], n: number) {
  for (;;) {
    const x = n % 128
    n = Math.floor(n / 128)
    if (n === 0) {
      out.push(0x80 | x)
      return
    }
    out.push(x)
    n -= 1
  }
}

export function createBps(source: Uint8Array, target: Uint8Array, metadata = ''): Uint8Array {
  const out: number[] = [0x42, 0x50, 0x53, 0x31]
  writeNumber(out, source.length)
  writeNumber(out, target.length)
  const meta = new TextEncoder().encode(metadata)
  writeNumber(out, meta.length)
  out.push(...meta)

  const W = 8
  const index = new Map<number, number>()
  const key = (d: Uint8Array, i: number) => {
    let k = 0
    for (let j = 0; j < W; j++) k = (Math.imul(k, 31) + d[i + j]) | 0
    return k
  }
  for (let i = 0; i + W <= source.length; i++) if (!index.has(key(source, i))) index.set(key(source, i), i)

  let o = 0
  let sourceRel = 0
  let literal: number[] = []
  const flushLiteral = () => {
    if (!literal.length) return
    writeNumber(out, ((literal.length - 1) << 2) | 1)
    out.push(...literal)
    literal = []
  }
  const signed = (n: number) => writeNumber(out, (Math.abs(n) << 1) | (n < 0 ? 1 : 0))

  while (o < target.length) {
    let same = 0
    while (o + same < target.length && o + same < source.length && source[o + same] === target[o + same]) same++
    if (same >= 4) {
      flushLiteral()
      writeNumber(out, ((same - 1) << 2) | 0)
      o += same
      continue
    }
    if (o + W <= target.length) {
      const at = index.get(key(target, o))
      if (at !== undefined) {
        let run = 0
        while (o + run < target.length && at + run < source.length && source[at + run] === target[o + run]) run++
        if (run >= W) {
          flushLiteral()
          writeNumber(out, ((run - 1) << 2) | 2)
          signed(at - sourceRel)
          sourceRel = at + run
          o += run
          continue
        }
      }
    }
    literal.push(target[o++])
  }
  flushLiteral()

  const body = new Uint8Array(out.length + 12)
  body.set(out)
  const dv = new DataView(body.buffer)
  dv.setUint32(out.length, crc32(source), true)
  dv.setUint32(out.length + 4, crc32(target), true)
  dv.setUint32(out.length + 8, crc32(body, 0, out.length + 8), true)
  return body
}
