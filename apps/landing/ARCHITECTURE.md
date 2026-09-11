# Landing 分层与状态约定

开发、构建与当前入口见 [Landing 项目说明](README.md)，仓库命令与公共包概览见[根 README](../../README.md)。本文约束新增业务代码的职责和状态生命周期。

## 目录

```text
src/
  app.tsx                 应用装配、共享实例所有者与顶层错误边界
  main.tsx                挂载、兼容补丁、首屏 loading 交接
  pages/                  路由入口，只装配参数、状态、UI 与导航
    p1/<code>/index.tsx    后续真实活动页的路径形式
  components/             应用 UI；每个组件单独目录
    home/index.tsx        空白首页
    page-error/index.tsx  页面加载失败
  api/index.ts            应用请求实例，绑定公共业务接口
  stores/
    core/
      index.ts            最小状态容器与公共类型，不依赖 Preact
      hooks.ts            通用创建/订阅 hooks，不导入业务模块
    app/
      index.ts            应用共享实例集合，目前无业务成员
      context.tsx         Context 与 Provider，只传递实例
      hooks.ts            useAppStores 获取已有集合
    route/
      index.ts            当前实际使用的路由状态
      hooks.ts            useLocalRouteStore 局部绑定
    index.ts              对外接入能力导出
    README.md             目录、作用域与使用约定
  hooks/
    use-route-loading.ts  连接 Router、路由状态与 Loading 展示
  router/                 文件路由解析、懒加载
```

不提前创建虚构的渠道、登录、订单字段或无实际职责的转发层。新业务出现时，在 stores 下按业务名称增加目录，测试就近放置。目录按业务职责组织，全局或局部作用域由实例所有者决定，不另建 global/local 目录。示例页面已从生产入口移除；测试交互仅位于 `test/fixture`。

## 导入约定

- Landing 跨模块使用 `@/`，映射到 `apps/landing/src/`；模块内部文件和样式使用 `./`。
- 公共包通过 `@packages/*` 的公开入口引用，不通过应用别名或相对路径穿透包源码。
- 别名仅缩短路径，不改变依赖边界：业务 store 使用 `@/stores/core`，不能通过 `@/stores` 反向引用聚合入口。
- 根 `tsconfig.json` 是当前 Landing 路径映射的唯一来源；正式应用、测试夹具及 Vitest 启用 `resolve.tsconfigPaths`。测试夹具的 `@/` 同样指向正式 Landing 源码；夹具内部继续使用相对路径。
- 路由发现的 `import.meta.glob` 保持现有相对路径及键值解析约定，不混入普通模块导入的路径替换。

## 文件与依赖规则

模块中的 `index.ts` 固定放纯数据工厂、类型和 action，`hooks.ts` 固定放 store 的 `useXxx` 接入函数，`context.tsx` 只定义 Context 和传递已有实例的 Provider。按需创建文件，不要求每个模块都有 Context；有 hook 就必须放在 hooks.ts。顶层 `stores/index.ts` 是面向调用方的聚合入口，不适用模块数据入口规则。

`core` 只提供通用能力，`app` 只组装应用共享实例，其他目录按业务组织。业务数据模块不读取整个应用集合；需要其他实例时由所有者传入依赖。共享业务 hook 可以读取 app Context 再订阅对应成员。内部文件不反向导入顶层 stores 聚合入口。

`pnpm test` 中的 `tests/store-boundaries.test.ts` 检查上述关键依赖边界及 hook 文件位置；包括禁止数据模块导入 Preact、反馈/展示组件、场景 hooks、路由及 store 接入文件，禁止 core 依赖业务模块、业务数据依赖 app、内部模块引用聚合入口。检查静态依赖和可识别的动态导入，不能代替对 action 语义、实例生命周期的审查。

## 状态归属

业务、表单、请求结果、pending/error 等状态统一进入所属作用域的 store。hook 和 UI 不再保存同一份业务状态副本。

| 作用域         | 实例所有者                 | 销毁时机           |
| -------------- | -------------------------- | ------------------ |
| 应用           | `app.tsx` 所有者           | 应用卸载           |
| 多步骤申请流程 | 跨步骤保持挂载的流程所有者 | 流程退出、重新开始 |
| 页面           | 页面入口                   | 页面卸载           |
| 弹窗           | 弹窗内容的所有者           | 弹窗卸载           |

所有 store 使用工厂创建；禁止在模块顶层无意创建共享单例。一个所有者只创建一次实例，子组件通过 props 或 Context 获取这个实例。子组件调用同一工厂会得到另一份状态，不会自动共享。

`app.tsx` 已在 Router 外接入应用共享空壳：通过 `useStoreInstance(createAppStores)` 持有集合，`AppStoresProvider` 只传递集合，`useAppStores()` 只读取已有集合；缺少 Provider 时明确报错。集合目前没有渠道、用户或申请字段，不代表已经实现这些业务。

全局集合只组装应用范围的业务 store，不能演变成包办所有字段的大快照。以后渠道、会话按业务分别实现；申请表单、协议勾选和银行卡选择属于一次流程，订单结果与轮询属于订单任务。多页面共用的数据应放在最小共同作用域，不因“以后可能复用”就提升到应用全局。

业务身份变化时需要明确重置或重建哪些实例。页面路径切换不等于流程结束，也不因任意 query 变化就重建全局集合。首次真实流程接入时必须确定跨步骤所有者和结束条件；当前不预置流程容器或字段。

