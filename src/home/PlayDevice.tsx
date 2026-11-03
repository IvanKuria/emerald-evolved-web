import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Rise } from '../components/Rise'
import { messageBoxCanvas } from '../components/DialogueBox'
import { GameMenu } from '../components/GameMenu'
import { handRom } from '../lib/rom'
import { cssPx, fitScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   Play it in your browser.

   A screen, in a plain ink body, showing the game running. It is also
   where the ROM goes: drag your Emerald onto it and the screen answers
   in the game's own message box, let go and you are on /play with it
   already checking. The file is handed over in memory (lib/rom.ts
   handRom), never stored, never sent, exactly as on /play itself.

   The body is deliberately not a drawing of a Game Boy: a rounded ink
   bezel and the screen at a whole number of pixels per game pixel.
------------------------------------------------------------------ */

/* PLACEHOLDER: the looping capture of the real game booting is not in yet. Until it is, the
   screen shows the game's message box on black instead. When the capture lands, put it at
   public/home/boot-loop.mp4 (H.264, 240x160 or an exact multiple, a few seconds, seamless) and
   set this to its path. Nothing else changes. */
const BOOT_LOOP: string | null = null

export function PlayDevice() {
  const navigate = useNavigate()
  const dpr = useDpr()
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [k, setK] = useState(() => Math.round(3 * dpr))
  const [over, setOver] = useState(false)
  const [wideMenu, setWideMenu] = useState(true)
  useEffect(() => {
    const on = () => setWideMenu(innerWidth >= 700)
    on()
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setK(fitScale(e.contentRect.width, 240, dpr, Math.round(3 * dpr))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [dpr])

  const go = (f: File | 'test' | undefined | null) => {
    if (!f) return
    handRom(f)
    navigate('/play')
  }

  const w = cssPx(240, k, dpr)
  const h = cssPx(160, k, dpr)

  return (
    <section id="play" className="play" aria-labelledby="play-head">
      <Rise className="text-center">
        <h2 id="play-head" className="display text-hero">
          Play it in your browser.
        </h2>
      </Rise>

      <Rise delay={120} className="play__wrap">
        <div ref={box} className="play__fit">
          <div
            className="play__device"
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              go(e.dataTransfer.files?.[0])
            }}
          >
            <div className="play__screen" style={{ width: w, height: h }}>
              {BOOT_LOOP ? (
                <video className="px block h-full w-full" src={BOOT_LOOP} autoPlay muted loop playsInline aria-label="Emerald Evolved starting up" />
              ) : (
                <Placeholder k={k} text={over ? 'Let go, and the game will check it.' : 'Drop your POKéMON EMERALD here.'} />
              )}
            </div>
          </div>
        </div>
      </Rise>

      <div className="play__actions">
        <GameMenu
          label="Start playing"
          scale={wideMenu ? 3 : 2}
          items={[
            { label: 'CHOOSE YOUR ROM', onSelect: () => input.current?.click() },
            { label: 'TEST CARTRIDGE', onSelect: () => go('test') },
          ]}
        />
        <p className="text-meta text-ash">Your Emerald never leaves this tab.</p>
        <input ref={input} type="file" accept=".gba,.bin,application/octet-stream" className="sr-only" onChange={(e) => go(e.target.files?.[0])} />
      </div>
    </section>
  )
}

/* PLACEHOLDER screen (see BOOT_LOOP): black, with the field message box along the bottom the way
   the game draws it (240 wide, at the screen's own pixel scale), typing at the game's pace. */
function Placeholder({ k, text }: { k: number; text: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    cv.width = 240 * k
    cv.height = 160 * k
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    let n = 0
    let alive = true
    let timer = 0
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const chars = [...text]
    const draw = async () => {
      const box = await messageBoxCanvas(chars.slice(0, n).join(''), 240)
      if (!alive) return
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.drawImage(box, 0, 0, 240, 42, 0, (160 - 44) * k, 240 * k, 42 * k)
      if (n < chars.length) {
        n = reduce ? chars.length : n + 1
        timer = window.setTimeout(draw, 1000 / 34)
      }
    }
    draw()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [k, text])
  return <canvas ref={ref} className="px block h-full w-full" aria-hidden="true" />
}
