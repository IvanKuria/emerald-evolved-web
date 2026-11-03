import { COMPAT_LIMIT } from './engine'

/* ------------------------------------------------------------------
   The Day Care's verdict, in the game's own words and numbers.

   pokeemerald scores a pair of parents 70, 50, 20 or 0
   (include/constants/daycare.h: PARENTS_MAX/MED/LOW_COMPATIBILITY,
   PARENTS_INCOMPATIBLE) and the Day Care man reads the score out with
   one of four lines (src/strings.c, gDaycareText_*). Those strings are
   copied here verbatim, line breaks included.

   The site asks the question about one Eevee from each side of the map.
   The average pair's genetic distance against the breeding limit picks
   the tier, so the words move the same way the hack's rule does: well
   inside the limit is "very well", inside it is "get along", past it is
   "don't seem to like each other much". The last line, the one that
   means "can't breed", is kept for the moment the population actually
   splits, because that is what it means in the game.
------------------------------------------------------------------ */

export type Score = 70 | 50 | 20 | 0

export const DAYCARE_LINE: Record<Score, string> = {
  70: 'The two seem to get along\nvery well.',
  50: 'The two seem to get along.',
  20: 'The two don’t seem to like\neach other much.',
  0: 'The two prefer to play with other\nPOKéMON than each other.',
}

/* The same four tiers, as the colours the game gives an HP bar: green,
   yellow, red, empty. */
export const TIER_COLOUR: Record<Score, 'green' | 'yellow' | 'red'> = { 70: 'green', 50: 'yellow', 20: 'red', 0: 'red' }

export function dayCare(meanDistance: number, split: boolean): { score: Score; fill: number } {
  if (split) return { score: 0, fill: 0 }
  const d = Number.isFinite(meanDistance) ? meanDistance : 0
  const score: Score = d < COMPAT_LIMIT * 0.7 ? 70 : d < COMPAT_LIMIT ? 50 : 20
  // one pixel always stays lit until the split: the bar only empties when they really can't breed
  return { score, fill: Math.max(1 / 48, Math.min(1, 1 - d / 1.1)) }
}
