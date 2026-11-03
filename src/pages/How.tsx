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
          <h2 id="why">Evolution isn’t a cutscene</h2>
          <p>
            In Pokémon, your Eevee touches a stone and turns into a Vaporeon. Every Vaporeon that has ever existed looks
            exactly the same.
          </p>
          <p>
            Real evolution is slower and a lot weirder. Babies come out slightly wrong. The useful mistakes get passed on.
            And if two groups are kept apart long enough, they stop being able to have babies together at all.
          </p>
          <p>
            So I rewrote Pokémon Emerald so it works like that. The home page shows the three rules running; this page
            explains them. Every egg can mutate: each gene copy has a small chance of changing when the egg is made, and
            sometimes the baby comes out a different color. You choose who breeds: keep picking the biggest one and the
            whole line grows, the same way people turned wolves into pugs. And two groups kept apart drift until the Day
            Care won’t take them together. Nobody decides that’s a new species. It just happens.
          </p>

          <h2 id="genes">Every Pokémon has genes now</h2>
          <p>
            In the original game a Pokémon’s stats are rolled once, at random, and that’s it. In this hack every Pokémon
            carries two copies of each gene, one from mom and one from dad, and a baby gets one of each parent’s two
            copies at random. That’s Mendel’s rule from 1866 and it’s the same rule my <strong>Real Genetics</strong> patch
            ships.
          </p>
          <p>
            The genes that show are coat color, the color of the ruff, and body size. A few more are invisible. They do
            nothing to the Pokémon, they just change slowly over time, and that turns out to matter a lot later.
          </p>
          <p>
            The colors are real palette swaps. A GBA sprite is a picture made of numbers that point into a list of
            sixteen colors, and a coat gene rotates the hue of the four colors that paint the body. Every color gets
            snapped back to the 15-bit colors the GBA can actually show, so nothing on screen is a color the cartridge
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
            In the game this is <code>InheritGenome()</code> in the hack’s <code>src/genetics.c</code>, with the real
            gene layout. The sandbox runs a simpler version, <code>Sim.step()</code> in this site’s{' '}
            <code>src/sim/engine.ts</code>.
          </p>

          <h2 id="selection">Selection</h2>
          <p>
            Nothing in the game decides which mutations are good. You do. Whoever you put in the Day Care gets to have
            babies, and whoever you don’t, doesn’t. Breed the greenest one every time and the line drifts green. That’s
            how people turned wolves into pugs, and it’s the same thing nature does, just with a habitat doing the
            picking instead of you.
          </p>
          <p>
            In the <Link to="/sandbox">sandbox</Link> the habitat does it: each side of the map favors a different coat
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
            In this hack, for Pokémon of the same family, that check is genetic. Every Pokémon carries four pairs of
            genes, A1 to A4 and B1 to B4, and each one comes in an old version and a new one. The new versions also
            make the Pokémon bigger, so when you keep breeding the biggest ones you’re pushing them in. A new B next
            to an old A doesn’t work together. Biologists call that a Dobzhansky–Muller incompatibility, and it’s how
            most real species stop being able to have babies together.
          </p>
          <div className="code-plate" role="region" aria-label="New compatibility rule">
            <span className="c">{'// Emerald Evolved: the Day Care counts finished incompatibilities'}</span>
{`
d = 0;
for (i = 0; i < 4; i++)
    if ((B[i] of one parent is new/new) && (A[i] of the other is old/old))
        d++;
return (u8[]){ 70, 50, 20, 0 }[min(d, 3)];  `}<span className="c">{'// the game’s own four scores'}</span>
          </div>
          <p>
            Those four numbers are the ones Emerald already uses, and each one comes with its own line from the Day Care
            man. As your line drifts away from the wild ones he goes from “The two seem to get along very well” to “The
            two seem to get along” to “The two don’t seem to like each other much”. At three finished pairs you get the
            game’s line for parents that won’t breed: “The two prefer to play with other POKéMON than each other.”
            Nobody decided they’re a new species. It falls out of the rule.
          </p>
          <p>
            Breeding the biggest one every time gets a line there in about twenty generations; breeding casually never
            does. The <Link to="/sandbox">sandbox</Link> runs a simpler version of the same idea on a whole population at once, so you
            can watch it happen in a minute. When it happens in your game, the <Link to="/species">Species Registry</Link> reads
            your save and lets you name what you made.
          </p>
          <div className="not-prose my-10 flex items-end justify-center gap-10">
            <Creature coat={0.48} mane={0.15} scale={2} label="A green Eevee lineage" />
            <Creature coat={0} scale={2} label="An ordinary Eevee" />
            <Creature coat={-0.55} mane={-0.2} scale={2} flip label="A dark Eevee lineage" />
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
            <li>Every window, font and interface sprite on this site is from Pokémon Emerald itself, extracted from the decompilation. The Pokémon on species cards are the sprites the hack draws, from pokeemerald-expansion’s graphics. Pokémon is © Nintendo, Creatures and GAME FREAK.</li>
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
