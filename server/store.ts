/* ------------------------------------------------------------------
   The one place the backend touches storage.

   Everything the counter and the registry keep fits in a handful of
   Redis commands, so the adapter is just those commands. Two
   implementations:

   - Upstash Redis over its REST API (what the Vercel marketplace
     integration installs). Plain fetch, no SDK, so swapping provider
     means writing one more object with these methods.
   - Memory, for the dev server and tests, and only when asked for with
     DEV_STORE=memory. It is never chosen implicitly.

   No configuration means no store: getStore() returns null and the API
   answers 503, which the site reads as "hide the counter and registry".
------------------------------------------------------------------ */

export interface Store {
  /** set a key's value; with nx, only if it doesn't exist (returns whether it was set) */
  set(key: string, value: string, opts?: { nx?: boolean; ex?: number }): Promise<boolean>
  get(key: string): Promise<string | null>
  /** increment and, on first increment, expire after ttl seconds */
  incrWithin(key: string, ttl: number): Promise<number>
  zadd(key: string, score: number, member: string): Promise<void>
  zrem(key: string, member: string): Promise<void>
  zremBelow(key: string, maxScore: number): Promise<void>
  zcard(key: string): Promise<number>
  /** members by score; rev = highest first */
  zrange(key: string, start: number, stop: number, rev?: boolean): Promise<string[]>
  mget(keys: string[]): Promise<(string | null)[]>
}

type Env = Record<string, string | undefined>

export function getStore(env: Env = process.env): Store | null {
  if (env.DEV_STORE === 'memory') return memoryStore()
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return upstash(url, token)
  return null
}

/* ---- Upstash REST ------------------------------------------------- */

export function upstash(url: string, token: string): Store {
  const call = async (...cmd: (string | number)[]) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(cmd),
    })
    const j = (await r.json()) as { result?: unknown; error?: string }
    if (!r.ok || j.error) throw new Error(`redis: ${j.error ?? r.status}`)
    return j.result
  }
  return {
    async set(key, value, o = {}) {
      const args: (string | number)[] = ['SET', key, value]
      if (o.nx) args.push('NX')
      if (o.ex) args.push('EX', o.ex)
      return (await call(...args)) === 'OK'
    },
    get: async (key) => (await call('GET', key)) as string | null,
    async incrWithin(key, ttl) {
      const n = Number(await call('INCR', key))
      if (n === 1) await call('EXPIRE', key, ttl)
      return n
    },
    zadd: async (key, score, member) => void (await call('ZADD', key, score, member)),
    zrem: async (key, member) => void (await call('ZREM', key, member)),
    zremBelow: async (key, max) => void (await call('ZREMRANGEBYSCORE', key, '-inf', max)),
    zcard: async (key) => Number(await call('ZCARD', key)),
    zrange: async (key, start, stop, rev) => (await call('ZRANGE', key, start, stop, ...(rev ? ['REV'] : []))) as string[],
    mget: async (keys) => (keys.length ? ((await call('MGET', ...keys)) as (string | null)[]) : []),
  }
}

/* ---- memory (dev and tests only) ---------------------------------- */

let mem: Store | null = null
export function memoryStore(fresh = false): Store {
  if (mem && !fresh) return mem
  const kv = new Map<string, { v: string; until: number }>()
  const zs = new Map<string, Map<string, number>>()
  const live = (k: string) => {
    const e = kv.get(k)
    if (e && e.until && e.until < Date.now()) kv.delete(k)
    return kv.get(k)
  }
  const z = (k: string) => zs.get(k) ?? zs.set(k, new Map()).get(k)!
  const sorted = (k: string) => [...z(k).entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).map((e) => e[0])
  const store: Store = {
    async set(key, value, o = {}) {
      if (o.nx && live(key)) return false
      kv.set(key, { v: value, until: o.ex ? Date.now() + o.ex * 1000 : 0 })
      return true
    },
    get: async (key) => live(key)?.v ?? null,
    async incrWithin(key, ttl) {
      const n = Number(live(key)?.v ?? 0) + 1
      kv.set(key, { v: String(n), until: live(key)?.until || Date.now() + ttl * 1000 })
      return n
    },
    zadd: async (key, score, member) => void z(key).set(member, score),
    zrem: async (key, member) => void z(key).delete(member),
    async zremBelow(key, max) {
      for (const [m, s] of z(key)) if (s <= max) z(key).delete(m)
    },
    zcard: async (key) => z(key).size,
    async zrange(key, start, stop, rev) {
      const all = sorted(key)
      if (rev) all.reverse()
      return all.slice(start, stop < 0 ? all.length + stop + 1 : stop + 1)
    },
    mget: async (keys) => keys.map((k) => live(k)?.v ?? null),
  }
  if (!fresh) mem = store
  return store
}
