# Preact Web 模板

用于移动端落地页和协议页面的 pnpm 单仓库。目录及根包名称保留 `svelte-template`，页面技术栈为 Preact 10 + Vite 8，项目不依赖 Svelte/SvelteKit。

## 项目结构

```text
apps/
  landing/       # Preact CSR；原生 CSS，px 自动转 rem
  agreement/     # 静态 HTML 正文；TypeScript 更新局部字段
packages/
  api/           # @packages/api：公共业务接口、类型、配置数据校验
  request/       # @packages/request：请求、错误、超时、取消与浏览器适配
tooling/         # 共享 Vite/PostCSS 配置、兼容目标
tests/          # 请求与样式单元测试、浏览器测试
scripts/        # 构建结果检查
```

两个应用分别构建、分别部署。公共包直接导出 TypeScript 源码，由使用它的应用编译；不发布到 npm，不依赖 Preact。

## 启动

使用 Node.js 24、pnpm 10。

```powershell
Set-Location C:\Users\revfanc\Documents\JSpace\svelte-template
pnpm install --frozen-lockfile
pnpm dev
```

- 落地页：http://127.0.0.1:5173/
- 协议页：http://127.0.0.1:5174/agreement/
- `pnpm dev:landing` / `pnpm dev:agreement` 可以单独启动。

本地落地页将 `/agreement/` 代理到协议应用。点击协议链接时需要两个应用同时运行。

## test / prod 环境

```powershell
pnpm build:test
pnpm build:prod
pnpm preview:test
# 或 pnpm preview:prod
```

| 应用      | test 输出                | prod 输出                | 默认部署路径 |
| --------- | ------------------------ | ------------------------ | ------------ |
| landing   | apps/landing/dist/test   | apps/landing/dist/prod   | /            |
| agreement | apps/agreement/dist/test | apps/agreement/dist/prod | /agreement/  |

预览端口为 4173 和 4174。`test` 与 `prod` 都通过 `vite build` 使用生产优化；mode 选择配置环境，不能设置 `NODE_ENV=test`。

每个应用分别提供 `.env.test` / `.env.prod`，本地覆盖使用 `.env.test.local` / `.env.prod.local`。带 `VITE_` 的变量会进入浏览器产物，只能存放公开配置。

| 变量               | 作用                                        |
| ------------------ | ------------------------------------------- |
| VITE_APP_ENV       | 必须与 mode 一致：test / prod               |
| VITE_BASE_PATH     | 应用静态资源路径，默认 `/` 或 `/agreement/` |
| VITE_API_BASE_URL  | 接口前缀；空值使用应用的 BASE_URL           |
| VITE_CONFIG_PATH   | 相对于接口前缀的配置接口路径                |
| VITE_AGREEMENT_URL | 落地页中的协议链接，可改为独立协议域名      |

**目前两个环境都请求各应用 public/site-config.json 的演示数据，未连接实际后端。** 对接时修改 API 前缀与接口路径，并在 `packages/api/src/index.ts` 中按真实后端契约调整类型、字段校验和业务状态码处理。示例不会自行假定后端使用 `{code,data,message}` 响应格式。

生产部署时分别将两个输出目录映射到对应路径；本地 Vite 代理不会成为生产服务器。也可以将协议应用部署到独立域名，将其 BASE_PATH 改为 `/`，并修改落地页的 AGREEMENT_URL。服务器应启用文本资源压缩，并让 HTML 及时更新、带内容哈希的资源长期缓存。

## 兼容性

构建目标集中在 `tooling/compatibility.ts`：Chrome 49+、iOS 10+、Safari 10+。需要降低目标时，同步调整 JavaScript 与 CSS 目标，重新审查依赖并验证目标内核。

- `@vitejs/plugin-legacy` 输出现代包和 SystemJS legacy 包，自动补齐旧包所用的 ES API。现代包使用插件默认支持范围；具备 ESM 但不满足现代检测的浏览器会回落到 legacy 包。
- 浏览器请求优先使用支持取消的原生 fetch；旧浏览器使用 whatwg-fetch 的 XHR 实现和 AbortController 兼容实现。
- AbortController 必须从 `abort-controller/dist/abort-controller.js` 导入。该包默认的 `browser` 入口只转发已有原生对象，不能补齐旧浏览器。
- HTTP 请求头使用普通对象，避免原生 Headers 与 polyfill Headers 的互操作问题。
- CSS 使用常规布局与 Autoprefixer，示例避免 Flex gap、CSS Grid、CSS 变量、`:where()`、`@layer` 等较新的能力。协议正文完全不依赖脚本渲染。
- 开发服务器面向现代开发浏览器；验收旧内核必须使用构建后的 preview 或部署产物。

