// Is the game playable by touch on a phone? Runs the Play flow with the test cartridge in WebKit
// with an iPhone profile and in Chromium with an Android profile, using only touchscreen taps on the
// on-screen controls (no keyboard): boot, move with the D-pad, press A five times (each writes the
// count to SRAM), reload, continue, and check the dots survived. Pixel checks read the game canvas.
//   node scripts/phone-check.mjs [baseUrl] [outDir]
import { webkit, chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'https://localhost:5180'
const OUT = process.argv[3] ?? 'shots'
mkdirSync(OUT, { recursive: true })
const runs = [
  ['iphone', webkit, devices['iPhone 15']],
  ['android', chromium, devices['Pixel 7']],
]

// Count dark dots on the bottom row of the GBA screen and find the creature's left edge, from a
// screenshot of the game canvas (its WebGL buffer can't be read back directly).
const probe = async (page) => {
  const png = (await page.locator('canvas#canvas').screenshot()).toString('base64')
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 240
    c.height = 160
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, 240, 160)
    const d = ctx.getImageData(0, 0, 240, 160).data
    const lum = (x, y) => d[(y * 240 + x) * 4 + 1]
    let dots = 0
    for (let i = 0; i < 37; i++) if (lum(8 + i * 6 + 2, 148) < 80) dots++
    let left = -1
    for (let x = 6; x < 234 && left < 0; x++) for (let y = 10; y < 140; y++) if (lum(x, y) < 200) { left = x; break }
    return { dots, left }
  }, png)
}

const results = []
for (const [name, type, device] of runs) {
  const r = { name, browser: type.name() }
  let browser
  try {
    browser = await type.launch()
    const ctx = await browser.newContext({ ...device, ignoreHTTPSErrors: true })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => (r.errors ??= []).push(e.message))
    await page.goto(BASE + '/play', { waitUntil: 'networkidle' })
    r.isolated = await page.evaluate(() => crossOriginIsolated)
    await page.getByText('Try the test cartridge').tap()
    await page.getByText('Playing the test cartridge').waitFor({ timeout: 30000 })
    await page.waitForTimeout(1500)
    const before = await probe(page)
    await page.screenshot({ path: `${OUT}/phone-${name}-1-booted.png`, fullPage: true })
    // the D-pad: tap its right arm a few times
    await page.waitForTimeout(800) // the page scrolls the game into view on its own
    const padEl = page.getByRole('group', { name: 'Direction pad' })
    r.padVisibleWithoutScrolling = await padEl.evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight)
    await padEl.scrollIntoViewIfNeeded()
    const pad = await padEl.boundingBox()
    for (let i = 0; i < 6; i++) {
      await page.touchscreen.tap(pad.x + pad.width * 0.92, pad.y + pad.height / 2)
      await page.waitForTimeout(120)
    }
    const a = page.getByRole('button', { name: 'A', exact: true })
    for (let i = 0; i < 5; i++) {
      await a.tap()
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(1500)
    const after = await probe(page)
    await page.screenshot({ path: `${OUT}/phone-${name}-2-touched.png`, fullPage: true })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('Continue playing').tap()
    await page.getByText('Playing the test cartridge').waitFor({ timeout: 30000 })
    await page.waitForTimeout(2000)
    const resumed = await probe(page)
    await page.screenshot({ path: `${OUT}/phone-${name}-3-continued.png`, fullPage: true })
    Object.assign(r, { before, after, resumed, moved: after.left > before.left, pressedA: after.dots - before.dots, savedDots: resumed.dots })
  } catch (e) {
    r.failed = String(e).split('\n')[0]
  }
  await browser?.close()
  results.push(r)
}
console.log(JSON.stringify(results, null, 2))