`useStoreInstance(factory)` 仅供所有者使用：首次渲染创建实例，卸载调用 `dispose()`。传入的工厂不能在创建时发请求、监听 DOM 或启动计时器；这些操作应显式启动。工厂参数不会因后续渲染自动同步；需要重建实例时，为所有者设置业务身份对应的 key。

`useStore(instance)` 只订阅快照，不负责销毁。需要跨路由存活的流程 store 不应归属于会卸载的单个步骤页面。销毁不可逆；离开后重新进入应创建新实例。BFCache 恢复和 History 返回监听依照 browser 包文档处理，不能把页面卸载与 pagehide 混为一谈。

命名区分创建与读取：`useLocalXxxStore()` 创建局部实例，`useXxxStore()` 留给获取 Context 中已有业务实例并订阅的 hook，`useAppStores()` 获取应用共享集合。当前局部绑定为 `useLocalRouteStore()`，返回 `{ state, store }`；多个调用位置各有独立实例，消费者共享时使用 `useStore(store)`。禁止同一个 hook 隐式决定创建还是共享，不保留旧名 `useRouteStore`。

业务绑定就近放在 `stores/<name>/hooks.ts`，不集中导入通用 `stores/core/hooks.ts`。组件只订阅需要的业务 store，共享集合本身不提供全量订阅或任意字段写入；数据修改仍经业务 action。

函数式 Modal 是独立渲染根，页面 Context 不会自动传播。使用同一个集合显式包裹 `AppStoresProvider`，或传入所需业务 store；Provider 不拥有清理权，弹窗关闭只清理弹窗资源。应用共享也不等于持久化，刷新、BFCache、跨标签页和独立 Agreement 应用不能依靠 Context 自动恢复或共享。

## 快照与 action

`createStore(initial)` 返回稳定的 `getSnapshot/subscribe/update/dispose`。没有更新时快照引用不变；返回原快照表示不更新。快照仅浅冻结，嵌套对象也必须不可变更新；每次调用业务工厂都应新建嵌套初始值，避免多个实例引用同一对象。

业务 store 内部使用 `update`，对外只暴露读取、订阅、业务 action 和 dispose。不要让 UI 任意修改内部状态。派生值用纯函数或 getter 计算，不把同一结果重复存到快照中。

DOM 引用、计时器、AbortController、取消函数属于实例私有资源，不放进响应式快照。局部 hover、动画、布局测量可留在 UI hook。路由参数以路由为准；持久化是单独的业务决策，不自动把全部 store 写入 localStorage。

## 各层职责

- API：定义接口和输入输出、校验/转换后端数据；不控制 UI、路由或 store 生命周期。
- Store：管理状态及数据 action，调用 API 并保存 pending/error 和结果。不得直接展示 Toast、Loading、Modal 或执行导航。
- Store hooks：`stores/core/hooks.ts` 提供实例创建、订阅和卸载清理，属于 store 的 Preact 接入能力。
- 场景 Hook：顶层 `hooks/` 连接路由、状态和 UI 行为，组织用户操作流程，持有并清理反馈句柄；不额外维护 pending/error 副本。单一能力和业务流程按职责区分，暂不强制拆分子目录。
- UI：读取状态、触发 action、处理局部视觉交互；通用展示组件通过 props/events 通信，不直接请求接口。
- Pages：组装 store/hook/UI，解释路由参数和业务结果，调用应用导航或反馈；不堆放表单和复杂业务实现。

默认调用路径：UI → 场景 hook → store action → API。提交时，store 维护请求状态和结果，hook 根据结果展示提示或导航。简单 UI 也可直接触发传入的 action，不强制增加专用 hook。API 不反向导入应用状态，store 不反向导入场景 hook。

组件从 `stores/index.ts` 使用通用能力或业务绑定 hook；业务 store 直接从 `@/stores/core` 导入状态容器，不通过包含 Preact hooks 的聚合入口。具体业务工厂从 `stores/<name>` 导入，不全部汇总到基础入口。纯数据代码不依赖场景 hooks 或反馈组件。

纯校验、转换和计算使用普通函数，按业务需要就近提取；不为了分层给每个接口创建 hook 或转发函数。多个能力 hook 协作时接收同一个 store 实例，避免各自重新创建状态。

## 异步生命周期

启动任务的实例负责取消、计时器及监听清理。dispose 必须幂等；停止后的旧响应不得回写，也不得继续导航、弹窗或提交。createStore 的 dispose 只关闭状态更新与订阅，具体业务工厂仍须清理资源。

同一动作的防重放在 action 内，而不只禁用按钮。重试按接口语义决定；不要给签约等提交统一自动重试。轮询间隔、结束条件属于业务，启动和停止与实例生命周期绑定。

`stores/route/index.ts` 只保存 isLoading 并提供 start/finish 数据 action。`hooks/use-route-loading.ts` 持有 Loading 关闭句柄，连接 Router 回调并在卸载时关闭提示；开始和结束时直接协调状态与反馈，不依赖延迟 effect 展示。公共反馈包仍管理自身 UI 资源，不依赖 Landing store。

## 新增一个功能

1. 定义 API 输入输出；应用层绑定请求实例。
2. 确定状态所有者、初始值、共享范围和清理时机。
3. 创建对应业务 store，定义数据 action 并接入 API。
4. hook/Context 接入实例，场景 hook 按需组织用户操作流程，pages 装配 UI。
5. 测试实例隔离、重复提交、旧响应及销毁；再验证浏览器交互。

组件使用目录包裹：`components/<name>/index.tsx` 与 `index.module.css`。路由使用 `pages/p1/<code>/index.tsx` 等形式，路由目录尽量只放入口。
