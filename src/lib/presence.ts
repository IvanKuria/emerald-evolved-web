/* The client half of the live counter (server half: api/presence, server/presence.ts).

   One random id per tab, kept in sessionStorage. A heartbeat every 25
   seconds while the tab is visible says whether a game is running; the
   reply is the current count, so the page never needs a second request
   to show it. On pagehide a beacon says goodbye, so closing the tab
   takes you off the count at once instead of after the 70 s timeout. */

import { useEffect, useState } from 'react'

const ENDPOINT = '/api/presence'
const EVERY = 25_000

const sid = (() => {
  try {
    let v = sessionStorage.getItem('pe-sid')
    if (!v) {
      v = crypto.getRandomValues(new Uint32Array(3)).join('-')
      sessionStorage.setItem('pe-sid', v)
    }
    return v
  } catch {
    return String(Math.random()).slice(2)
  }
})()

let playing = false
const listeners = new Set<(c: Counts | null) => void>()
let last: Counts | null = null

export interface Counts {
  here: number
  playing: number
}

let off = false

async function beat() {
  if (document.hidden || off) return
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sid, playing }),
    })
    if (r.status === 503) {
      // no storage behind the API: the counter doesn't exist yet, so stop asking and show nothing
      clearInterval(timer)
      off = true
    }
    if (!r.ok) throw new Error(String(r.status))
    last = (await r.json()) as Counts
  } catch {
    last = null
  }
  listeners.forEach((l) => l(last))
}

let timer: number | undefined
function start() {
  if (timer !== undefined) return
  beat()
  timer = window.setInterval(beat, EVERY)
  document.addEventListener('visibilitychange', () => !document.hidden && beat())
  addEventListener('pagehide', () =>
    !off && navigator.sendBeacon?.(`${ENDPOINT}/leave`, new Blob([JSON.stringify({ sid })], { type: 'application/json' })),
  )
}

/** Tell the counter this tab is (or is no longer) running the game. */
export function setPlaying(on: boolean) {
  if (playing === on) return
  playing = on
  beat()
}

export function usePresence(): Counts | null {
  const [c, setC] = useState<Counts | null>(last)
  useEffect(() => {
    listeners.add(setC)
    start()
    return () => void listeners.delete(setC)
  }, [])
  return c
}
