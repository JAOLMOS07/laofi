import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Las pruebas de integración usan la misma base de desarrollo que `.env` (se borra y se vuelve a sembrar).
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  test: { testTimeout: 20_000, hookTimeout: 60_000, fileParallelism: false },
});
