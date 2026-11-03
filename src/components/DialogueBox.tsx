import { useEffect, useRef, useState } from 'react'
import { drawText, loadFont, wrap, type GameFont } from '../lib/gamefont'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   Emerald's message box, speaking our sentences.

   The frame is dialogue_box.png from the game, cut into a left cap,
   a middle that repeats and a right cap, so it can be any width
   without stretching a single pixel. Text types at the game's own
   pace (one character a frame at "mid" text speed is about 30 a
   second), two lines at a time; a longer message waits on the bobbing
   down-arrow and then turns the page, the way the game does.

   Scale is a whole number, picked by the room it has: 4x on a wide
   screen, 3x on a laptop column, 2x on a phone. On a phone the box
   gets narrower in game pixels instead of smaller pixels, so the
   letters stay as big as they are on a real GBA held at arm's length.
   The text is also in the DOM, visually hidden, so screen readers and
   search get the sentence, not a picture of it.
------------------------------------------------------------------ */

const BOX_H = 42
const CAP = 8
const ARROW_FRAMES = 4
const CPS = 34
const PAGE_HOLD = 1500

const image = (src: string) =>
  new Promise<HTMLImageElement>((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.src = src
  })

let assets: Promise<{ box: HTMLImageElement; arrow: HTMLImageElement; font: GameFont }> | null = null
const load = () =>
  (assets ??= Promise.all([image('/game/dialogue_box.png'), image('/game/down_arrow.png'), loadFont()]).then(
    ([box, arrow, font]) => ({ box, arrow, font }),
  ))

function drawFrame(ctx: CanvasRenderingContext2D, box: HTMLImageElement, W: number) {
  ctx.drawImage(box, 0, 0, CAP, BOX_H, 0, 0, CAP, BOX_H)
  for (let x = CAP; x < W - CAP; x += 16) {
    const w = Math.min(16, W - CAP - x)
    ctx.drawImage(box, 100, 0, w, BOX_H, x, 0, w, BOX_H)
  }
  ctx.drawImage(box, 240 - CAP, 0, CAP, BOX_H, W - CAP, 0, CAP, BOX_H)
}

/** The box with all of `text` in it, at 1x, for compositing into an image (the species card). */
export async function messageBoxCanvas(text: string, W = 240): Promise<HTMLCanvasElement> {
  const { box, font } = await load()
  const c = document.createElement('canvas')
  c.width = W
  c.height = BOX_H
  const ctx = c.getContext('2d')!
  drawFrame(ctx, box, W)
  wrap(font, W >= 240 ? text : text.replace(/\n/g, ' '), W - 22)
    .slice(0, 2)
    .forEach((l, i) => drawText(ctx, font, l, 11, 4 + i * 16))
  return c
}

/** CSS scale and native width for a container `cw` CSS pixels wide. */
function layoutFor(cw: number, maxWidth: number) {
  for (const s of [4, 3]) if (cw >= maxWidth * s) return { s, w: maxWidth }
  return { s: 2, w: Math.max(150, Math.min(maxWidth, Math.floor(cw / 2))) }
}

export function DialogueBox({
  text,
  /** native width in GBA pixels; the box is 240 wide in the game */
  width = 240,
  typing = true,
  className = '',
  onDone,
}: {
  text: string
  width?: number
  typing?: boolean
  className?: string
  onDone?: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dpr = useDpr()
  const [lay, setLay] = useState({ s: 3, w: width })
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const next = layoutFor(e.contentRect.width, width)
      setLay((l) => (l.s === next.s && l.w === next.w ? l : next))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  const k = deviceScale(lay.s, dpr)
  const W = lay.w

  useEffect(() => {
    let raf = 0
    let alive = true
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    load().then(({ box, arrow, font }) => {
      const cv = ref.current
      if (!alive || !cv) return
      cv.width = W * k
      cv.height = BOX_H * k
      const ctx = cv.getContext('2d')!
      ctx.setTransform(k, 0, 0, k, 0, 0)
      ctx.imageSmoothingEnabled = false
      // the game's own line breaks are kept when the box is the game's width
      const lines = wrap(font, W >= 240 ? text : text.replace(/\n/g, ' '), W - 22)
      const pages: string[][] = []
      for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2))
      let page = 0
      let start = performance.now()
      let doneAt = 0
      let reported = false
      const frame = (t: number) => {
        const cur = pages[page]
        const total = cur.reduce((a, l) => a + [...l].length, 0)
        const shown = !typing || reduce ? total : Math.floor(((t - start) / 1000) * CPS)
        ctx.clearRect(0, 0, W, BOX_H)
        drawFrame(ctx, box, W)
        let left = shown
        cur.forEach((l, i) => {
          drawText(ctx, font, l, 11, 4 + i * 16, left)
          left -= [...l].length
        })
        if (shown >= total) {
          doneAt ||= t
          const f = Math.floor(t / 130) % ARROW_FRAMES
          if (page < pages.length - 1) {
            ctx.drawImage(arrow, 0, f * 12, 8, 12, W - 18, 27, 8, 12)
            if (t - doneAt > PAGE_HOLD) {
              page++
              start = t
              doneAt = 0
            }
          } else if (!reported) {
            reported = true
            doneRef.current?.()
          }
          if (page === pages.length - 1 && reported) ctx.drawImage(arrow, 0, f * 12, 8, 12, W - 18, 27, 8, 12)
        }
        raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [text, W, k, typing])

  return (
    <div ref={wrapRef} className={`min-w-0 ${className}`}>
      <canvas
        ref={ref}
        className="px mx-auto block"
        style={{ width: cssPx(W, k, dpr), height: cssPx(BOX_H, k, dpr) }}
        aria-hidden="true"
      />
      <p className="sr-only" aria-live="polite">
        {text.replace(/\n/g, ' ')}
      </p>
    </div>
  )
}
