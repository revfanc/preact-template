# Landing

Preact + Vite 预渲染 + SPA 应用，默认部署在 `/landing/`。当前首页为空白容器，保留文件路由、404、页面加载失败重试、首屏 hydration 与兼容构建。欢迎语、结果页、详情页、Modal 和返回拦截演示已从正式应用移除。

## 开发与构建

以下命令在仓库根目录执行，工具链和安装步骤见[根 README](../../README.md)。

```powershell
pnpm dev:landing
pnpm --filter @apps/landing build:test
pnpm --filter @apps/landing preview:test
```

- 开发地址：`http://127.0.0.1:5173/landing/`。
- 预览地址：`http://127.0.0.1:4173/landing/`，读取 `dist`；修改源码后需重新构建。
- prod 使用 `build:prod` / `preview:prod`，输出 `dist`。
- 单独部署时配置 `/landing/` 下非静态路径回退到 `index.html`。

`.env.test` / `.env.prod` 中的 `VITE_BASE_PATH` 控制部署前缀，`VITE_APP_ENV` 与构建模式一致。`VITE_API_BASE_URL` 是公开接口地址，空值使用应用路径；不再请求 `site-config.json`。本地覆盖使用 `.env.<mode>.local`，不要在 `VITE_` 变量中保存秘密。

## 代码入口与分层

| 位置                   | 职责                                            |
| ---------------------- | ----------------------------------------------- |
| `src/main.tsx`         | 按需 API 补齐、预渲染、hydration 接管           |
| `src/app.tsx`          | Router 装配与页面错误处理，不新增 app 目录      |
| `src/pages/`           | 路由入口与装配，不放复杂业务或整块表单          |
| `src/components/`      | 应用 UI，每个组件独立目录                       |
| `src/stores/`          | 状态容器、实例 action、资源清理和通用 hooks     |
| `src/hooks/`           | 组合函数独立目录，入口 `use-<name>/index.ts(x)` |
| `src/api/`             | 应用请求客户端，按需绑定公共业务接口            |
| `src/router/`          | 消费生成的路由表并接入懒加载                    |
| `../../tooling/pages/` | Vite 文件路由插件：扫描、规则校验、生成路由表   |

业务、表单、请求结果及 pending/error 统一由所属作用域的 store 管理。store 使用工厂创建，不默认全局共享；所有者通过 `useLocalLoadingStore()` 等绑定 hook 创建、订阅并清理实例，消费者通过 `useStore(store)` 订阅传入的同一个实例。分别调用绑定 hook 会创建不同实例。局部动画和布局测量可保留在 UI 内。

应用内跨模块引用使用 `@/`，例如 `import { useLocalLoadingStore } from '@/stores'`；同模块文件和样式保留 `./`，公共包使用 `@packages/*`。别名映射统一定义在根 tsconfig，Vite 和 Vitest 读取同一份配置。

useLocalLoadingStore、useStore、useStoreInstance 由 stores/index.ts 导出，纯数据容器位于 stores/core/index.ts。store 不直接展示提示、弹窗或导航；这些交给场景 hook / 页面。store action 调用 API 并管理请求状态，场景 hook 组织用户操作流程。纯校验和计算使用普通函数，不为简单请求增加转发层。完整规则见[架构说明](ARCHITECTURE.md)。

`app.tsx` 在 Router 外持有 `createAppStores()` 的共享集合，通过 `AppStoresProvider` 提供。`useAppStores()` 获取已有集合，不创建实例；当前仅预留生命周期入口，没有渠道或用户数据。全局按业务拆分成员，流程、页面和弹窗状态按各自生命周期持有；Provider 只传递实例，销毁由创建者负责。模块内固定由 `index.ts` 管数据、`hooks.ts` 放接入函数、`context.tsx` 定义 Context 和 Provider；按需建文件，职责不混用。依赖边界由 `pnpm test` 检查。命名、Modal 桥接及新增全局状态的边界见 [Stores 说明](src/stores/README.md)。

