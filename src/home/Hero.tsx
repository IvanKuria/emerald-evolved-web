import { Link } from 'react-router'
import { Arc } from './Arcs'
import { Wordmark } from './Wordmark'
import { GitHubStar } from '../components/GitHubStar'
import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------
   The hero.

   frame's composition, taken whole: two mirrored arcs, the claim in the
   lens of empty space between them. On frame the belts carry footage
   because footage is the product. Here they carry Eevee, because the
   population is the product: the top arc is a wild herd, every one a
   little different; the bottom arc is a line evolving as it walks.

   Both curves are grabbable and slow under the pointer, so the first
   thing a visitor learns is that the page answers to them. The wordmark
   hatches when you touch it.

   One sentence and one button. Everything this page could explain is on
   How it works; this is the invitation.
------------------------------------------------------------------ */

export function Hero() {
  const [egg, setEgg] = useState(3)
  useEffect(() => {
    const on = () => setEgg(innerWidth < 700 ? 2 : 3)
    on()
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])

  return (
    <section className="hero" aria-labelledby="hero-title">
      <Arc />

      <div className="hero__lens">
        <h1 id="hero-title" className="m-0">
          <Wordmark eggScale={egg} />
        </h1>
        <p className="hero__line">Pokémon that actually evolve.</p>
        <div className="hero__actions">
          <Link to="/play" className="btn btn-ink">
            Play
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <GitHubStar />
        </div>
        <p className="hero__foot">In your browser. Bring your own Emerald.</p>
      </div>

      <Arc invert />
    </section>
  )
}
