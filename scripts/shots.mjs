// Full-page screenshots of every page at desktop and phone widths, plus the Play flow end to end
// with the homebrew test cartridge. Run on the PC against the dev server:
//   node scripts/shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'https://localhost:5180'
const OUT = process.argv[3] ?? 'shots'
const ONLY = process.env.ONLY?.split(',')
mkdirSync(OUT, { recursive: true })

const sizes = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const pages = [
  ['home', '/', 9000],
  ['play', '/play', 1500],
  ['sandbox', '/sandbox', 6000],
  ['how', '/how-it-works', 1500],
  ['download', '/download', 800],
]

const browser = await chromium.launch({ args: ['--enable-features=SharedArrayBuffer'] })
const log = []
for (const [size, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && log.push(`[${size}] console: ${m.text()}`))
  page.on('pageerror', (e) => log.push(`[${size}] pageerror: ${e.message}`))
  for (const [name, path, wait] of pages) {
    if (ONLY && !ONLY.includes(name)) continue
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    // scroll through once so in-view demos start, then back to the top
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 60))
      }
      scrollTo(0, 0)
    })
    await page.waitForTimeout(wait)
    await page.screenshot({ path: `${OUT}/${name}-${size}.png`, fullPage: true })
    await page.screenshot({ path: `${OUT}/${name}-${size}-fold.png` })
    console.log('shot', name, size)
  }

  if (!ONLY || ONLY.includes('flow')) {
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
