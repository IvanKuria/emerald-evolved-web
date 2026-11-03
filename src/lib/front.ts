import anim from '../data/eevee-front.json'
import { applyGenes, ex5, type Rgb5 } from '../registry/palette'
import type { Look } from './follower'

/* ------------------------------------------------------------------
   Eevee's front sprite, as the hatch screen and the summary show it.

   The two frames are anim_front.png's (public/game/eevee.json). The
   colors go through the ROM's ApplyGenesTo16 (registry/palette.ts),
   the same as a registry card. The animation is DoMonFrontSpriteAnimation
   for Eevee, ported frame by frame in research/pokemon-genetics/animation:
   the image track (frame 1 for 33 game frames, then 0 for 5) and
   ANIM_V_STRETCH (41 frames: thinner and taller, a half sine, with a
   quick ripple in the middle, the feet kept on the ground).

   Affine values in pokemon_animation.c are inverse: the displayed scale
   is 256 / raw. That is applied here, so a raw 216 is 1.185x.
------------------------------------------------------------------ */

interface Sheet {
  w: number
  frames: number[][]
  palette: number[][]
  shiny: number[][]
}

let sheet: Promise<Sheet> | null = null
export const loadFront = () => (sheet ??= fetch('/game/eevee.json').then((r) => r.json()))

const five = (p: number[][]) => p.map((c) => c.map((v) => v >> 3) as Rgb5)
const cache = new Map<string, HTMLCanvasElement>()

export function paintFront(s: Sheet, frame: number, look: Look): HTMLCanvasElement {
  const key = `${frame}|${look.coat}|${look.hue}|${look.shiny ? 1 : 0}`
  let c = cache.get(key)
  if (c) return c
  const pal = applyGenes(five(look.shiny ? s.shiny : s.palette), look.coat, look.hue)
  c = document.createElement('canvas')
  c.width = c.height = s.w
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(s.w, s.w)
  const px = s.frames[frame]
  for (let i = 0; i < px.length; i++) {
    const k = px[i]
    if (!k) continue
    img.data[i * 4] = ex5(pal[k][0])
    img.data[i * 4 + 1] = ex5(pal[k][1])
    img.data[i * 4 + 2] = ex5(pal[k][2])
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  cache.set(key, c)
  return c
}

/** Game frames in Eevee's front animation. */
export const FRONT_FRAMES = Math.max(anim.image.length, anim.motion.length)

/** The front animation at game frame `f` (null = at rest): which image, the y offset and display scale. */
export function frontAt(f: number | null) {
  if (f === null || f < 0 || f >= FRONT_FRAMES) return { image: 0, y: 0, sx: 1, sy: 1 }
  const m = anim.motion[Math.floor(f)] ?? [0, 256, 256]
  return { image: anim.image[Math.floor(f)] ?? 0, y: m[0], sx: 256 / m[1], sy: 256 / m[2] }
}

/**
 * Draw the front sprite centered on (x, y) in game pixels: the sprite's center is its anchor, as on the
 * GBA (`x, y` is the center; affine scaling pivots there). `scale` multiplies on top (Emerge, size).
 */
export function drawFront(
  ctx: CanvasRenderingContext2D,
  s: Sheet,
  look: Look,
  x: number,
  y: number,
  f: number | null,
  scale = 1,
) {
  const a = frontAt(f)
  const sp = paintFront(s, a.image, look)
  const w = 64 * a.sx * scale
  const h = 64 * a.sy * scale
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sp, Math.round(x - w / 2), Math.round(y + a.y - h / 2), Math.round(w), Math.round(h))
}

export type FrontSheet = Sheet
