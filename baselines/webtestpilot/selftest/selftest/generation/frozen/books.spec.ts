import { test, expect } from '@playwright/test';

test.describe('Books', () => {
  // Revisits /books, so it exercises flows that depend on navigation history.
  test('book grid keeps its descriptions across repeat visits', async ({ page }) => {
    await page.goto('/');
    await page.goto('/books');
    await expect(page.locator('.grid-card', { hasText: 'New Book' })).toContainText(
      'Original Description',
    );
    await page.goto('/');
    await page.goto('/books');
    await expect(page.locator('.grid-card', { hasText: 'New Book' })).toContainText(
      'Original Description',
    );
  });

  test('creating a book adds exactly one card with the submitted data', async ({ page }) => {
    await page.goto('/books');
    const before = await page.locator('.grid-card').count();

    await page.goto('/books/new');
    await page.getByLabel('Title').fill('Probe Handbook');
    await page.getByLabel('Description').fill('Written by the probe suite');
    await page.getByRole('button', { name: 'Save Book' }).click();

    await expect(page.locator('.grid-card')).toHaveCount(before + 1);
    const card = page.locator('.grid-card', { hasText: 'Probe Handbook' });
    await expect(card).toContainText('Written by the probe suite');
  });
});
