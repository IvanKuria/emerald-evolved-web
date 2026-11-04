// Puts the release patch at public/patch/emerald-evolved.bps for the build, so the site serves it from
// its own origin (the Play page is cross-origin isolated, and a same-origin file needs no CORS).
// The .bps is never committed: it is a GitHub release asset, pinned here next to the SHA-1 it must have
// (so a new release is one commit, with no dashboard env var to change).
//   PATCH_FILE=C:\path\to\emerald-evolved.bps npm run dev     (use a local file instead)
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'

const OUT = 'public/patch/emerald-evolved.bps'
const RELEASE = 'https://github.com/IvanKuria/emerald-evolved/releases/download/v1.0.2/emerald-evolved.bps'
const SHA1 = '60c1b7cffa3b8430b42eec1b834d405b779afbff' // keep in step with src/lib/rom.ts EMERALD.patchSha1
const sha1 = (b) => createHash('sha1').update(b).digest('hex')

mkdirSync('public/patch', { recursive: true })
if (process.env.PATCH_FILE) copyFileSync(process.env.PATCH_FILE, OUT)
else if (!existsSync(OUT) || sha1(readFileSync(OUT)) !== SHA1) {
  const r = await fetch(RELEASE, { redirect: 'follow' })
  if (!r.ok) throw new Error(`patch download failed: ${r.status}`)
  writeFileSync(OUT, Buffer.from(await r.arrayBuffer()))
}
if (existsSync(OUT)) {
  const got = sha1(readFileSync(OUT))
  if (got !== SHA1) throw new Error(`${OUT} has SHA-1 ${got}, expected ${SHA1}`)
  console.log('patch ready:', OUT)
}
