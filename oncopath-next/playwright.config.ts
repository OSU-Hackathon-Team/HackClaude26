import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'NEXT_PUBLIC_E2E_DISABLE_CLERK=1 npm run dev -- --port 3100',
    url: 'http://localhost:3100/viewer',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
