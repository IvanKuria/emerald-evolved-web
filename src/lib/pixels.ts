import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------
   Whole pixels, counted on the screen.

   A game pixel is only a clean square when it covers a whole number of
   the screen's own pixels. "3x in CSS" is not enough: on a 125% Windows
   display 3 CSS px is 3.75 device px and nearest-neighbour has to make
   some pixels wider than others, which reads as blur on text. So every
   pixel asset on the site asks for a scale here, gets back a whole
   number of DEVICE pixels per game pixel, and is laid out at that
   size divided by the device pixel ratio.
------------------------------------------------------------------ */

export const dprNow = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)

/** The device pixel ratio, kept current when the window moves to another screen or zooms. */
export function useDpr() {
  const [dpr, setDpr] = useState(dprNow)
  useEffect(() => {
    let mq: MediaQueryList
    const watch = () => {
      setDpr(dprNow())
      mq = matchMedia(`(resolution: ${dprNow()}dppx)`)
      mq.addEventListener('change', watch, { once: true })
    }
    watch()
    return () => mq?.removeEventListener('change', watch)
  }, [])
  return dpr
}

/** Device pixels per game pixel for a wanted CSS scale: the nearest whole number, at least 1. */
export const deviceScale = (cssScale: number, dpr: number) => Math.max(1, Math.round(cssScale * dpr))

/** The largest whole device scale at which `native` game pixels fit in `css` CSS pixels. */
export const fitScale = (css: number, native: number, dpr: number, max = Infinity) =>
  Math.max(1, Math.min(max, Math.floor((css * dpr) / native)))

/** CSS length of `n` game pixels at `k` device pixels each. */
export const cssPx = (n: number, k: number, dpr: number) => (n * k) / dpr

/** The width of an element, kept current: layout derives from the box it has, not the window. */
export function useBoxWidth<T extends HTMLElement>(fallback = 1200) {
  const [el, setEl] = useState<T | null>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w] as const
}
