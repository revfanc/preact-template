# @packages/request

Landing 与 Agreement 共用的 ofetch 实例工厂，不依赖 Preact、store 或反馈 UI。使用固定版本 ofetch 1.5.1；URL、query、请求体、响应解析、错误和 hooks 均使用 ofetch 原有能力，不再维护另一套请求协议。

## 入口

- `@packages/request`：运行时仅导出 `createRequestClient` 和 `FetchError`；通过 `export type * from 'ofetch'` 完整转导出上游类型。默认入口不安装浏览器补丁，适合 Node 构建进程或能力完整的运行环境。
- `@packages/request/browser`：`createBrowserRequestClient`、`createBrowserAbortController`。应用浏览器代码统一使用这个入口创建实例。
- 工厂返回完整的 ofetch `$Fetch` 实例，支持函数调用、`.raw()` 和 `.create()`；`.native()` 直接调用底层 fetch，不应用默认请求配置和 hooks。

包定位为 ofetch 的项目适配层：类型保留上游名称，不维护同义别名或手工导出清单。调用方统一从包入口导入 `$Fetch`、`FetchOptions`、`FetchContext`、`FetchHook`、`ResponseType`、`CreateFetchOptions` 等类型。类型导出不会增加运行时代码；原始 `ofetch` / `$fetch` 实例、`createFetch`、`createFetchError` 等运行时工具不转导出，应用通过项目工厂创建实例。后续升级依赖时，上游类型自动随导出更新，仍需检查破坏性变化并运行回归测试。

包只设置三个可覆盖的默认值：`retry: 0`、`timeout: 10000`、`credentials: 'same-origin'`。不自动重试、弹 Toast、读取 token 或处理业务 code。需要重试时，由具体接口显式设置，写操作先确认后端幂等约定。

## 使用

```ts
import { createBrowserRequestClient } from '@packages/request/browser';

const request = createBrowserRequestClient({ baseURL: '/api' });

const data = await request<unknown>('/orders', {
  method: 'POST',
  body: { product: 'example' },
  query: { channel: 'web' },
});
const text = await request('/agreement', { responseType: 'text' });
const response = await request.raw('/orders/1');
// response.status、response.headers、response._data
```

业务 API 接收 `$Fetch` 并对返回值做结构校验；ofetch 的泛型只提供静态提示，不验证服务端数据。默认按 Content-Type 解析；JSON 使用 ofetch 的宽松解析器，格式不正确时可能返回字符串，HEAD/204/205 等无内容响应可能返回 undefined。不要把 `request<MyData>()` 理解成运行时保证。

应用创建自己的实例，在应用 API 适配函数中传入每次请求所需的渠道、认证和会话字段。确需统一请求头时可使用 ofetch 的 `onRequest`，在每次执行时获取最新值：

```ts
const request = createBrowserRequestClient({
  baseURL: '/api',
  onRequest({ options }) {
    options.headers.set('X-Channel', getCurrentChannel());
  },
});
```

此处 `getCurrentChannel` 由应用提供。不要把首次读取的会话值固定在长期实例中。ofetch 的请求级同名 hook 会覆盖实例默认 hook；需要组合时显式传入函数数组，不能假设自动串联。

URL 拼接、query 编码、请求体和 headers 合并均遵循 ofetch。业务接口使用可信的 URL 字符串及普通对象形式的 headers，兼容入口不承诺原生 Request/Headers 对象能跨原生与补丁实现混用。绝对 URL 会沿用实例的认证头，其他服务应使用独立实例。

## 取消与超时

```ts
import { createBrowserAbortController } from '@packages/request/browser';

const controller = createBrowserAbortController();
const pending = request('/orders/1', { signal: controller.signal });
// 页面卸载或流程结束：
controller.abort();
```

遵循已锁定的 ofetch v1.5.1 发布包行为：

- 不传 signal 时，默认 10 秒超时；`timeout` 可覆盖，0 关闭。
- **传入 signal 后，ofetch 不创建内置超时。** 此时取消和截止时间由调用方负责；不能认为 `signal + timeout` 会自动组合。需要截止时间时，调用方设置计时器执行 controller.abort()，并在 finally 清理。
- 内置超时在 fetch 返回响应后清理。原生 fetch 收到响应头即可返回，因此不覆盖随后读取响应体的时间；XHR 补丁通常在完整响应到达后返回。
- 兼容控制器不保证支持 reason、throwIfAborted、AbortSignal.any/timeout；不要在面向旧设备的业务中直接依赖这些 API。

## 错误

HTTP 4xx/5xx 和发送阶段的网络/取消错误由 ofetch 的 `FetchError` 表示，保留 `status`、`data`、`response` 和底层 cause；响应头使用 `error.response?.headers.get(name)`，能读哪些头仍受 CORS 限制。HTTP 200 内的失败 code 由 packages/api 判断。

序列化、解析器、响应体读取及 hook 抛出的异常不保证是 FetchError；调用方捕获 unknown 后再收窄。错误 message 可能包含 URL，不直接作为用户提示。

旧版取消补丁不保存 abort reason，所以超时可能以 AbortError 为 cause；不能跨设备仅凭 cause.name 区分手动取消与超时。已由自己持有的 controller 取消时，使用其 signal.aborted 判断。

## 旧设备与协议应用

浏览器入口检测原生 fetch 是否支持取消：支持时用原生传输，否则注入基于 XHR 的 whatwg-fetch 及匹配的 Headers；缺少 AbortController 时注入 abort-controller。补丁静态导入，不增加异步加载阶段，也不强制覆盖可用的原生 fetch。

应用构建负责语法转换；Promise、Symbol、Set、URLSearchParams 使用目标浏览器原生能力。目标为 Chrome 64、Safari 11.1 / iOS 11.3、Firefox 67、Edge 79；browser 入口保留 Fetch 与 AbortController 的能力检测及降级。XHR 补丁不提供流式响应、keepalive、完整的 cache/redirect 控制；本模板旧设备场景使用普通 JSON、文本和表单请求。

协议正文由 Preact SSG 生成静态 HTML。构建时请求用默认入口及绝对 baseURL；浏览器实时内容才声明包依赖并使用 browser 入口，复用 packages/api 中的接口。Agreement 使用统一构建目标，接入请求时使用 browser 入口补齐请求相关 Web API。当前没有动态接口，不为共享而让静态协议加载请求库。

两个应用独立构建，不保证下载缓存跨应用复用。体积评估应包含 ofetch、Fetch/Abort 补丁和应用 polyfill。

## 验证

测试覆盖默认禁止重试、headers/hooks、响应信息、取消与超时，防止升级依赖时改变公开契约。

运行 `pnpm test`、`pnpm typecheck`、`pnpm lint`。浏览器回归见 `tests/browser/request.spec.ts`：独立测试入口验证原生、缺少取消 API、缺少整个 Fetch API 三种情况。运行方式见根 README；测试页面不进入正式应用。

测试在现代 Chrome 中模拟能力缺失，不替代 Chrome 64 或 iOS 11.3 真机验收。

参考：[ofetch v1 文档](https://github.com/unjs/ofetch/tree/v1)、[whatwg-fetch 兼容说明](https://github.com/JakeChampion/fetch)。升级时核对实际安装的发布产物及测试，不能以开发分支行为代替锁定版本。
