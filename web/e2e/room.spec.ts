import { expect, test, type Browser } from '@playwright/test';
import { io } from 'socket.io-client';

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
  // The home page tells how full the room is before joining.
  await expect(bia.locator('#room-status')).toHaveText('1 de 10 na sala');
  await bia.getByLabel('Seu apelido').fill('Bia');
  await bia.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(bia.locator('#people li')).toHaveCount(2);
  await expect(ana.locator('#people li')).toHaveCount(2);
  await expect(ana.locator('#room-meta')).toContainText('2 de 10');

  await bia.getByLabel('Mensagem').fill('oi Ana, olha https://example.com/x?y=1');
  await bia.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(ana.locator('#messages')).toContainText('oi Ana');
  await expect(ana.locator('#messages a[href="https://example.com/x?y=1"]')).toHaveAttribute('target', '_blank');

  // 1x1 PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await bia.locator('#file').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png });
  await expect(ana.locator('#messages img.msg-media')).toHaveJSProperty('naturalWidth', 1);
  await ana.locator('#messages img.msg-media').click();
  await expect(ana.locator('#lightbox')).toHaveJSProperty('open', true);
  await ana.locator('#lightbox').click();
  await expect(ana.locator('#lightbox')).toHaveJSProperty('open', false);

  // Pasting an image into the message box sends it too.
  await bia.getByLabel('Mensagem').evaluate((input, b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'shot.png', { type: 'image/png' }));
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, png.toString('base64'));
  await expect(ana.locator('#messages img.msg-media')).toHaveCount(2);

  // Discarding sends nothing; send confirms the recording.
  await bia.getByRole('button', { name: 'Gravar áudio' }).click();
  await bia.getByRole('button', { name: 'Descartar áudio' }).click();
  await bia.getByRole('button', { name: 'Gravar áudio' }).click();
  await expect(bia.getByRole('timer')).toBeVisible();
  await bia.waitForTimeout(1000);
  await bia.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(ana.locator('#messages .player')).toHaveCount(1);
  await expect(ana.locator('#messages .player .time')).not.toHaveText('0:00');

  await ana.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expect(bia.locator('#stage')).toHaveClass(/is-live/, { timeout: 15_000 });
  await expect(bia.locator('#stage-label')).toHaveText('Tela de Ana');
  // The sharer gets a small preview, not the full stage: that's the infinite mirror.
  await expect(ana.locator('#stage-video')).toBeHidden();
  await expect(ana.locator('.stage-self')).toBeVisible();
  await expect.poll(() => ana.locator('#self-preview').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await expect
    .poll(() => bia.locator('#stage-video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);

  await ana.getByRole('button', { name: 'Parar de compartilhar' }).click();
  await expect(bia.locator('#stage')).not.toHaveClass(/is-live/, { timeout: 15_000 });

  await ana.getByRole('button', { name: 'Sair' }).click();
  await expect(bia.locator('#people li')).toHaveCount(1);
});

test('settings: language, theme and noise suppression', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.locator('#home-title')).toHaveText('Miren juntos. Hablen en vivo.');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('#home-title')).toHaveText('Watch together. Talk live.');

  await page.getByRole('button', { name: 'Light' }).click();
  await expect(page.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.getByRole('button', { name: 'Dark' }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

  const noise = page.getByRole('switch', { name: /Noise suppression/ });
  await expect(noise).toBeChecked();
  await noise.uncheck();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('#settings')).toBeHidden();

  // All three survive a reload.
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await expect(page.locator('#home-title')).toHaveText('Watch together. Talk live.');
  await expect(page.getByRole('switch', { name: /Noise suppression/, includeHidden: true })).not.toBeChecked();
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
  await bia.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(ana.locator('#messages')).toContainText('voltei');
  await expect(bia.locator('#stage')).toHaveClass(/is-live/, { timeout: 15_000 });
});

