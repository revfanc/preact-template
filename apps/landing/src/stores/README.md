# Stores

目录按基础能力、应用装配和业务模块组织，测试就近放置：

```text
stores/
  core/
    index.ts          最小状态容器与公共类型，纯 TypeScript
    hooks.ts          通用 useStore、useStoreInstance
    index.test.ts
    hooks.test.tsx
  app/
    index.ts          createAppStores 应用共享实例集合，目前为空壳
    context.tsx       Context 与 AppStoresProvider，只传递实例
    hooks.ts          useAppStores 读取已有集合
    hooks.test.tsx
  route/
    index.ts          路由状态工厂，只管理数据
    hooks.ts          useLocalRouteStore 局部绑定
    index.test.ts
    hooks.test.tsx
  index.ts            供组件和场景 hooks 使用的统一入口
  README.md
```

新增业务时按需增加 `channel/`、`application/`、`order/` 等目录，不提前创建空目录。各模块先用 `index.ts` 放工厂、类型和数据 action，需要 Preact 接入时再增加 `hooks.ts`；复杂到有必要时才拆分其他文件。

不按 global/local 划分目录：同一个业务工厂可以创建不同作用域的实例。`app/` 只负责组装应用共享实例和传递 Context，业务数据仍属于对应模块。

## 固定文件职责

| 文件            | 职责                                                   |
| --------------- | ------------------------------------------------------ |
| 模块 `index.ts` | 纯数据工厂、类型、数据 action，不依赖 Preact           |
| `hooks.ts`      | 所有 store 接入 hook：创建、获取、订阅和所有者卸载清理 |
| `context.tsx`   | Context 定义和 Provider，只传递已有实例，不调用 hooks  |
| 就近测试        | 验证本模块的状态、订阅或生命周期行为                   |

文件按需创建，职责固定。顶层 `stores/index.ts` 是对外聚合入口，允许导出 hooks 和 Provider；模块内的 `index.ts` 则必须保持纯数据。

内部模块直接引用具体模块，不能反向引用顶层 `stores/index.ts`，避免循环依赖。`core/` 不导入 app 或业务模块；各模块的 `index.ts` 保持纯 TypeScript，Preact 接入单独放在 hooks/context 文件。

业务数据模块不获取整个 app 集合；多个 store 协作时，由所有者将所需实例传给业务工厂或场景 hook。共享业务的读取 hook 可以通过 `app/hooks.ts` 获取集合，再订阅对应成员。

业务状态统一由 store 管理。每个业务工厂新建自己的初始数据，只暴露 getSnapshot、subscribe、业务 action 和 dispose。不要暴露内部 update 给 UI。

业务 store 从 `../core` 导入状态容器，避免加载 Preact 接入层。组件使用方式：

```ts
import { useLocalRouteStore } from '../stores';

const { state, store } = useLocalRouteStore();
// state.isLoading 读取渲染状态，store.start() / store.finish() 修改数据。
```

修改、重置数据属于 store action；Toast、Loading、Modal 和导航属于场景 hook / 页面。具体场景的 hook 留在顶层 hooks 目录，不要求每个业务 store 都配专用 hook。

## 创建与读取必须区分

| 接口                 | 含义                                               | 谁负责销毁           |
| -------------------- | -------------------------------------------------- | -------------------- |
| `createXxxStore()`   | 普通 TypeScript 工厂，每次新建实例                 | 调用方               |
| `useLocalXxxStore()` | 当前所有者创建并订阅独立实例                       | 所有者卸载时自动清理 |
| `useAppStores()`     | 获取应用已有的共享实例集合，不创建、不订阅整个集合 | `app.tsx` 中的所有者 |
| `useXxxStore()`      | 预留给读取 Context 中已有的业务实例并订阅的 hook   | 共享实例的所有者     |
| `useStore(store)`    | 只订阅显式传入的实例                               | 不负责销毁           |

`useLocalRouteStore()` 每个调用位置都有独立实例；需要共享时，通过 props/Context 传递返回的 store，消费者调用 `useStore(store)`。禁止在缺少 Context 时自动回退到创建新实例。原 `useRouteStore` 已改名，不保留含义模糊的别名。

## 全局入口与边界

`app.tsx` 通过 `useStoreInstance(createAppStores)` 创建一次共享集合，在 Router 外提供 `AppStoresProvider`。路由切换不重建它，应用卸载调用集合的 dispose。Provider 只传递实例，本身不创建、不销毁，因此可以用于独立 Modal 渲染根的 Context 桥接。

```ts
import { useAppStores } from '../stores';

const stores = useAppStores(); // 当前只有生命周期入口，尚无业务模块。
```

以后按业务增加显式成员，例如渠道、会话各自一个 store 工厂，由 `createAppStores` 组装并逐项清理。业务字段留在对应模块中，集合不提供通用 set/update、动态注册表或混合快照；组件只订阅需要的成员。业务绑定写在对应的 `stores/<name>/hooks.ts`，不堆进通用 `core/hooks.ts`。以上渠道、会话和业务读取 hook 目前均未实现。

| 作用域          | 适合的数据                         | 边界                         |
| --------------- | ---------------------------------- | ---------------------------- |
| 应用共享        | 当前渠道配置、登录会话等应用上下文 | 应用卸载或明确的业务身份切换 |
| 流程共享        | 本次申请表单、协议勾选、银行卡选择 | 本次流程结束或重新开始       |
| 页面 / 弹窗局部 | 当前筛选、临时编辑数据             | 所有者卸载                   |
| 订单任务        | 当前订单结果、轮询状态             | 订单更换或任务结束           |

多个页面使用不等于应用全局。只有确实需要覆盖应用范围、生命周期与应用上下文一致的数据，才加入共享集合；流程数据由跨步骤存活的流程所有者持有，不提前加入空壳。清理与持久化分别决定，不默认缓存表单、Context 或全部状态。

函数式 Modal 使用独立渲染根，不自动继承 Context。打开时从页面取得共享集合，在 render 内使用 `<AppStoresProvider value={stores}>` 包裹内容，或直接传入需要的业务 store。关闭弹窗不能销毁应用共享实例。

这里的全局只覆盖当前应用实例，不跨标签页、不与 Agreement 应用共享；刷新会重新创建，恢复需要业务自行设计。完整生命周期和异步规则见 [Landing 架构](../../ARCHITECTURE.md)。

## 自动检查与扩展边界

运行 `pnpm test` 会执行 `tests/store-boundaries.test.ts`，检查数据模块对 UI 和 hooks 的依赖、core 对业务模块的反向依赖、业务数据对 app 的依赖、内部模块对顶层聚合入口的依赖，并检查 store hook 是否定义在 hooks.ts。测试文件可通过公共入口验证调用方行为，不参与生产依赖约束。

这些检查覆盖静态引用及可识别的动态导入，不证明 action 的业务语义或资源清理正确；实例隔离、销毁和异步行为仍需就近测试。

当前保留小型状态容器。需要选择性订阅、复杂派生状态、持久化中间件或调试工具时，先评估成熟状态库，不继续在 core 中堆叠自研框架能力。
