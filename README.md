# preact-template

移动端 Web 单仓库。Landing 使用 Preact + Vite 预渲染、hydration 和 SPA 路由；Agreement 使用 Preact + Vite SSG + hydration。两个应用独立构建和部署。

## 结构与分层

```text
apps/
  landing/
    src/
      app.tsx             应用装配
      main.tsx            预渲染与 hydration 接管
      pages/              路由入口
      components/         应用 UI
      stores/             状态容器、Preact 接入及有明确作用域的状态/action
      hooks/              具体场景的路由、状态与 UI 行为接入
      api/                应用请求实例
      router/             生成路由表的运行时接入与懒加载
    test/                 独立回归夹具，不进入发布产物
  agreement/              静态协议页面、官方预渲染与 hydration 入口
packages/
  api/                    公共业务接口
  request/                HTTP、错误、超时、取消、浏览器适配
  browser/                原生 History 返回拦截
  feedback/               函数式 Toast / Loading / Modal
  components/             跨应用通用 Preact UI
  theme/                  标准 CSS 主题变量
tooling/                  文件路由、兼容目标、PostCSS、关键 CSS 内联
tests/                    单元测试与浏览器验收
scripts/                  构建产物检查
```

**业务状态统一放入所属作用域的 store，store 不等于全局单例。** 每次工厂调用创建独立实例，所有者负责清理，消费者通过 props/Context 共享。hook 不另存 pending/error 副本；DOM、计时器和取消句柄放实例私有资源，局部视觉状态允许留在组件。

store action 处理数据变化并调用 API；场景 hook 组织用户操作流程、展示 Toast、Loading、Modal 或执行导航。store 和 API 不直接控制 UI。校验与计算使用普通函数，不为简单请求增加转发层，也不提前创建虚构订单字段或模拟接口。

Landing 使用 `@/` 引用 `apps/landing/src/` 下的跨模块代码，同模块保留 `./`，公共包使用 `@packages/*`。公共编译选项在 `tsconfig.base.json`，应用分别维护自己的 `tsconfig.json`。Landing 别名只定义在应用配置中，开发/构建、测试夹具和 Vitest 通过 Vite 8 的 `resolve.tsconfigPaths` 读取。根配置检查公共包与工具，不包含应用别名；浏览器测试配置显式继承 Landing 的映射。

`tests/workspace-boundaries.test.ts` 检查正式源码的跨应用引用、公共包反向依赖应用、绕过 exports 的导入、未声明依赖和工作区依赖循环。公共包依赖使用 `workspace:*`；业务运行时依赖由实际使用它的应用或包声明，根依赖只维护开发工具。已有 store 分层检查继续独立执行。

store 的通用能力集中在 `stores/core/index.ts`、`stores/core/hooks.ts`，由 `stores/index.ts` 导出。业务 store 直接引用纯 TypeScript 的 core；组件从 stores 入口使用 `useLocalLoadingStore()` 等绑定 hook，一次获取 state 和 store；共享消费者使用 `useStore(store)` 订阅同一实例。顶层 hooks 只保留具体场景的接入逻辑，每个组合函数放入 `hooks/use-<name>/index.ts(x)`，调用方导入目录，测试就近放置。

