// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Chapters', () => {
  test('3.1 Create a chapter inside a book', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the create-chapter page for Book1
    await page.goto('/books/book1/create-chapter');

    // Fill in the chapter name
    await page.fill('#name', 'Test Chapter Alpha');

    // Click Save Chapter
    await page.getByRole('button', { name: 'Save Chapter' }).click();

    // Should redirect to /books/book1/chapter/<slug>
    await expect(page).toHaveURL(/\/books\/book1\/chapter\//);

    // Page title should reflect the new chapter name
    await expect(page).toHaveTitle('Test Chapter Alpha | BookStack');

    // Success notification
    await expect(page.locator('.notification.pos')).toContainText('Chapter successfully created');

    // Chapter detail page shows no pages message
    await expect(page.getByText('No pages are currently in this chapter.')).toBeVisible();
  });
});
