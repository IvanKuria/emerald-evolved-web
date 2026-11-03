import { useEffect, useMemo, useRef, useState } from 'react'
import { PathBelt } from '../components/PathBelt'
import { Walker, walkerBox, UNDER, type Genes } from './Walker'
import { deviceScale, useDpr } from '../lib/pixels'
import { HUE_STEP } from '../save/layout'
import { displayScale } from '../save/genome'
import './hero.css'

/* ------------------------------------------------------------------
   The arcs.

   frame-site's hero, with Pokémon on the belts instead of photographs:
   two mirrored curves, the top one strung between the upper corners and
   sagging, the bottom one strung between the lower corners and bowing
   up, the wordmark in the lens between them. Same component
   (fancycomponents' MarqueeAlongSvgPath driving CSS `offset-path`), same
   width-derived geometry, same grab-and-flick, same slow-down under the
   pointer.

   What changes is what rides on them. A plate lies along the curve; an
   Eevee stands on it, upright, by its feet (`offset-rotate: 0deg`,
   `offset-anchor` at the feet), faces the way the belt is going and
   puts one foot in front of the other as the belt runs (Walker.tsx).

   THE TWO LINES

   Top: the wild line. Every Eevee on it has its own genes, the way a
   route's wild Eevee do -- a step of hue either way, a size between
   0.94x and 1.1x, and, rarely, a mutation that shows (a black coat, a
   shiny). Their colors are fixed; they are individuals.

   Bottom: the evolved line, which is a gradient in time laid along the
   path. An Eevee's genes are a function of where on the curve it is:
   it enters at the left as a wild one and by the right it is green and
   half again as big, and it keeps changing in between. So the arc reads
   as evolution in progress, and dragging it backwards runs it in
   reverse. Hue moves in the genome's own steps (48 units, one allele
   step), size in whole device pixels.
------------------------------------------------------------------ */

const WIDE = 1400
const NARROW = 390
const SAG_WIDE = 198
const SAG_NARROW = 95
const LIFT_OF_SAG = 70 / 198
const OVERRUN = 0.14

/* Game pixels between two walkers' centers, at 1.0x. Eevee is about
   22 game pixels wide from the side and the evolved line reaches 1.5x,
   so 46 keeps a clear gap at the fat end of the bottom arc. */
const SPACING = 46

/** Game pixels walked per second along the curve. The game's walk is
 *  60; a hero is a stroll, and the feet keep the game's ratio of steps
 *  to distance either way. */
const STROLL = 22

/** Everything the pair of curves needs, from the box: its width, and the window's height. */
export function belt(w: number, h = 900) {
  const t = Math.max(0, Math.min(1, (w - NARROW) / (WIDE - NARROW)))
  /* frame tunes the sag on width alone, for a landscape window. A phone
     held upright has height to spare and nothing to fill it with, so
     there the curves deepen with the window's proportions -- up to
     twice the sag -- and the lens stays a lens instead of a gap. */
  const tall = Math.max(1, Math.min(2, h / w / 1.05))
  const sag = Math.round(Math.max(80, SAG_NARROW + t * (SAG_WIDE - SAG_NARROW)) * tall)
  const lift = Math.round(sag * LIFT_OF_SAG)
  /* CSS pixels per game pixel. Whole numbers, picked by room: an Eevee
     has to read as an Eevee on a phone and not crowd the wordmark on a
     laptop. */
  const kCss = w < 340 ? 2 : w < 1700 ? 3 : 4
  const chord = (1 + 2 * OVERRUN) * w
  const polygon = 0.4 * w + 2 * Math.hypot(0.44 * w, sag + lift)
  const length = (chord + polygon) / 2
  const count = Math.max(4, Math.min(14, Math.floor(length / (SPACING * kCss))))
  const crest = Math.round(0.75 * sag - 0.25 * lift)
  /* A wild Eevee stands 30 game pixels tall at up to 1.1x; an evolved one
     at 1.5x. The top band holds the body above its feet; the bottom band
     holds the curve's rise plus the tallest body standing on it. */
  const wildBody = Math.ceil(30 * 1.12 * kCss)
  const bigBody = Math.ceil(30 * 1.5 * kCss)
  return {
    sag,
    lift,
    kCss,
    count,
    length,
    crest,
    wildBody,
    top: wildBody + crest + UNDER * kCss + 6,
    bottom: crest + bigBody + 14,
    fade: Math.round(wildBody * 0.9),
  }
}

