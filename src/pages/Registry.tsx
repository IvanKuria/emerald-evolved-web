import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { SpeciesCard, type CardData } from '../components/SpeciesCard'
import { DAYCARE_LINE } from '../sim/daycare'
import { parseSave, SaveError, type FoundMon, type ParsedSave } from '../save/gen3'
import { isNewSpecies, scoreVsWild } from '../save/genome'
import { buildCard, toHex, type Card } from '../registry/card'
import { SPECIES_NAME_MAX } from '../registry/names'
import { fetchCard, fetchListing, submitCard, takeSave, type Listing } from '../registry/client'
import { saveCardImage } from '../registry/cardImage'
import { speciesTable } from '../registry/sprite'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   The Species Registry: every new species players have bred, the first
   one in its own spot, and the way in for yours.

   Your save is read in this tab (save/gen3.ts). If a line in it can no
   longer breed with wild ones, you name it and its card is made; only
   the card's data is sent (registry/card.ts says exactly what), and the
   server rebuilds the card from the genes before it keeps it.

   With no storage behind the API the gallery doesn't exist yet; the
   page says so, and reading a save and saving the card as an image
   still work, because they never needed the server.
------------------------------------------------------------------ */

const shareUrl = (id?: string) => `${location.origin}${id ? `/species/${id}` : '/species'}`

