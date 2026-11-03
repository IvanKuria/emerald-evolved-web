import { useEffect, useMemo, useRef } from 'react'
import { usePinnedProgress } from './pin'
import { frameFor, loadFollower, loadShadow, paintFollower, feetOf, type Facing } from '../lib/follower'
import { GBA_HZ } from './hatch'
import { deviceScale, useBoxWidth, useDpr } from '../lib/pixels'
import { HUE_STEP } from '../save/layout'
import { DAYCARE_LINE, TIER_COLOUR, type Score } from '../sim/daycare'
import { DialogueBox } from '../components/DialogueBox'
import { HpBar } from '../components/HpBar'
import TextType from '../components/TextType'
import CountUp from '../components/CountUp'

/* ------------------------------------------------------------------
   Until they can't.

   Pinned, and driven by the scroll. A river of Emerald's own animated
   ocean (metatile 0x170, its eight frames swapped every 16 game frames,
   as tileset_anims.c does) runs down the middle, and an Eevee
   population lives on both banks. As you scroll, the two halves walk
   away from the water and away from each other: the left bank's coats
   step toward green and its Eevee get bigger, and on the right a black
   coat appears and spreads one Eevee at a time.

   Under it, the Day Care man gives his verdict on one Eevee from each
   side, in his own four lines (gDaycareText_*, src/strings.c), typed in
   the game's message box as you reach each one, with the score's own
   HP colors draining 70, 50, 20, 0. The last line is the one that in
   Emerald means two Pokémon can't breed: "The two prefer to play with
   other POKéMON than each other." Here it means there are two species,
   and the count turns over.

   Scrolling back runs all of it backwards, the walkers included: they
   face the way they are going and their feet step with the distance.
------------------------------------------------------------------ */

const TIERS: [number, Score][] = [
  [0, 70],
  [0.24, 50],
  [0.5, 20],
  [0.78, 0],
]
const FILL: Record<Score, number> = { 70: 1, 50: 0.48, 20: 0.17, 0: 0 }
const RIVER = 3 // metatiles wide
const SPLIT_AT = 0.86

interface Pop {
  x0: number
  far: number
  y: number
  side: -1 | 1
  order: number
  facing: Facing
  walked: number
  lastX: number
  still: number
}

let water: Promise<HTMLImageElement> | null = null
const loadWater = () =>
  (water ??= new Promise((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.src = '/game/water.png'
  }))

