import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Chapters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('chapter detail page shows pages and actions', async ({ page }) => {
    await page.goto('/books/book1/chapter/chapter-2');
    await expect(page).toHaveTitle(/Chapter 2/);
    // Should have page links
    await expect(page.locator('a[href*="/books/book1/page/"]').first()).toBeVisible();
    // Action links
    await expect(page.locator('a[href*="/chapter-2/edit"]')).toBeVisible();
    await expect(page.locator('a[href*="/chapter-2/delete"]')).toBeVisible();
  });

  test('create chapter - appears in book detail', async ({ page }) => {
    const chapterName = `Test Chapter ${Date.now()}`;

    await page.goto('/books/book1/create-chapter');
    await expect(page).toHaveTitle(/Create New Chapter/);

    await page.fill('[name="name"]', chapterName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should redirect to chapter or book
    await expect(page).toHaveURL(/\/books\/book1\//);

    // Verify chapter name appears
    await expect(page.getByText(chapterName).first()).toBeVisible();

    // Also verify in book detail
    await page.goto('/books/book1');
    await expect(page.getByText(chapterName).first()).toBeVisible();
  });

  test('edit chapter - name update reflected', async ({ page }) => {
    const origName = `Chapter Edit Test ${Date.now()}`;
    const updatedName = `Updated Chapter ${Date.now()}`;

    await page.goto('/books/book1/create-chapter');
    await page.fill('[name="name"]', origName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const chapterUrl = page.url();
    await page.goto(chapterUrl + '/edit');
    await page.fill('[name="name"]', updatedName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Use h1 to get the main page heading (avoids strict mode violation with entity list items)
    await expect(page.locator('h1').first()).toContainText(updatedName);
  });

  test('delete chapter - removed from book', async ({ page }) => {
    const name = `Chapter To Delete ${Date.now()}`;

    await page.goto('/books/book1/create-chapter');
    await page.fill('[name="name"]', name);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const chapterUrl = page.url();
    await page.goto(chapterUrl + '/delete');

    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // After deletion should land elsewhere; verify chapter not in book
    await page.goto('/books/book1');
    await expect(page.getByText(name)).not.toBeVisible();
  });
});
