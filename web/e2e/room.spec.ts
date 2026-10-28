import { expect, test, type Browser } from '@playwright/test';

// Headless Chromium has no screen picker: fake the shared screen with a canvas stream.
const fakeScreen = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = Object.assign(document.createElement('canvas'), { width: 320, height: 180 });
    const g = c.getContext('2d')!;
    setInterval(() => {
      g.fillStyle = `hsl(${Date.now() % 360} 80% 50%)`;
      g.fillRect(0, 0, 320, 180);
    }, 50);
    return c.captureStream(15);
  };
};

const open = async (browser: Browser) => {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(fakeScreen);
  return page;
};

test('two people join, chat and watch a shared screen', async ({ browser }) => {
  const ana = await open(browser);
  await ana.goto('/');
  await ana.getByLabel('Seu apelido').fill('Ana');
  await ana.getByRole('button', { name: 'Criar sala' }).click();
  await expect(ana.locator('#people li')).toHaveCount(1);

  const bia = await open(browser);
  await bia.goto(ana.url());
  await bia.getByLabel('Seu apelido').fill('Bia');
  await bia.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(bia.locator('#people li')).toHaveCount(2);
  await expect(ana.locator('#people li')).toHaveCount(2);
  await expect(ana.locator('#room-meta')).toContainText('2 de 10');

  await bia.getByLabel('Mensagem').fill('oi Ana');
  await bia.getByRole('button', { name: 'Enviar' }).click();
  await expect(ana.locator('#messages')).toContainText('oi Ana');

  await ana.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expect(bia.locator('#stage')).toHaveClass(/is-live/, { timeout: 15_000 });
  await expect(bia.locator('#stage-label')).toHaveText('Tela de Ana');
  await expect
    .poll(() => bia.locator('#stage-video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);

  await ana.getByRole('button', { name: 'Parar de compartilhar' }).click();
  await expect(bia.locator('#stage')).not.toHaveClass(/is-live/, { timeout: 15_000 });

  await ana.getByRole('button', { name: 'Sair' }).click();
  await expect(bia.locator('#people li')).toHaveCount(1);
});

test('switches language and theme', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Idioma').selectOption('es');
  await expect(page.locator('#home-title')).toHaveText('Salas privadas, sin registro');
  await page.getByLabel('Idioma').selectOption('en');
  await expect(page.locator('#home-title')).toHaveText('Private rooms, no sign-up');

  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const before = await theme();
  await page.locator('#theme').click();
  expect(await theme()).not.toBe(before);
  await page.reload();
  expect(await theme()).not.toBe(before);
  await expect(page.locator('#home-title')).toHaveText('Private rooms, no sign-up');
});

test('rejects a bad room code', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Seu apelido').fill('Ana');
  await page.getByLabel('Código ou link da sala').fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert').first()).toHaveText('Código de sala inválido.');
});

test('rejoins the room after the connection drops', async ({ browser }) => {
  const ana = await open(browser);
  await ana.goto('/');
  await ana.getByLabel('Seu apelido').fill('Ana');
  await ana.getByRole('button', { name: 'Criar sala' }).click();
  await ana.getByRole('button', { name: 'Compartilhar tela' }).click();

  // Proxy Bia's socket so the test can cut it.
  const bia = await open(browser);
  const cut: (() => Promise<void>)[] = [];
  await bia.routeWebSocket(/socket\.io/, (ws) => {
    const server = ws.connectToServer();
    cut.push(async () => {
      await server.close();
      await ws.close();
    });
  });
  await bia.goto(ana.url());
  await bia.getByLabel('Seu apelido').fill('Bia');
  await bia.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(bia.locator('#stage')).toHaveClass(/is-live/, { timeout: 15_000 });

  await cut[0]();
  await expect(ana.locator('#people li')).toHaveCount(1);

  // Back under a new id: presence, chat and the shared screen all come back.
  await expect(ana.locator('#people li')).toHaveCount(2, { timeout: 15_000 });
  await expect(bia.locator('#room-meta')).toContainText('2 de 10');
  await bia.getByLabel('Mensagem').fill('voltei');
  await bia.getByRole('button', { name: 'Enviar' }).click();
  await expect(ana.locator('#messages')).toContainText('voltei');
  await expect(bia.locator('#stage')).toHaveClass(/is-live/, { timeout: 15_000 });
});
