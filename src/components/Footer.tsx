import { Link } from 'react-router'

/* Distance, not a rule, separates the footer from the page. */

export function Footer() {
  return (
    <footer className="mx-auto mt-40 max-w-[var(--page)] px-5 pb-14 sm:px-8">
      <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[46ch]">
          <p className="display text-[2.6rem] text-ink">Emerald Evolved</p>
          <p className="mt-3 text-meta leading-relaxed text-ash">
            Made by Ivan Kuria. A fan project built on pokeemerald-expansion and pret’s decompilation of Pokémon Emerald. It doesn’t contain
            the game: you bring your own copy, and it never leaves your computer. Pokémon is © Nintendo, Creatures and
            GAME FREAK; this site isn’t affiliated with them.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-body font-semibold">
          <Link className="text-ink-soft hover:text-ink" to="/play">Play</Link>
          <Link className="text-ink-soft hover:text-ink" to="/species">Species</Link>
          <Link className="text-ink-soft hover:text-ink" to="/sandbox">Sandbox</Link>
          <Link className="text-ink-soft hover:text-ink" to="/how-it-works">How it works</Link>
          <Link className="text-ink-soft hover:text-ink" to="/download">Download</Link>
          <a className="text-ink-soft hover:text-ink" href="https://www.youtube.com/@ivan-kuria" rel="noreferrer">YouTube</a>
          <Link className="text-ink-soft hover:text-ink" to="/how-it-works#credits">Credits</Link>
        </div>
      </div>
    </footer>
  )
}