export function Split() {
  const [ref, progress] = usePinnedProgress(3.2)
  const dpr = useDpr()
  const [boxRef, wide] = useBoxWidth<HTMLDivElement>(1200)
  // measured on the column under the stage (at most 1000 wide), so the thresholds are the column's
  const kCss = wide < 600 ? 2 : wide < 900 ? 3 : 4
  const W = Math.min(240, Math.floor((wide - 8) / kCss))
  const H = wide < 600 ? 116 : 92
  const k = deviceScale(kCss, dpr)
  const per = wide < 600 ? 4 : 6
  const canvas = useRef<HTMLCanvasElement>(null)
  const target = useRef(0)
  target.current = progress

  const tier: Score = TIERS.reduce<Score>((s, [at, sc]) => (progress >= at ? sc : s), 70)
  const split = progress >= SPLIT_AT

  /* Where everybody starts: close to the water on their own side, spread down the bank. */
  /* Where everybody is: at the start they crowd the water on their own side; by the end each has
     walked out to its own spot across its bank. Spots are a fixed scatter, so the herd keeps its
     shape as it opens out. */
  const pops = useMemo<Pop[]>(() => {
    const out: Pop[] = []
    const bank = W / 2 - RIVER * 8 - 30
    for (const side of [-1, 1] as const)
      for (let i = 0; i < per; i++) {
        const r = (n: number) => (((i + 1) * 9301 + n * 49297 + (side + 2) * 233) % 1000) / 1000
        const y = 26 + Math.round(((H - 32) * (i + 0.2 + r(1) * 0.6)) / per)
        const near = RIVER * 8 + 10 + Math.round(r(2) * 10)
        const far = RIVER * 8 + 14 + Math.round(((i * 0.618 + r(3) * 0.4) % 1) * bank)
        const x0 = W / 2 + side * near
        out.push({ x0, far: W / 2 + side * far, y, side, order: i, facing: side < 0 ? 'west' : 'east', walked: 0, lastX: x0, still: 0 })
      }
    return out
  }, [per, W, H])

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    let raf = 0
    let alive = true
    let shown = target.current
    let hopAt = 0
    let wasSplit = false
    Promise.all([loadFollower(), loadShadow(), loadWater()]).then(([sheet, shadow, wat]) => {
      if (!alive) return
      cv.width = W * k
      cv.height = H * k
      const ctx = cv.getContext('2d')!
      const feet = feetOf(sheet)
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      const frame = (now: number) => {
        // the stage follows the scroll on the page's ease, so a flick reads as a walk, not a jump
        shown += (target.current - shown) * (reduce ? 1 : 0.09)
        const p = shown
        const isSplit = p >= SPLIT_AT
        if (isSplit && !wasSplit) hopAt = now
        wasSplit = isSplit
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, cv.width, cv.height)
        ctx.setTransform(k, 0, 0, k, 0, 0)
        ctx.imageSmoothingEnabled = false
        drawRiver(ctx, wat, W, H, now)
        // draw back to front by y, so a walker lower on the bank stands in front
        const order = [...pops].sort((a, b) => a.y - b.y)
        for (const m of order) {
          const x = m.x0 + (m.far - m.x0) * ease(Math.min(1, p / 0.85))
          const dx = x - m.lastX
          m.lastX = x
          if (Math.abs(dx) > 0.02) {
            m.facing = dx < 0 ? 'west' : 'east'
            m.walked += Math.abs(dx)
            m.still = now
          } else if (now - m.still > 700) m.facing = 'south'
          const moving = now - m.still < 120
          const look = lookOf(m, p)
          const { index, flip } = frameFor(m.facing, moving ? m.walked : null)
          // the moment they become two species, both banks hop once, a wave out from the river
          const t = (now - hopAt) / 1000 - m.order * 0.06
          const hop = hopAt && t > 0 && t < 0.25 ? Math.round(Math.sin((t / 0.25) * Math.PI) * 4) : 0
          const s = look.scale
          const top = Math.round(m.y - (feet + 1) * s) - hop
          const left = Math.round(x - 16 * s)
          ctx.globalAlpha = 0.2
          ctx.drawImage(shadow, Math.round(x - 8 * s), Math.round(m.y - 5 * s), 16 * s, 8 * s)
          ctx.globalAlpha = 1
          const sp = paintFollower(sheet, index, look)
          if (flip) {
            ctx.save()
            ctx.translate(left + 32 * s, top)
            ctx.scale(-1, 1)
            ctx.drawImage(sp, 0, 0, 32 * s, 32 * s)
            ctx.restore()
          } else ctx.drawImage(sp, left, top, 32 * s, 32 * s)
        }
        raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [pops, W, H, k])

  return (
    // React owns this wrapper; ScrollTrigger wraps the section inside it in its pin-spacer, so
    // unmounting removes a node React made rather than one GSAP moved
    <div>
    <section id="split" ref={ref as React.RefObject<HTMLElement>} className="split" aria-labelledby="split-head">
      <h2 id="split-head" className="display text-hero text-center">
        Until they can’t.
      </h2>

      <canvas
        ref={canvas}
        className="px split__stage"
        style={{ width: (W * k) / dpr, height: (H * k) / dpr }}
        aria-label="Two groups of Eevee on either side of a river, drifting apart in color and size"
        role="img"
      />

      <div className="split__talk" ref={boxRef}>
        <TextType
          key={tier}
          as="div"
          text={DAYCARE_LINE[tier]}
          typingSpeed={Math.round(1000 / 34)}
          initialDelay={120}
          loop={false}
          showCursor={false}
          className="split__box"
          renderText={(typed) => <DialogueBox text={DAYCARE_LINE[tier]} chars={[...typed].length} width={wide < 600 ? 200 : 240} />}
        />
        <div className="split__read">
          <HpBar value={FILL[tier]} colour={TIER_COLOUR[tier]} hpLabel={false} scale={wide < 600 ? 2 : 3} label="How well one Eevee from each side would get along" />
          <p className="display split__count tc" data-split={split}>
            <CountUp key={split ? 'two' : 'one'} to={split ? 2 : 1} from={split ? 1 : 1} duration={0.4} /> species
          </p>
        </div>
      </div>
    </section>
    </div>
  )
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 2

/* The genes on each bank as the scroll goes. Left: the hue walks toward green in allele steps
   (48 units), each Eevee a little behind or ahead of its neighbours. Right: a black coat (the
   hack's melanism) spreads through the bank one Eevee at a time. Drawn at 1.0x: here the colors
   carry it, and a fractional size would cost the whole-pixel rule. */
function lookOf(m: Pop, p: number) {
  if (m.side < 0) {
    const steps = Math.round(Math.max(0, Math.min(1, (p - 0.04 * m.order) / 0.72)) * 8)
    return { coat: 0, hue: steps * HUE_STEP, scale: 1 }
  }
  const black = p > 0.28 + m.order * 0.075
  return { coat: black ? 3 : 0, hue: 0, scale: 1 }
}

/** The river: metatile 0x170 tiled, the frame chosen by the game's clock (8 frames, 16 game frames each). */
function drawRiver(ctx: CanvasRenderingContext2D, wat: HTMLImageElement, W: number, H: number, now: number) {
  const f = Math.floor(((now / 1000) * GBA_HZ) / 16) % 8
  const left = W / 2 - RIVER * 8
  for (let y = 0; y < H; y += 16) {
    const h = Math.min(16, H - y)
    for (let c = 0; c < RIVER; c++) ctx.drawImage(wat, 0, f * 16, 16, h, left + c * 16, y, 16, h)
  }
}
