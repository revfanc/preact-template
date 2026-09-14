# @packages/api

公共业务接口层。原 SiteConfig 示例请求与示例类型已删除，当前仅保留包入口，不提供虚构业务接口。

新增接口时导出请求函数、输入输出类型及必要的响应校验/转换。请求客户端由使用方注入，类型统一使用 `import type { $Fetch } from '@packages/request'`；渠道、环境和会话如何选取由应用决定。不要依赖 Preact、路由或反馈组件。

Landing 在 apps/landing/src/api/index.ts 创建浏览器请求实例。Agreement 后续有动态业务请求时可绑定相同接口；不要复制业务接口实现。

传输使用 ofetch 实例，直接调用 `request<unknown>(url, { body, query })`，需要 HTTP 元信息时使用 `request.raw()`。约定见 [request 包](../request/README.md)。响应可能是 undefined 或宽松解析后的文本，接口需要数据时应显式检查并校验结构；泛型不代替运行时校验。HTTP 和发送阶段的网络/取消错误使用 FetchError；其他阶段的异常可能是原始 Error。HTTP 200 内的失败 code 由业务接口解析，不放入通用传输层。

应用适配以普通函数传入每次请求所需的认证和渠道参数，不在接口包读取应用 store 或展示反馈。默认禁止重试；传入 signal 后，ofetch v1 不再应用内置 timeout，流程取消和截止时间由调用方负责。
