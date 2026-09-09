import { expect, test } from '@playwright/test';

test('landing configuration, keyboard form and agreement navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('footer')).toContainText('示例服务提供方');
  await expect(page.locator('meta[name="app-env"]')).toHaveAttribute(
    'content',
    process.env.BUILD_MODE ?? 'test',
  );
  await page.getByLabel('你的称呼').fill('小明');
  await page.getByLabel('你的称呼').press('Enter');
  await expect(page.locator('form').getByRole('status')).toHaveText(
    '你好，小明。欢迎开启新的体验。',
  );
  await expect(page.locator('.pkg-ui-toast')).toHaveText('欢迎语已生成');
  await expect(page.getByLabel('你的称呼')).toBeFocused();
  await expect(page.locator('.pkg-ui-toast')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/landing.png', fullPage: true });
  await expect(page.locator('.pkg-ui-toast')).toHaveCount(0);
  await page.getByRole('link', { name: '阅读示例协议' }).click();
  await expect(page.locator('#display-name')).toHaveText('小明');
  await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
  expect(errors).toEqual([]);
});

for (const app of [
  { name: 'landing', path: '/', loaded: 'footer' },
  { name: 'agreement', path: '/agreement/', loaded: '#company-name' },
]) {
  test(`${app.name} shows loading during a request and clears it afterwards`, async ({
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
      await page.goto(app.path);
      const indicator = page.locator('.pkg-ui-loading');
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveAttribute('role', 'status');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(indicator).toHaveCSS('transition-duration', '0s');
      await expect(page.locator('.pkg-ui-dots span').first()).toHaveCSS(
        'animation-name',
        'none',
      );
      for (const width of [320, 540]) {
        await page.setViewportSize({ width, height: 812 });
        await expect(indicator).toHaveCSS('font-size', '18px');
        const box = await indicator.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(16);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 16);
      }
      await page.screenshot({
        path: `test-results/${app.name}-loading.png`,
        fullPage: true,
      });
    } finally {
      release();
    }
    await expect(page.locator(app.loaded)).toContainText('示例服务提供方');
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  });
}

test('loading fades out with stationary dots and stable dimensions', async ({
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
    await page.goto('/');
    const indicator = page.locator('.pkg-ui-loading');
    await expect(page.getByLabel('你的称呼')).toBeVisible();
    await expect(indicator).toHaveCSS('opacity', '1');
    const samplesPromise = indicator.evaluate(
      (element) =>
        new Promise<
          Array<{
            opacity: number;
            width: number;
            height: number;
            transforms: string[];
            states: string[];
          }>
        >((resolve) => {
          const samples: Array<{
            opacity: number;
            width: number;
            height: number;
            transforms: string[];
            states: string[];
          }> = [];
          const sample = () => {
            if (!element.isConnected) {
              resolve(samples);
              return;
            }
            if (!element.classList.contains('pkg-ui-visible')) {
              const box = element.getBoundingClientRect();
              const dots = Array.from(
                element.querySelectorAll('.pkg-ui-dots span'),
              ).map((dot) => getComputedStyle(dot));
              samples.push({
                opacity: Number(getComputedStyle(element).opacity),
                width: box.width,
                height: box.height,
                transforms: dots.map((style) => style.transform),
                states: dots.map((style) => style.animationPlayState),
              });
            }
            requestAnimationFrame(sample);
          };
          element.setAttribute('data-exit-observer', 'ready');
          requestAnimationFrame(sample);
        }),
    );
    await expect(indicator).toHaveAttribute('data-exit-observer', 'ready');
    release();
    const samples = await samplesPromise;
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(
      samples.some((sample) => sample.opacity > 0 && sample.opacity < 1),
    ).toBe(true);
    for (const sample of samples) {
      expect(sample.width).toBeCloseTo(samples[0]!.width, 1);
      expect(sample.height).toBeCloseTo(samples[0]!.height, 1);
      expect(sample.transforms).toEqual(samples[0]!.transforms);
      expect(sample.states).toEqual(['paused', 'paused', 'paused']);
    }
    await expect(indicator).toHaveCount(0);
    await expect(page.locator('.pkg-ui-layer')).toHaveCount(0);
  } finally {
    release();
  }
});

