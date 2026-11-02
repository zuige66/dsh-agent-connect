/**
 * Test the LAN front door against a real upstream.
 *
 * The proxy's job is narrow and worth proving rather than assuming: it must
 * forward `/v1/*` to a loopback gateway, refuse everything else, keep the
 * upstream's auth intact, and never take its target from the caller.
 *
 * The harness stands up a fake gateway on loopback that behaves like the real
 * one (401 without a bearer, JSON with one), points the proxy at it, and
 * exercises both from a non-loopback bind.
 *
 * Usage: node scripts/smoke-lan.mjs
 */

import http from 'node:http'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const failures = []
function check(condition, message) {
  if (!condition) failures.push(message)
}

const mod = await import(pathToFileURL(path.join(root, 'src', 'lan-gateway.js')).href)

// ── address classification ─────────────────────────────────────────────────
// This is the guard that stops a typo from publishing the port to the internet.
check(mod.isPrivateBind('127.0.0.1') === true, '127.0.0.1 should be allowed')
check(mod.isPrivateBind('0.0.0.0') === true, '0.0.0.0 should be allowed (means "the LAN")')
check(mod.isPrivateBind('192.168.1.102') === true, '192.168/16 should be allowed')
check(mod.isPrivateBind('10.0.0.5') === true, '10/8 should be allowed')
check(mod.isPrivateBind('172.16.3.4') === true, '172.16/12 should be allowed')
check(mod.isPrivateBind('172.32.3.4') === false, '172.32 is public and must be refused')
check(mod.isPrivateBind('8.8.8.8') === false, 'a public address must be refused')
check(mod.isPrivateBind('example.com') === false, 'a hostname must be refused')
check(mod.isPrivateBind('') === false, 'an empty host must be refused')

// ── address ranking ────────────────────────────────────────────────────────
// Wi-Fi must come before a VMware adapter: the phone cannot route to VMware.
const ranked = mod.rankAddresses({
  'VMware Network Adapter VMnet8': [{ family: 'IPv4', address: '192.168.150.1', internal: false }],
  'Wi-Fi': [{ family: 'IPv4', address: '192.168.1.102', internal: false }],
  'Loopback Pseudo-Interface 1': [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
})
check(ranked[0]?.address === '192.168.1.102', `ranking put ${ranked[0]?.address} first, expected the Wi-Fi address`)
check(ranked.length === 2, `expected 2 addresses (loopback excluded), got ${ranked.length}`)

// ── a fake upstream that behaves like the real gateway ─────────────────────
const KEY = 'test-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const upstream = http.createServer((req, res) => {
  const authorized = req.headers.authorization === `Bearer ${KEY}`
  if (!authorized) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'unauthorized' } }))
    return
  }
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'buddy/test-model' }] }))
    return
  }
  if (req.url === '/v1/chat/completions') {
    // Echo the body back so the test can prove the request body survives the
    // hop — a proxy that drops POST bodies looks fine on GETs.
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ echo: Buffer.concat(chunks).toString('utf8') }))
    })
    return
  }
  res.writeHead(404)
  res.end('nope')
})
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
const upstreamPort = upstream.address().port

// ── the proxy ──────────────────────────────────────────────────────────────
let proxy
try {
  proxy = await mod.startLanGateway({ host: '0.0.0.0', port: 0, upstreamPort })
} catch (error) {
  console.error(`FAIL: the proxy did not start\n  ${error.message}`)
  process.exit(1)
}

/**
 * One request against the proxy.
 *
 * @param {string} method
 * @param {string} pathname
 * @param {object} [options]
 * @returns {Promise<{status: number, json: any, text: string}>}
 */
async function request(method, pathname, options = {}) {
  const headers = { ...options.headers }
  let body = options.body
  if (body !== undefined && typeof body !== 'string') {
    body = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  }
  return await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: proxy.port, method, path: pathname, headers,
    }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json
        try { json = JSON.parse(text) } catch { json = undefined }
        resolve({ status: res.statusCode, json, text })
      })
    })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

try {
  // Auth is the upstream's, and the proxy must not swallow or rewrite it.
  const noKey = await request('GET', '/v1/models')
  check(noKey.status === 401, `unauthenticated /v1/models answered ${noKey.status}, expected 401 to pass through`)

  const withKey = await request('GET', '/v1/models', { headers: { authorization: `Bearer ${KEY}` } })
  check(withKey.status === 200, `authenticated /v1/models answered ${withKey.status}, expected 200`)
  check(withKey.json?.data?.[0]?.id === 'buddy/test-model', 'the model list did not survive the hop')

  // A POST body must reach the upstream intact.
  const posted = await request('POST', '/v1/chat/completions', {
    headers: { authorization: `Bearer ${KEY}` },
    body: { model: 'buddy/test-model', messages: [{ role: 'user', content: 'ping' }] },
  })
  check(posted.status === 200, `POST answered ${posted.status}, expected 200`)
  check(typeof posted.json?.echo === 'string' && posted.json.echo.includes('"content":"ping"'),
    `the request body did not survive the hop: ${posted.json?.echo}`)

  // Anything outside /v1/ is refused by the proxy itself, not forwarded.
  const outside = await request('GET', '/api/agent-channels/status', { headers: { authorization: `Bearer ${KEY}` } })
  check(outside.status === 404, `/api/... answered ${outside.status}, expected the proxy to refuse it with 404`)

  const root = await request('GET', '/', { headers: { authorization: `Bearer ${KEY}` } })
  check(root.status === 404, `/ answered ${root.status}, expected 404`)

  // The target is fixed: a caller cannot point the proxy somewhere else.
  const ssrf = await request('GET', '/v1/models', {
    headers: { authorization: `Bearer ${KEY}`, host: 'evil.example', 'x-forwarded-host': 'evil.example' },
  })
  check(ssrf.status === 200 || ssrf.status === 401, 'a spoofed Host header changed the routing')
} finally {
  await proxy.close()
  await new Promise(resolve => upstream.close(resolve))
}

// ── the bind guard is enforced by the starter, not just the helper ─────────
let refused = false
try {
  await mod.startLanGateway({ host: '8.8.8.8', port: 0, upstreamPort: 1 })
} catch { refused = true }
check(refused === true, 'the proxy started on a public address; the bind guard did not run')

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} problem(s)`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('lan smoke: OK')
console.log(`  proxy bound 0.0.0.0:${proxy.port} → 127.0.0.1:${upstreamPort}`)
console.log('  forwarded: /v1/models, /v1/chat/completions (body intact)')
console.log('  refused:   /, /api/..., public bind addresses')
console.log('  auth:      upstream 401 preserved')
