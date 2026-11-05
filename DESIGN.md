# Emerald Evolved: the website

The home of **Emerald Evolved**, a Pokémon Emerald ROM hack built on pokeemerald-expansion that adds
mutation, selective breeding and speciation. The game is the product and the site is its home: play
it in the browser, watch the rules in a sandbox, and register the species you make. It launches with
the main-channel video "I Gave Pokémon Real Evolution (And You Can Play It)".

Stack: Vite 8, React 19, React Router 8, Tailwind 4, TypeScript. No UI kit. The only runtime
dependency of any size is the mGBA WebAssembly core.

```
npm install            # also copies mGBA into public/mgba on dev/build
npm run dev            # https://0.0.0.0:5180, self-signed cert, COOP/COEP on
npm test               # BPS, SHA-1, ROM id, save parser, palette, card, registry and counter tests
DEV_STORE=memory npm run dev       # the same, with an in-memory store behind /api (counter, registry)
npx tsx scripts/make-test-save.ts shots/test-save.sav   # a synthetic save for the registry run
node scripts/shots.mjs             # every page at desktop and phone, the split moments, the registry
                                   # flow and the Play flow end to end (Playwright)
node scripts/phone-check.mjs       # touch-only Play flow: WebKit/iPhone 15 and Chromium/Pixel 7
```

There is no demo data anywhere. Without a store the API answers 503 and the site hides the counter
and the registry's gallery; with `DEV_STORE=memory` they show only what you put in them.

---

## 1. Information architecture

| Route | Job | What's on it |
|---|---|---|
| `/` | Make the idea land in five seconds, then get people to Play | Seven beats, each an event on screen with a caption of eight words or fewer (section 2a). No paragraphs: the explanations are on How it works. |
| `/play` | Turn "I have a ROM" into "I'm playing" | Four visible steps (Your ROM, Checked, Patched, Playing), a drop zone where the game's window does the talking, the emulator, saves, touch controls. |
| `/species` | The share loop: what players have made, and the way in for yours | The first species ever made in its own spot, "Register yours" (reads a save in the tab, finds lines that have split off, name one, card), the newest cards. |
| `/species/:id` | The link people post | One card, Save image, Copy link, a way to Play. |
| `/sandbox` | Make a new species by hand in about a minute, then go do it in the game | A guided toy (section 2b): the Day Care man's goal, COLLECT EGGS, keep the tallest pair, AUTO-BREED once earned, the split, a name and a preview card, then challenges. Settings in a drawer. |
| `/how-it-works` | The science and the code, for the curious and for people who will ask "is it real?" | Long-form, one measure, real code from pokeemerald next to the new rule. Credits. |
| `/download` | For desktop emulators and flash carts | The .bps, GitHub, checksums, how to patch by hand. |

The navigation names things by what people do (Play, Species, Sandbox), not by how they are built.
### 2a. Home (v2, Nov 2026)

