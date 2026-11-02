import { useEffect, useRef, useState } from 'react'
import { drawText, loadFont, wrap, type GameFont } from '../lib/gamefont'

/* ------------------------------------------------------------------
   Emerald's message box, speaking our sentences.

   The frame is dialogue_box.png from the game, cut into a left cap,
   a middle that repeats and a right cap, so it can be any width
   without stretching a single pixel. Text types at the game's own
   pace (one character a frame at "mid" text speed is about 30 a
   second) and the little down-arrow bobs when it is done, using the
   game's four arrow frames.

   The canvas is drawn at native GBA size and scaled by a whole number
   with nearest-neighbour, so every game pixel is a clean square at
   any size. The text is also in the DOM, visually hidden, so screen
   readers and search get the sentence, not a picture of it.
------------------------------------------------------------------ */

const BOX_H = 48
const CAP = 8
const ARROW_FRAMES = 4

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

export function DialogueBox({
  text,
  /** native width in GBA pixels; the box is 240 wide in the game */
  width = 240,
  scale,
  typing = true,
  className = '',
  onDone,
}: {
  text: string
  width?: number
  scale?: number
  typing?: boolean
  className?: string
  onDone?: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(scale ?? 3)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  // integer scale that fits the container
  useEffect(() => {
    if (scale) return
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      // whole-number scales wherever they fit; on a phone, where only 1x would,
      // fill the width instead -- a slightly uneven pixel beats unreadable text
      const whole = Math.min(4, Math.floor(w / width))
      setS(whole >= 2 ? whole : w / width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [scale, width])

  useEffect(() => {
    let raf = 0
    let alive = true
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    load().then(({ box, arrow, font }) => {
      if (!alive || !ref.current) return
      const ctx = ref.current.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      const lines = wrap(font, text, width - 22).slice(0, 2)
      const total = lines.reduce((a, l) => a + [...l].length, 0)
      const start = performance.now()
      let reported = false
      const frame = (t: number) => {
        const shown = !typing || reduce ? total : Math.floor(((t - start) / 1000) * 34)
        ctx.clearRect(0, 0, width, BOX_H)
        // frame: caps plus a repeated middle column strip
        ctx.drawImage(box, 0, 0, CAP, BOX_H, 0, 0, CAP, BOX_H)
        for (let x = CAP; x < width - CAP; x += 16) {
          const w = Math.min(16, width - CAP - x)
          ctx.drawImage(box, 100, 0, w, BOX_H, x, 0, w, BOX_H)
        }
        ctx.drawImage(box, 240 - CAP, 0, CAP, BOX_H, width - CAP, 0, CAP, BOX_H)
        let left = shown
        lines.forEach((l, i) => {
          drawText(ctx, font, l, 11, 7 + i * 16, left)
          left -= [...l].length
        })
        if (shown >= total) {
          const f = Math.floor(t / 130) % ARROW_FRAMES
          ctx.drawImage(arrow, 0, f * 12, 8, 12, width - 18, 30, 8, 12)
          if (!reported) {
            reported = true
            doneRef.current?.()
          }
        }
        raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [text, width, typing])

  return (
    <div ref={wrapRef} className={`min-w-0 ${className}`}>
      <canvas
        ref={ref}
        width={width}
        height={BOX_H}
        className="px mx-auto block h-auto max-w-full"
        style={{ width: width * s, aspectRatio: `${width} / ${BOX_H}` }}
        aria-hidden="true"
      />
      <p className="sr-only" aria-live="polite">
        {text}
      </p>
    </div>
  )
}
