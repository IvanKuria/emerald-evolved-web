// Measures how smoothly the home page's belts move: 5 s of every walker's on-screen position, one
// sample per animation frame, through a scripted cruise -> hover -> drag -> release -> glide.
// Run on the PC against the dev server:
//   node scripts/measure-belts.mjs [baseUrl] [label]
// Two passes: GPU (ANGLE/D3D11, GPU raster) and CPU throttled 4x via CDP. Prints a summary per pass
// and writes shots/measure-<label>-<pass>.json with the raw samples.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'https://localhost:5180'
const LABEL = process.argv[3] ?? 'run'
mkdirSync('shots', { recursive: true })

const passes = [
  { name: 'gpu', args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'], throttle: 1 },
  { name: 'cpu4x', args: ['--disable-gpu'], throttle: 4 },
]

function stats(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return { n: s.length, p50: q(0.5), p95: q(0.95), max: s[s.length - 1] }
}

for (const pass of passes) {
  const browser = await chromium.launch({ args: pass.args })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
  const cdp = await page.context().newCDPSession(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  if (pass.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: pass.throttle })
  const arc = await page.locator('.arc--up').boundingBox()

  // the sampler: every rAF, the time and each bottom-arc walker's centre
  const sampling = page.evaluate(
    () =>
      new Promise((done) => {
        const items = [...document.querySelectorAll('.arc--up .arc__walker')]
        const out = []
        const t0 = performance.now()
        // when the drag ends, so the glide is measured from the real release, however slow the CPU
        addEventListener('pointerup', () => (out.release = performance.now() - t0), { once: true, capture: true })
        const tick = (t) => {
          out.push({ t: t - t0, p: items.map((el) => {
            const r = el.getBoundingClientRect()
            const c = el.querySelector('canvas')
            return [r.x + r.width / 2, r.y + r.height / 2, c?.dataset.facing ?? '']
          }) })
          if (t - t0 < 7000) requestAnimationFrame(tick)
          else done({ samples: out, release: out.release })
        }
        requestAnimationFrame(tick)
      }),
  )
  // the script, in parallel: cruise 1.2 s, hover 1.2 s, drag left 0.6 s, release and glide
  const y = arc.y + arc.height * 0.6
  await page.mouse.move(10, 10)
  await page.waitForTimeout(1200)
  // hover a walker itself, where the slow-down applies
  const walker = await page.locator('.arc--up .arc__walker').nth(4).boundingBox()
  await page.mouse.move(walker.x + walker.width / 2, walker.y + walker.height * 0.6, { steps: 6 })
  await page.waitForTimeout(1200)
  await page.mouse.down()
  for (let i = 0; i <= 24; i++) {
    await page.mouse.move(arc.x + arc.width * (0.5 - (i / 24) * 0.3), y)
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  await page.mouse.move(10, 10, { steps: 4 })
  const { samples, release } = await sampling
  writeFileSync(`shots/measure-${LABEL}-${pass.name}.json`, JSON.stringify(samples))

  // frame times
  const dts = samples.slice(1).map((s, i) => s.t - samples[i].t)
  // per item, per frame: horizontal step, its change from the last frame (jerk, in px/frame), back-steps
  const window = (a, b) => samples.filter((s) => s.t >= a && s.t < b)
  const report = { pass: pass.name, frameMs: stats(dts), releaseAt: Math.round(release) }
  for (const [name, a, b] of [['cruise', 200, 1200], ['hover', 1500, 2400], ['glide', release + 50, release + 1300]]) {
    const w = window(a, b)
    const steps = []
    const jerk = []
    let backs = 0
    let stalls = 0
    let flips = 0
    for (let k = 0; k < (w[0]?.p.length ?? 0); k++) {
      let prev = null
      let prevFacing = null
      for (let f = 1; f < w.length; f++) {
        const dx = w[f].p[k][0] - w[f - 1].p[k][0]
        const dy = w[f].p[k][1] - w[f - 1].p[k][1]
        const dt = w[f].t - w[f - 1].t
        if (Math.abs(dx) > 300) { prev = null; continue } // the wrap at the path's end
        // distance moved along the curve, signed by horizontal direction, per 60 Hz frame
        const v = (Math.sign(dx) || 1) * Math.hypot(dx, dy) / (dt / 16.667)
        steps.push(Math.abs(v))
        if (prev !== null) jerk.push(Math.abs(v - prev))
        if (prev !== null && Math.sign(v) !== Math.sign(prev) && Math.abs(v) > 0.05 && Math.abs(prev) > 0.05) backs++
        if (Math.abs(dx) < 0.01 && prev !== null && Math.abs(prev) > 0.2) stalls++
        if (prevFacing !== null && w[f].p[k][2] && w[f].p[k][2] !== prevFacing) flips++
        prevFacing = w[f].p[k][2] || prevFacing
        prev = v
      }
    }
    report[name] = { speed: stats(steps), jerk: stats(jerk), reversals: backs, stalls, facingFlips: flips }
  }
  console.log(JSON.stringify(report))
  await browser.close()
}