Rebuilt after the owner rejected v1 (too much text, an uncreative composition, a weak sandbox
showcase). The bar is frame-site's own home page, and its components are reused, adapted: `TextType`
(plus `renderText`, so the game's message box draws what it types), `CountUp`, `Rise`, and the two
easing tokens. The belts started as frame's fancycomponents marquees and were replaced by
`components/PathBelt.tsx` after the owner called the arcs choppy and `scripts/measure-belts.mjs`
agreed: one dt-based rAF loop, velocity eased with 1 - e^(-k dt), positions from an arc-length lookup
table as fractional translate3d, facing with hysteresis. Measured at 60 Hz (GPU, and CPU throttled
4x): cruising jerk p95 0.2-0.4 -> 0.012 px/frame, release fling peak 12-14 -> 1-2 px/frame. Motion
for entrances, GSAP ScrollTrigger for the two pinned sections.

1. **Hero** (`home/Hero.tsx`, `Arcs.tsx`, `Walker.tsx`, `Wordmark.tsx`): frame's two mirrored
   arcs, geometry derived from the box (and, on a tall phone, the window's proportions). The belts
   carry Eevee's follower sprite from pokeemerald-expansion, upright on the curve by its feet,
   facing the way the belt runs and stepping with the distance covered (sAnim_Go*2F). Top: a wild
   herd, each with its own genes. Bottom: genes as a function of place, so the line evolves as it
   walks. Grab, flick, slows under the pointer. Hovering the wordmark runs the real hatch on its egg.
2. **Every egg can mutate.** (`EggSection.tsx`, `hatch.ts`, `lib/front.ts`): egg_hatch.c frame by
   frame, a mutant out of the ROM's palette function doing Eevee's real front animation, onto a
   shelf. The PC's hand cursor bounces over the egg.
3. **You choose who breeds.** (`Pedigree.tsx`): pinned and scrubbed; each generation a litter from
   the kept one, under the PC's hand cursor (sAnim_Cursor_Bouncing / Open / Fist). Tap to keep.
4. **Until they can't.** (`Split.tsx`): pinned; the real animated ocean between two banks, the Day
   Care man's four lines typed into the message box as you reach them, the HP-colored bar, 2 species.
5. **Play it in your browser.** (`PlayDevice.tsx`): a screen in a plain ink body; drop the ROM on
   it. A game menu (standard window frame, ▶ cursor) offers the file picker or the test cartridge.
   The boot capture is a marked PLACEHOLDER until the real one exists.
6. **Name yours.** (`RegistryBelt.tsx`): real registry cards on a simple-marquee belt; with none,
   the egg and "The first species goes here."
7. **Close**: one line, one button, the hand pointing at it.

Game UI is used as UI wherever it fits: the PC hand is the mouse cursor over things you can grab
(open, then a fist) and press (pointing), the menu is the game's menu, the verdict is the game's
message box. `scripts/record-home.mjs` records each section at desktop and phone for review.

### 2b. Sandbox (v3, Nov 2026)

Rebuilt after the owner rejected the slider dashboard ("a page out of a book", "I have no idea how I
would even start"). It is now taught by doing, in the game's own UI:

- **One goal on arrival**, in the message box: "Breed a POKéMON that won't play with the wild ones.
  Collect some eggs!" Every line is measured against the font's width table to fit two lines.
- **One action**, a game menu (standard window frame, ▶) with the PC hand pointing at it.
- **The litter is a PC box** (`sandbox/PcBox.tsx`): party icons recolored the hack's way (pixel-weighted
  hue cluster, 22.5-degree buckets), bobbing on sAnim_1, the summary's HEIGHT under each in the game
  font with ♂/♀ in the summary's colors. Eggs drop in, wobble and hatch with a white blend; failed
  eggs stay eggs. The hand points, opens, closes; kept slots go HP-bar green.
- **The yard** (`sandbox/Yard.tsx`): the two parents as front sprites at their real size; a new
  parent plays Eevee's front animation.
- **The meter** is the Day Care's verdict on the line next to a wild Eevee, in its four lines, with the
  HP bar in its colors.
- **AUTO-BREED ×10** unlocks after three generations by hand and keeps the tallest pair.
- **The payoff** (`sandbox/Reveal.tsx`): the last Day Care line, a full-screen fade to white at the
  hatch's coefficients, the new species doing its front animation, NAME IT, and the registry card as
  a preview, with "Do it for real" to /play. Then three challenge cards.
- **The model** (`sandbox/line.ts`) is the ROM's rules for the size and color genes: 8 size loci,
  mutation 1/64, wild A 1/20, the 2^-n hatch rule, d = completed B loci, 1-in-8 daughters, hue
  mutation 1/24. `tests/sandbox.test.ts` checks it against the ROM's measurement (median generations
  to a new species, keeping the tallest of 10 eggs: 31 in the ROM; 22-40 required here).

Nothing on the site is numbered except the Play steps, which really are a sequence.

## 2. Design decisions, and where each comes from

The brief: frame-site's component craft, merged with the video's white editorial page and real
GBA assets. Not a shadcn template, not a dark gaming site.

### From the video house style (`video/HOUSE_STYLE.md`, the thumbnail compositors)

- **The page is the thumbnail page.** `#f4f2ee` (the house paper), with the thumbnails' own grain
  plate (`g2.png`) tiled over the whole document and multiplied in at 7.5%. It sits above content
  on purpose, as in the thumbnails, where the grain is on the sprites too.
- **Bebas Neue ink headlines** (`compose_banner.py` uses `bebas.ttf` and INK = (21, 21, 21)). Used
  only for what a thumbnail would say: the hero title, section heads, the big "GEN 51 / 2 SPECIES"
  readout in the sandbox. Never for labels or body copy.
- **Real game objects with the house drop shadow.** Every sprite is from the game itself:
  Eevee's `anim_front.png` (both frames) and its palettes, the egg, its hatch frames and its
  party-menu icon (the logo), the message box, the HP bar tiles in green, yellow and red, the
  message font, and the front sprite and palettes of species 1-386 for the cards. The shadow is the
  thumbnails' recipe (silhouette, offset down-right, blurred, ~26%), built from each sprite's own
  alpha and tinted warm because it falls on paper. Nothing is drawn by hand: the touch controls are
  plain ink shapes, not a drawing of a Game Boy.
- **"The game's vocabulary, our sentences"** (the direction the owner loved on the Pokémon film).
  The game speaks in its own font inside its own window, saying our lines: "Drop your POKéMON
  EMERALD here", "A mutation! An EEVEE hatched with a greener coat." The payoff line is a real
  string from `src/strings.c` (`gDaycareText_PlayOther`): "The two prefer to play with other
  POKéMON than each other." In the original game it means two Pokémon can't breed. Here it is how
  you find out you made a new species.
- **House physics.** In the hero every egg hops out of its mother's spot on an arc, uses Eevee's
  second animation frame in the air, and its shadow stays on the ground. Things travel; nothing
  pops in. (An earlier squash on landing was cut: it stretched pixels by a fraction.)
- **Palette swaps, not tints.** Coat genes rotate or darken the four body palette entries and the
  result is snapped to BGR555 and widened the way the GBA does. Up from Eevee's brown the coat walks
  toward leaf green; down it darkens toward a chocolate near-black (melanism, the same black coat
  the Real Genetics patch has). A first pass used pure hue rotation and produced magenta Eevee; it
  was cut.
- **Progress is the HP bar.** Checking and patching fill a real six-tile HP bar from `hpbar_green_0..8`,
  lit pixel by pixel the way the battle healthbox draws HP.

### From frame-site (`IvanKuria/frame-site`)

- **One body face, one accent, and a darker accent for text.** Figtree, self-hosted (no font CDN,
  which also keeps the page cross-origin isolated). The accent is the game's HP-bar green
  `#5ad684` (read off `hpbar_green_8.png`), used only for things that are alive or passed: the live
  dot, a split, a completed step. `--sprout-ink #1c7043` is the same green deepened to pass AA, for
  text. The only other colour is a refusal red from the Poké Ball, for "that's not the right ROM".
- **No dividers.** Not in the nav, not between sections, not in the footer. Distance separates
  things. The nav gets a soft shadow only once the page scrolls under it.
- **Layered card shadows and pill buttons**, values copied from frame-site's `--shadow-card` and
  `--shadow-lift`, warmed for the paper. Ink pill primary that turns the accent on hover with the
  arrow nudging right; quiet sunk pill secondary.
- **Code that explains itself.** Each component opens with a comment on why it is the shape it
  is, the way frame-site's are (OrbitCarousel, Spotlight, OneClip). Reviewers read code.
- **Motion that answers.** frame's belts move on their own because they are the content; here the
  arcs do, and the egg hatches by itself only while it is on screen. Everything else is driven by
  the reader: the pedigree and the split are scrubbed by the scroll and run backwards with it, the
  belts are grabbed, the wordmark hatches under the pointer. One ease for all of it.
- **Honesty in the interface.** frame-site's Spotlight refuses to fake search results; here the
  counter shows nothing until it has a real number, the Download button is disabled with a reason
  until the patch exists, and errors say which file is wrong and what to do.

### Whole pixels (`src/lib/pixels.ts`)

A game pixel is a clean square only when it covers a whole number of the screen's own pixels, so
every pixel asset asks `deviceScale()` / `fitScale()` for a whole number of DEVICE pixels per game
pixel and is laid out at that divided by `devicePixelRatio`. That is what keeps the message font
sharp on a 125% Windows screen too. Choices by room: the message box is 4x on wide screens, 3x on a
laptop column, 2x on a phone, where it gets narrower in game pixels (and turns pages like the game)
instead of smaller pixels. The GBA screen is the largest whole scale that fits, up to 4x. In the
field the size gene picks the whole scale a creature is drawn at; nothing is stretched by a
fraction, rotated or squashed (the egg shakes sideways by whole pixels, as `egg_hatch.c` does).

### The split, made visible

Before a population splits, the readout under the field is the Day Care's verdict on one Eevee
from each side (`src/sim/daycare.ts`): the game's real lines and scores (70/50/20/0, from
`include/constants/daycare.h` and `gDaycareText_*` in `src/strings.c`), with a bar in the game's
own HP colours that walks down a pixel at a time. It never says two species before the engine has
found two. At the split the bar empties, the Day Care says the line that means "won't breed", both
banks hop once in a wave rolling out from the river, the river sinks a shade deeper, and then the
count drops in. In the field, positions are the engine's, relaxed apart for display only, so
crowds stay readable; shadows are a light contact patch under the feet.

