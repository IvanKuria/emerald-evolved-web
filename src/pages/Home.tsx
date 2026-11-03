import { Link } from 'react-router'
import { Hero } from '../home/Hero'
import { EggSection } from '../home/EggSection'
import { Pedigree } from '../home/Pedigree'
import { Split } from '../home/Split'
import { PlayDevice } from '../home/PlayDevice'
import { RegistryBelt } from '../home/RegistryBelt'
import { Rise } from '../components/Rise'
import '../home/home.css'

/* ------------------------------------------------------------------
   Home.

   The one page that is not a document, built the way frame-site's is:
   every beat is something happening on screen, and the copy is
   captions. Seven beats:

     the arcs       a wild herd and an evolving line, walking
     the egg        a real hatch, a mutant, a growing shelf
     the pedigree   you scroll the generations and pick who breeds
     the split      two banks drift apart until the Day Care refuses
     the screen     the game, and where your ROM goes
     the registry   species players have actually named
     the close      one line, one button

   What each rule means, and the code behind it, lives on How it works.
   This page only shows them working.
------------------------------------------------------------------ */

export function Home() {
  return (
    <>
      <Hero />
      <EggSection />
      <Pedigree />
      <Split />
      <PlayDevice />
      <RegistryBelt />

      {/* The close: one line and one button, as on frame. */}
      <Rise as="section" className="close">
        <h2 className="display max-w-[14ch] text-hero">Breed something nobody has seen.</h2>
        <span className="close__cta">
          <Link to="/play" className="btn btn-ink">
            Play
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {/* the PC's hand, pointing at it */}
          <span className="breed__hand px close__hand" data-frame={-1} aria-hidden="true" />
        </span>
      </Rise>
    </>
  )
}
