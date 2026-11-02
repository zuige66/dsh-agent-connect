/**
 * Render the page in a real browser so it can be looked at.
 *
 * The settings section is a React component; this harness mounts the real
 * `Page` from the built bundle with a stubbed `connection` RPC that answers
 * from `fixtures.json`. That is enough to see the layout, the fold, the credit
 * column and the states without a running harness or any vendor account.
 *
 * Usage:
 *   node scripts/preview.mjs            # writes .preview/index.html
 *   node scripts/preview.mjs --shot     # also screenshots it with Chrome
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, '.preview')
fs.mkdirSync(out, { recursive: true })

const bundle = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
const css = fs.readFileSync(path.join(root, 'src', 'page.css'), 'utf8')

// ── fixture: what the pack answers for a typical machine ────────────────────
// Deliberately mixed: two channels with several accounts and healthy balances,
// one connected with no credit capability, one turned off, and the rest idle —
// so the table shows every state at once instead of one happy column.
const fixtures = {
  statuses: {
    buddy: { accounts: { total: 3, enabled: 3 }, models: { total: 24, disabled: 4 }, closed: false },
    workbuddy: { accounts: { total: 2, enabled: 2 }, models: { total: 18, disabled: 0 }, closed: false },
    trae: { accounts: { total: 2, enabled: 1 }, models: { total: 9, disabled: 2 }, closed: false },
    qoder: { accounts: { total: 1, enabled: 1 }, models: { total: 12, disabled: 0 }, closed: false },
    cline: { accounts: { total: 1, enabled: 1 }, models: { total: 7, disabled: 0 }, closed: false },
    codearts: { accounts: { total: 0, enabled: 0 }, models: { total: 0, disabled: 0 }, closed: false },
    lobsterai: { accounts: { total: 0, enabled: 0 }, models: { total: 0, disabled: 0 }, closed: true },
    gemini: { accounts: { total: 1, enabled: 1 }, models: { total: 4, disabled: 0 }, closed: false },
  },
  balances: {
    buddy: 4820,
    workbuddy: 12750,
    trae: 300,
    qoder: 100,
    cline: 2.4,
    gemini: 87,
  },
  accounts: {
    buddy: [
      { id: 'buddy-1', nickname: '醉歌', enabled: true, expiresAt: Date.now() + 86400000 * 20, refreshable: true },
      { id: 'buddy-2', nickname: 'zuige', enabled: true, expiresAt: Date.now() + 86400000 * 9, refreshable: true },
      { id: 'buddy-3', nickname: 'liruisen0413', enabled: false, expiresAt: 0, refreshable: false },
    ],
    trae: [
      { id: 'trae-1', nickname: '137******09', enabled: true, expiresAt: Date.now() + 86400000 * 14, refreshable: true },
      { id: 'trae-2', nickname: '139******52', enabled: false, expiresAt: Date.now() + 86400000 * 3, refreshable: true },
    ],
  },
  models: {
    buddy: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'kimi-k3', name: 'Kimi K3' },
      { id: 'glm-5-flash', name: 'GLM 5 Flash' },
      { id: 'hunyuan-t1', name: 'Hunyuan T1', disabled: true },
      { id: 'minimax-m2', name: 'MiniMax M2' },
      { id: 'step-3', name: 'Step 3' },
    ],
  },
  auto: {
    enabled: true,
    running: false,
    ranToday: true,
    lastDate: '2026-11-02',
    lastResult: '5 个渠道：3 个账号领取成功（4,820 积分），2 个今天已领',
  },
  usage: {
  "days": [
    {
      "day": "2026-11-02",
      "totals": {
        "requests": 1846,
        "inputTokens": 13293347,
        "outputTokens": 1693360
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "workbuddy"
            }
          ],
          "totals": {
            "requests": 1844,
            "inputTokens": 13293277,
            "outputTokens": 1693325
          }
        },
        {
          "channel": "gateway",
          "providers": [
            {
              "provider": "buddy"
            }
          ],
          "totals": {
            "requests": 2,
            "inputTokens": 70,
            "outputTokens": 35
          }
        }
      ]
    },
    {
      "day": "2026-11-01",
      "totals": {
        "requests": 1,
        "inputTokens": 0,
        "outputTokens": 0
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "workbuddy"
            }
          ],
          "totals": {
            "requests": 1,
            "inputTokens": 0,
            "outputTokens": 0
          }
        }
      ]
    },
    {
      "day": "2026-10-30",
      "totals": {
        "requests": 7,
        "inputTokens": 0,
        "outputTokens": 0
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "workbuddy"
            }
          ],
          "totals": {
            "requests": 7,
            "inputTokens": 0,
            "outputTokens": 0
          }
        }
      ]
    },
    {
      "day": "2026-10-29",
      "totals": {
        "requests": 136,
        "inputTokens": 11241218,
        "outputTokens": 119081
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "trae"
            }
          ],
          "totals": {
            "requests": 136,
            "inputTokens": 11241218,
            "outputTokens": 119081
          }
        }
      ]
    },
    {
      "day": "2026-10-28",
      "totals": {
        "requests": 143,
        "inputTokens": 10664078,
        "outputTokens": 109381
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "trae"
            }
          ],
          "totals": {
            "requests": 143,
            "inputTokens": 10664078,
            "outputTokens": 109381
          }
        }
      ]
    },
    {
      "day": "2026-10-26",
      "totals": {
        "requests": 80,
        "inputTokens": 4483077,
        "outputTokens": 30802
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "trae"
            }
          ],
          "totals": {
            "requests": 80,
            "inputTokens": 4483077,
            "outputTokens": 30802
          }
        }
      ]
    },
    {
      "day": "2026-10-25",
      "totals": {
        "requests": 23,
        "inputTokens": 934969,
        "outputTokens": 16850
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "trae"
            }
          ],
          "totals": {
            "requests": 23,
            "inputTokens": 934969,
            "outputTokens": 16850
          }
        }
      ]
    },
    {
      "day": "2026-10-24",
      "totals": {
        "requests": 25,
        "inputTokens": 847191,
        "outputTokens": 25991
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "trae"
            }
          ],
          "totals": {
            "requests": 25,
            "inputTokens": 847191,
            "outputTokens": 25991
          }
        }
      ]
    },
    {
      "day": "2026-10-23",
      "totals": {
        "requests": 118,
        "inputTokens": 5108604,
        "outputTokens": 76890
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "trae"
            }
          ],
          "totals": {
            "requests": 118,
            "inputTokens": 5108604,
            "outputTokens": 76890
          }
        }
      ]
    },
    {
      "day": "2026-10-22",
      "totals": {
        "requests": 84,
        "inputTokens": 6394989,
        "outputTokens": 34383
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "buddy"
            }
          ],
          "totals": {
            "requests": 84,
            "inputTokens": 6394989,
            "outputTokens": 34383
          }
        }
      ]
    },
    {
      "day": "2026-10-21",
      "totals": {
        "requests": 988,
        "inputTokens": 62137709,
        "outputTokens": 678626
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "buddy"
            }
          ],
          "totals": {
            "requests": 988,
            "inputTokens": 62137709,
            "outputTokens": 678626
          }
        }
      ]
    },
    {
      "day": "2026-10-20",
      "totals": {
        "requests": 365,
        "inputTokens": 311086,
        "outputTokens": 266962
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "buddy"
            }
          ],
          "totals": {
            "requests": 365,
            "inputTokens": 311086,
            "outputTokens": 266962
          }
        }
      ]
    },
    {
      "day": "2026-10-19",
      "totals": {
        "requests": 176,
        "inputTokens": 613122,
        "outputTokens": 206830
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "buddy"
            }
          ],
          "totals": {
            "requests": 176,
            "inputTokens": 613122,
            "outputTokens": 206830
          }
        }
      ]
    },
    {
      "day": "2026-10-18",
      "totals": {
        "requests": 91,
        "inputTokens": 4158982,
        "outputTokens": 129406
      },
      "channels": [
        {
          "channel": "direct",
          "providers": [
            {
              "provider": "buddy"
            }
          ],
          "totals": {
            "requests": 91,
            "inputTokens": 4158982,
            "outputTokens": 129406
          }
        }
      ]
    }
  ],
  "totals": {
    "requests": 4083,
    "inputTokens": 120188372,
    "outputTokens": 3388562
  }
},
  gateway: {
    enabled: true,
    running: true,
    blockedByEnv: false,
    address: { host: '127.0.0.1', port: 8326 },
    apiKey: { value: 'Zx8kQm3vTnR7bYpL2wJcF5hDsA9gEu4iN6oXr1tKv0M', fromEnv: false, path: '~/.dsh/openai-gateway/api-key' },
    models: [
      { id: 'buddy/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'buddy/kimi-k3', name: 'Kimi K3' },
      { id: 'workbuddy/glm-5-flash', name: 'GLM 5 Flash' },
      { id: 'qoder/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'trae/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
      { id: 'cline/gpt-5.2-codex', name: 'GPT 5.2 Codex' },
      { id: 'gemini/gemini-3-pro', name: 'Gemini 3 Pro' },
    ],
    modelsSource: 'catalog',
  },
}

const harness = `<!doctype html>
<html lang="zh" data-theme="dark">
<head>
<meta charset="utf-8">
<title>Agent Channels — preview</title>
<style>
  /* The host's theme tokens, copied from the web shell's dark scheme so the
     page is seen against the surface it really sits on. */
  :root {
    --dsw-alias-bg-layer-1: #232323;
    --dsw-alias-bg-layer-2: #1c1c1c;
    --dsw-alias-bg-layer-3: #141414;
    --dsw-alias-bg-mask-1: rgba(0,0,0,.5);
    --dsw-alias-border-l1: #2c2c2c;
    --dsw-alias-border-l2: #383838;
    --dsw-alias-label-primary: #ededed;
    --dsw-alias-label-secondary: #a8a8a8;
    --dsw-alias-label-tertiary: #7a7a7a;
    --dsw-alias-label-on-accent: #ffffff;
    --dsw-alias-state-business-primary: #4c8dff;
    --dsw-alias-state-success-primary: #3ecfa0;
    --dsw-alias-state-warning-primary: #f2a65a;
    --dsw-alias-state-error-primary: #e5484d;
  }
  html, body { margin: 0; background: var(--dsw-alias-bg-layer-3); }
  body { padding: 32px 28px 64px; font-family: "Inter", -apple-system, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; }
  ${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
// ── a minimal React, enough to render this component tree once ──────────────
const hooks = { states: [], index: 0, effects: [] };
function useState(initial) {
  const i = hooks.index++;
  if (hooks.states[i] === undefined) hooks.states[i] = typeof initial === 'function' ? initial() : initial;
  return [hooks.states[i], v => { hooks.states[i] = typeof v === 'function' ? v(hooks.states[i]) : v; scheduleRender(); }];
}
// Effects are what load the data; a no-op stub leaves the page on its skeleton.
// They are queued per render and flushed after the tree is in the DOM.
const useEffect = fn => { hooks.effects.push(fn); };
const useMemo = fn => fn();
const useRef = v => ({ current: v });
const useCallback = fn => fn;
/** The page wraps sibling groups in Fragment; the stub needs a tag the
 *  renderer below recognises as "no element, just children". */
const Fragment = Symbol('Fragment');

function h(type, props, ...children) {
  if (typeof type === 'function') return type({ ...props, children });
  if (type === Fragment) return { tag: null, children };
  return { tag: type, props: props || {}, children: children.flat(Infinity).filter(c => c != null) };
}

// ── fixture-backed RPC ─────────────────────────────────────────────────────
const FIXTURES = ${JSON.stringify(fixtures)};
async function rpcCall(_base, _endpoint, request) {
  const { method, payload } = request;
  const provider = payload && payload.provider;
  switch (method) {
    case 'provider.status': return { ok: true, value: { statuses: FIXTURES.statuses } };
    case 'usage.autoCheckin': return { ok: true, value: { autoCheckin: FIXTURES.auto } };
    case 'gateway.getEnabled': return { ok: true, value: FIXTURES.gateway };
    case 'usage.tokenLedgerHistory': return { ok: true, value: { history: FIXTURES.usage.days, totals: FIXTURES.usage.totals } };
    case 'account.list': return { ok: true, value: { accounts: FIXTURES.accounts[provider] || [] } };
    case 'model.list': return { ok: true, value: { models: FIXTURES.models[provider] || [] } };
    case 'credits.balances': {
      const total = FIXTURES.balances[provider];
      return { ok: true, value: { accounts: total === undefined ? [] : [{ accountId: 'x', balance: { total } }] } };
    }
    case 'credits.status': return { ok: true, value: { accounts: [] } };
    case 'account.test': return { ok: true, value: { accountId: payload.accountId, modelId: 'deepseek-v4.1-flash', ok: false, message: '仍受限：429 rate limited' } };
    default: return { ok: true, value: {} };
  }
}

const connection = { rpc: { call: (...args) => rpcCall(...args) } };

// ── the page ───────────────────────────────────────────────────────────────
const rootEl = document.getElementById('root');
let renderQueued = false;
let renderCount = 0;
/** Effects already run, keyed by the order they appeared. A component's effect
 *  re-registers on every render, so without this the page would re-fetch on
 *  each pass and never settle. */
const ranEffects = new Set();

function scheduleRender() {
  if (renderQueued || renderCount > 40) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; rerender(); });
}

