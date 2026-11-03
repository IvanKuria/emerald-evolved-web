/* ------------------------------------------------------------------
   What a player may call their species, and what a trainer name may be.

   Names follow the game's own rules first: the letters a Gen 3 name can
   hold, at most 12 characters for a species (the expansion's nickname
   length) and 7 for a trainer. Then a small blocklist, matched after
   folding look-alike digits and symbols and dropping spaces, so "f u c k"
   and "fvck" don't slip through. It is a guard against the obvious, not
   a moderation system; the registry can also hide a card by id.
------------------------------------------------------------------ */

const ALLOWED = /^[A-Za-z0-9 é!?.\-’'&+=%()…“”‘♂♀,/]+$/

/* Kept deliberately short and unambiguous. Matched as substrings of the
   folded name. */
const BLOCK = [
  'fuck', 'fuk', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'cock', 'dick', 'pussy', 'penis', 'vagina',
  'rape', 'rapist', 'porn', 'sex', 'nazi', 'hitler', 'kkk', 'nigg', 'niga', 'fag', 'retard', 'tranny', 'chink', 'spic',
  'kike', 'wetback', 'gook', 'coon', 'dyke', 'twat', 'wank', 'jizz', 'tits', 'boob', 'nude', 'killyour', 'kys',
]
/* Real words that contain a blocked string. */
const ALLOW = ['cocktail', 'cockatoo', 'peacock', 'scunthorpe', 'cumulus', 'sussex', 'essex', 'analog', 'canal', 'grape', 'drape', 'scrape', 'raccoon', 'cocoon', 'tycoon', 'spice', 'spicy', 'auspic', 'conspic', 'hancock', 'dickens']

const FOLD: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '+': 't', v: 'u', é: 'e' }

export function fold(s: string) {
  return [...s.toLowerCase()].map((c) => FOLD[c] ?? c).join('').replace(/[^a-z]/g, '')
}

export function isOffensive(s: string) {
  let f = fold(s)
  for (const ok of ALLOW) f = f.split(ok).join('')
  return BLOCK.some((w) => f.includes(w))
}

export type NameCheck = { ok: true; value: string } | { ok: false; error: string }

export function checkName(raw: unknown, max: number, what: string): NameCheck {
  if (typeof raw !== 'string') return { ok: false, error: `Give it ${what}.` }
  const value = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!value) return { ok: false, error: `Give it ${what}.` }
  if ([...value].length > max) return { ok: false, error: `That’s too long. The game fits ${max} characters.` }
  if (!ALLOWED.test(value)) return { ok: false, error: 'Use letters, numbers and the punctuation the game has.' }
  if (isOffensive(value)) return { ok: false, error: 'Pick a different name.' }
  return { ok: true, value }
}

export const SPECIES_NAME_MAX = 12
export const TRAINER_NAME_MAX = 7
