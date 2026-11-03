import data from '../data/hatch.json'

/* ------------------------------------------------------------------
   Emerald's egg hatch, frame by frame.

   src/data/hatch.json is the port of src/egg_hatch.c in
   research/pokemon-genetics/animation (anim_sim.py, every line cited in
   ANIMATION.md there), cut at the moment the mon's cry and front
   animation start. Per game frame: the egg's sideways shake (whole
   pixels, `Sin(sin, 1)` then `Sin(sin, 2)`), which crack is showing,
   the mon's rise and its Emerge scale (0.156x growing to 1.0x over
   twelve frames), the palette fade toward white for the background and
   for the sprites separately, and every shard in flight.

   In the game the fade is BlendPalette: each 5-bit channel moves
   (target - c) * coeff / 16 of the way to white. Over opaque pixels
   that is exactly a white layer at coeff/16 opacity, which is how it
   is drawn here, so the egg really goes white rather than fading out.

   The clock is the GBA's: 59.7275 frames a second.
------------------------------------------------------------------ */

export const GBA_HZ = 59.7275

type Row = [number | null, number, number | null, number | null, number, number, number, [number, number, number][]]
const ROWS = data.frames as Row[]

export const HATCH_REVEAL = data.reveal
export const HATCH_ORIGIN = data.egg as [number, number]

/* Named moments, from the cue list in egg_hatch_togepi.json. */
export const CUE = { shake1: 53, crack1: 67, shake2: 104, crack2: 118, shake3: 156, white: 245, gone: 263, emerge: 264, fadeBack: 272 }

export interface HatchState {
  eggX: number | null
  crack: number
  monY: number | null
  monScale: number | null
  bg: number
  obj: number
  shards: [number, number, number][]
}

export function hatchAt(f: number): HatchState {
  const r = ROWS[Math.max(0, Math.min(ROWS.length - 1, Math.floor(f)))]
  return { eggX: r[0], crack: r[1], monY: r[2], monScale: r[3], bg: r[4] ? r[5] : 0, obj: r[4] ? r[6] : 0, shards: r[7] }
}

const img = (src: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = bad
    i.src = src
  })

export interface EggArt {
  eggs: HTMLImageElement[]
  shards: HTMLImageElement[]
}
let art: Promise<EggArt> | null = null
export const loadEggArt = () =>
  (art ??= Promise.all([
    Promise.all([0, 1, 2].map((i) => img(`/game/hatch_${i}.png`))),
    Promise.all([0, 1, 2, 3].map((i) => img(`/game/shard_${i}.png`))),
  ]).then(([eggs, shards]) => ({ eggs, shards })))

/**
 * Draw one hatch frame into `ctx`, already transformed to game pixels, with the scene's (120, 75)
 * at `origin`. `mon` draws the hatchling centered on (x, y) at a scale.
 */
export function drawHatch(
  ctx: CanvasRenderingContext2D,
  a: EggArt,
  s: HatchState,
  origin: [number, number],
  mon: ((ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => void) | null,
  shardKey = 0,
) {
  const dx = origin[0] - HATCH_ORIGIN[0]
  const dy = origin[1] - HATCH_ORIGIN[1]
  ctx.imageSmoothingEnabled = false
  if (s.eggX !== null) ctx.drawImage(a.eggs[Math.min(2, s.crack)], dx + 120 + s.eggX - 16, dy + 75 - 16)
  if (s.monY !== null && mon) mon(ctx, dx + 120, dy + s.monY, s.monScale ?? 1)
  for (const [x, y, born] of s.shards) ctx.drawImage(a.shards[(born * 7 + x + shardKey) & 3], dx + x - 4, dy + y - 4)
}

/** Blend everything drawn in `ctx` so far toward white by `coeff`/16, the way BlendPalette does. */
export function blendWhite(ctx: CanvasRenderingContext2D, coeff: number) {
  if (coeff <= 0) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.globalAlpha = Math.min(1, coeff / 16)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
}