function rerender() {
  renderCount += 1;
  hooks.index = 0;
  hooks.effects = [];
  // The real dictionary, so the screenshot shows the copy the user will read
  // rather than the raw keys a bare identity function would print.
  const t = Object.assign(key => DICT.zh[key] ?? key, { locale: 'zh' });
  const tree = Page({ t, ctx: { connection }, locale: 'zh' });
  rootEl.innerHTML = '';
  rootEl.appendChild(render(tree));
  const queued = hooks.effects.slice();
  hooks.effects = [];
  for (const [index, fn] of queued.entries()) {
    if (ranEffects.has(index)) continue;
    ranEffects.add(index);
    try { fn(); } catch (e) { console.error(e); }
  }
}

function render(node) {
  if (node == null || node === false) return document.createTextNode('');
  if (typeof node === 'string' || typeof node === 'number') return document.createTextNode(String(node));
  if (Array.isArray(node)) { const f = document.createDocumentFragment(); node.forEach(c => f.appendChild(render(c))); return f; }
  if (node.tag == null) { const f = document.createDocumentFragment(); node.children.forEach(c => f.appendChild(render(c))); return f; }
  const el = document.createElement(node.tag);
  for (const [k, v] of Object.entries(node.props || {})) {
    if (k === 'key' || k === 'children') continue;
    if (k === 'className') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'checked') el.checked = v === true;
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  for (const child of node.children) el.appendChild(render(child));
  return el;
}

