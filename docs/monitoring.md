# ARMS RUM

两个应用使用阿里云新版用户体验监控 Web & H5 SDK。仓库只在 `tooling/rum.ts` 配置官方 SDK 并注入 HTML，不维护异常监听、性能采集、上报队列或重试实现；`packages/browser` 继续只负责 History 拦截。

## 启用

在 ARMS 控制台为应用创建 Web & H5 监控，复制生成的完整 endpoint。建议 Landing、Agreement 分别创建应用，方便区分数据。配置写入对应应用的 `.env.test.local` 或 `.env.prod.local`：

```dotenv
VITE_ARMS_ENDPOINT=控制台提供的完整endpoint
VITE_APP_VERSION=本次应用版本
```

不填写 endpoint 时，不注入配置或 SDK，完全不上报。endpoint 是公开前端配置，不要填写 AccessKey。修改后重新启动开发服务或重新构建。

| 项目     | 配置                                                  |
| -------- | ----------------------------------------------------- |
| SDK      | `https://sdk.rum.aliyuncs.com/v2/browser-sdk.js`      |
| 初始化   | `window.__rum`，位于 body 开头、SDK 标签之前          |
| 加载     | 官方 CDN 异步脚本，避免阻塞 HTML 和应用启动           |
| 环境     | 测试 test 对应 RUM daily；生产 prod 对应 RUM prod     |
| 应用区分 | endpoint + `properties.app`                           |
| 页面追踪 | Landing 使用 history 模式；Agreement 使用完整页面导航 |
| 版本     | `VITE_APP_VERSION`，应与被检查的构建一致              |

项目只使用 `test` 和 `prod` 两套环境。`daily` 是 RUM 的日常环境标识，用于承接测试数据；构建命令和环境文件仍使用 `test`。

完整配置以[官方接入文档](https://help.aliyun.com/zh/arms/user-experience-monitoring/access-web-h5-applications)和[SDK 配置参考](https://help.aliyun.com/zh/arms/user-experience-monitoring/web-h5-sdk-configuration-reference)为准。默认采集范围和 SDK 更新由官方维护；SDK 不经过本仓库的语法转换，需要随业务在目标设备验证。

## 错误与业务指标

页面运行异常、资源加载、请求和性能由 SDK 的采集器负责。Landing 的错误边界和路由加载失败保留 `console.error(error)`，避免已被框架处理的异常没有原始信息。应用自己的构建期异常仍然抛出，不通过浏览器监控处理。

表单可操作、渠道配置完成等业务时间需要在真实流程中显式定义。SDK 加载完成后，可通过 `window.RumSDK.default.sendCustom` 上报一次业务就绪耗时；不能把 HTML 可见、hydrate 调用返回或路由加载结束当成业务完成。当前空白业务模板不伪造这些指标，也不等待监控就绪再启动业务。

不要额外注册 window error/unhandledrejection、请求拦截或 PerformanceObserver 来重复发送相同事件。新增自定义事件采用固定名称和必要字段，不直接传 store 快照、手机号、token、请求体或响应体。

## 验证与边界

- SDK 异步加载完成前的错误可能漏报；加载被阻断时，业务页面应照常运行。当前没有自研补报队列。
- 上报与告警还未连接到实际 ARMS 应用。填入 endpoint 后，分别验证两个应用、test/prod 环境、版本字段、SPA 导航、JS 异常、请求失败及资源错误在控制台中的结果。
- 启用前检查 SDK 实际上报字段；URL、错误文本和接口快照可能含业务信息。按真实接口配置官方过滤/脱敏能力，不默认开启用户身份关联、请求正文快照或会话回放。本模板不声称已完成业务数据脱敏。
- 本地自动测试验证配置启停、HTML 注入顺序及预渲染保留 SDK，不向真实 ARMS 服务发送测试数据。
- 首屏 SDK 下载、版本更新和目标旧设备表现需要单独验证；项目自身的体积预算不包含外部 CDN SDK。
