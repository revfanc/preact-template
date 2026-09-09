# Preact Web 模板

用于移动端落地页和协议页面的 pnpm 单仓库。目录及根包名称保留 `svelte-template`，页面技术栈为 Preact 10 + Vite 8，项目不依赖 Svelte/SvelteKit。

## 项目结构

```text
apps/
  landing/       # Preact CSR + preact-iso 文件路由；原生 CSS，px 自动转 rem
  agreement/     # 静态 HTML 正文；TypeScript 更新局部字段
packages/
  api/           # @packages/api：公共业务接口、类型、配置数据校验
  request/       # @packages/request：请求、错误、超时、取消与浏览器适配
  ui/            # @packages/ui：函数式 Toast / Loading，原生 DOM 实现
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

## landing 目录约定

```text
apps/landing/src/
  main.tsx                      # HTML 脚本入口，先加载兼容处理
  app.tsx                       # 应用组件、路由加载状态
  polyfills.ts                  # 浏览器兼容处理
  style.css                     # 基础重置、字体和全局交互样式
  router/                       # 文件路由解析和懒加载注册
  pages/
    index.tsx                   # 首页路由组件
    index.module.css
    result/index.tsx
    result/index.module.css
    detail/[id]/index.tsx
    detail/[id]/index.module.css
    _404/index.tsx
    _404/index.module.css
  components/
    page-load-error/index.tsx
    page-load-error/index.module.css
  hooks/
    use-route-loading.ts        # 路由加载状态及卸载清理
    use-site-config.ts          # 配置加载、重试和卸载取消
    use-greeting.ts             # 欢迎语状态与提交逻辑
  api/index.ts                  # 当前应用的请求配置和公共 API 接入
```

- `pages` 放路由组件及配套样式，负责页面布局和路由参数适配；不强制再拆完整 View。
- `components` 放提取出来的 UI 组件，每个组件使用独立文件夹与 `index.tsx`。
- `hooks` 放状态、数据加载、校验和提交逻辑；公共接口继续定义在 `packages/api`，网络行为留在 `packages/request`。
- 页面及组件使用 `index.module.css`，照常写 px，由 PostCSS 转换为 rem。全局样式只保留应用级基础规则。

活动页例如 `pages/p1/p2026090901/index.tsx`、`pages/p1/p2026090901/result/index.tsx`。需要拆分时，专用组件放 `components/p1/p2026090901/<组件名>/index.tsx`，专用逻辑放 `hooks/p1/p2026090901/use-activity.ts`；公共组件和 hook 放各自目录下。仅在实际需要时建立对应目录，不为每个活动生成空目录，也不引入 modules/features/shared 层。

## 约定式路由

落地页使用 `preact-iso`，Vite 通过 `import.meta.glob` 扫描 `apps/landing/src/pages`。新增或删除页面时自动更新路由，每个页面使用 `export default` 导出 Preact 组件，不需要手动注册。页面按需加载，首次加载及加载失败都有提示。

| pages 下的文件                    | 路径                     | 说明                                    |
| --------------------------------- | ------------------------ | --------------------------------------- |
| `index.tsx`                       | `/`                      | 首页                                    |
| `result/index.tsx`                | `/result`                | 普通页面                                |
| `p1/p2026090901/index.tsx`        | `/p1/p2026090901`        | 活动页面                                |
| `p1/p2026090901/result/index.tsx` | `/p1/p2026090901/result` | 活动结果页                              |
| `detail/[id]/index.tsx`           | `/detail/:id`            | 动态参数                                |
| `docs/[...path]/index.tsx`        | `/docs/:path+`           | 匹配至少一级，参数为 `a/b` 这样的字符串 |
| `_404/index.tsx`                  | 未匹配路径               | 全局 404 页面                           |

当前提供首页、结果页、动态详情页和 404 示例，活动路径按业务新增。静态路径优先于同级动态参数，最后匹配捕获剩余路径的页面及 404。`detail/[id]/index.tsx` 与 `detail/[slug]/index.tsx` 等冲突在启动和构建时会报错。

**只扫描 `index.tsx` 路由入口**，其他文件不会生成路由。除根目录 `_404/index.tsx` 外，以 `_` 开头的目录不生成路由，也不会被扫描入口打包。普通路径段使用字母、数字、连字符或下划线；参数目录写为 `[id]`，剩余路径写为最后一级的 `[...path]`。目录决定 URL 层级，共享布局在组件中显式组合。

```tsx
import { useLocation, useRoute } from 'preact-iso';

