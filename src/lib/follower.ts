import { applyGenes, ex5, type Rgb5 } from '../registry/palette'

/* ------------------------------------------------------------------
   Eevee's follower: the overworld sprite that walks behind the player
   in pokeemerald-expansion, recolored by the hack's own palette maths.

   The sheet is six 32x32 frames (graphics/pokemon/eevee/overworld.png):
   south, south step, north, north step, west, west step. East is west
   mirrored, exactly as sAnimTable_Following does it with `.hFlip`.

   A walk is sAnim_Go<Dir>2F: stand, step, step, stand, six game frames
   each at one pixel a frame, so the feet change every twelve pixels
   walked. Here the feet are driven by distance, not by a clock, so a
   walker that slows down (under the pointer, say) also steps slower,
   and one that stops stands still.

   Colors: the ROM recolors a follower with ApplyGenesTo16 on its
   overworld palette (port/src/genetics_palette.c GeneticMonPalette,
   follower call site) -- the same function the registry card uses on
   the front sprite, so the TypeScript port in registry/palette.ts is
   reused as is. Size is the ROM's follower scale, displayScale(size)
   capped at 1.5x, drawn nearest-neighbour as the GBA's affine unit
   does it.
------------------------------------------------------------------ */

export interface FollowerSheet {
  w: number
  h: number
  frames: number[][]
  palette: Rgb5[]
  shiny: Rgb5[]
}

export type Facing = 'south' | 'north' | 'west' | 'east'
const FIRST: Record<Facing, number> = { south: 0, north: 2, west: 4, east: 4 }

/** sAnim_Go<Dir>2F: stand, step, step, stand. Index into this with (pixels walked / 6) % 4. */
const WALK = [0, 1, 1, 0]
export const STRIDE = 6

/** The follower scale cap from the release ROM (BUILD_STATUS.md, decision 6). */
export const FOLLOWER_MAX_SCALE = 1.5

export interface Look {
  coat: number
  /** hue shift in the ROM's units, 1536 = a full turn */
  hue: number
  shiny?: boolean
}

let sheet: Promise<FollowerSheet> | null = null
export const loadFollower = () => (sheet ??= fetch('/game/eevee_ow.json').then((r) => r.json()))

let shadow: Promise<HTMLCanvasElement> | null = null
/** The overworld shadow (field_effects/pics/shadow_medium.png), tinted the house's warm ink. */
export const loadShadow = () =>
  (shadow ??= new Promise<HTMLCanvasElement>((ok) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = 'rgb(40, 30, 20)'
      ctx.fillRect(0, 0, c.width, c.height)
      ok(c)
    }
    img.src = '/game/shadow_medium.png'
  }))

/** Which sheet frame to show, and whether to mirror it. */
export function frameFor(facing: Facing, walked: number | null): { index: number; flip: boolean } {
  const step = walked === null ? 0 : WALK[Math.floor(walked / STRIDE) & 3]
  return { index: FIRST[facing] + step, flip: facing === 'east' }
}

const cache = new Map<string, HTMLCanvasElement>()

/** One frame of the sheet in the colors `look` gives it, 32x32 at 1:1. */
export function paintFollower(s: FollowerSheet, index: number, look: Look): HTMLCanvasElement {
  const key = `${index}|${look.coat}|${look.hue}|${look.shiny ? 1 : 0}`
  let c = cache.get(key)
  if (c) return c
  const pal = applyGenes(look.shiny ? s.shiny : s.palette, look.coat, look.hue)
  c = document.createElement('canvas')
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(s.w, s.h)
  const px = s.frames[index]
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

/** The lowest opaque row over all frames: where the feet are, so walkers stand on a line. */
export function feetOf(s: FollowerSheet) {
  let feet = 0
  for (const f of s.frames)
    for (let i = f.length - 1; i >= 0; i--)
      if (f[i]) {
        feet = Math.max(feet, Math.floor(i / s.w))
        break
      }
  return feet
}
