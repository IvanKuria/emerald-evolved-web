import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Sim, type SimEvent } from '../sim/engine'
import { Field, type FieldHandle } from '../components/Field'
import { DialogueBox } from '../components/DialogueBox'
import { LivePlayers } from '../components/LivePlayers'
import { MutationDemo } from '../components/MutationDemo'
import { SelectionDemo } from '../components/SelectionDemo'
import { Creature } from '../components/Creature'
import { SITE } from '../lib/site'
import { useInView } from '../lib/useInView'

/* ------------------------------------------------------------------
   Home.

   The hero is the thing itself: one population of Eevee, running the
   real rules (sim/engine.ts) with a river down the middle. In about
   half a minute the two banks stop looking alike, then stop being able
   to breed, and the game's own message box says so. No caption explains
   it first. The headline is the video's title, set like a thumbnail.

   This is the one piece of motion on the page that nobody asked for,
   so it is the only one. Everything below it moves when touched.
------------------------------------------------------------------ */

/* Pre-run so the very first screen is already mid-story: the founders
   have spread out and the colours have started to pull apart. Seed 42
   at 56 creatures first splits at generation 46, so the split lands about
   half a minute after the page opens. */
const HERO = { seed: 42, pop: 56, mutation: 0.45, selection: 0.6, river: true, habitats: true }
const WARM = 14
const GEN_MS = 760

const OPENING = 'Two groups of EEVEE live on either side of a river.'

function lineFor(e: SimEvent): string | null {
  switch (e.kind) {
    case 'mutation':
      return e.coat > 0 ? 'A mutation! An EEVEE hatched with a greener coat.' : 'A mutation! An EEVEE hatched with a darker coat.'
    case 'refused':
      return 'The two prefer to play with other POKéMON than each other.'
    case 'split':
      return 'The EEVEE across the river are a new species now.'
    default:
      return null
  }
}

function makeHero() {
  const s = new Sim(HERO)
  for (let i = 0; i < WARM; i++) s.step()
  s.events = []
  return s
}

export function Home() {
  const sim = useRef<Sim>(makeHero())
  const control = useRef<FieldHandle>({ genMs: GEN_MS, sprite: 0.24 })
  const [line, setLine] = useState(OPENING)
  const [gen, setGen] = useState(sim.current.gen)
  const [species, setSpecies] = useState(1)

  useEffect(() => {
    const narrow = () => (control.current.sprite = innerWidth < 640 ? 0.135 : 0.24)
    narrow()
    addEventListener('resize', narrow)
    return () => removeEventListener('resize', narrow)
  }, [])

  const onStep = useCallback((ev: SimEvent[]) => {
    const s = sim.current
    setGen(s.gen)
    setSpecies(s.livingSpecies().length)
    for (const e of ev) {
      const l = e.kind === 'split' && s.species.size > 2 ? 'Another new species of EEVEE split off!' : lineFor(e)
      if (l) setLine(l)
    }
    // after a long rest on two species, start a new valley
    if (s.gen > 220) {
      sim.current = makeHero()
      setLine(OPENING)
    }
  }, [])

  return (
    <>
      <section className="relative pt-6 sm:pt-10" aria-labelledby="hero-title">
        <h1 id="hero-title" className="display mx-auto max-w-[14ch] px-5 text-center text-banner" style={{ animation: 'rise 900ms 120ms var(--ease-out) both' }}>
          I gave Pokémon real evolution
        </h1>

        <div className="relative mx-auto mt-2 max-w-[1500px]">
          <Field
            sim={sim}
            control={control}
            onStep={onStep}
            className="block h-[clamp(320px,50vh,560px)] w-full"
            label="A population of Eevee on two sides of a river, slowly changing colour and size each generation until they split into two species."
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-1 mx-auto flex max-w-[var(--page)] justify-between px-5 text-meta font-semibold text-ash tc sm:px-8">
            <span>Generation {gen}</span>
            <span className={species > 1 ? 'text-sprout-ink' : ''}>
              {species} {species === 1 ? 'species' : 'species'}
            </span>
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-[760px] px-4">
          <DialogueBox text={line} width={240} />
        </div>

        <div className="mt-9 flex flex-col items-center gap-4 px-5">
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/play" className="btn btn-ink">
              Play now
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            {SITE.video ? (
              <a href={SITE.video} className="btn btn-quiet">Watch the video</a>
            ) : (
              <Link to="/sandbox" className="btn btn-quiet">Try the sandbox</Link>
            )}
          </div>
          <p className="text-center text-meta text-ash">Bring your own Pokémon Emerald. It never leaves your computer.</p>
        </div>
      </section>

      <Hook />
      <Rules />
      <PlayBand />
    </>
  )
}