export function Registry() {
  const [listing, setListing] = useState<Listing | null | 'loading'>('loading')
  const reload = useCallback(() => void fetchListing().then(setListing), [])
  useEffect(reload, [reload])
  const live = listing !== null && listing !== 'loading'

  return (
    <div className="mx-auto max-w-[var(--page)] px-5 pt-8 sm:px-8 sm:pt-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="display text-hero">Species Registry</h1>
        <p className="max-w-[44ch] text-body text-ash md:pb-2 md:text-right">
          Every new species bred in Emerald Evolved, with the trainer who made it.
          {live && listing.total > 0 && <span className="text-ink-soft tc"> {listing.total.toLocaleString()} so far.</span>}
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FirstSpot listing={listing} />
        <Register live={live} onAdded={reload} />
      </div>

      {live && listing.cards.length > 0 && (
        <section className="mt-24" aria-labelledby="all">
          <h2 id="all" className="display text-title">Newest</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listing.cards.map((c) => (
              <SpeciesCard key={c.id} card={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Egg({ scale = 4 }: { scale?: number }) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  return (
    <span
      aria-hidden="true"
      className="px block"
      style={{
        width: cssPx(14, k, dpr),
        height: cssPx(15, k, dpr),
        backgroundImage: 'url(/game/egg_icon.png)',
        backgroundSize: `${cssPx(14, k, dpr)}px ${cssPx(30, k, dpr)}px`,
        imageRendering: 'pixelated',
        filter: 'drop-shadow(6px 9px 7px rgba(40,30,20,.26))',
      }}
    />
  )
}

function FirstSpot({ listing }: { listing: Listing | null | 'loading' }) {
  if (listing !== 'loading' && listing?.first)
    return (
      <section aria-labelledby="first">
        <h2 id="first" className="mb-3 text-body font-bold text-sprout-ink">The first real evolution ever made</h2>
        <SpeciesCard card={listing.first} size="hero" />
      </section>
    )
  return (
    <section aria-labelledby="first" className="flex flex-col">
      <h2 id="first" className="mb-3 text-body font-bold text-ink">The first real evolution ever made</h2>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-card bg-paper-sink px-8 py-14 text-center">
        <Egg />
        <div className="max-w-[34ch]">
          <p className="display text-[2.4rem] leading-[0.92] text-ink">{listing === 'loading' ? ' ' : 'Nobody has made one yet'}</p>
          <p className="mt-3 text-body text-ash">
            {listing === null
              ? 'The registry opens when the game does. The first species anyone breeds goes here, with their trainer name on it.'
              : 'The first species anyone breeds goes here, with their trainer name on it.'}
          </p>
        </div>
      </div>
    </section>
  )
}

type Step =
  | { at: 'idle' }
  | { at: 'error'; message: string }
  | { at: 'read'; save: ParsedSave; found: FoundMon[] }
  | { at: 'naming'; save: ParsedSave; mon: FoundMon }
  | { at: 'done'; card: Card; first: boolean }

function Register({ live, onAdded }: { live: boolean; onAdded: () => void }) {
  const [step, setStep] = useState<Step>({ at: 'idle' })
  const input = useRef<HTMLInputElement>(null)

  const read = useCallback((bytes: Uint8Array) => {
    try {
      const save = parseSave(bytes)
      const found = save.mons.filter((m) => !m.isEgg && isNewSpecies(m.genome))
      setStep(found.length === 1 ? { at: 'naming', save, mon: found[0] } : { at: 'read', save, found })
    } catch (e) {
      setStep({ at: 'error', message: e instanceof SaveError ? e.message : 'That file couldn’t be read as a save.' })
    }
  }, [])

  useEffect(() => {
    const handed = takeSave()
    if (handed) read(handed)
  }, [read])

  const pick = async (f: File | undefined) => f && read(new Uint8Array(await f.arrayBuffer()))

  return (
    <section id="register" aria-labelledby="yours" className="scroll-mt-28 self-start rounded-card bg-paper-lift p-6 shadow-card sm:p-9">
      <h2 id="yours" className="display text-title">Register yours</h2>
      <p className="mt-3 max-w-[48ch] text-body text-ink-soft">
        Breed a line until the Day Care says “{DAYCARE_LINE[0].replace('\n', ' ')}” about it and a wild one. Then read your
        save here. It stays in this tab: only the card is sent.
      </p>

      <input ref={input} type="file" accept=".sav,.srm,.fla,application/octet-stream" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />

      {(step.at === 'idle' || step.at === 'error') && (
        <div className="mt-7">
          <button className="btn btn-ink" onClick={() => input.current?.click()}>
            Read my save
          </button>
          <p className="mt-3 text-meta text-ash">
            The .sav from your emulator, or play on <Link to="/play" className="font-semibold text-sprout-ink hover:text-ink">this site</Link> and
            use “Look for new species” there.
          </p>
          {step.at === 'error' && <p className="mt-4 rounded-field bg-refuse-wash p-4 text-meta text-refuse-ink">{step.message}</p>}
        </div>
      )}

      {step.at === 'read' && <Found step={step} onPick={(mon) => setStep({ at: 'naming', save: step.save, mon })} onAgain={() => input.current?.click()} />}
      {step.at === 'naming' && <Naming step={step} live={live} onDone={(card, first) => (setStep({ at: 'done', card, first }), onAdded())} onBack={() => setStep({ at: 'idle' })} />}
      {step.at === 'done' && <Done card={step.card} first={step.first} />}
    </section>
  )
}

function Found({ step, onPick, onAgain }: { step: Extract<Step, { at: 'read' }>; onPick: (m: FoundMon) => void; onAgain: () => void }) {
  const [names, setNames] = useState<Map<number, { name: string }>>(new Map())
  useEffect(() => void speciesTable().then(setNames), [])
  if (step.found.length)
    return (
      <div className="mt-7">
        <p className="text-body font-semibold text-ink">
          {step.found.length} new {step.found.length === 1 ? 'species' : 'species lines'} in {step.save.trainer}’s save. Pick one to name.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {step.found.map((m) => (
            <li key={`${m.where}`}>
              <button onClick={() => onPick(m)} className="flex w-full items-center justify-between gap-4 rounded-field bg-paper-sink px-4 py-3 text-left text-body transition-colors hover:bg-paper-deep">
                <span className="font-semibold text-ink">{m.nickname || names.get(m.species)?.name}</span>
                <span className="text-meta text-ash">{m.where}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  // nothing has split yet: say how close the closest line is, in the Day Care's words
  const best = step.save.mons.filter((m) => m.genome.has && !m.isEgg).sort((a, b) => scoreVsWild(b.genome).d - scoreVsWild(a.genome).d)[0]
  const score = best ? scoreVsWild(best.genome).score : 70
  return (
    <div className="mt-7">
      <p className="display text-[2rem] leading-[0.95] text-ink">No real evolution in this save yet</p>
      <p className="mt-3 text-body text-ink-soft">
        {best ? (
          <>
            Your closest line is {best.nickname || names.get(best.species)?.name} ({best.where}). Next to a wild one, the Day Care would
            still say “{DAYCARE_LINE[score].replace('\n', ' ')}” Keep breeding the biggest ones.
          </>
        ) : (
          'None of the Pokémon in it carry Emerald Evolved genes. Was it saved in the patched game?'
        )}
      </p>
      <button className="btn btn-quiet btn-sm mt-6" onClick={onAgain}>
        Read a different save
      </button>
    </div>
  )
}

function Naming({ step, live, onDone, onBack }: { step: Extract<Step, { at: 'naming' }>; live: boolean; onDone: (c: Card, first: boolean) => void; onBack: () => void }) {
  const { mon, save } = step
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sub = { species: mon.species, genome: toHex(mon.packed), personality: mon.personality, generation: mon.generation, trainer: save.trainer, name: name || ' ' }
  const built = buildCard({ ...sub, name: name || 'Unnamed' })
  const preview: CardData | null = built.ok ? { ...built.card, name: name.trim() || 'Your species' } : null

  const add = async () => {
    const check = buildCard(sub)
    if (!check.ok) return setError(check.error)
    setBusy(true)
    setError(null)
    const r = await submitCard({ ...sub, otId: mon.otId })
    setBusy(false)
    if ('card' in r) onDone(r.card, r.first)
    else setError(r.error)
  }

  return (
    <div className="mt-7 flex flex-col gap-6">
      {preview ? <SpeciesCard card={preview} link={false} /> : <p className="text-meta text-refuse-ink">{!built.ok && built.error}</p>}
      <label className="flex flex-col gap-2">
        <span className="text-meta font-semibold text-ink-soft">Name your species</span>
        <input
          value={name}
          maxLength={SPECIES_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Up to ${SPECIES_NAME_MAX} letters`}
          className="rounded-field bg-paper-sink px-4 py-3 text-lead text-ink outline-none placeholder:text-ash-light focus-visible:ring-2 focus-visible:ring-sprout-ink"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {error && <p className="rounded-field bg-refuse-wash p-4 text-meta text-refuse-ink">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {live && (
          <button className="btn btn-ink" onClick={add} disabled={busy || !name.trim()}>
            {busy ? 'Adding…' : 'Add it to the registry'}
          </button>
        )}
        <button className="btn btn-quiet" disabled={!preview || !name.trim()} onClick={() => preview && saveCardImage({ ...preview, name: name.trim() }, shareUrl())}>
          Save the card as an image
        </button>
        <button className="text-meta font-semibold text-ash hover:text-ink" onClick={onBack}>
          Start over
        </button>
      </div>
      <p className="text-meta text-ash">
        Sent: the species, its genes, its personality value, the generation, your trainer name ({save.trainer}) and this name. Not your save.
      </p>
    </div>
  )
}

function Done({ card, first }: { card: Card; first: boolean }) {
  const [copied, setCopied] = useState(false)
  const url = shareUrl(card.id)
  return (
    <div className="mt-7 flex flex-col gap-5">
      <p className="display text-[2.2rem] leading-[0.92] text-sprout-ink" style={{ animation: 'drop-in 620ms var(--ease-spring) both' }}>
        {first ? 'The first real evolution ever made' : `Real evolution No.${card.no}`}
      </p>
      <SpeciesCard card={card} />
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-ink" onClick={() => saveCardImage(card, url)}>
          Save the card as an image
        </button>
        <button
          className="btn btn-quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
            } catch {
              prompt('Copy this link', url)
            }
            setCopied(true)
          }}
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}

/* /species/:id -- one card, on its own, for the link people share. */
export function SpeciesPage() {
  const { id = '' } = useParams()
  const [card, setCard] = useState<Card | 'missing' | null | 'loading'>('loading')
  const [copied, setCopied] = useState(false)
  useEffect(() => void fetchCard(id).then(setCard), [id])
  const url = shareUrl(id)
  return (
    <div className="mx-auto max-w-[640px] px-5 pt-8 sm:px-8 sm:pt-14">
      <Link to="/species" className="text-meta font-semibold text-ash hover:text-ink">
        Species Registry
      </Link>
      {card === 'loading' ? (
        <div className="mt-6 h-[520px] rounded-card bg-paper-sink" />
      ) : card === 'missing' || card === null ? (
        <div className="mt-6">
          <h1 className="display text-title">{card === null ? 'The registry isn’t open yet' : 'No species with that link'}</h1>
          <p className="mt-3 text-body text-ash">{card === null ? 'Cards can be saved as images until it is.' : 'It may have been removed, or the link is incomplete.'}</p>
        </div>
      ) : (
        <>
          <h1 className="sr-only">{card.name}</h1>
          {card.no === 1 && <p className="mt-6 text-body font-bold text-sprout-ink">The first real evolution ever made</p>}
          <div className="mt-3">
            <SpeciesCard card={card} size="hero" link={false} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn btn-ink" onClick={() => saveCardImage(card, url)}>
              Save the card as an image
            </button>
            <button
              className="btn btn-quiet"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url)
                } catch {
                  prompt('Copy this link', url)
                }
                setCopied(true)
              }}
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
          <p className="mt-10 text-body text-ink-soft">
            Made in Emerald Evolved, where Pokémon breed like real animals and a line kept apart long enough becomes its own species.{' '}
            <Link to="/play" className="font-semibold text-sprout-ink hover:text-ink">Play it in your browser</Link>.
          </p>
        </>
      )}
    </div>
  )
}
