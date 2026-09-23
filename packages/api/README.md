# @packages/api

公共业务接口层。原 SiteConfig 示例请求与示例类型已删除，当前仅保留包入口，不提供虚构业务接口。

新增接口时导出请求函数和输入输出类型，函数定义地址、方法及参数后直接返回 `request(...)`。请求客户端由使用方注入，类型统一使用 `import type { $Fetch } from '@packages/request'`；渠道、环境和会话如何选取由应用决定。不要依赖 Preact、路由或反馈组件。

Landing 在 `apps/landing/src/lib/request.ts` 创建请求实例。Agreement 后续有动态业务请求时可绑定相同接口；不要复制业务接口实现。请求包统一处理浏览器兼容，预渲染阶段允许导入和创建实例，实际请求会明确报错。

传输使用 ofetch 实例，直接返回 `request<ResponseType>(url, { body, query })`，需要 HTTP 元信息时使用 `request.raw()`。约定见 [request 包](../request/README.md)。API 不判断业务 code、不提取 `data`；应用注入的客户端负责统一响应协议与业务错误转换，调用方业务层（例如 Landing 的 store action）校验和整理具体数据、判断业务状态。不同协议应绑定各自的客户端。响应可能是 undefined 或宽松解析后的文本，泛型不代替运行时校验。HTTP 和发送阶段的网络/取消错误使用 FetchError；其他阶段的异常可能是原始 Error。业务 code 不写死在通用传输包中。

应用适配以普通函数传入每次请求所需的认证和渠道参数，不在接口包读取应用 store 或展示反馈。默认禁止重试；`signal` 和 `timeout` 同时生效，超时覆盖响应体读取及重试，默认总时限 10 秒。流程所有者负责在销毁时取消任务，不再自行组合超时计时器。
