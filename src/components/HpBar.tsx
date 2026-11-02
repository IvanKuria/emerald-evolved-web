/* Progress, drawn the way Emerald draws HP: a row of 8x8 tiles, each
   showing 0 to 8 lit pixels (hp_0..hp_8 from the game's interface
   graphics). A 48-pixel bar is six tiles, the same as a battle
   healthbox. Scaled by whole numbers only. */

export function HpBar({ value, tiles = 6, scale = 3, label }: { value: number; tiles?: number; scale?: number; label: string }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * tiles * 8)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="inline-flex"
      style={{ filter: 'drop-shadow(3px 4px 4px rgba(40,30,20,.22))' }}
    >
      <img src="/game/hp_label.png" alt="" className="px" style={{ width: 16 * scale, height: 8 * scale }} />
      {Array.from({ length: tiles }, (_, i) => {
        const n = Math.max(0, Math.min(8, lit - i * 8))
        return <img key={i} src={`/game/hp_${n}.png`} alt="" className="px" style={{ width: 8 * scale, height: 8 * scale }} />
      })}
    </div>
  )
}
