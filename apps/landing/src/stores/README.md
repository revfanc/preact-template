# Stores

目录按基础能力、应用装配和业务模块组织，测试就近放置：

```text
stores/
  core/
    index.ts          最小状态容器与公共类型，纯 TypeScript
    hooks.ts          通用 useStore、useStoreInstance
    persist.ts        可选的字段持久化与恢复，不依赖 Preact
    persist.test.ts
    index.test.ts
    hooks.test.tsx
  app/
    index.ts          createAppStores 应用共享实例集合，持有 channel
    context.tsx       Context 与 AppStoresProvider，只传递实例
    hooks.ts          useAppStores 读取已有集合
    hooks.test.tsx
  channel/
    index.ts          URL 渠道上下文、解析与同步 action
    hooks.ts          useChannelStore 获取并订阅应用已有实例
    index.test.ts
  loading/
    index.ts          Loading 状态工厂，只管理数据
    hooks.ts          useLocalLoadingStore 局部绑定
    index.test.ts
    hooks.test.tsx
  index.ts            供组件和场景 hooks 使用的统一入口
  README.md
```

当前 `channel/` 保存 URL 渠道上下文；新增业务时按需增加 `application/`、`order/` 等目录，不提前创建空目录。各模块先用 `index.ts` 放工厂、类型和数据 action，需要 Preact 接入时再增加 `hooks.ts`；复杂到有必要时才拆分其他文件。

不按 global/local 划分目录：同一个业务工厂可以创建不同作用域的实例。`app/` 只负责组装应用共享实例和传递 Context，业务数据仍属于对应模块。

## 固定文件职责

| 文件            | 职责                                                   |
| --------------- | ------------------------------------------------------ |
| 模块 `index.ts` | 纯数据工厂、类型、数据 action，不依赖 Preact           |
| `hooks.ts`      | 所有 store 接入 hook：创建、获取、订阅和所有者卸载清理 |
| `context.tsx`   | Context 定义和 Provider，只传递已有实例，不调用 hooks  |
| 就近测试        | 验证本模块的状态、订阅或生命周期行为                   |

文件按需创建，职责固定。顶层 `stores/index.ts` 是对外聚合入口，允许导出 hooks 和 Provider；模块内的 `index.ts` 则必须保持纯数据。

跨模块使用 `@/`，模块内部使用 `./`；例如Loading 数据工厂导入 `@/stores/core`，Loading 绑定 hook 导入 `./index`。别名不会绕过依赖边界检查。

内部模块直接引用具体模块，不能反向引用顶层 `stores/index.ts`，避免循环依赖。`core/` 不导入 app 或业务模块；各模块的 `index.ts` 保持纯 TypeScript，Preact 接入单独放在 hooks/context 文件。

业务数据模块不获取整个 app 集合；多个 store 协作时，由所有者将所需实例传给业务工厂或场景 hook。共享业务的读取 hook 可以通过 `app/hooks.ts` 获取集合，再订阅对应成员。

业务状态统一由 store 管理。每个业务工厂新建自己的初始数据，只暴露 getSnapshot、subscribe、业务 action 和 dispose。不要暴露内部 update 给 UI。

业务 store 从 `@/stores/core` 导入状态容器，避免加载 Preact 接入层。组件使用方式：

```ts
import { useLocalLoadingStore } from '@/stores';

const { state, store } = useLocalLoadingStore();
// state.isLoading 读取渲染状态，store.start() / store.finish() 修改数据。
```

修改、重置数据属于 store action；Toast、Loading、Modal 和导航属于场景 hook / 页面。具体场景的 hook 留在顶层 hooks 目录，不要求每个业务 store 都配专用 hook。

## 可选持久化

`createStore` 默认只使用内存。`persistStore(state, options)` 是独立扩展，调用时同步读取缓存、校验后仅恢复选中字段，再订阅后续变化。当前 Loading 和空的 app 集合不启用持久化。

