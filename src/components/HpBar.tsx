import { useEffect, useRef, useState } from 'react'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* A bar drawn the way Emerald draws HP: a row of 8x8 tiles, each showing
   0 to 8 lit pixels (hpbar_<colour>_0..8 from the game's interface
   graphics). A 48-pixel bar is six tiles, the same as a battle healthbox.

   Like the game, it never jumps: when the value changes the lit edge
   walks there a pixel at a time. Whole device pixels per game pixel. */

export function HpBar({
  value,
  tiles = 6,
  scale = 3,
  colour = 'green',
  hpLabel = true,
  label,
}: {
  value: number
  tiles?: number
  scale?: number
  colour?: 'green' | 'yellow' | 'red'
  /** the game's little "HP" tag at the left */
  hpLabel?: boolean
  label: string
}) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  const target = Math.round(Math.max(0, Math.min(1, value)) * tiles * 8)
  const [lit, setLit] = useState(target)
  const shown = useRef(target)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown.current = target
      return setLit(target)
    }
    const id = setInterval(() => {
      if (shown.current === target) return clearInterval(id)
      shown.current += shown.current < target ? 1 : -1
      setLit(shown.current)
    }, 16)
    return () => clearInterval(id)
  }, [target])

  const prefix = colour === 'green' ? 'hp_' : `hp_${colour}_`
  const t = cssPx(8, k, dpr)
  return (
    <div
      role={hpLabel ? 'progressbar' : 'meter'}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="inline-flex"
      style={{ filter: 'drop-shadow(2px 3px 3px rgba(40,30,20,.18))' }}
    >
      {hpLabel && <img src="/game/hp_label.png" alt="" className="px" style={{ width: t * 2, height: t }} />}
      {Array.from({ length: tiles }, (_, i) => {
        const n = Math.max(0, Math.min(8, lit - i * 8))
        return <img key={i} src={`/game/${prefix}${n}.png`} alt="" className="px" style={{ width: t, height: t }} />
      })}
    </div>
  )
}
