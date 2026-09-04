// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Books', () => {
  test('Edit book name', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a new book to edit
    await page.goto('/create-book');
    await page.fill('#name', 'Edit Source Book');
    await page.getByRole('button', { name: 'Save Book' }).click();

    // Wait for redirect to the new book detail page
    await expect(page).toHaveURL(/\/books\//);

    // Click the Edit link in the Actions sidebar
    await page.getByRole('link', { name: 'Edit', exact: true }).first().click();

    // Clear the name field and type the new name
    await page.locator('#name').clear();
    await page.fill('#name', 'Edit Renamed Book');

    // Save the changes
    await page.getByRole('button', { name: 'Save Book' }).click();

    // Page title should reflect the renamed book
    await expect(page).toHaveTitle(/Edit Renamed Book/);

    // Success notification should confirm the update
    await expect(page.locator('.notification.pos')).toContainText('updated');
  });
});
