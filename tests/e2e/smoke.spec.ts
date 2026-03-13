import { test, expect } from '@playwright/test';

test('login page carga', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
});
