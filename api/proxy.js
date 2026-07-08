// Same-origin CORS proxy running as a Vercel serverless function.
// The browser calls /api/proxy?url=<encoded> — same origin, so no CORS and no
// dependency on flaky public proxies. Host-allowlisted so it can't be abused.
const ALLOWED = new Set([
  'feeds.bbci.co.uk',
  'www.theguardian.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com'
])

export default async function handler(req, res) {
  const target = req.query?.url
  if (!target) return res.status(400).send('missing url')

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return res.status(400).send('bad url')
  }
  if (!ALLOWED.has(parsed.hostname)) return res.status(403).send('host not allowed')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const upstream = await fetch(parsed.href, {
      signal: ctrl.signal,
      headers: {
        // Yahoo and some feeds reject requests without a browser-like UA
        'User-Agent': 'Mozilla/5.0 (compatible; EthanDashboard/1.0)',
        Accept: '*/*'
      }
    })
    clearTimeout(timer)
    const body = await upstream.text()
    res.setHeader('content-type', upstream.headers.get('content-type') || 'text/plain; charset=utf-8')
    // let Vercel's edge cache absorb repeat hits and cut function invocations
    res.setHeader('cache-control', 's-maxage=120, stale-while-revalidate=600')
    return res.status(upstream.status).send(body)
  } catch (e) {
    clearTimeout(timer)
    return res.status(502).send('upstream error: ' + (e?.name === 'AbortError' ? 'timeout' : e?.message))
  }
}
