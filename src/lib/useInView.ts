import { useEffect, useRef, useState } from 'react'

/** True once a sixth of the element has been on screen. Never goes back to false. */
export function useInView<T extends Element>(amount = 0.15) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: amount })
    io.observe(el)
    return () => io.disconnect()
  }, [amount, seen])
  return [ref, seen] as const
}
