/**
 * Smoke-test the generated `client.js` without a browser.
 *
 * The bundle is a ModuleLoader factory that expects a React implementation and
 * a `window` carrying `__ModuleLoader__`. This harness supplies both — a tiny
 * React stub with just enough surface to let the module body evaluate, and a
 * fake loader that captures what the factory exports — then asserts the module
 * registers a single settings section and that its locale dictionary covers
 * every key its components read.
 *
 * It catches the failure mode that matters here: a component reading a
 * translation key that was never added, or a channel table that lost a row.
 * Both show up only at render time in the real shell, long after the plugin has
 * reported itself as loaded.
 *
 * Usage: node scripts/smoke-client.mjs [path-to-client.js]
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const file = process.argv[2] ?? path.join(root, 'client.js')
const source = fs.readFileSync(file, 'utf8')

const failures = []
function check(condition, message) {
  if (!condition) failures.push(message)
}

/** A React stub: hooks return plausible values, `createElement` records. */
function makeReact() {
  const created = []
  const createElement = (type, props, ...children) => {
    created.push({ type, props, children })
    return { type, props, children }
  }
  return {
    created,
    createElement,
    Fragment: Symbol('Fragment'),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useMemo: fn => fn(),
    useRef: value => ({ current: value }),
    useCallback: fn => fn,
  }
}

const react = makeReact()
const loaded = []
const windowStub = {
  __ModuleLoader__: { load: entry => loaded.push(entry) },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  open: () => null,
  dispatchEvent: () => {},
  location: { reload: () => {} },
  confirm: () => true,
}
const documentStub = {
  baseURI: 'http://127.0.0.1:8521/',
  documentElement: { lang: 'zh' },
  head: { appendChild: () => {}, removeChild: () => {} },
  body: { appendChild: () => {}, removeChild: () => {} },
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {}, remove: () => {}, addEventListener: () => {} }),
  createTextNode: () => ({}),
  querySelector: () => null,
}
const sandbox = {
  window: windowStub,
  document: documentStub,
  navigator: { clipboard: undefined },
  Notification: undefined,
  EventSource: undefined,
  CustomEvent: class {},
  AbortController,
  URL,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  console,
  fetch: () => Promise.reject(new Error('no network in smoke test')),
  require: specifier => {
    if (specifier === 'react') return react
    throw new Error(`unexpected require(${JSON.stringify(specifier)})`)
  },
}
sandbox.globalThis = sandbox
sandbox.window.document = documentStub

const context = vm.createContext(sandbox)

try {
  vm.runInContext(source, context, { filename: file })
} catch (error) {
  console.error(`FAIL: the bundle did not evaluate\n  ${error.message}`)
  process.exit(1)
}

check(loaded.length === 1, `expected exactly one __ModuleLoader__.load call, got ${loaded.length}`)
if (loaded.length === 0) { console.error('FAIL: nothing registered'); process.exit(1) }

const entry = loaded[0]
check(entry.id === 'dsh-agent-connect', `entry id is ${JSON.stringify(entry.id)}`)
check(typeof entry.factory === 'function', 'the loader entry has no factory')

let exported
try {
  exported = entry.factory(sandbox.require)
} catch (error) {
  console.error(`FAIL: the factory threw\n  ${error.stack ?? error.message}`)
  process.exit(1)
}

check(exported?.name === 'agent-channels', `exports.name is ${JSON.stringify(exported?.name)}`)
check(typeof exported?.apply === 'function', 'exports.apply is missing')
check(Array.isArray(exported?.inject), 'exports.inject is missing')
check(exported?.inject?.includes('slots') && exported?.inject?.includes('locale'),
  `exports.inject is ${JSON.stringify(exported?.inject)}`)

// ── locale coverage ─────────────────────────────────────────────────────────
/** Every `t('...')` literal the bundle contains. A key read but not defined
 *  renders as the raw key in the shell — silent in code, visible to the user. */
