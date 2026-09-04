// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test('6.2 View users list and verify admin user present', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the Settings area first
    await page.goto('/settings/features');
    await page.waitForLoadState('networkidle');

    // Click Users in the Settings sidebar
    await page.getByRole('link', { name: 'Users' }).click();
    await page.waitForLoadState('networkidle');

    // Verify URL is /settings/users
    await expect(page).toHaveURL(/\/settings\/users/);

    // Verify the page title
    await expect(page).toHaveTitle('Users | BookStack');

    // Verify Admin user entry is present with email
    const adminUserLink = page.locator('a[href*="/settings/users/"]').filter({ hasText: 'Admin' });
    await expect(adminUserLink).toBeVisible();
    await expect(page.getByText('admin@admin.com')).toBeVisible();

    // Verify Guest user entry is present with email
    const guestUserLink = page.locator('a[href*="/settings/users/"]').filter({ hasText: 'Guest' });
    await expect(guestUserLink).toBeVisible();
    await expect(page.getByText('guest@example.com')).toBeVisible();
  });
});
