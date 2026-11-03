import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PathBelt } from '../components/PathBelt'
import { SpeciesCard, type CardData } from '../components/SpeciesCard'
import { Rise } from '../components/Rise'
import { fetchListing, type Listing } from '../registry/client'
import { cssPx, deviceScale, useBoxWidth, useDpr } from '../lib/pixels'

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
        <Belt cards={cards} reduce={reduce} />
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

/* The belt is the same engine as the hero's arcs (components/PathBelt.tsx), on a straight path one
   card wider than the screen, so a card is always arriving: grab it, flick it, it slows under the
   pointer and glides back to speed. */
const CARD = 300
const GAP = 20

function Belt({ cards, reduce }: { cards: CardData[]; reduce: boolean }) {
  const [ref, w] = useBoxWidth<HTMLDivElement>(1200)
  const L = w + CARD + GAP
  const count = Math.max(cards.length, Math.floor(L / (CARD + GAP)))
  return (
    <div ref={ref} className="names__belt">
      <PathBelt path={`M ${-CARD - GAP} 0 L ${w} 0`} count={count} speed={reduce ? 0 : 26} direction={-1} slowOnHover={0.2} anchor={[0, -18]} className="names__track">
        {(i) => (
          <div className="names__card">
            <SpeciesCard card={cards[i % cards.length]} />
          </div>
        )}
      </PathBelt>
    </div>
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
