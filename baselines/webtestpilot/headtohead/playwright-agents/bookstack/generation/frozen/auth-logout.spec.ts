// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('1.3 Logout', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Submit the logout form directly (it is present in the DOM inside the user dropdown)
    await page.evaluate(() => {
      const form = document.querySelector('form[action$="/logout"]') as HTMLFormElement | null;
      if (form) form.submit();
    });

    await expect(page).toHaveURL('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Shelves', exact: true })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Books', exact: true })).not.toBeVisible();
  });
});
