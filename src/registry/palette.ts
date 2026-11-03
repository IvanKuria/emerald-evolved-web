/* ------------------------------------------------------------------
   The hack's palette genes, line for line from ApplyGenesTo16 in
   port/src/genetics_palette.c (the release ROM). Integer maths, C
   truncating division, BGR555 in and out, so the card shows exactly the
   colours the ROM draws for the same genes on a front sprite.

   Coats (albino, red, black) recolour the whole palette. The hue gene
   only rotates the dominant body-hue band: the +-30 degree hue cluster
   holding the most palette entries (front sprites weight every entry
   equally, as battle and summary do), so Pikachu's cheeks and Eevee's
   eyes keep their colours. tests/fixtures/palette-expected.json comes
   from compiling that C file itself and is checked by tests/save.test.ts.
------------------------------------------------------------------ */

export type Rgb5 = [number, number, number]

const OUTLINE_Y = 40, WHITE_Y = 200, WHITE_CHROMA = 48
const ALBINO_LO = 150, ALBINO_HI = 248, ALBINO_HUE = 160, ALBINO_CHROMA = 26, ALBINO_RES = 3
const RED_BASE = 0, RED_SPAN = 80, RED_LUMA = 120, RED_CMIN = 120
const BLACK_LO = 18, BLACK_HI = 96, BCN = 1, BCD = 6, BCMAX = 16, BON = 1, BOD = 3

/** C integer division: truncates toward zero. */
const idiv = (a: number, b: number) => Math.trunc(a / b)
export const ex5 = (v: number) => (v << 3) | (v >> 2)
const to5 = (v: number) => {
  v = Math.max(0, Math.min(255, v))
  return Math.floor((v * 31 + 127) / 255)
}
const luma = (r: number, g: number, b: number) => (r * 77 + g * 150 + b * 29) >> 8

function hue(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn
  if (c === 0) return 0
  let h: number
  if (mx === r) h = g >= b ? idiv(256 * (g - b), c) : 1536 - idiv(256 * (b - g), c)
  else if (mx === g) h = b >= r ? 512 + idiv(256 * (b - r), c) : 512 - idiv(256 * (r - b), c)
  else h = r >= g ? 1024 + idiv(256 * (r - g), c) : 1024 - idiv(256 * (g - r), c)
  return h >= 1536 ? h - 1536 : h
}

function pure(h: number): [number, number, number] {
  const f = h & 255, s = h >> 8
  const t: [number, number, number][] = [[255, f, 0], [255 - f, 255, 0], [0, 255, f], [0, 255 - f, 255], [f, 0, 255]]
  return s < 5 ? t[s] : [255, 0, 255 - f]
}

function flhc(y: number, h: number, chroma: number): number[] {
  const p = pure(h), yp = luma(...p)
  for (const d of p.map((x) => x - yp)) {
    if (d > 0) chroma = Math.min(chroma, idiv((255 - y) * 255, d))
    else if (d < 0) chroma = Math.min(chroma, idiv(y * 255, -d))
  }
  return p.map((x) => {
    const d = x - yp
    const v = d >= 0 ? y + idiv(d * chroma, 255) : y - idiv(-d * chroma, 255)
    return Math.max(0, Math.min(255, v))
  })
}

function classify(r: number, g: number, b: number): [number, number, number] {
  const y = luma(r, g, b), c = Math.max(r, g, b) - Math.min(r, g, b)
  if (y < OUTLINE_Y) return [0, y, c]
  if (y >= WHITE_Y && c < WHITE_CHROMA) return [1, y, c]
  return [2, y, c]
}

const CLUSTER_HALF_WIDTH = 128 // +-30 degrees
const CLUSTER_MIN_CHROMA = 24

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b)
  return d > 768 ? 1536 - d : d
}

