import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 90_000,
  // Las pruebas comparten cuentas y la app deja una sola sesión por persona.
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
    // Permite usar un Chromium ya instalado (por ejemplo en CI): PW_CHROMIUM_PATH=/ruta/a/chrome
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: [
    {
      command: 'pnpm --filter @laofi/server start',
      url: 'http://localhost:2568/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    { command: 'pnpm --filter @laofi/client dev', port: 5173, reuseExistingServer: true, timeout: 60_000 },
  ],
});
