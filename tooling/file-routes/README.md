# 文件路由

共享 Vite 构建工具，扫描与校验在 Node 中执行。文件选择、URL 生成和模块导入分开处理；不导入 Preact、不限定页面模块导出、不添加浏览器路由依赖。

```ts
fileRoutes(); // src/pages 下所有 tsx / jsx 文件，懒加载
fileRoutes({
  dir: 'src/documents',
  extensions: ['page.tsx'],
  index: 'home',
  exclude: ['draft/**', '**/*.test.page.tsx'],
  notFound: 'missing.page.tsx',
  importMode: 'eager',
  dynamic: false,
});
```

| 参数       | 默认值    | 含义                                                                  |
| ---------- | --------- | --------------------------------------------------------------------- |
| dir        | src/pages | 页面目录，相对 Vite root，也支持绝对路径                              |
| extensions | tsx、jsx  | 文件后缀，不含开头的点；支持 page.tsx 等复合后缀                      |
| include    | *_/_      | 相对页面目录的 glob 字符串或数组                                      |
| exclude    | 无        | 排除 glob 字符串或数组                                                |
| index      | index     | 去掉文件后缀后，映射到父路径的文件名                                  |
| notFound   | 无        | 相对目录的确切兜底文件；优先于 include/exclude，但仍须符合 extensions |
| importMode | lazy      | lazy 输出加载函数；eager 输出完整页面模块                             |
| dynamic    | true      | false 时对动态参数明确报错，适用于没有参数展开的 SSG                  |

默认支持 `about.tsx` → `/about`、`about/index.jsx` → `/about`、`users/[id].tsx` → `/users/:id`、`docs/[...path].tsx` → `/docs/:path+`。两种文件产生相同路径时构建失败，不静默覆盖。catch-all 至少匹配一段且必须位于末尾；静态段优先于参数与 catch-all，兜底最后。重复参数、非法命名与等价动态路由均报错。目录不隐式生成布局，嵌套目录只影响 URL。

当前两个应用主动配置 `include: '**/index.tsx'`、`exclude: '**/_*/**'` 和 `notFound: '_404/index.tsx'`，保留项目的目录式页面习惯。这些是应用约定，不是插件限制；若要使用平铺文件，修改 include 即可。普通组件应放在页面匹配范围之外。

懒加载导入 `virtual:file-routes`：`{ file, path, load }`；同步模式导入 `virtual:file-routes/eager`：`{ file, path, page }`。兜底记录以 `default: true` 代替 path。page 为完整模块，应用自己声明组件、标题等类型。

应用负责部署 base、运行时匹配、加载失败和 404 展示。当前路径模式可由 preact-iso 直接消费；它不是跨所有路由库的通用运行时协议。Agreement 将普通静态路由作为预渲染列表，兜底只用于组件匹配，不自动生成服务器 404 文件。动态 SSG 的参数展开、静态部署的尾斜杠跳转不属于此插件。

开发时新增、删除或重命名匹配页面会使路由清单失效并刷新。内容更新由 Vite / Preact 的正常 HMR 处理。扫描只接受实际文件，不跟随符号链接目录。页面目录须存在，可为空。

配置方式参考 [vite-plugin-pages](https://github.com/hannoeru/vite-plugin-pages) 的文件过滤、index 路由和同步/异步导入设计。实现使用 Vite 提供的 createFilter，不自行编写 glob 匹配器。

## 维护边界

```text
index.ts       Vite 生命周期、虚拟模块、开发失效与监听清理
files.ts       文件扫描、glob 筛选、后缀识别；扫描和监听共用 match
resolve.ts     纯路由解析、冲突检查与排序，不依赖 Vite 或文件系统
generate.ts     将路由清单输出为 eager / lazy 模块，不解释路由语法
types.ts       配置和阶段之间的数据类型
```

数据流为 `文件 → PageFile[] → FileRoute[] → 虚拟模块`。PageFile 保存源文件、去掉配置后缀的 stem 和兜底标记，因此新增文件后缀不会改动路由解析。

- 修改匹配规则或扫描方式：只改 files.ts；使用成熟的 Vite createFilter。
- 新增命名语法或调整冲突规则：只改 resolve.ts，并补路径与优先级测试。
- 调整加载输出：只改 generate.ts，并验证 eager 模块导出和 lazy 分包。
- 升级 Vite 生命周期：只改 index.ts；关闭服务时解除监听，也覆盖 middleware 模式。

公开入口只导出 fileRoutes 和调用方需要的类型；阶段函数是内部模块，不承诺独立的扩展插件 API。没有多框架 resolver 注册中心，实际出现第二种运行时协议时再增加适配边界。
