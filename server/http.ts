/* Small helpers shared by the Vercel functions (api/) and the dev server. */

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  })

/** The answer when no storage is configured: the site hides the feature. */
export const offline = () => json({ error: 'offline' }, 503)

export async function readJson(req: Request, max = 4096): Promise<unknown> {
  const text = await req.text()
  if (text.length > max) return null
  try {
    return JSON.parse(text || '{}')
  } catch {
    return null
  }
}

/** The client's address, for rate limiting only (hashed before use, never stored). */
export const clientAddr = (req: Request) =>
  req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
