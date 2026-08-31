import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const appDataDir = path.join(process.cwd(), '.e2e-data');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:3117',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: 'npx next dev --hostname 127.0.0.1 --port 3117',
    url: 'http://127.0.0.1:3117/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ADMIN_PASSWORD: 'e2e-admin-password',
      SESSION_SECRET: 'e2e-session-secret-at-least-32-characters',
      ENCRYPTION_KEY: 'e2e-encryption-key',
      APP_DATA_DIR: appDataDir,
      FORCE_HTTPS_COOKIE: 'false',
    },
  },
});
