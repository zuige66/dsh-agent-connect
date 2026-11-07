/**
 * Smoke-test the channel pack's DAILY auto check-in scheduler.
 *
 * The bug this guards: `createAutoCheckin.start()` used to schedule a single
 * one-shot `setTimeout` and never re-arm it, so a process left running across
 * UTC+8 midnight claimed credits on day 1 and then silently missed every day
 * after. The fix added an hourly `repeatSchedule` around `runIfDue`, which is
 * idempotent (inflight / enabled / lastDate gates).
 *
 * We extract the real `createAutoCheckin` (and its helpers) straight out of the
 * vendored pack.js and run it in a VM with stubbed dependencies and a fake
 * clock — no DSH host, no network, no real home directory. That way the test
 * fails the moment someone removes the repeat loop again.
 *
 * Usage: node scripts/smoke-checkin.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const packPath = path.join(root, 'vendor', 'channel-pack', 'pack.js')

const failures = []
function check(condition, message) {
  if (!condition) failures.push(message)
}

// ── lift the real scheduler out of pack.js ─────────────────────────────────
const src = fs.readFileSync(packPath, 'utf-8')
const start = src.indexOf('function utc8DateString(')
const marker = '// vendor/channel-pack/src/channel-pack-rpc.ts'
// The marker appears more than once (an earlier bundle section); we want the
// boundary AFTER the auto-checkin block.
const end = src.indexOf(marker, start)
check(start > 0, 'could not find utc8DateString() in pack.js')
check(end > start, 'could not find the rpc-section boundary after the auto-checkin block in pack.js')
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

// Everything from utc8DateString() up to (but excluding) the RPC section:
// constants, both stores, describe helpers, createAutoCheckin, defaultSchedule
// and defaultRepeatSchedule. Pure declarations — safe to evaluate in a sandbox.
const block = src.slice(start, end)

// The lifted block references a handful of module-level symbols. Only the ones
// actually touched by createAutoCheckin's runtime path need real values; the
// rest are stubs so class/function bodies that we never call still parse.
const sandbox = {
  QODER_BILLING_UTC_OFFSET_MS: 8 * 60 * 60 * 1000,
  ZCODE: { id: 'zcode' },
  formatClaimGains: () => '+100积分',
  DEFAULT_AUTO_CHECKIN: {
    enabled: true, lastDate: '', lastResult: '', lastAt: 0,
    channels: [], dismissedRunAt: 0,
  },
  process: { env: {} },
  setTimeout, clearTimeout, setInterval, clearInterval, console,
  // Referenced only inside store/helper bodies we do not call here.
  existsSync8: () => false,
  readFileSync8: () => '{}',
  writeFileSync7: () => {},
  mkdirSync6: () => {},
  renameSync6: () => {},
  join7: (...parts) => parts.join('/'),
  resolveChannelPackHome: () => undefined,
  SCHEMA4: 'test',
  AUTO_CHECKIN_FILE: 'auto-checkin.json',
  sanitizeAutoCheckin: value => value,
  DATE_RE: /^\d{4}-\d{2}-\d{2}$/,
  ms: value => Number(value) || 0,
  sanitizeChannels: value => (Array.isArray(value) ? value : []),
}

const lifted = vm.runInNewContext(
  `${block}\n;({ createAutoCheckin, AUTO_CHECKIN_REPEAT_MS })`,
  sandbox,
  { filename: 'pack.js#auto-checkin' },
)
const { createAutoCheckin, AUTO_CHECKIN_REPEAT_MS } = lifted

check(typeof createAutoCheckin === 'function', 'createAutoCheckin was not lifted from pack.js')
check(AUTO_CHECKIN_REPEAT_MS === 60 * 60 * 1000, `AUTO_CHECKIN_REPEAT_MS is ${AUTO_CHECKIN_REPEAT_MS}, expected hourly`)
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

// ── drive it with a fake UTC+8 clock ───────────────────────────────────────
// 2026-11-07 10:00 in Asia/Shanghai == 2026-11-07T02:00:00Z.
let nowMs = Date.parse('2026-11-07T02:00:00Z')
const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise(resolve => setImmediate(resolve))
}

let saved = null
const store = {
  load: () => ({
    enabled: true, lastDate: '', lastResult: '', lastAt: 0,
    channels: [], dismissedRunAt: 0,
  }),
  save: async doc => { saved = { ...doc } },
}
let claims = 0
const claim = async () => {
  claims += 1
  return {
    ok: true,
    value: {
      summary: {
        claimed: 1, totalCredit: 100, alreadyClaimed: 0, inactive: 0,
        failed: 0, coversToday: 1,
      },
    },
  }
}

let fire = null
let repeatFn = null
let repeatMsSeen = 0
let repeatArmed = 0
let fireCancelled = false
let repeatCancelled = false

const api = createAutoCheckin({
  now: () => nowMs,
  store,
  listProviderIds: async () => ['buddy'],
  claim,
  warn: () => {},
  delayMs: 50,
  schedule: (fn) => {
    fire = fn
    return { cancel: () => { fireCancelled = true } }
  },
  // repeatMs deliberately omitted: prove the default hourly constant is used.
  repeatSchedule: (fn, ms) => {
    repeatFn = fn
    repeatMsSeen = ms
    repeatArmed += 1
    return { cancel: () => { repeatCancelled = true } }
  },
})

// start() arms both timers.
api.start()
check(repeatMsSeen === 60 * 60 * 1000, `repeat interval is ${repeatMsSeen}ms, expected hourly`)
check(typeof fire === 'function', 'start() did not schedule the one-shot fire')
check(typeof repeatFn === 'function', 'start() did not schedule the hourly repeat')

// Calling start() twice must not stack a second interval.
api.start()
check(repeatArmed === 1, `start() armed ${repeatArmed} repeat intervals, expected 1`)

// Day 1: the one-shot fire claims once and records the UTC+8 date.
fire()
await flush()
check(claims === 1, `the one-shot fire made ${claims} claim(s), expected 1`)
check(saved?.lastDate === '2026-11-07', `lastDate is ${saved?.lastDate}, expected 2026-11-07`)

// Same day: the hourly repeat must be a no-op (runIfDue idempotence).
repeatFn()
await flush()
check(claims === 1, `a same-day repeat made ${claims} claim(s), expected still 1`)

// Next UTC+8 day: the hourly repeat claims again — this is the actual fix.
nowMs = Date.parse('2026-11-08T02:00:00Z')
repeatFn()
await flush()
check(claims === 2, `a next-day repeat made ${claims} claim(s), expected 2`)
check(saved?.lastDate === '2026-11-08', `lastDate is ${saved?.lastDate}, expected 2026-11-08`)

// A disabled check-in stays disabled on a later day.
await api.setEnabled(false)
nowMs = Date.parse('2026-11-09T02:00:00Z')
repeatFn()
await flush()
check(claims === 2, `a disabled check-in still claimed on a new day (${claims} claims)`)

// stop() clears the still-armed hourly repeat. (The one-shot timer was already
// consumed by fire() above, so there is nothing left of it to cancel here.)
api.stop()
check(repeatCancelled, 'stop() did not cancel the hourly repeat timer')

// A separate instance that is stopped BEFORE its one-shot fire must have both
// timers cancelled — proves stop() is symmetric with start().
let earlyFireCancelled = false
let earlyRepeatCancelled = false
const early = createAutoCheckin({
  now: () => nowMs,
  store,
  listProviderIds: async () => ['buddy'],
  claim,
  warn: () => {},
  delayMs: 50,
  schedule: () => ({ cancel: () => { earlyFireCancelled = true } }),
  repeatSchedule: () => ({ cancel: () => { earlyRepeatCancelled = true } }),
})
early.start()
early.stop()
check(earlyFireCancelled, 'stop() before fire did not cancel the one-shot timer')
check(earlyRepeatCancelled, 'stop() before fire did not cancel the hourly repeat timer')

if (failures.length > 0) {
  console.error(`smoke-checkin: ${failures.length} failure(s):\n - ${failures.join('\n - ')}`)
  process.exit(1)
}
console.log('smoke-checkin: OK (one-shot fire + hourly repeat + UTC+8 midnight + idempotence + stop)')
