# Agreement

Preact 静态协议应用。Vite 在构建期发现页面，官方预渲染插件生成 HTML，浏览器通过 preact-iso hydration 接管组件。

## 结构

```text
src/
  main.tsx       浏览器入口和 prerender：选页面、设置标题、渲染
  app.tsx        只接受 children，提供 main 容器
  routes.ts      页面匹配、静态地址列表与 404 回退
  pages/
    index.tsx    协议首页
    _404/index.tsx  页面不存在提示与返回首页入口
  style.css      公共样式
  theme.css      主题覆盖
  virtual.d.ts  构建生成页面模块的类型
```

App 不查路由、不接收组件参数、不判断页面是否存在。入口只查找一次页面，将 JSX 内容传给 App；预渲染和浏览器使用同一份页面组件。未知构建地址直接报错，浏览器未匹配时显示 404 内容。

## 新增页面

创建 `src/pages/<name>/index.tsx`：

```tsx
export const title = '协议标题';

export default function AgreementPage() {
  return <h1>{title}</h1>;
}
```

支持多级目录。例如 `privacy/index.tsx` 对应 `/agreement/privacy/`，输出 `dist/privacy/index.html`。页面发现由 [pages 插件](../../tooling/pages/README.md) 在构建期完成，不依赖首页链接。动态参数在构建时拒绝。

页面之间使用普通 `<a>` 完整导航。`_404/index.tsx` 仅用于开发环境或客户端未匹配提示，不生成静态错误页。构建只输出真实协议页面，生产未知地址由服务器返回 HTTP 404。

## 样式和交互

公共样式统一放在 style.css，主题覆盖放在 theme.css。尺寸使用 px 和响应式容器。生产 HTML 内联编译后的 CSS；开发等待 CSS 加载再挂载，避免首屏样式跳动。样式修改使用 Vite 的正常 HMR。

正文应能静态渲染。浏览器查询参数、缓存和请求放到 effect 中，首次渲染与静态 HTML 保持一致。无 JavaScript 时仍能阅读正文。

接口按需使用工作区请求包，当前没有示例请求或业务状态。需要静态资源时可使用 Vite 标准 public 目录，不再维护独立 runtime 脚本。

## 开发和部署

- `pnpm dev:agreement`：http://127.0.0.1:5174/agreement/
- `pnpm --filter @apps/agreement build:test`：构建 test。
- `pnpm --filter @apps/agreement build:prod`：构建 prod。
- `pnpm --filter @apps/agreement preview:test`：http://127.0.0.1:4174/agreement/

两种环境均输出 dist，以最后一次构建为准。VITE_BASE_PATH 控制部署前缀，VITE_APP_ENV 必须与 mode 一致。部署按目录提供静态文件，正式链接带末尾斜杠，未知地址由服务器返回 404。

保留官方 `preact({ prerender: { enabled: true, renderTarget: '#app' } })`，没有自定义构建脚本、SSR 开发服务或双输出补丁。依赖仅为 Preact、preact-iso 和共享主题包；preact-render-to-string 由 pnpm 自动安装 peer dependency。

JS 与 CSS 使用仓库统一目标：Chrome 64+、Safari 11.1+ / iOS 11.3+、Firefox 67+、Edge 79+。输出原生 ES 模块，不提供 legacy 入口；最低版本尚需真机验收。

验证：类型检查、Lint、多页与自定义 base 构建测试、浏览器 hydration 及刷新样式稳定性测试。
