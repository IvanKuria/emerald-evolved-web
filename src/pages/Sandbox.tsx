import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { DialogueBox } from '../components/DialogueBox'
import { GameMenu, type MenuItem } from '../components/GameMenu'
import { HpBar } from '../components/HpBar'
import { Rise } from '../components/Rise'
import { DAYCARE_LINE, TIER_COLOUR } from '../sim/daycare'
import { checkName, SPECIES_NAME_MAX } from '../registry/names'
import { PcBox } from '../sandbox/PcBox'
import { Yard } from '../sandbox/Yard'
import { Reveal } from '../sandbox/Reveal'
import { LAB, distance, egg, heightCm, hueOf, lineScore, rng, sizeOf, tallest, wild, type Lab, type Mon, type Rng, type Score } from '../sandbox/line'

/* ------------------------------------------------------------------
   The sandbox: make a new species, by hand, in about a minute.

   A toy, not a dashboard. One goal on arrival, said by the Day Care man
   in the game's own message box. One obvious action, in the game's own
   menu, with the PC's hand pointing at it. The rest is taught by doing:

     COLLECT EGGS     ten eggs drop into a box and hatch
     tap two          the tallest son and daughter; the hand keeps them,
                      and they walk into the yard as the new parents
     the meter        the Day Care's verdict on your line next to a wild
                      Eevee, in its own four lines and HP colors
     AUTO-BREED x10   earned after three generations by hand: it keeps
                      the tallest for you
     the split        the Day Care's last line, a reveal, a name, a card

   It runs the hack's real rules (sandbox/line.ts): eight size genes,
   new copies that make Pokémon bigger and, in the wrong company, make
   eggs fail; the Day Care counting completed differences. It says it
   is a simulation, and that the real thing is the game.

   Settings stay in a drawer, at the game's values, worded for someone
   who has never bred a Pokémon.
------------------------------------------------------------------ */

const UNLOCK_AT = 3
const AUTO_MS = 300

const TIER_WORD: Record<Score, string> = { 70: 'Very well', 50: 'Get along', 20: 'Don’t like each other', 0: 'Won’t play together' }
const FILL: Record<Score, number> = { 70: 1, 50: 0.48, 20: 0.17, 0: 0 }

const SAY = {
  // every line fits the game's box in two lines (measured against the font's width table)
  goal: 'Breed a POKéMON that won’t play with the wild ones. Collect some eggs!',
  pick: 'Tap the tallest son ♂ and the tallest daughter ♀. Tall ones carry the new genes.',
  noDaughter: 'No daughters this time. Your old mother stays on.',
  noSon: 'No sons this time. Your old father stays on.',
  again: 'Good choice! Now collect their eggs.',
  unlock: 'You’ve got the hang of it. Want me to keep the tallest for you?',
  tier: (s: Score) => DAYCARE_LINE[s],
}

interface Challenge {
  id: string
  title: string
  goal: string
  done: (s: { mum: Mon; dad: Mon; gen: number; splitAt: number | null }) => boolean
}
const CHALLENGES: Challenge[] = [
  { id: 'giant', title: 'A giant', goal: 'Breed a parent 0.55 m tall.', done: (s) => Math.max(heightCm(s.mum), heightCm(s.dad)) >= 55 },
  { id: 'green', title: 'A green Eevee', goal: 'Keep the greenest until its coat turns green.', done: (s) => Math.max(hueOf(s.mum), hueOf(s.dad)) >= 5 * 48 },
  { id: 'fast', title: 'Under 25 generations', goal: 'Make a new species by generation 25.', done: (s) => s.splitAt !== null && s.splitAt <= 25 },
]

