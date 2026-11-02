import { useCallback, useEffect, useRef, useState } from 'react'
import { Sim, decodeParams, encodeParams, type SimEvent, type SimParams } from '../sim/engine'
import { Field, type FieldHandle } from '../components/Field'
import { FamilyTree } from '../components/FamilyTree'
import { DialogueBox } from '../components/DialogueBox'

/* ------------------------------------------------------------------
   Sandbox: the same engine as the hero and the ROM hack's rules, with
   the dials exposed.

   Everything that decides the outcome is in the URL -- seed, settings
   and how far it ran -- and the engine is deterministic, so a link
   reproduces a run exactly, down to which Eevee hatched where. "Save
   image" makes a card of the moment for sharing somewhere a link
   doesn't preview well.
------------------------------------------------------------------ */

const SPEEDS = [1, 2, 4, 8, 16, 32]

function lineFor(e: SimEvent, sim: Sim): string | null {
  switch (e.kind) {
    case 'mutation':
      return 'A mutation! One EEVEE hatched a very different colour.'
    case 'refused':
      return 'The two prefer to play with other POKéMON than each other.'
    case 'split':
      return `A new species split off: No.${sim.species.get(e.species)!.dex}.`
    case 'extinct':
      return `No.${sim.species.get(e.species)!.dex} died out.`
  }
}

