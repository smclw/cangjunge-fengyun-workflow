import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:43173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm.cmd run server -- --port 43173 --data-dir tests/fixtures/e2e-data',
    url: 'http://127.0.0.1:43173/api/health',
    reuseExistingServer: false,
    timeout: 30_000
  },
  globalSetup: './tests/e2e/global-setup.ts',
  projects: [{ name: 'desktop-chrome', use: { channel: 'chrome' } }]
});
