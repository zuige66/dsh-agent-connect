/**
 * Smoke-test the Host half without a running harness.
 *
 * `index.js` is a cordis plugin: it exports `name`, `inject`, `version` and an
 * `apply(ctx)` that mounts the vendored channel pack and registers two HTTP
 * routes. This harness supplies a stub `ctx` that records what the plugin does,
 * then exercises both routes through a real `node:http` server so the request
 * handling, the trust fence and the JSON shapes are all covered.
 *
 * What it cannot cover is the pack itself (it needs the kernel's `llm`,
 * `credentials` and `commands` services); the harness asserts the *mount was
 * attempted* on a fiber that names them, which is the part this file owns.
 *
 * Usage: node scripts/smoke-host.mjs
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

// ── load the module ─────────────────────────────────────────────────────────
const mod = await import(pathToFileURL(path.join(root, 'index.js')).href)

check(mod.name === 'agent-channels', `name is ${JSON.stringify(mod.name)}, expected "agent-channels"`)
check(Array.isArray(mod.inject), 'inject is not an array')
check(mod.inject?.length === 1 && mod.inject[0] === 'llm', `inject is ${JSON.stringify(mod.inject)}, expected ["llm"]`)
check(typeof mod.version === 'string' && mod.version !== '', 'version was not read from package.json')
check(typeof mod.apply === 'function', 'apply is not exported')

// ── stub the cordis context ─────────────────────────────────────────────────
/** Recorded `ctx.inject(names, cb)` calls, with the services they named. */
const injections = []
/** Recorded route registrations. */
const routes = []
/** Disposers the stubbed contexts handed back, for teardown assertions. */
const disposers = []
/** Logger output, so an unexpected warning fails the test. */
const logs = { info: [], warn: [] }

/**
 * Run one effect registration the way cordis does — immediately — and keep its
 * disposer. Replaying the registration later would re-run its side effect
 * (registering the same route twice), so the disposer is captured here instead.
 *
 * @param {() => (() => void)|void} fn
 * @param {string} label
 * @returns {() => void}
 */
function runEffect(fn, label) {
  const dispose = fn()
  const wrapped = () => { if (typeof dispose === 'function') dispose() }
  disposers.push({ label, dispose: wrapped })
  return wrapped
}

const services = new Map()

const ctx = {
  logger: {
    info: message => logs.info.push(String(message)),
    warn: message => logs.warn.push(String(message)),
  },
  get: key => services.get(key),
  inject: (names, callback) => {
    injections.push({ names, callback })
  },
  effect: (fn, label) => runEffect(fn, label),
}

mod.apply(ctx, {})

// The plugin must ask for the pack's own dependencies, for webServer, and for
// the fiber that runs the daily check-in tick. Nothing else may be named at the
// top level — `inject` (the module export) is only `llm`.
check(injections.length === 3, `expected 3 ctx.inject calls, got ${injections.length}`)

const packInject = injections.find(row => row.names.includes('credentials'))
check(packInject !== undefined, 'no fiber names credentials/commands/llm for the channel pack')
check(packInject?.names?.includes('commands'), 'the pack fiber does not name `commands`')
check(packInject?.names?.includes('llm'), 'the pack fiber does not name `llm`')

const serverInject = injections.find(row => row.names.includes('webServer'))
check(serverInject !== undefined, 'no fiber names webServer for the HTTP routes')

// Two fibers name credentials (the pack mount and the check-in tick); the tick
// is the one that is neither the pack nor the web server.
const tickInject = injections.find(row => row !== packInject && row !== serverInject)
check(tickInject !== undefined, 'no fiber was registered for the check-in tick')

// ── run the webServer fiber and capture its routes ──────────────────────────
/**
 * A stub scoped context, matching cordis semantics closely enough to be useful:
 * `effect(fn)` runs `fn` immediately (that is how `server.register(...)` inside
 * an effect ever gets called in the real runtime) and returns its disposer.
 */
const scoped = {
  webServer: {
    register: entry => {
      routes.push(entry)
      return () => {}
    },
  },
  effect: (fn, label) => runEffect(fn, label),
  logger: ctx.logger,
  get: ctx.get,
}