export function Sandbox() {
  const initial = useRef(decodeParams(location.search))
  const [params, setParams] = useState<SimParams>(initial.current.params)
  const sim = useRef<Sim>(null as unknown as Sim)
  if (!sim.current) {
    sim.current = new Sim(initial.current.params)
    for (let i = 0; i < initial.current.gen; i++) sim.current.step()
  }
  const [speed, setSpeed] = useState(3)
  const [running, setRunning] = useState(true)
  const control = useRef<FieldHandle>({ genMs: 1000 / SPEEDS[3], sprite: 0.13 })
  const [tick, setTick] = useState(0)
  const [line, setLine] = useState('A single species of EEVEE. Press play and watch.')
  const [log, setLog] = useState<{ gen: number; text: string }[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    control.current.genMs = running ? 1000 / SPEEDS[speed] : 0
  }, [running, speed])

  const restart = useCallback((p: SimParams) => {
    setParams(p)
    sim.current = new Sim(p)
    setLog([])
    setLine('A single species of EEVEE. Press play and watch.')
    setTick((t) => t + 1)
  }, [])

  // keep the address bar a faithful link to what is on screen
  useEffect(() => {
    const id = setInterval(() => {
      history.replaceState(null, '', `/sandbox?${encodeParams(sim.current.p, sim.current.gen)}`)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const lastRender = useRef(0)
  const onStep = useCallback((ev: SimEvent[]) => {
    const now = performance.now()
    for (const e of ev) {
      const text = lineFor(e, sim.current)
      if (!text) continue
      if (e.kind !== 'mutation') setLine(text)
      setLog((l) => [{ gen: e.gen, text }, ...l].slice(0, 40))
    }
    if (now - lastRender.current > 120 || ev.length) {
      lastRender.current = now
      setTick((t) => t + 1)
    }
  }, [])

  const set = (patch: Partial<SimParams>) => restart({ ...params, ...patch })
  const s = sim.current
  const living = s.livingSpecies().length

  const share = async () => {
    const url = `${location.origin}/sandbox?${encodeParams(s.p, s.gen)}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      prompt('Copy this link', url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mx-auto max-w-[1360px] px-5 pt-8 sm:px-8 sm:pt-14">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h1 className="display text-hero">Watch a species split</h1>
        <p className="max-w-[46ch] text-body text-ash md:pb-2 md:text-right">
          The same rules as the game, sped up. Every link reproduces the exact run you’re looking at.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative overflow-hidden rounded-card bg-paper-lift shadow-card">
          <Field
            id="sandbox-field"
            sim={sim}
            control={control}
            onStep={onStep}
            className="block aspect-[4/3] w-full sm:aspect-[16/9]"
            label={`Population of ${params.pop} Eevee at generation ${s.gen}, ${living} species.`}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden justify-between sm:flex px-5 pt-4 text-meta font-semibold text-ash sm:px-7">
            <span>{params.habitats ? 'Favours small, green' : 'Same habitat'}</span>
            <span>{params.habitats ? 'Favours big, dark' : 'Same habitat'}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-4 sm:px-7">
            <p className="display text-[2.4rem] leading-none text-ink tc">Gen {s.gen}</p>
            <p className={`display text-[2.4rem] leading-none tc ${living > 1 ? 'text-sprout-ink' : 'text-ink'}`}>
              {living} {living === 1 ? 'species' : 'species'}
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-6 rounded-card bg-paper-lift p-6 shadow-card">
          <div className="flex gap-2">
            <button className="btn btn-ink btn-sm flex-1" onClick={() => setRunning((r) => !r)}>
              {running ? 'Pause' : 'Play'}
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => { const ev = s.step(); onStep(ev) }} disabled={running}>
              Step
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => restart(params)}>
              Restart
            </button>
          </div>

          <Slider label="Speed" value={speed} min={0} max={SPEEDS.length - 1} step={1} show={`${SPEEDS[speed]} gen/s`} onChange={setSpeed} />
          <Slider label="Population" value={params.pop} min={30} max={240} step={10} show={String(params.pop)} onChange={(v) => set({ pop: v })} />
          <Slider label="Mutation rate" value={params.mutation} min={0} max={1} step={0.05} show={`${Math.round(params.mutation * 100)}%`} onChange={(v) => set({ mutation: v })} />
          <Slider label="Selection" value={params.selection} min={0} max={1} step={0.05} show={params.selection < 0.15 ? 'Off' : `${Math.round(params.selection * 100)}%`} onChange={(v) => set({ selection: v })} />

          <div className="flex flex-col gap-3">
            <Toggle label="A river down the middle" on={params.river} onChange={(v) => set({ river: v })} />
            <Toggle label="Each side favours different Eevee" on={params.habitats} onChange={(v) => set({ habitats: v })} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-meta font-semibold text-ink-soft">Seed</span>
            <span className="text-meta text-ash tc">{params.seed}</span>
            <button className="ml-auto text-meta font-semibold text-ink-soft hover:text-ink" onClick={() => set({ seed: 1 + Math.floor(Math.random() * 99999) })}>
              New valley
            </button>
          </div>

          <div className="mt-auto flex gap-2">
            <button className="btn btn-quiet btn-sm flex-1" onClick={share}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <button className="btn btn-quiet btn-sm flex-1" onClick={() => saveCard(s)}>
              Save image
            </button>
          </div>
        </aside>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <DialogueBox text={line} width={240} />
          <div className="rounded-card bg-paper-lift p-5 shadow-card sm:p-7">
            <h2 className="text-body font-bold text-ink">Family tree</h2>
            <div className="mt-3">
              <FamilyTree sim={s} tick={tick} />
            </div>
          </div>
        </div>
        <div className="px-1">
          <h2 className="text-body font-bold text-ink">What happened</h2>
          {log.length === 0 && <p className="mt-2 text-meta text-ash">Mutations, refusals and splits show up here as they happen.</p>}
          <ol className="mt-3 flex max-h-[360px] flex-col gap-2 overflow-auto text-meta text-ash">
            {log.map((l, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-10 shrink-0 font-semibold text-ink-soft tc">{l.gen}</span>
                <span className={l.text.startsWith('A new species') ? 'font-semibold text-sprout-ink' : ''}>
                  {l.text.replace('EEVEE', 'Eevee').replace('A mutation! One', 'Mutation: one').replace('POKéMON', 'Pokémon')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function Slider(p: { label: string; value: number; min: number; max: number; step: number; show: string; onChange: (v: number) => void }) {
  const fill = ((p.value - p.min) / (p.max - p.min)) * 100
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-meta font-semibold text-ink-soft">
        {p.label}
        <span className="text-ash tc">{p.show}</span>
      </span>
      <input
        type="range"
        className="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => p.onChange(Number(e.target.value))}
      />
    </label>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center justify-between gap-4 text-left text-meta font-semibold text-ink-soft">
      {label}
      <span className="relative h-6 w-10 shrink-0 rounded-pill transition-colors duration-200" style={{ background: on ? 'var(--ink)' : 'var(--paper-deep)' }}>
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper-lift shadow-lift transition-transform duration-300 ease-[var(--ease-spring)]"
          style={{ transform: on ? 'translateX(16px)' : 'none' }}
        />
      </span>
    </button>
  )
}

/* A 1200x630 card: the page, the population as it is right now, and the
   generation and species count set like a thumbnail. */
async function saveCard(sim: Sim) {
  await document.fonts.load('400 120px "Bebas Neue"')
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 630
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f4f2ee'
  ctx.fillRect(0, 0, 1200, 630)
  const field = document.getElementById('sandbox-field') as HTMLCanvasElement | null
  if (field) {
    const k = Math.min(1160 / field.width, 470 / field.height)
    const w = field.width * k
    const h = field.height * k
    ctx.drawImage(field, (1200 - w) / 2, 130, w, h)
  }
  const grain = new Image()
  grain.src = '/game/grain.png'
  await grain.decode().catch(() => {})
  ctx.globalAlpha = 0.08
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = ctx.createPattern(grain, 'repeat') ?? '#000'
  ctx.fillRect(0, 0, 1200, 630)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#151515'
  ctx.textAlign = 'center'
  ctx.font = '400 104px "Bebas Neue"'
  const n = sim.livingSpecies().length
  ctx.fillText(`Generation ${sim.gen}: ${n} ${n === 1 ? 'species' : 'species'}`.toUpperCase(), 600, 112)
  c.toBlob((b) => {
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = `real-evolution-gen-${sim.gen}.png`
    a.click()
  })
}
