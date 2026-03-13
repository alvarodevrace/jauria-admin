import { test, expect } from '@playwright/test';
import { getAdminCredentials, loginAsAdmin } from './helpers/auth.helper';

test('login correcto lleva al dashboard', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/app\/dashboard/);
});

test('login incorrecto muestra error', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[name="email"]', 'wrong@email.com');
  await page.fill('[name="password"]', 'wrongpassword');
  await page.click('[type="submit"]');
  await expect(page.locator('[class*="error"], [class*="alert"], [role="alert"]')).toBeVisible();
});

test('ruta protegida sin auth redirige a login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
});

test('logout cierra sesión', async ({ page }) => {
  getAdminCredentials();
  await loginAsAdmin(page);
  await page.click('.sidebar__logout');
  await expect(page).toHaveURL(/login/);
});
