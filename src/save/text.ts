/* Gen 3 text (charmap.txt in the decomp): the letters a save stores names in. */

const MAP: Record<number, string> = { 0x00: ' ', 0x1b: 'é', 0x2d: '&', 0x2e: '+', 0x35: '=', 0x5b: '%', 0x5c: '(', 0x5d: ')' }
'0123456789!?.-'.split('').forEach((c, i) => (MAP[0xa1 + i] = c))
Object.assign(MAP, { 0xb0: '…', 0xb1: '“', 0xb2: '”', 0xb3: '‘', 0xb4: '’', 0xb5: '♂', 0xb6: '♀', 0xb8: ',', 0xba: '/' })
for (let i = 0; i < 26; i++) {
  MAP[0xbb + i] = String.fromCharCode(65 + i)
  MAP[0xd5 + i] = String.fromCharCode(97 + i)
}
const BACK: Record<string, number> = Object.fromEntries(Object.entries(MAP).map(([k, v]) => [v, Number(k)]))

export const EOS = 0xff

/** Decode up to the end-of-string byte. Unknown bytes become nothing. */
export function decodeText(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) {
    if (b === EOS) break
    s += MAP[b] ?? ''
  }
  return s
}

/** Encode into `len` bytes, EOS-terminated and padded (used by tests and nowhere else). */
export function encodeText(text: string, len: number): Uint8Array {
  const out = new Uint8Array(len).fill(EOS)
  ;[...text].slice(0, len).forEach((c, i) => (out[i] = BACK[c] ?? 0))
  return out
}