## 新增页面

使用 `src/pages/p1/<code>/index.tsx` 等目录形式，路由入口装配 `src/components/<name>/index.tsx`。组件样式放同目录的 `index.module.css`。`[id]` 支持动态参数，`[...path]` 支持末尾捕获；下划线目录不生成业务路由，`_404/index.tsx` 为兜底。

先确定状态的共享范围和销毁时机，再增加业务 store、实际接口和所需场景 hook。目前 `stores/loading/index.ts` 是已接入的 Loading 状态实例；没有预置渠道、登录或订单模型。公共业务接口放在 [packages/api](../../packages/api/README.md)，应用专属接口可留在 `src/api/`。

需要刷新恢复时使用可选的 `persistStore` 扩展，显式选择字段、存储和业务 key，校验缓存版本与结构，可设置有效期。当前没有业务 store 开启持久化；接入和清理规则见 [Stores 说明](src/stores/README.md#可选持久化)。

样式使用 CSS / CSS Modules，按 375px 设计宽度写 px，构建转换为 rem；固定像素沿用 `no-rem` 约定。主题使用 `src/theme.css` 覆盖公共 CSS 变量，变量名称使用单个单词。旧设备目标与限制见[根 README](../../README.md)。

## 验证

在根目录执行 `pnpm lint`、`pnpm typecheck`、`pnpm test`；使用 `pnpm build:test` 构建两应用后，执行 `pnpm check:build test` 和 `pnpm test:browser`。后者同时检查正式页面和[独立测试夹具](test/README.md)，需要 4173–4176 端口空闲，完整环境切换方法见根 README。

`test/fixture` 保留旧交互以验证公共能力，只由 `test:build` 构建到 `test/dist`，不参与正式应用构建或部署。不要在正式源码中导入测试夹具。

## 预渲染与 SPA

使用 `@preact/preset-vite` 官方预渲染能力。`main.tsx` 导出 `prerender()`，生成 HTML 后由 `preact-iso` hydration 接管，后续导航继续使用懒加载 Router。

- 默认预渲染 `/`。在 `vite.config.ts` 的 `additionalPrerenderRoutes` 中添加需要预渲染的具体路径，例如 `/p1/p2026091101/`。路径不包含部署 base；动态 `[id]` 页面需要填写实际值。普通页面链接不自动扩展构建列表，避免误触发业务页面。
- `200.html` 是空的 SPA 入口，不参与 hydration。部署先匹配静态文件和目录 `index.html`，然后把页面请求回退到 `/landing/200.html`；缺失 JS/CSS 应返回 404。Vite 预览默认回退首页，启动时检测路径不匹配后改用客户端渲染。
- 首屏 HTML 直接展示，不再注入全屏启动 Loading，不再通过 `hidden` 隐藏正文。首次 hydration 等待期间保持正文；后续路由懒加载使用公共 Loading。
- CSS 使用 Vite 的 `cssCodeSplit: false` 输出公共样式文件，由 HTML 提前加载；JS 继续按页分包。这样无需自定义首屏 CSS 注入插件。页面数量增长时应关注公共 CSS 体积。
- 页面、store 工厂和渲染过程必须可在 Node 中执行。请求、埋点、History 注册、持久化恢复等浏览器初始化放在 effect 中；不要在模块顶层或 render 中运行。构建期间每次渲染创建独立 App store，不能使用模块级业务单例。
- 构建和客户端第一次渲染必须使用一致的内容。渠道配置、查询参数、缓存和倒计时应在 hydration 后更新，不能把某个渠道的动态价格烘焙到所有渠道共用的 HTML。渲染错误直接导致构建失败。

当前没有业务页面，因此正式首页仍为空白；架构测试使用独立临时页面验证静态正文、样式、DOM 接管、点击事件、SPA 导航和动态路由刷新，不发布示例内容。
