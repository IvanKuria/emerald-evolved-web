// A brand-new visitor's first minute in the sandbox, recorded at desktop and phone size:
// arrival -> collect -> keep the tallest pair (three times, by hand) -> auto-breed until it splits
// -> name it -> the card. Run on the PC against the dev server:
//   node scripts/record-sandbox.mjs [baseUrl] [outDir]
import { chromium } from 'playwright'
import { mkdirSync, renameSync } from 'node:fs'

const BASE = process.argv[2] ?? 'https://localhost:5180'
const OUT = process.argv[3] ?? 'shots/v3'
mkdirSync(OUT, { recursive: true })
const sizes = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] })
const log = []
for (const [size, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, recordVideo: { dir: OUT, size: opts.viewport } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`[${size}] pageerror: ${e.message}`))
  const wait = (ms) => page.waitForTimeout(ms)
  const shot = (n) => page.screenshot({ path: `${OUT}/${size}-${n}.png` })
  const tap = async (loc) => {
    await loc.scrollIntoViewIfNeeded()
    if (size === 'phone') {
      const b = await loc.boundingBox()
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    } else {
      await loc.hover()
      await wait(250)
      await loc.click()
    }
  }
  const t0 = Date.now()
  const at = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`
  await page.goto(BASE + '/sandbox', { waitUntil: 'networkidle' })
  await wait(2600)
  await shot('a-arrival')
  // three generations by hand: collect, then keep the tallest son and daughter
  for (let g = 1; g <= 3; g++) {
    await tap(page.getByRole('menuitem', { name: 'COLLECT EGGS' }))
    await wait(g === 1 ? 2400 : 1700)
    if (g === 1) await shot('b-hatched')
    for (const who of ['Son', 'Daughter']) {
      const slots = page.locator(`.pcbox__slot[aria-label^="${who}"]`)
      const n = await slots.count()
      if (!n) continue
      let best = 0, bestH = -1
      for (let i = 0; i < n; i++) {
        const h = parseFloat((await slots.nth(i).getAttribute('aria-label')).match(/([\d.]+) meters/)[1])
        if (h > bestH) (bestH = h), (best = i)
      }
      await tap(slots.nth(best))
      await wait(600)
      if (g === 1) await shot(`c-kept-${who.toLowerCase()}`)
    }
    await wait(500)
  }
  await shot('d-unlocked')
  log.push(`[${size}] manual generations done at ${at()}`)
  // auto-breed until the line splits
  for (let i = 0; i < 12; i++) {
    if (await page.getByText('A new species.', { exact: true }).isVisible().catch(() => false)) break
    const auto = page.getByRole('menuitem', { name: 'AUTO-BREED ×10' })
    if (!(await auto.isVisible().catch(() => false))) {
      await wait(500)
      continue
    }
    await tap(auto)
    await wait(3400)
    log.push(`[${size}] after auto ${i}: ${await page.locator('.sbx__gen').innerText()} / ${await page.locator('.sbx__tier').innerText()}`)
    if (i === 0) await shot('e-auto')
  }
  await page.getByText('A new species.', { exact: true }).waitFor({ timeout: 30000 }).catch(() => log.push(`[${size}] no split`))
  if (!(await page.getByText('A new species.', { exact: true }).isVisible())) { console.log(log.join('\n')); process.exit(1) }
  log.push(`[${size}] split at ${at()}`)
  await wait(400)
  await shot('f-split')
  await wait(1500)
  await shot('g-reveal')
  await tap(page.getByRole('menuitem', { name: 'NAME IT' }))
  await wait(500)
  await page.locator('#species-name').fill('Mossling')
  await shot('h-naming')
  await tap(page.getByRole('button', { name: 'Name it' }))
  await wait(1200)
  await page.locator('.reveal__card').scrollIntoViewIfNeeded()
  await wait(600)
  await shot('i-card')
  log.push(`[${size}] named at ${at()}`)
  await page.locator('.sbx__challenges').scrollIntoViewIfNeeded()
  await wait(900)
  await shot('j-challenges')
  await page.locator('.sbx__lab summary').click()
  await page.locator('.sbx__lab').scrollIntoViewIfNeeded()
  await wait(700)
  await shot('k-lab')
  const video = page.video()
  await ctx.close()
  renameSync(await video.path(), `${OUT}/first-minute-${size}.webm`)
  console.log('recorded', size)
}
await browser.close()
console.log(log.join('\n'))
