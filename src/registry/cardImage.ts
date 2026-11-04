import { paintSpecies, speciesTable, bounds } from './sprite'
import { shadowOf, SHADOW } from '../lib/sprites'
import { messageBoxCanvas } from '../components/DialogueBox'
import { DAYCARE_LINE } from '../sim/daycare'
import { describe, sizeLabel, type CardData } from '../components/SpeciesCard'

/* ------------------------------------------------------------------
   The card as a 1200x630 image, the shape every social preview uses.
   Same parts as the page: the house paper and grain, the sprite at a
   whole 6x with the house shadow, the name in Bebas, the facts in
   Figtree, and the Day Care's own refusal in the game's message box at
   a whole 2x. Drawn on demand in the browser; nothing is uploaded.
------------------------------------------------------------------ */

const img = (src: string) =>
  new Promise<HTMLImageElement>((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ok(i)
    i.src = src
  })

export async function cardImage(card: CardData, url: string): Promise<Blob | null> {
  await Promise.all([document.fonts.load('400 120px "Bebas Neue"'), document.fonts.load('600 30px "Figtree Variable"')])
  const [sprite, table, box, grain, egg] = await Promise.all([
    paintSpecies(card),
    speciesTable(),
    messageBoxCanvas(DAYCARE_LINE[0]),
    img('/game/grain.png'),
    img('/game/egg_icon.png'),
  ])
  const base = table.get(card.species)?.name ?? ''
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 630
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f4f2ee'
  ctx.fillRect(0, 0, 1200, 630)

  // the sprite, 6x, feet on a common baseline, with the house shadow
  const k = 6
  const b = bounds(sprite)
  const sx = 70 + (420 - b.w * k) / 2 - b.x * k
  const sy = 470 - (b.y + b.h) * k
  const sh = shadowOf(sprite)
  ctx.globalAlpha = SHADOW.alpha
  ctx.drawImage(sh, sx + SHADOW.dx * 64 * k - SHADOW.pad * k, sy + SHADOW.dy * 64 * k - SHADOW.pad * k, (sh.width * k) / 4, (sh.height * k) / 4)
  ctx.globalAlpha = 1
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sprite, sx, sy, 64 * k, 64 * k)

  const X = 560
  ctx.fillStyle = '#6c675e'
  ctx.font = '400 34px "Bebas Neue"'
  ctx.fillText(card.no === 1 ? 'THE FIRST REAL EVOLUTION' : card.no ? `REAL EVOLUTION NO.${card.no}` : 'REAL EVOLUTION', X, 112)
  ctx.fillStyle = '#151515'
  let size = 136
  ctx.font = `400 ${size}px "Bebas Neue"`
  while (ctx.measureText(card.name.toUpperCase()).width > 600 && size > 60) ctx.font = `400 ${(size -= 4)}px "Bebas Neue"`
  ctx.fillText(card.name.toUpperCase(), X, 112 + size * 0.86)
  ctx.font = '500 30px "Figtree Variable"'
  ctx.fillStyle = '#3a3833'
  const y0 = 150 + size * 0.86
  ctx.fillText(`Bred from ${base} by ${card.trainer}`, X, y0)
  ctx.fillStyle = '#6c675e'
  ctx.font = '500 24px "Figtree Variable"'
  const facts = [`${sizeLabel(card.size)} the size of a wild one`, card.generation !== null ? `Generation ${card.generation}` : '', ...describe(card)].filter(Boolean)
  // facts on one line if they fit the column, else two
  const lines: string[] = []
  for (const f of facts) {
    const cur = lines[lines.length - 1]
    if (cur !== undefined && ctx.measureText(`${cur}  ·  ${f}`).width <= 580) lines[lines.length - 1] = `${cur}  ·  ${f}`
    else lines.push(f)
  }
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, X, y0 + 42 + i * 32))
  const boxY = y0 + 76 + (Math.min(2, lines.length) - 1) * 32

  // the Day Care's refusal, the game's own box and font at 2x
  ctx.drawImage(box, X - 4, boxY, 240 * 2, 42 * 2)

  // the mark and the link
  ctx.drawImage(egg, 0, 0, 14, 15, 70, 540, 28, 30)
  ctx.fillStyle = '#151515'
  ctx.font = '400 34px "Bebas Neue"'
  ctx.fillText('EMERALD EVOLVED', 110, 568)
  ctx.fillStyle = '#6c675e'
  ctx.font = '500 22px "Figtree Variable"'
  ctx.textAlign = 'right'
  ctx.fillText(url.replace(/^https?:\/\//, ''), 1130, 566)
  ctx.textAlign = 'left'

  ctx.globalAlpha = 0.08
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = ctx.createPattern(grain, 'repeat') ?? '#000'
  ctx.fillRect(0, 0, 1200, 630)
  return new Promise((ok) => c.toBlob(ok))
}

export async function saveCardImage(card: CardData, url: string) {
  const blob = await cardImage(card, url)
  if (!blob) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${card.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'species'}-emerald-evolved.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