test('mutes, unmutes and turns the mic on after joining without one', async ({ browser }) => {
  const ana = await open(browser);
  await ana.goto('/');
  await ana.getByLabel('Seu apelido').fill('Ana');
  await ana.getByRole('button', { name: 'Criar sala' }).click();

  await ana.getByRole('button', { name: 'Silenciar' }).click();
  await expect(ana.locator('#people li').first()).toContainText('mudo');
  await ana.getByRole('button', { name: 'Ativar microfone' }).click();
  await expect(ana.locator('#people li').first()).not.toContainText('mudo');

  // Bia denies the mic on join, then turns it on from the room.
  const bia = await open(browser);
  await bia.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let denied = false;
    navigator.mediaDevices.getUserMedia = (c) => {
      if (denied) return real(c);
      denied = true;
      return Promise.reject(new DOMException('denied', 'NotAllowedError'));
    };
  });
  await bia.goto(ana.url());
  await bia.getByLabel('Seu apelido').fill('Bia');
  await bia.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(bia.locator('#people li').first()).toContainText('mudo');
  await expect(ana.locator('#people li')).toHaveCount(2);
  // Joined without a mic counts as muted, for everyone.
  await expect(ana.locator('#people li').nth(1)).toContainText('mudo');

  await bia.getByRole('button', { name: 'Ativar microfone' }).click();
  await expect(bia.getByRole('button', { name: 'Silenciar' })).toBeVisible();
  await expect(ana.locator('#people li').nth(1)).not.toContainText('mudo');

  // M toggles the mic, and the others see it.
  await bia.locator('body').press('m');
  await expect(ana.locator('#people li').nth(1)).toContainText('mudo');
  await bia.locator('body').press('m');
  await expect(ana.locator('#people li').nth(1)).not.toContainText('mudo');
  // Ana now plays an audio stream from Bia.
  const audioTracks = () =>
    ana.locator('#audio audio').evaluateAll((els) =>
      els.map((a) => ((a as HTMLAudioElement).srcObject as MediaStream).getAudioTracks().length),
    );
  await expect.poll(audioTracks).toContain(1);
});

test('cameras, reactions, noise suppression and announcements', async ({ browser }) => {
  const ana = await open(browser);
  await ana.goto('/');
  await ana.getByLabel('Seu apelido').fill('Ana');
  await ana.getByRole('button', { name: 'Criar sala' }).click();
  const bia = await open(browser);
  await bia.goto(ana.url());
  await bia.getByLabel('Seu apelido').fill('Bia');
  await bia.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(ana.locator('#announcer')).toHaveText('Bia entrou na sala');

  // A camera is a tile, not a shared screen.
  await ana.getByRole('button', { name: 'Ligar câmera' }).click();
  await expect(bia.locator('.cam figcaption')).toHaveText('Ana');
  // Visible on its own, with nobody sharing a screen (regression: it used to be display:none).
  await expect(bia.locator('.cam video')).toBeVisible();
  await expect(ana.locator('.cam video')).toBeVisible();
  await expect
    .poll(() => bia.locator('.cam video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
  await expect(bia.locator('#stage')).not.toHaveClass(/is-live/);
  await ana.getByRole('button', { name: 'Desligar câmera' }).click();
  await expect(bia.locator('.cam')).toHaveCount(0);

  await bia.getByRole('button', { name: 'Reagir' }).click();
  await bia.getByRole('button', { name: '🎉' }).click();
  await expect(ana.locator('.reaction')).toContainText('🎉');
  await expect(ana.locator('.reaction')).toContainText('Bia');

  // Noise suppression lives in settings and applies to the live mic.
  await ana.getByRole('button', { name: 'Configurações' }).click();
  await ana.getByRole('switch', { name: /Redução de ruído/ }).uncheck();
  await ana.getByRole('button', { name: 'Fechar' }).click();
  await expect.poll(() => ana.evaluate(() => localStorage.getItem('noise'))).toBe('off');

  await bia.getByRole('button', { name: 'Sair' }).click();
  await expect(ana.locator('#announcer')).toHaveText('Bia saiu da sala');
});

test('a full room says so on the home page', async ({ page }) => {
  const roomId = `full-${Date.now()}`;
  const server = process.env.SERVER_URL ?? 'http://localhost:3000';
  const peers = Array.from({ length: 10 }, () => io(server, { transports: ['websocket'], forceNew: true }));
  try {
    for (const [i, s] of peers.entries()) await s.emitWithAck('join', { roomId, name: `p${i}` });
    await page.goto(`/#${roomId}`);
    await expect(page.locator('#room-status')).toHaveText('Essa sala já está cheia (10 pessoas).');
    await expect(page.locator('#join-btn')).toBeDisabled();
  } finally {
    peers.forEach((s) => s.disconnect());
  }
});

test('a voice note stops by itself at 5:00', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByLabel('Seu apelido').fill('Ana');
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await page.getByRole('button', { name: 'Gravar áudio' }).click();
  await expect(page.getByRole('timer')).toHaveText('0:00 / 5:00');
  await page.clock.fastForward('04:59');
  await expect(page.locator('#chat-form')).toHaveClass(/is-recording/);
  await page.clock.fastForward('00:02');
  await expect(page.locator('#chat-form')).not.toHaveClass(/is-recording/);
});
