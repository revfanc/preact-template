# preact-template

用于移动端落地页和协议页面的 pnpm 单仓库。落地页使用 Preact 10 + Vite 8，协议使用 Astro 7 静态生成。

## 项目结构

```text
apps/
  landing/       # Preact CSR + preact-iso 文件路由；原生 CSS，px 自动转 rem
  agreement/     # Astro 静态多页面；普通脚本更新局部字段
packages/
  api/           # @packages/api：公共业务接口、类型、配置数据校验
  request/       # @packages/request：请求、错误、超时、取消与浏览器适配
  browser/       # @packages/browser：当前页面的 History 返回拦截与回调栈
  feedback/      # @packages/feedback：函数式 Toast / Loading；独立入口提供 Preact Modal
  components/    # @packages/components：跨应用复用的 Preact 展示组件
  theme/         # @packages/theme：标准 CSS 主题默认值，构建时使用
tooling/         # 共享 Vite/PostCSS 配置、兼容目标
tests/          # 请求与样式单元测试、浏览器测试
scripts/        # 构建结果检查
```

两个应用分别构建、分别部署。公共包直接导出 TypeScript 源码，由使用它的应用编译；不发布到 npm。`components` 通过 peer dependency 使用应用的 Preact；`api`、`request` 与 `feedback` 的 Toast/Loading 入口不依赖 Preact；只有 `@packages/feedback/modal` 需要 Preact。

`@packages/browser` 提供原生 History 返回拦截：同页注册共用一条保护记录，按栈顶分发，`done()` 等待恢复后自动移除当前层，有下层则继续保护，最后一层完成才回到基础记录。刷新复用保护记录，允许截断前进链。Landing 首页的“体验返回拦截”进入 `/landing/browser`，演示添加/移除注册、栈顶弹窗、逐层完成和异步注销后导航；普通首页及其他页面不自动注册。详见 [Browser 接入与边界](packages/browser/README.md)。浏览器测试会额外在 4175 端口启动独立验收页面。

## 启动

使用 Node.js 24、pnpm 10。

```powershell
Set-Location C:\Users\revfanc\Documents\JSpace\preact-template
pnpm install --frozen-lockfile
pnpm dev
```

- 落地页：http://127.0.0.1:5173/landing/
- 协议页：http://127.0.0.1:5174/agreement/
- `pnpm dev:landing` / `pnpm dev:agreement` 可以单独启动。

开发时，从落地页访问 `/agreement/` 会跳转到同主机的协议端口 5174，让 Astro 的开发脚本和样式始终来自协议服务，避免与落地页的 `/src/style.css`、`/@vite/client` 冲突。预览服务仍将 `/agreement/` 代理到协议应用，模拟正式部署路径。点击协议链接时需要两个应用同时运行。

## test / prod 环境

```powershell
pnpm build:test
pnpm build:prod
pnpm preview:test
# 或 pnpm preview:prod
```

| 应用      | test 输出                | prod 输出                | 默认部署路径 |
| --------- | ------------------------ | ------------------------ | ------------ |
| landing   | apps/landing/dist/test   | apps/landing/dist/prod   | /landing/    |
| agreement | apps/agreement/dist/test | apps/agreement/dist/prod | /agreement/  |

预览地址为 http://127.0.0.1:4173/landing/ 和 http://127.0.0.1:4174/agreement/。`test` 与 `prod` 都使用生产优化：落地页执行 `vite build`，协议执行 `astro build`。mode 选择配置环境，不能设置 `NODE_ENV=test`。协议脚本通过 cross-env 同步设置 `AGREEMENT_MODE`，供 Astro 配置读取；日常使用上面的 pnpm 命令即可。

每个应用分别提供 `.env.test` / `.env.prod`，本地覆盖使用 `.env.test.local` / `.env.prod.local`。带 `VITE_` 的变量会进入浏览器产物，只能存放公开配置。

| 变量               | 作用                                                     |
| ------------------ | -------------------------------------------------------- |
| VITE_APP_ENV       | 必须与 mode 一致：test / prod                            |
| VITE_BASE_PATH     | 应用静态资源路径，落地页 `/landing/`，协议 `/agreement/` |
| VITE_API_BASE_URL  | 接口前缀；空值使用应用的 BASE_URL                        |
| VITE_CONFIG_PATH   | 相对于接口前缀的配置接口路径                             |
| VITE_AGREEMENT_URL | 落地页中的协议链接，可改为独立协议域名                   |

