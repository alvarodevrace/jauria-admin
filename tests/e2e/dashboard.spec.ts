import { test, expect } from '@playwright/test';
import { getAdminCredentials, loginAsAdmin } from './helpers/auth.helper';

test.beforeEach(() => {
  getAdminCredentials();
});

test('dashboard carga sin errores', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.locator('.page-header__title')).toHaveText('Dashboard');
  expect(errors).toHaveLength(0);
});

test('KPIs son visibles', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.locator('.dashboard-kpis .stat-card').first()).toBeVisible();
});

test('coach no ve el bloque técnico de servicios', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.locator('.data-table-wrapper__title').filter({ hasText: 'Estado de Servicios' })).toHaveCount(0);
  await expect(page.locator('.data-table-wrapper__title').filter({ hasText: 'Alertas Operativas' })).toBeVisible();
});