### What was deliberately not done

- No dark theme, no neon, no gradient washes, no glassmorphism cards.
- No all-caps eyebrow labels, no numbered markers on things that aren't sequences, no "→" glued
  to every link.
- No YouTube embed: it would break cross-origin isolation, which the emulator needs. The video
  is a link (`SITE.video`), and until it is set the hero's second button is "Try the sandbox".

## 3. The engine (`src/sim/engine.ts`)

Shared by the hero, the sandbox and the How page's numbers, and written as the reference for the
ROM hack's C:

- **Genome.** Diploid, six genes: coat (selected), ruff colour (neutral), size (selected), three
  hidden neutral genes. A trait is the mean of two alleles; each egg takes one allele from each
  parent at random (Mendel).
- **Mutation.** Each copied allele mutates with probability 1.5% to 26.5% (the slider), by a normal
  step; 6% of mutations are 3.2x larger, which is what makes the occasional visibly different baby.
- **Selection.** Soft selection: an egg's location is a random point on the ground, the nearest
  creature's neighbourhood breeds there, and within it the fitter are more likely to be parents.
  Without the "random point" step one habitat's winners took over the whole map and a crowd bred
  crowds into a single clump; both were seen in headless runs and fixed.
- **Speciation.** Two creatures can mate only if their genetic distance (hidden genes plus half
  weight on coat, since many real animals choose mates by colour) is under 0.55. Species are found,
  not declared: union-find over every compatible pair. A split must hold three generations running
  before it is called, and species never merge back, so a few river-crossing hybrids cannot make a
  species flicker in and out of existence.
