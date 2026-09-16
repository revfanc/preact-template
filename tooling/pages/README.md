# Pages 构建插件

`pages()` 在构建期生成页面清单，浏览器只加载组件，不扫描目录、不解析文件名。

```ts
import { pages } from '../../tooling/pages/index.ts';

pages({ pattern: '**/index.tsx' }); // Landing：懒加载
pages({ pattern: '**/index.tsx', eager: true, staticOnly: true }); // Agreement
```

只有四个选项：

| 选项       | 默认值         | 作用                                           |
| ---------- | -------------- | ---------------------------------------------- |
| directory  | src/pages      | 相对应用 root 的页面目录，也支持绝对路径       |
| pattern    | **/*.{tsx,jsx} | 相对页面目录的 glob，决定文件范围和扩展名      |
| eager      | false          | true 同步导入，false 生成动态 import           |
| staticOnly | false          | true 拒绝包含参数的路由，避免生成无效 SSG 地址 |

固定约定：

- `index.tsx` → `/`；`about.tsx` 或 `about/index.tsx` → `/about`。
- `[id].tsx` → `/:id`；`[...path].tsx` → `/:path+`，至少匹配一段，必须位于末尾。
- `_` 开头的文件和目录被忽略；根级 `_404.tsx` 或 `_404/index.tsx` 为兜底。兜底也必须符合 pattern。
- 静态名称使用字母、数字、下划线或连字符。只去除最后一个文件扩展名，不支持自定义首页名、复合后缀和嵌套布局。
- 同一路径、等价动态路由、多个兜底和重复参数均报错。精确路径优先于动态参数和捕获，兜底最后。

插件可发现平铺文件，当前两个应用通过 pattern 保留目录式入口习惯。普通组件放在匹配范围之外；若需额外过滤，使用 glob，例如 `**/!(*.test|*.spec).tsx`。

懒加载导入 `virtual:pages` 的 `pages` 数组，记录包含 `{ file, path, load }`；同步导入 `virtual:pages/eager`，记录包含 `{ file, path, page }`，page 保留页面模块的全部导出。兜底以 `default: true` 代替 path。

部署 base、页面标题、加载反馈、路由匹配和错误 UI 由应用处理。路径语法面向 preact-iso；Agreement 从清单提取静态地址，兜底不会自动生成服务器的 404 文件。

实现只在 index.ts 中：Vite 插件负责扫描和模块输出，私有 manifest 函数负责路径转换与校验。使用仓库要求的 Node 24 原生 glob / matchesGlob，不引入扫描依赖。新增、删除、重命名匹配页面时刷新，内容修改由 Vite 正常 HMR 处理。

测试就近放在 index.test.ts，通过真实 Vite 服务验证路由清单、模块导入、冲突与开发更新。扩展先增加具体用例，不增加通用 resolver 或生命周期扩展层。
