# Pages 构建插件

`pages()` 在构建期扫描页面、校验路径并生成路由清单。浏览器使用生成的清单加载组件。

```ts
import { pages } from '../../tooling/pages/index.ts';

pages({ pattern: '**/index.tsx' }); // Landing
pages({ pattern: '**/index.tsx', eager: true, staticOnly: true }); // Agreement
```

| 选项       | 默认值         | 作用                                     |
| ---------- | -------------- | ---------------------------------------- |
| directory  | src/pages      | 相对应用 root 的页面目录，也支持绝对路径 |
| pattern    | **/*.{tsx,jsx} | 选择文件范围和扩展名的 glob              |
| eager      | false          | 同步导入页面模块；默认生成动态 import    |
| staticOnly | false          | 拒绝包含动态参数的路由                   |

## 路由约定

- `index.tsx` → `/`；`about.tsx` 或 `about/index.tsx` → `/about`。
- `[id].tsx` → `/:id`；`[...path].tsx` → `/:path+`，至少匹配一段，必须位于末尾。
- `_` 开头的文件和目录被忽略，根级 `_404.tsx` 或 `_404/index.tsx` 为兜底；所有页面均须符合 pattern。
- 静态名称使用字母、数字、下划线或连字符。只去除最后一个扩展名，不支持自定义首页名、复合后缀或嵌套布局。
- 路由冲突、等价动态路径、重复参数和多个兜底均报错。匹配顺序为静态路径、动态参数、捕获、兜底。

普通组件放在 pattern 匹配范围之外。需要过滤测试文件时可使用 `**/!(*.test|*.spec).tsx`。

## 生成模块

- `virtual:pages` 导出 `pages`，每项包含 `{ file, path, load }`。
- `virtual:pages/eager` 导出 `pages`，每项包含 `{ file, path, page }`；page 为同步页面模块。
- 兜底记录使用 `default: true`，没有 path。
- 两种模块均导出 `prerenderPaths: string[]`，路径不带部署 base。

部署前缀、页面匹配、标题、加载反馈和错误 UI 由应用处理。路径语法面向 preact-iso。

## 预渲染声明

页面入口可声明：

```tsx
export const prerender = true;
```

声明必须是独立的 `export const`，值为布尔字面量。未声明或为 `false` 时不加入 `prerenderPaths`；动态参数和兜底页面不可声明为 `true`。不支持表达式、转导出或动态参数枚举。

`prerender` 是保留的构建元数据导出：使用 TypeScript 静态解析，编译后移除该导出；组件及其他业务导出保留。元数据收集不会执行页面代码。

Landing 将声明的路径交给官方预渲染器；首页默认预渲染，不能通过 `false` 关闭。Agreement 预渲染全部静态页面，无需逐页声明。兜底不会生成服务器错误页。

## 开发与验证

新增、删除或重命名页面会刷新路由；内容修改会更新生成清单的缓存，组件使用 Vite HMR。`index.test.ts` 通过真实 Vite 服务验证路由、声明解析、模块导出和开发更新。
