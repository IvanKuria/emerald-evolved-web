// Puts the release patch at public/patch/emerald-evolved.bps for the build, so the site serves it from
// its own origin (the Play page is cross-origin isolated, and a same-origin file needs no CORS).
// The .bps is never committed: it is a GitHub release asset.
//   PATCH_URL=https://github.com/<owner>/<repo>/releases/download/<tag>/emerald-evolved.bps npm run build
//   PATCH_FILE=C:\path\to\emerald-evolved.bps npm run dev
// With neither set and no file already there, nothing happens and Play says the patch isn't out yet.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'

const OUT = 'public/patch/emerald-evolved.bps'
const SHA1 = '6bda9a1e269c1812867294633ee174e103d61152' // keep in step with src/lib/rom.ts EMERALD.patchSha1
const sha1 = (b) => createHash('sha1').update(b).digest('hex')

mkdirSync('public/patch', { recursive: true })
if (process.env.PATCH_FILE) copyFileSync(process.env.PATCH_FILE, OUT)
else if (process.env.PATCH_URL && !existsSync(OUT)) {
  const r = await fetch(process.env.PATCH_URL, { redirect: 'follow' })
  if (!r.ok) throw new Error(`patch download failed: ${r.status}`)
  writeFileSync(OUT, Buffer.from(await r.arrayBuffer()))
}
if (existsSync(OUT)) {
  const got = sha1(readFileSync(OUT))
  if (got !== SHA1) throw new Error(`${OUT} has SHA-1 ${got}, expected ${SHA1}`)
  console.log('patch ready:', OUT)
} else console.log('no patch: Play will say the patch is not out yet')
