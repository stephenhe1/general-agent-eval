// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Chapters', () => {
  test('3.5 Delete a chapter', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a chapter per 3.1 so we have something to delete
    await page.goto('/books/book1/create-chapter');
    await page.fill('#name', 'Test Chapter Delta');
    await page.getByRole('button', { name: 'Save Chapter' }).click();
    await expect(page).toHaveURL(/\/books\/book1\/chapter\//);

    // Capture the chapter URL slug from the redirect
    const chapterUrl = page.url();
    const deleteUrl = chapterUrl + '/delete';

    // Navigate to the delete confirmation page
    await page.goto(deleteUrl);

    // Confirmation page should warn about chapter and pages deletion
    await expect(page.getByText(/This will delete the chapter with the name/)).toBeVisible();

    // Click the Confirm button
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Should redirect to /books/book1
    await expect(page).toHaveURL('/books/book1');

    // Success notification
    await expect(page.locator('.notification.pos')).toContainText('Chapter successfully deleted');

    // The deleted chapter name no longer appears in the book's content list
    await expect(page.locator('.entity-list-item', { hasText: 'Test Chapter Delta' })).not.toBeVisible();
  });
});
