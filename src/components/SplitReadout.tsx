import { HpBar } from './HpBar'
import { DAYCARE_LINE, TIER_COLOUR, dayCare } from '../sim/daycare'

/* ------------------------------------------------------------------
   How close the two sides are to being two species.

   Before the split this is the Day Care's verdict on one Eevee from each
   side: the game's own line, and a bar in the game's own HP colours
   that walks down a pixel at a time as they drift apart. It never
   claims a second species before the engine has found one.

   At the split the bar empties, the Day Care says the line that in
   Emerald means "these two can't breed", and then the count drops in.
------------------------------------------------------------------ */

export function SplitReadout({
  distance,
  species,
  /** the split is happening right now: show the empty bar before the count */
  breaking = false,
  size = 'sm',
  newDex,
  quote = false,
}: {
  distance: number
  species: number
  breaking?: boolean
  size?: 'sm' | 'lg'
  newDex?: number
  /** also print the Day Care's line (when no message box nearby is saying it) */
  quote?: boolean
}) {
  const split = species > 1
  const { score, fill } = dayCare(distance, split)

  if (split && !breaking)
    return (
      <div key="split" className="flex flex-col items-end text-right" style={{ animation: 'drop-in 620ms var(--ease-spring) both' }}>
        <p className={`display leading-none text-sprout-ink tc ${size === 'lg' ? 'text-[2.4rem]' : 'text-[2.1rem]'}`}>{species} species</p>
        {newDex !== undefined && <p className="mt-1 text-meta font-semibold text-ash tc">No.{newDex} split off</p>}
      </div>
    )

  return (
    <div key="compat" className="flex max-w-[17rem] flex-col items-end gap-2 text-right">
      <span className="text-meta font-semibold text-ash">One from each side, at the Day Care</span>
      <HpBar value={fill} colour={TIER_COLOUR[score]} hpLabel={false} scale={size === 'lg' ? 4 : 3} label="How well one Eevee from each side would get along" />
      {quote && (
        <span className="text-meta leading-snug text-ink-soft" aria-live="polite">
          “{DAYCARE_LINE[score].replace('\n', ' ')}”
        </span>
      )}
    </div>
  )
}
