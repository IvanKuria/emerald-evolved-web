/* ------------------------------------------------------------------
   mGBA in the tab.

   The core is @thenick775/mgba-wasm (MPL-2.0), served unmodified from
   /mgba/ by scripts/copy-mgba.mjs. It keeps its files in an Emscripten
   filesystem backed by IndexedDB, so the patched game and its save
   live in this browser's storage for this site and nowhere else.

   Nothing in this file talks to a server. The only network requests on
   the Play page are for the site's own files: this script, the wasm,
   and the .bps patch.
------------------------------------------------------------------ */

import type { mGBAEmulator } from '@thenick775/mgba-wasm'

export type Emulator = mGBAEmulator
type Factory = (o: { canvas: HTMLCanvasElement }) => Promise<Emulator>

let instance: Promise<Emulator> | null = null

export function isolationProblem(): string | null {
  if (!window.isSecureContext)
    return 'This page has to be opened over HTTPS for the emulator to run. The address bar should start with https://.'
  if (!window.crossOriginIsolated)
    return 'The emulator needs this page to be served with cross-origin isolation, and it isn’t. This is a problem with the site, not your browser.'
  if (typeof SharedArrayBuffer === 'undefined') return 'This browser can’t run the emulator. Try a recent Chrome, Edge, Firefox or Safari.'
  return null
}

/** Load the core once, onto the given canvas. Later calls return the same instance. */
export function bootCore(canvas: HTMLCanvasElement): Promise<Emulator> {
  instance ??= (async () => {
    /* Imported at runtime by URL, from outside the bundler's view: the dev
       server refuses to transform files in public/, and a production build
       would rename the files mgba.js loads by name. */
    const load = new Function('u', 'return import(u)') as (u: string) => Promise<{ default: Factory }>
    const mod = await load(new URL('/mgba/mgba.js', location.href).href)
    const emu = await mod.default({ canvas })
    await emu.FSInit()
    const keys: [string, string][] = [
      ['x', 'A'], ['z', 'B'], ['a', 'L'], ['s', 'R'],
      ['Return', 'Start'], ['Backspace', 'Select'],
      ['Up', 'Up'], ['Down', 'Down'], ['Left', 'Left'], ['Right', 'Right'],
    ]
    for (const [k, b] of keys) emu.bindKey(k, b)
    let pending: number | undefined
    emu.addCoreCallbacks({
      // the game wrote to its cartridge save: flush to IndexedDB, at most twice a second
      saveDataUpdatedCallback: () => {
        clearTimeout(pending)
        pending = window.setTimeout(() => emu.FSSync(), 500)
      },
    })
    addEventListener('pagehide', () => emu.FSSync())
    return emu
  })()
  return instance
}

export function gamePath(emu: Emulator, name: string) {
  return `${emu.filePaths().gamePath}/${name}`
}

export async function storeGame(emu: Emulator, name: string, rom: Uint8Array) {
  emu.FS.writeFile(gamePath(emu, name), rom)
  await emu.FSSync()
}

export function hasGame(emu: Emulator, name: string) {
  try {
    emu.FS.stat(gamePath(emu, name))
    return true
  } catch {
    return false
  }
}

export async function forgetGame(emu: Emulator, name: string) {
  const base = name.replace(/\.gba$/, '')
  for (const p of [gamePath(emu, name), `${emu.filePaths().savePath}/${base}.sav`])
    try {
      emu.FS.unlink(p)
    } catch {
      /* already gone */
    }
  await emu.FSSync()
}

export function download(bytes: Uint8Array, name: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
