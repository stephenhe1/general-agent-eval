import { test, expect } from '@playwright/test';

// Visits the book detail page but only asserts the title, never the page list.
test('book detail page shows the book title', async ({ page }) => {
  await page.goto('/books/book2');
  await expect(page.locator('h1.break-text')).toHaveText('Book2');
});
