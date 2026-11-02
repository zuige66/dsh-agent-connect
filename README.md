# dsh-agent-connect

把十三个 AI agent 账号渠道接进 DeepSeek Harness。装上之后，设置里多一页 **Agent 渠道**：
谁登录了、每个账号还剩多少额度、哪些模型该出现在模型选择器里，以及一个可以直接拿去用的
OpenAI 兼容接口。

```
设置 → Agent 渠道
├─ 渠道页签
│   ├─ 一张表，十三行    接入状态 · 账号数 · 模型数 · 额度
│   └─ 每日自动签到      开关 + 上次结果
├─ 模型页签              每个渠道单独挑哪些模型显示
├─ API 接口              地址 · 密钥 · 模型清单 · curl
│   └─ 局域网共享        给同网络的其它设备用
└─ 用量                  今日 / 近 7 天 / 合计 Token，按天柱状图
```

支持的渠道：

| 渠道 | 归属 | 说明 |
| --- | --- | --- |
| CodeArts | 华为云 | DeepSeek · GLM · openPangu |
| WorkBuddy 国内版 | 腾讯 · copilot.tencent.com | CodeBuddy 同一端点 |
| WorkBuddy 国际版 | 腾讯 · workbuddy.ai | 独立账号与积分体系 |
| LobsterAI | 有道 | 每日签到 |
| Qoder / Qoder 中国版 | 阿里系 | 每日 Credits |
| TRAE | 字节 | 手机号登录 |
| Cline | Cline | 账号免费额度 |
| Loomy | 讯飞 | 微信扫码 / 短信验证码 |
| Raccoon | 商汤 | 手机号登录 |
| MiniMax Code | MiniMax | 设备码 + PKCE |
| ZCode | 智谱 | 浏览器登录 |
| Gemini | Google Code Assist | 本地回调 OAuth |

---

## 安装

需要 DeepSeek Harness 0.1.5 或更新，Node 22.19+ / 24+。

### 从 GitHub 安装

```bash
dsh plugin --profile desktop add zuige66/dsh-agent-connect
```

`--profile` 换成你实际用的 profile 名（`desktop`、`web`、`headless` 等）。装完重启应用。

### 从本地目录安装

```bash
git clone https://github.com/zuige66/dsh-agent-connect.git
dsh plugin --profile desktop add /绝对路径/dsh-agent-connect
```

或者在 profile 的 `package.json` 里手写：

```json
{
  "dependencies": {
    "dsh-agent-connect": "link:D:/path/to/dsh-agent-connect"
  },
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-agent-connect"]
    }
  }
}
```

然后在该 profile 目录执行 `pnpm install`，重启应用。

### 卸载

```bash
dsh plugin --profile desktop remove dsh-agent-connect
```

> **不要和 `dsh-our-free-model` 同时安装。** 两者内置同一份渠道包，会争用同一个
> RPC 路径和网关端口。本插件检测到冲突会主动让位，但同时装只有一个真正工作。

---

## 使用

### 接入一个渠道

1. 打开 **设置 → Agent 渠道**
2. 找到要用的渠道，点 **添加账号**
3. 浏览器会弹出该平台的登录页，正常登录
4. 回到页面，几秒内自动变成「已接入」

不需要复制 token，也不需要填 API Key。凭据只写入本机凭据库，页面拿不到明文。

一个渠道可以挂多个账号：再点一次「添加账号」即可。多账号之间会自动负载，优先用
**快过期的额度**，用完才用永久额度；遇到限流会自动换下一个账号重试。

### 管理账号

点开任意一行，能看到该渠道下的账号列表：

| 操作 | 作用 |
| --- | --- |
| 测试 | 发一次真实请求，验证这个账号还能不能用 |
| 续期 | 刷新凭证 |
| 启用 / 停用 | 停用后不参与选号，但凭据保留 |
| 移除 | 删除账号及其凭据 |

