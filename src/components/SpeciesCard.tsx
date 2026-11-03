import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PixelSprite } from './PixelSprite'
import { paintSpecies, speciesTable } from '../registry/sprite'
import { DAYCARE_LINE } from '../sim/daycare'
import { COAT, displayScale } from '../save/genome'
import type { Card } from '../registry/card'

/* ------------------------------------------------------------------
   A species card: the thing a player made, the way the registry shows
   it. The sprite is the real front sprite of what they bred from, in
   the colours its genes give it; everything printed is recomputed from
   those genes on the server (registry/card.ts), except the two names.

   Sizes: 'hero' for the first-species spot and a card's own page,
   'tile' for the gallery.
------------------------------------------------------------------ */

/* Size as the game shows it: the battle and follower scale (save/genome.ts displayScale).
   A wild catch is about 1.0x (size 5: 4 x 0.4 derived copies + the mean of personality & 7). */
export const sizeLabel = (size: number) => `${displayScale(size).toFixed(2)}x`

export function describe(card: Pick<Card, 'coat' | 'hue' | 'shiny'>) {
  const bits: string[] = []
  if (card.coat === COAT.albino) bits.push('albino')
  if (card.coat === COAT.red) bits.push('red coat')
  if (card.coat === COAT.black) bits.push('black coat')
  if (card.hue) bits.push(`color turned ${Math.round((Math.abs(card.hue) * 360) / 1536)}°`)
  if (card.shiny) bits.push('shiny')
  return bits
}

export type CardData = Omit<Card, 'id' | 'no' | 'createdAt'> & Partial<Pick<Card, 'id' | 'no' | 'createdAt'>>

export function SpeciesCard({ card, size = 'tile', link = true }: { card: CardData; size?: 'hero' | 'tile'; link?: boolean }) {
  const [sprite, setSprite] = useState<HTMLCanvasElement | null>(null)
  const [base, setBase] = useState('')
  useEffect(() => {
    let alive = true
    paintSpecies(card).then((c) => alive && setSprite(c))
    speciesTable().then((t) => alive && setBase(t.get(card.species)?.name ?? ''))
    return () => {
      alive = false
    }
  }, [card])

  const hero = size === 'hero'
  const traits = describe(card)
  const body = (
    <>
      <div className={`flex items-end justify-center ${hero ? 'min-h-[220px] pt-6' : 'min-h-[132px] pt-4'}`}>
        <PixelSprite sprite={sprite} scale={hero ? 4 : 2} label={`${card.name}, bred from ${base}`} />
      </div>
      <div className={hero ? 'mt-7' : 'mt-4'}>
        <div className="flex items-baseline justify-between gap-3">
          <p className={`display min-w-0 truncate text-ink ${hero ? 'text-[3.4rem] leading-[0.9]' : 'text-[2rem] leading-[0.92]'}`}>{card.name}</p>
          {card.no !== undefined && <span className="shrink-0 text-meta font-semibold text-ash tc">No.{card.no}</span>}
        </div>
        <p className={`text-ink-soft ${hero ? 'mt-2 text-lead' : 'mt-1 text-body'}`}>
          Bred from {base || '…'} by <span className="font-semibold text-ink">{card.trainer}</span>
        </p>
        <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ash ${hero ? 'mt-5 text-body' : 'mt-3 text-meta'}`}>
          <dt className="font-semibold text-ink-soft">Size</dt>
          <dd className="tc">
            {sizeLabel(card.size)} <span className="text-ash-light">(wild ones about 1.0x)</span>
          </dd>
          {card.generation !== null && (
            <>
              <dt className="font-semibold text-ink-soft">Generation</dt>
              <dd className="tc">{card.generation}</dd>
            </>
          )}
          {traits.length > 0 && (
            <>
              <dt className="font-semibold text-ink-soft">Genes</dt>
              <dd>{traits.join(', ')}</dd>
            </>
          )}
        </dl>
        {hero && (
          <p className="mt-5 text-meta leading-relaxed text-ash">
            With a wild {base || 'one'}, the Day Care says “{DAYCARE_LINE[0].replace('\n', ' ')}”
          </p>
        )}
      </div>
    </>
  )
  const cls = `block rounded-card bg-paper-lift shadow-card ${hero ? 'p-7 sm:p-9' : 'p-5'} ${
    link && card.id ? 'transition-transform duration-300 ease-[var(--ease-out)] hover:-translate-y-1' : ''
  }`
  return link && card.id ? (
    <Link to={`/species/${card.id}`} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