test('rem scales from 320px and caps at a 540px content width', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('footer')).toContainText('示例服务提供方');
  for (const width of [320, 375, 540, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const size = await page.evaluate(() => ({
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      content: document.querySelector('main')!.getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(size.root).toBeCloseTo(Math.min(width, 540) / 10, 1);
    expect(size.content).toBeCloseTo(Math.min(width, 540), 0);
    expect(size.overflow).toBe(false);
  }
});

test('configuration failure offers a working retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/site-config.json', (route) =>
    ++attempts === 1
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.continue(),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('加载失败');
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.locator('footer')).toContainText('示例服务提供方');
});

test('agreement body is readable and styled with JavaScript disabled', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of ['', 'privacy/']) {
    await page.goto(`http://127.0.0.1:4173/agreement/${route}`);
    await expect(page.locator('body')).toHaveCSS('margin', '0px');
    await expect(page.locator('main')).toHaveCSS('padding', '32px 24px');
    await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
    await expect(
      page.getByRole('heading', {
        name: route ? '隐私协议示例' : '示例协议',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '一、文档用途' }),
    ).toBeVisible();
    await expect(page.locator('noscript')).toBeVisible();
  }
  await context.close();
});

test('agreement deep links and refresh share the static layout and runtime', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/agreement/privacy/?name=小明');
  await expect(
    page.getByRole('heading', { name: '隐私协议示例', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#display-name')).toHaveText('小明');
  await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
  const runtime = await page.locator('#agreement-runtime').getAttribute('src');
  await page.reload();
  await expect(page.locator('#display-name')).toHaveText('小明');
  await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
  await page.getByRole('link', { name: '返回示例协议' }).click();
  await expect(
    page.getByRole('heading', { name: '示例协议', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#agreement-runtime')).toHaveAttribute(
    'src',
    runtime!,
  );
  await page.getByRole('link', { name: '查看隐私协议示例' }).click();
  await expect(
    page.getByRole('heading', { name: '隐私协议示例', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('agreement layout is styled before its dynamic script arrives', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/runtime/agreement.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/agreement/', { waitUntil: 'commit' });
    await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
    await expect(page.locator('body')).toHaveCSS('margin', '0px');
    await expect(page.locator('main')).toHaveCSS('padding', '32px 24px');
    await expect(page.locator('#company-name')).toHaveText('待加载');
    const heading = await page.locator('h1').boundingBox();
    release();
    await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
    expect(await page.locator('h1').boundingBox()).toEqual(heading);
  } finally {
    release();
  }
});

test('dynamic fields use text and tolerate malformed query encoding', async ({
  page,
}) => {
  await page.goto(
    `/agreement/?name=${encodeURIComponent('<img src=x onerror=alert(1)>')}`,
  );
  await expect(page.locator('#display-name')).toHaveText(
    '<img src=x onerror=alert(1)>',
  );
  await expect(page.locator('#display-name img')).toHaveCount(0);
  await page.goto('/agreement/?name=%E0%A4%A');
  await expect(page.locator('#display-name')).toHaveText('未提供');
});

for (const legacyCase of [
  {
    name: 'fetch, Promise and AbortController missing',
    apis: [
      'fetch',
      'Request',
      'Response',
      'Headers',
      'AbortController',
      'AbortSignal',
      'Promise',
      'URL',
      'URLSearchParams',
    ],
  },
  {
    name: 'native fetch present but AbortController missing',
    apis: ['AbortController', 'AbortSignal'],
  },
]) {
  test(`legacy bundles boot both apps with ${legacyCase.name}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const loaded: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.resourceType() === 'script') loaded.push(request.url());
    });
    await page.addInitScript((apis) => {
      Object.defineProperty(Event.prototype, 'composedPath', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(Object, 'fromEntries', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      for (const key of apis) {
        Object.defineProperty(window, key, {
          value: undefined,
          writable: true,
          configurable: true,
        });
      }
    }, legacyCase.apis);
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document')
        return route.continue();
      const response = await route.fetch();
      const body = (await response.text())
        .replace(/<script\b[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '')
        .replace(/\snomodule\b/g, '');
      await route.fulfill({ response, body });
    });
    await page.goto('/');
    const landingEntry = await page
      .locator('#vite-legacy-entry')
      .getAttribute('data-src');
    await page.evaluate(async () => {
      const system = (
        window as unknown as {
          System: { import(url: string): Promise<unknown> };
        }
      ).System;
      await system.import(
        document.getElementById('vite-legacy-entry')!.getAttribute('data-src')!,
      );
    });
    await expect(page.locator('footer')).toContainText('示例服务提供方');
    await page.getByLabel('你的称呼').fill('旧版浏览器');
    await page.getByRole('button', { name: '预览欢迎语' }).click();
    await expect(page.locator('form').getByRole('status')).toContainText(
      '你好，旧版浏览器',
    );
    await expect(page.locator('.pkg-ui-toast')).toHaveText('欢迎语已生成');
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
    await page
      .getByRole('link', { name: '查看结果页' })
      .locator('span')
      .click();
    await expect(
      page.getByRole('heading', { name: '欢迎语结果' }),
    ).toBeVisible();
    await expect(page.getByText('你好，旧版浏览器')).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel('你的称呼')).toBeVisible();
    await page.getByLabel('你的称呼').fill('旧版浏览器');
    await page.getByRole('link', { name: '阅读示例协议' }).click();
    await expect(page.locator('#display-name')).toHaveText('旧版浏览器');
    await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
    const agreementEntry = await page
      .locator('#agreement-runtime')
      .getAttribute('src');
    expect(loaded).toEqual(
      expect.arrayContaining([
        new URL(landingEntry!, 'http://127.0.0.1:4173/').href,
        new URL(agreementEntry!, 'http://127.0.0.1:4173/agreement/').href,
      ]),
    );
    expect(errors).toEqual([]);
  });
}

test('a compact toast replaces loading in the same element and survives an old request', async ({
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
    await page.goto('/');
    const card = page.locator('.pkg-ui-notice');
    await expect(page.locator('.pkg-ui-loading')).toHaveCSS('opacity', '1');
    const before = await card.boundingBox();
    const original = await card.elementHandle();
    await page.getByLabel('你的称呼').fill('小明');
    await page.getByRole('button', { name: '预览欢迎语' }).click();
    await expect(card).toHaveCount(1);
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
    await expect(page.locator('.pkg-ui-toast')).toHaveText('欢迎语已生成');
    expect(
      await original!.evaluate(
        (node) => node === document.querySelector('.pkg-ui-toast'),
      ),
    ).toBe(true);
    await expect
      .poll(() => card.evaluate((node) => (node as HTMLElement).style.width))
      .toBe('');
    const after = await card.boundingBox();
    expect(after!.height).toBeLessThan(before!.height);
    expect(after!.width).toBeLessThanOrEqual(343);
    expect(after!.x + after!.width / 2).toBeCloseTo(
      before!.x + before!.width / 2,
      1,
    );
    expect(after!.y + after!.height / 2).toBeCloseTo(
      before!.y + before!.height / 2,
      1,
    );
    await expect(page.locator('.pkg-ui-dots')).toBeHidden();
    release();
    await expect(page.locator('footer')).toContainText('示例服务提供方');
    await expect(page.locator('.pkg-ui-toast')).toHaveText('欢迎语已生成');
    await expect(card).toHaveCount(0);
  } finally {
    release();
  }
});
