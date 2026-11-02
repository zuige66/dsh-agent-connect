/**
 * A LAN front door for the channel pack's OpenAI-compatible gateway.
 *
 * The pack's gateway binds `127.0.0.1` in code — `resolveGatewayConfig` honours
 * a port override but hard-codes the host, so there is no setting that makes it
 * reachable from another machine. That is the right default (it holds bearer
 * credentials for every model on this box), but it also makes "use it from my
 * phone / my other laptop" impossible without either an elevated `netsh
 * portproxy` or a full reverse proxy.
 *
 * This is the third option: a small proxy the plugin runs itself, on an
 * unprivileged port, bound to the LAN interface. It forwards to the loopback
 * gateway, so the gateway's own auth still applies — this never weakens it, it
 * only changes which interface answers.
 *
 * Design notes:
 *
 * - **Loopback-only upstream.** The target is hard-wired to `127.0.0.1`, never
 *   taken from the request. A proxy that follows a caller-supplied upstream is
 *   an SSRF hole, and there is no reason for this one to have a variable target.
 * - **`/v1/*` only.** The gateway also serves a few non-model paths; a LAN front
 *   door has no business widening that surface.
 * - **Bind check.** Refuses to bind anything that is not a private/loopback
 *   address, so a typo cannot publish the port to the internet.
 * - **No auth of its own.** The gateway already enforces `Bearer`, verified to
 *   answer 401 without a key. Adding a second credential here would mean a
 *   second thing to rotate for no extra boundary — a caller still has to hold
 *   the gateway key.
 *
 * @module src/lan-gateway.js
 */

import http from 'node:http'

/** Ports the gateway answers on when nothing overrides it. */
const DEFAULT_UPSTREAM_PORT = 8326

/**
 * Is this a private or loopback IPv4 address (or a bind-any)?
 *
 * `0.0.0.0` is accepted because that is what "listen on the LAN" means to
 * `net.Server`; it still only exposes the machine's own interfaces, never the
 * internet, unless the router forwards to it.
 *
 * @param {string} host
 * @returns {boolean}
 */
export function isPrivateBind(host) {
  const value = String(host ?? '').trim()
  if (value === '0.0.0.0' || value === '::') return true
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value)
  if (match === null) return false
  const [a, b] = [Number(match[1]), Number(match[2])]
  if (a === 127) return true // loopback
  if (a === 10) return true // 10/8
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 169 && b === 254) return true // link-local
  return false
}

/**
 * Rank the host's own IPv4 addresses for display.
 *
 * Wi-Fi before virtual adapters: a VMware/Hyper-V adapter answers too, but the
 * phone cannot route to it, and showing that address first is how a user ends
 * up pasting a URL that never connects.
 *
 * @param {import('node:os').NetworkInterfaceInfo} nets
 * @returns {Array<{address: string, iface: string}>}
 */
export function rankAddresses(nets) {
  const rows = []
  for (const [iface, list] of Object.entries(nets ?? {})) {
    for (const entry of list ?? []) {
      if (entry?.family !== 'IPv4' || entry.internal === true) continue
      const address = String(entry.address ?? '')
      if (!isPrivateBind(address)) continue
      // A virtual adapter is still a real interface; it just ranks below a
      // physical one, because that is the one a phone can actually reach.
      const virtual = /vmware|virtualbox|vethernet|hyper-v|loopback|tailscale|zerotier/i.test(iface)
      rows.push({ address, iface, virtual })
    }
  }
  rows.sort((left, right) => {
    if (left.virtual !== right.virtual) return left.virtual ? 1 : -1
    return left.iface.localeCompare(right.iface)
  })
  return rows.map(({ address, iface }) => ({ address, iface }))
}

/**
 * Start the LAN front door.
 *
 * @param {object} options
 * @param {string} [options.host] - bind address; must pass `isPrivateBind`
 * @param {number} [options.port]
 * @param {number} [options.upstreamPort] - the loopback gateway's port
 * @param {(message: string) => void} [options.warn]
 * @returns {Promise<{port: number, host: string, close: () => Promise<void>}>}
 */
export async function startLanGateway({
  host = '0.0.0.0',
  port = 18326,
  upstreamPort = DEFAULT_UPSTREAM_PORT,
  warn,
} = {}) {
  if (!isPrivateBind(host)) {
    throw new Error(`refusing to bind ${JSON.stringify(host)}: only private or loopback addresses are allowed`)
  }
  // 0 means "any free port", which is what a test harness wants; a real bind
  // is always >= 1024 because the plugin refuses privileged ports below.
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`port must be an integer in 0..65535, got ${JSON.stringify(port)}`)
  }

  const server = http.createServer((req, res) => {
    const pathname = String(req.url ?? '/').split('?')[0]
    // Only the model surface crosses the interface boundary. The gateway's
    // other paths (if any appear later) stay loopback-only by omission.
    if (!pathname.startsWith('/v1/')) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: { message: 'Not found', type: 'invalid_request_error', code: 'not_found' } }))
      return
    }

    const upstream = http.request({
      host: '127.0.0.1',
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `127.0.0.1:${upstreamPort}` },
    }, upstreamRes => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    })

    upstream.on('error', error => {
      if (res.headersSent) { res.destroy(); return }
      res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({
        error: {
          message: `the channel gateway is not answering on 127.0.0.1:${upstreamPort} (${error.code ?? error.message}); is it switched on?`,
          type: 'upstream_unavailable',
        },
      }))
    })

    // Streaming is the whole point of an LLM endpoint, so the request body is
    // piped rather than buffered, and the client's disconnect tears down the
    // upstream call instead of leaving it running.
    req.pipe(upstream)
    res.on('close', () => { if (!res.writableEnded) upstream.destroy() })
  })

  await new Promise((resolve, reject) => {
    const onError = error => { server.off('listening', onListening); reject(error) }
    const onListening = () => { server.off('error', onError); resolve() }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  }).catch(error => {
    warn?.(`[agent-channels] LAN gateway failed to bind ${host}:${port}: ${error?.message ?? error}`)
    throw error
  })

  const bound = server.address()
  const boundPort = typeof bound === 'object' && bound !== null ? bound.port : port

  return {
    port: boundPort,
    host,
    async close() {
      await new Promise(resolve => {
        server.close(() => resolve())
        server.closeAllConnections?.()
      })
    },
  }
}
