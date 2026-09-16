# Agreement

Preact + Vite 静态协议应用。使用官方 `prerender()` 生成 HTML，浏览器通过 `preact-iso` 的 `hydrate()` 接管页面。当前首页只显示“协议”，不包含业务示例。

## 结构与职责

```text
src/
  main.tsx       唯一入口：浏览器挂载、构建期 prerender
  app.tsx        公共 main 容器、页面组件与未匹配提示
  routes.ts      消费共享路由清单、路径匹配、预渲染路径列表
  pages/
    index.tsx    协议首页
  style.css      协议公共样式
  theme.css      主题覆盖
```

`vite.config.ts` 使用 `preact({ prerender: { enabled: true, renderTarget: '#app' } })`。`index.html` 在入口脚本上声明 `prerender`，`main.tsx` 导出预渲染函数。没有自定义构建脚本、独立 SSR 构建、开发 SSR 服务或插件钩子补丁。

依据：[Preact 官方示例](https://github.com/preactjs/create-preact/tree/master/templates/config/prerender)、[preact-iso hydrate](https://github.com/preactjs/preact-iso#hydrate)。相对官方最小示例，只保留两项应用需求：目录协议发现，以及生产 HTML 内联公共样式。test/prod、部署前缀、端口和 PostCSS 沿用仓库配置。

## 新增协议

创建 `src/pages/<name>/index.tsx`，导出标题与默认组件：

```tsx
export const title = '协议标题';

export default function AgreementPage() {
  return <h1>{title}</h1>;
}
```

支持多级目录。共享 `tooling/file-routes` 插件以 eager 模式收集页面，`routes.ts` 提供具体预渲染地址，不依赖首页是否包含链接；例如 `pages/privacy/index.tsx` 对应 `/agreement/privacy/`，产物为 `dist/privacy/index.html`。协议间使用普通 `<a>` 完整导航，不引入 SPA 路由。下划线目录不作为普通页面。动态参数目录在构建时明确报错；生产未知路径返回 404，开发未匹配路径显示提示。

## 样式与动态内容

公共样式放在 `style.css`，可使用 CSS `@import`，页面不单独导入 CSS。生产由 `prerender()` 的 `head.elements` 内联编译后的样式；开发先通过 Vite 加载 CSS 再挂载页面，使用原生 CSS HMR。尺寸使用 px 和响应式容器，不做 px 转 rem。

组件同时用于预渲染与浏览器。首次渲染的数据必须一致，浏览器缓存、查询参数和接口请求放到 effect 中处理；重要正文保留静态默认内容。关闭 JavaScript 仍可阅读正文。

需要接口时按需声明 `@packages/api` / `@packages/request`。浏览器使用 request 的 browser 入口，构建期使用默认入口与绝对 baseURL。当前不引入请求代码、不共享 Landing 的全局状态。

## 开发、构建与兼容性

仓库根目录执行：

- `pnpm dev:agreement`：开发地址 `http://127.0.0.1:5174/agreement/`。
- `pnpm --filter @apps/agreement build:test`：执行 `vite build --mode test`。
- `pnpm --filter @apps/agreement preview:test`：预览地址 `http://127.0.0.1:4174/agreement/`。
- prod 使用 `build:prod` / `preview:prod`，两种环境均输出 `dist`，以后一次构建为准。

`.env.test` / `.env.prod` 的 `VITE_BASE_PATH` 控制部署前缀，`VITE_APP_ENV` 与 mode 一致。部署按目录提供静态文件，不配置 SPA 回退；正式链接使用末尾斜杠。

协议暂未启用 legacy，动态交互使用 Vite 默认现代浏览器目标，Chrome 49 / iOS 10 的交互兼容后续补齐。静态样式继续沿用共享 CSS 目标。预渲染模块会输出到产物中，但浏览器启动不调用它；`preact-render-to-string` 由 pnpm 自动安装 peer dependency。

验证使用 `pnpm typecheck`、`pnpm lint`、`pnpm test`。构建后执行 `pnpm check:build test` 与 `pnpm test:browser`；开发回归使用 `pnpm test:browser:dev`。测试覆盖多协议、自定义 base、标题转义、样式内联、静态 404、hydration 复用原节点和动态交互。

文件选择约定由 Vite 中的 fileRoutes 配置声明；完整选项见 [共享文件路由](../../tooling/file-routes/README.md)。如需平铺页面，调整 include，无须修改核心。_404/index.tsx 可提供组件兜底，但不会自动生成部署服务器的 404 文件。
