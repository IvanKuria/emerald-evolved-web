import { getStore } from '../../server/store.js'
import { beat, counts } from '../../server/presence.js'
import { json, offline, readJson } from '../../server/http.js'

/* POST /api/presence {sid, playing} -> {here, playing};  GET -> {here, playing} (cached 5 s at the edge). */

export async function POST(req: Request) {
  const store = getStore()
  if (!store) return offline()
  return json(await beat(store, ((await readJson(req)) ?? {}) as object))
}

export async function GET() {
  const store = getStore()
  if (!store) return offline()
  return json(await counts(store), 200, { 'cache-control': 'public, s-maxage=5' })
}
