import { applyGenes, ex5, type Rgb5 } from './palette'

/* ------------------------------------------------------------------
   A species' real front sprite, in the colours its genes give it.

   public/game/species/<n>.png holds the sprite's palette indices (value
   = index x 17, see scripts/extract_species.py) and species.json its
   normal and shiny 16-colour palettes. The genes rewrite the palette
   (palette.ts, the ROM's own maths) and the indices are painted with
   it, so the card is a palette swap exactly like the cartridge's.
------------------------------------------------------------------ */

export interface SpeciesInfo {
  id: number
  name: string
  pal: Rgb5[]
  shiny: Rgb5[]
}

let table: Promise<Map<number, SpeciesInfo>> | null = null
export const speciesTable = () =>
  (table ??= fetch('/game/species.json')
    .then((r) => r.json())
    .then((list: SpeciesInfo[]) => new Map(list.map((s) => [s.id, s]))))

const indexCache = new Map<number, Promise<Uint8Array>>()
function indices(id: number) {
  let p = indexCache.get(id)
  if (!p) {
    p = new Promise<Uint8Array>((ok, bad) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = 64
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(img, 0, 0)
        const d = ctx.getImageData(0, 0, 64, 64).data
        const out = new Uint8Array(64 * 64)
        for (let i = 0; i < out.length; i++) out[i] = Math.round(d[i * 4] / 17)
        ok(out)
      }
      img.onerror = bad
      img.src = `/game/species/${id}.png`
    })
    indexCache.set(id, p)
  }
  return p
}

export interface Look {
  species: number
  coat: number
  hue: number
  shiny: boolean
}

/** The sprite as a 64x64 canvas at 1:1, transparent background. */
export async function paintSpecies(look: Look): Promise<HTMLCanvasElement> {
  const [info, idx] = await Promise.all([speciesTable().then((t) => t.get(look.species)), indices(look.species)])
  if (!info) throw new Error(`no species ${look.species}`)
  const pal = applyGenes(look.shiny ? info.shiny : info.pal, look.coat, look.hue)
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(64, 64)
  for (let i = 0; i < idx.length; i++) {
    const k = idx[i]
    if (!k) continue
    img.data[i * 4] = ex5(pal[k][0])
    img.data[i * 4 + 1] = ex5(pal[k][1])
    img.data[i * 4 + 2] = ex5(pal[k][2])
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** The opaque pixels' bounds, so a sprite can be laid out by itself and not its 64x64 cell. */
export function bounds(c: HTMLCanvasElement) {
  const d = c.getContext('2d')!.getImageData(0, 0, 64, 64).data
  let x0 = 64, y0 = 64, x1 = -1, y1 = -1
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++)
      if (d[(y * 64 + x) * 4 + 3]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
  return x1 < 0 ? { x: 0, y: 0, w: 64, h: 64 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