「测试」失败时会显示具体原因，例如「仍受限：429」或「凭证已过期」。

### 领取额度

顶部 **领取全部积分** 一次跑完所有支持签到的渠道。单个渠道也能在自己的展开区里单独领。

支持签到的渠道会显示领取按钮；不支持的（如 WorkBuddy 国际版）不会显示。

### 每日自动签到

**默认开启。** 开着 DSH 就会每天自动把所有渠道领一遍，插件每小时检查一次
「今天签到了吗」，没签就补上。所以跨午夜、睡眠唤醒、换时区都能补到。

结果写在页面顶部，也能在这里关掉：

```json
// ~/.dsh/channel-pack/auto-checkin.json
{ "lastDate": "2026-11-02", "lastResult": "2 个渠道：3 个账号领取成功（+300积分）" }
```

### 控制模型可见性

页面顶部有两个页签：**渠道** 和 **模型**。切到 **模型**，每个已接入的渠道一组开关，
逐个勾选想让模型选择器显示哪些模型。

- 每个渠道独立管理，互不影响
- 顶部显示「显示 N / M」，一眼看出关掉了几个
- 每组都有 **全部打开** / **全部关闭**
- 关掉的模型不会从账号里消失，只是不再列在模型选择器里，随时可以打开

适合场景：某个渠道有几十个模型，你只用其中两个，关掉其余的能让选择器清爽很多。

> 页签选择会记住，下次打开还在同一页。

### 用 OpenAI 兼容接口

渠道包自带一个 OpenAI 兼容网关。**API 接口** 分区里能拿到三样东西：

| 项 | 值 |
| --- | --- |
| Base URL | `http://127.0.0.1:8326/v1` |
| API Key | 点「显示」查看，点「复制」取走 |
| 模型清单 | 可服务的模型 id，可全部复制 |

任何支持自定义 base URL 的客户端都能用：

```bash
curl http://127.0.0.1:8326/v1/chat/completions \
  -H "authorization: Bearer <你的 KEY>" \
  -H "content-type: application/json" \
  -d '{"model":"buddy/deepseek-v4.1-flash","messages":[{"role":"user","content":"hi"}]}'
```

模型 id 形如 `渠道/模型名`，例如 `buddy/deepseek-v4.1-flash`、`trae/DeepSeek-V4-Flash`。
完整清单在页面上，或：

```bash
curl http://127.0.0.1:8326/v1/models -H "authorization: Bearer <你的 KEY>"
```

**密钥默认打码显示**，因为它能调用这台机器上的所有模型、花掉所有渠道的额度。

### 给其它设备用（局域网）

默认只有本机能连（`127.0.0.1`）。想让手机、另一台电脑也能用：

1. 在 **API 接口 → 局域网共享** 打开开关
2. 复制显示的局域网地址，例如 `http://192.168.1.102:18326/v1`
3. 在其它设备上填这个地址 + 同一个 Key

开关默认关闭是有意的：一装上就在局域网开端口是意外行为，而它转发的是能花钱的凭证。

限制：

- 只转发 `/v1/*`，其余路径返回 404
- 只监听私有网段（`127/8`、`10/8`、`172.16/12`、`192.168/16`、`169.254/16`），拒绝绑定公网地址
- 鉴权仍由网关自己做，转发层不加第二套凭据

> ⚠️ **拿到地址和 Key 的人能用掉你所有渠道的额度。** 只在可信网络里开。

### 看用量

**用量** 分区显示每天花了多少：

- 今日 Token（输入 / 输出分别列出）、今日请求数
- 近 7 天、合计
- 14 天柱状图，悬停看当天精确数字
- 当天各渠道的占比

数据来自渠道包按天记录的账本（`~/.dsh/channel-pack/token-ledger.json`），保留 90 天，
重启不丢。

> 注意区分：这里的「Token」是模型用量，顶部的「额度」是各平台自己的积分余额。
> 两者单位不同，不混在一起算。

