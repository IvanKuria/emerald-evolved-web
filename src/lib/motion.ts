import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------
   Reduced motion: reduce, never remove.

   Windows turns "Animation effects" off for a lot of people who never
   asked for it, and every browser then reports
   `prefers-reduced-motion: reduce`. The site used to answer that by
   returning early, which stopped the belts, the hatching, the typing and
   with them half the page's interactions. The rule now, in one place:

     interaction   always works, whatever the setting (clicks, hovers,
                   drags, the egg, the play device)
     ambient       small motion keeps running, at most slowed: the
                   belts, sprite idle frames, the HP bar, the typing
     vestibular    only large motion (things flying across the page,
                   scroll-linked travel) is shortened or becomes a fade

   Components ask this module, not matchMedia.
------------------------------------------------------------------ */

const QUERY = '(prefers-reduced-motion: reduce)'

/** the visitor asked for reduced motion (read now; use the hook in render) */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof matchMedia === 'function' && matchMedia(QUERY).matches
}

/** the same, as state that follows the OS setting while the page is open */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = matchMedia(QUERY)
    const on = () => setReduce(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduce
}

/** ambient motion (belts, walkers, idle frames, typing, bars) runs at this rate: slowed, never stopped */
export function ambientRate(reduce = prefersReducedMotion()): number {
  return reduce ? 0.6 : 1
}

/** how a large move (a sprite flying across the page) plays: travel in full, or a short fade in place */
export function largeMotion(reduce = prefersReducedMotion()): 'travel' | 'fade' {
  return reduce ? 'fade' : 'travel'
}

/** scroll-linked travel follows the scroll on this ease per frame: the page's glide, or a near snap */
export function scrollFollow(reduce = prefersReducedMotion()): number {
  return reduce ? 0.35 : 0.09
}
