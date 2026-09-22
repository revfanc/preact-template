# Landing

Preact + Vite 预渲染 + SPA 应用，默认部署在 `/landing/`。提供文件路由、404、页面加载失败重试、首屏 hydration 与兼容构建。应用没有业务首页，活动通过各自路径访问；`/p1/p2026091101` 是一个按页面约定开启预渲染的活动示例。

新增或修改业务前阅读 [Landing 开发约束](./AGENTS.md)，快速确认分层、状态作用域、预渲染与验收要求；详细规则由下文及链接文档维护。

## 开发与构建

以下命令在仓库根目录执行，工具链和安装步骤见[根 README](../../README.md)。

```powershell
pnpm dev:landing
pnpm --filter @apps/landing build:test
pnpm --filter @apps/landing preview:test
```

- 活动示例开发地址：`http://127.0.0.1:5173/landing/p1/p2026091101/`。
- 活动示例预览地址：`http://127.0.0.1:4173/landing/p1/p2026091101/`，读取 `dist`；修改源码后需重新构建。
- prod 使用 `build:prod` / `preview:prod`，输出 `dist`。
- 部署时优先匹配静态文件，未预渲染的页面路径回退到 `/landing/index.html`。

`.env.test` / `.env.prod` 中的 `VITE_BASE_PATH` 控制部署前缀，`VITE_APP_ENV` 与构建模式一致。`VITE_API_BASE_URL` 是公开接口地址，空值使用应用路径。本地覆盖使用 `.env.<mode>.local`，不要在 `VITE_` 变量中保存秘密。

## 代码入口与分层

| 位置                   | 职责                                            |
| ---------------------- | ----------------------------------------------- |
| `src/main.tsx`         | 按需 API 补齐、预渲染、hydration 接管           |
| `src/app.tsx`          | Router 装配与页面错误处理                       |
| `src/pages/`           | 路由入口与装配，不放复杂业务或整块表单          |
| `src/components/`      | 应用 UI，每个组件独立目录                       |
| `src/stores/`          | 状态容器、实例 action、资源清理和通用 hooks     |
| `src/hooks/`           | 组合函数独立目录，入口 `use-<name>/index.ts(x)` |
| `src/request.ts`       | 应用请求客户端，配置请求地址                    |
| `src/router/`          | 消费生成的路由表并接入懒加载                    |
| `../../tooling/pages/` | Vite 文件路由插件：扫描、规则校验、生成路由表   |

业务、表单、请求结果及 pending/error 统一由所属作用域的 store 管理。store 使用工厂创建，不默认全局共享；所有者通过 `useLocalLoadingStore()` 等绑定 hook 创建、订阅并清理实例，消费者通过 `useStore(store)` 订阅传入的同一个实例。分别调用绑定 hook 会创建不同实例。局部动画和布局测量可保留在 UI 内。

应用内跨模块引用使用 `@/`，例如 `import { useLocalLoadingStore } from '@/stores'`；同模块文件和样式保留 `./`，公共包使用 `@packages/*`。别名映射定义在本应用的 `tsconfig.json`，Vite 和 Vitest 读取同一份配置；公共编译选项继承根 `tsconfig.base.json`。

useLocalLoadingStore、useStore、useStoreInstance 由 stores/index.ts 导出，纯数据容器位于 stores/core/index.ts。store 不直接展示提示、弹窗或导航；这些交给场景 hook / 页面。store action 调用 API 并管理请求状态，场景 hook 组织用户操作流程。纯校验和计算使用普通函数，不为简单请求增加转发层。完整规则见[架构说明](ARCHITECTURE.md)。

`app.tsx` 在 Router 外持有 `createAppStores()` 的共享集合，通过 `AppStoresProvider` 提供。`useAppStores()` 获取已有集合，不创建实例。全局按业务拆分成员，流程、页面和弹窗状态按各自生命周期持有；Provider 只传递实例，销毁由创建者负责。模块内固定由 `index.ts` 管数据、`hooks.ts` 放接入函数、`context.tsx` 定义 Context 和 Provider；按需建文件，职责不混用。依赖边界由 `pnpm test` 检查。命名、Modal 桥接及新增全局状态的边界见 [Stores 说明](src/stores/README.md)。

