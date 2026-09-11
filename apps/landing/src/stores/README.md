# Stores

目录按 store 能力组织：

- `core.ts`：最小状态容器与公共类型，纯 TypeScript，不依赖 Preact。
- `hooks.ts`：`useStore`、`useStoreInstance`，负责 Preact 订阅与实例生命周期。
- `index.ts`：导出基础能力，供组件和场景 hooks 使用。
- `route.ts`：路由状态工厂，只管理数据，不调用反馈 UI。

业务状态统一由 store 管理。每个业务工厂新建自己的初始数据，只暴露 getSnapshot、subscribe、业务 action 和 dispose。不要暴露内部 update 给 UI。

业务 store 从 `./core` 导入状态容器，避免加载 Preact 接入层。组件使用方式：

```ts
import { useStore, useStoreInstance } from '../stores';
import { createRouteStore } from '../stores/route';
```

修改、重置数据属于 store action；Toast、Loading、Modal 和导航属于场景 hook / 页面。具体场景的 hook 留在顶层 hooks 目录，不要求每个业务 store 都配专用 hook。

用 useStoreInstance 在作用域所有者创建一次，再通过 props/Context 共享；消费者只用 useStore 订阅。不要把工厂调用误当作共享状态。详情见 [Landing 架构](../../ARCHITECTURE.md)。
