/* Emerald's standard window (window_frame_1.png, 24x24: 8 px corners,
   8 px edges), as a CSS border-image so it wraps anything at any size
   without stretching a pixel. Scaled by a whole number. */

export function GameWindow({ children, scale = 3, className = '' }: { children: React.ReactNode; scale?: number; className?: string }) {
  const b = 8 * scale
  return (
    <div
      className={`px ${className}`}
      style={{
        borderStyle: 'solid',
        borderWidth: b,
        borderImage: `url(/game/window_frame.png) 8 fill / ${b}px / 0 round`,
        imageRendering: 'pixelated',
      }}
    >
      {children}
    </div>
  )
}