**目前两个环境都请求各应用 public/site-config.json 的演示数据，未连接实际后端。** 对接时修改 API 前缀与接口路径，并在 `packages/api/src/index.ts` 中按真实后端契约调整类型、字段校验和业务状态码处理。示例不会自行假定后端使用 `{code,data,message}` 响应格式。

生产部署时，将 `apps/landing/dist/<mode>/` 内的文件部署到站点 `/landing/` 目录，将 `apps/agreement/dist/<mode>/` 内的文件部署到 `/agreement/` 目录；本地 Vite 代理不会成为生产服务器。也可以将协议应用部署到独立域名，将其 BASE_PATH 改为 `/`，并修改落地页的 AGREEMENT_URL。服务器应启用文本资源压缩，并让 HTML 及时更新、带内容哈希的资源长期缓存。

## 兼容性

构建目标集中在 `tooling/compatibility.ts`：Chrome 49+、iOS 10+、Safari 10+。需要降低目标时，同步调整 JavaScript 与 CSS 目标，重新审查依赖并验证目标内核。

- 落地页通过 `@vitejs/plugin-legacy` 输出现代包和 SystemJS legacy 包，自动补齐旧包所用的 ES API。现代包使用插件默认支持范围；具备 ESM 但不满足现代检测的浏览器会回落到 legacy 包。
- 协议通过 Astro 生成完整 HTML，动态入口由 Vite 的 library 模式输出一个 IIFE 普通脚本，使用 `defer` 加载，不依赖 ESM、SystemJS 或前端框架 hydration。Vite 按 `scriptTargets` 转换语法；入口显式补齐 Promise 和请求依赖使用的 URLSearchParams，公共请求层负责 fetch 与 AbortController 兼容，不为协议引入 Babel 插件或自动补丁扫描。
- 浏览器请求优先使用支持取消的原生 fetch；旧浏览器使用 whatwg-fetch 的 XHR 实现和 AbortController 兼容实现。
- AbortController 必须从 `abort-controller/dist/abort-controller.js` 导入。该包默认的 `browser` 入口只转发已有原生对象，不能补齐旧浏览器。
- HTTP 请求头使用普通对象，避免原生 Headers 与 polyfill Headers 的互操作问题。
- CSS 使用常规布局与 Autoprefixer，示例避免 Flex gap、CSS Grid、CSS 变量、`:where()`、`@layer` 等较新的能力。协议正文完全不依赖脚本渲染。
- 开发服务器面向现代开发浏览器；验收旧内核必须使用构建后的 preview 或部署产物。

**构建目标不等于真实设备验收。** 自动测试在当前 Chrome 中验证现代入口、强制 legacy 入口以及缺失 fetch/Promise/AbortController 的情况；不模拟 Chrome 49 的 JS 引擎或 iOS 10 的 WebKit。2016 年出厂的设备也可能使用不同或升级后的内核，最终应按实际浏览器/WebView 版本确认。

框架本身的体积不等于整个应用体积：请求兼容层、业务代码和 polyfills 都会增加下载量。构建工具不会整体发给浏览器，生成的辅助代码与 API 补丁会。仅控制旧语法不能补齐 fetch 等浏览器 API；如果未来动态部分只使用目标浏览器已有的 API，可以减少对应补丁。协议不自动补齐新增 API，引入新能力或降低目标版本时须检查浏览器支持并补充必要处理。

## agreement 目录约定

```text
apps/agreement/
  astro.config.ts                    # 静态输出、部署前缀、环境、样式
  vite.config.ts                     # 动态入口的普通脚本构建，含兼容目标
  src/
    pages/
      index.astro                    # /agreement/
      privacy/index.astro            # /agreement/privacy/
    layouts/agreement/index.astro    # 公共文档布局、首屏样式和脚本引用
    components/dynamic-fields/index.astro
    main.ts                          # 动态字段、公共 API 请求、Loading 和重试
    style.css                        # 文档基础样式，正常 px 字号
  public/site-config.json            # 演示配置
```