- **Deterministic.** Seeded PRNG (mulberry32). The sandbox URL carries seed, settings and
  generation, so a link replays the exact run.

Measured (headless, `scripts/tune.ts`): with the river and two habitats, 120 creatures first split
at generation 60 to 350 depending on seed; the hero (seed 42, 56 creatures) first splits at 46, so
about 25 seconds after the page opens. With no river the cline holds together and no split happens,
which is the real-biology answer too.

## 4. Play: ROM check, patch, emulator

### The ROM never leaves the machine

The file is read with `File.arrayBuffer()`, hashed in the tab, patched in the tab and written to
the emulator's IndexedDB-backed filesystem for this origin. There is no upload endpoint at all.
The only network requests on /play are the site's own files and the .bps.

### SHA-1

Emerald (USA, Europe) is `f3ae088181bf583e55daf962a92bb46f4f1d07b7`. Double-checked against
pret/pokeemerald's README and against the owner's shipped Real Genetics `make_patch.sh`, which
verifies its vanilla build byte-for-byte against the same hash. `crypto.subtle` is used where
available; a plain SHA-1 (`src/lib/sha1.ts`, tested against Node at block-boundary lengths) covers
non-secure origins so a LAN dev server can't masquerade as "your ROM is wrong".

A refusal reads the header to say something useful: "That's Pokémon FireRed", "That's Emerald, but
not an untouched copy" (code BPEE, wrong hash), "That isn't a Game Boy Advance game".

