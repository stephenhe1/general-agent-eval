// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Chapters', () => {
  test('3.2 Verify chapter appears in book', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a chapter per 3.1
    await page.goto('/books/book1/create-chapter');
    await page.fill('#name', 'Test Chapter Beta');
    await page.getByRole('button', { name: 'Save Chapter' }).click();
    await expect(page).toHaveURL(/\/books\/book1\/chapter\//);

    // Now navigate to the book detail page
    await page.goto('/books/book1');

    // The new chapter should appear as an entity-list-item with class chapter
    // Use .first() in case prior runs left chapters with the same name
    const chapterItem = page.locator('.entity-list-item.chapter', { hasText: 'Test Chapter Beta' }).first();
    await expect(chapterItem).toBeVisible();
  });
});