新增协议时添加 `src/pages/<协议名称>/index.astro`，复用布局与所需组件，构建时自动生成独立的 `<协议名称>/index.html`。页面跳转使用普通链接，服务器按实际目录提供 HTML，不需要 SPA 回退或 Node 服务。当前两个协议都是占位示例。

正文与样式随 HTML 首屏提供，关闭 JavaScript 或动态脚本加载失败时仍可阅读；动态字段通过 `textContent` 更新。`.astro` 文件前置代码只在构建/服务端运行，可以使用 Node 支持的语法；旧设备兼容约束针对浏览器收到的脚本与 CSS。

运行时代码直接复用 `packages/api`、`packages/request` 和 `packages/feedback`。Astro 配置通过少量构建钩子调用标准 Vite 配置。布局通过 `is:inline` 引用已经打包的普通脚本，避免 Astro 将其变成 module 入口。不要在页面添加默认处理的客户端 `<script>`、`client:*` 或 `ClientRouter` 而不重新检查兼容性。

开发时，Astro 负责页面/样式更新；Vite watch 负责动态入口及公共包源码更新并刷新页面。开发产物放在忽略提交的 `public/runtime/`，正式构建则直接写入各环境的 `dist/<mode>/runtime/`，不会覆盖正在开发的脚本。所有协议共用 `runtime/agreement.js` 与 `runtime/agreement.css`；这两个文件使用固定名称，部署时应与 HTML 一起使用缓存重新验证（如 `Cache-Control: no-cache`），不要设置长期 immutable 缓存。

