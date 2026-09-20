# 质量检查与验收

## 自动检查

`.github/workflows/check.yml` 在 PR、main 提交及手动触发时执行 test/prod 两个独立任务。每个任务使用 Node 24、packageManager 指定的 pnpm 和冻结锁文件，依次运行格式、Lint、类型、单元测试、两个应用构建、产物检查、浏览器回归。test 任务额外执行开发模式回归。工作流不包含部署操作。

当前规模对所有修改检查两个应用；公共包、tooling、锁文件变化都不会漏掉消费者。类型检查分别覆盖公共包/工具、两个应用和跨应用测试。测试创建临时构建夹具，格式/Lint 与这些测试不要在同一 checkout 中并行运行。

`tests/workspace-boundaries.test.ts` 检查正式源码的静态导入、可识别的动态导入、CSS import、公开入口与声明的依赖图；它不能识别运行时拼接的模块路径或替代业务职责审查。store 规则由 `tests/store-boundaries.test.ts` 单独维护。

## 资源预算

`pnpm check:build test` / `pnpm check:build prod` 同时检查 `tooling/budgets.json`。单位是 gzip 后的字节：JS/CSS 按整个应用产物求和，HTML 取最大的单个页面。这样即使依赖拆成多个 chunk，也不能绕过总量限制。

| 应用      | JS 总量 | CSS 总量 | 单页 HTML |
| --------- | ------- | -------- | --------- |
| Landing   | 64 KiB  | 16 KiB   | 20 KiB    |
| Agreement | 32 KiB  | 8 KiB    | 16 KiB    |

这些是当前模板的初始预算，并非行业统一标准。新增业务需要扩容时，应说明新增资源、实际首屏影响和测量结果，再调整预算。该检查不包含图片、视频和第三方 CDN 资源，也不等于真实首屏下载量或 LCP。

## 浏览器回归

首次运行：`pnpm exec playwright install chromium webkit`。构建正式应用后执行 `pnpm test:browser`。

- Chromium：现有完整回归，包括请求、持久化、Modal、History、路由和预渲染。
- WebKit：正文与样式、hydration、SPA 导航、资源失败提示、无 fetch/AbortController 的请求降级。
- 首屏回归通过阻断 JS/CSS 检查静态内容和样式；放开网络后检查原 DOM 被接管、按钮可用与布局稳定。
- 临时业务夹具覆盖真实请求入口的服务端导入。夹具页面不进入正式应用产物。

测试需要 4173–4176 空闲。`pnpm test:browser --project=chromium` 可只运行 Chromium；CI 默认使用 Playwright 自带内核，本地该项目默认使用安装的 Chrome。开发测试使用 5173/5174。

## 目标设备验收

构建目标继续为 Chrome 64+、iOS 11.3 / Safari 11.1+、Firefox 67+、Edge 79+。现代 Chromium/WebKit 自动测试不代表这些最低版本已经通过验收。每次引入浏览器 API、SDK 或关键流程变化时，在业务实际使用的旧设备/WebView 上记录以下结果：

| 场景                    | 通过条件                                           |
| ----------------------- | -------------------------------------------------- |
| 直达、刷新、query 变化  | 正确静态正文，无串渠道数据或 hydration 错位        |
| 弱网/CPU 降速           | 首屏持续可读，JS 接管前不误提交，接管后正常交互    |
| 接口失败、超时、重试    | 错误可恢复，重复点击不重复提交，旧响应不覆盖新状态 |
| 路由资源失败            | 有错误提示和人工重载入口，不自动循环刷新           |
| 弹窗、前进后退、BFCache | 拦截与释放正确，返回后按页面生命周期重新接入       |
| 持久化与多渠道          | 恢复时机一致，业务身份隔离，缓存损坏可降级         |
| RUM 启用/阻断           | 不阻塞业务，控制台指标可区分应用、环境和版本       |

验收记录至少包含设备/系统/WebView 版本、应用版本、入口和渠道、网络条件、首屏可见时间、业务可操作时间、结果。真实业务的渠道初始化、表单提交和旧设备测试应由接入业务的项目补齐，不能用当前模板夹具冒充完成。