参与预渲染的业务通过显式 action 接入一次，由所有者在客户端 effect 中调用，不在 store 工厂内立即恢复。这样构建与浏览器首帧都使用相同初始值；恢复结束前禁用编辑和提交，并延后依赖草稿的请求。仅给 storage getter 加 `typeof window` 判断不能解决首帧不同的问题。完整边界见 [预渲染业务约定](../../README.md#业务开发约定)。

```ts
import { createStore, persistStore } from '@/stores/core';

// 仅为接入示例，不在生产应用预置草稿模块。
export function createDraftStore(channelCode: string) {
  const state = createStore({ name: '', ready: false });
  let persistence: ReturnType<typeof persistStore> | undefined;
  let disposed = false;

  return {
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    startPersistence() {
      if (disposed || persistence) return;
      persistence = persistStore(state, {
        key: `landing:draft:${encodeURIComponent(channelCode)}`,
        version: 1,
        pick: ['name'],
        storage: () => window.sessionStorage,
        maxAgeMs: 30 * 60 * 1000,
        validate: (value): value is { name: string } =>
          typeof value === 'object' &&
          value !== null &&
          'name' in value &&
          typeof value.name === 'string',
      });
      state.update((current) => ({ ...current, ready: true }));
    },
    setName(name: string) {
      if (!state.getSnapshot().ready) return;
      state.update((current) => ({ ...current, name }));
    },
    reset() {
      state.update((current) => ({ ...current, name: '' }));
      persistence?.clear();
    },
    dispose() {
      disposed = true;
      persistence?.dispose();
      state.dispose();
    },
  };
}
```

配套的 `stores/draft/hooks.ts` 示例如下，UI 使用 `state.ready` 控制编辑与提交。`channelCode` 由所有者明确传入并在该实例生命周期内固定；渠道变化时重建所有者，工厂参数不会自动更新。

```ts
import { useEffect } from 'preact/hooks';
import { useStore, useStoreInstance } from '@/stores/core/hooks';
import { createDraftStore } from './index';

// draft 是上方业务示例，不是模板现有模块。
export function useLocalDraftStore(channelCode: string) {
  const store = useStoreInstance(() => createDraftStore(channelCode));
  const state = useStore(store);
  useEffect(() => {
    store.startPersistence();
  }, [store]);
  // useStoreInstance 在所有者卸载时调用 store.dispose()。
  return { state, store };
}
```

配置统一为：

| 配置       | 规则                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`      | 必填、非空，实例创建后固定；按渠道、用户、订单等真实业务范围区分，不把所有渠道保存到同一个大 Map                                                      |
| `version`  | 必填、非负整数；版本不一致丢弃旧缓存，不提供自动迁移                                                                                                  |
| `pick`     | 必填，只选择一级字段；字段值必须适合 JSON 保存，嵌套数据的校验由业务提供                                                                              |
| `storage`  | 必填 getter，返回具有 getItem/setItem/removeItem 的同步存储；返回 undefined 时仅用内存。用 getter 捕获访问 localStorage/sessionStorage 属性本身的异常 |
| `validate` | 必填类型守卫，校验选中字段；恢复时即使缓存有其他字段，也不会覆盖未选中的内存状态                                                                      |
| `maxAgeMs` | 可选、正有限数，省略表示无有效期；按最后一次成功写入计算，只在恢复时检查，不定时清空正在使用的内存状态                                                |
| `onError`  | 可选，默认 console.error；存储访问、JSON 处理、校验器抛错等通过它报告，报告器自身异常也不会中断状态更新                                               |

缓存使用 `{ version, savedAt, data }`。JSON 损坏、版本或结构不符、超过有效期时忽略并尝试删除当前 key，不清空整个存储。存储受限、额度不足或序列化失败时保留内存状态；失败写入不会标记成功，后续更新可以重试。

首次接入不写初始值，恢复也不刷新有效期。仅当 `pick` 数据的 JSON 内容变化时同步写入，不因 pending/loading 等未选中字段变化反复写入。适用于少量 JSON 状态，不是大型数据或高频输入的缓存数据库；不内置异步存储、压缩、加密和跨标签同步。

`persistence.dispose()` 停止同步并解除订阅，保留缓存和内存 store；由业务 store 的 dispose 先调用它，再销毁状态容器。`persistence.clear()` 只删除当前缓存，不重置内存、不停止订阅；随后选中字段变化仍可保存。退出或流程完成时，需要业务 action 先重置内存再清缓存，或者先停止同步再做清理。

存储作用域不等于 store 实例作用域。同一 storage/key 的多个实例仍可能覆盖，扩展不提供锁、合并或 storage 事件同步。sessionStorage 按标签页隔离，但同一标签页切渠道要使用不同 key，新窗口还可能复制 opener 的初始数据；localStorage 按同源共享，只有明确需要共享的数据才使用它。渠道、用户变化时销毁旧实例并按新上下文创建，不让活跃实例悄悄更换缓存 key。

渠道和 siteId 默认仍从当前 URL 对应的初始化接口获取，不以旧缓存覆盖当前路由上下文。订单只恢复定位信息，再向后端确认真实状态；Loading、Modal、请求错误、控制器不持久化。凭证及敏感信息按认证和业务要求单独设计，不随整个 store 自动保存。

单元测试位于 `core/persist.test.ts`，真实浏览器存储验证位于 `tests/browser/persist.spec.ts`，覆盖刷新、多标签页、不同渠道 key、禁用存储及缺少 Object.fromEntries。测试页面只存在于 Landing 的 test fixture，现代浏览器模拟能力缺失不等于旧设备真机验收。

## 创建与读取必须区分

| 接口                 | 含义                                               | 谁负责销毁           |
| -------------------- | -------------------------------------------------- | -------------------- |
| `createXxxStore()`   | 普通 TypeScript 工厂，每次新建实例                 | 调用方               |
| `useLocalXxxStore()` | 当前所有者创建并订阅独立实例                       | 所有者卸载时自动清理 |
| `useAppStores()`     | 获取应用已有的共享实例集合，不创建、不订阅整个集合 | `app.tsx` 中的所有者 |
| `useXxxStore()`      | 预留给读取 Context 中已有的业务实例并订阅的 hook   | 共享实例的所有者     |
| `useStore(store)`    | 只订阅显式传入的实例                               | 不负责销毁           |

`useLocalLoadingStore()` 每个调用位置都有独立实例；需要共享时，通过 props/Context 传递返回的 store，消费者调用 `useStore(store)`。禁止在缺少 Context 时自动回退到创建新实例。

## Loading 的复用范围

`createLoadingStore()` 只管理 `isLoading` 和 start/finish 数据 action；`useLocalLoadingStore()` 创建并订阅局部实例。`hooks/use-loading/index.ts` 的 `useLoading()` 进一步管理带遮罩的反馈展示，返回 `{ isLoading, startLoading, finishLoading }`，可用于路由或其他需要显式开始/结束提示的场景。

每次调用创建独立状态；重复 start 不计数，一次 finish 即结束当前实例的 loading。它不是并发请求计数器，也不会自动与其他业务 store 的 pending 状态同步。已有请求状态时，以业务 store 为准，由场景 hook 协调反馈，避免额外维护一份相同状态。公共反馈仍沿用单实例机制，多处调用不代表能同时展示多个 Loading。

## 全局入口与边界

`app.tsx` 通过 `useStoreInstance(createAppStores)` 创建一次共享集合，在 Router 外提供 `AppStoresProvider`。路由切换不重建它，应用卸载调用集合的 dispose。Provider 只传递实例，本身不创建、不销毁，因此可以用于独立 Modal 渲染根的 Context 桥接。

```ts
import { useAppStores } from '@/stores';

const stores = useAppStores(); // stores.channel 是当前应用的渠道上下文实例。
```

`useChannelStore()` 返回 `{ state, store }`，只获取并订阅已有 `channel`，不会新建实例。`state` 包含 `initialized`、`context`、`error`；`sync(search)` 是 URL 同步入口，由应用初始化 hook 调用，业务不另行写入一套渠道身份。字段及跳转规则见 [渠道上下文与导航](../../README.md#渠道上下文与导航)。此 store 只使用内存，没有接口配置或持久化。

`getInitialSnapshot()` 保留该实例的初始空快照，供接入 hook 保证懒加载页面 hydration 的首帧一致；挂载后切换到实时快照。业务 UI 使用 `useChannelStore()`，不直接读取快照绕过该边界。

后续按业务增加会话等显式成员，由 `createAppStores` 组装并逐项清理。业务字段留在对应模块中，集合不提供通用 set/update、动态注册表或混合快照；组件只订阅需要的成员。业务绑定写在对应的 `stores/<name>/hooks.ts`，不堆进通用 `core/hooks.ts`。渠道配置请求和会话业务尚未实现。

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