参考：[Astro 路由](https://docs.astro.build/en/guides/routing/)、[Astro 脚本处理](https://docs.astro.build/en/guides/client-side-scripts/)、[Vite library 模式](https://vite.dev/guide/build.html#library-mode)。

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

## 主题颜色

公共颜色定义在 `packages/theme/src/index.css`，使用标准 CSS 自定义属性。每个应用通过 `src/theme.css` 中的 `:root` 覆盖需要的颜色，未覆盖的值沿用公共默认值。变量名统一使用单个小写英文单词，不加 color 前缀，也不使用驼峰或额外连字符。

| 变量       | 用途                     |
| ---------- | ------------------------ |
| primary    | 主色、链接、Loading 圆点 |
| active     | 主色按钮按下状态         |
| inverse    | 深色背景上的文字与图标   |
| text       | 正文与标题               |
| muted      | 次要文字                 |
| background | 页面底色                 |
| surface    | 卡片、输入框底色         |
| border     | 普通边框                 |
| outline    | 输入框边框               |
| soft       | 装饰背景                 |
| decoration | 装饰图形线条             |
| overlay    | Toast 背景               |
| backdrop   | Modal 遮罩               |

```css
/* apps/<应用>/src/theme.css：只写需要覆盖的值 */
:root {
  --primary: #166348;
}

/* 页面和公共组件样式 */
.button {
  background: var(--primary);
  color: var(--inverse);
}
```

源码使用标准 CSS，编辑器无需 SCSS 语言关联。共享 `createPostcssPlugins(rem, theme)` 的第二个参数是应用主题 CSS 的绝对路径。`postcss-global-data` 为每个独立 CSS 文件提供公共默认值和应用覆盖，再由 `postcss-custom-properties` 将 `var()` 替换成具体值；定义仅供编译使用，不额外输出全局变量。随后执行 px 转 rem 和兼容处理。未知变量且没有有效回退值时构建报错。

应用、公共组件与首屏 Loading 都使用同一份应用主题。协议的 Astro 页面 CSS 和普通脚本 CSS 也读取同一份配置，首屏无需等待 JavaScript 设置颜色。SVG 颜色通过 CSS 控制。

此方案用于构建时配色，旧设备收到普通 CSS，无需主题运行库或 CSS 自定义属性支持。运行时通过 class、媒体查询或 JavaScript 动态覆盖变量不在当前方案范围内；活动专属装饰色可以留在自己的样式内。修改主题后重新构建部署。

新应用需声明 `"@packages/theme": "workspace:*"` 为开发依赖，并将自己的 `theme.css` 路径传入共享 PostCSS 配置。`components` 和 `feedback` 导出的 CSS 是源码，必须经过这套主题编译后再部署。

参考：[postcss-custom-properties](https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-custom-properties)、[postcss-global-data](https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-global-data)。

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
  components/
    page-error/index.tsx
  hooks/
    use-route-loading.ts        # 路由加载状态与开始/结束回调
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

路由加载通过 `useRouteLoading` 调用公共 `loading({ mask: true })`，不再挂载加载组件。等待期间路由内容保持挂载但隐藏，完成后恢复显示，失败时进入 `PageError` 错误重试页面。配置请求在 `useLayoutEffect` 中注册自己的 loading 句柄，早于路由释放句柄，连续复用同一组圆点。

首屏静态结构统一维护在 `packages/feedback/src/notice/markup.ts`，由运行时和 Vite 构建配置复用，不再提供独立的 page-loading 入口。共用样式从 `@packages/feedback/style.css` 导出，不依赖 Preact。Vite 将结构放在 `#app` 外、样式内联到 `<head>`，无需等待应用 JavaScript 即可显示圆点。入口调用 `loading()` 接管已有节点，路由与请求继续持有各自句柄，避免重复创建和动画重启。HTML 本身仍需先到达浏览器，这不会加快网络下载。禁用 JavaScript 时隐藏动画并显示启用提示。

| pages 下的文件                    | 路径                             | 说明                                    |
| --------------------------------- | -------------------------------- | --------------------------------------- |
| `index.tsx`                       | `/landing/`                      | 首页                                    |
| `result/index.tsx`                | `/landing/result`                | 普通页面                                |
| `p1/p2026090901/index.tsx`        | `/landing/p1/p2026090901`        | 活动页面                                |
| `p1/p2026090901/result/index.tsx` | `/landing/p1/p2026090901/result` | 活动结果页                              |
| `detail/[id]/index.tsx`           | `/landing/detail/:id`            | 动态参数                                |
| `docs/[...path]/index.tsx`        | `/landing/docs/:path+`           | 匹配至少一级，参数为 `a/b` 这样的字符串 |
| `_404/index.tsx`                  | 未匹配路径                       | 全局 404 页面                           |

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

生产部署使用 History 路径：**落地页深层 URL（如 `/landing/p1/p2026090901`）需要回退到 `/landing/index.html`**。协议项目和静态资源应先独立匹配，不能把协议请求回退到落地页。Vite 开发与预览服务已提供 SPA 回退，生产服务器需要单独配置。

路由沿用 Chrome 49 / iOS 10 构建目标。legacy 构建按使用补齐 URL、URLSearchParams、Object.fromEntries 等 API；入口的 `polyfills.ts` 为普通 DOM 链补齐链接点击所需的 `Event.composedPath`，优先使用旧 Chrome 的 `event.path`。未来若引入 Shadow DOM，需单独验证事件路径。自动测试验证缺失这些 API 时的构建产物，不代表已完成旧内核实机验收。

参考：[preact-iso](https://preactjs.com/guide/v10/preact-iso/)、[Vite Glob Import](https://vite.dev/guide/features.html#glob-import)。

## 公共展示组件

新 Preact 应用在 dependencies 中声明 `"@packages/components": "workspace:*"`，并安装与 peer dependency 匹配的 Preact，即可复用组件。包直接导出 TSX 和 CSS Modules，由应用的 Vite/PostCSS 编译。

```tsx
import { PageState } from '@packages/components';

<PageState
  code="404"
  title="页面不存在"
  description="链接可能已失效，请返回首页继续浏览。"
  actionText="返回首页"
  onAction={goHome}
/>;
```

组件按 `src/<组件名>/index.tsx` 与 `index.module.css` 组织，也可以从 `@packages/components/page-state` 单独导入。`PageState` 只负责展示，文案及操作回调由应用传入；404 路由匹配、返回首页和错误重试仍在 landing 中。协议项目继续只使用 `feedback`，无需引入 Preact。

## Feedback 目录

按实例归属组织：Toast/Loading 共用一个提示实例，放在 `notice`；Modal 使用独立弹窗栈，放在 `modal`。各模块的实现、类型、样式和测试就近存放。

```text
packages/feedback/src/
  index.ts               # Toast/Loading 对外入口，不引入 Preact
  notice/
    index.ts             # toast()、loading() 参数处理
    runtime.ts           # 共用 DOM 实例、并发句柄、过渡与遮罩
    markup.ts            # 首屏和运行时复用的 HTML
    style.css
    types.ts
    index.test.ts
  modal/
    index.tsx            # modal()、Promise 结算与关闭生命周期
    stack.ts             # 栈顺序、焦点和页面锁定
    view.tsx             # 遮罩与内容挂载
    types.ts
    index.module.css
    index.test.tsx
```

公开入口保持为 `@packages/feedback`、`@packages/feedback/style.css` 和 `@packages/feedback/modal`。跨应用浏览器测试仍放在根目录的 `tests/browser`。

## Toast / Loading

应用在 dependencies 中声明 `"@packages/feedback": "workspace:*"`，即可直接调用。样式随包自动引入，不需要挂载组件或 Provider，也不依赖 Preact。

```ts
import { toast, loading } from '@packages/feedback';

toast('操作成功'); // 默认 2 秒后淡出，替换当前提示
toast('请稍后重试', { duration: 3000 });

const closeToast = toast('持续提示', { duration: 0 });
closeToast();

const closeLoading = loading({ message: '正在提交…', mask: true });
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
- `loading()` 只显示三圆点；`loading('正在提交…')` 或 `loading({ message: '正在提交…' })` 在圆点下方显示文字。立即展示，没有显示延迟或最短停留时间。最后一个任务关闭时立即解除遮罩，暂停圆点并保持当前尺寸，用 140ms 淡出后移除；退场期间的新任务复用原节点并取消删除。文字和提示类型变化时，宽高按自然尺寸用 180ms 过渡。Toast 仍为随文字撑开的提示条，默认 2000ms 后用 140ms 淡出，`duration: 0` 由调用方关闭。
- `mask` 默认 `false`，背景可点击；`loading({ mask: true })` 使用透明遮罩拦截背景点击及点击/提交事件。并发任务中任何未结束的任务设置 `mask: true` 都会保留遮罩；这些任务关闭后解除拦截，切换 toast 时也会解除。它不取消请求，也不替代业务提交防重。提示只展示纯文本，不抢焦点、不锁滚动；减少动态效果设置会关闭跳动和尺寸过渡。
- 在浏览器 `document.body` 就绪后调用。Toast 和 Loading 字号统一为固定 18px，通过现有 `.no-rem` 约定避免落地页自动转 rem，让协议页与落地页的提示大小一致。

落地页的欢迎语提交演示 Toast，两个应用的配置请求演示 Loading；请求包本身不自动触发 UI。

## 函数式 Modal

从独立入口 `@packages/feedback/modal` 导入。使用方需要 Preact 10；只使用 Toast/Loading 的应用无需加载 Modal 渲染代码。

```tsx
import { modal, ModalCancelledError } from '@packages/feedback/modal';

const task = modal<string>({
  position: 'center',
  closeOnClickOverlay: false,
  overlayStyle: { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  render: ({ resolve, reject, closing }) => (
    <NameForm
      initial="小明"
      closing={closing}
      onConfirm={resolve}
      onCancel={() => reject()}
    />
  ),
});

try {
  const name = await task;
  // 使用组件返回的 name
} catch (error) {
  if (!(error instanceof ModalCancelledError)) throw error;
}

// 页面卸载或其他主动关闭场景：task.close()
```

- 基础层仅提供遮罩、无样式的内容挂载容器和栈管理，没有标题、关闭按钮、白色面板、圆角、内边距或内容动画。尺寸、外观、标题、按钮和内容动画都由 `render` 中的业务组件实现。
- `position` 支持 `center`（默认）、`top`、`bottom`、`left`、`right`，只控制挂载容器相对视口的对齐；内容组件自己控制尺寸。`closeOnClickOverlay` 默认为 false，`overlayStyle` 只覆盖当前遮罩。
- 每次调用创建独立栈项及遮罩，多层遮罩自然叠加。只有栈顶可交互，Escape 和遮罩点击只关闭栈顶；下层保持挂载与状态。`task.close()` 可关闭任意对应层，包括中间层，不影响其余 Promise。
- `resolve(value)` 关闭并兑现 Promise；`reject(reason)` 原样拒绝。无参数 `reject()`、`task.close()`、Escape、遮罩关闭统一拒绝为 `ModalCancelledError`，`reason` 分别为 `cancel`、`close`、`escape`、`overlay`。每层只接受首次结算；捕获取消以避免未处理的 Promise 拒绝。
- 遮罩使用 160ms 淡入淡出，关闭后卸载组件再结算 Promise；减少动态效果时跳过动画等待。组件渲染错误会清理该层并拒绝 Promise。事件回调或请求中的异常由业务组件自行捕获并决定是否调用 `reject`。
- `render` 还会收到 `closing` 状态：任何关闭方式都会将其置为 true，组件可据此执行自己的 160ms 退场过渡。首页示例使用透明度和位移过渡，中途关闭会从当前视觉状态继续退场；开启减少动态效果时禁用过渡。
- 遮罩拦截点击、滚轮及触摸手势，阻止事件冒泡到页面和触摸后的合成点击；退场期间继续阻止背景交互。点击遮罩默认不关闭，需显式设置 `closeOnClickOverlay: true`。
- 弹窗栈容器固定为 z-index 1500，内部排序不会越过 Toast/Loading 的 2000。Loading 的 mask 为 true 时也会拦截弹窗点击。
- 基础层限制焦点在栈顶内并锁定页面滚动，关闭栈顶时恢复上一层焦点，最后一层关闭后恢复页面。内容组件自行提供 `role="dialog"`、`aria-modal="true"` 和可访问名称，并处理内部滚动。
- Modal 使用独立 Preact 渲染根，不自动继承调用位置的 Context；通过 props 传入数据，需要 Provider 时在 render 内显式包裹。页面持有任务时应在卸载时调用各自的 close。

首页“在弹窗中填写”提供示例，白色卡片来自应用的 `components/name-modal`；其中“再打开一层”演示独立遮罩、保留父层状态和 Promise 回传。`hooks/use-name-modal.tsx` 管理调用与卸载清理。

参考：[Preact render](https://preactjs.com/guide/v10/api-reference/#render)、[WAI-ARIA Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。

## 验证

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build:test
pnpm check:build test
pnpm test:browser
pnpm test:browser:dev
pnpm build:prod
pnpm check:build prod
$env:BUILD_MODE = 'prod'
pnpm test:browser
Remove-Item Env:BUILD_MODE
```

浏览器测试默认使用本机 Chrome；若使用 Edge，设置 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`。测试会自动启动并关闭 4173/4174 预览服务，运行时请保持端口空闲。

`test:browser:dev` 单独验证开发环境的协议导航、刷新及样式稳定性，使用 5173/5174；本地可以复用已启动的开发服务，CI 会自行启动。

`typecheck` 包含 TypeScript 与 `astro check`。`check:build` 检查环境标记、落地页双入口、兼容脚本的 ES2015 语法解析、基本 CSS 约束，以及所有协议页的静态正文、首屏样式与普通脚本资源引用；它不能替代全部 Web API、CSS 或真实设备测试。浏览器测试覆盖协议深层链接与刷新、禁用 JavaScript、延迟加载脚本，以及缺失 fetch/Promise/AbortController 时的请求行为。

## 后续开发边界

- 页面组件与状态留在各应用，公共接口留在 `packages/api`，网络行为留在 `packages/request`，基础提示留在 `packages/feedback`，跨应用复用的 Preact 展示组件留在 `packages/components`。
- 落地页路由及页面放在应用内，`packages/api` 与 `packages/request` 不依赖路由；协议项目保持静态 HTML。
- 协议内容只是模板占位，上线前替换为正式审定文本。动态字段通过 textContent 更新，不插入接口返回的 HTML。
- Vitest 固定为 4.1 稳定版，TypeScript 固定在 ESLint 支持的 6.0 范围；升级工具时需运行完整检查。

参考：[Preact 浏览器支持](https://preactjs.com/about/browser-support/)、[Vite legacy 插件](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)、[fetch polyfill](https://github.com/JakeChampion/fetch)、[px 转 rem](https://github.com/cuth/postcss-pxtorem)。