## 新增页面

支持 `src/pages/about.tsx` 和 `src/pages/about/index.tsx`。活动入口使用 `src/pages/p1/<code>/index.tsx` 等目录形式，路由入口装配 `src/components/<name>/index.tsx`。组件样式放同目录的 `index.module.css`。`[id]` 支持必填参数，末尾 `[[id]]` 支持可选参数，`[...path]` 捕获零段或多段路径；`[...path]/index.tsx` 为兜底。辅助文件通过 `exclude` glob 排除；下划线名称没有特殊含义。文件约定与边界见 [pages 说明](../../tooling/pages/README.md)。

先确定状态的共享范围和销毁时机，再增加业务 store、实际接口和所需场景 hook。目前 `stores/loading/index.ts` 是已接入的 Loading 状态实例。公共业务接口放在 [packages/api](../../packages/api/README.md)，应用专属接口可留在 `src/api/`。

需要刷新恢复时使用可选的 `persistStore` 扩展，显式选择字段、存储和业务 key，校验缓存版本与结构，可设置有效期。接入和清理规则见 [Stores 说明](src/stores/README.md#可选持久化)。

样式使用 CSS / CSS Modules，按 375px 设计宽度写 px，构建转换为 rem；固定像素沿用 `no-rem` 约定。主题使用 `src/theme.css` 覆盖公共 CSS 变量，变量名称使用单个单词。旧设备目标与限制见[根 README](../../README.md)。

## 应用接口示例

[`src/api/example.ts`](src/api/example.ts) 展示应用独有接口的写法：复用 `@/request`，声明输入/输出类型，透传取消与超时选项，校验业务 code 和响应数据，只返回页面需要的数据。

```ts
import { getExample } from '@/api/example';

// 由客户端流程触发 store action，再在 action 内调用：
const detail = await getExample({ id: '1' }, { signal, timeout: 5000 });
```

示例地址 `/__example__/detail` 不存在真实后端，假定成功响应为 `{ code: 200, data: { id: '1', title: '示例内容' } }`。使用时替换地址、参数、业务成功条件和校验；当前未接入页面、hook 或 store，不自动发送请求。单测通过 mock 验证契约，不需要后端服务。

接口函数不保存状态、不显示 Toast、不执行导航。可复用的业务接口移到 `packages/api` 并由应用传入请求客户端；`request.ts` 继续只配置传输实例。

## 渠道上下文与导航

应用启动和路由 query 变化时，`useChannel()` 在客户端同步 URL 到应用级 `channel` store；它在懒加载页面外只挂载一次，前进后退也会更新。页面通过 `useChannelStore()` 读取 `{ state, store }`，不各自创建实例或恢复渠道缓存。

- `state.initialized` 表示已同步 URL，不表示渠道接口已完成；`context` 为解析后的身份，缺少或空白 `channelCode` 时为 `null`；重复的已知参数会清空上下文并写入 `error`。
- 懒加载页面可能在上下文同步后才开始 hydration。`useChannelStore()` 为每个消费者保留一致的空首帧，挂载后再读取实时快照；UI 不绕过它直接用 `getSnapshot()` 渲染渠道内容。
- 当前白名单为 `channelCode`、`undertakePageConfigId`、`clickid`、`linkId`，忽略其他字段。同一上下文不因参数顺序或无关 query 变化重复更新。`clickid` 保留 URL 原字段，未来请求接口时再按契约转换为 `unionId`。
- 当前只接入上下文和导航，不请求渠道接口、不提供默认渠道、不持久化 query 或配置。业务需要渠道时应显式处理未初始化、参数错误和渠道缺失；后续配置请求接入 channel 的数据 action，沿用现有 API/请求层。

业务链接和代码跳转使用同一个 `useNavigation()`；`nextPath` 是业务提供的目标路径：

```tsx
import { useChannelStore } from '@/stores';
import { useNavigation } from '@/hooks/use-navigation';

const { state } = useChannelStore();
const { href, navigate } = useNavigation();
const ready = state.initialized && !state.error && !!state.context;

// 普通链接支持浏览器的新标签页操作；按钮事件可调用 navigate(nextPath)。
<a href={ready ? href(nextPath) : undefined} aria-disabled={!ready}>
  下一步
</a>;
// navigate(nextPath, true) 使用 replace，不增加一条历史记录。
```

`href()` 在 URL 尚未同步或参数错误时返回 `undefined`，此时链接没有可跳转的 href；`navigate()` 在这种状态下抛错，调用它的按钮需按就绪条件禁用。预渲染不知道访问者的 query，依赖渠道的链接因此需要客户端同步后启用，不能声称禁用 JavaScript 时仍可保留渠道跳转。固定、不依赖上下文的链接可直接使用普通 href。

`createHref(to, from, base?)` 位于 `src/router/href.ts`，供非 hook 场景使用；`from` 明确传入当前路径和 query，不读取浏览器全局变量。

- `p2/example/` 等相对路径从应用 base 拼接；`/landing/p2/example/` 等根路径原样使用，`/p2/example/` 不会自动补 `/landing/`。这些是地址写法示例，并非模板已有路由。
- 应用内新页面只继承白名单，目标显式参数优先；目标显式换成另一渠道或清空渠道时，不再继承旧的活动编号和归因参数。不能把全部 query、token 或一次性回调参数默认带到下一页。
- `?step=2` 留在当前路径并继承白名单；`#section` 留在当前页面并保留原查询串。query-only 导航中想移除渠道需显式指定 `channelCode=`。
- 外部 URL 和应用范围外的根路径不追加上下文；`navigate()` 仅支持本应用内地址，外部跳转使用普通链接。直接使用 Router、`history.pushState` 或自己拼 href 不会自动保留参数；History 保护已启用时，修改历史前还需按 Browser 包约定等待注销。

## 验证

在根目录执行 `pnpm lint`、`pnpm typecheck`、`pnpm test`；使用 `pnpm build:test` 构建两应用后，执行 `pnpm check:build test` 和 `pnpm test:browser`。后者同时检查正式页面和[独立测试夹具](test/README.md)，需要 4173–4176 端口空闲，完整环境切换方法见根 README。

`test/fixture` 验证公共交互能力，只由 `test:build` 构建到 `test/dist`，不参与正式应用构建或部署。不要在正式源码中导入测试夹具。

## 预渲染与 SPA

使用 `@preact/preset-vite` [官方预渲染能力](https://preactjs.com/blog/prerendering-preset-vite/)。`main.tsx` 导出 `prerender()`，生成 HTML 后由 `preact-iso` hydration 接管，后续导航继续使用懒加载 Router。

页面直接声明，无需逐页修改 Vite 配置：

```tsx
// src/pages/p1/p2026091101/index.tsx
import { Activity } from '@/components/activity';

export const prerender = true;

export default function ActivityPage() {
  return <Activity />;
}
```

- 官方插件从根路径 `/` 开始构建；`prerender()` 对该路径返回空正文及待预渲染路径，生成的 `index.html` 保留空的 `#app` 作为 SPA 启动入口，不渲染 Router。无需 `src/pages/index.tsx`；直接访问 `/landing/` 由客户端显示 404。
- 活动页面只有声明 `prerender = true` 才生成 HTML。未声明或为 `false` 时保留 SPA 路由，页面链接不会自动扩展构建列表。
- 每份预渲染 HTML 自动预加载当前页面的 JS 和静态依赖，并提前加载对应 CSS；关键样式仍内联。其他页面与组件中的动态导入保持按需加载，无需手写资源地址。SPA 回退入口不预加载具体页面。
- `prerender` 是 [pages 插件](../../tooling/pages/README.md) 的构建标记，必须单独直接导出 `true` 或 `false`。不支持表达式、变量引用或转导出；标记在构建期解析，组件保持按需加载。
- 当前只支持具体的静态路由。`[id]`、`[[id]]` 和 `[...path]` 不可标记为 `true`，否则构建报错。根路径保留为空白启动入口。
- 部署先匹配静态文件和目录 `index.html`，未预渲染的页面路径回退到 `/landing/index.html`；缺失 JS/CSS 应返回 404。Vite 预览同样使用这个空白入口；预览已生成的页面请使用带末尾 `/` 的地址。
- 入口核对 HTML 的 `data-page` 与访问路径：一致且带预渲染标记时 hydration，否则清空容器并按 SPA 渲染目标路由。空白入口不会先显示首页或 404，但需等待 JS 才能展示目标页面；重要落地页应预渲染并确保部署直接命中对应 HTML。

活动示例访问地址为 `/landing/p1/p2026091101/`，构建输出 `dist/p1/p2026091101/index.html`。架构测试使用独立临时页面验证页面标记、静态正文、样式、DOM 接管、点击事件、SPA 导航和动态路由刷新。

## 业务开发约定

### 三个执行阶段

| 阶段       | 执行内容                                                 | 业务边界                                                         |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| 构建预渲染 | Node 导入页面及依赖，执行组件、store 工厂，生成公开 HTML | 无用户会话，不执行浏览器 effect；只输出所有访问者可共用的内容    |
| 首次访问   | 浏览器先显示 HTML，再执行组件并 hydration 接管           | 首次渲染必须与静态 HTML 一致；该页面的 effect 再启动客户端初始化 |
| SPA 导航   | Router 加载页面组件和 CSS，沿用当前应用实例              | 不再读取目标页面的预渲染 HTML；页面要能从空状态独立初始化        |

预渲染优化首次展示，不代表接口数据或 JS 交互已经准备好。开发模式只验证客户端渲染，必须构建后检查 hydration。以下是本项目的业务约定，不代表 Preact 禁止在构建期获取公开数据。

### 静态首屏与动态数据

- 活动标题、固定文案、布局、公开图片可预渲染。渠道价格、登录态、手机号、订单结果、协议勾选等保留统一的空值或占位状态，在客户端初始化后更新。
- 同一路径的 `?channelCode=A`、`?channelCode=B` 和 `#ideas` 共用一份 HTML。查询参数与 hash 不生成独立产物；不能把某次构建取得的渠道或用户数据写进通用首屏。
- 初始 JSX、文本、属性及表单值都要稳定。不要根据 `Date.now()`、`Math.random()`、缓存、时区或浏览器宽度决定首帧内容；倒计时在客户端启动，尺寸适配优先使用 CSS。
- `typeof window !== 'undefined'` 只能避免访问浏览器对象时报错，不能保证 hydration 一致。不要用它让服务器返回占位、浏览器首次渲染直接返回另一套内容。
- 模块顶层、组件 render、store 工厂和 `useState` 初始化函数保持无浏览器副作用。DOM 监听、SDK、Toast/Loading/Modal、History 注册和埋点在 effect 或事件中启动；导入时就读取 DOM 的第三方库也应在 effect 中动态导入。
- 如果页面完全依赖运行时数据，可只预渲染有意义的公共外壳，或保持普通 SPA 路由。不要为了静态输出填入虚假的价格、订单状态或协议主体。

### 请求、store 与缓存

沿用 UI → 场景 hook → store action → API：工厂只创建稳定初始状态；客户端取得并校验渠道等上下文，再调用数据 action；store 保存 pending/error/结果，场景 hook 处理反馈和导航。当前模板自动同步 URL 渠道上下文，尚未接入渠道配置请求或“提前请求”模块。

- 默认不在构建期请求渠道、登录和订单接口，也不在 render 中发请求。构建可执行多次渲染，不能把导入或渲染次数当成业务访问次数。
- 应用请求实例位于 `src/request.ts`，可安全地被预渲染页面及 store 导入。请求包内部处理浏览器兼容，Node 实际调用会明确报错；不要在 render 或 store 工厂中发起业务请求。`signal` 与 `timeout` 同时生效，生命周期清理由请求包处理。
- store 按所有者创建，禁止模块级业务单例。应用共享实例跨路由保留；页面或弹窗实例按自身生命周期销毁。预渲染时 effect 不运行，不能依赖卸载回调清理构建期间启动的任务。
- `persistStore()` 调用时立即恢复缓存，必须在该页面的客户端 effect 中通过业务 action 接入。只给 storage getter 加 `window` 判断仍会导致首帧数据不同。恢复完成前禁止编辑和提交，避免晚到的缓存覆盖用户输入；具体示例见 [持久化说明](src/stores/README.md#可选持久化)。
- 渠道、用户或订单身份变化时，显式重置或重建所属实例和缓存 key，取消旧请求。不能只依赖空依赖数组 effect：SPA 切换 query 或同一动态路由参数时组件可能复用，业务初始化应响应真正的身份变化。
- 初始化和提交各自防重，轮询、计时器及监听由所属实例清理；旧响应不能回写新渠道状态。请求错误写入 store 并提供重试，异步 Promise 的错误不能依赖组件错误边界处理。
- 页面展示埋点在客户端确认页面及业务上下文后发送，并明确一次导航的去重边界；不在构建或 render 中发送。返回拦截及 BFCache 恢复按 [Browser 包](../../packages/browser/README.md) 的生命周期接入。

### 交互、导航与样式

- HTML 可见时 JS 可能尚未就绪。依赖 JS 的提交按钮默认禁用，客户端接管且业务条件满足后启用；非提交按钮使用 `type="button"`，表单显式处理提交。不要依赖框架重放 hydration 前的点击，也不要用整页 Loading 遮住已经可读的静态首屏。
- 路由 Loading 只表示页面模块正在加载，不代表业务接口完成；业务区域按自己的 pending/error 展示状态。图片、表单及动态数据占位保留合理尺寸，减少数据更新后的布局位移。
- 固定普通链接在 JS 接管前也能导航，必须指向可直接访问的 URL。依赖访问者 query 的业务链接使用上方 `useNavigation()`，客户端同步后启用；它按 `BASE_URL` 拼接相对路径并保留指定参数，Router 本身不自动继承 query。
- CSS 使用 Vite 默认分包，Beasties 在构建后内联匹配整份 HTML 的规则，不测量浏览器首屏范围。页面使用 CSS Modules，全局样式统一放在 `src/style.css`，避免扫描不同页面时同名全局选择器互相影响。
- 外部 CSS 完整保留，供客户端新状态、弹窗和 SPA 跳转使用。内联规则与后续外链有少量重复是当前取舍，不直接启用 `pruneSource`、删除 CSS 文件或屏蔽 Vite 的 CSS 加载；从其他页面进入时可能没有目标页面的内联样式。
- JS 语法构建目标不补齐浏览器 API。SDK、动态导入的依赖与新增 API 仍要遵守[兼容目标](../../README.md#路由样式与兼容)，预渲染可读不等于旧设备动态交互可用。

### 新页面验收

错误和性能采集使用[官方 ARMS RUM](../../docs/monitoring.md)，未配置 endpoint 时关闭。构建错误继续直接抛出；客户端错误边界与路由加载失败会输出原始错误，供 SDK 的 consoleError 采集器捕获，不增加另一套全局异常监听。

1. 构建后直达该页面并刷新，确认返回对应正文 HTML；也从其他页面通过 SPA 进入，不能只验证一种入口。尾斜杠、base 与 fallback 按上方部署约定处理。
2. 限速或阻断 JS/CSS，检查静态首屏样式、禁用按钮和占位；恢复加载后确认 DOM 正常接管、事件可用、没有明显布局跳动。
3. 分别用不同渠道 query、空缓存和已有缓存刷新，检查首帧一致、数据隔离、缓存恢复及错误重试；快速切换业务身份，确认旧响应不会回写。
4. 检查前进后退、离开再进入、重复点击和任务清理；确认构建期间无业务请求或埋点，HTML 不含用户数据。
5. 运行本页“验证”中的检查，并在目标设备验收交互。开发服务器正常、现代浏览器通过或静态 HTML 可读，均不能单独证明生产与旧设备行为。
