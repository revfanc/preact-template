import {
  AsyncModalContent,
  modal,
  ModalCancelledError,
} from '@packages/feedback';

const fixture = {
  open(timeout = 15000) {
    const task = modal<string>({
      render: (controls) => (
        <AsyncModalContent
          controls={controls}
          load={() => import('./async-dialog')}
          timeout={timeout}
          render={({ default: Dialog }, current) => <Dialog {...current} />}
        />
      ),
    });
    void task.then(
      (value) => {
        document.querySelector('output')!.textContent = value;
      },
      (error) => {
        document.querySelector('output')!.textContent =
          error instanceof ModalCancelledError ? '已取消' : '异常';
      },
    );
    return task;
  },
};
document.getElementById('open')!.onclick = () => {
  fixture.open();
};
window.asyncModalFixture = fixture;
declare global {
  interface Window {
    asyncModalFixture: typeof fixture;
  }
}
