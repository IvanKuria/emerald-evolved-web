import { getStore } from '../../server/store.js'
import { one } from '../../server/registry.js'
import { json, offline } from '../../server/http.js'

/* GET /api/registry/:id -> {card} */

export async function GET(req: Request) {
  const store = getStore()
  if (!store) return offline()
  const id = new URL(req.url).pathname.split('/').pop() ?? ''
  const r = await one(store, id)
  return json(r.body, r.status, r.status === 200 ? { 'cache-control': 'public, s-maxage=60' } : {})
}
