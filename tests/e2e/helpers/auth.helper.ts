import { expect, Page } from '@playwright/test';

export function getAdminCredentials() {
  const email = process.env['PLAYWRIGHT_ADMIN_EMAIL']?.trim();
  const password = process.env['PLAYWRIGHT_ADMIN_PASSWORD']?.trim();

  if (!email || !password) {
    throw new Error(
      'Faltan credenciales E2E. Define PLAYWRIGHT_ADMIN_EMAIL y PLAYWRIGHT_ADMIN_PASSWORD antes de correr Playwright.'
    );
  }

  return { email, password };
}

export async function loginAsAdmin(page: Page) {
  const { email, password } = getAdminCredentials();

  await page.goto('/auth/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page.locator('.alert--error')).toHaveCount(0);
  await page.waitForURL('**/app/dashboard');
}
