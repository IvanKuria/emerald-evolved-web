import { Link } from 'react-router'
import { Creature } from '../components/Creature'

/* How it works. A document, typeset as one: a single measure, real
   space between sections, no rules. The tone is the video's -- plain,
   first person, no lecture. */

export function How() {
  return (
    <article className="mx-auto max-w-[var(--page)] px-5 pt-10 sm:px-8 sm:pt-16">
      <h1 className="display max-w-[17ch] text-hero">How real evolution works in Emerald</h1>
      <p className="mt-6 max-w-[48ch] text-quiet leading-[1.5] text-ink-soft">
        Three rules, all borrowed from real biology, all running on a Game Boy Advance. Here’s what each one does and
        where it lives in the code.
      </p>

      <div className="mt-20 grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="prose">
          <h2 id="genes">Every Pokémon has genes now</h2>
          <p>
            In the original game a Pokémon’s stats are rolled once, at random, and that’s it. In this hack every Pokémon
            carries two copies of each gene, one from mom and one from dad, and a baby gets one of each parent’s two
            copies at random. That’s Mendel’s rule from 1866 and it’s the same rule my <strong>Real Genetics</strong> patch
            ships.
          </p>
          <p>
            The genes that show are coat colour, the colour of the ruff, and body size. A few more are invisible. They do
            nothing to the Pokémon, they just change slowly over time, and that turns out to matter a lot later.
          </p>
          <p>
            The colours are real palette swaps. A GBA sprite is a picture made of numbers that point into a list of
            sixteen colours, and a coat gene rotates the hue of the four colours that paint the body. Every colour gets
            snapped back to the 15-bit colours the GBA can actually show, so nothing on screen is a colour the cartridge
            couldn’t make.
          </p>

          <h2 id="mutation">Mutation</h2>
          <p>
            When the Day Care makes an egg, each gene copy has a small chance of changing a little. Most changes are too
            small to see. Every so often one is big. That’s it, that’s the whole source of everything new in the game.
          </p>
          <div className="code-plate" role="region" aria-label="Mutation code">
{`for (g = 0; g < GENES; g++) {
    egg[g][0] = mom[g][Random() & 1];   `}<span className="c">{'// one copy from each parent'}</span>{`
    egg[g][1] = dad[g][Random() & 1];
    for (a = 0; a < 2; a++)
        if (Chance(mutationRate))
            egg[g][a] += Gaussian(step[g]);  `}<span className="c">{'// usually tiny, sometimes not'}</span>{`
}`}
          </div>
          <p className="quiet">
            The browser version of this is <code>Sim.step()</code> in <code>src/sim/engine.ts</code>. The C version lands
            in <code>src/daycare.c</code> when the patch is released.
          </p>

          <h2 id="selection">Selection</h2>
          <p>
            Nothing in the game decides which mutations are good. You do. Whoever you put in the Day Care gets to have
            babies, and whoever you don’t, doesn’t. Breed the greenest one every time and the line drifts green. That’s
            how people turned wolves into pugs, and it’s the same thing nature does, just with a habitat doing the
            picking instead of you.
          </p>
          <p>
            In the <Link to="/sandbox">sandbox</Link> the habitat does it: each side of the map favours a different coat
            and size, and the ones closer to their side’s ideal have more babies.
          </p>

          <h2 id="speciation">Speciation</h2>
          <p>
            This is the part I’m proudest of. In the original game, whether two Pokémon can breed is a lookup table.
            Every species belongs to one or two egg groups, and the Day Care checks if they share one:
          </p>
          <div className="code-plate" role="region" aria-label="Original Day Care code">
            <span className="c">{'// pokeemerald, src/daycare.c, GetDaycareCompatibilityScore()'}</span>
{`
if (!EggGroupsOverlap(eggGroups[0], eggGroups[1]))
    return PARENTS_INCOMPATIBLE;`}
          </div>
          <p>
            In this hack that table is gone. Two Pokémon can breed if their genes are close enough, measured on the
            hidden genes plus coat colour. Lots of real animals pick mates by colour, which is how hundreds of cichlid
            species split apart in one African lake.
          </p>
          <div className="code-plate" role="region" aria-label="New compatibility rule">
            <span className="c">{'// Real Evolution: compatibility is genetic distance'}</span>
{`
if (GeneticDistance(mon[0], mon[1]) > COMPAT_LIMIT)
    return PARENTS_INCOMPATIBLE;`}
          </div>
          <p>
            So when two groups get kept apart, by a river, or by you only ever breeding them separately, the hidden genes
            drift apart until the Day Care gives you the game’s own line for parents that won’t breed: “The two prefer
            to play with other POKéMON than each other.” Nobody decided they’re a new species. It falls out of the rule.
          </p>
          <div className="not-prose my-10 flex items-end justify-center gap-10">
            <Creature coat={0.48} mane={0.15} scale={2} label="A green Eevee lineage" />
            <Creature coat={0} scale={2} label="An ordinary Eevee" />
            <div style={{ transform: 'scaleX(-1)' }}>
              <Creature coat={-0.55} mane={-0.2} scale={2} label="A violet Eevee lineage" />
            </div>
          </div>

          <h2 id="browser">How the browser plays it</h2>
          <p>
            The site never has a copy of Pokémon. You give it yours, and everything happens inside the tab:
          </p>
          <ul>
            <li>
              Your file’s SHA-1 is checked against the one retail Emerald (US) the patch is built on,
              <code>f3ae0881…d07b7</code>. If it’s a different game or a modified copy, it tells you which.
            </li>
            <li>
              The patch is a <code>.bps</code> file, the same format Flips and Rom Patcher use. The site applies it with
              its own patcher and checks every checksum the format has.
            </li>
            <li>
              The patched game runs in <strong>mGBA</strong>, compiled to WebAssembly. Your save is kept in your
              browser’s storage for this site, and you can export it any time.
            </li>
          </ul>

          <h2 id="credits">Credits</h2>
          <ul>
            <li>pret’s <strong>pokeemerald</strong> decompilation, and rh-hideout’s <strong>pokeemerald-expansion</strong>, which the hack is built on.</li>
            <li><strong>mGBA</strong> by endrift and contributors, WebAssembly build by Nicholas VanCise (thenick775), MPL-2.0, distributed unmodified.</li>
            <li>Every sprite, window, font and sound on this site is from Pokémon Emerald itself, extracted from the decompilation. Pokémon is © Nintendo, Creatures and GAME FREAK.</li>
            <li>Bebas Neue by Ryoichi Tsunekawa and Figtree by Erik Kennedy, both under the SIL Open Font License.</li>
          </ul>
        </div>

        <nav className="hidden lg:block" aria-label="On this page">
          <div className="sticky top-28 flex flex-col gap-2 text-body font-semibold">
            {[
              ['genes', 'Genes'],
              ['mutation', 'Mutation'],
              ['selection', 'Selection'],
              ['speciation', 'Speciation'],
              ['browser', 'In the browser'],
              ['credits', 'Credits'],
            ].map(([id, t]) => (
              <a key={id} href={`#${id}`} className="text-ash transition-colors hover:text-ink">
                {t}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </article>
  )
}
