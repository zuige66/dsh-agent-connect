/**
 * Extract the channel tables from an upstream `dsh-our-free-model` client bundle
 * into `src/channels.data.js`.
 *
 * These three declarations are the part of the upstream bundle worth keeping
 * byte for byte: thirteen product definitions (names, orgs, accent colours,
 * notes, login flow), the per-channel logo artwork, and which channels support
 * a credit claim and in what unit. They are product facts, not presentation —
 * re-typing them is how a plugin ends up with the wrong accent on Qoder.
 *
 * Run once against a known-good upstream build; the result is committed and
 * `scripts/build-client.mjs` inlines it. Re-run it only when upstream adds or
 * changes a channel.
 *
 * Usage:
 *   node scripts/extract-data.mjs <path-to-upstream-client.js>
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const upstream = process.argv[2]
if (upstream === undefined) {
  console.error('usage: node scripts/extract-data.mjs <upstream client.js>')
  process.exit(2)
}

const lines = fs.readFileSync(upstream, 'utf8').split('\n')

/**
 * Find the single line matching `re` between two bounds.
 *
 * @param {RegExp} re
 * @param {string} label
 * @param {number} from - 1-based inclusive
 * @param {number} to - 1-based inclusive
 * @returns {number}
 */
function find(re, label, from = 1, to = lines.length) {
  const hits = []
  for (let i = from - 1; i < Math.min(to, lines.length); i++) if (re.test(lines[i])) hits.push(i + 1)
  if (hits.length === 0) throw new Error(`${label}: no line matches ${re}`)
  if (hits.length > 1) throw new Error(`${label}: ${hits.length} lines match (${hits.join(', ')})`)
  return hits[0]
}

/** 1-based line of the first exact `terminator` line at or after `from`. */
function closeAt(from, terminator, label, to = lines.length) {
  for (let i = from - 1; i < Math.min(to, lines.length); i++) {
    if (lines[i] === terminator) return i + 1
  }
  throw new Error(`${label}: no ${JSON.stringify(terminator)} line after ${from}`)
}

/** Take a 1-based inclusive range, asserting both endpoints. */
function slice(from, to, expect, label) {
  const first = lines[from - 1]
  const last = lines[to - 1]
  if (!first.includes(expect[0])) {
    throw new Error(`${label}: line ${from} does not contain ${JSON.stringify(expect[0])}\n  got: ${first.slice(0, 160)}`)
  }
  if (!last.includes(expect[1])) {
    throw new Error(`${label}: line ${to} does not contain ${JSON.stringify(expect[1])}\n  got: ${last.slice(0, 160)}`)
  }
  return lines.slice(from - 1, to)
}

// ── anchors ─────────────────────────────────────────────────────────────────
const iconsStart = find(/^ {4}const CHANNEL_ICONS = \{$/, 'CHANNEL_ICONS')
const providersStart = find(/^ {4}const CHANNEL_PROVIDERS = \[$/, 'CHANNEL_PROVIDERS', iconsStart + 1)
const creditsStart = find(/^ {4}const CHANNEL_CREDITS = \{$/, 'CHANNEL_CREDITS', providersStart + 1)
const rpcStart = find(/^ {4}function sameChannelTransport\(/, 'sameChannelTransport', creditsStart + 1)

// The doc comment introducing the RPC section is the last `/**` between the end
// of CHANNEL_CREDITS and sameChannelTransport; it bounds the last table.
let rpcDocStart = rpcStart
for (let i = rpcStart - 2; i >= creditsStart; i--) {
  if (lines[i] === '    /**') { rpcDocStart = i + 1; break }
}
if (rpcDocStart === rpcStart) throw new Error('no /** comment found above sameChannelTransport')

const iconsEnd = find(/^ {4}\}$/, 'CHANNEL_ICONS end', iconsStart + 1, providersStart)
const providersEnd = find(/^ {4}\]$/, 'CHANNEL_PROVIDERS end', providersStart + 1, creditsStart)
const creditsEnd = find(/^ {4}\}$/, 'CHANNEL_CREDITS end', creditsStart + 1, rpcDocStart)

const icons = slice(iconsStart, iconsEnd, ['const CHANNEL_ICONS = {', '}'], 'CHANNEL_ICONS')
const providers = slice(providersStart, providersEnd, ['const CHANNEL_PROVIDERS = [', ']'], 'CHANNEL_PROVIDERS')
const credits = slice(creditsStart, creditsEnd, ['const CHANNEL_CREDITS = {', '}'], 'CHANNEL_CREDITS')

// ── sanity: the tables must describe the same thirteen channels ─────────────
/** The `id: '...'` of each provider row. */
const providerIds = []
for (const line of providers) {
  const match = /^\s+\{ id: '([^']+)'/.exec(line)
  if (match !== null) providerIds.push(match[1])
}
/** The keys of the credit table. */
const creditIds = []
for (const line of credits) {
  const match = /^\s{6}([a-z]+): \{/.exec(line)
  if (match !== null) creditIds.push(match[1])
}

const EXPECTED = [
  'codearts', 'buddy', 'workbuddy', 'lobsterai', 'qoder', 'qodercn', 'trae',
  'cline', 'loomy', 'raccoon', 'minimax', 'zcode', 'gemini',
]
for (const id of EXPECTED) {
  if (!providerIds.includes(id)) throw new Error(`provider table is missing "${id}" (got ${providerIds.join(', ')})`)
  if (!creditIds.includes(id)) throw new Error(`credit table is missing "${id}" (got ${creditIds.join(', ')})`)
}
if (providerIds.length !== EXPECTED.length) {
  throw new Error(`expected ${EXPECTED.length} providers, got ${providerIds.length}: ${providerIds.join(', ')}`)
}

// ── write ───────────────────────────────────────────────────────────────────
const out = `/**
 * The thirteen agent channels, lifted verbatim from \`dsh-our-free-model\`
 * v2.5.7's browser bundle by \`scripts/extract-data.mjs\`.
 *
 * These are product facts, not presentation: the channel ids the vendored pack
 * answers to, the names and orgs users recognise, the accent each product is
 * known by, the note describing what it gives you, and which channels support a
 * credit claim (and in what unit). Re-typing them is how a plugin ends up with
 * the wrong accent on Qoder or a claim button on a channel that has none.
 *
 * Regenerate with:
 *   node scripts/extract-data.mjs <path-to-upstream-client.js>
 *
 * Do not hand-edit; the extraction asserts the table shape on every run.
 */

/** Per-channel logo artwork (inline base64, so no network fetch is involved). */
${icons.join('\n')}

/**
 * The thirteen channels.
 *
 * \`login\` picks the flow the card offers: \`browser\` opens a page and waits for
 * the credential to land; \`browser+sms\` means the flow may fall back to an SMS
 * code. \`accent\` is the product's own colour and is used only for the channel's
 * mark, never for buttons or navigation.
 */
${providers.join('\n')}

/**
 * What each channel can report or claim.
 *
 * \`claim\` — there is a daily credit to collect.
 * \`status\` — the pack reports a per-account check-in state.
 * \`unit\` — how a balance is counted: \`dollars\`, \`tokens\`, or \`quota\` (a set of
 * packages whose remaining percentage is the reading).
 */
${credits.join('\n')}
`

const outFile = path.join(root, 'src', 'channels.data.js')
fs.writeFileSync(outFile, out, 'utf8')
console.log(`wrote ${outFile}`)
console.log(`  ${out.split('\n').length} lines, ${Buffer.byteLength(out)} bytes`)
console.log(`  ${providerIds.length} channels: ${providerIds.join(', ')}`)
