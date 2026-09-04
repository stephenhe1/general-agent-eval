// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Shelves', () => {
  test('Delete a shelf', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a shelf to delete
    await page.goto('/create-shelf');
    await page.fill('#name', 'Shelf Delete Me');
    await page.getByRole('button', { name: 'Save Shelf' }).click();

    // Wait for redirect to the shelf detail page
    await expect(page).toHaveURL(/\/shelves\//);

    // Capture the exact shelf URL (including any de-dup slug suffix) so we
    // can target its delete page and verify it's gone afterwards.
    const shelfUrl = page.url();
    const shelfSlug = shelfUrl.split('/shelves/')[1];
    await page.goto('/shelves/' + shelfSlug + '/delete');

    // Click the Confirm button on the delete confirmation page
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Should redirect back to the shelves listing
    await expect(page).toHaveURL('/shelves');

    // Success notification should confirm deletion
    await expect(page.locator('.notification.pos')).toContainText('deleted');

    // The specific shelf link (by its exact slug) should no longer exist in the grid
    await expect(page.locator(`a[href$="/shelves/${shelfSlug}"]`)).not.toBeVisible();
  });
});
