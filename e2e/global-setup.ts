import { execSync } from 'node:child_process';

/** Antes de la e2e se vuelve a sembrar la base de desarrollo (se borra todo y se cargan los datos de ejemplo). */
export default function globalSetup(): void {
  execSync('pnpm --filter @laofi/server db:seed', { stdio: 'inherit' });
}
