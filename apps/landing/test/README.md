# Browser regression fixture

fixture 仅用于自动化验证请求、反馈、Modal、路由与 browser 接入，不属于正式 Landing 应用。

`async-modal.html` / `async-modal.tsx` 动态导入真实组件分包，用于验证异步 Modal 的加载、失败、重试、焦点恢复及多层取消。`tests/browser/async-modal.spec.ts` 包含 modern/legacy 入口测试；页面仅作为自动化夹具，不添加正式示例路由。

`request.html` / `request.ts` 是无 UI 框架依赖的独立 ofetch 请求测试入口。`tests/browser/request.spec.ts` 在原生能力、缺少取消 API、缺少整个 Fetch API、强制 legacy 构建并移除 Promise/URL API 四种环境验证真实请求、请求头、HTTP 错误、禁止默认重试、超时和取消。仅模拟 API 缺失，不代表实际旧设备测试。

`persist.html` / `persist.ts` 是独立 store 持久化测试入口，引用正式 core 扩展。`tests/browser/persist.spec.ts` 验证 sessionStorage 刷新恢复和标签页隔离、localStorage 不同渠道 key、停止同步与清缓存、存储不可用以及 legacy 入口。测试只使用测试浏览器的 fixture 缓存，不接入正式 Landing 页面。

旧演示交互移到这里以保留已存在的浏览器回归覆盖。文件路由解析、路由 loading hook 和兼容补丁引用正式源码；请求/反馈/browser 使用真实公共包。fixture-api 只提供测试数据协议，不由 packages/api 导出。

在仓库根目录执行 `pnpm --filter @apps/landing test:build`，生成 `apps/landing/test/dist`。Playwright 在 4176 独立启动，路径为 `/landing/`；夹具固定使用 test 模式，不受 `BUILD_MODE` 影响。正式应用的 build:test/build:prod 不构建这里，也不发布这些页面。正式应用另由 scaffold.spec.ts 检查空白入口、404、静态协议与示例资源清理。

完整回归执行 `pnpm test:browser`，需提前构建两应用并保持 4173–4176 端口空闲。命令及环境切换见[根 README](../../../README.md)，正式代码职责见 [Landing 架构](../ARCHITECTURE.md)。

夹具中的组合函数与正式应用一致，使用 `src/hooks/use-<name>/index.ts(x)` 组织；调用方导入目录，夹具内部引用保持相对路径。`use-loading/index.ts` 复用正式应用的 `@/hooks/use-loading`。
