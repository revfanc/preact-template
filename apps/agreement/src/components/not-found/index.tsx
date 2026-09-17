export const title = '页面不存在';

export default function NotFound() {
  return (
    <section class="not-found">
      <p class="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>{title}</h1>
      <p>该协议不存在或已失效，请确认链接后重试。</p>
    </section>
  );
}
