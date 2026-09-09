import { render } from 'preact';
import './style.css';

render(
  <main>
    <h1>落地页模板</h1>
    <a href={import.meta.env.VITE_AGREEMENT_URL}>查看示例协议</a>
  </main>,
  document.getElementById('app')!,
);
