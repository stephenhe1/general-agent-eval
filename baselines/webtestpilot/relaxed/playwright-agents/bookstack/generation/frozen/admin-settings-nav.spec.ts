// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test('6.1 Navigate to the Settings area', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Click Settings in the top navigation bar
    await page.getByRole('link', { name: 'Settings' }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify we land on the Features & Security page
    await expect(page).toHaveURL(/\/settings\/features/);

    // Verify Settings sidebar links are present
    await expect(page.getByRole('link', { name: 'Maintenance' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Roles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Webhooks' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Features & Security' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Customization' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registration' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sorting' })).toBeVisible();
  });
});
