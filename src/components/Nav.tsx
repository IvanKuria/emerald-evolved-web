import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router'
import { LivePlayers } from './LivePlayers'
import { Logo } from './Logo'

/* No rule under the bar. It sits on the page, and only once the page
   has scrolled under it does it get a shadow, so there is never a line
   across the top of a first screen. */

const LINKS = [
  { to: '/play', label: 'Play' },
  { to: '/species', label: 'Species' },
  { to: '/sandbox', label: 'Sandbox' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/download', label: 'Download' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(scrollY > 8)
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])

  return (
    <header
      className="sticky top-0 z-50 transition-shadow duration-300"
      style={{
        background: 'color-mix(in srgb, var(--paper) 86%, transparent)',
        backdropFilter: 'saturate(1.2) blur(14px)',
        WebkitBackdropFilter: 'saturate(1.2) blur(14px)',
        boxShadow: scrolled ? '0 10px 30px -22px rgba(40,30,20,.45)' : 'none',
      }}
    >
      <nav className="mx-auto flex h-[68px] max-w-[var(--page)] items-center gap-6 px-5 sm:px-8">
        <Link to="/" className="group text-ink" aria-label="Emerald Evolved, home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-pill px-3.5 py-2 text-body font-semibold transition-colors duration-200 ${
                  isActive ? 'bg-paper-sink text-ink' : 'text-ash hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <span className="hidden lg:block">
          <LivePlayers className="text-meta font-semibold text-ink-soft" />
        </span>

        <button
          className="ml-auto grid h-10 w-10 place-items-center rounded-pill text-ink md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d={open ? 'M5 5l10 10M15 5L5 15' : 'M3 7h14M3 13h14'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </nav>
      {open && (
        <div className="px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="display py-1 text-[2.4rem] text-ink">
                {l.label}
              </NavLink>
            ))}
          </div>
          <LivePlayers long className="mt-4 text-meta font-semibold text-ink-soft" />
        </div>
      )}
    </header>
  )
}
