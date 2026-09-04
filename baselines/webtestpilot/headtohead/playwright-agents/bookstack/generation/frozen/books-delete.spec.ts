// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Books', () => {
  test('Delete a book', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a new book to delete
    await page.goto('/create-book');
    await page.fill('#name', 'Delete Me Book');
    await page.getByRole('button', { name: 'Save Book' }).click();

    // Wait for redirect to the new book detail page
    await expect(page).toHaveURL(/\/books\//);

    // Capture the current book URL and navigate to its delete confirmation page
    const bookUrl = page.url();
    await page.goto(bookUrl + '/delete');

    // Click the Confirm button on the deletion confirmation page
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Should redirect to the books listing
    await expect(page).toHaveURL('/books');

    // Success notification should confirm deletion
    await expect(page.locator('.notification.pos')).toContainText('deleted');

    // The deleted book name should no longer appear in the list
    await expect(page.getByText('Delete Me Book')).not.toBeVisible();
  });
});
