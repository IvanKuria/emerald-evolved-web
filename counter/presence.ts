/* The rules of the live counter, shared by the Cloudflare Worker and the
   dev server's stand-in so the two cannot disagree.

   A tab is "here" while it has sent a heartbeat in the last 70 seconds,
   and "playing" if that heartbeat said a game is running. The id is a
   random string the tab makes up and keeps in sessionStorage: no
   cookie, no IP stored, nothing that outlives the tab. */

export const TTL_MS = 70_000

export interface Beat {
  sid: string
  playing: boolean
}

export interface Counts {
  here: number
  playing: number
}

export class Presence {
  private seen = new Map<string, { at: number; playing: boolean }>()

  beat(b: Beat, now = Date.now()) {
    if (typeof b.sid !== 'string' || b.sid.length < 8 || b.sid.length > 64) return
    this.seen.set(b.sid, { at: now, playing: !!b.playing })
  }

  leave(sid: string) {
    this.seen.delete(sid)
  }

  counts(now = Date.now()): Counts {
    let here = 0
    let playing = 0
    for (const [sid, v] of this.seen) {
      if (now - v.at > TTL_MS) {
        this.seen.delete(sid)
        continue
      }
      here++
      if (v.playing) playing++
    }
    return { here, playing }
  }
}
