# Agreement

Preact + Vite 静态协议应用，默认部署在 `/agreement/`，独立于 Landing 构建和部署。TSX 正文在构建时生成 HTML，浏览器不加载正文组件或执行整页 hydration。当前入口仅显示“协议”标题，没有正式条款或示例请求。

## 开发与构建

以下命令在仓库根目录执行：

```powershell
pnpm dev:agreement
pnpm --filter @apps/agreement check
pnpm --filter @apps/agreement build:test
pnpm --filter @apps/agreement preview:test
```

- 开发地址：`http://127.0.0.1:5174/agreement/`；服务端实时渲染 TSX，保存后刷新。
- 预览地址：`http://127.0.0.1:4174/agreement/`，读取 `dist`。
- prod 使用 `build:prod` / `preview:prod`，输出 `dist`。
- 两种环境统一使用 Vite mode，不再维护额外的模式变量。
- `.env.test` / `.env.prod` 的 `VITE_BASE_PATH` 控制部署前缀，`VITE_APP_ENV` 必须与 mode 一致。当前没有 API 请求，`VITE_API_BASE_URL` 尚未接入运行时。
- 部署按输出目录提供静态文件，不配置 SPA 回退。未知协议返回 404。

## 页面与静态生成

| 位置                              | 职责                                           |
| --------------------------------- | ---------------------------------------------- |
| `index.html`                      | 公共文档 head、环境元信息、首屏样式            |
| `src/pages/index.tsx`             | 默认协议入口                                   |
| `src/pages/<name>/index.tsx`      | 每份正式协议，支持多级目录                     |
| `src/layouts/agreement/index.tsx` | 静态正文容器                                   |
| `src/prerender.tsx`               | 发现页面、调用 Preact 渲染、提供生成路径和标题 |
| `src/style.css`                   | 协议排版与响应式布局                           |
| `src/theme.css`                   | 公共主题覆盖                                   |
| `src/main.ts`                     | 独立浏览器增强入口，目前无动态业务             |
| `vite.config.ts`                  | 静态预渲染、开发 HTML 和独立 IIFE 构建         |

新增协议时创建 `src/pages/<name>/index.tsx`，导出 `title` 和默认 Preact 组件即可。正文由业务提供，不用示例条款替代正式法律文本。

```tsx
export const title = '协议标题';

export default function AgreementPage() {
  return <h1>{title}</h1>;
}
```

例如 `src/pages/privacy/index.tsx` 输出 `dist/privacy/index.html`，访问 `/agreement/privacy/`。所有页面均显式交给预渲染插件，不依赖首页是否包含链接。没有客户端路由，跳转使用普通 `<a>`。当前只支持确定的目录路径，不支持 `[id]`、URL 查询参数生成无限页面或 Landing 的路由约定。

预渲染使用 [@preact/preset-vite 官方能力](https://github.com/preactjs/preset-vite#prerendering-configuration) 和 `preact-render-to-string`。构建专用 JS 会从发布产物移除，正文不依赖 Preact 浏览器运行时。不要在页面组件中读取 `window`、操作 DOM 或依赖 `useEffect`：这些组件只在 Node 中执行。

开发和发布的浏览器脚本共用 `vite.config.ts` 内的 `buildRuntime()`，统一使用当前 mode、base 和样式配置。开发启动仅等待 watch 的第一次构建，后续改动由同一个 watcher 更新。

## 样式与动态增强

所有协议样式统一放在 `src/style.css`，TSX 正文组件不再单独导入 CSS。开发与发布复用同一份编译结果；主题变量、CSS `@import` 和兼容性处理仍由 Vite/PostCSS 完成。

关闭 JavaScript 仍可阅读正文；公共样式通过 Vite 的 `?inline` 编译后直接写入 HTML 的 `<style id="agreement-style">`，不请求独立 CSS，也不等待脚本挂载。使用普通 px 和响应式容器，不做 Landing 的 px 转 rem。主题变量沿用共享 PostCSS 编译及旧浏览器 CSS 目标。

动态内容从 `src/main.ts` 接入：少量字段直接更新对应 DOM；复杂交互可单独挂载 Preact 组件到预留容器。不要替换整篇正文。运行时获取的渠道、用户和订单信息不能在构建时预先确定，静态部分必须保留合理的阅读内容。

浏览器代码与静态页面依赖图独立。动态组件需要的 CSS 统一放入文档的 `src/style.css`（可使用 CSS `@import`），随初始 HTML 内联；不要只通过 `main.ts` 导入样式，导致样式等待动态脚本或生成无人引用的 CSS。

后续请求可按需声明 `@packages/request` 与 `@packages/api` 依赖，复用业务接口。浏览器使用 `@packages/request/browser`，构建时使用默认入口及绝对 baseURL，不把 browser 入口导入 Node。当前没有动态接口，不为预留能力加载请求库，也不共享 Landing 的全局 store。

浏览器 IIFE 沿用 Chrome 49、iOS 10 / Safari 10 目标。构建时的 Preact 和 Node 能力不提高静态正文的设备要求；运行时 API 仍需按实际使用补齐。开发服务含现代 Vite HMR 脚本，旧设备验收使用构建后的预览。现代浏览器通过测试不等于旧设备验收。

## 验证

根目录执行 `pnpm typecheck`、`pnpm lint`、`pnpm test`。两个应用构建后执行 `pnpm check:build test`、`pnpm test:browser`；开发服务执行 `pnpm test:browser:dev`。prod 对应 `pnpm build:prod` 与 `pnpm check:build prod`。

`tests/agreement-build.test.ts` 用临时协议验证多页输出、自定义部署前缀、标题转义、公共样式内联、无独立 CSS 和客户端组件脚本和静态 404。浏览器回归验证禁用 JavaScript 阅读、脚本延迟时的样式稳定及刷新。测试内容不会进入正式应用。