`stores/core/persist.ts` 提供可选 `persistStore`：按字段保存、同步恢复并校验版本/结构，可设置有效期；支持注入 sessionStorage/localStorage，存储失败时继续使用内存。默认不开启，业务 key 按渠道/用户/订单划分，销毁与清缓存分开；它不提供跨标签同步，也不代替接口缓存。详见 [持久化说明](apps/landing/src/stores/README.md#可选持久化)。

`app.tsx` 持有应用共享实例：`stores/app/index.ts` 创建独立的业务 store 集合，`stores/app/context.tsx` 只定义 Context 和 Provider，`stores/app/hooks.ts` 提供读取 hook。`useAppStores()` 只获取已有集合，`useLocalXxxStore()` 明确创建局部实例，`useXxxStore()` 留给读取共享业务实例的 hook。集合按渠道、会话等业务拆分成员。申请数据归流程、临时编辑归页面或弹窗，生命周期不匹配的数据不提升为应用全局。详细命名和作用域规则见 [Stores 说明](apps/landing/src/stores/README.md)。

## 文档导航

- [质量检查与验收](docs/quality.md)：CI、资源预算、浏览器与真机验收范围。
- [ARMS RUM 接入](docs/monitoring.md)：官方 SDK、应用配置、加载边界和启用步骤。

| 文档                                                  | 内容                                     |
| ----------------------------------------------------- | ---------------------------------------- |
| [Landing 应用](apps/landing/README.md)                | 入口、开发、构建与新增页面               |
| [Landing 架构](apps/landing/ARCHITECTURE.md)          | 数据、业务、UI 分层和 store 实例生命周期 |
| [预渲染业务约定](apps/landing/README.md#业务开发约定) | 首帧一致性、动态数据、缓存、交互与验收   |
| [Agreement 应用](apps/agreement/README.md)            | 静态协议、动态脚本与独立部署             |
| [API 包](packages/api/README.md)                      | 公共业务接口与请求客户端边界             |
| [Request 包](packages/request/README.md)              | Fetch 封装、错误、返回类型与浏览器兼容   |
| [Feedback 包](packages/feedback/README.md)            | Toast、Loading 和函数式 Modal            |
| [Browser 包](packages/browser/README.md)              | 返回拦截栈、异步放行及 History 边界      |
| [Landing 测试夹具](apps/landing/test/README.md)       | 独立回归页面与正式应用的区别             |

## 启动与编辑器

使用 Node.js 24、pnpm 10：

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

- Landing 活动示例：http://127.0.0.1:5173/landing/p1/p2026091101/
- Agreement 隐私政策：http://127.0.0.1:5174/agreement/privacy-policy/
- Agreement 用户协议：http://127.0.0.1:5174/agreement/user-agreement/
- 单独启动：pnpm dev:landing / pnpm dev:agreement
- 开发时两个应用使用各自地址，协议直接访问 5174；Landing 的 5173 端口不转发协议请求。预览服务通过代理访问 4174。

VS Code 打开仓库根目录并安装推荐的 Oxc 扩展。项目配置启用 Oxlint 实时检查、手动保存时安全修复及 Oxfmt 保存时格式化。首次提示时选择工作区 TypeScript。

Oxlint 使用默认插件与 correctness: error，补充 no-debugger、no-var、prefer-const、ban-ts-comment、no-explicit-any。Oxfmt 统一格式化 TS/TSX、JS、CSS、HTML、JSON、YAML 和 Markdown，配置集中在 `.oxfmtrc.json`，保留单引号、80 列换行和 package.json 字段顺序；默认遵循 `.gitignore` 并忽略锁文件。使用 `pnpm format` 格式化，`pnpm format:check` 检查格式，类型检查继续由 tsc 负责。

## 环境与部署

```powershell
pnpm build:test
pnpm build:prod
pnpm preview:test
# 或 pnpm preview:prod
```

| 应用      | 构建输出            | 部署路径    |
| --------- | ------------------- | ----------- |
| landing   | apps/landing/dist   | /landing/   |
| agreement | apps/agreement/dist | /agreement/ |

test 和 prod 都写入各应用的 `dist/`，后一次构建覆盖前一次产物，不同时保留两套环境。预览读取最近一次构建；`preview:test` / `preview:prod` 只选择预览配置，不会切换或重新生成产物。检查时使用与最近构建一致的 `pnpm check:build test` 或 `pnpm check:build prod`。

预览端口为 4173 / 4174，预览读取构建产物；恢复源码或切换分支后需重新构建。两种环境均使用生产优化，不设置 NODE_ENV=test。两个应用统一通过 Vite mode 选择环境。

应用 .env.test / .env.prod 保存公开构建配置；本地覆盖使用 .env.test.local / .env.prod.local。VITE_ 变量会进入客户端产物，不能保存秘密。

- VITE_APP_ENV：test / prod，必须与构建模式一致。
- VITE_BASE_PATH：独立部署的 URL 前缀。
- Landing 的 VITE_API_BASE_URL：业务接口地址；空值使用应用路径。
- VITE_ARMS_ENDPOINT：可选的新版 ARMS RUM endpoint；未配置时完全不加载监控 SDK。
- VITE_APP_VERSION：启用 RUM 时填写的应用版本，用于定位问题。

Landing 部署优先匹配路由对应的静态 HTML（含目录 index.html），未预渲染的页面路径回退到 `/landing/index.html`。这个文件保留空的 `#app`，作为 SPA 启动入口，不包含首页或 404 正文。应用没有业务首页，直接访问 `/landing/` 会由客户端显示 404，详见 [Landing 部署约定](apps/landing/README.md#预渲染与-spa)。Agreement 按输出目录提供静态文件。不要把未命中的静态 JS/CSS 资源也回退成 HTML。发布新版本时保留旧 hash 资源供已打开页面继续加载，HTML 应及时重新验证。

## 路由、样式与兼容

两个应用共用 [pages 构建插件](tooling/pages/README.md)，从 `src/pages/**/*.{tsx,jsx}` 生成路由，支持普通文件和目录首页，通过 `exclude` glob 排除辅助文件。Landing 懒加载页面，Agreement 同步导入静态页面；目录扫描与规则解析在构建期完成。活动入口使用 `pages/p1/<code>/index.tsx`，只负责路由组件装配。

Landing 使用官方预渲染 + hydration + SPA；活动页通过独立的 `export const prerender = true` 声明加入构建，无需逐页配置 Vite。`/landing/p1/p2026091101/` 提供活动示例。根 `index.html` 只作空白启动入口，未标记的页面及 404 由客户端路由处理。保留加载失败重试页，首次 hydration 不使用全屏 Loading，后续懒加载路由仍显示三圆点。页面约定和限制见 [Landing 说明](apps/landing/README.md#预渲染与-spa)。

原生 CSS / CSS Modules，业务组件独立目录。主题使用标准 CSS 变量；packages/theme 提供默认值，各应用 theme.css 覆盖，变量名称使用单个单词。构建时生成旧浏览器可用的颜色值。

Landing 按 375px 设计宽度写 px，构建转换为 rem；根字号随视口变化并在 540px 封顶。固定像素样式沿用 no-rem 约定。Agreement 使用普通 px 与响应式容器，不自动转 rem。

tooling/compatibility.ts 统一管理两个应用及测试夹具的 JS、CSS 和 Autoprefixer 目标：Chrome 64+、Safari 11.1+ / iOS 11.3+、Firefox 67+、Edge 79+。输出原生 ES 模块。构建只转换语法，不自动补齐运行时 API；Landing 为 preact-iso 按需导入 core-js 的 Object.fromEntries 补齐模块；现代浏览器测试不等于最低版本真机验收。详见 [Agreement 说明](apps/agreement/README.md)。

## 公共包

- request：ofetch 1.5.1 的项目适配层，使用 `request(url, { body, query })`；完整转导出上游类型（客户端使用 `$Fetch`），运行时只提供项目工厂与 FetchError。默认不重试、不弹 Toast。浏览器使用 @packages/request/browser，缺少可取消的 fetch 时使用 XHR 补丁。超时沿用 ofetch v1 语义：传入 signal 时由调用方管理截止时间。协议静态内容不引入客户端请求代码，详见 [request 说明](packages/request/README.md)。
- api：按真实业务逐项增加接口，客户端由应用注入，不依赖页面或全局 store。
- browser：register(handler) 返回精确注销函数，done 消费当前层；主动修改 History 前等待注销。详情见 [Browser 文档](packages/browser/README.md)。
- feedback：Toast、Loading、Modal 及类型统一从 @packages/feedback 导入，使用方需安装 Preact 10。Toast 与 Loading 共用实例；Modal 内容由 render 提供，动态组件通过 AsyncModalContent 统一处理加载、超时、失败重试和关闭。详情见 [Feedback 文档](packages/feedback/README.md)。
- components：PageState 等通用展示组件；同时传入 actionText 和 onAction 时展示操作按钮，具体导航由应用处理。具体活动 UI 留在应用内。
- 公共包直接导出源码，由消费应用构建；不发布到 npm。

## 验证

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build:test
pnpm check:build test
pnpm test:browser
pnpm test:browser:dev
pnpm build:prod
pnpm check:build prod
```

构建检查覆盖环境、首屏 HTML、CSS、ES 模块语法解析（不等于浏览器兼容性证明）和静态协议资源。单元测试覆盖请求、文件路由、反馈、History 与 store 实例隔离/清理。浏览器测试验证正式入口、预渲染接管和独立交互夹具。

GitHub Actions 的 `Quality checks` 在 PR 和 main 提交时检查两个应用的 test/prod 构建、资源预算和浏览器回归，仅做质量检查。`pnpm check:build` 使用 `tooling/budgets.json` 约束 gzip 后的 JS/CSS 总量和单页 HTML；阈值与测试范围见[质量说明](docs/quality.md)。

正式应用预览使用 4173/4174；History 夹具使用 4175，交互夹具使用 4176。测试启动服务前应保持对应端口空闲。夹具永远不随应用发布，其欢迎语和弹窗交互用于回归测试，见 [夹具说明](apps/landing/test/README.md)。

浏览器测试包括 Chromium 完整回归和 WebKit 的预渲染、hydration、请求回归。首次运行 `pnpm exec playwright install chromium webkit`；本地 Chromium 项目默认使用 Chrome，可通过 PLAYWRIGHT_CHANNEL=msedge 切换 Edge，CI 使用 Playwright Chromium。单独检查 Chrome 可在测试命令后加 `--project=chromium`。开发验收使用 5173/5174，本地可复用开发服务。现代 WebKit 不等同于旧版 iOS 真机。

`test:browser` 自动构建两个测试夹具，但不构建正式应用；先执行对应的 `build:test` 或 `build:prod`。默认验收正式应用的 test 产物，验收 prod 产物时在 PowerShell 执行：

```powershell
pnpm build:prod
$env:BUILD_MODE = 'prod'
try {
  pnpm test:browser
} finally {
  Remove-Item Env:BUILD_MODE
}
```

`BUILD_MODE` 同时选择 History 夹具的构建目录；Landing 交互夹具固定使用 test 模式，其测试数据不随正式应用环境变化。
