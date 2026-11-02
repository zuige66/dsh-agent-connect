/**
 * Agent Channels — plugin entry (Host half).
 *
 * One job, and only one: mount the thirteen agent account channels (CodeArts,
 * CodeBuddy / WorkBuddy, LobsterAI, Qoder / Qoder CN, TRAE, Cline, Loomy,
 * Raccoon, MiniMax Code, ZCode, Gemini) into this dsh composition, and give the
 * browser half the two host services it needs to drive them.
 *
 * Everything the upstream `dsh-our-free-model` plugin does *around* those
 * channels — its own free model lane, the EAC co-paid lane, the Kilo pool, the
 * aggregate provider registry, token savers, fallback chains, the usage
 * dashboard, the OpenAI forward listener, the announcement feed and the
 * self-updater — is deliberately absent here. This package is the channel
 * feature on its own.
 *
 * ## What is inherited and what is new
 *
 * The channel implementations themselves are *not* rewritten. They ship as the
 * vendored bundle `vendor/channel-pack/pack.js`, the same bundle upstream
 * absorbed from `dsh-codearts-auth` (provenance in `vendor/channel-pack/NOTICE.md`),
 * mounted unchanged on its own fiber. Re-implementing thirteen login flows,
 * account pools and per-product request shapes would only drift away from the
 * versions that were validated upstream.
 *
 * What this file adds is the surface the pack expects from its host:
 *
 * 1. the mount itself, on a fiber that pends on `credentials` + `commands` +
 *    `llm` and never blocks the composition when they are missing;
 * 2. `POST /api/agent-channels/open-external` — the login flow opens a browser
 *    tab, and a popup the browser blocks must still be recoverable. The pack's
 *    own browser half used a host route for that; this plugin's page does the
 *    same, and this is the route it calls;
 * 3. the trust fence in front of that route (`src/trust.js`), because the
 *    plugin's prefix outranks the kernel's `/api` in webServer's
 *    longest-prefix dispatch and would otherwise answer any loopback caller.
 *
 * The channel operations themselves (login, account list, model toggles,
 * credit claims) do *not* travel through this file: they go over the
 * composition's own `connection` RPC service at `/api/channel-pack`, which the
 * pack registers itself. That keeps every credential inside the host's
 * credential store and out of a JSON route this plugin would have to guard.
 *
 * @module index.js
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { externalUrl, openExternal } from './src/open-external.js'
import { connectionAdmissionView, rejectionFor } from './src/trust.js'
import { rankAddresses, startLanGateway } from './src/lan-gateway.js'

export const name = 'agent-channels'

/** Installed package directory — `icon.svg` and the version live here. */
const PKG_DIR = fileURLToPath(new URL('./', import.meta.url))

/** Published version of the installed package, read once at load. */
function readPackageVersion() {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')).version ?? '')
  } catch {
    return ''
  }
}

export const version = readPackageVersion()

/**
 * `llm` is what the channels exist for, so it is the only hard requirement of
 * this plugin. `credentials` and `commands` are what the pack names in its own
 * `inject`; a composition missing them loses the channels rather than the
 * plugin, which is the same trade upstream makes.
 *
 * Nothing else may be named here. `webServer` in particular is reached through
 * a nested `ctx.inject` fiber below, so a headless composition keeps the
 * channels and only loses the settings page — naming it here would leave this
 * whole plugin pending forever on a composition that has no HTTP server.
 */
export const inject = ['llm']

/** Fixed body cap for the open-external route; it carries one URL, nothing else. */
const MAX_BODY_BYTES = 8 * 1024

/**
 * Read a request body as text, refusing anything over `MAX_BODY_BYTES`.
 *
 * The route is only reachable from the settings page, but a body cap is the
 * difference between "a URL arrives" and "an unbounded string is buffered in
 * the host process", and it costs four lines.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * @param {object} ctx - the cordis context handed to `apply`
 * @param {object} config - bundle config (unused today; kept for the schema's sake)
 */
