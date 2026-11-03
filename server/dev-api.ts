import type { Plugin, ViteDevServer } from 'vite'

/* ------------------------------------------------------------------
   The dev server runs the real Vercel functions in api/, so local
   development exercises the same code that deploys. A request to
   /api/presence/leave is served by api/presence/leave.ts, /api/registry
   by api/registry/index.ts, /api/registry/abc by api/registry/[id].ts.

   Storage follows the same rule as production: none unless configured.
   DEV_STORE=memory gives an in-memory store for trying the counter and
   the registry locally (it holds only what you put in it).
------------------------------------------------------------------ */

const ROUTES: [RegExp, string][] = [
  [/^\/api\/presence\/leave$/, '/api/presence/leave.ts'],
  [/^\/api\/presence$/, '/api/presence/index.ts'],
  [/^\/api\/registry$/, '/api/registry/index.ts'],
  [/^\/api\/registry\/[^/]+$/, '/api/registry/[id].ts'],
]

export function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'https://localhost')
        const route = ROUTES.find(([re]) => re.test(url.pathname))
        if (!route) return next()
        try {
          const mod = (await server.ssrLoadModule(route[1])) as Record<string, (r: Request) => Promise<Response>>
          const handler = mod[req.method ?? 'GET']
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && !k.startsWith(':')) headers.set(k, v)
          headers.set('x-real-ip', req.socket.remoteAddress ?? 'local')
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
          const out = await handler(new Request(url, { method: req.method, headers, body }))
          res.statusCode = out.status
          out.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await out.arrayBuffer()))
        } catch (e) {
          server.config.logger.error(String(e))
          res.statusCode = 500
          res.end()
        }
      })
    },
  }
}
