import { test, expect } from '@playwright/test';
import { login, uid } from './helpers';

test.describe('Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('view page shows its content', async ({ page }) => {
    await page.goto('/books/book1/page/page-1');
    await expect(page).toHaveTitle(/Page 1/);
    await expect(page.getByRole('heading', { name: 'Page 1', level: 1 })).toBeVisible();
  });

  test('recently updated pages listing shows pages', async ({ page }) => {
    await page.goto('/pages/recently-updated');
    await expect(page).toHaveTitle(/Recently Updated/);
    await expect(page.getByRole('heading', { name: /Recently Updated/i })).toBeVisible();
    // Should have page links in the listing
    const links = page.locator('.entity-list-item').first();
    await expect(links).toBeVisible();
  });

  test('create page - new page appears in book', async ({ page }) => {
    await page.goto('/books/book2/create-page');
    await expect(page).toHaveTitle(/Edit Page Draft/);
    const pageName = uid('Page');
    await page.locator('#name').fill(pageName);
    await page.getByRole('button', { name: 'Save Page' }).click();
    // After save should be on the page view
    await page.waitForURL(/\/books\/book2\/page\//);
    await expect(page.getByRole('heading', { name: pageName, level: 1 })).toBeVisible();
    // Verify page appears in book listing
    await page.goto('/books/book2');
    // Use heading locator to avoid strict mode issues with multiple matching elements
    await expect(page.getByRole('heading', { name: pageName }).first()).toBeVisible();
  });

  test('page revision history shows heading', async ({ page }) => {
    await page.goto('/books/book1/page/page-1/revisions');
    await expect(page).toHaveTitle(/Revision/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('page move page loads with correct heading', async ({ page }) => {
    await page.goto('/books/book1/page/page-1/move');
    await expect(page.getByRole('heading', { name: 'Move Page', level: 1 })).toBeVisible();
  });

  test('page permissions page loads', async ({ page }) => {
    await page.goto('/books/book1/page/page-1/permissions');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('delete page - page removed from book', async ({ page }) => {
    // Create a page to delete
    await page.goto('/books/book2/create-page');
    const pageName = uid('DelPage');
    await page.locator('#name').fill(pageName);
    await page.getByRole('button', { name: 'Save Page' }).click();
    await page.waitForURL(/\/books\/book2\/page\//);

    // Delete the page
    await page.getByRole('link', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/delete/);
    await page.getByRole('button', { name: 'Confirm' }).click();
    // Should redirect to book or parent
    await page.waitForURL(/\/books\/book2/);
    await expect(page.getByRole('heading', { name: pageName })).not.toBeVisible();
  });

  test('page export returns content', async ({ page }) => {
    const response = await page.request.get('/books/book1/page/page-1/export/html');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('Page 1');
  });

  test('page markdown export returns content', async ({ page }) => {
    const response = await page.request.get('/books/book1/page/page-1/export/markdown');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
  });

  test('page copy page loads with correct heading', async ({ page }) => {
    await page.goto('/books/book1/page/page-1/copy');
    await expect(page.getByRole('heading', { name: 'Copy Page', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Page' })).toBeVisible();
  });
});
