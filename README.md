# preact-template

移动端 Web 单仓库：Landing 使用 Preact 10 + Vite 8；Agreement 使用 Astro 7 静态生成。两个应用独立构建和部署，当前正式入口均不包含演示业务。

## 结构与分层

```text
apps/
  landing/
    src/
      app.tsx             应用装配
      main.tsx            挂载与首屏交接
      pages/              路由入口
      components/         应用 UI
      stores/             状态容器、Preact 接入及有明确作用域的状态/action
      services/           普通业务函数和多步骤流程
      hooks/              具体场景的路由、状态与 UI 行为接入
      api/                应用请求实例
      router/             文件路由与懒加载
    test/                 独立回归夹具，不进入发布产物
  agreement/              静态协议布局、页面和普通脚本入口
packages/
  api/                    公共业务接口预留包，示例接口已移除
  request/                HTTP、错误、超时、取消、浏览器适配
  browser/                原生 History 返回拦截
  feedback/               函数式 Toast / Loading / Modal
  components/             跨应用通用 Preact UI
  theme/                  标准 CSS 主题变量
tooling/                  兼容目标、PostCSS
tests/                    单元测试与浏览器验收
scripts/                  构建产物检查
```

**业务状态统一放入所属作用域的 store，store 不等于全局单例。** 每次工厂调用创建独立实例，所有者负责清理，消费者通过 props/Context 共享。hook 不另存 pending/error 副本；DOM、计时器和取消句柄放实例私有资源，局部视觉状态允许留在组件。

store action 处理数据变化，复杂流程调用 service；store 不直接展示 Toast、Loading、Modal 或导航，这些由场景 hook / 页面处理。API 不控制 UI，service 不使用 hooks。不存在真实业务时不创建空转 service、虚构订单字段或模拟接口。

store 的通用能力集中在 `stores/core.ts`、`stores/hooks.ts`，由 `stores/index.ts` 导出。业务 store 直接引用纯 TypeScript 的 core；组件从 stores 入口使用 `useStore`、`useStoreInstance`。顶层 hooks 只保留具体场景的接入逻辑。

## 文档导航

| 文档                                            | 内容                                     |
| ----------------------------------------------- | ---------------------------------------- |
| [Landing 应用](apps/landing/README.md)          | 入口、开发、构建与新增页面               |
| [Landing 架构](apps/landing/ARCHITECTURE.md)    | 数据、业务、UI 分层和 store 实例生命周期 |
| [Agreement 应用](apps/agreement/README.md)      | 静态协议、动态脚本与独立部署             |
| [API 包](packages/api/README.md)                | 公共业务接口与请求客户端边界             |
| [Feedback 包](packages/feedback/README.md)      | Toast、Loading 和函数式 Modal            |
| [Browser 包](packages/browser/README.md)        | 返回拦截栈、异步放行及 History 边界      |
| [Landing 测试夹具](apps/landing/test/README.md) | 独立回归页面与正式应用的区别             |

## 启动与编辑器

使用 Node.js 24、pnpm 10：

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

- Landing：http://127.0.0.1:5173/landing/
- Agreement：http://127.0.0.1:5174/agreement/
- 单独启动：pnpm dev:landing / pnpm dev:agreement
- Landing 开发服务将 /agreement/ 重定向到 5174；预览服务通过代理访问 4174。

VS Code 打开仓库根目录并安装推荐的 Oxc、Prettier、Astro 扩展。项目配置启用 Oxc 实时检查、手动保存时安全修复及 Prettier 保存时格式化；禁用 ESLint 检查和 Oxfmt。首次提示时选择工作区 TypeScript。

Oxlint 使用默认插件与 correctness: error，补充 no-debugger、no-var、prefer-const、ban-ts-comment、no-explicit-any。格式化统一由 Prettier（含 Astro 插件）处理，类型检查由 tsc 和 astro check 负责。

## 环境与部署

```powershell
pnpm build:test
pnpm build:prod
pnpm preview:test
# 或 pnpm preview:prod
```

