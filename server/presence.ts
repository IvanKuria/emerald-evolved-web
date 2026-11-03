import type { Store } from './store.js'

/* ------------------------------------------------------------------
   The live counter. A tab is "here" while it has sent a heartbeat in
   the last 70 seconds, and "playing" if that heartbeat said a game is
   running. The id is a random string the tab makes up and keeps in
   sessionStorage: no cookie, no IP stored, nothing that outlives it.

   Two sorted sets scored by last-seen time; old entries are trimmed on
   every beat, so the count is the set size.
------------------------------------------------------------------ */

export const TTL_MS = 70_000
const HERE = 'presence:here'
const PLAYING = 'presence:playing'

export interface Counts {
  here: number
  playing: number
}

const validSid = (sid: unknown): sid is string => typeof sid === 'string' && sid.length >= 8 && sid.length <= 64

export async function beat(store: Store, body: { sid?: unknown; playing?: unknown }, now = Date.now()): Promise<Counts> {
  if (validSid(body.sid)) {
    await store.zadd(HERE, now, body.sid)
    if (body.playing === true) await store.zadd(PLAYING, now, body.sid)
    else await store.zrem(PLAYING, body.sid)
  }
  return counts(store, now)
}

export async function leave(store: Store, body: { sid?: unknown }) {
  if (!validSid(body.sid)) return
  await store.zrem(HERE, body.sid)
  await store.zrem(PLAYING, body.sid)
}

export async function counts(store: Store, now = Date.now()): Promise<Counts> {
  await store.zremBelow(HERE, now - TTL_MS)
  await store.zremBelow(PLAYING, now - TTL_MS)
  return { here: await store.zcard(HERE), playing: await store.zcard(PLAYING) }
}
