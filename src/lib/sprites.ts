/* ------------------------------------------------------------------
   Real GBA sprites, recoloured the way the GBA recolours: by swapping
   palette entries, never by tinting pixels.

   Eevee's front sprite is a 64x64 picture of palette indices (two
   frames stacked, from pokeemerald's anim_front.png) and a 16-colour
   palette. A creature's coat and mane genes rotate the hue of the
   palette entries that paint the body and the ruff; the outline, the
   eyes and the highlight keep their own colours. Every result is then
   snapped to the GBA's 15-bit colour (5 bits a channel) and widened back
   the way the hardware widens it, so nothing on screen is a colour the
   cartridge could not have shown.

   Rendered sprites are cached per quantised gene pair, along with a
   soft shadow made from the sprite's own silhouette -- the house
   thumbnails' drop shadow (offset down-right, blurred, ~28%).
------------------------------------------------------------------ */

export interface IndexedSprite {
  w: number
  h: number
  frames: number[][]
  palette: number[][]
  shiny: number[][]
}

/* Which palette entries are which, read off eevee/normal.pal:
   0 transparent, 1 white highlight, 2-5 cream ruff, 10 outline,
   11-14 brown body. */
const BODY = [11, 12, 13, 14]
const MANE = [2, 3, 4, 5]

let sheet: IndexedSprite | null = null
let loading: Promise<IndexedSprite> | null = null

export function loadEevee(): Promise<IndexedSprite> {
  if (sheet) return Promise.resolve(sheet)
  loading ??= fetch('/game/eevee.json')
    .then((r) => r.json())
    .then((s: IndexedSprite) => (sheet = s))
  return loading
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 1) + 1) % 1
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Snap to BGR555 and widen back (c << 3 | c >> 2), as the GBA's output does. */
const gba = (v: number) => {
  const c = Math.max(0, Math.min(31, Math.round(v / 8.226)))
  return (c << 3) | (c >> 2)
}

export function genePalette(base: number[][], coat: number, mane: number): number[][] {
  const pal = base.map((c) => c.slice())
  const shift = (idx: number[], turns: number, satMul: number, lightMul = 1) => {
    for (const i of idx) {
      const [h, s, l] = rgbToHsl(base[i][0], base[i][1], base[i][2])
      const [r, g, b] = hslToRgb(h + turns, Math.min(1, s * satMul), Math.min(1, l * lightMul))
      pal[i] = [r, g, b]
    }
  }
  /* The coat gene runs two ways from Eevee's brown, both ways real
     animals go. Up, the hue walks toward leaf green (about 60 degrees at
     the habitat's ideal). Down, the coat darkens toward a near-black
     chocolate, which is melanism -- the same black coat the Real
     Genetics patch has -- with only a nudge of hue toward red. Hue
     rotation alone sent it to magenta, which no Eevee should be. */
  if (coat >= 0) shift(BODY, coat * 0.33, 1 + coat * 0.15)
  else shift(BODY, coat * 0.07, 1 + coat * 0.35, 1 + coat * 0.78)
  // the ruff is nearly grey-cream, so its gene shows as a little saturation as well as hue
  shift(MANE, mane * 0.22, 1 + Math.abs(mane) * 0.7)
  return pal.map(([r, g, b]) => [gba(r), gba(g), gba(b)])
}

export interface RenderedSprite {
  frames: HTMLCanvasElement[]
  shadow: HTMLCanvasElement
  /** the colour people would name it by: body palette entry 12 */
  swatch: string
}

const cache = new Map<string, RenderedSprite>()
const Q = (v: number, steps: number) => Math.round(v * steps) / steps

function paint(s: IndexedSprite, frame: number, pal: number[][]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(s.w, s.h)
  const px = s.frames[frame]
  for (let i = 0; i < px.length; i++) {
    const k = px[i]
    if (k === 0) continue
    const [r, g, b] = pal[k]
    img.data[i * 4] = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** The silhouette, blurred, at 4x so it stays soft when scaled up. */
export function shadowOf(sprite: HTMLCanvasElement): HTMLCanvasElement {
  const S = 4
  const pad = 12 * S
  const c = document.createElement('canvas')
  c.width = sprite.width * S + pad * 2
  c.height = sprite.height * S + pad * 2
  const ctx = c.getContext('2d')!
  ctx.filter = `blur(${5 * S}px)`
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sprite, pad, pad, sprite.width * S, sprite.height * S)
  ctx.globalCompositeOperation = 'source-in'
  ctx.filter = 'none'
  ctx.fillStyle = 'rgba(40, 30, 20, 1)'
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

export function spriteFor(s: IndexedSprite, coat: number, mane: number, shiny = false): RenderedSprite {
  const qc = Q(coat, 48)
  const qm = Q(mane, 16)
  const key = `${qc}|${qm}|${shiny ? 1 : 0}`
  let hit = cache.get(key)
  if (hit) return hit
  const pal = genePalette(shiny ? s.shiny : s.palette, qc, qm)
  const frames = s.frames.map((_, i) => paint(s, i, pal))
  const [r, g, b] = pal[12]
  hit = { frames, shadow: shadowOf(frames[0]), swatch: `rgb(${r} ${g} ${b})` }
  cache.set(key, hit)
  return hit
}

/** Shadow geometry shared by every renderer, so the light comes from one place. */
export const SHADOW = { dx: 0.09, dy: 0.13, alpha: 0.26, pad: 12 }

/* Where Eevee actually is inside its 64x64 cell: the union of both
   anim_front frames' opaque pixels (x 11-48, y 11-54), with a pixel of
   air. Layout uses this box, not the cell, so a row of Eevee is spaced
   by Eevee and not by empty canvas. Row 54 is the feet. */
export const EEVEE_BOX = { x: 10, y: 10, w: 40, h: 46 }
export const EEVEE_FEET = { y: 55, x0: 16, x1: 46 }
