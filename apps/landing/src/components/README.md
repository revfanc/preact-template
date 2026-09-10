# Components

应用展示组件放在独立目录中，入口为 index.tsx，样式为 index.module.css。业务数据通过 props 或所属作用域的连接层传入，交互调用 action；通用展示组件不自行请求业务接口。

跨应用通用 UI 放 packages/components。路由组件留在 pages，表单和布局留在这里。仅局部动画、DOM 测量等视觉状态可保留在组件内部。

状态归属、订阅和资源清理见 [Landing 架构](../../ARCHITECTURE.md)。
