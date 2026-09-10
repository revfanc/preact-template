# @packages/browser

当前页面的返回拦截。原生 History API 实现，不依赖 Preact、路由或 UI 包。包直接导出 TypeScript 源码，由应用编译。应用需要声明 `"@packages/browser": "workspace:*"`。

## 使用

```ts
import { register, type Unregister } from '@packages/browser';

const unregister: Unregister = register(
  async (done) => {
    const confirmed = await showConfirm(); // 由业务实现
    if (confirmed) await done();
    // done 自动移除本层；有下层停在 a+，最后一层完成才回到 a。
    // 无须再次注销；组件清理时重复调用 unregister 也安全。
  },
  { onError: (error) => console.error(error) },
);

// 主动导航前，先停用回调并等待保护位置清理。
await unregister();
// router.navigate(...) 或业务自己的 History 操作
```

导出类型：`Done = () => Promise<void>`、`BackHandler = (done: Done) => void | Promise<void>`、`Unregister = () => Promise<void>`、`RegisterOptions = { onError?: (error: unknown) => void }`。

## 同页注册栈

- 第一次注册形成 `a → a+`；后续注册只入栈，同一个函数注册多次也有独立身份。
- 返回只执行栈顶。栈顶调用 `done()` 完成并移除本层，有下层时保留在 `a+`，下次返回才执行下层；回调正常完成但没有调用 `done()` 则保留本层。
- 每个注销函数只移除自己的注册。移除中间层不影响栈顶；移除栈顶后下层接任，不在同一次返回中立即调用下层。
- 回调、恢复或放行忙碌期间，不重复分发回调。新增注册或移除正在执行的注册会使旧的放行权限失效。
- 最后一层 `done()` 成功后停在 `a`，栈已清空且监听器已解除，不重新补保护。前进到旧 `a+` 不会复活已完成的回调；新增注册才建立新的保护。

## 异步放行和清理

```text
用户返回 a+ → a
立即发起 go(1)，同时调用栈顶回调
done() 等待到达预期 a+，然后移除当前注册
还有下层：停在 a+，done() 完成；下次返回才执行下层
没有下层：执行一次 go(-1)，确认到达 a 后 done() 完成
```

- `done()` 和注销函数都可重复调用，同一次操作返回同一个 Promise。
- `done()` 恢复确认并开始移除本层后，该层的 `unregister()` 复用它的 Promise；无需额外清理。恢复确认前主动注销本层仍会使旧 `done()` 拒绝，但注销自身会正常收尾，不重复遍历。
- 异步决定必须包含在回调返回的 Promise 中。同步回调返回后再通过定时器调用捕获的 `done()` 会拒绝；请使用 `async/await`。
- 最后一个注册注销时，若恢复正在进行，先等待恢复，再清理到 `a`；若放行正在进行，共用现有的后退；若已在 `a` 或已离开所属页面，不追加后退。
- 最后一层清理尚未完成时，新注册会明确报错；先 `await done()` 或 `await unregister()` 再注册。组件卸载时可以发起注销，但紧随其后的主动导航或重新注册必须等待这个 Promise，不能只依赖卸载钩子的同步返回。
- 每次原生遍历最多等待 2 秒，以记录身份确认完成，超时不会被视为成功。超时、异常或意外落点会停用当前注册；按需在页面稳定后重新注册，不自动循环补偿。
- 权限失效使用 `name: 'AbortError'`，确认超时使用 `name: 'TimeoutError'`；业务异常保留原值。调用方可以 `try/catch`，错误也会交给对应注册的 `onError`，默认 `console.error`。同一个错误对象在当前作用域中只报告一次。
- 恢复确认前回调报错会撤销完成权限，本层继续保留。恢复确认并移除本层后，后续业务异常不会恢复该注册，最终清理由内部事务继续收尾；已经发出的 `go()` 没有取消接口。

### 语义变更

`done()` 现在表示完成当前注册，不再放行整个栈，也不保留已完成的回调。需要一次关闭全部拦截时，由调用方等待全部 `unregister()` 完成。公开函数签名保持不变。

## 页面与 History 约定

- 仅在浏览器的 `document.body` 就绪后注册；导入本身不访问 DOM，也不安装监听器。
- 支持 `null` 或普通对象形式的 `history.state`，保留业务字段。内部保留 `__packages_browser__` 命名空间，禁止业务覆盖或将整个带标记的 state 复制到新的历史记录。
- 记录包含版本、独立组标识、基础/保护类型及完整 URL。不同访问即使 URL 相同也不能共享旧事务。
- 刷新位于 `a+` 时，重新注册会接管现有保护记录，不增加历史；位于 `a` 时注册会建立新的 `a+`，允许截断前进历史。
- 前进本身不会触发回调或自动跳记录。这个包不保证恢复 `a → a+ → b → b+` 的完整前进链。
- 不覆写全局 `pushState` / `replaceState`。主动路由、URL（包括 hash/query）或 History 修改前，先等待当前页面全部注册注销；修改完成后再注册。否则遇到失配会停用旧事务。原样复制内部标记的外部修改无法可靠识别，属于不支持的用法。
- 最后一次注销只清理当前位置，不删除浏览器前进列表中的旧 `a+`；History API 没有删除任意记录的接口。后续建立新保护或正常 push 可自然截断它。

## 文档离开、刷新与 BFCache

`pagehide` 清空回调栈、使旧 `done()` 失效，并解除包的监听器。刷新后的 JS 函数由页面正常初始化重新注册；BFCache 恢复不会重新执行初始化代码，因此页面需要在 `pageshow.persisted` 时重新绑定。

```ts
let unregister: Unregister | undefined;

function bind() {
  unregister = register(handleBack, { onError: reportError });
}
bind();

window.addEventListener('pagehide', () => {
  // 包已负责停用；跨文档离开时不要再试图遍历旧文档。
  unregister = undefined;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) bind();
});
```

单页路由没有 `pagehide` 时由页面自身管理注销和重新注册。基础包不会恢复其他页面的业务回调。

## 能力边界与验证

只保证受管记录间可以确认的同文档单步返回。浏览器无交互跳记录、连续返回跨出记录组、长按选择历史、`go(-N)`、跨文档离开、刷新拦截、关闭标签页和原生 WebView 退出不在保证范围内。`busy` 防止重复业务回调，不是浏览器导航锁。

沿用仓库 Chrome 49、iOS 10 / Safari 10 编译目标；包不自行安装 Promise 等 polyfill，由应用的 legacy 构建提供。现代 Chromium 的脚本 History 测试、强制 legacy 入口和 ES2015 语法检查不能替代目标旧设备或真实工具栏返回测试。

独立验收页面放在本包 `test/fixture`，只用于测试，不进入 Landing 或 Agreement 的产物。`pnpm test:browser` 自动构建它并在 4175 端口运行。设置 `BUILD_MODE=prod` 可切换生产模式的验收构建。

参考：[History go](https://developer.mozilla.org/en-US/docs/Web/API/History/go)、[popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event)、[Chromium 历史干预](https://chromium.googlesource.com/chromium/src/+/main/docs/history_manipulation_intervention.md)。
