import { useCallback, useEffect, useRef, useState } from 'react'
import { applyBps, BpsError } from '../lib/bps'
import { sha1Hex } from '../lib/sha1'
import { EMERALD, TEST_CART, judge, patchAvailable, type PatchTarget } from '../lib/rom'
import { bootCore, download, forgetGame, hasGame, isolationProblem, storeGame, type Emulator } from '../lib/emulator'
import { setPlaying } from '../lib/presence'
import { DialogueBox } from '../components/DialogueBox'
import { HpBar } from '../components/HpBar'
import { TouchPad } from '../components/TouchPad'
import { useNavigate } from 'react-router'
import { handSave } from '../registry/client'
import { cssPx, deviceScale, fitScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   Play.

   Four steps, shown as four steps because they are a sequence and the
   player should be able to see which one they are on:

     1  Your ROM     you drop a file; we read it in the tab
     2  Checked      SHA-1 against the one Emerald the patch is built on
     3  Patched      the .bps applied in the tab (lib/bps.ts)
     4  Playing      mGBA boots the result

   The ROM is never uploaded and never sent anywhere. The patched game is
   kept in this browser's own storage so "Continue" works tomorrow;
   "Forget this game" deletes it.

   The empty state is the game's own window speaking, because the first
   thing a player sees here should be Emerald, not a file input.
------------------------------------------------------------------ */

type Phase =
  | { at: 'drop' }
  | { at: 'reading'; name: string }
  | { at: 'checking'; progress: number }
  | { at: 'refused'; title: string; detail: string }
  | { at: 'verified-waiting' }
  | { at: 'patching'; progress: number }
  | { at: 'booting' }
  | { at: 'playing' }
  | { at: 'failed'; title: string; detail: string }

const LAST = 'pe-last-game'

const STEPS = ['Your ROM', 'Checked', 'Patched', 'Playing'] as const
function stepOf(p: Phase): number {
  switch (p.at) {
    case 'drop':
    case 'refused':
      return 0
    case 'reading':
    case 'checking':
      return 1
    case 'verified-waiting':
    case 'patching':
      return 2
    case 'booting':
      return 3
    case 'playing':
      return 4
    default:
      return 0
  }
}

export function Play() {
  const [phase, setPhase] = useState<Phase>({ at: 'drop' })
  const [target, setTarget] = useState<PatchTarget>(EMERALD)
  const [over, setOver] = useState(false)
  const [emu, setEmu] = useState<Emulator | null>(null)
  const [patched, setPatched] = useState<Uint8Array | null>(null)
  const [last, setLast] = useState<string | null>(() => localStorage.getItem(LAST))
  const canvas = useRef<HTMLCanvasElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const problem = typeof window !== 'undefined' ? isolationProblem() : null
  const screenBox = useRef<HTMLDivElement>(null)
  const dpr = useDpr()
  const [screenK, setScreenK] = useState(() => deviceScale(3, dpr))

  /* The GBA screen at a whole number of screen pixels per game pixel:
     the biggest that fits, up to 4x. A 3.4x screen would smear every tile. */
  useEffect(() => {
    const el = screenBox.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setScreenK(fitScale(e.contentRect.width, 240, dpr, deviceScale(4, dpr))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [dpr])

  useEffect(() => () => setPlaying(false), [])

  const boot = useCallback(async (rom: Uint8Array | null, t: PatchTarget) => {
    setTarget(t)
    setPhase({ at: 'booting' })
    try {
      const e = await bootCore(canvas.current!)
      if (rom) await storeGame(e, t.outName, rom)
      else if (!hasGame(e, t.outName)) throw new Error('missing')
      if (!e.loadGame(`${e.filePaths().gamePath}/${t.outName}`)) throw new Error('load')
      e.resumeAudio()
      localStorage.setItem(LAST, t.outName)
      setLast(t.outName)
      setEmu(e)
      setPhase({ at: 'playing' })
      setPlaying(true)
      canvas.current?.focus({ preventScroll: true })
      // on a phone the screen and the touch controls only fit together once the page is scrolled to them
      if (innerWidth < 1024) requestAnimationFrame(() => stage.current?.scrollIntoView({ block: 'start' }))
    } catch (err) {
      setPhase({
        at: 'failed',
        title: (err as Error).message === 'missing' ? 'That game isn’t saved in this browser any more' : 'The emulator couldn’t start the game',
        detail:
          (err as Error).message === 'missing'
            ? 'Your browser cleared this site’s storage. Drop your Emerald in again; your save will be gone unless you exported it.'
            : 'Reload the page and try again. If it keeps happening, your browser may be blocking WebAssembly threads.',
      })
    }
  }, [])

  const take = useCallback(
    async (file: File | Uint8Array, t: PatchTarget) => {
      setTarget(t)
      setPhase({ at: 'reading', name: file instanceof File ? file.name : 'test cartridge' })
      const rom = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file
      setPhase({ at: 'checking', progress: 0.5 })
      const sha = await sha1Hex(rom)
      setPhase({ at: 'checking', progress: 1 })
      const v = judge(rom, sha, t)
      if (!v.ok) return setPhase({ at: 'refused', title: v.title, detail: v.detail })
      if (!(await patchAvailable(t))) return setPhase({ at: 'verified-waiting' })

      setPhase({ at: 'patching', progress: 0 })
      try {
        // the patch is about 24 MB: the first half of the bar is the download, the second the patching
        const res = await fetch(t.patchUrl)
        if (!res.ok || !res.body) throw new BpsError('The patch file couldn’t be downloaded. Check your connection and try again.', 'patch')
        const total = Number(res.headers.get('content-length')) || t.patchSize || 0
        const parts: Uint8Array[] = []
        let got = 0
        const reader = res.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          parts.push(value)
          got += value.length
          if (total) setPhase({ at: 'patching', progress: Math.min(1, got / total) * 0.5 })
        }
        const bytes = new Uint8Array(got)
        let at = 0
        for (const p of parts) (bytes.set(p, at), (at += p.length))
        // let the bar paint before the patching, which runs in one go
        await new Promise((r) => setTimeout(r, 60))
        const out = applyBps(rom, bytes, (f) => setPhase({ at: 'patching', progress: 0.5 + f * 0.5 }))
        if (t.targetSha1 && (await sha1Hex(out)) !== t.targetSha1)
          throw new BpsError('The patched game isn’t the one we expected. Nothing was saved.', 'output')
        setPhase({ at: 'patching', progress: 1 })
        setPatched(out)
        await new Promise((r) => setTimeout(r, 350))
        await boot(out, t)
      } catch (err) {
        const e = err as BpsError
        setPhase({ at: 'failed', title: 'The patch didn’t apply', detail: e.message })
      }
    },
    [boot],
  )

  const tryTest = async () => {
    const r = await fetch('/test/evotest.gba')
    take(new Uint8Array(await r.arrayBuffer()), TEST_CART)
  }

  const onFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (f) take(f, EMERALD)
  }

  const step = stepOf(phase)

  return (
    <div className="mx-auto max-w-[var(--page)] px-5 pt-8 sm:px-8 sm:pt-14">
      <h1 className="display text-hero">Play it here</h1>
      <p className="mt-4 max-w-[52ch] text-lead text-ink-soft">
        Drop in your own Pokémon Emerald (US). It’s checked, patched and run inside this tab. Nothing is uploaded: once
        the page has loaded you could turn your Wi-Fi off and it would still work.
      </p>

      {/* Once the game is running the four steps are all done; on a phone they would only push the
          screen and its controls apart, so they step aside there. */}
      <ol
        className={`mt-10 flex flex-wrap gap-x-8 gap-y-3 ${phase.at === 'playing' || phase.at === 'booting' ? 'max-lg:hidden' : ''}`}
        aria-label="Progress"
      >
        {STEPS.map((s, i) => {
          const done = i < step
          const now = i === step || (i === 3 && step === 4)
          return (
            <li key={s} className="flex items-center gap-2.5 text-body font-semibold" aria-current={now ? 'step' : undefined}>
              <span
                className="grid h-6 w-6 place-items-center rounded-full text-micro tc transition-colors duration-300"
                style={{
                  background: done || (i === 3 && step === 4) ? 'var(--sprout)' : now ? 'var(--ink)' : 'var(--paper-sink)',
                  color: done || (i === 3 && step === 4) ? 'var(--ink)' : now ? '#fff' : 'var(--ash)',
                }}
              >
                {done || (i === 3 && step === 4) ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5l2.2 2.2L9.5 3.8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={done || now ? 'text-ink' : 'text-ash'}>{s}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div
          ref={stage}
          className="relative overflow-hidden rounded-card bg-paper-lift shadow-card transition-shadow duration-300"
          style={{ boxShadow: over ? '0 0 0 3px var(--sprout), var(--shadow-card)' : undefined }}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            if (phase.at !== 'playing') onFiles(e.dataTransfer.files)
          }}
        >
          <div className={phase.at === 'playing' || phase.at === 'booting' ? 'block' : 'hidden'}>
            <div ref={screenBox} className="flex justify-center p-3 sm:p-8">
              <canvas
                ref={canvas}
                id="canvas"
                tabIndex={0}
                width={240}
                height={160}
                className="px block rounded-[4px] bg-ink shadow-card"
                style={{ width: cssPx(240, screenK, dpr), height: cssPx(160, screenK, dpr) }}
                aria-label="Game screen. Keyboard: arrows to move, X is A, Z is B, Enter is Start."
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
            {phase.at === 'playing' && emu && (
              <div className="px-4 pb-6 lg:hidden">
                <TouchPad emu={emu} />
              </div>
            )}
          </div>

          {phase.at !== 'playing' && phase.at !== 'booting' && (
            <div className="flex min-h-[460px] flex-col items-center justify-center gap-7 px-5 py-14 text-center">
              <Status phase={phase} target={target} />
              {(phase.at === 'drop' || phase.at === 'refused' || phase.at === 'failed') && (
                <div className="flex flex-wrap justify-center gap-3">
                  <button className="btn btn-ink" onClick={() => input.current?.click()}>
                    Choose your ROM
                  </button>
                  {last && (
                    <button className="btn btn-quiet" onClick={() => boot(null, last === TEST_CART.outName ? TEST_CART : EMERALD)}>
                      Continue playing
                    </button>
                  )}
                </div>
              )}
              {phase.at === 'drop' && (
                <button className="text-meta font-semibold text-ash underline-offset-4 hover:text-ink hover:underline" onClick={tryTest}>
                  No Emerald on this device? Try the test cartridge
                </button>
              )}
              <input ref={input} type="file" accept=".gba,.bin,application/octet-stream" className="sr-only" onChange={(e) => onFiles(e.target.files)} />
            </div>
          )}
          {phase.at === 'booting' && <p className="absolute inset-x-0 bottom-4 text-center text-meta text-ash-light">Starting mGBA…</p>}
        </div>

        <aside className="flex flex-col gap-8 text-body">
          {phase.at === 'playing' && emu ? (
            <Toolbar emu={emu} target={target} patched={patched} stage={stage} onForget={async () => {
              await forgetGame(emu, target.outName)
              emu.quitGame()
              localStorage.removeItem(LAST)
              setLast(null)
              setPlaying(false)
              setPhase({ at: 'drop' })
            }} />
          ) : (
            <>
              <div>
                <h2 className="text-body font-bold text-ink">What you need</h2>
                <p className="mt-2 text-ash">
                  A copy of Pokémon Emerald for the US Game Boy Advance, as a .gba file you made from a cartridge you own.
                </p>
              </div>
              <div>
                <h2 className="text-body font-bold text-ink">Where it goes</h2>
                <p className="mt-2 text-ash">
                  Nowhere. It’s read by this tab, checked, patched, and kept in your browser’s storage for this site so you
                  can come back to it.
                </p>
              </div>
            </>
          )}
          {problem && (
            <p className="rounded-field bg-refuse-wash p-4 text-meta text-refuse-ink">{problem}</p>
          )}
        </aside>
      </div>

    </div>
  )
}

function Status({ phase, target }: { phase: Phase; target: PatchTarget }) {
  switch (phase.at) {
    case 'drop':
      return (
        <>
          <DialogueBox text="Drop your POKéMON EMERALD here, and it will start to evolve." width={240} className="w-full max-w-[740px]" />
        </>
      )
    case 'reading':
      return <p className="text-lead text-ink">Reading {phase.name}…</p>
    case 'checking':
      return (
        <>
          <HpBar value={phase.progress} label="Checking your ROM" />
          <p className="text-lead text-ink">Checking it’s the right Emerald…</p>
        </>
      )
    case 'refused':
      return (
        <div className="max-w-[48ch]">
          <p className="display text-title text-refuse-ink">{phase.title}</p>
          <p className="mt-3 text-lead text-ink-soft">{phase.detail}</p>
        </div>
      )
    case 'verified-waiting':
      return (
        <div className="max-w-[46ch]">
          <p className="display text-title text-sprout-ink">That’s the right Emerald</p>
          <p className="mt-3 text-lead text-ink-soft">
            The patch goes up with the video. Your copy checks out, so when it does, this page will patch it and boot it
            in a couple of seconds.
          </p>
        </div>
      )
    case 'patching':
      return (
        <>
          <HpBar value={phase.progress} label={`Patching ${target.baseName}`} />
          <p className="text-lead text-ink tc">Patching… {Math.round(phase.progress * 100)}%</p>
        </>
      )
    case 'failed':
      return (
        <div className="max-w-[48ch]">
          <p className="display text-title text-refuse-ink">{phase.title}</p>
          <p className="mt-3 text-lead text-ink-soft">{phase.detail}</p>
        </div>
      )
    default:
      return null
  }
}

function Toolbar({
  emu,
  target,
  patched,
  stage,
  onForget,
}: {
  emu: Emulator
  target: PatchTarget
  patched: Uint8Array | null
  stage: React.RefObject<HTMLDivElement | null>
  onForget: () => void
}) {
  const navigate = useNavigate()
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const saveIn = useRef<HTMLInputElement>(null)
  const base = target.outName.replace(/\.gba$/, '')
  return (
    <>
      <div>
        <h2 className="text-body font-bold text-ink">Playing {target === TEST_CART ? 'the test cartridge' : 'Emerald Evolved'}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-quiet btn-sm" onClick={() => { paused ? emu.resumeGame() : emu.pauseGame(); setPaused(!paused) }}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => { emu.setVolume(muted ? 100 : 0); setMuted(!muted) }}>
            {muted ? 'Sound on' : 'Mute'}
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => stage.current?.requestFullscreen?.()}>
            Full screen
          </button>
        </div>
      </div>
      <div className="hidden lg:block">
        <h2 className="text-body font-bold text-ink">Keyboard</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta text-ash">
          <dt className="font-semibold text-ink-soft">Arrows</dt><dd>Move</dd>
          <dt className="font-semibold text-ink-soft">X / Z</dt><dd>A / B</dd>
          <dt className="font-semibold text-ink-soft">A / S</dt><dd>L / R</dd>
          <dt className="font-semibold text-ink-soft">Enter</dt><dd>Start</dd>
          <dt className="font-semibold text-ink-soft">Backspace</dt><dd>Select</dd>
        </dl>
      </div>
      <div>
        <h2 className="text-body font-bold text-ink">Your save</h2>
        <p className="mt-2 text-meta text-ash">Save in the game as usual. It’s kept in this browser. Export it now and then so clearing your browser can’t take it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-quiet btn-sm" onClick={() => { const s = emu.getSave(); if (s) download(s, `${base}.sav`) }}>
            Export save
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => saveIn.current?.click()}>
            Import save
          </button>
          <input ref={saveIn} type="file" accept=".sav" className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) emu.uploadSaveOrSaveState(new File([f], `${base}.sav`), () => { emu.FSSync(); emu.quickReload() })
          }} />
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        {patched && (
          <button className="text-meta font-semibold text-ink-soft hover:text-ink" onClick={() => download(patched, target.outName)}>
            Download the patched game for another emulator
          </button>
        )}
        {target !== TEST_CART && (
          <button
            className="text-meta font-semibold text-sprout-ink hover:text-ink"
            onClick={() => {
              const s = emu.getSave()
              if (s) {
                handSave(s)
                navigate('/species#register')
              }
            }}
          >
            Look for new species in this save
          </button>
        )}
        <button className="text-meta font-semibold text-refuse-ink hover:text-ink" onClick={onForget}>
          Forget this game and its save
        </button>
      </div>
    </>
  )
}