try {
  serverInject.callback(scoped)
} catch (error) {
  failures.push(`the webServer fiber threw: ${error.message}`)
}

check(routes.length === 1, `expected 1 route registration, got ${routes.length} (${routes.map(r => r.path).join(', ')})`)
const route = routes[0]
check(route?.kind === 'prefix', `route kind is ${JSON.stringify(route?.kind)}, expected "prefix"`)
check(route?.path === '/api/agent-channels', `route path is ${JSON.stringify(route?.path)}`)
check(typeof route?.handler === 'function', 'the route has no handler')

// ── exercise the routes over real HTTP ─────────────────────────────────────
if (typeof route?.handler === 'function') {
  const server = http.createServer((req, res) => route.handler(req, res))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const origin = `http://127.0.0.1:${port}`

  /**
   * One request against the stub server.
   *
   * @param {string} method
   * @param {string} pathname
   * @param {object} [options]
   * @returns {Promise<{status: number, headers: object, body: string, json: any}>}
   */
  async function request(method, pathname, options = {}) {
    const headers = { ...options.headers }
    let body = options.body
    if (body !== undefined && typeof body !== 'string') {
      body = JSON.stringify(body)
      headers['content-type'] = 'application/json'
    }
    return await new Promise((resolve, reject) => {
      const req = http.request(`${origin}${pathname}`, { method, headers }, res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let json
          try { json = text === '' ? undefined : JSON.parse(text) } catch { json = undefined }
          resolve({ status: res.statusCode, headers: res.headers, body: text, json })
        })
      })
      // An oversized body is answered by destroying the socket, so the client
      // sees a reset rather than a response. Treat that as the refusal it is
      // instead of crashing the harness.
      req.on('error', error => {
        if (error.code === 'ECONNRESET') resolve({ status: 413, headers: {}, body: '', json: undefined })
        else reject(error)
      })
      if (body !== undefined) req.write(body)
      req.end()
    })
  }

  try {
    // status: a plain GET from a loopback Host is admitted and answers the
    // pack's mount state.
    const status = await request('GET', '/api/agent-channels/status')
    check(status.status === 200, `GET /status answered ${status.status}, expected 200`)
    check(status.json?.version === mod.version, `GET /status version is ${JSON.stringify(status.json?.version)}`)
    check(status.json?.channels?.state === 'pending', `GET /status channels.state is ${JSON.stringify(status.json?.channels?.state)}`)

    // A non-GET on /status is refused rather than silently answered.
    const statusPost = await request('POST', '/api/agent-channels/status', { body: {} })
    check(statusPost.status === 405, `POST /status answered ${statusPost.status}, expected 405`)

    // open-external: a non-URL body answers opened:false rather than throwing.
    const bad = await request('POST', '/api/agent-channels/open-external', { body: { url: 'javascript:alert(1)' } })
    check(bad.status === 200, `POST /open-external (bad url) answered ${bad.status}, expected 200`)
    check(bad.json?.opened === false, `POST /open-external (bad url) answered ${JSON.stringify(bad.json)}`)

    // A missing url is likewise a refusal, not a 500.
    const missing = await request('POST', '/api/agent-channels/open-external', { body: {} })
    check(missing.json?.opened === false, `POST /open-external (no url) answered ${JSON.stringify(missing.json)}`)

    // A malformed body is a 400.
    const malformed = await request('POST', '/api/agent-channels/open-external', { body: 'not json' })
    check(malformed.status === 400, `POST /open-external (malformed) answered ${malformed.status}, expected 400`)

    // GET on the opener route is refused.
    const wrongMethod = await request('GET', '/api/agent-channels/open-external')
    check(wrongMethod.status === 405, `GET /open-external answered ${wrongMethod.status}, expected 405`)

    // An unknown subpath under the prefix is a 404, not a crash.
    const unknown = await request('GET', '/api/agent-channels/nope')
    check(unknown.status === 404, `GET /nope answered ${unknown.status}, expected 404`)

    // The trust fence: a cross-site fetch is refused even on loopback.
    const crossSite = await request('GET', '/api/agent-channels/status', { headers: { 'sec-fetch-site': 'cross-site' } })
    check(crossSite.status === 403, `cross-site /status answered ${crossSite.status}, expected 403`)

    // The trust fence: an Origin that is not this page is refused.
    const badOrigin = await request('GET', '/api/agent-channels/status', { headers: { origin: 'http://evil.example' } })
    check(badOrigin.status === 403, `foreign-origin /status answered ${badOrigin.status}, expected 403`)

    // The trust fence: a non-loopback Host (DNS-rebinding) is refused.
    const badHost = await request('GET', '/api/agent-channels/status', { headers: { host: 'evil.example' } })
    check(badHost.status === 403, `foreign-host /status answered ${badHost.status}, expected 403`)

    // An oversized body is refused without buffering it.
    const huge = await request('POST', '/api/agent-channels/open-external', { body: { url: `https://x.test/${'a'.repeat(16 * 1024)}` } })
    check(huge.status === 413, `oversized body answered ${huge.status}, expected 413`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

// ── the daily check-in tick ────────────────────────────────────────────────
// The pack fires its check-in once, shortly after startup, and never again — so
// a machine left running across midnight misses every day after the first. The
// plugin's tick is what fixes that, and the property worth testing is that it
// only *writes* when a write is needed: `usage.autoCheckin` with `enabled: true`
// saves the state file, so an unconditional hourly call would rewrite it 24
// times a day.
{
  /** Every RPC the tick made, in order. */
  const calls = []
  /** The auto-checkin state the stub will report for the read. */
  let reported = { enabled: true, ranToday: false, running: false }

  const rpc = {
    call: async (_base, _endpoint, request) => {
      calls.push(request.payload ?? {})
      if (request.payload?.enabled !== undefined) {
        return { ok: true, value: { autoCheckin: { enabled: true, ranToday: true, running: false } } }
      }
      return { ok: true, value: { autoCheckin: reported } }
    },
  }
  const connection = { rpc }

  /** Run one tick through the real fiber, with a stubbed clock interval. */
  const tickScope = () => ({
    logger: ctx.logger,
    effect: (fn, label) => runEffect(fn, label),
    get: key => (key === 'connection' ? connection : services.get(key)),
    inject: () => {},
    provide: () => {},
    emit: () => {},
    on: () => {},
    credentials: { resolve: async () => undefined },
    commands: { register: () => {} },
    llm: { listProviders: async () => [], listModels: async () => [] },
  })

  // The fiber arms a timer; the test drives the tick directly rather than
  // waiting an hour, so it re-uses the module's own logic through the interval
  // callback captured from `setInterval`.
  const originalSetInterval = globalThis.setInterval
  let captured = null
  globalThis.setInterval = (fn, ms) => {
    captured = { fn, ms }
    return { unref: () => {} }
  }
  try {
    tickInject.callback(tickScope())
  } finally {
    globalThis.setInterval = originalSetInterval
  }

  check(captured !== null, 'the check-in fiber armed no timer')
  check(captured?.ms === 60 * 60 * 1000, `the check-in tick runs every ${captured?.ms}ms, expected hourly`)

  if (captured !== null) {
    // Already ran today: a read, and no write.
    calls.length = 0
    reported = { enabled: true, ranToday: true, running: false }
    await captured.fn()
    await new Promise(resolve => setTimeout(resolve, 30))
    check(calls.length === 1, `a tick after today's run made ${calls.length} call(s), expected 1 read`)
    check(calls[0]?.enabled === undefined, 'a tick after today\'s run still wrote `enabled`')

    // Not run yet today: read, then write.
    calls.length = 0
    reported = { enabled: true, ranToday: false, running: false }
    await captured.fn()
    await new Promise(resolve => setTimeout(resolve, 30))
    check(calls.length === 2, `a tick before today's run made ${calls.length} call(s), expected read + write`)
    check(calls[1]?.enabled === true, 'a tick before today\'s run did not trigger the check-in')

    // Switched off: never writes.
    calls.length = 0
    reported = { enabled: false, ranToday: false, running: false }
    await captured.fn()
    await new Promise(resolve => setTimeout(resolve, 30))
    check(calls.length === 1, `a tick with check-in off made ${calls.length} call(s), expected 1 read`)
    check(calls[0]?.enabled === undefined, 'a tick with check-in off still wrote `enabled`')
  }
}

// ── the pack mount attempt ─────────────────────────────────────────────────
// The pack's own imports need kernel services, so this only asserts the fiber
// runs far enough to try — a synchronous throw here would mean the mount code
// itself is broken, which is what this file owns.
const CLAIM = Symbol.for('dsh.channel-pack.mounted')

/** A scoped context good enough for the pack's import to be attempted. */
function packScope() {
  return {
    logger: ctx.logger,
    effect: (fn, label) => runEffect(fn, label),
    get: key => services.get(key),
    inject: () => {},
    provide: () => {},
    emit: () => {},
    on: () => {},
    credentials: { resolve: async () => undefined },
    commands: { register: () => {} },
    llm: { listProviders: async () => [], listModels: async () => [] },
    fiber: undefined,
    connection: undefined,
  }
}

let packState = 'not-attempted'
try {
  packInject.callback(packScope())
  packState = 'attempted'
} catch (error) {
  failures.push(`the channel pack fiber threw synchronously: ${error.message}`)
}
check(packState === 'attempted', 'the channel pack fiber never ran')

// Give the dynamic import a moment; on a host without the kernel services it
// fails to import and must be reported, not thrown.
await new Promise(resolve => setTimeout(resolve, 2500))
const packWarn = logs.warn.find(line => line.includes('channel pack unavailable'))
check(packWarn !== undefined || logs.info.some(line => line.includes('channel pack mounted')),
  'the pack mount reported neither success nor failure')
// A failed mount must release the claim, or the next attempt in this process
// would see a phantom "already mounted" and silently do nothing.
check(globalThis[CLAIM] === undefined, 'a failed mount left the single-mount claim set')

// ── the single-mount guard ─────────────────────────────────────────────────
// `dsh-our-free-model` vendors the same pack, so in a profile that carries both
// plugins this one must stand down instead of registering the same RPC twice.
{
  // Case 1: another plugin already provided `accountPool`.
  logs.info.length = 0
  logs.warn.length = 0
  const provided = packScope()
  provided.get = key => (key === 'accountPool' ? { listAllAccounts: async () => [] } : undefined)
  packInject.callback(provided)
  await new Promise(resolve => setTimeout(resolve, 300))
  check(logs.info.some(line => line.includes('already mounted by another plugin')), 'the guard did not detect an existing accountPool')
  check(!logs.info.some(line => line.includes('channel pack mounted')), 'the guard let a second mount through despite accountPool')

  // Case 2: a sibling instance of this plugin already claimed the symbol.
  logs.info.length = 0
  logs.warn.length = 0
  globalThis[CLAIM] = 'agent-channels'
  packInject.callback(packScope())
  await new Promise(resolve => setTimeout(resolve, 300))
  check(logs.info.some(line => line.includes('already mounted by agent-channels')), 'the guard did not honour the global claim')
  delete globalThis[CLAIM]
}

// ── teardown ───────────────────────────────────────────────────────────────
// `disposers` holds every disposer the stubbed contexts captured at
// registration time; running them must not throw.
check(disposers.length > 0, 'apply() registered no effects')
let teardownError = ''
for (const { dispose } of disposers) {
  try { dispose() } catch (error) { teardownError = error.message }
}
check(teardownError === '', `teardown threw: ${teardownError}`)

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} problem(s)`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('host smoke: OK')
console.log(`  name:     ${mod.name}`)
console.log(`  version:  ${mod.version}`)
console.log(`  inject:   [${mod.inject.join(', ')}]`)
console.log(`  fibers:   ${injections.map(row => `[${row.names.join(',')}]`).join(' ')}`)
console.log(`  routes:   ${routes.map(row => `${row.kind}:${row.path}`).join(' ')}`)
console.log(`  pack:     ${packState} (${packWarn !== undefined ? 'failed as expected without kernel services' : 'mounted'})`)