### BPS (`src/lib/bps.ts`)

A full decoder (SourceRead, TargetRead, SourceCopy, TargetCopy with overlapping runs) that checks
all three CRC32s and both sizes, with errors that name the guilty file. Plus a greedy encoder used
for tests and the test patch. Verified both ways against an independent implementation:

- Flips created a patch, our decoder applied it to the right hash.
- Our encoder created `public/test/evotest-mutant.bps`, Flips applied it to the right hash.
- 11 vitest cases: CRC check value, SHA-1 vs Node, Flips-made patch, our patch, a 1 MB random
  round trip with inserts, deletes and runs, hand-built overlapping TargetCopy, wrong source,
  damaged patch, header identification.

### Test cartridge (`testrom/`)

A 1 KB homebrew GBA ROM written for this site (C plus a hand-written header, CC0, no Nintendo
code), built with arm-none-eabi-gcc. A square "creature" whose colour and size are its genes,
stored behind the magic `EVOGENE!`; D-pad moves it, A adds a dot and writes the count to SRAM.
`evotest-mutant.gba` changes the two genes (orange, bigger). The .bps between them exercises the
whole pipeline with no copy of Pokémon anywhere. Verified end to end in Chromium by
`scripts/shots.mjs`: hash, patch, boot, the mutated colour on screen, arrow-key movement, five
SRAM writes, reload, "Continue playing", the dots are still there.

### Emulator and licence

**mGBA via `@thenick775/mgba-wasm` 2.6.0** (updated Oct 2026; it powers gbajs3). Chosen over
EmulatorJS because it is the actual mGBA core with a small typed API (FS, `loadGame`,
`buttonPress`, save callbacks) instead of a full player UI to restyle, and it is about 2 MB.

- Licence: MPL-2.0. File-level copyleft: we ship its files unmodified, keep the notice
  (`public/mgba/NOTICE.txt`, written by `scripts/copy-mgba.mjs`) and link the source. Our own code
  is unaffected. Credits on /how-it-works.
- EmulatorJS would also have worked (GPL-3.0 player plus the mGBA libretro core), but GPL on the
  player and its larger runtime were worse fits.
- The core uses threads, so the page must be **cross-origin isolated** (COOP same-origin + COEP
  require-corp) and on a **secure origin**. Dev serves HTTPS with a self-signed certificate;
  production sets the same headers in `vercel.json`. The page detects a missing isolation and says
  so instead of failing silently.
- It is loaded by URL from `/mgba/` rather than bundled: its loader finds `mgba.wasm` and starts
  its pthread workers from its own URL, and the dev server refuses to transform files in public/.

Saves: the game's SRAM writes trigger a debounced `FSSync()` to IndexedDB; `pagehide` flushes too.
Export save downloads the `.sav`; Import save loads one and reloads. "Forget this game and its
save" deletes both. The patched game stays in this browser's storage so "Continue playing" works
without dropping the ROM again.

Touch controls appear under the screen on narrow viewports: a D-pad that reads the thumb's angle
(so you can roll between directions and get diagonals), A/B, L/R, Start/Select, all pointer
events with capture so a sliding thumb still releases.

## 5. Backend: counter and Species Registry (Vercel)

### Shape

- `api/registry/index.ts`, `api/registry/[id].ts`
  are Vercel Functions (web `Request`/`Response` handlers). They hold no logic of their own.
