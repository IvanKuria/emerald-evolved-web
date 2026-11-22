import { useEffect, useRef, useState } from 'react'
import { Rise } from '../components/Rise'
import { DialogueBox } from '../components/DialogueBox'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'
import { ambientRate, useReducedMotion } from '../lib/motion'

/* ------------------------------------------------------------------
   Cross-breeding (v1.1.0).

   Three real hybrids from the game, drawn from its own 64x64 front
   sprites at a whole number of screen pixels per game pixel, each with
   the TYPE row cut from its summary page. The copy only says what the
   ROM does (GAME_REPORT): body from the mother, colours from the father
   and, for some pairs, one of his parts; first-cross sons are sterile;
   wild hybrids exist; a line can carry three species. Under them,
   Professor Birch's real Breeder-start line, typed in the message box.
------------------------------------------------------------------ */

type Type = 'fire' | 'grass' | 'electr'
const HYBRIDS: { id: string; name: string; note: string; types: Type[] }[] = [
  { id: 'hybrid_pika_x_char', name: 'Pikachu × Charmander', note: 'Pikachu mom, Charmander dad: his colours and his flame.', types: ['electr', 'fire'] },
  { id: 'hybrid_char_x_bulb', name: 'Charmander × Bulbasaur', note: 'Charmander mom, Bulbasaur dad: his colours and his bulb.', types: ['fire', 'grass'] },
  { id: 'hybrid_three', name: 'Three species', note: 'Charmander body, Bulbasaur’s bulb, Pikachu’s ears and colours.', types: ['fire', 'grass', 'electr'] },
]

const BIRCH =
  'Oh, one more thing!\nDo you want to skip ahead and start\nat the POKéMON DAY CARE, so you can\nbreed POKéMON right away?'

export function CrossBreed() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const on = () => setWide(innerWidth >= 700)
    on()
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])

  // Birch starts talking when you reach him, not while you're still up in the hero
  const say = useRef<HTMLDivElement>(null)
  const [talking, setTalking] = useState(false)
  useEffect(() => {
    const el = say.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setTalking(true), io.disconnect()), { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section id="crossbreed" className="xb" aria-labelledby="xb-head">
      <Rise className="text-center">
        <p className="xb__eyebrow">New in v1.1.0: cross-breeding</p>
        <h2 id="xb-head" className="display text-hero">
          Two species, one baby.
        </h2>
      </Rise>

      <div className="xb__row">
        {HYBRIDS.map((h, i) => (
          <Rise key={h.id} className="xb__mon" delay={i * 90}>
            <Hybrid id={h.id} label={h.name} scale={wide ? 3 : 2} phase={i} />
            <TypeRow types={h.types} scale={wide ? 2 : 1} />
            <p className="xb__name">{h.name}</p>
            <p className="xb__note">{h.note}</p>
          </Rise>
        ))}
      </div>

      <Rise className="xb__copy">
        <p>Leave almost any two species at the Day Care and they can have an egg.</p>
        <p>The baby gets its mother’s body. From its father it gets his colours, his type and his moves, and for some pairs one of his parts.</p>
        <p>A first-cross hybrid boy can never breed. His sisters sometimes can.</p>
        <p>Some wild Pokémon are hybrids already. Catch one and see what it is.</p>
        <p>Keep breeding and one line can end up three species, with three types on its summary.</p>
      </Rise>

      <div ref={say} className="xb__birch">
        <p className="xb__birch-head">New game? Professor Birch can start you at the Day Care.</p>
        {talking ? <DialogueBox text={BIRCH} width={240} className="w-full max-w-[740px]" /> : <div className="xb__birch-space" />}
      </div>
    </section>
  )
}

/* One hybrid: the front sprite, and every few seconds its second frame, the way it moves in the summary. */
function Hybrid({ id, label, scale, phase }: { id: string; label: string; scale: number; phase: number }) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  const size = cssPx(64, k, dpr)
  const reduce = useReducedMotion()
  const [alt, setAlt] = useState(false)
  useEffect(() => {
    const rate = ambientRate(reduce)
    let t = 0
    const tick = () => {
      setAlt(true)
      t = window.setTimeout(() => {
        setAlt(false)
        t = window.setTimeout(tick, (2600 + phase * 700) / rate)
      }, 520 / rate)
    }
    t = window.setTimeout(tick, (900 + phase * 600) / rate)
    return () => clearTimeout(t)
  }, [reduce, phase])

  // touch it and it moves for you, whatever the motion setting
  const poke = () => {
    setAlt(true)
    window.setTimeout(() => setAlt(false), 420)
  }

  return (
    <span className="xb__sprite" role="img" aria-label={label} style={{ width: size, height: size }} onPointerEnter={poke} onClick={poke} data-alt={alt}>
      <img src={`/crossbreed/${id}.png`} alt="" className="px" style={{ width: size, height: size, opacity: alt ? 0 : 1 }} />
      <img src={`/crossbreed/${id}_2.png`} alt="" className="px" style={{ width: size, height: size, opacity: alt ? 1 : 0 }} />
    </span>
  )
}

/* The summary's TYPE badges, cut from the game's own summary screen (32x14 each). */
function TypeRow({ types, scale }: { types: Type[]; scale: number }) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  return (
    <span className="xb__types" aria-label={`Type: ${types.map((t) => t.toUpperCase()).join(' / ')}`}>
      {types.map((t) => (
        <img key={t} src={`/crossbreed/type_${t}.png`} alt="" className="px" style={{ width: cssPx(32, k, dpr), height: cssPx(14, k, dpr) }} />
      ))}
    </span>
  )
}
