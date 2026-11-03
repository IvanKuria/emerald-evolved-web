// Short Playwright recordings of the home page, one per section, at desktop and phone sizes, plus
// stills at the moments worth looking at. For reviewing motion, not for tests.
// Run on the PC against the dev server:
//   node scripts/record-home.mjs [baseUrl] [outDir]      ONLY=hero,egg,... limits the sections
// Writes <outDir>/<section>-<size>.webm and <outDir>/<section>-<size>-<moment>.png.
import { chromium } from 'playwright'
import { mkdirSync, renameSync } from 'node:fs'

const BASE = process.argv[2] ?? 'https://localhost:5180'
const OUT = process.argv[3] ?? 'shots/v2'
const ONLY = process.env.ONLY?.split(',')
mkdirSync(OUT, { recursive: true })

const sizes = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

const wait = (page, ms) => page.waitForTimeout(ms)
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })

/* Smooth scroll by wheel-sized steps, so scroll-driven sections play as a person would see them. */
async function scrollBy(page, dy, ms) {
  const steps = Math.max(1, Math.round(ms / 50))
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dy / steps)
    await wait(page, 50)
  }
}
const scrollToSel = (page, sel, block = 'start') =>
  page.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ block: b, behavior: 'instant' }), [sel, block])

const sections = {
  async play(page, size, tag) {
    await scrollToSel(page, '.play__device', 'center')
    await wait(page, 2500)
    await shot(page, `${tag}-a-screen`)
    // a file dragged over the device: the screen answers
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer()
      d.items.add(new File([new Uint8Array(16)], 'emerald.gba'))
      return d
    })
    await page.dispatchEvent('.play__device', 'dragover', { dataTransfer: dt })
    await wait(page, 1800)
    await shot(page, `${tag}-b-dragover`)
    await page.dispatchEvent('.play__device', 'dragleave', { dataTransfer: dt })
    await wait(page, 1500)
  },

  async names(page, size, tag) {
    await scrollToSel(page, '#names', 'center')
    await wait(page, 1500)
    await shot(page, `${tag}-a-belt`)
    await wait(page, 3000)
    await shot(page, `${tag}-b-belt-later`)
    await scrollToSel(page, '.close', 'center')
    await wait(page, 1500)
    await shot(page, `${tag}-c-close`)
  },

  async full(page, size, tag) {
    // the whole page top to bottom at a reading pace, pins included
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
    const vh = page.viewportSize().height
    await wait(page, 2500)
    let y = 0
    while (y < total) {
      await scrollBy(page, vh * 0.5, 900)
      y += vh * 0.5
      await wait(page, 500)
    }
    await wait(page, 1500)
  },

  async split(page, size, tag) {
    await scrub(page, tag, 3.2, [
      [0, 'a-70'],
      [0.3, 'b-50'],
      [0.6, 'c-20'],
      [0.8, 'd-0'],
      [0.95, 'e-two-species'],
    ])
    await wait(page, 1500)
    await shot(page, `${tag}-f-after`)
    // and back up a little: it runs in reverse
    await scrollBy(page, -page.viewportSize().height * 1.2, 1200)
    await wait(page, 900)
    await shot(page, `${tag}-g-reverse`)
  },

  async breed(page, size, tag) {
    const tapKid = async () => {
      const kids = page.locator('.breed__row[data-on="true"] .breed__kid:not([disabled])')
      const n = await kids.count()
      if (!n) return
      const target = kids.nth(0)
      if (size === 'desktop') {
        await target.hover()
        await wait(page, 500)
        await shot(page, `${tag}-d0-hover`)
        await target.click()
      } else {
        const b = await target.boundingBox()
        if (b) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
      }
      await wait(page, 700)
    }
    await scrub(page, tag, 7 * 0.55, [
      [0, 'a-founder'],
      [0.3, 'b-gen2'],
      [0.5, 'c-gen3'],
      [0.5, 'd-picked', tapKid],
      [0.8, 'e-gen5'],
      [1, 'f-gen7'],
    ])
    await wait(page, 800)
  },

  async hero(page, size, tag) {
    await wait(page, 2500)
    await shot(page, `${tag}-a-settled`)
    // hover the wordmark: the egg hatches
    const box = await page.locator('.wordmark').boundingBox()
    if (box && size === 'desktop') await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 8 })
    else if (box) await page.locator('.wordmark').tap()
    await wait(page, 1500)
    await shot(page, `${tag}-b-cracking`)
    await wait(page, 1500)
    await shot(page, `${tag}-c-hatched`)
    // drag the bottom arc backwards
    const arc = await page.locator('.arc--up').boundingBox()
    if (arc && size === 'desktop') {
      const y = arc.y + arc.height * 0.6
      await page.mouse.move(arc.x + arc.width * 0.7, y)
      await page.mouse.down()
      await page.mouse.move(arc.x + arc.width * 0.3, y, { steps: 20 })
      await shot(page, `${tag}-d-dragging`)
      await page.mouse.up()
      await page.mouse.move(arc.x + arc.width * 0.5, y, { steps: 5 })
      await wait(page, 1500)
      await shot(page, `${tag}-e-under-pointer`)
    }
    await wait(page, 2000)
  },

  async egg(page, size, tag) {
    // hatches on its own 1.6 s after it is on screen; the cut-scene runs about 6.2 s
    await scrollToSel(page, '.egg__stage', 'center')
    await wait(page, 600)
    await shot(page, `${tag}-a-egg`)
    await wait(page, 2400)
    await shot(page, `${tag}-b-cracked`)
    await wait(page, 2240)
    await shot(page, `${tag}-c-white`)
    await wait(page, 450)
    await shot(page, `${tag}-d-emerge`)
    await wait(page, 700)
    await shot(page, `${tag}-e-front-anim`)
    await wait(page, 1900)
    await shot(page, `${tag}-f-flight`)
    await wait(page, 900)
    await shot(page, `${tag}-g-shelf`)
    await wait(page, 15000)
    await shot(page, `${tag}-h-shelf-later`)
  },
}

