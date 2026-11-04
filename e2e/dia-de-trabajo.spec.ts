import { type Browser, type Page, expect, test } from '@playwright/test';

/**
 * Un día de trabajo con dos personas de células distintas:
 * Isabella (Atlas) visita el piso de Axis, toca la puerta de Jhoger, él le abre,
 * le deja un post-it y Jhoger lo lee. Después Jhoger entra a la Sala libre y pega el link de una reunión.
 */
async function login(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Las fuentes vienen de Google Fonts: sin red, la app usa las del sistema.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/');
  await page.fill('#email', `${name}@laofi.local`);
  await page.fill('#password', 'laofi123');
  await page.click('button:has-text("Entrar")');
  await expect(page.getByTestId('current-floor')).toBeAttached({ timeout: 15_000 });
  return page;
}

const me = (p: Page) =>
  p.evaluate(() =>
    (window as unknown as { __laofi: { me: () => { userId: string; x: number; y: number } } }).__laofi.me(),
  );

test('un día en La Ofi: visita, toc toc, post-it y sala libre', async ({ browser }) => {
  const jhoger = await login(browser, 'jhoger');
  await expect(jhoger.getByTestId('current-floor')).toHaveText('axis');
  const isabella = await login(browser, 'isabella');
  await expect(isabella.getByTestId('current-floor')).toHaveText('atlas');
  const jhogerId = (await me(jhoger)).userId;

  // Directorio → ficha de Jhoger → Toc toc: cambia de piso, camina a su puerta y toca.
  await isabella.getByTestId('dock-directory').click();
  await isabella.locator(`[data-testid=dir-${jhogerId}] .pinfo`).click();
  await isabella.getByTestId('knock').click();
  await expect(isabella.getByTestId('current-floor')).toHaveText('axis', { timeout: 15_000 });
  await expect(isabella.getByTestId('visitor-badge')).toBeVisible();

  const toast = jhoger.getByTestId('toast').filter({ hasText: 'Isabella toca tu puerta' });
  await expect(toast).toBeVisible({ timeout: 20_000 });
  await toast.getByRole('button', { name: 'Pasa' }).click();
  await expect(isabella.getByTestId('toast').filter({ hasText: '“Pasa”' })).toBeVisible();

  // Post-it en su escritorio.
  await isabella.getByTestId('dock-directory').click();
  await isabella.locator(`[data-testid=dir-${jhogerId}] .pinfo`).click();
  await isabella.getByTestId('note-text').fill('Te dejé la HU-1302 lista para QA.');
  await isabella.getByTestId('note-send').click();
  await expect(jhoger.getByTestId('toast').filter({ hasText: 'Post-it de Isabella' })).toBeVisible();
  await jhoger.getByTestId('dock-notes').click();
  await expect(jhoger.getByTestId('note').filter({ hasText: 'HU-1302' })).toBeVisible();

  // La visita ve a Jhoger en su piso con etiqueta.
  await expect(isabella.getByTestId(`tag-${jhogerId}`)).toBeAttached();

  // Sala libre del Lobby: cualquiera pega el link de la reunión planeada.
  await jhoger.keyboard.press('Escape');
  await jhoger.getByTestId('dock-elevator').click();
  await jhoger.getByTestId('floor-lobby').getByRole('button', { name: 'Ir' }).click();
  await expect(jhoger.getByTestId('current-floor')).toHaveText('lobby', { timeout: 15_000 });
  await jhoger.evaluate(() =>
    (window as unknown as { __laofi: { move: (x: number, y: number) => void } }).__laofi.move(24, 18),
  );
  const card = jhoger.getByTestId('room-card');
  await expect(card).toContainText('Sala libre', { timeout: 15_000 });
  await card.getByTestId('paste-link').click();
  await card.getByLabel('Link de Teams').fill('https://evil.example.com/x');
  await card.getByRole('button', { name: 'Guardar' }).click();
  await expect(card).toContainText('link de Teams');
  await card.getByLabel('Link de Teams').fill('https://teams.microsoft.com/l/meetup-join/demo-123');
  await card.getByRole('button', { name: 'Guardar' }).click();
  await expect(card.getByTestId('open-teams')).toBeVisible({ timeout: 5_000 });
});
