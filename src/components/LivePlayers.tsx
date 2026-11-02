import { usePresence } from '../lib/presence'

/* The live count. It says nothing at all until it has a real number:
   a counter that shows "0 playing" while it loads, or a made-up number
   when the server is down, is worse than no counter. */

export function LivePlayers({ className = '', long = false }: { className?: string; long?: boolean }) {
  const c = usePresence()
  if (!c) return null
  const n = c.playing
  const text = long
    ? `${n.toLocaleString()} ${n === 1 ? 'person is' : 'people are'} playing right now`
    : `${n.toLocaleString()} playing`
  return (
    <span className={`inline-flex items-center gap-2 tc ${className}`} title={`${c.here.toLocaleString()} on the site`}>
      <span className="live-dot" aria-hidden="true" />
      <span>{text}</span>
    </span>
  )
}
