import { applyGenes, ex5, type Rgb5 } from '../registry/palette'

/* ------------------------------------------------------------------
   Eevee's party/PC icon (graphics/pokemon/eevee/icon.png: two 32x32
   frames, its own 16-color palette), recolored the way the hack
   recolors icons: SetMonIconGenePalette in port/src/genetics_palette.c,
   which weights each palette entry by how many pixels of the icon's
   first frame use it, and rounds the hue to 22.5-degree buckets
   ((hue + 48) / 96 x 96, truncating like C) because an icon is too
   small to show finer steps.

   In the party the icon bobs by swapping its two frames; sAnim_1 in
   pokemon_icon.c holds each for 8 game frames.
------------------------------------------------------------------ */

interface Sheet {
  w: number
  h: number
  frames: number[][]
  palette: Rgb5[]
}

let sheet: Promise<Sheet> | null = null
export const loadIcon = () => (sheet ??= fetch('/game/eevee_icon.json').then((r) => r.json()))

export const ICON_FRAME_GAME_FRAMES = 8

const bucket = (hue: number) => Math.trunc((hue + (hue >= 0 ? 48 : -48)) / 96) * 96
const cache = new Map<string, HTMLCanvasElement>()

export function paintIcon(s: Sheet, frame: number, hue: number): HTMLCanvasElement {
  const h = bucket(hue)
  const key = `${frame}|${h}`
  let c = cache.get(key)
  if (c) return c
  const weights = new Array(16).fill(0)
  for (const k of s.frames[0]) weights[k]++
  const pal = applyGenes(s.palette, 0, h, weights)
  c = document.createElement('canvas')
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(s.w, s.h)
  s.frames[frame].forEach((k, i) => {
    if (!k) return
    img.data.set([ex5(pal[k][0]), ex5(pal[k][1]), ex5(pal[k][2]), 255], i * 4)
  })
  ctx.putImageData(img, 0, 0)
  cache.set(key, c)
  return c
}
