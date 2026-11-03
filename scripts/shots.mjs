// Screenshots of every page at desktop and phone widths, the hero and sandbox split moments, the
// Species Registry flow with a synthetic save, and the Play flow end to end with the test cartridge.
// Run on the PC against the dev server started with an in-memory store (scripts/pc-dev.ps1 memory):
//   npx tsx scripts/make-test-save.ts shots/test-save.sav
//   node scripts/shots.mjs [baseUrl] [outDir]
// ONLY=home,play,... limits which parts run.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'https://localhost:5180'
const OUT = process.argv[3] ?? 'shots'
const ONLY = process.env.ONLY?.split(',')
const want = (k) => !ONLY || ONLY.includes(k)
mkdirSync(OUT, { recursive: true })

const sizes = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const pages = [
  ['home', '/', 9000],
  ['play', '/play', 1500],
  ['sandbox', '/sandbox', 5000],
  ['species', '/species', 1500],
  ['how', '/how-it-works', 1500],
  ['download', '/download', 800],
]

const browser = await chromium.launch({ args: ['--enable-features=SharedArrayBuffer'] })
const log = []
const top = (page) => page.evaluate(() => scrollTo(0, 0))
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    scrollTo(0, 0)
  })
}

for (const [size, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && log.push(`[${size}] console: ${m.text()}`))
  page.on('pageerror', (e) => log.push(`[${size}] pageerror: ${e.message}`))
  for (const [name, path, wait] of pages) {
    if (!want(name)) continue
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await settle(page)
    await page.waitForTimeout(wait)
    await page.screenshot({ path: `${OUT}/${name}-${size}.png`, fullPage: true })
    await page.screenshot({ path: `${OUT}/${name}-${size}-fold.png` })
    console.log('shot', name, size)
  }

  if (want('split')) {
    // the hero splits about 25 s in (seed 42); catch the readout before, the moment, and after
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(19000)
    await page.screenshot({ path: `${OUT}/home-${size}-split-0-before.png` })
    await page.waitForFunction(() => document.body.innerText.includes('2 species') || document.body.innerText.includes('2 SPECIES'), null, { timeout: 40000 }).catch(() => log.push(`[${size}] hero did not split in time`))
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT}/home-${size}-split-1-moment.png` })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: `${OUT}/home-${size}-split-2-after.png` })
    await page.goto(BASE + '/sandbox', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => /2 species/i.test(document.body.innerText), null, { timeout: 40000 }).catch(() => log.push(`[${size}] sandbox did not split in time`))
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${OUT}/sandbox-${size}-split.png`, fullPage: size === 'desktop' })
    console.log('split', size)
  }

  if (want('registry')) {
    await page.goto(BASE + '/species', { waitUntil: 'networkidle' })
    await page.locator('input[type=file]').setInputFiles(`${OUT}/test-save.sav`)
    await page.getByText('Pick one to name').waitFor()
    await top(page)
        await page.screenshot({ path: `${OUT}/species-${size}-1-found.png`, fullPage: true })
    const names = ['Mossling', 'Tidegloom', 'Coalfin', 'Rosemane']
    for (let i = 0; i < 4; i++) {
      if (i > 0) {
        await page.getByRole('button', { name: 'Start over' }).click().catch(() => {})
        await page.locator('input[type=file]').setInputFiles(`${OUT}/test-save.sav`)
        await page.getByText('Pick one to name').waitFor()
      }
      await page.locator('#register li button').nth(i).click()
      await page.getByPlaceholder(/letters/).fill(names[i])
      if (i === 0) {
        await top(page)
        await page.screenshot({ path: `${OUT}/species-${size}-2-naming.png`, fullPage: true })
      }
      if (size === 'phone') break // the desktop run registers; the phone run only shows the steps
      await page.getByRole('button', { name: 'Add it to the registry' }).click()
      await page.getByRole('button', { name: 'Copy link' }).waitFor()
      if (i === 0) {
        await top(page)
        await page.screenshot({ path: `${OUT}/species-${size}-3-done.png`, fullPage: true })
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save the card as an image' }).click()])
        await dl.saveAs(`${OUT}/card-image.png`)
      }
      await page.reload({ waitUntil: 'networkidle' })
    }
    await page.goto(BASE + '/species', { waitUntil: 'networkidle' })
    await settle(page)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/species-${size}-4-gallery.png`, fullPage: true })
    const first = await page.locator('a[href^="/species/"]').first().getAttribute('href')
    await page.goto(BASE + first, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/species-${size}-5-card.png`, fullPage: true })
    console.log('registry', size)
  }

  if (want('flow')) {
    // the whole pipeline: test cartridge -> SHA-1 -> BPS -> mGBA -> input -> save -> reload -> continue
    await page.goto(BASE + '/play', { waitUntil: 'networkidle' })
    const iso = await page.evaluate(() => ({ iso: crossOriginIsolated, secure: isSecureContext }))
    log.push(`[${size}] isolation ${JSON.stringify(iso)}`)
    await page.getByText('Try the test cartridge').click()
    await page.getByText('Playing the test cartridge').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/flow-${size}-1-booted.png`, fullPage: true })
    await page.locator('canvas#canvas').focus()
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(700)
    await page.keyboard.up('ArrowRight')
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('x', { delay: 60 })
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/flow-${size}-2-input.png`, fullPage: true })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('Continue playing').click()
    await page.getByText('Playing the test cartridge').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/flow-${size}-3-continued.png`, fullPage: true })
    console.log('flow', size)
  }
  await ctx.close()
}
await browser.close()
console.log(log.join('\n') || 'no console errors')