/* A pinned section: scroll from its start through `screens` window heights, with stills on the way. */
async function scrub(page, tag, screens, stops) {
  const vh = page.viewportSize().height
  await wait(page, 1200)
  // a pinned section sits inside ScrollTrigger's pin-spacer; its top is where the pin starts
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    const host = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el
    window.scrollTo({ top: host.getBoundingClientRect().top + window.scrollY, behavior: 'instant' })
  }, `#${tag.split('-')[0]}`)
  await wait(page, 900)
  let at = 0
  for (const [p, name, act] of stops) {
    const dy = (p - at) * screens * vh
    await scrollBy(page, dy, Math.max(300, Math.abs(dy) * 1.6))
    at = p
    await wait(page, 900)
    if (act) await act()
    await shot(page, `${tag}-${name}`)
  }
}

const browser = await chromium.launch({ args: ['--enable-features=SharedArrayBuffer'] })
const log = []
for (const [size, opts] of Object.entries(sizes)) {
  for (const [name, run] of Object.entries(sections)) {
    if (ONLY && !ONLY.includes(name)) continue
    const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, recordVideo: { dir: OUT, size: opts.viewport } })
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && log.push(`[${size} ${name}] console: ${m.text()}`))
    page.on('pageerror', (e) => log.push(`[${size} ${name}] pageerror: ${e.message}`))
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    if (!['hero', 'breed', 'split', 'full'].includes(name)) await scrollToSel(page, `#${name}`)
    try {
      await run(page, size, `${name}-${size}`, { scrollBy, scrollToSel })
    } catch (e) {
      log.push(`[${size} ${name}] failed: ${String(e).split('\n')[0]}`)
    }
    const video = page.video()
    await ctx.close()
    if (video) renameSync(await video.path(), `${OUT}/${name}-${size}.webm`)
    console.log('recorded', name, size)
  }
}
await browser.close()
console.log(log.length ? log.join('\n') : 'no errors')