- `server/store.ts` is the only code that touches storage: a handful of Redis commands behind one
  interface. Implementations: Upstash Redis over its REST API (plain `fetch`, no SDK) and memory
  (dev and tests, only with `DEV_STORE=memory`). Swapping provider is one more object with the same
  methods. No configuration means no store, and every endpoint answers 503.
- `server/dev-api.ts` mounts the same functions in the Vite dev server, so local runs exercise the
  code that deploys.
- `vercel.json` sets COOP/COEP on every response (the emulator's threads need cross-origin
  isolation), long caching on `/mgba` and `/game`, and rewrites every non-API route to the app.

### The Species Registry

- **The save never leaves the browser.** `src/save/gen3.ts` reads the newest valid slot (sector
  ids, checksums, counters), the party and all 14 boxes, decrypts each Pokémon (personality XOR OT
  id, substruct order by personality % 24, checksum verified) and reassembles the 77 genome bits
  from the fields the hack keeps them in, plus the two Day Care Pokémon. Every offset and bit
  position lives in one module, `src/save/layout.ts`, which follows the ROM's single source of
  truth (`research/pokemon-evolution/BUILD_STATUS.md` "Save format" and its reference decoder
  `web/genome_decode.py`). `tests/save.test.ts` runs the parser on the ROM's own three test saves
  (`tests/fixtures/0*.sav`): 01 (wild pair) and 02 (generation 10) have no new species, 03's
  generation-24 line is one and its wild Eevee isn't, with the same genotypes, sizes and
  generations the reference decoder prints. A synthetic save built from the layout module covers
  boxes, rotated sectors, an older slot and damaged data.
- **A new species** is a Pokémon whose speciation genotype scores 0 against the wild type under the
  sim's rule (`sim/speciation_sim.py`): at least three B loci homozygous derived, the wild type
  being ancestral everywhere (`src/save/genome.ts`).
- **The card** is the real front sprite of the species (expansion graphics, `scripts/extract_species.py`)
  recoloured with the ROM's own palette maths (`src/registry/palette.ts`, a line-for-line port of
  `ApplyGenesTo16` in `port/src/genetics_palette.c`: coats recolour the whole palette, the hue gene
  only the dominant body-hue band). `scripts/make-palette-fixture.py` lifts that C into a harness;
  compiled and run, it produced `tests/fixtures/palette-expected.json`, 36 cases over four species,
  which the TypeScript matches exactly. Plus size as the game shows it (`min(512, 240 + 4 x size) /
  256`, 0.94x to 2.0x), the generation counter, trainer name and the player's name for it. It is a page (`/species/:id`) and a 1200x630 PNG drawn
  in the browser.
- **Only the card data is sent**: species number, the 77 genome bits, personality, generation,
  trainer name, the chosen name, and the OT id for de-duplication. The page lists exactly that.
- **Abuse guards** (`server/registry.ts`): the server rebuilds the card from the genome with the
  same `buildCard()` and stores its result, never the client's numbers, and refuses anything that
  isn't a split; names must fit the game's character set and length (12 for a species, 7 for a
  trainer) and pass a folded blocklist (`src/registry/names.ts`); 5 registrations per hour per
  address, counted under a salted hash that expires with the hour; one card per Pokémon (OT id +
  personality, `SET NX`). To hide a card: `ZREM cards <id>` and `DEL card:<id>`.
- **"The first species ever made"** is the earliest card in the `cards` sorted set.

### Deploying

1. Import the repo in Vercel. Framework preset Vite; build `npm run build`, output `dist`
   (both already in `vercel.json`).
2. Storage: in the project, Storage -> Marketplace -> Upstash Redis -> create and connect. That
   adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (the code also accepts `UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN`).
3. Add `REGISTRY_SALT` (any long random string) for the rate-limit hash.
4. Deploy. Check `https://<domain>/api/registry` returns `{"total":0,...}` and `/play` says nothing
   about isolation. With no keys the site still works and simply hides the counter and gallery.