function Hook() {
  return (
    <section className="mx-auto mt-36 max-w-[var(--page)] px-5 sm:px-8">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:gap-16">
        <h2 className="display text-hero">Evolution isn’t a cutscene</h2>
        <div className="max-w-[40ch] text-quiet leading-[1.5] text-ink-soft">
          <p>
            In Pokémon, your Eevee touches a stone and turns into a Vaporeon. Every Vaporeon that has ever existed looks
            exactly the same.
          </p>
          <p className="mt-5">
            Real evolution is slower and a lot weirder. Babies come out slightly wrong. The useful mistakes get passed
            on. And if two groups are kept apart long enough, they stop being able to have babies together at all.
          </p>
          <p className="mt-5 text-ink">So I rewrote Pokémon Emerald so it works like that.</p>
        </div>
      </div>
    </section>
  )
}

function Rule({ n, title, children, demo }: { n: number; title: string; children: React.ReactNode; demo: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
      <div className="max-w-[44ch]">
        <p className="display text-[4.5rem] leading-none text-ash-light tc" aria-hidden="true">{n}</p>
        <h3 className="display mt-2 text-title">{title}</h3>
        <div className="mt-4 text-lead leading-relaxed">{children}</div>
      </div>
      <div>{demo}</div>
    </div>
  )
}

function Rules() {
  return (
    <section className="mx-auto mt-40 flex max-w-[var(--page)] flex-col gap-32 px-5 sm:px-8" aria-label="The three rules">
      <Rule
        n={1}
        title="Every egg is a little bit wrong"
        demo={<MutationDemo />}
      >
        <p>
          Each Pokémon carries two copies of every gene, one from each parent. When an egg is made, each copy has a small
          chance of changing. Usually you can’t see it. Sometimes the baby comes out a different colour.
        </p>
      </Rule>
      <Rule n={2} title="You decide who has babies" demo={<SelectionDemo />}>
        <p>
          That’s selective breeding, the same thing that turned wolves into pugs. Keep picking the greenest one and
          the whole line drifts green. In the game, the Day Care is where you do it.
        </p>
      </Rule>
      <Rule n={3} title="Then they stop getting along" demo={<SpeciationDemo />}>
        <p>
          Two Pokémon can only breed if their genes are close enough. Keep two groups apart and they drift until the Day
          Care won’t take them together. Nobody decides that’s a new species. It just happens, the way it does in real
          life.
        </p>
      </Rule>
    </section>
  )
}

function SpeciationDemo() {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="rounded-card bg-paper-lift px-5 pt-8 pb-6 shadow-card sm:px-8">
      <div className="flex items-end justify-center gap-6 sm:gap-14">
        <Creature coat={0.5} mane={0.1} scale={2} label="A small green Eevee from the left bank" />
        <div style={{ transform: 'scaleX(-1)' }}>
          <Creature coat={-0.55} mane={-0.2} scale={3} label="A large violet Eevee from the right bank" />
        </div>
      </div>
      <div className="mt-6">
        {seen && <DialogueBox text="The two prefer to play with other POKéMON than each other." width={240} />}
      </div>
      <p className="mt-4 text-center text-meta text-ash">That line is in the original game. Now it’s how you find out you made a new species.</p>
    </div>
  )
}

function PlayBand() {
  return (
    <section className="mx-auto mt-40 max-w-[var(--page)] px-5 sm:px-8">
      <div className="flex flex-col items-start gap-8 rounded-card bg-paper-lift p-8 shadow-card sm:p-14 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[34rem]">
          <h2 className="display text-hero">Play it in your browser</h2>
          <p className="mt-4 text-lead text-ink-soft">
            Drop in your own Emerald. It’s checked and patched right here in the tab, then it boots. Saves stay on this
            device.
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <Link to="/play" className="btn btn-ink">
            Play now
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <LivePlayers long className="text-meta font-semibold text-ink-soft" />
        </div>
      </div>
    </section>
  )
}
