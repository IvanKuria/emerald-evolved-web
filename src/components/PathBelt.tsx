import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

/* ------------------------------------------------------------------
   A belt of items running along an SVG path: the job frame-site's
   MarqueeAlongSvgPath does, rebuilt for smoothness after measuring it.

   What the measurement found (scripts/measure-belts.mjs): cruising was
   fine, but drag and release were not. The fancy component keeps drag
   velocity in "pixels per frame" and decays it by a constant factor per
   frame, so a release flung the belt at up to 24 px a frame and the
   glide back depended on the frame rate (jerk spiking to 8 px a frame
   under a throttled CPU). Walkers also need to know their facing
   without flipping on velocity noise.

   So, one rAF loop and one state: distance along the path `s` and its
   velocity `v`, in CSS pixels and pixels per second.

   - Cruise, hover and release all ease the velocity toward a target
     with first-order smoothing, v += (target - v)(1 - e^(-k dt)): frame-rate
     independent, no overshoot, and the ease-out feel of the site's
     curve. A release glides back to cruise in about a second.
   - Dragging moves `s` with the pointer exactly, and measures the
     velocity it leaves with (smoothed, clamped), so letting go carries
     on at the speed you were moving and settles from there.
   - Positions come from an arc-length lookup table sampled once per
     resize with getPointAtLength, interpolated, and written as a
     fractional translate3d. Nothing is rounded to a pixel grid; the
     pixel art stays crisp because its scale is whole and it is drawn
     `pixelated`, not because of where it sits.
   - Facing has hysteresis: it turns only after the belt has run the
     other way, faster than 8 px/s, for 120 ms.
   - The loop stops while the belt is off screen.
------------------------------------------------------------------ */

export interface BeltFrame {
  /** where the item is on the path, 0..1 */
  t: number
  /** belt velocity along the path, px/s, + toward the path's end */
  v: number
  /** total distance the belt has run, px, never decreasing */
  walked: number
  /** +1 facing the path's end, -1 facing its start, with hysteresis */
  facing: 1 | -1
}
type Draw = (f: BeltFrame) => void

const BeltContext = createContext<{ register: (i: number, d: Draw) => () => void } | null>(null)

/** Inside a belt item: get called every frame with where the item is and how the belt moves. */
export function useBeltFrame(index: number, draw: Draw) {
  const ctx = useContext(BeltContext)
  useEffect(() => ctx?.register(index, draw), [ctx, index, draw])
}

const SMOOTH = 4 // 1/s: 98% of the way to the target velocity in about a second
const FLING = 1400 // px/s: the fastest a release can throw the belt
const TURN = { speed: 8, ms: 120 }

