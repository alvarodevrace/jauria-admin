import path from 'node:path';
import { test, expect } from '@playwright/test';
import { getAdminCredentials, loginAsAdmin } from './helpers/auth.helper';

test.beforeEach(() => {
  getAdminCredentials();
});

test('mi cuenta guarda bio y avatar', async ({ page }) => {
  const bio = `Bio E2E ${Date.now()}`;
  const avatarFixture = path.resolve(__dirname, 'fixtures/avatar-test.svg');

  await loginAsAdmin(page);
  await page.click('.sidebar__profile-entry');

  await expect(page.locator('.page-header__title')).toHaveText('Mi Cuenta');

  const bioField = page.locator('textarea[name="bio"]');
  await bioField.fill(bio);

  await page.locator('input[type="file"]').setInputFiles(avatarFixture);
  await expect(page.locator('.profile-card__avatar-image')).toBeVisible();

  await page.click('button[type="submit"]');

  await expect(page.locator('.toast__message').filter({ hasText: 'Perfil actualizado' })).toBeVisible();
  await expect(page.locator('.alert--success')).toContainText('Perfil actualizado');
  await expect(page.locator('.sidebar__user-avatar--image')).toBeVisible();

  await page.reload();

  await expect(page.locator('textarea[name="bio"]')).toHaveValue(bio);
  await expect(page.locator('.profile-card__avatar-image')).toBeVisible();
  await expect(page.locator('.sidebar__user-avatar--image')).toBeVisible();
});