5. The patch is not in the repo; it is a GitHub release asset. Set `PATCH_URL` in the Vercel
   project to the asset's download URL. `scripts/fetch-patch.mjs` (run before every build) downloads
   it into `public/patch/`, checks its SHA-1 (`6bda9a1e...`) and the site then serves it from its
   own origin, which the cross-origin-isolated Play page needs. Without it, Play checks the ROM and
   says the patch isn't out yet, and Download disables its button. Locally, `PATCH_FILE=<path>`.

Cost: the counter is one small request per open tab every 25 s (GET cached 5 s at the edge); the
registry is a few commands per card. Both fit Upstash's free tier at modest launch numbers; past
that, the pay-as-you-go tier is per command.

### The real ROM, end to end

`scripts/real-rom-check.mjs <retail Emerald> <a save>` (PC only; neither file is in the repo):
the retail ROM goes in, is checked, the 24 MB release patch downloads and applies (the bar is half
download, half patching), the SHA-1 of the result must be `b833daac...`, mGBA boots it, Start and A
reach the main menu, then a save is imported and "Look for new species in this save" hands it to
the registry. With the rebuilt patch (`6bda9a1e...`) and `saves/eevee_line/05_final_species.sav` it
finds the two generation-36 Eevee; the line's earlier milestone saves (also in
`tests/fixtures/eevee_line/`) are checked by the tests and hold no new species. Passes in Chromium (desktop,
boots in about 2 s) and WebKit with the iPhone 15 profile (about 20 s), 2 Nov 2026.

### Phones

`scripts/phone-check.mjs` plays the test cartridge with touchscreen taps only, in WebKit (iPhone 15
profile) and Chromium (Pixel 7): boot, D-pad, A five times (each writes SRAM), reload, Continue.
Both pass (2 Nov 2026): the creature moves, five dots appear, they survive the reload. Two fixes
came out of it: every touch press is held at least five frames (80 ms), because a quick tap can begin and
end inside one frame and the game never sees it; and on a phone the page scrolls the game into
view on boot, because on an iPhone 15 the D-pad was below the fold. This is emulated devices, not a
physical phone.

## 6. What is real and what is stubbed

| Thing | Status |
|---|---|
| Home hero simulation, mutation and selection demos, speciation card | Working |
| Sandbox: the guided toy (collect, keep, auto-breed, split, name, preview card, challenges, lab drawer) | Working; recorded first minute in research/pokemon-evolution/web-shots/v3-sandbox |
| ROM SHA-1 check and refusal messages | Working, tested |
| BPS patcher | Working, tested against Flips both ways |
| mGBA boot, keyboard, touch controls, pause, mute, full screen | Working (test cartridge; touch checked in WebKit/iPhone and Chromium/Android profiles) |
| Saves to IndexedDB, export, import, continue after reload, forget | Working (test cartridge) |
| Species Registry: save reading, card, image, gallery, abuse guards | Working against the ROM's own saves and the memory store; not deployed (no keys yet) |
| The real `emerald-evolved.bps` | Built (BUILD_STATUS.md). Served from `public/patch/` once `PATCH_URL` is set at build time; checked end to end with a retail ROM on the PC |
| Video link, final GitHub repo name, domain | Placeholders in `src/lib/site.ts` |
| The hack's code shown on /how-it-works | The original pokeemerald snippet is verbatim; the mutation loop and the Day Care rule are the hack's rules written as pseudo-C |

## 7. Asset provenance

`scripts/extract_assets.py` copies every game asset from pret's pokeemerald decomp, or from the
film's own extraction of it (`video/public/mc-chem-v2/poke`, see its PROVENANCE.md). Eevee is
written as palette indices plus its normal and shiny 16-colour palettes so the site can do real
palette swaps. `scripts/extract_species.py` writes species 1-386 from the expansion tree the hack
is built on (the sprites the ROM draws: `anim_front.png` frame 0, `normal.pal`, `shiny.pal`) as
palette-index PNGs plus `species.json`. Pokémon is © Nintendo, Creatures and GAME FREAK; this is a
fan project and the site never contains the game.
