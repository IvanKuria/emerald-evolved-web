// Copies the mGBA WebAssembly build into public/mgba/ so it is served as-is, from our own origin.
// It has to be same-origin (its pthread workers are started from mgba.js's own URL) and it should
// not go through the bundler, which would rename the files its loader looks for.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
const src = 'node_modules/@thenick775/mgba-wasm/dist/'
mkdirSync('public/mgba', { recursive: true })
for (const f of ['mgba.js', 'mgba.wasm']) cpSync(src + f, 'public/mgba/' + f)
writeFileSync(
  'public/mgba/NOTICE.txt',
  'mGBA (c) Jeffrey Pfau and contributors, WebAssembly port by Nicholas VanCise.\n' +
    'Licensed under the Mozilla Public License 2.0: https://mozilla.org/MPL/2.0/\n' +
    'Source: https://github.com/thenick775/mgba/tree/feature/wasm (npm @thenick775/mgba-wasm)\n' +
    'These files are distributed unmodified.\n',
)
console.log('copied mGBA wasm build to public/mgba')