type Geo = ReturnType<typeof belt>

function arcPath(w: number, g: Geo, invert: boolean) {
  const x0 = (-OVERRUN * w).toFixed(1)
  const x3 = ((1 + OVERRUN) * w).toFixed(1)
  const c1 = (0.3 * w).toFixed(1)
  const c2 = (0.7 * w).toFixed(1)
  if (invert) {
    const b = g.bottom
    return `M ${x0} ${b + g.lift} C ${c1} ${b - g.sag}, ${c2} ${b - g.sag}, ${x3} ${b + g.lift}`
  }
  // the top curve is dropped by a body's height, so a body standing at the crest stays on screen
  const o = g.wildBody
  return `M ${x0} ${o - g.lift} C ${c1} ${o + g.sag}, ${c2} ${o + g.sag}, ${x3} ${o - g.lift}`
}

/* A small seeded generator, so the wild line is the same herd on every visit. */
function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* The wild herd: one allele step of hue either way at most, sizes from
   the ROM's formula over a wild Eevee's range, and two that carry a
   visible mutation. Fixed per individual. */
function wildHerd(n: number): Genes[] {
  const r = mulberry(1977)
  // a wild allele is almost always the ancestral one; one in eight is a single step off
  const allele = () => (r() < 0.125 ? (r() < 0.5 ? -1 : 1) : 0)
  return Array.from({ length: n }, (_, i) => {
    const size = 4 * Math.floor(r() * 3) + Math.floor(r() * 8)
    const g: Genes = { coat: 0, hue: (allele() + allele()) * HUE_STEP, scale: displayScale(size) }
    if (i === 3) g.coat = 3 // a black coat, the hack's melanism
    if (i === Math.floor(n * 0.7)) g.shiny = true
    return g
  })
}

/* The evolved line, as a function of place: wild at the left edge of
   the screen, nine allele steps of hue (about 100 degrees, brown to
   leaf green) and 1.5x by the right. The ends of the path are off
   screen, so the visible stretch is mapped to 0..1. */
const evolvedAt = (t: number): Genes => {
  const p = Math.max(0, Math.min(1, (t - OVERRUN / (1 + 2 * OVERRUN) - 0.02) / 0.76))
  return { coat: 0, hue: Math.round(p * 9) * HUE_STEP, scale: 1 + 0.5 * p }
}

export function Arc({ invert = false }: { invert?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(900)
  const dpr = useDpr()
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      if (!e) return
      setWidth(e.contentRect.width)
      setHeight(innerHeight)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    setHeight(innerHeight)
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const on = () => setReduce(mq.matches)
    mq.addEventListener('change', on)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', on)
    }
  }, [])

  const g = belt(width, height)
  const k = deviceScale(g.kCss, dpr)
  const box = walkerBox(k)
  const herd = useMemo(() => wildHerd(g.count), [g.count])
  const wildFns = useMemo(() => herd.map((h) => () => h), [herd])
  const band = invert ? g.bottom : g.top
  /* the walker's feet ride the curve: the bottom of its box less the room under the feet */
  const anchor: [number, number] = [box.w / dpr / 2, (box.h - UNDER * k) / dpr]

  return (
    <div
      className={invert ? 'arc arc--up' : 'arc'}
      ref={wrapRef}
      style={{ height: band, '--arc-fade': `${g.fade}px` } as React.CSSProperties}
    >
      {width > 0 && (
        <PathBelt
          path={arcPath(width, g, invert)}
          count={g.count}
          /* a steady stroll at this size; the two curves run opposite ways, so the pair reads as one
             turning mechanism, and the evolved line runs left to right, the way the page reads */
          speed={reduce ? 0 : STROLL * g.kCss}
          direction={invert ? 1 : -1}
          slowOnHover={0.22}
          anchor={anchor}
          className="arc__track"
          itemClassName="arc__walker"
          itemStyle={(i) => ({ width: box.w / dpr, animationDelay: `${120 + i * 60}ms` })}
        >
          {(i) => <Walker index={i} k={k} kCss={g.kCss} genes={invert ? evolvedAt : wildFns[i]} phase={i * 7} />}
        </PathBelt>
      )}
    </div>
  )
}