export function PathBelt({
  path,
  count,
  speed,
  direction = 1,
  slowOnHover = 0.22,
  anchor,
  className,
  itemClassName,
  itemStyle,
  children,
}: {
  path: string
  count: number
  /** cruise speed, px/s */
  speed: number
  direction?: 1 | -1
  slowOnHover?: number
  /** the point of each item that rides the path, in CSS px from its top-left */
  anchor: [number, number]
  className?: string
  itemClassName?: string
  itemStyle?: (i: number) => React.CSSProperties
  children: (i: number) => ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLDivElement | null)[]>([])
  const draws = useRef(new Map<number, Draw>())
  const ctx = useRef({
    register: (i: number, d: Draw) => {
      draws.current.set(i, d)
      return () => void draws.current.delete(i)
    },
  })
  const live = useRef({ hovered: 0, dragging: false, lastX: 0, lastT: 0, dragV: 0, pendingDs: 0, moved: 0 })
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  // the lookup table: the path sampled every 2 px of its length, once
  const lut = useRef<{ L: number; pts: Float32Array; n: number }>({ L: 1, pts: new Float32Array(4), n: 2 })
  useLayoutEffect(() => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    el.setAttribute('d', path)
    const L = el.getTotalLength()
    const n = Math.max(2, Math.ceil(L / 2) + 1)
    const pts = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      const p = el.getPointAtLength((i / (n - 1)) * L)
      pts[i * 2] = p.x
      pts[i * 2 + 1] = p.y
    }
    lut.current = { L, pts, n }
  }, [path])

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let s = 0
    let v = reduce ? 0 : direction * speed
    let walked = 0
    let facing: 1 | -1 = direction
    let against = 0
    let last = 0
    let raf = 0
    let onScreen = true

    const place = () => {
      const { L, pts, n } = lut.current
      const [ax, ay] = anchorRef.current
      for (let i = 0; i < count; i++) {
        const d = (((s + (i * L) / count) % L) + L) % L
        const f = (d / L) * (n - 1)
        const j = Math.min(n - 2, Math.floor(f))
        const u = f - j
        const x = pts[j * 2] + (pts[j * 2 + 2] - pts[j * 2]) * u
        const y = pts[j * 2 + 1] + (pts[j * 2 + 3] - pts[j * 2 + 1]) * u
        const el = items.current[i]
        if (el) el.style.transform = `translate3d(${(x - ax).toFixed(2)}px, ${(y - ay).toFixed(2)}px, 0)`
        draws.current.get(i)?.({ t: d / L, v, walked, facing })
      }
    }

    const frame = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      const st = live.current
      let ds: number
      if (st.dragging) {
        ds = st.pendingDs
        st.pendingDs = 0
        // held still, the measured velocity dies away, so a slow release doesn't fling
        if (ds === 0) st.dragV *= Math.exp(-dt / 0.08)
        v = st.dragV
      } else {
        const target = reduce ? 0 : direction * speed * (st.hovered > 0 ? slowOnHover : 1)
        v += (target - v) * (1 - Math.exp(-SMOOTH * dt))
        ds = v * dt
      }
      s += ds
      walked += Math.abs(ds)
      // facing turns only on a deliberate change of direction
      if (Math.sign(v) === -facing && Math.abs(v) > TURN.speed) {
        against += dt * 1000
        if (against > TURN.ms) (facing = -facing as 1 | -1), (against = 0)
      } else against = 0
      place()
      if (onScreen) raf = requestAnimationFrame(frame)
    }

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      cancelAnimationFrame(raf)
      if (onScreen) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    })
    if (host.current) io.observe(host.current)
    place()
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [count, speed, direction, slowOnHover])

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    Object.assign(live.current, { dragging: true, lastX: e.clientX, lastT: e.timeStamp, dragV: 0, pendingDs: 0, moved: 0 })
  }
  const move = (e: React.PointerEvent) => {
    const st = live.current
    if (!st.dragging) return
    const dx = e.clientX - st.lastX
    const dt = Math.max(1, e.timeStamp - st.lastT) / 1000
    st.pendingDs += dx
    st.moved += Math.abs(dx)
    // the velocity a release leaves with: the drag's own, smoothed over the last ~60 ms
    const inst = Math.max(-FLING, Math.min(FLING, dx / dt))
    st.dragV += (inst - st.dragV) * (1 - Math.exp(-dt / 0.06))
    st.lastX = e.clientX
    st.lastT = e.timeStamp
  }
  const up = (e: React.PointerEvent) => {
    const st = live.current
    if (!st.dragging) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    // a pause before letting go means no fling
    if (e.timeStamp - st.lastT > 90) st.dragV = 0
    st.dragging = false
  }

  return (
    <BeltContext.Provider value={ctx.current}>
      <div
        ref={host}
        className={className}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        // a drag that ends on a card is a drag, not a click on the card
        onClickCapture={(e) => {
          if (live.current.moved > 6) e.preventDefault(), e.stopPropagation()
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            ref={(el) => void (items.current[i] = el)}
            className={itemClassName}
            style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform', ...itemStyle?.(i) }}
            onPointerEnter={() => void live.current.hovered++}
            onPointerLeave={() => void (live.current.hovered = Math.max(0, live.current.hovered - 1))}
            aria-hidden={i > 0 ? true : undefined}
          >
            {children(i)}
          </div>
        ))}
      </div>
    </BeltContext.Provider>
  )
}
