# Agreement

Astro 静态协议应用，默认部署在 `/agreement/`，独立于 Landing 构建和部署。当前入口仅显示“协议”标题与公共布局，没有正式条款。原隐私示例、动态字段请求和重试按钮已删除。

## 开发与构建

以下命令在仓库根目录执行，安装和工具链见[根 README](../../README.md)。

```powershell
pnpm dev:agreement
pnpm --filter @apps/agreement check
pnpm --filter @apps/agreement build:test
pnpm --filter @apps/agreement preview:test
```

- 开发地址：`http://127.0.0.1:5174/agreement/`。
- 预览地址：`http://127.0.0.1:4174/agreement/`，读取 `dist/test`。
- prod 使用 `build:prod` / `preview:prod`，输出 `dist/prod`。
- 部署时按构建后的目录结构提供静态文件，无需 SPA 路由回退。

`.env.test` / `.env.prod` 中的 `VITE_BASE_PATH` 控制部署前缀，`VITE_APP_ENV` 与构建模式一致。脚本通过 `AGREEMENT_MODE` 同步 Astro 和独立 Vite 构建的模式。当前没有 API 请求，`VITE_API_BASE_URL` 尚未接入运行时逻辑。

## 页面与样式

| 位置                                | 职责                                    |
| ----------------------------------- | --------------------------------------- |
| `src/pages/index.astro`             | 最小协议入口                            |
| `src/pages/<name>/index.astro`      | 后续各份正式协议，按实际需要新增        |
| `src/layouts/agreement/index.astro` | 文档 head、正文容器、样式与普通脚本引用 |
| `src/style.css`                     | 协议排版和响应式布局                    |
| `src/theme.css`                     | 覆盖公共主题 CSS 变量                   |
| `src/main.ts`                       | 浏览器动态脚本入口，目前无动态业务      |
| `astro.config.ts`                   | Astro 静态生成与构建集成                |
| `vite.config.ts`                    | 将浏览器入口打包为 IIFE 普通脚本        |

新增协议时复用公共布局，将业务提供的正式正文直接写入 Astro 页面。不用占位条款替代正式法律文本。正文在构建时生成，关闭 JavaScript 仍可阅读；公共样式随首屏 HTML 加载，不等待脚本挂载或切换主题。

协议使用普通 px 和响应式容器，不使用 Landing 的 px 转 rem。长文和动态字段应自然换行；更新字段时仅修改对应节点，避免替换整段正文造成布局变化。

## 动态内容与兼容

当前保留普通脚本构建链路，但 `src/main.ts` 没有动态行为。后续渐进增强从该入口接入，保持正文独立可读；不要为简单字段引入整页客户端渲染。

应用可按需声明公共包依赖，使用 `@packages/request/browser` 的兼容请求客户端，并绑定 [packages/api](../../packages/api/README.md) 中的真实业务接口。当前没有安装业务请求依赖，也不会请求 `site-config.json`。动态状态按当前页面实例管理，不共享 Landing 的全局对象。

IIFE 构建沿用仓库 Chrome 49、iOS 10 / Safari 10 目标。语法转换不自动补齐运行时 API；新增 Promise、fetch 等能力时要检查对应兼容实现。现代浏览器测试不能替代旧设备验收。

## 验证

`pnpm --filter @apps/agreement check` 检查模板与类型。两应用构建后，在根目录执行 `pnpm check:build test`、`pnpm test:browser`；完整命令与 prod 切换方法见根 README。正式协议的无 JavaScript 阅读、首屏样式及刷新由 `tests/browser/scaffold.spec.ts` 覆盖，开发服务另由 `tests/browser-dev/agreement.spec.ts` 验证。
