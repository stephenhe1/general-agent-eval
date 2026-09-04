// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test('6.3 Access App Settings (Customization) page and verify fields', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the Settings area first
    await page.goto('/settings/features');
    await page.waitForLoadState('networkidle');

    // Click Customization in the Settings sidebar
    await page.getByRole('link', { name: 'Customization' }).click();
    await page.waitForLoadState('networkidle');

    // Verify URL is /settings/customization
    await expect(page).toHaveURL(/\/settings\/customization/);

    // Verify Application Name field exists and has value "BookStack"
    await expect(page.locator('#setting-app-name')).toBeVisible();
    await expect(page.locator('#setting-app-name')).toHaveValue('BookStack');

    // Verify Default Page Editor select dropdown is present
    await expect(page.locator('#setting-app-editor')).toBeVisible();

    // Verify color pickers are present
    await expect(page.locator('#setting-app-color')).toBeVisible();
    await expect(page.locator('#setting-link-color')).toBeVisible();
    await expect(page.locator('#setting-bookshelf-color')).toBeVisible();
    await expect(page.locator('#setting-book-color')).toBeVisible();
    await expect(page.locator('#setting-chapter-color')).toBeVisible();
  });
});