**构建目标不等于真实设备验收。** 自动测试在当前 Chrome 中验证现代入口、强制 legacy 入口以及缺失 fetch/Promise/AbortController 的情况；不模拟 Chrome 49 的 JS 引擎或 iOS 10 的 WebKit。2016 年出厂的设备也可能使用不同或升级后的内核，最终应按实际浏览器/WebView 版本确认。

框架本身的体积不等于整个应用体积：请求兼容层、业务代码和 legacy polyfills 都会增加下载量。构建日志分别给出各包的原始和 gzip 大小。

## px 自动转 rem

落地页沿用原生 CSS + PostCSS 方案，不安装 Tailwind。375px 设计稿对应根字号 37.5px；根字号随视口按 `10vw` 缩放，540px 及以上固定为 54px，内容最大宽度 540px。

```css
.example {
  width: 150px; /* 产物：4rem */
  padding: 15px; /* 产物：0.4rem */
  border: 1px solid; /* 保留 1px */
}
```

只转换 CSS 声明，不转换 JS 内联样式。`html`、包含 `.no-rem` 的选择器、媒体查询条件、小于 2px 的尺寸不转换；单个固定尺寸也可使用大写 `PX`（PostCSS 约定）。根字号放在 HTML 头部，避免启动脚本执行前后的布局跳动。协议项目使用正常字号和响应式宽度，不进行整页 rem 缩放。

## 公共请求与 API

```ts
import { createApi } from '@packages/api';
import { createBrowserRequestClient } from '@packages/request/browser';

const client = createBrowserRequestClient({
  baseURL: '/api',
  timeoutMs: 10000,
});
const api = createApi(client, { configPath: 'config' });
const config = await api.getConfig();
```

`client.request<T>(path, options)` 支持 method、query、json、headers、signal、timeoutMs、responseType。path 按相对接口路径拼接，包含主机名的部分应放到 baseURL。默认解析 JSON，空响应、204、205、HEAD 返回 undefined；`responseType: 'text'` 返回文本。

`RequestError.kind` 区分 http / network / timeout / abort / parse。默认超时 10 秒，0 表示关闭超时；超时覆盖响应正文读取并取消底层传输。组件需要主动取消时使用 `createBrowserAbortController()`。默认 credentials 为 same-origin；跨域携带 Cookie 需显式设置 include 并由服务端正确配置 CORS。

兼容请求层只承诺常规 JSON/文本请求，不提供 Streams、keepalive 等 fetch 高级特性；不自动重试写请求。框架之外的环境可使用 `@packages/request` 的核心入口，并按运行环境注入 fetch 与 AbortController。

## 验证

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build:test
pnpm check:build test
pnpm test:browser
pnpm build:prod
pnpm check:build prod
$env:BUILD_MODE = 'prod'
pnpm test:browser
Remove-Item Env:BUILD_MODE
```

浏览器测试默认使用本机 Chrome；若使用 Edge，设置 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`。测试会自动启动并关闭 4173/4174 预览服务，运行时请保持端口空闲。

`check:build` 检查环境标记、双入口、legacy 脚本的 ES2015 语法解析、基本 CSS 约束和协议静态正文；它不能替代全部 Web API、CSS 或真实设备测试。

## 后续开发边界

- 页面组件与状态留在各应用，公共接口留在 `packages/api`，网络行为留在 `packages/request`。
- 当前落地页只有一个 CSR 入口，没有额外引入路由库；增加多路由时一起验证路由库和部署回退规则。
- 协议内容只是模板占位，上线前替换为正式审定文本。动态字段通过 textContent 更新，不插入接口返回的 HTML。
- Vitest 固定为 4.1 稳定版，TypeScript 固定在 ESLint 支持的 6.0 范围；升级工具时需运行完整检查。

参考：[Preact 浏览器支持](https://preactjs.com/about/browser-support/)、[Vite legacy 插件](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)、[fetch polyfill](https://github.com/JakeChampion/fetch)、[px 转 rem](https://github.com/cuth/postcss-pxtorem)。
