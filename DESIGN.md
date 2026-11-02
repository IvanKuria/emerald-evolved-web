# Pokémon Real Evolution: the website

The launch site for "I Gave Pokémon Real Evolution", a Pokémon Emerald ROM hack built on
pokeemerald-expansion that adds mutation, selective breeding and speciation. It ships with the
main-channel video.

Stack: Vite 8, React 19, React Router 8, Tailwind 4, TypeScript. No UI kit. The only runtime
dependency of any size is the mGBA WebAssembly core.

```
npm install            # also copies mGBA into public/mgba on dev/build
npm run dev            # https://0.0.0.0:5180, self-signed cert, COOP/COEP on
npm test               # BPS, SHA-1 and ROM-identification tests (vitest)
node scripts/shots.mjs # full-page screenshots plus the end-to-end Play flow (Playwright)
```

`PRESENCE_DEMO=1240 npm run dev` adds 1,240 pretend players to the dev counter, so the design
can be judged at launch-sized numbers. It is off by default and does not exist in the Worker.

---

## 1. Information architecture

| Route | Job | What's on it |
|---|---|---|
| `/` | Make the idea land in five seconds, then get people to Play | Hero: a live population of real Eevee sprites splitting into two species, narrated by Emerald's own message box. Then the hook in the video's voice, the three rules as interactive demos, and a Play band with the live count. |
| `/play` | Turn "I have a ROM" into "I'm playing" | Four visible steps (Your ROM, Checked, Patched, Playing), a drop zone where the game's window does the talking, the emulator, saves, touch controls. |
| `/sandbox` | Let people watch it happen and share what they got | The engine with its dials exposed, a growing family tree, an event log. Every run is a link. |
| `/how-it-works` | The science and the code, for the curious and for people who will ask "is it real?" | Long-form, one measure, real code from pokeemerald next to the new rule. Credits. |
| `/download` | For desktop emulators and flash carts | The .bps, GitHub, checksums, how to patch by hand. |

The navigation names things by what people do (Play, Sandbox), not by how they are built. The
live count lives in the nav on wide screens and in the Play band, not on every page twice.

The three rules on Home are numbered because they really are a sequence: mutation makes
variation, selection keeps some of it, separation turns it into species. Nothing else on the site
is numbered except the Play steps, which are also a sequence.

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
- **Real game objects with the house drop shadow.** Every sprite is from pokeemerald itself:
  Eevee's `anim_front.png` (both frames) and its palettes, the egg and its hatch frames, the Poké
  Ball, the message box, the window frame, the HP bar tiles, the message font. The shadow is the
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
  second animation frame in the air, squashes a little on landing, and its shadow stays on the
  ground. Things travel; nothing pops in.
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
- **One orchestrated motion.** frame-site's belts are the one thing that moves on their own; here
  it's the population. Every other motion answers a person: hatch an egg, pick a parent, drop a
  file, toggle a river.
- **Honesty in the interface.** frame-site's Spotlight refuses to fake search results; here the
  counter shows nothing until it has a real number, the Download button is disabled with a reason
  until the patch exists, and errors say which file is wrong and what to do.

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
  production sets the headers in `public/_headers`. The page detects a missing isolation and says
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

## 5. The live player counter

### Behaviour

- Each tab makes up a random id kept in sessionStorage. No cookie, no IP stored, nothing that
  outlives the tab.
- Every 25 seconds while visible, the tab POSTs `{sid, playing}`. The reply is the count, so
  there's no second request. `playing` is true while the emulator is running.
- On `pagehide` a beacon says goodbye, so closing the tab drops you off immediately.
- Anyone silent for 70 seconds stops counting.
- The UI shows nothing until it has a real number.

Shared rules: `counter/presence.ts`. The dev server serves the same API from memory
(`counter/dev-mock.ts`) so the real client code runs locally.

### Proposed hosting: Cloudflare (Pages + one Worker + one Durable Object)

`counter/worker.ts` and `counter/wrangler.toml` are written, not deployed.

- **Static site on Cloudflare Pages.** Free, global, and `_headers` sets COOP/COEP on every route,
  which the emulator needs. Brotli on the 2 MB wasm.
- **Counter as one Durable Object** behind a Worker route on the same domain (`/api/presence`), so
  there is no CORS and it is same-origin under COEP. One object holds the whole count in memory:
  a single-threaded counter with no database and no race conditions. Losing it to an eviction
  costs one 70-second window of under-counting, which is acceptable for a number on a web page.
- **GET is cached at the edge for 5 seconds**, so a launch-day spike of page views costs almost
  nothing; only heartbeats reach the object.
- **Cost.** At 5,000 concurrent tabs that is 200 heartbeats a second, about 17M requests a day,
  which is inside the Workers Paid plan ($5/month, 10M requests included, then $0.30 per million).
  If launch numbers go far beyond that, the next step is WebSocket hibernation on the same object:
  the count is pushed instead of polled, and hibernated sockets are billed far lower than requests.
- **Why not the alternatives.** Supabase Realtime presence or a Redis sorted set both work, but add
  a second vendor and a database for one integer. Vercel would need an external store for state.
  A Firebase listener would put a third-party SDK on a page that promises nothing leaves it.

## 6. What is real and what is stubbed

| Thing | Status |
|---|---|
| Home hero simulation, mutation and selection demos, speciation card | Working |
| Sandbox: controls, deterministic share links, family tree, event log, Save image (1200x630 PNG) | Working |
| ROM SHA-1 check and refusal messages | Working, tested |
| BPS patcher | Working, tested against Flips both ways |
| mGBA boot, keyboard, touch controls, pause, mute, full screen | Working (test cartridge) |
| Saves to IndexedDB, export, import, continue after reload, forget | Working (test cartridge) |
| Live counter | Working against the dev mock; Worker written, not deployed |
| The real `pokemon-real-evolution.bps` | Not built yet. With a correct Emerald, Play says the copy checks out and the patch arrives with the video. Set `SITE.patchReady` and `EMERALD.targetSha1` when it exists. |
| Video link, final GitHub repo name, domain | Placeholders in `src/lib/site.ts` and `counter/wrangler.toml` |
| The hack's C code shown on /how-it-works | The mutation loop and compatibility rule are the planned C, labelled as such; the original pokeemerald snippet is verbatim |

## 7. Asset provenance

`scripts/extract_assets.py` copies every game asset from pret's pokeemerald decomp, or from the
film's own extraction of it (`video/public/mc-chem-v2/poke`, see its PROVENANCE.md). Eevee is
written as palette indices plus its normal and shiny 16-colour palettes so the site can do real
palette swaps. Pokémon is © Nintendo, Creatures and GAME FREAK; this is a fan project and the site
never contains the game.
