/**
 * The Agent Channels page.
 *
 * One screen answering one question: **which channels are actually signed in
 * today, and what did their credits come to?** The answer is a table — one row
 * per channel, the credit figure right-aligned and set in the one hue, the
 * sign-in state beside it. Everything else (accounts, models, claims) lives in
 * the row's fold, because it is what you do *after* reading the answer.
 *
 * The most frequent job is "claim the credits that are ready" and it sits in the
 * title row as the primary button; a second, slower job ("add an account") sits
 * on the row that has none.
 *
 * Data comes from the vendored pack over the composition's `connection` RPC.
 * Nothing here talks to a vendor directly and nothing stores a credential.
 */

// ── copy ────────────────────────────────────────────────────────────────────
// Two languages, one key set. The build asserts they match.
const DICT = {
  zh: {
    nav: 'Agent 渠道',
    title: 'Agent 渠道',
    sub: '把各家的免费额度接进来：登录一次，模型就出现在模型选择器里。凭据只写入本机凭据库，这一页永远拿不到明文。',
    loading: '正在读取渠道状态…',
    loadFailed: '读不到渠道后端',
    retry: '重试',

    'fig.connected': '已接入渠道',
    'fig.accounts': '账号',
    'fig.credit': '积分余额',
    'fig.models': '可选模型',

    'col.channel': '渠道',
    'col.state': '状态',
    'col.accounts': '账号',
    'col.credit': '积分',
    'col.models': '模型',

    'state.on': '已接入',
    'state.off': '未接入',
    'state.closed': '已关闭',
    'state.pending': '登录中',

    'act.add': '添加账号',
    'act.claimAll': '领取全部积分',
    'act.claiming': '领取中…',
    'act.refresh': '刷新',
    'act.refreshing': '刷新中…',
    'act.claim': '领取',
    'act.test': '测试',
    'act.enable': '启用',
    'act.disable': '停用',
    'act.delete': '移除',
    'act.enableAll': '全部打开',
    'act.disableAll': '全部关闭',

    'fold.accounts': '账号',
    'fold.models': '模型',
    'fold.none': '还没有账号——点「添加账号」开始登录。',
    'fold.noModels': '这个渠道没有报告模型清单。',
    'fold.modelsOn': '已打开 {on} / {total}',

    'acct.enabled': '已启用',
    'acct.disabled': '已停用',
    'acct.never': '长效',
    'acct.today': '今日 +{credit}',

    'credits.left': '余额',
    'credits.tokens': 'Token',
    'credits.dollars': '余额',
    'credits.quota': '配额',
    'credits.none': '—',
    'credits.querying': '查询中…',
    'credits.failed': '查询失败',
    'credits.unavailable': '未返回',

    'checkin.title': '每日自动签到',
    'checkin.hint': '启动后若今天还没签到，会自动把所有渠道领一遍。',
    'checkin.running': '签到进行中…',
    'checkin.ran': '今天已签到',
    'checkin.off': '今天还没签到',
    'checkin.last': '上次结果：{result}',

    'api.title': 'API 接口',
    'api.subRunning': '本机 OpenAI 兼容端点。把这个地址和密钥填进任何支持自定义 base URL 的客户端，就能用上这些渠道的模型。',
    'api.subOff': '开关关着，端点不监听。打开后即可复制地址与密钥。',
    'api.subBlocked': '已被 DSH_OPENAI_GATEWAY_ENABLED 环境变量停用，开关无效。',
    'api.stateRunning': '监听中',
    'api.stateStarting': '未监听',
    'api.stateOff': '已关闭',
    'api.baseUrl': 'Base URL',
    'api.key': 'API Key',
    'api.copy': '复制',
    'api.copied': '已复制',
    'api.show': '显示',
    'api.hide': '隐藏',
    'api.noModels': '还没有可用的模型——先登录一个渠道。',
    'api.modelsHint': '可用的模型 id（{n} 个）',
    'api.copyModels': '复制全部 id',
    'api.copyCurl': '复制 curl 示例',

    'lan.title': '局域网共享',
    'lan.subOff': '打开后，同一网络下的其它设备也能用这个接口。默认关闭。',
    'lan.subOn': '正在 {port} 端口对局域网提供接口。本机关掉 DSH 就会停。',
    'lan.failed': '打不开：{reason}',
    'lan.stateOn': '已开放',
    'lan.url': '局域网地址',
    'lan.others': '其它网卡',
    'lan.warn': '拿到这个地址和上面的 Key 的人，可以用掉你所有渠道的额度。只在可信网络里开。',

    'usage.title': '用量',
    'usage.empty': '还没有用量记录——用这些渠道的模型聊几句，这里就会出现每天的数字。',
    'usage.metricTokens': 'Token',
    'usage.metricRequests': '请求数',
    'usage.todayTokens': '今日 Token',
    'usage.todayInOut': '输入 {in} · 输出 {out}',
    'usage.todayRequests': '今日请求',
    'usage.totalTokens': '合计 Token',
    'usage.window': '最近 {n} 天',
    'usage.weekTokens': '近 7 天 Token',
    'usage.reqUnit': '次',

    'login.title': '登录 {name}',
    'login.step1': '在浏览器里完成登录（如果没自动打开，点下面的按钮）。',
    'login.step2': '登录成功后本页会自动完成，不需要复制任何东西。',
    'login.open': '打开登录页',
    'login.waiting': '已打开登录页，等待授权…（最长 10 分钟）',
    'login.expired': '等待超时，请重新发起登录。',
    'login.done': '已接入：{login}',
    'login.failed': '登录未完成：{reason}',
    'login.cancel': '取消',

    'err.packFailed': '渠道包未挂载：{reason}',
    'err.noRpc': '宿主没有提供 connection 服务，渠道操作暂不可用。',
    'err.action': '操作失败：{reason}',
    'err.testOk': '连接正常',
    'err.testFailed': '测试失败：{reason}',
    'err.testNoReason': '渠道没有返回原因',
    'err.testResetsIn': '{when}恢复',
    'err.claimOk': '已领 {count} 个账号，共 {credit}。',
    'err.claimNone': '今天没有可领取的积分。',
    'err.claimFailed': '领取失败：{reason}',
    'err.confirmDelete': '移除账号 {name}？该账号的凭据会一并删除。',
  },
  en: {
    nav: 'Agent Channels',
    title: 'Agent Channels',
    sub: "Bring each vendor's free quota in: sign in once and its models appear in the model picker. Credentials go to the local credential store only — this page never sees them.",
    loading: 'Reading channel state…',
    loadFailed: 'Cannot reach the channel backend',
    retry: 'Retry',

    'fig.connected': 'Channels on',
    'fig.accounts': 'Accounts',
    'fig.credit': 'Credits',
    'fig.models': 'Models',

    'col.channel': 'Channel',
    'col.state': 'State',
    'col.accounts': 'Accounts',
    'col.credit': 'Credits',
    'col.models': 'Models',

    'state.on': 'Connected',
    'state.off': 'Not connected',
    'state.closed': 'Turned off',
    'state.pending': 'Signing in',

    'act.add': 'Add account',
    'act.claimAll': 'Claim all credits',
    'act.claiming': 'Claiming…',
    'act.refresh': 'Refresh',
    'act.refreshing': 'Refreshing…',
    'act.claim': 'Claim',
    'act.test': 'Test',
    'act.enable': 'Enable',
    'act.disable': 'Disable',
    'act.delete': 'Remove',
    'act.enableAll': 'Show all',
    'act.disableAll': 'Hide all',

    'fold.accounts': 'Accounts',
    'fold.models': 'Models',
    'fold.none': 'No account yet — press “Add account” to sign in.',
    'fold.noModels': 'This channel reports no model list.',
    'fold.modelsOn': '{on} of {total} shown',

    'acct.enabled': 'Enabled',
    'acct.disabled': 'Disabled',
    'acct.never': 'Long-lived',
    'acct.today': '+{credit} today',

    'credits.left': 'Balance',
    'credits.tokens': 'Tokens',
    'credits.dollars': 'Balance',
    'credits.quota': 'Quota',
    'credits.none': '—',
    'credits.querying': 'Querying…',
    'credits.failed': 'Query failed',
    'credits.unavailable': 'Not reported',

    'checkin.title': 'Daily auto check-in',
    'checkin.hint': "On startup, if today's claim has not run yet, every channel is claimed once.",
    'checkin.running': 'Check-in running…',
    'checkin.ran': 'Checked in today',
    'checkin.off': 'Not checked in today',
    'checkin.last': 'Last result: {result}',

    'api.title': 'API endpoint',
    'api.subRunning': 'A local OpenAI-compatible endpoint. Point any client that takes a custom base URL at it and its models are these channels.',
    'api.subOff': 'The switch is off, so nothing is listening. Turn it on to copy the address and key.',
    'api.subBlocked': 'Disabled by the DSH_OPENAI_GATEWAY_ENABLED environment variable; the switch cannot override it.',
    'api.stateRunning': 'Listening',
    'api.stateStarting': 'Not listening',
    'api.stateOff': 'Off',
    'api.baseUrl': 'Base URL',
    'api.key': 'API key',
    'api.copy': 'Copy',
    'api.copied': 'Copied',
    'api.show': 'Show',
    'api.hide': 'Hide',
    'api.noModels': 'No models yet — sign in to a channel first.',
    'api.modelsHint': 'Servable model ids ({n})',
    'api.copyModels': 'Copy all ids',
    'api.copyCurl': 'Copy curl example',

    'lan.title': 'Share on this network',
    'lan.subOff': 'Off by default. Turn it on and other devices on the same network can use this endpoint.',
    'lan.subOn': 'Serving this network on port {port}. Closing DSH stops it.',
    'lan.failed': 'Could not open: {reason}',
    'lan.stateOn': 'Open',
    'lan.url': 'LAN address',
    'lan.others': 'Other adapters',
    'lan.warn': 'Anyone with this address and the key above can spend every channel\'s quota. Only turn this on on a network you trust.',

    'usage.title': 'Usage',
    'usage.empty': 'No usage recorded yet — have a conversation through these channels and the daily figures appear here.',
    'usage.metricTokens': 'Tokens',
    'usage.metricRequests': 'Requests',
    'usage.todayTokens': 'Tokens today',
    'usage.todayInOut': '{in} in · {out} out',
    'usage.todayRequests': 'Requests today',
    'usage.totalTokens': 'Total tokens',
    'usage.window': 'Last {n} days',
    'usage.weekTokens': 'Tokens, last 7 days',
    'usage.reqUnit': 'req',

    'login.title': 'Sign in to {name}',
    'login.step1': 'Finish the sign-in in your browser (if it did not open, use the button below).',
    'login.step2': 'This page completes by itself once the browser flow does — nothing to copy.',
    'login.open': 'Open sign-in page',
    'login.waiting': 'Sign-in page opened; waiting for authorization… (up to 10 minutes)',
    'login.expired': 'Timed out — please start the sign-in again.',
    'login.done': 'Connected: {login}',
    'login.failed': 'Sign-in did not complete: {reason}',
    'login.cancel': 'Cancel',

    'err.packFailed': 'Channel pack not mounted: {reason}',
    'err.noRpc': 'This host exposes no connection service, so channel actions are unavailable.',
    'err.action': 'Action failed: {reason}',
    'err.testOk': 'Connection healthy',
    'err.testFailed': 'Test failed: {reason}',
    'err.testNoReason': 'the channel returned no reason',
    'err.testResetsIn': 'recovers {when}',
    'err.claimOk': 'Claimed for {count} account(s), {credit} in total.',
    'err.claimNone': 'Nothing to claim today.',
    'err.claimFailed': 'Claim failed: {reason}',
    'err.confirmDelete': 'Remove account {name}? Its credential is deleted with it.',
  },
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** The plugin's own two routes; everything else goes over RPC. */
async function api(path, options) {
  const { timeout = 8000, ...rest } = options ?? {}
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(API + path, { ...rest, redirect: 'error', signal: controller.signal })
    const text = await response.text()
    let payload
    try { payload = text === '' ? {} : JSON.parse(text) } catch { payload = { error: text.slice(0, 200) } }
    if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`)
    return payload
  } finally {
    clearTimeout(timer)
  }
}

const post = (path, body, timeout) => api(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  ...(timeout === undefined ? {} : { timeout }),
})

/**
 * Compact number: 1234567 → "1.2M".
 *
 * Credits arrive in the millions for some vendors and in single digits for
 * others, so a fixed format is either unreadable or falsely precise.
 */
function kilo(value) {
  const n = Math.round(Number(value) || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

/** Human text for an expiry timestamp, or the long-lived marker. */
/**
 * A future timestamp as human text: "20 天后" / "in 20d".
 *
 * Locale comes from `t.locale`, which the section registration threads through
 * (`Object.assign(x => t(x), { locale })`). Reading it defensively matters: a
 * bare `t` with no `locale` used to fall back to English inside a Chinese page,
 * which is exactly the "in 309d" the screenshot showed.
 *
 * @param {number} at - epoch ms
 * @param {(key: string) => string} t
 * @returns {string}
 */
function relativeTime(at, t) {
  const seconds = Math.max(1, Math.round((at - Date.now()) / 1000))
  const zh = String(t?.locale ?? '').toLowerCase().startsWith('zh')
  if (seconds < 3600) {
    const minutes = Math.max(1, Math.round(seconds / 60))
    return zh ? `${minutes} 分钟后` : `in ${minutes}m`
  }
  const hours = Math.round(seconds / 3600)
  if (hours < 48) return zh ? `${hours} 小时后` : `in ${hours}h`
  return zh ? `${Math.round(hours / 24)} 天后` : `in ${Math.round(hours / 24)}d`
}

/** A credential's expiry as human text, or the long-lived marker. */
function expiryText(entry, t) {
  if (!Number.isFinite(entry?.expiresAt) || entry.expiresAt <= 0) return t('acct.never')
  return relativeTime(entry.expiresAt, t)
}

/**
 * Copy text to the clipboard, with a fallback for hosts that refuse the async
 * API (a non-secure context, an older engine).
 *
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyText(text) {
  try {
    if (navigator?.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch { return false }
}

/**
 * The credit figure for one channel, as { value, unit }.
 *
 * Three shapes come back from the pack and they are not comparable: a token
 * count, a money balance, and a set of quota packages whose reading is a
 * percentage. The unit is returned alongside so the cell can print it small and
 * grey rather than pretending all three are the same number.
 */
function formatCredits(total, capability) {
  if (!Number.isFinite(total)) return { value: '—', unit: '', empty: true }
  if (capability?.quota) return { value: kilo(total), unit: '%', empty: false }
  if (capability?.unit === 'tokens') return { value: kilo(total), unit: '', empty: false }
  if (capability?.unit === 'dollars') return { value: `$${total.toFixed(2)}`, unit: '', empty: false }
  return { value: kilo(total), unit: '', empty: false }
}

/** A tiny hook: run a loader, expose {status, data, error, reload}. */
function useAsync(loader, deps) {
  const [state, setState] = useState({ status: 'loading', data: undefined, error: '' })
  const run = useCallback(() => {
    let alive = true
    setState(current => ({ ...current, status: 'loading' }))
    loader()
      .then(data => { if (alive) setState({ status: 'ready', data, error: '' }) })
      .catch(error => { if (alive) setState({ status: 'error', data: undefined, error: String(error?.message ?? error) }) })
    return () => { alive = false }
  }, deps)
  useEffect(() => run(), [run])
  return { ...state, reload: run }
}

// ── the RPC the pack registers ──────────────────────────────────────────────
/**
 * The pack's browser half used the shell's connection service; this page does
 * the same rather than proxying through a JSON route, so channel traffic keeps
 * the connection's admission check and the credential store stays the only
 * place a token exists.
 *
 * `connection` is read opportunistically and re-read on a timer: the browser
 * half publishes it *after* plugins load, so reading it once at mount would
 * freeze in "absent" and leave every action disabled for the session.
 */
function sameChannelTransport(left, right) {
  return left === right || (left !== null && right !== null
    && typeof left === 'object' && typeof right === 'object'
    && left.connection === right.connection && left.call === right.call)
}

function channelTransport(rpc) {
  return typeof rpc?.transport === 'function' ? rpc.transport() : rpc
}

function useChannelRpc(ctx) {
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  const readTransport = useCallback(() => {
    const current = ctxRef.current
    let connection
    try { connection = current?.connection } catch { /* service not provided yet */ }
    if (connection === undefined || connection === null) {
      try { connection = current?.get?.('connection') } catch { /* service not provided yet */ }
    }
    try {
      const call = connection?.rpc?.call
      return typeof call === 'function' ? { connection, call } : null
    } catch { return null }
  }, [])
  const [transport, setTransport] = useState(readTransport)
  useEffect(() => {
    let alive = true
    const check = () => {
      if (!alive) return
      const next = readTransport()
      setTransport(previous => (sameChannelTransport(previous, next) ? previous : next))
    }
    check()
    const timer = setInterval(check, 500)
    return () => { alive = false; clearInterval(timer) }
  }, [readTransport])
  // Context wrappers do not invalidate readers; an actual transport swap does.
  const rpc = useCallback(async (method, payload, timeoutMs = 60_000) => {
    const latest = readTransport()
    if (latest === null) throw new Error('no-connection')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await latest.call.call(
        latest.connection.rpc, '/api', 'channel-pack', { method, payload }, controller.signal,
      )
      if (result?.ok === true) return result.value
      if (result?.ok === false) throw new Error(result.error?.message ?? result.error?.code ?? 'rpc-failed')
      return result
    } finally { clearTimeout(timer) }
  }, [readTransport, transport])
  rpc.transport = readTransport
  return { available: transport !== null, rpc }
}

// ── small surfaces ──────────────────────────────────────────────────────────

function Button({ children, onClick, disabled, kind, title, busy }) {
  return h('button', {
    type: 'button',
    className: `acx-btn${kind === undefined ? '' : ` ${kind}`}`,
    disabled: disabled === true,
    onClick,
    title,
    'aria-busy': busy === true ? 'true' : undefined,
  }, children)
}

function Switch({ checked, onChange, label, disabled }) {
  return h('button', {
    type: 'button',
    className: 'acx-switch',
    role: 'switch',
    'aria-checked': checked === true ? 'true' : 'false',
    'aria-label': label,
    disabled: disabled === true,
    onClick: onChange,
  }, h('i'))
}

/** A channel's logo, or its two-letter tile when the table has no artwork. */
function Mark({ channel }) {
  const src = CHANNEL_ICONS[channel.id]
  return h('span', { className: 'acx-mark', 'aria-hidden': 'true' },
    src === undefined ? channel.name.slice(0, 2).toUpperCase() : h('img', { src, alt: '' }))
}

/**
 * The sign-in dialog.
 *
 * The pack's login is two-phase: `account.create` answers with a URL to open
 * *immediately* (a popup opened after a 30-second await is blocked), then the
 * browser flow finishes in the background and `login.poll` sees the credential
 * land. So the URL is opened inside the click, and this dialog just waits.
 */
function LoginDialog({ t, channel, login, onCancel }) {
  const open = () => {
    if (login.url === '') return
    try { window.open(login.url, '_blank', 'noopener') } catch { /* the link below still works */ }
  }
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return h('div', { className: 'acx-scrim', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('login.title').replace('{name}', channel.name) },
    h('div', { className: 'acx-modal' },
      h('h3', null, t('login.title').replace('{name}', channel.name)),
      h('p', null, t('login.step1')),
      h('p', null, t('login.step2')),
      login.url === '' ? null : h('code', null, login.url),
      h('p', { className: 'acx-note' }, t('login.waiting')),
      h('div', { className: 'acx-modal-foot' },
        login.url === '' ? null : h(Button, { onClick: open }, t('login.open')),
        h(Button, { kind: 'quiet', onClick: onCancel }, t('login.cancel')))))
}

// ── the page ────────────────────────────────────────────────────────────────

/**
 * One channel row: the answer, then the fold that holds the work.
 *
 * The row is a button because opening it is the row's only job; the fold's
 * controls stop propagation so a click inside never re-collapses it.
 */
function ChannelRow({ t, channel, status, rpc, onError, onChanged }) {
  const [open, setOpen] = useState(null)
  const [accounts, setAccounts] = useState(undefined)
  const [models, setModels] = useState(undefined)
  const [credits, setCredits] = useState(undefined)
  const [balances, setBalances] = useState(undefined)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [login, setLogin] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const capability = CHANNEL_CREDITS[channel.id]
  const accountsTotal = status?.accounts?.total ?? 0
  const accountsOn = status?.accounts?.enabled ?? 0
  const modelsTotal = status?.models?.total ?? 0
  const modelsOff = status?.models?.disabled ?? 0
  const connected = accountsOn > 0
  const chanState = status?.closed === true ? 'off' : connected ? 'on' : 'idle'

  const loadAccounts = useCallback(async () => {
    try { setAccounts((await rpc('account.list', { provider: channel.id }))?.accounts ?? []) } catch (error) { setAccounts([]); onError(error) }
  }, [rpc, channel.id, onError])
  const loadModels = useCallback(async () => {
    try { setModels((await rpc('model.list', { provider: channel.id }))?.models ?? []) } catch (error) { setModels([]); onError(error) }
  }, [rpc, channel.id, onError])
  const loadCredits = useCallback(async () => {
    if (!capability?.status) return
    try { setCredits((await rpc('credits.status', { provider: channel.id }))?.accounts ?? []) } catch { setCredits([]) }
  }, [rpc, channel.id, capability])
  const loadBalances = useCallback(async (force = false) => {
    if (!capability) return
    setBalanceLoading(true)
    try {
      setBalances((await rpc('credits.balances', { provider: channel.id, ...(force ? { force: true } : {}) }, 90_000))?.accounts ?? [])
    } catch { setBalances([]) } finally { setBalanceLoading(false) }
  }, [rpc, channel.id, capability])

  // Balances move whenever a model is used elsewhere, so a slow heartbeat keeps
  // the figure honest while the page sits open.
  useEffect(() => { void loadBalances() }, [loadBalances])
  useEffect(() => {
    if (!capability) return undefined
    const timer = setInterval(() => { void loadBalances() }, 90_000)
    return () => clearInterval(timer)
  }, [capability, loadBalances])

  const toggle = async fold => {
    if (open === fold) { setOpen(null); return }
    setOpen(fold)
    if (fold === 'accounts') { setAccounts(undefined); await loadAccounts(); void loadCredits(); void loadBalances() }
    if (fold === 'models') { setModels(undefined); await loadModels() }
  }

  const startLogin = async () => {
    setBusy('add'); setNotice('')
    let popup = null
    // Reserve the window inside the click; a delayed RPC would lose activation.
    try { popup = window.open('about:blank', '_blank'); if (popup) popup.opener = null } catch { popup = null }
    try {
      const value = await rpc('account.create', { provider: channel.id }, 90_000)
      const accountId = value?.accountId
      const url = typeof value?.loginUrl === 'string' ? value.loginUrl : ''
      if (typeof accountId !== 'string' || accountId === '') throw new Error('bad-answer')
      let opened = false
      if (url !== '') {
        try {
          if (popup && !popup.closed) { popup.location.replace(url); opened = true; popup = null }
        } catch { /* the host can open it instead */ }
        try { if (popup && !popup.closed) popup.close() } catch { /* already closed */ }
        popup = null
        if (!opened) {
          // A blocked popup is normal; ask the host to launch the real browser,
          // which has no popup blocker.
          try { opened = (await post('/open-external', { url }, 15_000))?.opened === true } catch { /* the dialog offers the link */ }
        }
      } else { try { if (popup && !popup.closed) popup.close() } catch { /* already closed */ } popup = null }
      setLogin({ accountId, url, startedAt: Date.now() })
      setOpen('accounts')
      void loadAccounts()
    } catch (error) {
      try { if (popup && !popup.closed) popup.close() } catch { /* already closed */ }
      onError(error)
    } finally { setBusy('') }
  }

  // Poll the placeholder until its credential lands. Ten minutes matches the
  // window the pack keeps a pending login link alive for.
  useEffect(() => {
    if (login === null) return undefined
    let alive = true
    const timer = setInterval(async () => {
      if (Date.now() - login.startedAt > 10 * 60_000) {
        if (alive) { setLogin(null); setNotice(t('login.expired')) }
        return
      }
      try {
        const value = await rpc('login.poll', { accountId: login.accountId, provider: channel.id })
        if (!alive) return
        if (value?.done === true) {
          setLogin(null)
          if (value.success === false) setNotice(t('login.failed').replace('{reason}', value.error ?? ''))
          else {
            setNotice(t('login.done').replace('{login}', value.login ?? ''))
            onChanged(); void loadAccounts(); void loadCredits(); void loadBalances(true)
          }
        } else if (typeof value?.error === 'string' && value.error !== '') {
          setLogin(null); setNotice(t('login.failed').replace('{reason}', value.error))
        }
      } catch { /* the link may still complete; keep polling */ }
    }, 3000)
    return () => { alive = false; clearInterval(timer) }
  }, [login, rpc, channel.id, t, onChanged, loadAccounts, loadCredits, loadBalances])

  const act = async (key, fn) => {
    setBusy(key); setNotice('')
    try { await fn() } catch (error) { onError(error) } finally { setBusy('') }
  }

  const claim = async () => {
    if (!capability?.claim || busy !== '') return
    setBusy('claim'); setNotice('')
    try {
      const value = await rpc('credits.claimAll', { provider: channel.id }, 180_000)
      const summary = value?.summary ?? value
      const claimed = Number(summary?.claimed ?? 0)
      const credit = Number(summary?.totalCredit ?? 0)
      const failed = (value?.results ?? []).filter(row => row.outcome?.kind === 'failed')
      setNotice(failed.length > 0
        ? t('err.claimFailed').replace('{reason}', failed.map(row => row.outcome.message).join('；'))
        : claimed > 0 ? t('err.claimOk').replace('{count}', String(claimed)).replace('{credit}', kilo(credit)) : t('err.claimNone'))
      void loadCredits(); void loadBalances(true); onChanged()
    } catch (error) { onError(error) } finally { setBusy('') }
  }

  const setAllModels = async disabled => {
    if (busy !== '') return
    await act(disabled ? 'models:off' : 'models:on', async () => {
      await rpc('model.setAllDisabled', { provider: channel.id, disabled })
      await loadModels(); onChanged()
    })
  }

  const removeAccount = async accountId => {
    const entry = (accounts ?? []).find(row => row.id === accountId)
    const name = entry?.nickname ?? accountId
    if (typeof window !== 'undefined' && typeof window.confirm === 'function'
      && !window.confirm(t('err.confirmDelete').replace('{name}', name))) return
    await act('del:' + accountId, async () => {
      await rpc('account.delete', { accountId })
      onChanged(); await loadAccounts(); void loadBalances(true)
    })
  }

  // The row's credit figure: the sum of what the balance query reported.
  const balancesKnown = (balances ?? []).filter(row => Number.isFinite(row?.balance?.total))
  const creditTotal = balancesKnown.reduce((sum, row) => sum + row.balance.total, 0)
  const creditFigure = balances === undefined || balanceLoading
    ? { value: capability ? '…' : '—', unit: '', empty: !capability }
    : balancesKnown.length === 0
      ? { value: '—', unit: '', empty: true }
      : formatCredits(creditTotal, capability)

  const stateLabel = status?.closed === true ? t('state.closed') : connected ? t('state.on') : t('state.off')
  const stateTone = status?.closed === true ? 'bad' : connected ? 'ok' : ''
  const stateText = login !== null ? t('state.pending') : stateLabel

  // ── the fold, in three named pieces ───────────────────────────────────────
  // Kept out of the return below because three levels of nested ternary inside
  // one createElement call is how the parentheses went wrong the first time.

  const accountsFold = accounts === undefined
    ? h('div', { className: 'acx-skel', style: { width: '60%' } })
    : accounts.length === 0
      ? h('p', { className: 'acx-note' }, t('fold.none'))
      : h('div', { className: 'acx-accts' }, accounts.map(row => {
        const credit = (credits ?? []).find(entry => entry.accountId === row.id)?.status ?? null
        const balance = (balances ?? []).find(entry => entry.accountId === row.id)
        const reading = Number.isFinite(balance?.balance?.total)
          ? formatCredits(balance.balance.total, capability).value
          : null
        return h('div', { className: 'acx-acct', key: row.id },
          h('span', { className: 'acx-acct-name', title: row.nickname ?? row.id },
            row.nickname ?? row.id,
            row.enabled === false ? h('em', null, t('acct.disabled')) : null),
          h('span', { className: 'acx-acct-meta' },
            credit?.todayCheckedIn === true && Number.isFinite(credit.todayCredit)
              ? t('acct.today').replace('{credit}', String(credit.todayCredit))
              : expiryText(row, t)),
          h('span', { className: 'acx-acct-meta' }, reading === null ? t('credits.none') : reading),
          h('span', { className: 'acx-acct-acts' },
            h(Button, {
              kind: 'quiet', disabled: busy !== '',
              onClick: () => act('test:' + row.id, async () => {
                const value = await rpc('account.test', { accountId: row.id }, 90_000)
                // The probe answers `{ ok, message, modelId, resetTimeMs }` —
                // there is no `error` field, and no latency either. Reading the
                // wrong key is why this line used to print "测试失败：" with
                // nothing after it.
                if (value?.ok === false) {
                  const reason = typeof value?.message === 'string' && value.message !== ''
                    ? value.message
                    : t('err.testNoReason')
                  const reset = Number.isFinite(value?.resetTimeMs) && value.resetTimeMs > 0
                    ? ` · ${t('err.testResetsIn').replace('{when}', relativeTime(value.resetTimeMs, t))}`
                    : ''
                  setNotice(`${t('err.testFailed').replace('{reason}', reason)}${reset}`)
                  return
                }
                const model = typeof value?.modelId === 'string' && value.modelId !== ''
                  ? ` · ${value.modelId}`
                  : ''
                setNotice(`${t('err.testOk')}${model}`)
              }),
            }, t('act.test')),
            h(Button, {
              kind: 'quiet', disabled: busy !== '',
              onClick: () => act('toggle:' + row.id, async () => {
                await rpc('account.update', { accountId: row.id, patch: { enabled: row.enabled === false } })
                onChanged(); await loadAccounts()
              }),
            }, row.enabled === false ? t('act.enable') : t('act.disable')),
            h(Button, { kind: 'danger', disabled: busy !== '', onClick: () => void removeAccount(row.id) }, t('act.delete'))))
      }))

  const modelList = models === undefined
    ? h('div', { className: 'acx-skel', style: { width: '60%' } })
    : models.length === 0
      ? h('p', { className: 'acx-note' }, t('fold.noModels'))
      : h(Fragment, null,
        h('div', { className: 'acx-acts' },
          h('span', { className: 'acx-note' }, t('fold.modelsOn')
            .replace('{on}', String(models.filter(model => model.disabled !== true).length))
            .replace('{total}', String(models.length))),
          h(Button, { kind: 'quiet', disabled: busy !== '', onClick: () => void setAllModels(false) }, t('act.enableAll')),
          h(Button, { kind: 'quiet', disabled: busy !== '', onClick: () => void setAllModels(true) }, t('act.disableAll'))),
        h('div', { className: 'acx-models' }, models.map(model => h('label', {
          className: 'acx-model' + (model.disabled === true ? ' off' : ''),
          key: model.id,
        },
          h('input', {
            type: 'checkbox',
            checked: model.disabled !== true,
            disabled: busy !== '',
            onChange: event => {
              const disabled = event.target.checked !== true
              void act('model:' + model.id, async () => {
                await rpc('model.setDisabled', { provider: channel.id, modelId: model.id, disabled })
                await loadModels(); onChanged()
              })
            },
          }),
          h('span', { className: 'acx-model-name', title: model.id }, model.name ?? model.id)))))

  const fold = open === null ? null : h('div', { className: 'acx-fold' },
    h('div', { className: 'acx-acts' },
      h(Button, { onClick: startLogin, busy: busy === 'add', disabled: busy !== '' }, busy === 'add' ? '…' : t('act.add')),
      accountsTotal > 0 ? h(Button, {
        kind: 'quiet',
        disabled: busy !== '',
        onClick: () => act('refresh', async () => {
          for (const row of accounts ?? await rpc('account.list', { provider: channel.id }).then(v => v?.accounts ?? [])) {
            try { await rpc('account.refresh', { accountId: row.id }, 90_000) } catch (error) { onError(error) }
          }
          onChanged(); await loadAccounts(); void loadBalances(true)
        }),
      }, t('act.refresh')) : null,
      capability?.claim ? h(Button, { kind: 'quiet', disabled: busy !== '', busy: busy === 'claim', onClick: claim },
        busy === 'claim' ? t('act.claiming') : t('act.claim')) : null,
      capability ? h(Button, { kind: 'quiet', disabled: busy !== '' || balanceLoading, onClick: () => void loadBalances(true) },
        balanceLoading ? t('credits.querying') : t('credits.left')) : null,
      h('span', { style: { flex: '1' } }),
      h(Button, { kind: 'quiet', onClick: () => void toggle('models') }, t('fold.models'))),
    notice === '' ? null : h('p', { className: 'acx-note' }, notice),
    accountsFold,
    open === 'models' ? modelList : null)

  return h('div', { className: 'acx-chan' },
    h('button', {
      type: 'button',
      className: 'acx-row-main',
      'aria-expanded': open === null ? 'false' : 'true',
      onClick: () => { void toggle('accounts') },
    },
      h(Mark, { channel }),
      h('span', { className: 'acx-id' }, h('b', null, channel.name), h('span', null, channel.org)),
      h('span', { className: 'acx-state' }, h('span', { className: `acx-dot ${stateTone}` }), stateText),
      h('span', { className: 'acx-nums' },
        h('span', { className: 'acx-num' + (connected ? '' : ' empty'), 'data-label': t('col.accounts') },
          accountsTotal === 0 ? '—' : `${accountsOn}/${accountsTotal}`),
        h('span', { className: 'acx-num' + (modelsTotal === 0 ? ' empty' : ''), 'data-label': t('col.models') },
          modelsTotal === 0 ? '—' : String(modelsTotal - modelsOff)),
        h('span', { className: `acx-num${creditFigure.empty ? ' empty' : ' credit'}`, 'data-label': t('col.credit') },
          creditFigure.value,
          creditFigure.unit === '' ? null : h('span', { className: 'acx-unit' }, creditFigure.unit))),
      h('span', { className: 'acx-caret', 'data-open': open === null ? 'false' : 'true', 'aria-hidden': 'true' },
        h('svg', { viewBox: '0 0 12 12' }, h('path', { d: 'M3 1.5l6 4.5-6 4.5z' })))),
    fold,
    login === null ? null : h(LoginDialog, { t, channel, login, onCancel: () => setLogin(null) }))
}

/** The four figures above the table: the screen's answer in numbers. */
function Figures({ t, totals }) {
  return h('div', { className: 'acx-figures' },
    h('div', { className: 'acx-figure' }, h('b', null, `${totals.connected}/${totals.channels}`), h('span', null, t('fig.connected'))),
    h('div', { className: 'acx-figure' }, h('b', null, String(totals.accounts)), h('span', null, t('fig.accounts'))),
    h('div', { className: 'acx-figure is-credit' },
      h('b', null, totals.credit === null ? '—' : totals.credit.value),
      h('span', null, t('fig.credit'))),
    h('div', { className: 'acx-figure' },
      h('b', null, totals.models === 0 ? '—' : String(totals.models)),
      h('span', null, t('fig.models'))))
}

/**
 * The API panel: the pack's OpenAI-compatible gateway, made copyable.
 *
 * The gateway already exists — the pack starts it on `127.0.0.1:8326` and mints
 * its own key file. What was missing is a way to *get the recipe out*: a base
 * URL, a key, and a model id, in the shape each client actually wants. So this
 * panel prints the three values, offers one-click copies, and lists the model
 * ids the gateway will serve so nobody has to guess what to type.
 *
 * The key is shown here and nowhere else in the app; it is read from the pack's
 * own response, never logged, and the copy button is the only way it leaves the
 * page.
 */
function ApiPanel({ t, gateway, lan, lanBusy, onToggle, onToggleLan, copied, onCopy }) {
  const [revealKey, setRevealKey] = useState(false)
  const address = gateway?.address
  const base = address === null || address === undefined ? '' : `http://${address.host}:${address.port}/v1`
  const key = gateway?.apiKey?.value ?? ''
  const models = Array.isArray(gateway?.models) ? gateway.models : []
  const running = gateway?.running === true && base !== ''
  const blocked = gateway?.blockedByEnv === true

  const copy = (label, value) => { void onCopy(label, value) }

  const curl = base === ''
    ? ''
    : `curl ${base}/chat/completions \\\n  -H "authorization: Bearer ${key === '' ? '<KEY>' : key}" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"${models[0]?.id ?? '<MODEL>'}","messages":[{"role":"user","content":"hi"}]}'`

  return h('section', { className: 'acx-api' },
    h('div', { className: 'acx-api-head' },
      h(Switch, { checked: gateway?.enabled === true, onChange: onToggle, label: t('api.title'), disabled: gateway === undefined }),
      h('div', { className: 'acx-api-headmain' },
        h('b', null, t('api.title')),
        h('span', null, running ? t('api.subRunning') : blocked ? t('api.subBlocked') : t('api.subOff'))),
      h('span', { className: 'acx-state' },
        h('span', { className: `acx-dot ${running ? 'ok' : gateway?.enabled === true ? 'warn' : ''}` }),
        running ? t('api.stateRunning') : gateway?.enabled === true ? t('api.stateStarting') : t('api.stateOff'))),

    // Three copyable values. Shown even when the gateway is off, because the
    // address and key do not change with the switch — only whether it answers.
    h('div', { className: 'acx-apifields' },
      h('div', { className: 'acx-apifield' },
        h('span', { className: 'acx-apifield-label' }, t('api.baseUrl')),
        h('code', null, base === '' ? '—' : base),
        h(Button, { kind: 'quiet', disabled: base === '', onClick: () => copy('base', base) },
          copied === 'base' ? t('api.copied') : t('api.copy'))),
      h('div', { className: 'acx-apifield' },
        h('span', { className: 'acx-apifield-label' }, t('api.key')),
        // Masked by default: this panel sits in a settings page that may be
        // screen-shared, and the key is a bearer credential for every model on
        // the machine. Revealing it is one click; leaking it is not undoable.
        h('code', null, key === '' ? '—' : revealKey ? key : `${'•'.repeat(28)}${key.slice(-4)}`),
        h('span', { className: 'acx-apifield-acts' },
          h(Button, { kind: 'quiet', disabled: key === '', onClick: () => setRevealKey(value => !value) },
            revealKey ? t('api.hide') : t('api.show')),
          h(Button, { kind: 'quiet', disabled: key === '', onClick: () => copy('key', key) },
            copied === 'key' ? t('api.copied') : t('api.copy'))))),

    models.length === 0 ? h('p', { className: 'acx-note' }, t('api.noModels'))
      : h(Fragment, null,
        h('div', { className: 'acx-acts' },
          h('span', { className: 'acx-note' }, t('api.modelsHint').replace('{n}', String(models.length))),
          h(Button, { kind: 'quiet', onClick: () => copy('models', models.map(row => row.id).join('\n')) },
            copied === 'models' ? t('api.copied') : t('api.copyModels'))),
        h('div', { className: 'acx-models' }, models.map(row => h('div', { className: 'acx-model', key: row.id },
          h('span', { className: 'acx-model-name', title: row.id }, row.id),
          row.name === undefined || row.name === row.id ? null : h('span', { className: 'acx-acct-meta' }, row.name))))),

    curl === '' ? null : h('div', { className: 'acx-acts' },
      h(Button, { kind: 'quiet', onClick: () => copy('curl', curl) }, copied === 'curl' ? t('api.copied') : t('api.copyCurl'))),

    // ── the LAN front door ──────────────────────────────────────────────────
    // The gateway above is loopback-only; this switch opens a proxy on the LAN
    // interface in front of it. Off by default, because a port that appears on
    // the local network by itself is a surprise, and what it forwards can spend
    // every channel's quota.
    h('div', { className: 'acx-lan' },
      h('div', { className: 'acx-lan-head' },
        h(Switch, {
          checked: lan?.enabled === true,
          onChange: () => onToggleLan(lan?.enabled !== true),
          label: t('lan.title'),
          disabled: lan === undefined || lanBusy,
        }),
        h('div', { className: 'acx-lan-main' },
          h('b', null, t('lan.title')),
          h('span', null, lan?.running === true
            ? t('lan.subOn').replace('{port}', String(lan.port))
            : lan?.error !== undefined && lan.error !== ''
              ? t('lan.failed').replace('{reason}', lan.error)
              : t('lan.subOff'))),
        lan?.running === true ? h('span', { className: 'acx-state' },
          h('span', { className: 'acx-dot ok' }), t('lan.stateOn')) : null),

      lan?.running === true && Array.isArray(lan.urls) && lan.urls.length > 0
        ? h('div', { className: 'acx-apifields' },
          h('div', { className: 'acx-apifield' },
            h('span', { className: 'acx-apifield-label' }, t('lan.url')),
            h('code', null, lan.urls[0].url),
            h(Button, { kind: 'quiet', onClick: () => copy('lan', lan.urls[0].url) },
              copied === 'lan' ? t('api.copied') : t('api.copy'))),
          // Every other address is listed under the first: which one a caller
          // can reach depends on the network it is on, and this machine cannot
          // know that. Showing them all beats making the user guess.
          lan.urls.length > 1
            ? h('div', { className: 'acx-lan-alts' },
              h('span', { className: 'acx-apifield-label' }, t('lan.others')),
              lan.urls.slice(1).map(row => h('span', { key: row.address, className: 'acx-lan-alt' },
                h('code', null, row.url),
                h('span', { className: 'acx-acct-meta' }, row.iface))))
            : null)
        : null,

      lan?.running === true
        ? h('p', { className: 'acx-note' }, t('lan.warn'))
        : null)
  )
}

/**
 * A day's usage, as the pack's token ledger reports it.
 *
 * The ledger buckets by day → channel → provider → account → model, and the
 * page only needs the day total plus a short per-channel breakdown. Nothing
 * here computes a figure the ledger did not already record: `inputTokens` and
 * `outputTokens` are sums the pack accumulates, so this panel cannot disagree
 * with it.
 *
 * @param {object} props
 * @param {(key: string) => string} props.t
 * @param {Array<{day: string, totals: object, channels: Array}>} props.days
 */
function UsagePanel({ t, days, totals }) {
  const [metric, setMetric] = useState('tokens')
  const recent = Array.isArray(days) ? days.slice(0, 14) : []
  if (recent.length === 0) {
    return h('section', { className: 'acx-usage' },
      h('div', { className: 'acx-usage-head' }, h('b', null, t('usage.title'))),
      h('p', { className: 'acx-note' }, t('usage.empty')))
  }

  // The ledger stores every counter on every bucket, so a missing field reads as
  // 0 rather than "unknown" — matching how the pack itself sums them.
  const num = value => (Number.isFinite(value) ? value : 0)
  const tokensOf = row => num(row?.inputTokens) + num(row?.outputTokens)
  /** A day row carries its figures under `.totals`; a totals object is flat. */
  const tokensOfDay = row => num(row?.totals?.inputTokens) + num(row?.totals?.outputTokens)
  const valueOf = row => (metric === 'tokens' ? tokensOfDay(row) : num(row?.totals?.requests))
  const peak = Math.max(1, ...recent.map(valueOf))
  const today = recent[0]
  // The week figure is the first seven rows of the same descending list; adding
  // it up here rather than in the host keeps the panel independent of how many
  // days the caller asked for.
  const week = recent.slice(0, 7).reduce((sum, row) => ({
    inputTokens: sum.inputTokens + num(row?.totals?.inputTokens),
    outputTokens: sum.outputTokens + num(row?.totals?.outputTokens),
  }), { inputTokens: 0, outputTokens: 0 })

  const stat = (value, label, hint) => h('div', { className: 'acx-usage-stat' },
    h('b', null, value),
    h('span', null, label),
    hint === undefined ? null : h('i', null, hint))

  return h('section', { className: 'acx-usage' },
    h('div', { className: 'acx-usage-head' },
      h('b', null, t('usage.title')),
      h('div', { className: 'acx-seg', role: 'group', 'aria-label': t('usage.title') },
        h('button', {
          type: 'button',
          'aria-pressed': metric === 'tokens' ? 'true' : 'false',
          onClick: () => setMetric('tokens'),
        }, t('usage.metricTokens')),
        h('button', {
          type: 'button',
          'aria-pressed': metric === 'requests' ? 'true' : 'false',
          onClick: () => setMetric('requests'),
        }, t('usage.metricRequests')))),

    // Today first, then the trailing window: the question "how much have I used"
    // is nearly always about today.
    h('div', { className: 'acx-usage-stats' },
      stat(kilo(tokensOfDay(today)), t('usage.todayTokens'), t('usage.todayInOut')
        .replace('{in}', kilo(num(today?.totals?.inputTokens)))
        .replace('{out}', kilo(num(today?.totals?.outputTokens)))),
      stat(String(num(today?.totals?.requests)), t('usage.todayRequests')),
      stat(kilo(tokensOf(totals)), t('usage.totalTokens'), t('usage.window').replace('{n}', String(recent.length))),
      stat(kilo(tokensOf(week)), t('usage.weekTokens'))),

    // A bar per day. Height is relative to the busiest day in the window, which
    // is what makes a spike legible; the numbers are in the tooltip so the bars
    // never have to be read to the pixel.
    h('div', { className: 'acx-usage-bars' },
      recent.slice().reverse().map(row => {
        const value = valueOf(row)
        const height = value === 0 ? 0 : Math.max(3, Math.round((value / peak) * 100))
        return h('div', {
          className: 'acx-usage-bar',
          key: row.day,
          title: `${row.day} · ${kilo(tokensOfDay(row))} tokens · ${num(row?.totals?.requests)} requests`,
        },
          h('i', { style: { height: `${height}%` } }),
          h('span', null, row.day.slice(5)))
      })),

    // The channels behind today's figure, so a surprising total has an owner.
    num(today?.totals?.requests) === 0 ? null : h('div', { className: 'acx-usage-chans' },
      (today.channels ?? []).map(channel => {
        const label = channel.channel === 'direct'
          ? (channel.providers?.[0]?.provider ?? 'direct')
          : channel.channel
        return h('div', { className: 'acx-usage-chan', key: channel.channel },
          h('span', { className: 'acx-usage-chan-name' }, label),
          h('span', { className: 'acx-usage-chan-val' }, kilo(tokensOf(channel.totals))),
          h('span', { className: 'acx-usage-chan-req' }, `${num(channel.totals?.requests)} ${t('usage.reqUnit')}`))
      })))
}

/**
 * The page.
 *
 * Reads the pack's mount state, then every channel's status in one RPC, then
 * the per-channel balances in parallel. The order matters: the status call is
 * what tells "no accounts yet" from "the pack never mounted", and only the
 * second has a reason worth printing.
 */
function Page(props) {
  const { ctx } = props
  // The section registration hands `locale` down beside `t`; folding it onto
  // the translate function here means every helper below can read `t.locale`
  // without each one taking a second argument. Without this fold, `t.locale` is
  // undefined and every relative date falls back to English.
  const t = props.locale === undefined ? props.t : Object.assign(x => props.t(x), { locale: props.locale })
  const { available, rpc } = useChannelRpc(ctx)
  const [statuses, setStatuses] = useState(undefined)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [pack, setPack] = useState(undefined)
  const [claiming, setClaiming] = useState(false)
  const [auto, setAuto] = useState(undefined)
  const [balances, setBalances] = useState(undefined)
  const [gateway, setGateway] = useState(undefined)
  const [copied, setCopied] = useState('')
  const [lan, setLan] = useState(undefined)
  const [lanBusy, setLanBusy] = useState(false)
  const [usage, setUsage] = useState(undefined)

  const notify = useCallback(err => {
    const reason = String(err?.message ?? err)
    setError(t('err.action').replace('{reason}', reason))
  }, [t])

  // The pack's mount state comes from this plugin's own route.
  useEffect(() => {
    let alive = true
    api('/status').then(payload => { if (alive) setPack(payload?.channels ?? { state: 'pending', error: '' }) })
      .catch(() => { if (alive) setPack({ state: 'failed', error: 'status route unreachable' }) })
    return () => { alive = false }
  }, [])

  const loadStatus = useCallback(async (attempt = 0) => {
    if (!available) return
    try {
      const value = await rpc('provider.status', { providers: CHANNEL_PROVIDERS.map(row => row.id) })
      setStatuses(value?.statuses ?? {})
      setReady(true)
      setError('')
    } catch (err) {
      // The pack imports asynchronously on a cold start; retry a bounded few
      // times before believing the failure.
      if (attempt < 4) { setTimeout(() => { void loadStatus(attempt + 1) }, 4000); return }
      setError(String(err?.message ?? err))
    }
  }, [available, rpc])

  useEffect(() => {
    void loadStatus()
    const timer = setInterval(() => { void loadStatus() }, 45_000)
    return () => clearInterval(timer)
  }, [loadStatus])

  const loadAuto = useCallback(async () => {
    if (!available) return
    try { setAuto((await rpc('usage.autoCheckin', {}, 30_000))?.autoCheckin ?? null) } catch { setAuto(null) }
  }, [available, rpc])
  useEffect(() => { void loadAuto() }, [loadAuto])

  const loadBalances = useCallback(async () => {
    if (!available) return
    const rows = await Promise.all(CHANNEL_PROVIDERS.map(async channel => {
      if (!CHANNEL_CREDITS[channel.id]) return { id: channel.id, total: null }
      try {
        const value = await rpc('credits.balances', { provider: channel.id }, 90_000)
        const known = (value?.accounts ?? []).filter(row => Number.isFinite(row?.balance?.total))
        return { id: channel.id, total: known.length === 0 ? null : known.reduce((sum, row) => sum + row.balance.total, 0) }
      } catch { return { id: channel.id, total: null } }
    }))
    const byId = {}
    for (const row of rows) byId[row.id] = row.total
    setBalances(byId)
  }, [available, rpc])
  useEffect(() => { void loadBalances() }, [loadBalances])

  // The pack runs an OpenAI-compatible gateway on loopback; these two calls are
  // its switch and its reading (address, key, servable models).
  const loadGateway = useCallback(async () => {
    if (!available) return
    try { setGateway((await rpc('gateway.getEnabled', {}, 30_000)) ?? null) } catch { setGateway(null) }
  }, [available, rpc])
  useEffect(() => { void loadGateway() }, [loadGateway])

  // The pack keeps a per-day token ledger on disk (`token-ledger.json`), so this
  // survives restarts and needs no schema of our own. 30 days is the widest the
  // panel shows; the pack keeps 90.
  const loadUsage = useCallback(async () => {
    if (!available) return
    try {
      const value = await rpc('usage.tokenLedgerHistory', { sinceDays: 30 }, 30_000)
      setUsage({ days: value?.history ?? [], totals: value?.totals ?? null })
    } catch { setUsage(null) }
  }, [available, rpc])
  useEffect(() => { void loadUsage() }, [loadUsage])

  const toggleGateway = async () => {
    try {
      const value = await rpc('gateway.setEnabled', { enabled: gateway?.enabled !== true }, 60_000)
      setGateway(value ?? null)
    } catch (err) { notify(err) }
  }

  // The LAN front door lives on this plugin's own host route, not the pack's
  // RPC: the pack has no idea the proxy exists.
  const loadLan = useCallback(async () => {
    try {
      const payload = await api('/status')
      setLan(payload?.lan ?? null)
    } catch { setLan(null) }
  }, [])
  useEffect(() => { void loadLan() }, [loadLan])

  const toggleLan = async enabled => {
    setLanBusy(true)
    try {
      const payload = await post('/lan', { enabled }, 20_000)
      setLan(payload ?? null)
    } catch (err) {
      setLan(current => ({ ...(current ?? {}), error: String(err?.message ?? err) }))
    } finally { setLanBusy(false) }
  }

  /**
   * Copy one labelled value and flash "copied" on its own button.
   *
   * The label, not a boolean, so pressing Copy on the key does not also flash
   * the base URL's button — with five copy targets on one panel that read as a
   * bug.
   */
  const onCopy = async (label, value) => {
    const ok = await copyText(value)
    setCopied(ok ? label : `${label}!`)
    setTimeout(() => setCopied(current => (current === label ? '' : current)), 1600)
  }

  const claimAll = async () => {
    if (claiming) return
    setClaiming(true); setError('')
    try {
      const results = []
      for (const channel of CHANNEL_PROVIDERS) {
        if (!CHANNEL_CREDITS[channel.id]?.claim) continue
        try {
          const value = await rpc('credits.claimAll', { provider: channel.id }, 180_000)
          const summary = value?.summary ?? value
          results.push({ id: channel.id, claimed: Number(summary?.claimed ?? 0), credit: Number(summary?.totalCredit ?? 0) })
        } catch { results.push({ id: channel.id, claimed: 0, credit: 0 }) }
      }
      const claimed = results.reduce((sum, row) => sum + row.claimed, 0)
      const credit = results.reduce((sum, row) => sum + row.credit, 0)
      setError(claimed > 0
        ? t('err.claimOk').replace('{count}', String(claimed)).replace('{credit}', kilo(credit))
        : t('err.claimNone'))
      void loadStatus(); void loadBalances(); void loadAuto()
    } finally { setClaiming(false) }
  }

  const toggleAuto = async () => {
    try {
      const value = await rpc('usage.autoCheckin', { enabled: auto?.enabled !== true }, 60_000)
      setAuto(value?.autoCheckin ?? null)
    } catch (err) { notify(err) }
  }

  // ── derived totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let accounts = 0
    let connected = 0
    let models = 0
    let creditSum = 0
    let creditKnown = false
    for (const channel of CHANNEL_PROVIDERS) {
      const status = statuses?.[channel.id]
      const enabled = status?.accounts?.enabled ?? 0
      accounts += enabled
      if (enabled > 0) connected += 1
      models += Math.max(0, (status?.models?.total ?? 0) - (status?.models?.disabled ?? 0))
      const total = balances?.[channel.id]
      if (Number.isFinite(total)) { creditSum += total; creditKnown = true }
    }
    return {
      channels: CHANNEL_PROVIDERS.length,
      connected,
      accounts,
      models,
      credit: creditKnown ? formatCredits(creditSum, {}) : null,
    }
  }, [statuses, balances])

  /**
   * The table's row order: channels you have accounts on come first.
   *
   * The page exists to answer "what am I signed into", and with thirteen rows a
   * fixed catalogue order buries the two or three that matter under ten empty
   * ones. Inside each group the catalogue order is kept, so a row never moves
   * between two visits for no reason — only when its account count actually
   * crosses zero. `sort` is stable, and the comparison is 0/1 rather than a
   * subtraction so ties cannot reorder by accident.
   */
  const orderedChannels = useMemo(() => {
    const rank = channel => ((statuses?.[channel.id]?.accounts?.enabled ?? 0) > 0 ? 0 : 1)
    return [...CHANNEL_PROVIDERS].sort((left, right) => rank(left) - rank(right))
  }, [statuses])

  // ── states ────────────────────────────────────────────────────────────────
  if (pack?.state === 'failed') {
    return h('div', { className: 'acx' },
      h('div', { className: 'acx-empty' }, t('err.packFailed').replace('{reason}', pack.error ?? '')))
  }
  if (!ready && statuses === undefined) {
    return h('div', { className: 'acx' },
      h('div', { className: 'acx-skel-stack' },
        h('div', { className: 'acx-skel', style: { width: '38%', height: 22 } }),
        h('div', { className: 'acx-skel', style: { width: '68%' } }),
        h('div', { className: 'acx-skel', style: { width: '100%', height: 92, marginTop: 6 } })))
  }
  if (!available) {
    return h('div', { className: 'acx' }, h('div', { className: 'acx-empty' }, t('err.noRpc')))
  }

  return h('div', { className: 'acx' },
    h('div', { className: 'acx-head' },
      h('div', { className: 'acx-head-main' },
        h('h2', { className: 'acx-title' }, t('title')),
        h('p', { className: 'acx-sub' }, t('sub'))),
      h('div', { className: 'acx-head-acts' },
        h(Button, { kind: 'primary', busy: claiming, disabled: claiming, onClick: claimAll },
          claiming ? t('act.claiming') : t('act.claimAll')),
        h(Button, { kind: 'quiet', disabled: claiming, onClick: () => { void loadStatus(); void loadBalances() } }, t('act.refresh')))),

    h(Figures, { t, totals }),

    auto === undefined || auto === null ? null : h('div', { className: 'acx-strip' },
      h(Switch, { checked: auto.enabled === true, onChange: () => void toggleAuto(), label: t('checkin.title') }),
      h('div', { className: 'acx-strip-main' },
        h('b', null, t('checkin.title')),
        h('span', null, auto.lastResult !== '' && auto.lastResult !== undefined
          ? t('checkin.last').replace('{result}', auto.lastResult)
          : t('checkin.hint'))),
      h('span', { className: 'acx-state' },
        h('span', { className: `acx-dot ${auto.running === true ? 'warn' : auto.ranToday === true ? 'ok' : ''}` }),
        auto.running === true ? t('checkin.running') : auto.ranToday === true ? t('checkin.ran') : t('checkin.off'))),

    h('div', { className: 'acx-table' },
      h('div', { className: 'acx-thead' },
        h('span', null),
        h('span', null, t('col.channel')),
        h('span', null, t('col.state')),
        h('span', { className: 'r' }, t('col.accounts')),
        h('span', { className: 'r' }, t('col.models')),
        h('span', { className: 'r' }, t('col.credit')),
        h('span', null)),
      orderedChannels.map(channel => h(ChannelRow, {
        key: channel.id,
        t,
        channel,
        status: statuses?.[channel.id],
        rpc,
        onError: notify,
        onChanged: () => { void loadStatus(); void loadBalances() },
      }))),

    gateway === undefined || gateway === null ? null : h(ApiPanel, {
      t,
      gateway,
      lan,
      lanBusy,
      onToggle: () => void toggleGateway(),
      onToggleLan: enabled => void toggleLan(enabled),
      copied,
      onCopy,
    }),

    usage === undefined || usage === null ? null : h(UsagePanel, {
      t,
      days: usage.days,
      totals: usage.totals ?? {},
    }),

    error === '' ? null : h('p', { className: 'acx-note' }, error))
}
