/* SHA-1 of a file, in the tab.

   `crypto.subtle` does it natively, but only on a secure origin. A dev
   server reached over a LAN address is not one, and a checksum that
   silently fails there would look like "your ROM is wrong", so there
   is a plain implementation underneath. It runs at a few hundred MB/s,
   and Emerald is 16 MB. */

export async function sha1Hex(data: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-1', data as BufferSource)
    return hex(new Uint8Array(buf))
  }
  return hex(sha1Js(data))
}

function hex(b: Uint8Array) {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function sha1Js(msg: Uint8Array): Uint8Array {
  const ml = msg.length
  const withPad = ((ml + 9 + 63) >> 6) << 6
  const m = new Uint8Array(withPad)
  m.set(msg)
  m[ml] = 0x80
  const bits = ml * 8
  const dv = new DataView(m.buffer)
  dv.setUint32(withPad - 8, Math.floor(bits / 2 ** 32))
  dv.setUint32(withPad - 4, bits >>> 0)
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0
  const w = new Uint32Array(80)
  for (let off = 0; off < withPad; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4)
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]
      w[i] = (x << 1) | (x >>> 31)
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let i = 0; i < 80; i++) {
      let f: number, k: number
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999 }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1 }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc }
      else { f = b ^ c ^ d; k = 0xca62c1d6 }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0
  }
  const out = new Uint8Array(20)
  const ov = new DataView(out.buffer)
  ;[h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h))
  return out
}
