import { getStore } from '../../server/store.js'
import { leave } from '../../server/presence.js'
import { offline, readJson } from '../../server/http.js'

/* POST /api/presence/leave {sid} -> 204. Sent with sendBeacon on pagehide. */

export async function POST(req: Request) {
  const store = getStore()
  if (!store) return offline()
  await leave(store, ((await readJson(req)) ?? {}) as object)
  return new Response(null, { status: 204 })
}
