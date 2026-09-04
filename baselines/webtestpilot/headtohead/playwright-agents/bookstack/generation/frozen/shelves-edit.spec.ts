// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Shelves', () => {
  test('Edit shelf name', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a shelf to edit
    await page.goto('/create-shelf');
    await page.fill('#name', 'Shelf Edit Source');
    await page.getByRole('button', { name: 'Save Shelf' }).click();

    // Wait for redirect to the shelf detail page
    await expect(page).toHaveURL(/\/shelves\//);

    // Capture the shelf URL and navigate to its edit page
    const shelfUrl = page.url();
    const shelfSlug = shelfUrl.split('/shelves/')[1];
    await page.goto('/shelves/' + shelfSlug + '/edit');

    // Clear the name field and type the new name
    await page.fill('#name', '');
    await page.fill('#name', 'Shelf Edit Renamed');

    // Save the changes
    await page.getByRole('button', { name: 'Save Shelf' }).click();

    // Should remain on the shelf detail page with the updated name
    await expect(page.locator('h1')).toContainText('Shelf Edit Renamed');

    // Success notification should confirm update
    await expect(page.locator('.notification.pos')).toContainText('updated');
  });
});
