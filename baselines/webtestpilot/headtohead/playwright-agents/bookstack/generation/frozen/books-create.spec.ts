// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Books', () => {
  test('Create a new book', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the create book form
    await page.goto('/create-book');

    // Fill in the book name
    await page.fill('#name', 'Test Book Alpha');

    // Submit the form
    await page.getByRole('button', { name: 'Save Book' }).click();

    // Should redirect to the new book detail page
    await expect(page).toHaveURL(/\/books\//);

    // Page title should reflect the new book name
    await expect(page).toHaveTitle(/Test Book Alpha/);

    // Success notification should confirm creation
    await expect(page.locator('.notification.pos')).toContainText('created');
  });
});