export function apply(ctx, config = {}) {
  const logger = ctx.logger ?? console

  /**
   * The trust fence's view of the connection service, looked up per request.
   *
   * The browser half publishes `connection` after plugins have loaded, so
   * reading it once here would freeze in "absent" and leave every request on
   * the structural replica fence for the life of the process. `ctx.get` is the
   * opportunistic lookup that answers `undefined` instead of throwing.
   */
  const optional = service => (typeof ctx.get === 'function' ? ctx.get(service) : undefined)
  const fenceConnection = connectionAdmissionView(() => optional('connection'))

  /**
   * Look a service up through a *scoped* context.
   *
   * `optional` above reads the root context, which is right for the fence (it
   * needs the long-lived `connection`) but wrong inside an `inject` fiber: a
   * scoped context sees the services its own fiber declared, and reading the
   * root one would miss `accountPool`, the service the channel pack provides.
   *
   * @param {object} scoped
   * @param {string} service
   * @returns {unknown}
   */
  const optionalIn = (scoped, service) => {
    try {
      if (typeof scoped.get === 'function') return scoped.get(service)
      if (scoped[service] !== undefined) return scoped[service]
    } catch { /* a service that throws on read is absent as far as we care */ }
    return undefined
  }

  const logAdmissionRejection = ({ status, source, reason }) => {
    // Fixed fields only: headers and request URLs may contain credentials.
    logger.warn?.(`agent-channels: open-external admission rejected status=${status} source=${source} reason=${reason}`)
  }

  // ── the channel pack ──────────────────────────────────────────────────────
  /**
   * Mount the thirteen channels on a fiber of their own, after `credentials`,
   * `commands` and `llm` exist.
   *
   * The dynamic import is deliberate: the pack's own imports (the kernel's llm,
   * credential and schema modules) are host-provided, and a composition that
   * lacks one of them must still load this plugin far enough to say *why* the
   * channel list is empty instead of failing to load at all.
   *
   * `channels` is the state bit `/status` reports, so the page can print the
   * failure reason rather than an empty grid.
   */
  const channels = { state: 'pending', error: '' }
  ctx.inject(['credentials', 'commands', 'llm'], scoped => {
    let stopped = false
    scoped.effect(() => () => { stopped = true }, 'agent-channels: channel pack')

    // ── one pack per process ───────────────────────────────────────────────
    // The pack is a process-wide singleton: it registers the RPC at
    // `/api/channel-pack`, provides the `accountPool` service and binds the
    // channels' OpenAI gateway port. Two plugins that both mount it — this one,
    // and `dsh-our-free-model`, which vendors the same bundle — would register
    // the same RPC path twice and fight over the same port.
    //
    // The check runs *before* the dynamic import, because the import is the
    // expensive half and a second mounter has nothing to gain from it.
    //
    // Two signals, because the other mounter may be either plugin:
    //
    // - `accountPool` is the service the pack provides, so it is present iff
    //   *any* copy already mounted. This is what catches upstream.
    // - the global symbol catches a second `dsh-agent-connect` instance, which
    //   has not provided the service yet at the moment it checks (the provide
    //   happens at the end of the pack's `apply`).
    //
    // The symbol lives on `globalThis`, not in module scope, on purpose: the
    // two plugins load the bundle from *different* files, so a module-level
    // flag would not be shared between them while the process is.
    const CLAIM = Symbol.for('dsh.channel-pack.mounted')
    const mountedBy = optionalIn(scoped, 'accountPool') !== undefined ? 'another plugin' : globalThis[CLAIM]
    if (mountedBy !== undefined) {
      channels.state = 'ready'
      channels.error = ''
      logger.info?.(`agent-channels: channel pack already mounted by ${mountedBy}; reusing it`)
      return
    }
    globalThis[CLAIM] = 'agent-channels'
    scoped.effect(() => () => {
      if (globalThis[CLAIM] === 'agent-channels') delete globalThis[CLAIM]
    }, 'agent-channels: channel pack claim')

    void import('./vendor/channel-pack/pack.js').then(pack => {
      if (stopped) return
      pack.apply(scoped, {
        // The pack ships an OpenCode adapter alongside the thirteen channels;
        // it is off by default upstream and this plugin has no page to drive
        // it, so it stays off here too.
        disableOpencode: true,
      })
      channels.state = 'ready'
      channels.error = ''
      logger.info?.('agent-channels: channel pack mounted (CodeArts, CodeBuddy, and 11 more)')
    }).catch(error => {
      if (stopped) return
      // The claim is released on failure, or the next mount attempt in this
      // process would see a phantom "already mounted" and silently do nothing.
      if (globalThis[CLAIM] === 'agent-channels') delete globalThis[CLAIM]
      channels.state = 'failed'
      channels.error = String(error?.message ?? error).slice(0, 300)
      logger.warn?.(`agent-channels: channel pack unavailable (${channels.error})`)
    })
  })

  // ── browser-facing routes ─────────────────────────────────────────────────
  /**
   * `POST /api/agent-channels/open-external` — hand a login URL to the OS.
   *
   * The pack's login is two-phase: `account.create` answers with a URL the page
   * should open *immediately* (a popup opened after a 30-second await is
   * blocked). The page tries `window.open` first; when the browser blocks it,
   * it falls back to this route, which launches the default browser from the
   * host process where no popup blocker exists.
   *
   * Answers `{ opened: boolean }` and never the URL back, so a probe cannot use
   * this route to reflect an attacker-chosen string into the page.
   */
  async function openExternalRoute(req, res) {
    const rejection = rejectionFor(req, fenceConnection, logAdmissionRejection)
    if (rejection !== undefined) {
      res.writeHead(rejection, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(rejection === 401 ? 'unauthorized' : rejection === 503 ? 'admission unavailable' : 'forbidden')
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'POST' })
      res.end('method not allowed')
      return
    }
    let status = 200
    let payload
    try {
      const raw = await readBody(req)
      let parsed
      try { parsed = raw === '' ? {} : JSON.parse(raw) } catch { parsed = null }
      if (parsed === null || typeof parsed !== 'object') {
        status = 400
        payload = { opened: false, error: 'the request body must be a JSON object' }
      } else {
        // `externalUrl` is the single gate: http(s) only, no credentials in the
        // authority, length-capped. Anything else answers `false` rather than
        // throwing, because "the browser did not open" is a normal outcome.
        const url = externalUrl(parsed.url)
        payload = { opened: url !== null && await openExternal(url) }
      }
    } catch (error) {
      status = error?.status === 413 ? 413 : 400
      payload = { opened: false, error: status === 413 ? 'body too large' : 'malformed request' }
    }
    const body = JSON.stringify(payload)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    })
    res.end(body)
  }

  /**
   * `GET /api/agent-channels/status` — the pack's mount state and version.
   *
   * The page needs to tell "no accounts yet" apart from "the pack failed to
   * mount", and the second case has a reason worth printing.
   */
  function statusRoute(req, res) {
    const rejection = rejectionFor(req, fenceConnection, logAdmissionRejection)
    if (rejection !== undefined) {
      res.writeHead(rejection, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(rejection === 401 ? 'unauthorized' : rejection === 503 ? 'admission unavailable' : 'forbidden')
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET' })
      res.end('method not allowed')
      return
    }
    const body = JSON.stringify({ version, channels, lan: lanStatus() })
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  }

  // ── the LAN front door ────────────────────────────────────────────────────
  /**
   * The pack's gateway binds `127.0.0.1` in code, so another machine on the
   * same network cannot reach it. This plugin runs its own proxy on the LAN
   * interface in front of it (`src/lan-gateway.js`).
   *
   * It is **off by default** and has to be turned on from the page. A plugin
   * that opens a port on the local network the moment it is installed is a
   * surprise, and this one forwards a credential that can spend every channel's
   * quota.
   *
   * The upstream target is fixed to loopback inside the proxy; nothing a caller
   * sends can change where the traffic goes.
   */
  const lan = { enabled: false, port: 18326, host: '0.0.0.0', running: null, error: '' }

  /** What the page prints: whether the front door is up, and where to reach it. */
  function lanStatus() {
    const addresses = rankAddresses(os.networkInterfaces())
    const port = lan.running?.port ?? lan.port
    return {
      enabled: lan.enabled,
      running: lan.running !== null,
      port,
      error: lan.error,
      // A URL per candidate address, best first; the page shows the first and
      // lists the rest under it, because which one works depends on the network
      // the caller is on and the host cannot know that.
      urls: lan.running === null ? [] : addresses.map(row => ({
        address: row.address,
        iface: row.iface,
        url: `http://${row.address}:${port}/v1`,
      })),
    }
  }

  /** Start or stop the front door to match `lan.enabled`. */
  async function syncLan() {
    if (!lan.enabled) {
      if (lan.running !== null) {
        const current = lan.running
        lan.running = null
        await current.close().catch(() => {})
        logger.info?.('agent-channels: LAN gateway stopped')
      }
      return
    }
    if (lan.running !== null) return
    try {
      lan.running = await startLanGateway({
        host: lan.host,
        port: lan.port,
        // The pack's own port, so a caller who moved it with
        // DSH_OPENAI_GATEWAY_PORT is still forwarded to the right place.
        upstreamPort: Number.parseInt(process.env.DSH_OPENAI_GATEWAY_PORT ?? '', 10) || 8326,
        warn: message => logger.warn?.(message),
      })
      lan.error = ''
      logger.info?.(`agent-channels: LAN gateway listening on ${lan.host}:${lan.running.port} → 127.0.0.1`)
    } catch (error) {
      lan.running = null
      lan.error = String(error?.message ?? error).slice(0, 300)
      logger.warn?.(`agent-channels: LAN gateway unavailable (${lan.error})`)
    }
  }

  /**
   * `POST /api/agent-channels/lan` — turn the front door on or off.
   *
   * Body: `{ enabled?: boolean, port?: number }`. Answers the new state, so the
   * page never has to guess whether a bind succeeded.
   */
  async function lanRoute(req, res) {
    const rejection = rejectionFor(req, fenceConnection, logAdmissionRejection)
    if (rejection !== undefined) {
      res.writeHead(rejection, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(rejection === 401 ? 'unauthorized' : rejection === 503 ? 'admission unavailable' : 'forbidden')
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'POST' })
      res.end('method not allowed')
      return
    }
    let status = 200
    try {
      const raw = await readBody(req)
      let parsed
      try { parsed = raw === '' ? {} : JSON.parse(raw) } catch { parsed = null }
      if (parsed === null || typeof parsed !== 'object') {
        status = 400
      } else {
        if (typeof parsed.enabled === 'boolean') lan.enabled = parsed.enabled
        if (parsed.port !== undefined) {
          const port = Number(parsed.port)
          if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('port must be an integer in 1024..65535')
          if (port !== lan.port) {
            // Moving the port means dropping the old listener first, or the new
            // one would fight it for the address.
            const previous = lan.running
            lan.running = null
            if (previous !== null) await previous.close().catch(() => {})
            lan.port = port
          }
        }
        await syncLan()
      }
    } catch (error) {
      status = 400
      lan.error = String(error?.message ?? error).slice(0, 300)
    }
    const body = JSON.stringify({ ...lanStatus(), ...(status === 400 ? { error: lan.error } : {}) })
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    })
    res.end(body)
  }

  // The listener belongs to this plugin's lifetime: a plugin teardown must not
  // leave a port open on the network.
  ctx.effect(() => () => {
    const current = lan.running
    lan.running = null
    if (current !== null) void current.close().catch(() => {})
  }, 'agent-channels: LAN gateway')

  // ── a daily tick for the pack's check-in ──────────────────────────────────
  /**
   * The pack's own scheduler fires **once**, `DSH_CHANNEL_PACK_AUTO_CHECKIN_DELAY_MS`
   * after startup (30 s by default), then never again: `runIfDue` is called from
   * `start`, from the enable switch, and from the RPC — nothing loops.
   *
   * So a machine left running across midnight checks in on day one and silently
   * misses every day after it. That is the whole failure mode this timer exists
   * for, and it is why the tick is hourly rather than at a fixed hour: waking
   * from sleep, crossing a timezone, or starting at 23:59 all resolve on the
   * next tick instead of waiting for a wall-clock moment that may have passed.
   *
   * `runIfDue` is idempotent — it returns immediately when `lastDate` is today —
   * so an hourly tick costs one comparison on the days it has nothing to do.
   */
  const CHECKIN_TICK_MS = 60 * 60 * 1000
  ctx.inject(['credentials', 'commands', 'llm'], scoped => {
    let timer
    /**
     * Ask the pack to run today's check-in if it has not run yet.
     *
     * Two calls on purpose. `usage.autoCheckin` with no `enabled` field is a
     * pure read; passing `enabled: true` goes through `setEnabled`, which
     * **saves the state file** and then runs the check-in. Firing that every
     * hour would rewrite `auto-checkin.json` 24 times a day for nothing, so the
     * read gates the write.
     */
    const call = async payload => {
      // Through the *scoped* context: `connection` is published by the browser
      // half, and a scoped fiber sees what its own inject declared. Reading the
      // root context here answered `undefined` and the tick did nothing.
      const rpc = optionalIn(scoped, 'connection')?.rpc
      if (rpc === undefined || typeof rpc.call !== 'function') return undefined
      const result = await rpc.call.call(
        rpc, '/api', 'channel-pack', { method: 'usage.autoCheckin', payload }, undefined,
      )
      return result?.ok === true ? result.value : undefined
    }
    const tick = async () => {
      try {
        const state = (await call({}))?.autoCheckin
        // Nothing to do: already ran today, switched off, or a run is in flight.
        if (state === undefined || state.ranToday === true || state.enabled === false || state.running === true) return
        logger.info?.('agent-channels: running the daily check-in')
        await call({ enabled: true })
      } catch {
        // A host without the connection service, or a pack that has not
        // finished mounting, simply tries again on the next tick.
      }
    }
    scoped.effect(() => {
      timer = setInterval(() => void tick(), CHECKIN_TICK_MS)
      timer.unref?.()
      return () => { if (timer !== undefined) clearInterval(timer) }
    }, 'agent-channels: daily check-in tick')
    logger.info?.('agent-channels: daily check-in tick armed (hourly)')
  })

  /**
   * One prefix handler for the whole surface, dispatching on the last segment.
   *
   * `webServer` gets its own fiber: the callback pends while the service is
   * absent *or merely not provided yet*, and is re-run if it is replaced. That
   * pending is the point — reading `ctx.get('webServer')` once at apply time
   * answers `undefined` in the real web composition, because plugins load
   * before the browser half publishes the server.
   */
  ctx.inject(['webServer'], scoped => {
    const server = scoped.webServer
    const handler = (req, res) => {
      const pathname = String(req.url ?? '').split('?')[0]
      if (pathname === '/api/agent-channels/open-external') return openExternalRoute(req, res)
      if (pathname === '/api/agent-channels/status') return statusRoute(req, res)
      if (pathname === '/api/agent-channels/lan') return void lanRoute(req, res)
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
    }
    scoped.effect(() => server.register({ kind: 'prefix', path: '/api/agent-channels', handler }), 'agent-channels: api routes')
    logger.info?.('agent-channels: settings API mounted at /api/agent-channels')
  })
}
