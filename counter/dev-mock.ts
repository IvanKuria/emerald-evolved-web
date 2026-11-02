/* The counter's API, served by the Vite dev server so the site's real
   client code runs against something. Same rules (presence.ts), same
   routes as worker.ts.

   PRESENCE_DEMO=<n> adds a fixed number of pretend players so the design
   can be judged with launch-sized numbers. It is off unless that
   variable is set, and it only exists here, never in the Worker. */

import type { Plugin } from 'vite'
import { Presence } from './presence.ts'

export function presenceMock(): Plugin {
  const p = new Presence()
  const demo = Number(process.env.PRESENCE_DEMO ?? 0) || 0
  return {
    name: 'presence-mock',
    configureServer(server) {
      server.middlewares.use('/api/presence', (req, res) => {
        const send = () => {
          const c = p.counts()
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ here: c.here + Math.round(demo * 1.6), playing: c.playing + demo }))
        }
        if (req.method !== 'POST') return send()
        let raw = ''
        req.on('data', (d) => (raw += d))
        req.on('end', () => {
          try {
            const b = JSON.parse(raw || '{}')
            if (req.url?.startsWith('/leave')) p.leave(b.sid)
            else p.beat(b)
          } catch {
            /* a bad beat is ignored, the same as the Worker */
          }
          send()
        })
      })
    },
  }
}