const usedKeys = new Set()
for (const match of source.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) usedKeys.add(match[1])
for (const match of source.matchAll(/\bt\(\s*`((?:[^`\\$]|\\.)*)`\s*\)/g)) {
  if (!match[1].includes('${')) usedKeys.add(match[1])
}

const dict = exported?.__test?.DICT
check(dict !== undefined, 'exports.__test.DICT is missing')
if (dict !== undefined) {
  const zh = new Set(Object.keys(dict.zh ?? {}))
  const en = new Set(Object.keys(dict.en ?? {}))
  const missingZh = [...usedKeys].filter(key => !zh.has(key))
  const missingEn = [...usedKeys].filter(key => !en.has(key))
  check(missingZh.length === 0, `keys read but absent from zh: ${missingZh.join(', ')}`)
  check(missingEn.length === 0, `keys read but absent from en: ${missingEn.join(', ')}`)
  const zhOnly = [...zh].filter(key => !en.has(key))
  const enOnly = [...en].filter(key => !zh.has(key))
  check(zhOnly.length === 0, `zh-only keys: ${zhOnly.join(', ')}`)
  check(enOnly.length === 0, `en-only keys: ${enOnly.join(', ')}`)
  check(zh.size > 0, 'the zh dictionary is empty')
}

// ── the channel table the page renders ──────────────────────────────────────
const EXPECTED = ['codearts', 'buddy', 'workbuddy', 'lobsterai', 'qoder', 'qodercn',
  'trae', 'cline', 'loomy', 'raccoon', 'minimax', 'zcode', 'gemini']

const providers = exported?.__test?.CHANNEL_PROVIDERS
check(Array.isArray(providers), 'exports.__test.CHANNEL_PROVIDERS is missing')
if (Array.isArray(providers)) {
  check(providers.length === 13, `expected 13 channels, got ${providers.length}`)
  const ids = providers.map(row => row?.id)
  for (const id of EXPECTED) check(ids.includes(id), `channel "${id}" is missing`)
  for (const row of providers) {
    check(typeof row?.name === 'string' && row.name !== '', `channel ${row?.id} has no name`)
    check(typeof row?.accent === 'string', `channel ${row?.id} has no accent`)
  }
}

const credits = exported?.__test?.CHANNEL_CREDITS
check(credits !== undefined, 'exports.__test.CHANNEL_CREDITS is missing')
if (credits !== undefined) {
  for (const id of EXPECTED) check(credits[id] !== undefined, `credit table is missing "${id}"`)
}

// ── the credit formatter ────────────────────────────────────────────────────
// Three incomparable units come back from the pack; the formatter is what keeps
// a percentage from being printed as a token count.
const formatCredits = exported?.__test?.formatCredits
check(typeof formatCredits === 'function', 'exports.__test.formatCredits is missing')
if (typeof formatCredits === 'function') {
  check(formatCredits(1234, {}).value === '1.2K', `token formatting: ${formatCredits(1234, {}).value}`)
  check(formatCredits(1200, { unit: 'tokens' }).value === '1.2K', 'token unit formatting')
  check(formatCredits(3.5, { unit: 'dollars' }).value === '$3.50', `dollar formatting: ${formatCredits(3.5, { unit: 'dollars' }).value}`)
  check(formatCredits(87, { quota: true }).unit === '%', 'quota formatting should carry a % unit')
  check(formatCredits(Number.NaN, {}).empty === true, 'NaN should read as empty')
}

// ── CSS the page depends on ─────────────────────────────────────────────────
const css = exported?.__test?.CSS
check(typeof css === 'string' && css.length > 2000, 'exports.__test.CSS is missing or too small')
if (typeof css === 'string') {
  for (const selector of ['.acx', '.acx-figures', '.acx-table', '.acx-row-main', '.acx-fold',
    '.acx-acct', '.acx-model', '.acx-btn', '.acx-switch', '.acx-scrim']) {
    check(css.includes(selector), `CSS is missing ${selector}`)
  }
  // The house style: no gradients, no shadows at rest, no glass.
  check(!/linear-gradient|radial-gradient/.test(css), 'CSS uses a gradient')
  check(!/box-shadow/.test(css), 'CSS uses a box-shadow')
  check(!/backdrop-filter/.test(css), 'CSS uses backdrop-filter (glass)')
}

// ── apply() must register exactly one settings section ──────────────────────
const registered = []
const effects = []
const ctx = {
  locale: { bind: () => Object.assign(key => key, { locale: 'zh' }), register: () => {} },
  effect: (fn, label) => { effects.push({ fn, label }); return () => {} },
  slots: {
    inject: (name, fn) => { fn() },
    register: (meta, component) => { registered.push({ meta, component }); return () => {} },
  },
}
try {
  exported.apply(ctx)
} catch (error) {
  console.error(`FAIL: apply() threw\n  ${error.stack ?? error.message}`)
  process.exit(1)
}

check(registered.length === 1, `apply() registered ${registered.length} sections, expected 1`)
check(registered[0]?.meta?.name === 'settings.section', `registered slot is ${JSON.stringify(registered[0]?.meta?.name)}`)
check(registered[0]?.meta?.id === 'agent-channels', `section id is ${JSON.stringify(registered[0]?.meta?.id)}`)
check(typeof registered[0]?.component === 'function', 'the section registered no component')
check(effects.length >= 2, `expected dictionary + style effects, got ${effects.length}`)

// ── render the page once ────────────────────────────────────────────────────
// A missing helper in a component only surfaces at render time, which in the
// real shell is after the plugin already reported itself loaded.
if (typeof registered[0]?.component === 'function') {
  try {
    registered[0].component({ t: Object.assign(key => key, { locale: 'zh' }), locale: 'zh' })
  } catch (error) {
    failures.push(`the section component threw on its first render: ${error.message}`)
  }
}

// ── HTTP routes must match what index.js serves ─────────────────────────────
const ROUTES = new Set(['/open-external', '/status', '/lan'])
const calledPaths = new Set()
for (const match of source.matchAll(/\b(?:api|post)\(\s*'([^']+)'/g)) calledPaths.add(match[1])
for (const match of source.matchAll(/\b(?:api|post)\(\s*`([^`$]*)`/g)) calledPaths.add(match[1])
for (const called of calledPaths) {
  check(ROUTES.has(called), `the client calls ${JSON.stringify(called)}, which index.js does not serve`)
}
check(calledPaths.size > 0, 'the client calls no HTTP route at all')

const hostSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8')
check(hostSource.includes("'/api/agent-channels'"), 'index.js does not mount the /api/agent-channels prefix')
for (const route of ROUTES) {
  check(hostSource.includes(`/api/agent-channels${route}`), `index.js does not dispatch ${route}`)
}
check(source.includes("'api/agent-channels'"), 'client.js does not target the api/agent-channels prefix')
check(!source.includes('api/our-free-model'), 'client.js still targets the upstream api/our-free-model prefix')

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} problem(s)`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('smoke: OK')
console.log(`  entry:    ${entry.id}`)
console.log(`  exports:  name=${exported.name} inject=[${exported.inject.join(', ')}]`)
console.log(`  sections: ${registered.length} (${registered[0].meta.id})`)
console.log(`  locale:   ${Object.keys(dict.zh).length} keys, ${usedKeys.size} read`)
console.log(`  channels: ${providers.length}`)
console.log(`  css:      ${css.length} bytes`)
