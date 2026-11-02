import { Link } from 'react-router'
import { EMERALD } from '../lib/rom'
import { SITE } from '../lib/site'

/* Download. For people who would rather play in a desktop emulator or
   on a flash cart. The patch, the source, and the two checksums that
   prove you have the right files. */

export function Download() {
  return (
    <div className="mx-auto max-w-[var(--page)] px-5 pt-10 sm:px-8 sm:pt-16">
      <h1 className="display text-hero">Download</h1>
      <p className="mt-5 max-w-[50ch] text-lead text-ink-soft">
        Want to play in a desktop emulator, or on real hardware with a flash cart? Patch your own copy with the file
        below. You still need your own Pokémon Emerald (US): the patch contains only the changes.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-10 rounded-card bg-paper-lift p-8 shadow-card sm:p-10">
          <div>
            <p className="display text-title">Real Evolution {EMERALD.version}</p>
            <p className="mt-2 text-body text-ash">pokemon-real-evolution.bps</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {SITE.patchReady ? (
              <a href={EMERALD.patchUrl} download className="btn btn-ink">Download the patch</a>
            ) : (
              <button className="btn btn-ink" disabled>Download the patch</button>
            )}
            <a href={SITE.github} className="btn btn-quiet" rel="noreferrer">Source on GitHub</a>
          </div>
          {!SITE.patchReady && <p className="text-meta text-ash">The patch goes up the day the video does.</p>}
        </div>

        <div className="rounded-card bg-paper-sink p-8 sm:p-10">
          <h2 className="text-body font-bold text-ink">Patch it yourself</h2>
          <ol className="mt-4 flex flex-col gap-3 text-body text-ink-soft">
            <li><span className="font-semibold text-ink">1.</span> Open Rom Patcher JS or Flips.</li>
            <li><span className="font-semibold text-ink">2.</span> Choose your Emerald as the ROM and the .bps as the patch.</li>
            <li><span className="font-semibold text-ink">3.</span> Load the result in mGBA, or copy it to your flash cart.</li>
          </ol>
          <p className="mt-6 text-meta text-ash">
            Or skip all that and <Link to="/play" className="font-semibold text-sprout-ink hover:text-ink">play in the browser</Link>.
          </p>
        </div>
      </div>

      <section className="mt-20 max-w-[760px]">
        <h2 className="display text-title">Checksums</h2>
        <p className="mt-3 text-body text-ash">If the patch refuses your ROM, compare its SHA-1 with the first line.</p>
        <dl className="mt-6 flex flex-col gap-5">
          <div>
            <dt className="text-meta font-semibold text-ink">Your ROM, before patching: Pokémon Emerald (USA, Europe)</dt>
            <dd className="mt-1 font-mono text-meta break-all text-ink-soft">{EMERALD.sourceSha1}</dd>
          </div>
          <div>
            <dt className="text-meta font-semibold text-ink">After patching</dt>
            <dd className="mt-1 font-mono text-meta text-ash">Published with the release</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
