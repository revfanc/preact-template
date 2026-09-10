# @packages/feedback

## Toast / Loading

应用在 dependencies 中声明 `"@packages/feedback": "workspace:*"`，即可直接调用。样式随包自动引入，不需要挂载组件或 Provider，也不依赖 Preact。

```ts
import { toast, loading } from '@packages/feedback';

toast('操作成功'); // 默认 2 秒后淡出，替换当前提示
toast('请稍后重试', { duration: 3000 });

const closeToast = toast('持续提示', { duration: 0 });
closeToast();

const closeLoading = loading({ message: '正在提交…', mask: true });
try {
  await submit(); // 应用自己的异步操作
  toast('提交成功');
} finally {
  closeLoading();
}
```

- 返回的关闭函数可以重复调用，只影响本次提示。组件卸载时也应关闭它持有的 Loading。
- 连续 Loading 调用支持多个并发操作；显示最近一次仍在进行的操作文案，所有调用都关闭后才消失，不设置自动超时。
- Toast 与 Loading 共用一个居中的 DOM 提示框，同时最多显示一个。Toast 替换当前 Loading 组；新的 Loading 替换 Toast。被替换的提示不会恢复，旧关闭函数或计时器不会关闭新提示；替换提示不会取消业务请求。
- `loading()` 只显示三圆点；`loading('正在提交…')` 或 `loading({ message: '正在提交…' })` 在圆点下方显示文字。立即展示，没有显示延迟或最短停留时间。最后一个任务关闭时立即解除遮罩，暂停圆点并保持当前尺寸，用 140ms 淡出后移除；退场期间的新任务复用原节点并取消删除。文字和提示类型变化时，宽高按自然尺寸用 180ms 过渡。Toast 仍为随文字撑开的提示条，默认 2000ms 后用 140ms 淡出，`duration: 0` 由调用方关闭。
- `mask` 默认 `false`，背景可点击；`loading({ mask: true })` 使用透明遮罩拦截背景点击及点击/提交事件。并发任务中任何未结束的任务设置 `mask: true` 都会保留遮罩；这些任务关闭后解除拦截，切换 toast 时也会解除。它不取消请求，也不替代业务提交防重。提示只展示纯文本，不抢焦点、不锁滚动；减少动态效果设置会关闭跳动和尺寸过渡。
- 在浏览器 `document.body` 就绪后调用。Toast 和 Loading 字号统一为固定 18px，通过现有 `.no-rem` 约定避免落地页自动转 rem，让协议页与落地页的提示大小一致。

## 函数式 Modal

从独立入口 `@packages/feedback/modal` 导入。使用方需要 Preact 10；只使用 Toast/Loading 的应用无需加载 Modal 渲染代码。下方的 `NameForm` 由调用方实现，不是包内组件。

```tsx
import { modal, ModalCancelledError } from '@packages/feedback/modal';

const task = modal<string>({
  position: 'center',
  closeOnClickOverlay: false,
  overlayStyle: { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  render: ({ resolve, reject, closing }) => (
    <NameForm
      initial="小明"
      closing={closing}
      onConfirm={resolve}
      onCancel={() => reject()}
    />
  ),
});

try {
  const name = await task;
  // 使用组件返回的 name
} catch (error) {
  if (!(error instanceof ModalCancelledError)) throw error;
}

// 页面卸载或其他主动关闭场景：task.close()
```

- 基础层仅提供遮罩、无样式的内容挂载容器和栈管理，没有标题、关闭按钮、白色面板、圆角、内边距或内容动画。尺寸、外观、标题、按钮和内容动画都由 `render` 中的业务组件实现。
- `position` 支持 `center`（默认）、`top`、`bottom`、`left`、`right`，只控制挂载容器相对视口的对齐；内容组件自己控制尺寸。`closeOnClickOverlay` 默认为 false，`overlayStyle` 只覆盖当前遮罩。
- 每次调用创建独立栈项及遮罩，多层遮罩自然叠加。只有栈顶可交互，Escape 和遮罩点击只关闭栈顶；下层保持挂载与状态。`task.close()` 可关闭任意对应层，包括中间层，不影响其余 Promise。
- `resolve(value)` 关闭并兑现 Promise；`reject(reason)` 原样拒绝。无参数 `reject()`、`task.close()`、Escape、遮罩关闭统一拒绝为 `ModalCancelledError`，`reason` 分别为 `cancel`、`close`、`escape`、`overlay`。每层只接受首次结算；捕获取消以避免未处理的 Promise 拒绝。
- 遮罩使用 160ms 淡入淡出，关闭后卸载组件再结算 Promise；减少动态效果时跳过动画等待。组件渲染错误会清理该层并拒绝 Promise。事件回调或请求中的异常由业务组件自行捕获并决定是否调用 `reject`。
- `render` 还会收到 `closing` 状态：任何关闭方式都会将其置为 true，组件可据此执行自己的 160ms 退场过渡。业务组件应支持中途关闭，并在用户开启减少动态效果时禁用过渡；相关交互由 [Landing 独立测试夹具](../../apps/landing/test/README.md) 验证，正式首页不包含 Modal 演示。
- 遮罩拦截点击、滚轮及触摸手势，阻止事件冒泡到页面和触摸后的合成点击；退场期间继续阻止背景交互。点击遮罩默认不关闭，需显式设置 `closeOnClickOverlay: true`。
- 弹窗栈容器固定为 z-index 1500，内部排序不会越过 Toast/Loading 的 2000。Loading 的 mask 为 true 时也会拦截弹窗点击。
- 基础层限制焦点在栈顶内并锁定页面滚动，关闭栈顶时恢复上一层焦点，最后一层关闭后恢复页面。内容组件自行提供 `role="dialog"`、`aria-modal="true"` 和可访问名称，并处理内部滚动。
- Modal 使用独立 Preact 渲染根，不自动继承调用位置的 Context；通过 props 传入数据，需要 Provider 时在 render 内显式包裹。页面持有任务时应在卸载时调用各自的 close。

参考：[Preact render](https://preactjs.com/guide/v10/api-reference/#render)、[WAI-ARIA Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。
