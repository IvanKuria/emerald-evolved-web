import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { GameMenu } from '../components/GameMenu'
import { SpeciesCard, type CardData } from '../components/SpeciesCard'
import { drawFront, FRONT_FRAMES, loadFront } from '../lib/front'
import { GBA_HZ } from '../home/hatch'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'
import { hueOf, scaleOf, type Mon } from './line'

/* ------------------------------------------------------------------
   The payoff. The page goes white the way the hatch screen does (a
   white blend at the game's coefficients: up in steps of 3, back down
   from 16), and the new species is there when it clears, doing its
   front animation. Then: name it, in the game's ten letters, and the
   card it would get in the registry. This one is a preview, and says
   so: the registry only takes Pokémon bred in the game.
------------------------------------------------------------------ */

export function Reveal({
  mum,
  gen,
  name,
  card,
  onAgain,
}: {
  mum: Mon
  gen: number
  name: (n: string) => { ok: true; value: string } | { ok: false; error: string }
  card: (name: string) => CardData
  onAgain: () => void
}) {
  const dpr = useDpr()
  const k = deviceScale(3, dpr)
  const ref = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'reveal' | 'naming' | 'card'>('reveal')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [named, setNamed] = useState('')

  // braces, not an arrow's value: scrollIntoView returns a promise in current Chrome, and React would
  // call that as the effect's cleanup
  useEffect(() => {
    host.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    let raf = 0
    let alive = true
    loadFront().then((front) => {
      if (!alive) return
      cv.width = 96 * k
      cv.height = 96 * k
      const ctx = cv.getContext('2d')!
      let t0 = performance.now()
      const s = Math.min(2, scaleOf(mum)) * 0.72
      const draw = (now: number) => {
        // the flash: 0 -> 16 in steps of 3 over ~6 frames, hold, then 16 -> 0 (egg_hatch.c's fades)
        const f = ((now - t0) / 1000) * GBA_HZ
        const white = f < 6 ? Math.min(16, Math.floor(f) * 3) : f < 20 ? 16 : Math.max(0, 16 - Math.floor((f - 20) / 2) * 3)
        host.current?.style.setProperty('--white', String(white / 16))
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, cv.width, cv.height)
        ctx.setTransform(k, 0, 0, k, 0, 0)
        const anim = f - 34
        drawFront(ctx, front, { coat: 0, hue: hueOf(mum) }, 48, 50, anim >= 0 && anim < FRONT_FRAMES ? anim : null, s)
        if (white > 0) {
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.globalCompositeOperation = 'source-atop'
          ctx.globalAlpha = white / 16
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, cv.width, cv.height)
          ctx.restore()
        }
        // replay the front animation every few seconds, as a summary page does when revisited
        if (anim > FRONT_FRAMES + 200) t0 = now - (34 / GBA_HZ) * 1000 // skip the flash on the replay
        raf = requestAnimationFrame(draw)
      }
      raf = requestAnimationFrame(draw)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [mum, k])

  const submit = () => {
    const v = name(text)
    if (!v.ok) return setError(v.error)
    setNamed(v.value)
    setStep('card')
  }

  const u = cssPx(1, k, dpr)
  return (
    <div ref={host} className="reveal" aria-live="polite">
      <div className="reveal__flash" aria-hidden="true" />
      {step !== 'card' && (
        <>
          <canvas ref={ref} className="px reveal__mon" style={{ width: 96 * u, height: 96 * u }} role="img" aria-label="Your new species" />
          <p className="display reveal__title">Real evolution.</p>
          <p className="text-lead text-ink-soft">It can’t breed with wild Eevee any more. Generation {gen}.</p>
        </>
      )}

      {step === 'reveal' && (
        <div className="mt-6">
          <GameMenu label="Your new species" items={[{ label: 'NAME IT', onSelect: () => setStep('naming') }, { label: 'START OVER', onSelect: onAgain }]} scale={3} />
        </div>
      )}

      {step === 'naming' && (
        <form
          className="reveal__name game-window"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label className="text-meta font-semibold text-ink-soft" htmlFor="species-name">
            Its name (up to 10 letters)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="species-name"
              autoFocus
              maxLength={10}
              value={text}
              onChange={(e) => (setText(e.target.value), setError(''))}
              className="reveal__input"
              autoComplete="off"
            />
            <button className="btn btn-ink btn-sm" type="submit">
              Name it
            </button>
          </div>
          {error && <p className="mt-2 text-meta text-refuse-ink">{error}</p>}
        </form>
      )}

      {step === 'card' && (
        <div className="reveal__card">
          <SpeciesCard card={card(named)} size="hero" link={false} />
          <p className="mt-6 text-body text-ink-soft">
            That’s a preview. In the game, the same breeding makes a real one, and its card goes in the registry with your trainer name on it.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/play" className="btn btn-ink">
              Do it for real
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <button className="btn btn-quiet" onClick={onAgain}>
              Breed another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
