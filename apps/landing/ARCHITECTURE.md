# Landing 分层与状态约定

开发、构建与当前入口见 [Landing 项目说明](README.md)，仓库命令与公共包概览见[根 README](../../README.md)。本文约束新增业务代码的职责和状态生命周期。

## 目录

```text
src/
  app.tsx                 应用装配与顶层错误边界
  main.tsx                挂载、兼容补丁、首屏 loading 交接
  pages/                  路由入口，只装配参数、状态、UI 与导航
    p1/<code>/index.tsx    后续真实活动页的路径形式
  components/             应用 UI；每个组件单独目录
    home/index.tsx        空白首页
    page-error/index.tsx  页面加载失败
  api/index.ts            应用请求实例，绑定公共业务接口
  stores/
    core.ts               最小状态容器与公共类型，不依赖 Preact
    hooks.ts              useStore / useStoreInstance，Preact 接入
    index.ts              通用能力导出
    route.ts              当前实际使用的路由状态
  services/               多步骤业务流程与普通业务函数
  hooks/
    use-route-loading.ts  连接 Router、路由状态与 Loading 展示
  router/                 文件路由解析、懒加载
```

不提前创建虚构的渠道、登录、订单字段或空转 service。新业务出现时，按业务名称增加文件。示例页面已从生产入口移除；测试交互仅位于 `test/fixture`。

## 状态归属

业务、表单、请求结果、pending/error 等状态统一进入所属作用域的 store。hook 和 UI 不再保存同一份业务状态副本。

| 作用域         | 实例所有者                 | 销毁时机           |
| -------------- | -------------------------- | ------------------ |
| 应用           | app 或其 Provider          | 应用卸载           |
| 多步骤申请流程 | 跨步骤保持挂载的流程所有者 | 流程退出、重新开始 |
| 页面           | 页面入口                   | 页面卸载           |
| 弹窗           | 弹窗内容的所有者           | 弹窗卸载           |

所有 store 使用工厂创建；禁止在模块顶层无意创建共享单例。一个所有者只创建一次实例，子组件通过 props 或 Context 获取这个实例。子组件调用同一工厂会得到另一份状态，不会自动共享。

`useStoreInstance(factory)` 仅供所有者使用：首次渲染创建实例，卸载调用 `dispose()`。传入的工厂不能在创建时发请求、监听 DOM 或启动计时器；这些操作应显式启动。工厂参数不会因后续渲染自动同步；需要重建实例时，为所有者设置业务身份对应的 key。

`useStore(instance)` 只订阅快照，不负责销毁。需要跨路由存活的流程 store 不应归属于会卸载的单个步骤页面。销毁不可逆；离开后重新进入应创建新实例。BFCache 恢复和 History 返回监听依照 browser 包文档处理，不能把页面卸载与 pagehide 混为一谈。

## 快照与 action

`createStore(initial)` 返回稳定的 `getSnapshot/subscribe/update/dispose`。没有更新时快照引用不变；返回原快照表示不更新。快照仅浅冻结，嵌套对象也必须不可变更新；每次调用业务工厂都应新建嵌套初始值，避免多个实例引用同一对象。

业务 store 内部使用 `update`，对外只暴露读取、订阅、业务 action 和 dispose。不要让 UI 任意修改内部状态。派生值用纯函数或 getter 计算，不把同一结果重复存到快照中。

DOM 引用、计时器、AbortController、取消函数属于实例私有资源，不放进响应式快照。局部 hover、动画、布局测量可留在 UI hook。路由参数以路由为准；持久化是单独的业务决策，不自动把全部 store 写入 localStorage。

## 各层职责

- API：定义接口和输入输出、校验/转换后端数据；不控制 UI、路由或 store 生命周期。
- Store：管理状态及数据 action。简单 action 可以直接调用 API；多个步骤或可复用规则调用 service。不得直接展示 Toast、Loading、Modal 或执行导航。
- Service：普通 TypeScript 函数，组织业务步骤和判断结果；依赖通过参数显式传入，不使用 Preact hooks，不固定引用全局实例。
- Store hooks：`stores/hooks.ts` 提供实例创建、订阅和卸载清理，属于 store 的 Preact 接入能力。
- 场景 Hook：顶层 `hooks/` 连接路由、状态和 UI 行为，持有并清理反馈句柄；不额外维护 pending/error 副本。
- UI：读取状态、触发 action、处理局部视觉交互；通用展示组件通过 props/events 通信，不直接请求接口。
- Pages：组装 store/hook/UI，解释路由参数和业务结果，调用应用导航或反馈；不堆放表单和复杂业务实现。

依赖方向：pages → hooks/stores/components；stores → services/api；services → API 或显式传入的接口。API 不反向导入应用状态。Service 需要更新状态时使用回调或窄接口，避免与 store 相互导入。

组件从 `stores/index.ts` 使用通用能力；业务 store 直接从 `./core` 导入状态容器，不通过包含 Preact hooks 的聚合入口。具体业务工厂从 `stores/<name>` 导入，不全部汇总到基础入口。纯数据代码不依赖场景 hooks 或反馈组件。

简单查询允许 store action → API，不强制经过 service；没有复用或业务判断的转发层无需创建。

## 异步生命周期

启动任务的实例负责取消、计时器及监听清理。dispose 必须幂等；停止后的旧响应不得回写，也不得继续导航、弹窗或提交。createStore 的 dispose 只关闭状态更新与订阅，具体业务工厂仍须清理资源。

同一动作的防重放在 action 内，而不只禁用按钮。重试按接口语义决定；不要给签约等提交统一自动重试。轮询间隔、结束条件属于业务，启动和停止与实例生命周期绑定。

`stores/route.ts` 只保存 isLoading 并提供 start/finish 数据 action。`hooks/use-route-loading.ts` 持有 Loading 关闭句柄，连接 Router 回调并在卸载时关闭提示；开始和结束时直接协调状态与反馈，不依赖延迟 effect 展示。公共反馈包仍管理自身 UI 资源，不依赖 Landing store。

## 新增一个功能

1. 定义 API 输入输出；应用层绑定请求实例。
2. 确定状态所有者、初始值、共享范围和清理时机。
3. 创建对应业务 store；复杂流程提取 service。
4. hook/Context 接入实例，pages 装配 UI。
5. 测试实例隔离、重复提交、旧响应及销毁；再验证浏览器交互。

组件使用目录包裹：`components/<name>/index.tsx` 与 `index.module.css`。路由使用 `pages/p1/<code>/index.tsx` 等形式，路由目录尽量只放入口。
