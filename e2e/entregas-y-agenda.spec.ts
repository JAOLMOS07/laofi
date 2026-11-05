import { type Browser, type Page, expect, test } from '@playwright/test';

/**
 * Fase 2 con dos personas: Laura (Axis) registra una entrega, Daniela (QA) la recibe en el muelle,
 * la devuelve y Laura ve el motivo. Después Andrés usa la agenda: aviso y sala. Jhoger simula una entrega como admin.
 */
async function login(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/');
  await page.fill('#email', `${name}@laofi.local`);
  await page.fill('#password', 'laofi123');
  await page.click('button:has-text("Entrar")');
  await expect(page.getByTestId('current-floor')).toBeAttached({ timeout: 15_000 });
  return page;
}

test('una entrega viaja a QA y vuelve con su bug', async ({ browser }) => {
  const laura = await login(browser, 'laura');
  const daniela = await login(browser, 'daniela');
  await expect(daniela.getByTestId('current-floor')).toHaveText('qa');

  await laura.getByTestId('dock-deliveries').click();
  await laura.getByTestId('delivery-new').click();
  await laura.getByLabel('ID del work item').fill('HU-1302');
  await laura.getByLabel('Título').fill('Recuperar contraseña');
  await laura.getByTestId('delivery-send').click();
  await expect(laura.getByTestId('delivery').filter({ hasText: 'HU-1302' })).toBeVisible();

  const toast = daniela.getByTestId('toast').filter({ hasText: 'Llegó una caja de Axis' });
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Ver' }).click();
  const card = daniela.getByTestId('delivery').filter({ hasText: 'HU-1302' });
  await card.getByRole('button', { name: 'Tomar en pruebas' }).click();
  await card.getByRole('button', { name: 'Devolver' }).click();
  await card.getByLabel('Motivo de la devolución').fill('El correo no llega');
  await card.getByRole('button', { name: 'Devolver' }).click();

  await expect(laura.getByTestId('toast').filter({ hasText: 'QA devolvió HU-1302' })).toContainText(
    'El correo no llega',
  );
  await expect(laura.getByTestId('delivery').filter({ hasText: 'HU-1302' })).toContainText(
    'El correo no llega',
  );
});

test('lo aprobado se despliega desde la célula', async ({ browser }) => {
  const camila = await login(browser, 'camila');
  const felipe = await login(browser, 'felipe');

  await camila.getByTestId('dock-deliveries').click();
  await camila.getByTestId('delivery-new').click();
  await camila.getByLabel('ID del work item').fill('HU-2001');
  await camila.getByLabel('Título').fill('Exportar facturas');
  await camila.getByTestId('delivery-send').click();

  await felipe.getByTestId('dock-deliveries').click();
  const card = felipe.getByTestId('delivery').filter({ hasText: 'HU-2001' });
  await card.getByRole('button', { name: 'Tomar en pruebas' }).click();
  await card.getByRole('button', { name: 'Aprobar' }).click();
  await expect(card.getByRole('button', { name: 'Desplegar' })).toHaveCount(0);

  const mine = camila.getByTestId('delivery').filter({ hasText: 'HU-2001' });
  await mine.getByRole('button', { name: 'Desplegar' }).click();
  await expect(camila.getByTestId('toast').filter({ hasText: 'HU-2001 desplegada' })).toBeVisible();
  await expect(felipe.getByTestId('toast').filter({ hasText: 'HU-2001 desplegada' })).toBeVisible();
});

test('la oficina muestra en qué está y lleva al work item', async ({ browser }) => {
  const url = 'https://dev.azure.com/empresa/proyecto/_workitems/edit/1302';
  const andres = await login(browser, 'andres');
  const laura = await login(browser, 'laura');
  await expect(laura.getByTestId('current-floor')).toHaveText('axis');

  await andres.getByTestId('work-open').click();
  await andres.getByLabel('Link del work item').fill(url);
  await expect(andres.getByLabel('HU o work item')).toHaveValue('1302');
  await andres.getByLabel('De qué se trata').fill('Cambiar el correo');
  await andres.getByTestId('work-save').click();
  await expect(andres.getByTestId('work-open')).toHaveText('Desarrollando 1302');

  const id = await andres.evaluate(
    () => (window as unknown as { __laofi: { me: () => { userId: string } } }).__laofi.me().userId,
  );
  const card = laura.getByTestId(`work-${id}`);
  await expect(card).toHaveText('Desarrollando 1302');
  await expect(card).toHaveAttribute('href', url);

  await andres.getByTestId('work-open').click();
  await andres.getByTestId('work-deliver').click();
  await expect(card).toHaveCount(0);
  await andres.getByTestId('dock-deliveries').click();
  await expect(andres.getByTestId('delivery').filter({ hasText: 'Cambiar el correo' })).toBeVisible();
});

test('el aviso de reunión lleva a la sala', async ({ browser }) => {
  const andres = await login(browser, 'andres');
  await andres.getByTestId('dock-agenda').click();
  await andres.getByTestId('meeting-demo').click();
  const toast = andres.getByTestId('toast').filter({ hasText: 'empieza: ¿vamos?' });
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await toast.getByRole('button', { name: 'Vamos' }).click();
  await expect(andres.getByTestId('room-card')).toContainText('Reunión de prueba', { timeout: 30_000 });
});

test('las integraciones pendientes se ven marcadas', async ({ browser }) => {
  const jhoger = await login(browser, 'jhoger');
  await jhoger.getByTestId('dock-integrations').click();
  await expect(jhoger.getByTestId('integration-ti').first()).toContainText('Pendiente de TI');
  await jhoger.getByTestId('demo-simulate').click();
  await jhoger.getByTestId('dock-deliveries').click();
  await expect(jhoger.getByTestId('delivery').filter({ hasText: 'Demo' }).first()).toBeVisible();
});
