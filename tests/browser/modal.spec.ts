import { expect, test } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:4176/landing/' });

test('modal stack retains state, traps focus and restores the previous layer and page', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/landing/');
  await expect(page.locator('footer')).toContainText('示例服务提供方');
  await page.getByLabel('你的称呼').fill('页面称呼');
  const trigger = page.getByRole('button', { name: '在弹窗中填写' });
  await trigger.click();
  const parent = page.getByRole('dialog', { name: '填写称呼' });
  await expect(parent.getByLabel('弹窗中的称呼')).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await parent.getByLabel('弹窗中的称呼').fill('保留父层');
  await parent.getByRole('button', { name: '再打开一层' }).click();
  const child = page.getByRole('dialog', { name: '另一层弹窗' });
  await expect(child).toBeVisible();
  await expect(page.locator('[data-modal-overlay]')).toHaveCount(2);
  await expect(page.locator('[data-modal][aria-hidden="true"]')).toHaveCount(1);
  await expect(child.getByLabel('弹窗中的称呼')).toBeFocused();
  await expect(
    page.locator('[data-modal]').last().locator('[data-modal-overlay]'),
  ).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.25)');
  await child.getByRole('button', { name: '确认称呼' }).focus();
  await page.keyboard.press('Tab');
  await expect(child.getByLabel('弹窗中的称呼')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(child.getByRole('button', { name: '确认称呼' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(
    parent.getByRole('button', { name: '再打开一层' }),
  ).toBeFocused();
  await expect(parent.getByLabel('弹窗中的称呼')).toHaveValue('保留父层');
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await parent.getByRole('button', { name: '确认称呼' }).click();
  await expect(page.locator('[data-modal-root]')).toHaveCount(0);
  await expect(page.getByLabel('你的称呼')).toHaveValue('保留父层');
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  expect(errors).toEqual([]);
});

test('nested modal returns a value and overlay dismissal is disabled by default', async ({
  page,
}) => {
  await page.goto('/landing/');
  await page.getByRole('button', { name: '在弹窗中填写' }).click();
  const parent = page.getByRole('dialog', { name: '填写称呼' });
  await parent.getByRole('button', { name: '再打开一层' }).click();
  const child = page.getByRole('dialog', { name: '另一层弹窗' });
  await child.getByLabel('弹窗中的称呼').fill('子层结果');
  await child.getByRole('button', { name: '确认称呼' }).click();
  await expect(child).toHaveCount(0);
  await expect(parent.getByLabel('弹窗中的称呼')).toHaveValue('子层结果');
  for (const width of [320, 540, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    const bounds = await parent.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width - 40);
    expect(bounds!.x + bounds!.width / 2).toBeCloseTo(width / 2, 0);
  }
  await page.screenshot({ path: 'test-results/modal-example.png' });
  await page.mouse.click(8, 8);
  await expect(parent).toBeVisible();
  await parent.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('[data-modal-root]')).toHaveCount(0);
  await expect(page.getByLabel('你的称呼')).toHaveValue('');
});

test('overlay consumes mouse, wheel and touch events without reaching the page', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    viewport: { width: 375, height: 812 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/landing/');
    await page.getByRole('button', { name: '在弹窗中填写' }).click();
    await page.evaluate(() => {
      for (const type of ['click', 'pointerup', 'touchend', 'wheel']) {
        document.body.addEventListener(type, () => {
          document.body.dataset.leaked = type;
        });
      }
    });
    await page.mouse.click(8, 8);
    await page.mouse.wheel(0, 500);
    await page.touchscreen.tap(8, 8);
    await expect(page.locator('[data-modal]')).toHaveCount(1);
    await expect(page.locator('body')).toHaveCSS('position', 'fixed');
    expect(await page.locator('body').getAttribute('data-leaked')).toBeNull();
    // Inputs inside the content remain usable despite the overlay guard.
    await page.getByLabel('弹窗中的称呼').fill('触摸输入');
    await page.getByRole('button', { name: '确认称呼' }).click();
    await expect(page.getByLabel('你的称呼')).toHaveValue('触摸输入');
  } finally {
    await context.close();
  }
});

test('content fades and moves on entry and exit before it unmounts', async ({
  page,
}) => {
  await page.goto('/landing/');
  const entry = await page.evaluate(async () => {
    const trigger = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('在弹窗中填写'),
    )!;
    trigger.click();
    const card = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const samples: number[] = [];
    while (samples.length < 15) {
      samples.push(Number(getComputedStyle(card).opacity));
      await new Promise(requestAnimationFrame);
    }
    return samples;
  });
  expect(entry[0]).toBe(0);
  expect(entry.some((value) => value > 0 && value < 1)).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  const exit = await page.evaluate(async () => {
    const card = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const cancel = Array.from(card.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '取消',
    )!;
    cancel.click();
    const samples: { opacity: number; transform: string }[] = [];
    while (card.isConnected) {
      const style = getComputedStyle(card);
      samples.push({
        opacity: Number(style.opacity),
        transform: style.transform,
      });
      await new Promise(requestAnimationFrame);
    }
    return samples;
  });
  expect(exit.some(({ opacity }) => opacity > 0 && opacity < 1)).toBe(true);
  expect(new Set(exit.map(({ transform }) => transform)).size).toBeGreaterThan(
    1,
  );
  await expect(page.locator('[data-modal-root]')).toHaveCount(0);
});

test('loading stays above the modal stacking context and navigation cleans up every modal', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/site-config.json', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/landing/');
    await page.getByRole('link', { name: '查看结果页' }).click();
    await page.goBack();
    await page.getByRole('button', { name: '在弹窗中填写' }).click();
    const root = page.locator('[data-modal-root]');
    await expect(page.locator('.pkg-ui-loading')).toBeVisible();
    await expect(root).toHaveCSS('z-index', '1500');
    await expect(page.locator('.pkg-ui-layer')).toHaveCSS('z-index', '2000');
    await page.getByRole('button', { name: '再打开一层' }).click();
    await expect(page.locator('[data-modal]')).toHaveCount(2);
    // Browser history can leave the page without clicking its blocked content.
    await page.goForward();
    await expect(
      page.getByRole('heading', { name: '欢迎语结果' }),
    ).toBeVisible();
    await expect(root).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  } finally {
    release();
  }
});
