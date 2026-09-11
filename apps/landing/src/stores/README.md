# Stores

目录按 store 能力组织：

- `core.ts`：最小状态容器与公共类型，纯 TypeScript，不依赖 Preact。
- `hooks.ts`：通用 `useStore`、`useStoreInstance` 和业务绑定 `useRouteStore`，负责 Preact 订阅与实例生命周期。
- `index.ts`：统一导出基础能力及业务绑定 hook，供组件和场景 hooks 使用。
- `route.ts`：路由状态工厂，只管理数据，不调用反馈 UI。

业务状态统一由 store 管理。每个业务工厂新建自己的初始数据，只暴露 getSnapshot、subscribe、业务 action 和 dispose。不要暴露内部 update 给 UI。

业务 store 从 `./core` 导入状态容器，避免加载 Preact 接入层。组件使用方式：

```ts
import { useRouteStore } from '../stores';

const { state, store } = useRouteStore();
// state.isLoading 读取渲染状态，store.start() / store.finish() 修改数据。
```

修改、重置数据属于 store action；Toast、Loading、Modal 和导航属于场景 hook / 页面。具体场景的 hook 留在顶层 hooks 目录，不要求每个业务 store 都配专用 hook。

`useRouteStore()` 将实例创建和订阅封装在一起，只在作用域所有者调用，每个调用位置拥有独立实例，并在卸载时销毁。需要共享时，通过 props/Context 传递返回的 store；消费者只用 `useStore(store)` 订阅，不能再次调用 `useRouteStore()` 来获取已有状态。

新增常用业务时可以提供同样的薄绑定 hook；不需要绑定时仍可组合 `useStoreInstance(factory)` 和 `useStore(store)`。纯 TypeScript 调用方从 `stores/route` 导入 `createRouteStore`。详情见 [Landing 架构](../../ARCHITECTURE.md)。