---

## 常见问题

**登录页没弹出来**

浏览器拦截了弹窗。页面会显示一个可点击的登录链接，或者点「打开登录页」让系统浏览器打开。

**测试失败但账号看着正常**

多半是限流（429）而不是登录过期。失败信息会写出具体原因和恢复时间。等一会儿再试，
或者点「续期」。

**某个渠道显示「无签到接口」**

那个平台没有签到接口（如 WorkBuddy 国际版），只能看余额，不能领。正常。

**端口 8326 被占用**

渠道包的网关端口可以用环境变量改：

```bash
DSH_OPENAI_GATEWAY_PORT=8327 dsh --profile desktop
```

改了之后页面上会显示新端口，局域网转发也会自动跟上。

**关掉 DSH 后接口还能用吗**

不能。它是 DSH 进程里跑的服务，DSH 一关就停。要长期提供，得用反向代理、隧道或云主机。

---

## 开发

### 环境

```bash
git clone https://github.com/zuige66/dsh-agent-connect.git
cd dsh-agent-connect
node --version   # 需要 22.19+ 或 24+
```

运行时零依赖，不需要 `npm install`。测试和预览脚本只用到 Node 内置模块。

### 目录结构

```
index.js                      Host 半身
├─ 挂载渠道包（vendor/channel-pack/pack.js）
├─ 三条 HTTP 路由 + 信任围栏
├─ 局域网转发器生命周期
└─ 每日签到 tick

client.js                     浏览器半身（生成文件，不要手改）
src/
├─ ui.js                      页面逻辑与组件
├─ page.css                   页面样式
├─ channels.data.js           十三个渠道定义（提取生成，不要手改）
├─ lan-gateway.js             局域网转发器
├─ trust.js                   请求信任围栏
└─ open-external.js           调系统浏览器

vendor/channel-pack/          上游渠道包（不要改）
scripts/                      构建、测试、预览
locale/                       插件列表里的名称与简介
cordis.patch.yml              bundle 挂载声明
```

### 构建

`client.js` 是生成文件，由 `src/` 拼装而来：

```bash
node scripts/build-client.mjs
```

改了 `src/ui.js`、`src/page.css` 或 `src/channels.data.js` 之后都要重跑。

脚本会检查两件会导致运行时报错的事：`page.css` 里不能有反引号（它被塞进模板字面量），
`ui.js` 里不能有 `import`（整个 bundle 是单文件）。

### 测试

```bash
node scripts/smoke-client.mjs   # 浏览器半身：用桩 React 求值整个 bundle
node scripts/smoke-host.mjs     # Host 半身：真实 node:http 请求
node scripts/smoke-lan.mjs      # 局域网转发器：真实上游 + 真实请求
```

三个脚本都是自包含的，不需要跑起 DSH，也不需要真账号。

`smoke-client.mjs` 断言：只注册一个设置页、语言包覆盖所有被读的键、13 个渠道齐全、
积分格式化不把百分比印成 token 数、CSS 里没有渐变/阴影/毛玻璃、客户端调用的 HTTP 路径
与 `index.js` 实际提供的路由一致。

`smoke-host.mjs` 覆盖：状态查询、方法拒绝、非法 URL、畸形 body、超大 body、未知路径、
三种信任围栏拒绝、单实例守卫的两种让位路径、签到 tick 的三种场景（已签到只读、
未签到读+写、开关关只读）。

`smoke-lan.mjs` 覆盖：`/v1/*` 转发、请求体完整、非 `/v1/*` 拒绝、上游 401 透传、
伪造 Host 无效、公网地址拒绝绑定。

### 预览页面

不用真账号就能看页面效果：

```bash
node scripts/preview.mjs --shot
```

会在 `.preview/` 生成 HTML 和两张截图（桌面 / 手机），用的是内置的假数据。
改了样式之后这是最快的验证方式。需要 Chrome 或 Edge。