/** DominantHueCluster: a 16-bit mask of the entries the hue gene rotates. */
function dominantHueCluster(pal: Rgb5[]): number {
  const hues: number[] = []
  const w: number[] = []
  for (let i = 1; i < 16; i++) {
    const r = ex5(pal[i][0]), g = ex5(pal[i][1]), b = ex5(pal[i][2])
    const [k, , c] = classify(r, g, b)
    w[i] = 0
    if (k !== 2 || c < CLUSTER_MIN_CHROMA) continue
    hues[i] = hue(r, g, b)
    w[i] = 1
  }
  let best = -1, bestScore = 0
  for (let i = 1; i < 16; i++) {
    if (!w[i]) continue
    let score = 0
    for (let j = 1; j < 16; j++) if (w[j] && hueDist(hues[i], hues[j]) <= CLUSTER_HALF_WIDTH) score += w[j]
    if (score > bestScore) (bestScore = score), (best = i)
  }
  if (best < 0) return 0
  let centre = hues[best], sum = 0, wsum = 0
  for (let j = 1; j < 16; j++) {
    if (w[j] && hueDist(centre, hues[j]) <= CLUSTER_HALF_WIDTH) {
      let dh = hues[j] - centre
      if (dh > 768) dh -= 1536
      if (dh < -768) dh += 1536
      sum += dh * w[j]
      wsum += w[j]
    }
  }
  centre += idiv(sum, wsum)
  if (centre < 0) centre += 1536
  if (centre >= 1536) centre -= 1536
  let mask = 0
  for (let i = 1; i < 16; i++) {
    const r = ex5(pal[i][0]), g = ex5(pal[i][1]), b = ex5(pal[i][2])
    const [k, , c] = classify(r, g, b)
    if (k === 2 && c > 0 && hueDist(centre, hue(r, g, b)) <= CLUSTER_HALF_WIDTH) mask |= 1 << i
  }
  return mask
}

/** Apply coat (0 normal, 1 albino, 2 red, 3 black) and a hue shift (1536 = 360 degrees) to a 16-colour palette. */
export function applyGenes(palette: Rgb5[], coat: number, shift: number): Rgb5[] {
  const pal = palette.map((c) => c.slice() as Rgb5)
  const hueMask = shift !== 0 && coat !== 1 ? dominantHueCluster(palette) : 0
  const ys: number[] = []
  for (let i = 1; i < 16; i++) {
    const [k, y] = classify(ex5(pal[i][0]), ex5(pal[i][1]), ex5(pal[i][2]))
    if (k === 2) ys.push(y)
  }
  const lo = ys.length ? Math.min(...ys) : 255, hi = ys.length ? Math.max(...ys) : 0
  const span = hi > lo ? hi - lo : 0
  for (let i = 1; i < 16; i++) {
    const r = ex5(pal[i][0]), g = ex5(pal[i][1]), b = ex5(pal[i][2])
    const rgb = [r, g, b]
    const [kind, y, c] = classify(r, g, b)
    if (kind === 1) continue
    const t = span ? (kind === 2 ? idiv((y - lo) * 255, span) : 0) : y
    let out: number[]
    if (coat === 1) {
      if (kind === 0) continue
      out = flhc(ALBINO_LO + idiv(t * (ALBINO_HI - ALBINO_LO), 255), ALBINO_HUE, ALBINO_CHROMA)
      out = out.map((o, j) => {
        const d = rgb[j] - y
        return o + (d >= 0 ? d >> ALBINO_RES : -((-d) >> ALBINO_RES))
      })
    } else if (coat === 2) {
      if (kind === 0) continue
      out = flhc(y, RED_BASE + idiv(hue(r, g, b) * RED_SPAN, 1536) + idiv(y * RED_LUMA, 255), c > RED_CMIN ? c : RED_CMIN)
    } else if (coat === 3) {
      if (kind === 0) out = [0, 0, 0].map(() => idiv(y * BON, BOD))
      else out = flhc(BLACK_LO + idiv(t * (BLACK_HI - BLACK_LO), 255), hue(r, g, b), Math.min(idiv(c * BCN, BCD), BCMAX))
    } else {
      if (kind !== 2 || !(hueMask & (1 << i))) continue
      out = rgb
    }
    // hue gene: rotate the pigment's hue, keep its luma and chroma, so shading survives
    if (kind === 2 && hueMask & (1 << i)) {
      const h2 = (((hue(out[0], out[1], out[2]) + shift) % 1536) + 1536) % 1536
      const c2 = Math.max(...out) - Math.min(...out)
      out = flhc(luma(out[0], out[1], out[2]), h2, c2)
    }
    pal[i] = [to5(out[0]), to5(out[1]), to5(out[2])]
  }
  return pal
}
