# Browser regression fixture

fixture 仅用于自动化验证请求、反馈、Modal、路由与 browser 接入，不属于正式 Landing 应用。

旧演示交互移到这里以保留已存在的浏览器回归覆盖。文件路由解析、路由 loading hook 和兼容补丁引用正式源码；请求/反馈/browser 使用真实公共包。fixture-api 只提供测试数据协议，不由 packages/api 导出。

在仓库根目录执行 `pnpm --filter @apps/landing test:build`，生成 `apps/landing/test/dist`。Playwright 在 4176 独立启动，路径为 `/landing/`；夹具固定使用 test 模式，不受 `BUILD_MODE` 影响。正式应用的 build:test/build:prod 不构建这里，也不发布这些页面。正式应用另由 scaffold.spec.ts 检查空白入口、404、静态协议与示例资源清理。

完整回归执行 `pnpm test:browser`，需提前构建两应用并保持 4173–4176 端口空闲。命令及环境切换见[根 README](../../../README.md)，正式代码职责见 [Landing 架构](../ARCHITECTURE.md)。
