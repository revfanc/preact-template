import type { ModalControls } from '@packages/feedback';
import { NameModal } from './src/components/name-modal';

export default function Dialog(controls: ModalControls<string>) {
  return (
    <NameModal
      initial="异步内容"
      closing={controls.closing}
      onConfirm={controls.resolve}
      onCancel={() => controls.reject()}
    />
  );
}