export default function DetailPage() {
  const { params } = useRoute();
  const { query, route } = useLocation();

  return (
    <main>
      <p>
        编号：{params.id}，来源：{query.from}
      </p>
      <button onClick={() => route(`${import.meta.env.BASE_URL}result`)}>
        跳转结果页
      </button>
      <button onClick={() => route(import.meta.env.BASE_URL, true)}>
        替换为首页
      </button>
    </main>
  );
}
```

站内链接也可以直接写 ``<a href={`${import.meta.env.BASE_URL}result`}>查看结果</a>``。页面路径会自动添加 `VITE_BASE_PATH` 前缀；链接和程序跳转通过 `import.meta.env.BASE_URL` 保持前缀一致。浏览器前进、后退使用原生 History 行为。

跨项目跳协议页时使用 `window.location.assign(agreementURL)`；若使用 `<a>`，像首页示例一样加 `onClick={(event) => event.stopPropagation()}`，保留浏览器完整导航，避免协议 URL 被落地页路由接管。

生产部署使用 History 路径：**落地页深层 URL 需要回退到落地页的 `index.html`**。协议项目和静态资源应先独立匹配，不能把协议请求回退到落地页。Vite 开发与预览服务已提供 SPA 回退，生产服务器需要单独配置。

路由沿用 Chrome 49 / iOS 10 构建目标。legacy 构建按使用补齐 URL、URLSearchParams、Object.fromEntries 等 API；入口的 `polyfills.ts` 为普通 DOM 链补齐链接点击所需的 `Event.composedPath`，优先使用旧 Chrome 的 `event.path`。未来若引入 Shadow DOM，需单独验证事件路径。自动测试验证缺失这些 API 时的构建产物，不代表已完成旧内核实机验收。

参考：[preact-iso](https://preactjs.com/guide/v10/preact-iso/)、[Vite Glob Import](https://vite.dev/guide/features.html#glob-import)。

## Toast / Loading

应用在 dependencies 中声明 `"@packages/ui": "workspace:*"`，即可直接调用。样式随包自动引入，不需要挂载组件或 Provider，也不依赖 Preact。

```ts
import { toast, loading } from '@packages/ui';

toast('操作成功'); // 默认 2 秒后淡出，替换当前提示
toast('请稍后重试', { duration: 3000 });

const closeToast = toast('持续提示', { duration: 0 });
closeToast();

const closeLoading = loading('正在提交…'); // 不传文案时显示“加载中…”
try {
  await submit(); // 应用自己的异步操作
  toast('提交成功');
} finally {
  closeLoading();
}
```

- 返回的关闭函数可以重复调用，只影响本次提示。组件卸载时也应关闭它持有的 Loading。
- 连续 Loading 调用支持多个并发操作；显示最近一次仍在进行的操作文案，所有调用都关闭后才消失，不设置自动超时。
- Toast 与 Loading 共用一个居中的 DOM 提示框，同时最多显示一个。Toast 替换当前 Loading 组；新的 Loading 替换 Toast。被替换的提示不会恢复，旧关闭函数或计时器不会关闭新提示；替换提示不会取消业务请求。
- Loading 延迟 120ms 显示，快速完成时不闪现；显示后至少停留 240ms，再用 140ms 淡出。连续任务复用提示框与旋转图标，宽高由内容决定；文案或提示类型变化时，按实测尺寸用 180ms 平滑过渡，结束后恢复自动尺寸。长文案按视口宽度换行。Toast 使用随文字撑开的紧凑提示条，默认展示 2000ms 后淡出，`duration: 0` 由调用方关闭。
- 提示只展示纯文本，不抢焦点、不锁滚动；提交防重等交互由业务自行处理。尊重系统减少动态效果设置，关闭淡入淡出和旋转动画。
- 在浏览器 `document.body` 就绪后调用。UI 使用固定 px 尺寸，通过现有 `.no-rem` 约定避免落地页自动转 rem，让协议页与落地页的提示大小一致。

落地页的欢迎语提交演示 Toast，两个应用的配置请求演示 Loading；请求包本身不自动触发 UI。

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

- 页面组件与状态留在各应用，公共接口留在 `packages/api`，网络行为留在 `packages/request`，基础提示留在 `packages/ui`。
- 落地页路由及页面放在应用内，`packages/api` 与 `packages/request` 不依赖路由；协议项目保持静态 HTML。
- 协议内容只是模板占位，上线前替换为正式审定文本。动态字段通过 textContent 更新，不插入接口返回的 HTML。
- Vitest 固定为 4.1 稳定版，TypeScript 固定在 ESLint 支持的 6.0 范围；升级工具时需运行完整检查。

参考：[Preact 浏览器支持](https://preactjs.com/about/browser-support/)、[Vite legacy 插件](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)、[fetch polyfill](https://github.com/JakeChampion/fetch)、[px 转 rem](https://github.com/cuth/postcss-pxtorem)。
