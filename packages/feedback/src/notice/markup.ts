/** Internal notice markup shared by loading and toast. */
export const loadingHtml = [
  '<div class="pkg-ui-layer pkg-ui-mask">',
  '<div class="pkg-ui-notice no-rem pkg-ui-loading pkg-ui-visible" role="status" aria-live="polite" aria-atomic="true" aria-label="正在加载页面">',
  '<div class="pkg-ui-content"><div class="pkg-ui-dots" aria-hidden="true"><span></span><span></span><span></span></div><span class="pkg-ui-label" hidden></span></div>',
  '</div></div>',
].join('');
