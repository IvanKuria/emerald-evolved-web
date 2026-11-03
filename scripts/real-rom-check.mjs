// The real thing, end to end, on a machine that has the files (never in the repo):
// a retail Emerald (US) goes in, is checked, patched with the release .bps, boots in mGBA, takes input;
// then the ROM's own test save 03 is imported, and "Look for new species" reads it into the registry.
//   node scripts/real-rom-check.mjs <base rom> <save 03> [baseUrl] [outDir]
// Runs in Chromium (desktop) and WebKit (iPhone 15 profile).
import { chromium, webkit, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const [ROM, SAVE, BASE = 'https://localhost:5180', OUT = 'shots'] = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })
const runs = [
  ['desktop', chromium, { viewport: { width: 1440, height: 900 } }],
  ['iphone', webkit, devices['iPhone 15']],
]
const lit = (page) =>
  page.locator('canvas#canvas').screenshot().then((b) => b.length) // a black screen compresses to almost nothing

const results = []
for (const [name, type, opts] of runs) {
  const r = { name }
  const t0 = Date.now()
  let browser
  try {
    browser = await type.launch()
    const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => (r.errors ??= []).push(e.message))
    await page.goto(BASE + '/play', { waitUntil: 'networkidle' })
    await page.locator('input[type=file]').first().setInputFiles(ROM)
    await page.getByText('Playing Emerald Evolved').waitFor({ timeout: 120000 })
    r.bootSeconds = Math.round((Date.now() - t0) / 1000)
    await page.waitForTimeout(6000)
    r.titleBytes = await lit(page)
    await page.screenshot({ path: `${OUT}/real-${name}-1-booted.png` })
    // Start through the title screen
    const press = async (key) => {
      if (name === 'iphone') await page.getByRole('button', { name: key === 'Enter' ? 'Start' : 'A', exact: true }).tap()
      else {
        await page.locator('canvas#canvas').focus()
        await page.keyboard.press(key, { delay: 80 })
      }
      await page.waitForTimeout(900)
    }
    for (const k of ['Enter', 'x', 'x', 'x']) await press(k)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/real-${name}-2-input.png` })
    // the ROM's own save with a new species in the party
    await page.locator('input[accept=".sav"]').setInputFiles(SAVE)
    await page.waitForTimeout(5000)
    await page.screenshot({ path: `${OUT}/real-${name}-3-save03.png` })
    await page.getByText('Look for new species in this save').click()
    await page.getByText(/new species lines? in|Name your species/).waitFor({ timeout: 15000 })
    r.registryFound = await page.locator('#register').innerText()
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `${OUT}/real-${name}-4-registry.png`, fullPage: true })
  } catch (e) {
    r.failed = String(e).split('\n')[0]
  }
  await browser?.close()
  results.push(r)
}
console.log(JSON.stringify(results, null, 2))
