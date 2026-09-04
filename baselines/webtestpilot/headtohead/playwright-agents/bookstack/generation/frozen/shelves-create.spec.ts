// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Shelves', () => {
  test('Create a new shelf', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the shelves listing page
    await page.goto('/shelves');

    // Click the "New Shelf" link to go to the creation form
    await page.getByRole('link', { name: 'New Shelf' }).first().click();
    await expect(page).toHaveURL('/create-shelf');

    // Fill in the shelf name
    await page.fill('#name', 'Test Shelf Alpha');

    // Submit the form
    await page.getByRole('button', { name: 'Save Shelf' }).click();

    // Should redirect to the new shelf detail page
    await expect(page).toHaveURL(/\/shelves\//);

    // Page should display the new shelf name
    await expect(page.locator('h1')).toContainText('Test Shelf Alpha');

    // Success notification should confirm creation
    await expect(page.locator('.notification.pos')).toContainText('created');
  });
});
