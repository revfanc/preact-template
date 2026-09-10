# Stores

create-store.ts 是最小状态容器；route.ts 是当前实际使用的实例工厂。

业务状态统一由 store 管理。每个业务工厂新建自己的初始数据，只暴露 getSnapshot、subscribe、业务 action 和 dispose。不要暴露内部 update 给 UI。

用 useStoreInstance 在作用域所有者创建一次，再通过 props/Context 共享；消费者只用 useStore 订阅。不要把工厂调用误当作共享状态。详情见 [Landing 架构](../../ARCHITECTURE.md)。
