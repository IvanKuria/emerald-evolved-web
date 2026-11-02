/* The live player counter: one Cloudflare Worker in front of one Durable
   Object. Not deployed; see DESIGN.md "The counter" for why this shape.

     POST /api/presence   {sid, playing}   -> {here, playing}
     POST /api/presence/leave {sid}        -> 204   (sent with sendBeacon on pagehide)
     GET  /api/presence                    -> {here, playing}  (cached 5 s at the edge)

   One object holds the whole count in memory. A heartbeat every 25 s from
   a few thousand tabs is a couple of hundred requests a second at the
   very top of a launch, which a single Durable Object handles; the count
   is a number on a web page, not a ledger, so losing it on an eviction
   costs one TTL (70 s) of under-counting and nothing else. */

import { Presence } from './presence'

export interface Env {
  PRESENCE: DurableObjectNamespace
  ALLOWED_ORIGIN: string
}

const json = (body: unknown, init: ResponseInit = {}, origin = '*') =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': origin,
      'cross-origin-resource-policy': 'same-site',
      ...(init.headers ?? {}),
    },
  })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/presence')) return new Response('not found', { status: 404 })
    if (req.method === 'OPTIONS')
      return new Response(null, {
        headers: {
          'access-control-allow-origin': env.ALLOWED_ORIGIN,
          'access-control-allow-methods': 'GET, POST',
          'access-control-allow-headers': 'content-type',
        },
      })
    const stub = env.PRESENCE.get(env.PRESENCE.idFromName('global'))
    if (req.method === 'GET') {
      const cache = caches.default
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await stub.fetch(req)
      const out = new Response(res.body, res)
      out.headers.set('cache-control', 'public, max-age=5')
      await cache.put(req, out.clone())
      return out
    }
    return stub.fetch(req)
  },
}

export class PresenceObject {
  private p = new Presence()
  constructor(_state: DurableObjectState, private env: Env) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const origin = this.env.ALLOWED_ORIGIN
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as { sid?: string; playing?: boolean } | null
      if (!body?.sid) return json({ error: 'sid required' }, { status: 400 }, origin)
      if (url.pathname.endsWith('/leave')) {
        this.p.leave(body.sid)
        return new Response(null, { status: 204 })
      }
      this.p.beat({ sid: body.sid, playing: !!body.playing })
    }
    return json(this.p.counts(), {}, origin)
  }
}
