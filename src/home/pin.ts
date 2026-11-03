import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ------------------------------------------------------------------
   A pinned, scroll-driven stage: GSAP's ScrollTrigger holds the section
   in place for `length` screens of scrolling and reports how far
   through it the reader is, 0..1. The section does the rest with that
   one number, so scrolling back runs it backwards.

   Reduced motion keeps the pin (the reader is the one moving it) but
   the sections themselves drop their tweens.
------------------------------------------------------------------ */

export function usePinnedProgress(length: number) {
  const ref = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: () => `+=${Math.round(innerHeight * length)}`,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => setProgress(self.progress),
    })
    // fonts and images above this section change its position after first layout
    const late = window.setTimeout(() => ScrollTrigger.refresh(), 600)
    return () => {
      clearTimeout(late)
      st.kill()
    }
  }, [length])

  return [ref, progress] as const
}

export { ScrollTrigger }
