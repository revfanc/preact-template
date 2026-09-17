# Pages 构建插件

`pages()` 在构建期扫描页面、校验路径并生成路由清单。浏览器通过 preact-iso 消费清单，不扫描目录或解析文件名。

```ts
import { pages } from '../../tooling/pages/index.ts';

pages({ exclude: ['**/*.test.*', '**/*.spec.*'] }); // Landing
pages({
  exclude: ['**/*.test.*', '**/*.spec.*'],
  eager: true,
  staticOnly: true,
}); // Agreement
```

| 选项       | 默认值         | 作用                                              |
| ---------- | -------------- | ------------------------------------------------- |
| directory  | src/pages      | 相对应用 root 的页面目录，也支持绝对路径          |
| pattern    | **/*.{tsx,jsx} | 相对页面目录的文件 glob                           |
| exclude    | []             | 相对应用 root 的忽略 glob，支持字符串或字符串数组 |
| eager      | false          | 同步导入页面模块；默认生成动态 import             |
| staticOnly | false          | 拒绝包含动态参数的页面                            |

## 文件约定

采用 [unplugin-vue-router 的基础文件约定](https://uvr.esm.is/guide/file-based-routing)。范围限于普通页面、目录首页、完整路径段参数与末尾捕获，不实现 Vue Router 的布局或运行时。

| 页面文件                     | 路径含义       | 生成的 preact-iso 路径 |
| ---------------------------- | -------------- | ---------------------- |
| index.tsx                    | 首页           | /                      |
| about.tsx 或 about/index.tsx | 普通页面       | /about                 |
| users/[id].tsx               | 必填单段参数   | /users/:id             |
| users/[[id]].tsx             | 可选单段参数   | /users/:id?            |
| files/[...path].tsx          | 零段或多段路径 | /files/:path*          |
| [...path]/index.tsx          | 全站兜底       | /:path*                |

- `.tsx` 与 `.jsx` 使用相同规则。`index` 必须小写；路径不追加末尾斜杠。
- 可选参数和捕获参数只支持位于末尾。`preact-iso` 不会为中间可选段回溯，因此其他位置构建报错。
- 参数通过组件 props / `params` 获取。捕获值为 `/` 连接的字符串，空路径时为 `undefined`；使用 `params.path` 读取名为 `path` 的参数，避免与 Router 的 `path` 属性冲突。
- 静态名称使用字母、数字、下划线或连字符。下划线名称没有特殊含义；辅助文件通过 `exclude` 排除，或放在页面目录之外。
- 不支持点号嵌套、路由分组、混合参数、重复参数修饰符、命名视图和嵌套布局；遇到相应文件名直接报错。`users.tsx` 与 `users/` 下的页面不能同时存在；目录页面使用 `users/index.tsx`。
- 等价路径或重复参数报错。匹配顺序为精确结束、静态段、必填参数、可选参数、捕获。可选路由可以和明确的首页共存，精确页面优先。

规则依据为 [官方文档](https://uvr.esm.is/guide/file-based-routing) 和 [v0.19.2 路由测试](https://github.com/posva/unplugin-vue-router/blob/v0.19.2/src/core/tree.spec.ts)；本地测试覆盖支持的子集与明确拒绝的语法。运行时使用 preact-iso 的参数和匹配行为，不承诺 Vue Router 全量兼容。

## 文件筛选

`pattern` 选择文件范围，`exclude` 使用 glob 字符串过滤。路径分隔符统一为 `/`，不传 JavaScript 正则。

```ts
pages({
  exclude: ['**/*.test.*', '**/*.spec.*', 'src/pages/components/**'],
});
```

扫描、预渲染元数据处理和开发路由监听使用同一筛选规则。忽略文件仍可被普通组件导入，但不会成为页面。应用已显式排除测试文件，插件默认不额外忽略业务文件。

## 生成模块

- `virtual:pages` 导出 `pages`，每项包含 `{ file, path, load }`。
- `virtual:pages/eager` 导出 `pages`，每项包含 `{ file, path, page }`；page 为同步页面模块。
- 两种模块均导出 `prerenderPaths: string[]`，路径不带部署 base。

部署前缀、标题、加载反馈和错误 UI 由应用处理。Landing 使用末尾捕获页面显示 404；Agreement 只扫描静态页面，其客户端未找到提示放在 `components/not-found`。

## 预渲染

页面可独立声明 `export const prerender = true`。值必须是布尔字面量；未声明或为 `false` 时不加入 `prerenderPaths`。含参数的页面不可声明为 `true`，不支持表达式、转导出或动态参数枚举。

`prerender` 是保留的构建元数据导出：使用 TypeScript 静态解析，编译后移除导出关键字；组件及其他业务导出保留。元数据收集不会执行页面代码。

Landing 将声明的路径交给官方预渲染器；首页默认预渲染，不能通过 `false` 关闭。Agreement 预渲染全部静态页面，无需逐页声明。兜底不生成静态错误页。

生成路由不要求尾斜杠，预渲染仍输出目录 `index.html`。初次访问如何读取该文件由静态服务器决定，文件路由插件不重写 URL 或修改预览服务器。

## 开发与验证

新增、删除或重命名页面会刷新路由；内容修改会更新生成清单的缓存，组件使用 Vite HMR。`index.test.ts` 使用真实 Vite 服务验证发现、排除、匹配优先级、声明解析和开发更新。应用构建测试覆盖扁平页面及排除文件，浏览器测试覆盖参数、兜底、刷新和 hydration。
