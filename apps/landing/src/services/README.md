# Services

这里放普通 TypeScript 业务函数：多步骤流程、业务判断和可复用规则。

不使用 Preact hooks，不创建全局 store，不直接打开弹窗或跳转。通过输入参数接收 API、状态更新接口或取消信号，返回明确业务结果。简单 API 转发不必包装成 service。

当前没有真实业务，暂不创建空函数或模拟登录/订单实现。新增文件按业务命名，例如 application.ts、order.ts。

完整约定见 [Landing 架构](../../ARCHITECTURE.md)。
