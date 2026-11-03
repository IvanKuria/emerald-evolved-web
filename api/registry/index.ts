import { getStore } from '../../server/store.js'
import { list, submit } from '../../server/registry.js'
import { clientAddr, json, offline, readJson } from '../../server/http.js'

/* GET /api/registry -> {total, first, cards};  POST /api/registry {card submission} -> {card, first}. */

export async function GET(req: Request) {
  const store = getStore()
  if (!store) return offline()
  const r = await list(store, Number(new URL(req.url).searchParams.get('limit') ?? 48))
  return json(r.body, r.status, { 'cache-control': 'public, s-maxage=10' })
}

export async function POST(req: Request) {
  const store = getStore()
  if (!store) return offline()
  const r = await submit(store, await readJson(req), clientAddr(req))
  return json(r.body, r.status)
}
