# @packages/request

面向浏览器的 ofetch 1.5.1 适配层，Landing 与 Agreement 共用。负责传输兼容、取消与超时，不读取应用环境变量、store、渠道或 token，不展示反馈，也不解析业务 code。

## 统一入口

```ts
import { createRequestClient, createAbortController } from '@packages/request';

const request = createRequestClient({ baseURL: '/api' });
const controller = createAbortController();

const data = await request<unknown>('/orders', {
  method: 'POST',
  body: { product: 'example' },
  query: { channel: 'web' },
  signal: controller.signal,
  timeout: 10000,
});
// 离开页面或结束流程时：controller.abort();
```

公开运行时入口只有 `createRequestClient`、`createAbortController` 和 `FetchError`。ofetch 类型通过 `export type *` 转导出，客户端类型仍为 `$Fetch`。浏览器能力选择在包内部完成，应用不区分 browser/Node 工厂。

默认 `retry: 0`、`timeout: 10000`、`credentials: 'same-origin'`，可以按实例或单次调用覆盖。`createRequestClient` 的第二个参数可注入测试传输，但不能绕过 Node 执行限制。

- `request()` 返回解析后的数据。
- `request.raw()` 返回含 `_data` 的 Response，便于读取状态和响应头。
- `request.create()` 创建派生实例，保留相同的兼容、环境检查与生命周期行为。
- `request.native()` 是高级底层入口：仅执行环境检查和传输适配，不应用实例 baseURL、hooks、超时及重试；取消由其原生 signal 控制。

## 应用与接口层

应用在 `src/lib/request.ts` 中创建一次客户端，配置自己的 `baseURL`，并可通过 `onResponse` 检查后端统一响应协议、转换业务错误。共享接口放在 `packages/api`，接收客户端及业务参数，直接返回请求结果；具体数据校验和业务状态由调用方处理。实例不固定首次访问的渠道或认证信息，需要动态请求头时每次请求读取最新值：

```ts
const request = createRequestClient({
  baseURL: '/api',
  onRequest({ options }) {
    options.headers.set('authorization', getCurrentToken());
  },
});
```

`getCurrentToken` 由应用提供。请求级同名 hook 覆盖实例 hook，需要组合时显式使用函数数组。URL、query、body、headers 合并和响应解析沿用 ofetch，不另设同义 API。绝对 URL 仍会沿用实例请求头，不同服务应使用独立实例。

泛型只提供静态提示，不验证服务端数据。API 函数直接返回请求结果，由调用方业务层（例如 Landing 的 store action）按业务契约校验所需字段；JSON 解析沿用 ofetch 的宽松解析器，非法 JSON 可能返回字符串，无内容响应可能返回 undefined。

## 取消与超时

`request()`、`.raw()` 和派生实例使用同一套生命周期规则：

- `signal` 与 `timeout` 同时生效。内部创建独立控制器，超时不会 abort 调用方的控制器，也不会取消其他请求。
- 默认总时限 10 秒，0 关闭超时。时限从首次 `onRequest` 完成后开始，覆盖发送、响应体读取、后续 hooks 及重试等待；重试不会重新计时。首次 hook 可以设置 signal/timeout，开始后不再替换本次调用的取消来源与截止时间。
- 调用结束清理本次计时器和外部 signal 监听。已取消的 signal 不发送网络请求。取消或超时后不发起新尝试；已经开始的服务端操作无法撤销。
- 超时或取消立即结束调用。原生传输会尝试中止；已经运行的用户 hook、解析器或 ofetch 重试等待无法强制终止，调用方不要在异步 hook 中安排不受控的业务副作用。迟到的响应不再进入响应成功 hook。
- `responseType: 'stream'` 的调用在返回流后结束；之后消费流的时限由调用方负责。XHR 降级不支持流式响应。

默认不重试。确需重试时接口显式设置 `retry`，写操作先确认后端幂等约定。

## 错误

HTTP 4xx/5xx、发送阶段网络错误使用 ofetch `FetchError`，保留 `status`、`data`、`response` 和 cause。统一业务 code 可在应用请求实例中检查并转换为业务错误，API 函数原样返回请求结果；场景层决定如何反馈错误。应用的 `onResponse` 不应覆盖原有 HTTP 错误。

取消与超时统一拒绝为 `FetchError`：`error.cause.name` 分别为 `AbortError`、`TimeoutError`，兼容传输下也保持一致。不要直接依赖控制器的 reason 或 AbortSignal.any/timeout 等较新的 API。

序列化、解析器和 hook 的普通异常保留原异常，不保证是 FetchError；Node 执行限制抛出明确 Error。调用方捕获 unknown 后收窄，错误 message 可能包含 URL，不直接用作用户提示。

## 预渲染与兼容

模块可以在 Node 预渲染中导入，客户端也可安全创建；这些操作不发送请求、不启动计时器。实际调用任何请求入口会拒绝并提示“业务请求不能在 Node 预渲染阶段执行”，不会静默返回空数据，也不会调用传输或 hooks。业务请求必须由客户端 effect 或事件启动。

浏览器中优先使用支持取消的原生 fetch，否则使用 whatwg-fetch 的 XHR 传输及匹配的 Headers；缺少 AbortController 时使用兼容控制器。适配代码静态导入，不增加异步加载阶段。`whatwg-fetch.js` 和同名声明只为上游导出提供本地类型入口。

语法目标由应用构建控制：Chrome 64、Safari 11.1 / iOS 11.3、Firefox 67、Edge 79。Promise、Symbol、Set、URLSearchParams 使用目标浏览器能力。XHR 不支持完整的 cache、redirect、keepalive 和流式响应语义；通用业务接口使用 URL 字符串和普通 headers 对象，不混用不同实现的 Request/Headers。

Agreement 仅在有动态业务请求时引入本包，静态正文不加载请求代码。两个应用独立构建，不保证资源下载缓存跨应用复用。

## 验证

`tests/request.test.ts` 验证公开入口、ofetch 行为、取消/超时组合、响应体时限、并发隔离、重试截止时间、清理和 Node 调用限制。`tests/browser/request.spec.ts` 覆盖原生、缺少取消 API、缺少 Fetch API 三种真实浏览器传输场景。预渲染夹具验证真实应用请求模块可安全导入。

执行 `pnpm test`、`pnpm typecheck`、`pnpm lint` 及根 README 的构建/浏览器回归。现代 Chrome/WebKit 中模拟能力缺失，不等于最低版本设备验收。
