import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // STRONG oracle: asserts the actual activity data, not just that the UI drew.
  test('activity feed shows the recorded time for each book activity', async ({ page }) => {
    await page.goto('/');
    const book1Row = page.locator('.activity-list-item', { hasText: 'Book1' });
    await expect(book1Row).toContainText('2 minutes ago');
    const book2Row = page.locator('.activity-list-item', { hasText: 'Book2' });
    await expect(book2Row).toContainText('5 minutes ago');
  });

  // WEAK oracle: only confirms the section rendered.
  test('dashboard shows the recent activity section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
  });
});
