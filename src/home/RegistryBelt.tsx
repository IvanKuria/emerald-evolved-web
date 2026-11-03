import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SimpleMarquee from '../components/fancy/simple-marquee'
import { SpeciesCard } from '../components/SpeciesCard'
import { Rise } from '../components/Rise'
import { fetchListing, type Listing } from '../registry/client'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   Name yours.

   The registry's newest cards on a belt (fancycomponents' SimpleMarquee,
   frame's other marquee): real species that players bred and named,
   grabbable, slowing under the pointer.

   It never fakes one. With the registry closed or empty there is no
   belt, only the egg that the first card will replace and the line
   saying so. With one or two cards they sit still, side by side: a
   belt of two repeating itself would look like more than there is.
------------------------------------------------------------------ */

export function RegistryBelt() {
  const [listing, setListing] = useState<Listing | null | 'loading'>('loading')
  useEffect(() => {
    let alive = true
    fetchListing().then((l) => alive && setListing(l))
    return () => {
      alive = false
    }
  }, [])

  const cards = listing && listing !== 'loading' ? listing.cards : []
  const reduce = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <section id="names" className="names" aria-labelledby="names-head">
      <Rise className="text-center">
        <h2 id="names-head" className="display text-hero">
          Name yours.
        </h2>
      </Rise>

      {cards.length >= 3 ? (
        <div className="names__belt">
          <SimpleMarquee baseVelocity={reduce ? 0 : 18} direction="left" repeat={3} draggable slowdownOnHover slowDownFactor={0.2} dragSensitivity={0.12}>
            <div className="names__row">
              {cards.map((c) => (
                <div key={c.id} className="names__card">
                  <SpeciesCard card={c} />
                </div>
              ))}
            </div>
          </SimpleMarquee>
        </div>
      ) : cards.length > 0 ? (
        <Rise className="names__few">
          {cards.map((c) => (
            <div key={c.id} className="names__card">
              <SpeciesCard card={c} />
            </div>
          ))}
        </Rise>
      ) : (
        <Rise className="names__empty">
          <EmptyEgg />
          <p className="text-lead text-ink-soft">The first species goes here.</p>
        </Rise>
      )}

      <Link to="/species" className="btn btn-quiet">
        Species Registry
      </Link>
    </section>
  )
}

/* The party-menu egg, bobbing on its own two frames (the icon's animation in the party menu). */
function EmptyEgg() {
  const dpr = useDpr()
  const k = deviceScale(5, dpr)
  const w = cssPx(14, k, dpr)
  const h = cssPx(15, k, dpr)
  return (
    <span
      aria-hidden="true"
      className="names__egg px block"
      style={{
        width: w,
        height: h,
        backgroundImage: 'url(/game/egg_icon.png)',
        backgroundSize: `${w}px ${h * 2}px`,
        ['--egg-h' as string]: `${-h}px`,
      }}
    />
  )
}