function useWidth() {
  const [w, setW] = useState(1200)
  useEffect(() => {
    const on = () => setW(document.documentElement.clientWidth)
    on()
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return w
}

export function Sandbox() {
  const width = useWidth()
  const narrow = width < 640
  const [lab, setLab] = useState<Lab>(LAB)
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 1e6))
  const r = useRef<Rng>(rng(seed))
  const [mum, setMum] = useState<Mon>(() => wild(true, r.current))
  const [dad, setDad] = useState<Mon>(() => wild(false, r.current))
  const [gen, setGen] = useState(0)
  const [litter, setLitter] = useState<Mon[]>([])
  const [born, setBorn] = useState(0)
  const [quick, setQuick] = useState(false)
  const [kept, setKept] = useState<{ son?: number; daughter?: number }>({})
  const [say, setSay] = useState(SAY.goal)
  const [handMoves, setHandMoves] = useState(0)
  const [auto, setAuto] = useState(false)
  const [splitAt, setSplitAt] = useState<number | null>(null)
  const [reveal, setReveal] = useState(false)
  const [done, setDone] = useState<string[]>([])
  const tierRef = useRef<Score>(70)
  const stopAuto = useRef(false)

  const score = lineScore(mum, dad)
  const picking = litter.length > 0 && !auto && splitAt === null
  const sons = litter.filter((m) => m.hatched && !m.female)
  const daughters = litter.filter((m) => m.hatched && m.female)
  const needSon = sons.length > 0 && kept.son === undefined
  const needDaughter = daughters.length > 0 && kept.daughter === undefined
  const ready = litter.length === 0 || (!needSon && !needDaughter)

  const restart = useCallback(
    (nextLab = lab) => {
      const s = 1 + Math.floor(Math.random() * 1e6)
      stopAuto.current = true
      r.current = rng(s)
      setSeed(s)
      setLab(nextLab)
      setMum(wild(true, r.current))
      setDad(wild(false, r.current))
      setGen(0)
      setLitter([])
      setKept({})
      setHandMoves(0)
      setAuto(false)
      setSplitAt(null)
      setReveal(false)
      tierRef.current = 70
      setSay(SAY.goal)
    },
    [lab],
  )

  // the verdict moves: the Day Care man says so, in his own line; at 0 the line has split
  useEffect(() => {
    if (score === tierRef.current) return
    tierRef.current = score
    setSay(SAY.tier(score))
    if (score === 0 && splitAt === null) {
      setSplitAt(gen)
      stopAuto.current = true
      window.setTimeout(() => setReveal(true), 2600)
    }
  }, [score, gen, splitAt])

  // challenges, checked as you go
  useEffect(() => {
    const met = CHALLENGES.filter((c) => !done.includes(c.id) && c.done({ mum, dad, gen, splitAt })).map((c) => c.id)
    if (met.length) setDone((d) => [...d, ...met])
  }, [mum, dad, gen, splitAt, done])

  const collect = useCallback(() => {
    const l = Array.from({ length: lab.eggs }, () => egg(mum, dad, r.current, lab))
    setLitter(l)
    setBorn(performance.now())
    setQuick(false)
    setKept({})
    const ds = l.filter((m) => m.hatched && m.female).length
    const ss = l.filter((m) => m.hatched && !m.female).length
    setSay(handMoves === 0 ? SAY.pick : ds === 0 ? SAY.noDaughter : ss === 0 ? SAY.noSon : SAY.pick)
  }, [mum, dad, lab, handMoves])

  const pick = useCallback(
    (m: Mon) => {
      const next = { ...kept, [m.female ? 'daughter' : 'son']: m.id }
      setKept(next)
      // the one you keep walks straight into the yard as the new parent
      if (m.female) setMum(m)
      else setDad(m)
      setGen(m.gen)
      const stillSon = sons.length > 0 && next.son === undefined
      const stillDaughter = daughters.length > 0 && next.daughter === undefined
      if (!stillSon && !stillDaughter) {
        const moves = handMoves + 1
        setHandMoves(moves)
        setSay(moves === UNLOCK_AT ? SAY.unlock : SAY.again)
      }
    },
    [kept, sons.length, daughters.length, handMoves],
  )

  const autoBreed = useCallback(async () => {
    stopAuto.current = false
    setAuto(true)
    let m = mum
    let d = dad
    for (let i = 0; i < 10 && !stopAuto.current; i++) {
      const l = Array.from({ length: lab.eggs }, () => egg(m, d, r.current, lab))
      const nm = tallest(l, true, r.current)
      const nd = tallest(l, false, r.current)
      setLitter(l)
      setQuick(true)
      setKept({ daughter: nm?.id, son: nd?.id })
      await new Promise((ok) => setTimeout(ok, AUTO_MS * 0.55))
      m = nm ?? m
      d = nd ?? d
      setMum(m)
      setDad(d)
      setGen(Math.max(m.gen, d.gen))
      await new Promise((ok) => setTimeout(ok, AUTO_MS * 0.45))
      if (lineScore(m, d) === 0) break
    }
    setAuto(false)
  }, [mum, dad, lab])

  const items: MenuItem[] = useMemo(() => {
    if (splitAt !== null) return []
    const out: MenuItem[] = []
    if (ready) out.push({ label: 'COLLECT EGGS', onSelect: collect })
    if (handMoves >= UNLOCK_AT && ready) out.unshift({ label: 'AUTO-BREED ×10', onSelect: autoBreed })
    return out
  }, [ready, collect, autoBreed, handMoves, splitAt])

  const pointAtMenu = items.length > 0 && !auto && (gen === 0 || handMoves === UNLOCK_AT)

  return (
    <div className="sbx">
      <Rise className="sbx__head">
        <h1 className="display text-hero">Make a new species.</h1>
        <p className="sbx__honest">
          A simulation of the game’s breeding rules. The real thing is the game. <Link to="/play">Play it</Link>
        </p>
      </Rise>

      <Rise delay={80} className="sbx__stage">
        <div className="sbx__left">
          <Yard mum={mum} dad={dad} scale={narrow ? 2 : 3} />
          <p className="sbx__gen display tc">Generation {gen}</p>
          <div className="sbx__verdict" aria-live="polite">
            <p className="sbx__label">Your line, next to a wild Eevee</p>
            <p className="display sbx__tier" data-tier={score}>
              {TIER_WORD[score]}
            </p>
            <HpBar value={FILL[score]} colour={TIER_COLOUR[score]} hpLabel={false} scale={narrow ? 3 : 4} label="How well your line gets along with a wild Eevee" />
            <ol className="sbx__pips" aria-hidden="true">
              {([70, 50, 20, 0] as Score[]).map((s) => (
                <li key={s} data-on={score <= s} />
              ))}
            </ol>
          </div>
        </div>

        <div className="sbx__right">
          <div className="sbx__talk">
            <DialogueBox key={say} text={say} width={240} className="w-full" />
            <div className="sbx__menu">
              {items.length > 0 && <GameMenu label="What to do" items={items} scale={narrow ? 2 : 3} />}
              {pointAtMenu && <span className="breed__hand px sbx__point" data-frame={-1} aria-hidden="true" />}
            </div>
          </div>

          {litter.length > 0 && (
            <PcBox
              litter={litter}
              born={born}
              quick={quick}
              kept={[kept.son, kept.daughter].filter((x): x is number => x !== undefined)}
              picking={picking}
              onPick={pick}
              cols={narrow ? 3 : 5}
            />
          )}
        </div>

        {reveal && splitAt !== null && (
          <Reveal mum={mum} gen={splitAt} onAgain={() => restart()} name={(n) => checkName(n, SPECIES_NAME_MAX, 'a name')} card={(name) => ({
            species: 133,
            name,
            trainer: 'YOU',
            generation: splitAt,
            coat: 0,
            hue: hueOf(mum),
            shiny: false,
            size: sizeOf(mum),
            d: distance(mum),
          })} />
        )}
      </Rise>

      {(splitAt !== null || done.length > 0) && (
        <Rise className="sbx__challenges">
          <h2 className="display text-title">Try these next</h2>
          <ul>
            {CHALLENGES.map((c) => (
              <li key={c.id} className="game-window sbx__challenge" data-done={done.includes(c.id)}>
                <p className="display text-[1.9rem] leading-none text-ink">{c.title}</p>
                <p className="mt-2 text-body text-ink-soft">{c.goal}</p>
                <p className="mt-3 text-meta font-semibold">{done.includes(c.id) ? <span className="text-sprout-ink">Done</span> : <button className="text-ink-soft hover:text-ink" onClick={() => restart()}>Start a new line</button>}</p>
              </li>
            ))}
          </ul>
        </Rise>
      )}

      <details className="sbx__lab game-window">
        <summary>Lab settings</summary>
        <p className="mt-3 text-meta text-ash">These start at the game’s own values. Changing them starts a new line.</p>
        <Setting label="How often a size gene changes in an egg" value={Math.round(1 / lab.mutation)} min={16} max={256} step={16} show={`1 in ${Math.round(1 / lab.mutation)}`} onChange={(v) => restart({ ...lab, mutation: 1 / v })} />
        <Setting label="Eggs each generation" value={lab.eggs} min={4} max={10} step={1} show={String(lab.eggs)} onChange={(v) => restart({ ...lab, eggs: v })} />
        <Setting label="How many babies are daughters" value={Math.round(1 / lab.female)} min={2} max={8} step={1} show={`1 in ${Math.round(1 / lab.female)}`} onChange={(v) => restart({ ...lab, female: v === 8 ? 31 / 256 : 1 / v })} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-quiet btn-sm" onClick={() => restart(LAB)}>Back to the game’s values</button>
          <button className="btn btn-quiet btn-sm" onClick={() => restart()}>New wild pair</button>
        </div>
        <p className="mt-4 text-meta text-ash">
          Line {seed}. The rules are the game’s: eight size genes, each new copy makes a Pokémon bigger, and the Day Care counts how many your line has
          changed for good. <Link className="font-semibold text-sprout-ink" to="/how-it-works">How it works</Link>
        </p>
      </details>
    </div>
  )
}

function Setting(p: { label: string; value: number; min: number; max: number; step: number; show: string; onChange: (v: number) => void }) {
  const fill = ((p.value - p.min) / (p.max - p.min)) * 100
  return (
    <label className="mt-4 flex flex-col gap-1">
      <span className="flex justify-between text-meta font-semibold text-ink-soft">
        {p.label}
        <span className="text-ash tc">{p.show}</span>
      </span>
      <input type="range" className="range" min={p.min} max={p.max} step={p.step} value={p.value} style={{ ['--fill' as string]: `${fill}%` }} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  )
}