// The page reads /status over HTTP; stub fetch for it. Both this and the API
// prefix must exist *before* the bundle body runs, because the component tree
// is rendered at the end of this script.
window.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ channels: { state: 'ready', error: '' } }) });
const API = '/api/agent-channels';

${bundle.slice(bundle.indexOf('    const CHANNEL_ICONS'), bundle.indexOf('    // ══ styles')).replace(/^ {4}/gm, '')}

rerender();
// Open the first row so the fold is visible in the screenshot.
setTimeout(() => {
  const row = document.querySelector('.acx-row-main');
  if (row) row.click();
}, 60);
</script>
</body>
</html>
`

fs.writeFileSync(path.join(out, 'index.html'), harness, 'utf8')
console.log(`wrote ${path.join(out, 'index.html')}`)

if (process.argv.includes('--shot')) {
  const chrome = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find(candidate => fs.existsSync(candidate))
  if (chrome === undefined) {
    console.error('no Chrome or Edge found; open the file manually')
    process.exit(1)
  }
  const page = 'file:///' + path.join(out, 'index.html').replace(/\\/g, '/')
  for (const [name, width, height] of [['desktop', 1200, 1000], ['phone', 390, 900]]) {
    const target = path.join(out, `${name}.png`)
    await run(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      `--window-size=${width},${height}`, '--virtual-time-budget=3000',
      `--screenshot=${target}`, page,
    ])
    console.log(`  ${name}: ${target}`)
  }
}
