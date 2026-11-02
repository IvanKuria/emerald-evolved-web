/* The game's own text. Emerald's message font (graphics/fonts/
   latin_normal.png, already in its message colours) and its width
   table, drawn glyph by glyph the way text.c does it: look the
   character up in the charmap, copy its 16x16 cell, advance by its
   width. Lines are 16 px apart, as in a real message box.

   Only the game speaks in this font. The site speaks in Figtree. */

export interface GameFont {
  sheet: HTMLImageElement
  widths: number[]
  charmap: Record<string, number>
}

let font: Promise<GameFont> | null = null

const img = (src: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = bad
    i.src = src
  })

export function loadFont(): Promise<GameFont> {
  font ??= Promise.all([img('/game/font_message.png'), fetch('/game/font.json').then((r) => r.json())]).then(
    ([sheet, j]) => ({ sheet, widths: j.widths, charmap: j.charmap }),
  )
  return font
}

/* The charmap uses the game's own spellings; a few typographic
   characters are folded onto the ones the font has. */
const FOLD: Record<string, string> = { "'": '’', '"': '”', '—': '-', '–': '-' }

export function glyphs(f: GameFont, text: string) {
  return [...text].map((ch) => {
    const id = f.charmap[FOLD[ch] ?? ch] ?? f.charmap[' ']
    return { id, w: f.widths[id] ?? 6 }
  })
}

export function measure(f: GameFont, text: string) {
  return glyphs(f, text).reduce((a, g) => a + g.w, 0)
}

/** Greedy word wrap to `width` native pixels. Explicit \n is honoured. */
export function wrap(f: GameFont, text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? line + ' ' + word : word
      if (measure(f, next) <= width || !line) line = next
      else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

/** Draw `text` (up to `chars` characters of it) at native scale. */
export function drawText(ctx: CanvasRenderingContext2D, f: GameFont, text: string, x: number, y: number, chars = Infinity) {
  let cx = x
  let n = 0
  for (const g of glyphs(f, text)) {
    if (n++ >= chars) return
    ctx.drawImage(f.sheet, (g.id % 16) * 16, Math.floor(g.id / 16) * 16, 16, 16, cx, y, 16, 16)
    cx += g.w
  }
}
