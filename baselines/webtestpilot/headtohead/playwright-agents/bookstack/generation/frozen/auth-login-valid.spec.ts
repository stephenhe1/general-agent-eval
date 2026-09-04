// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('1.1 Login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('BookStack');
    await expect(page.getByLabel('Profile Menu').getByText('Admin')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Shelves', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Books', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });
});
