# @packages/api

公共业务接口层。原 SiteConfig 示例请求与示例类型已删除，当前仅保留包入口，不提供虚构业务接口。

新增接口时导出请求函数、输入输出类型及必要的响应校验/转换。请求客户端由使用方注入（@packages/request 的 RequestClient）；渠道、环境和会话如何选取由应用决定。不要依赖 Preact、路由或反馈组件。

Landing 在 apps/landing/src/api/index.ts 创建浏览器请求实例。Astro 后续有动态业务请求时可绑定相同接口；不要复制业务接口实现。
