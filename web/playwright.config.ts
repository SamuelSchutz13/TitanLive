import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'pt-BR',
    permissions: ['microphone'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  webServer: [
    { command: 'npm --prefix ../server run start', url: 'http://localhost:3000/health', reuseExistingServer: true },
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
});