### 关键约定

**Host 半身只硬依赖 `llm`。**

`export const inject = ['llm']` 是这个插件唯一声明的硬依赖。其余服务全部走
`ctx.inject([...], cb)` 的独立 fiber 或 `ctx.get()` 的机会式读取：

- `credentials` / `commands` / `llm` → 渠道包挂载
- `webServer` → HTTP 路由
- `connection` → 渠道操作与签到 tick

这样没有 web server 的 composition（headless）仍然能加载模型车道，只是没有设置页。

**读服务要用 scoped context。**

`ctx.get('x')` 读的是根上下文；在 `inject` 回调里要读 `scoped.get('x')`。
两者看到的东西不一样，用错了会得到 `undefined` 而且不报错。插件里 `optionalIn()`
就是干这个的。

**渠道操作走 RPC，不走自己的路由。**

登录、账号列表、模型开关、领积分全部走宿主 `connection` 的 RPC
（`/api/channel-pack`），由渠道包自己注册。这样凭据只存在于宿主凭据库里，
本插件不需要为它们写鉴权。

本插件只有三条路由：

| 路由 | 用途 |
| --- | --- |
| `POST /api/agent-channels/open-external` | 弹窗被拦截时用系统浏览器打开登录页 |
| `GET /api/agent-channels/status` | 渠道包挂载状态 + 局域网状态 |
| `POST /api/agent-channels/lan` | 开关局域网转发 |

**信任围栏不能省。**

插件的 `/api/agent-channels` 前缀比内核的 `/api` 长，`webServer` 按最长前缀派发，
所以这些路由会跑在 `connection` 服务自己的准入检查之前。`src/trust.js` 补上这一层：
优先复用宿主的 `connection` 服务，缺失时退回结构化检查（回环 Host、拒绝跨站、
Origin/Referer 与 Host 一致）。

### 加一个渠道

渠道实现来自上游渠道包，不在本仓库里。如果上游已经支持、只是列表里没有：

1. 用上游的 client.js 重新提取定义：

   ```bash
   node scripts/extract-data.mjs <上游 client.js 路径>
   ```

2. 检查 `src/channels.data.js` 里三个表都加上了（`CHANNEL_ICONS`、
   `CHANNEL_PROVIDERS`、`CHANNEL_CREDITS`）
3. 在 `scripts/smoke-client.mjs` 的 `EXPECTED` 数组里加 id
4. 重新构建 + 跑测试

提取脚本会断言表和 id 数量对得上，写错了会直接报错而不是生成半成品。

### 改样式

只动 `src/page.css`。所有颜色取自宿主的 `--dsw-alias-*` 变量，所以明暗主题自动跟随，
不需要写两套。

两条约束：

- **不要用渐变、阴影、毛玻璃。** `smoke-client.mjs` 会检查。
- **颜色只用在数据上。** 页面里唯一有颜色的是额度数字，按钮和导航都是墨色。

改完 `node scripts/preview.mjs --shot` 看一眼两个宽度。

### 发布

改了 `package.json` 的 `version`，提交，打 tag：

```bash
git tag v1.0.1
git push origin main --tags
```

别人用 `dsh plugin add zuige66/dsh-agent-connect#v1.0.1` 就能锁定版本。

---

## 许可证

MIT。

渠道实现来自 [`dsh-codearts-auth`](https://gitee.com/iJetLi/deepseek-harness-codearts)（MIT），
经 [`dsh-our-free-model`](https://github.com/Ebony-Vinyl/dsh-our-free-model) 打包为
`vendor/channel-pack/pack.js`。出处与许可详见 `vendor/channel-pack/NOTICE.md`。

## 免责声明

个人自用工具，调用各平台官方客户端同款接口。自动化操作可能不符合平台服务条款，
账号风险自负。请勿用于商业用途或大规模滥用。
