import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* The mark is the party-menu egg icon from Emerald itself
   (graphics/pokemon/egg/icon.png), at two whole pixels per game pixel.
   In the party menu an icon bobs by swapping between its two frames;
   on hover it does the same, stepping, never tweening. */

export function Logo() {
  const dpr = useDpr()
  const k = deviceScale(2, dpr)
  const w = cssPx(14, k, dpr)
  const h = cssPx(15, k, dpr)
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="logo-egg px block shrink-0"
        style={{
          width: w,
          height: h,
          backgroundImage: 'url(/game/egg_icon.png)',
          backgroundSize: `${w}px ${h * 2}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          ['--egg-h' as string]: `${-h}px`,
        }}
      />
      <span className="display text-[1.7rem] leading-none tracking-[0.01em] whitespace-nowrap">Emerald Evolved</span>
    </span>
  )
}