| 应用      | test 输出                | prod 输出                | 部署路径    |
| --------- | ------------------------ | ------------------------ | ----------- |
| landing   | apps/landing/dist/test   | apps/landing/dist/prod   | /landing/   |
| agreement | apps/agreement/dist/test | apps/agreement/dist/prod | /agreement/ |

预览端口为 4173 / 4174，预览读取构建产物；恢复源码或切换分支后需重新构建。两种环境均使用生产优化，不设置 NODE_ENV=test。Astro 通过 AGREEMENT_MODE 与 Vite mode 保持一致。

应用 .env.test / .env.prod 保存公开构建配置；本地覆盖使用 .env.test.local / .env.prod.local。VITE_ 变量会进入客户端产物，不能保存秘密。

- VITE_APP_ENV：test / prod，必须与构建模式一致。
- VITE_BASE_PATH：独立部署的 URL 前缀。
- Landing 的 VITE_API_BASE_URL：后续真实业务接口地址；空值使用应用路径。
- SiteConfig、欢迎语与协议示例参数已从正式应用移除。

部署 SPA 需要将 /landing/ 下非静态资源路径回退到 Landing index.html；Agreement 按输出目录提供静态文件。不要把未命中的静态 JS 资源也回退成 HTML。发布新版本时保留旧 hash 资源供已打开页面继续加载，HTML 应及时重新验证。

## 路由、样式与兼容

pages 下 index.tsx 自动发现，支持 [id] 动态段与 [...path] 末尾捕获；下划线目录不生成路由，_404/index.tsx 为兜底。路由冲突在构建时报告。活动入口使用 pages/p1/<code>/index.tsx 形式，目录尽量只放路由组件。

目前只有空白首页和 404，保留加载失败重试页及 HTML 首屏三圆点交接。新增业务页面时不要恢复演示依赖。

原生 CSS / CSS Modules，业务组件独立目录。主题使用标准 CSS 变量；packages/theme 提供默认值，各应用 theme.css 覆盖，变量名称使用单个单词。构建时生成旧浏览器可用的颜色值。

Landing 按 375px 设计宽度写 px，构建转换为 rem；根字号随视口变化并在 540px 封顶。固定像素样式沿用 no-rem 约定。Agreement 使用普通 px 与响应式容器，不自动转 rem。

tooling/compatibility.ts 集中管理 Chrome 49、iOS 10 / Safari 10 构建目标。Landing 使用 legacy 双入口；Agreement 的 main.ts 由独立 Vite 配置输出 IIFE 普通脚本。main.ts 当前无动态业务，保留入口供后续渐进增强。运行时 API 必须按实际使用补齐，不能仅靠语法转换。现代浏览器模拟缺少 API 不等于旧设备验收。

## 公共包

- request：createRequestClient；浏览器使用 @packages/request/browser 的兼容客户端。支持 JSON、文本、超时、取消及明确错误类型，不自动弹 Toast。
- api：按真实业务逐项增加接口，客户端由应用注入，不依赖页面或全局 store。
- browser：register(handler) 返回精确注销函数，done 消费当前层；主动修改 History 前等待注销。详情见 [Browser 文档](packages/browser/README.md)。
- feedback：Toast 与 Loading 共用实例；Modal 使用独立入口 @packages/feedback/modal，内容由 render 提供。详情见 [Feedback 文档](packages/feedback/README.md)。
- components：PageState 等通用展示组件；具体活动 UI 留在应用内。
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

构建检查覆盖环境、首屏 HTML、CSS、legacy 脚本 ES2015 语法和静态协议资源。单元测试覆盖请求、文件路由、反馈、History 与 store 实例隔离/清理。浏览器测试同时验证正式空白入口和独立交互夹具。

正式应用预览使用 4173/4174；History 夹具使用 4175，交互夹具使用 4176。测试启动服务前应保持对应端口空闲。夹具永远不随应用发布，其欢迎语和弹窗交互仅用于保留回归覆盖，见 [夹具说明](apps/landing/test/README.md)。

浏览器测试默认使用本机 Chrome，可通过 PLAYWRIGHT_CHANNEL=msedge 切换 Edge。开发验收使用 5173/5174，本地可复用开发服务。CI 中不得用跳过失败测试代替问题修复。

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
