import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('page detail shows content and action links', async ({ page }) => {
    await page.goto('/books/book1/page/page-1');
    await expect(page).toHaveTitle(/Page 1/);
    // Action links
    await expect(page.locator('a[href*="/page-1/edit"]').first()).toBeVisible();
    await expect(page.locator('a[href*="/page-1/copy"]')).toBeVisible();
    await expect(page.locator('a[href*="/page-1/move"]')).toBeVisible();
    await expect(page.locator('a[href*="/page-1/delete"]')).toBeVisible();
    // Revisions link (use data-shortcut to avoid strict mode - two elements share the href)
    await expect(page.locator('[data-shortcut="revisions"]')).toBeVisible();
  });

  test('page revisions list loads', async ({ page }) => {
    await page.goto('/books/book1/page/page-1/revisions');
    await expect(page).toHaveTitle(/Revisions/);
  });

  test('create page - draft created and can be saved', async ({ page }) => {
    await page.goto('/books/book1/create-page');
    await page.waitForLoadState('networkidle');

    // Should be in the editor (draft URL)
    await expect(page).toHaveURL(/\/draft\//);
    await expect(page).toHaveTitle(/Edit Page Draft/);

    // Fill the page title
    const pageTitle = `New Test Page ${Date.now()}`;
    await page.fill('[name="name"]', pageTitle);

    // Save the page using the dedicated save-button (id="save-button")
    await page.click('#save-button');
    await page.waitForLoadState('networkidle');

    // Should be on the saved page
    await expect(page).toHaveURL(/\/books\/book1\/page\//);
    await expect(page.locator('h1').first()).toContainText(pageTitle);

    // Verify in book listing
    await page.goto('/books/book1');
    await expect(page.getByText(pageTitle).first()).toBeVisible();
  });

  test('edit page title - create then edit', async ({ page }) => {
    // Create a fresh page to edit (avoids modifying seeded pages)
    await page.goto('/books/book2/create-page');
    await page.waitForLoadState('networkidle');

    const initialTitle = `Edit Test Page ${Date.now()}`;
    await page.fill('[name="name"]', initialTitle);
    await page.click('#save-button');
    await page.waitForLoadState('networkidle');

    const pageUrl = page.url();

    // Now edit it
    await page.goto(pageUrl + '/edit');
    await expect(page).toHaveTitle(/Editing Page/);

    const newTitle = `Edit Test Updated ${Date.now()}`;
    await page.fill('[name="name"]', newTitle);
    await page.click('#save-button');
    await page.waitForLoadState('networkidle');

    // Should show updated title on page
    await expect(page.locator('h1').first()).toContainText(newTitle);

    // Verify the new title is stored (new URL after title change)
    const newPageUrl = page.url();
    await page.goto(newPageUrl);
    await expect(page.locator('h1').first()).toContainText(newTitle);
  });

  test('copy page - creates a copy in same book', async ({ page }) => {
    await page.goto('/books/book1/page/page-1/copy');
    await page.waitForLoadState('networkidle');

    const copyName = `Copy of Page 1 ${Date.now()}`;
    await page.fill('[name="name"]', copyName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should be on the new page
    await expect(page.locator('h1').first()).toContainText(copyName);

    // Verify in book
    await page.goto('/books/book1');
    await expect(page.getByText(copyName).first()).toBeVisible();
  });

  test('delete page - page removed from book', async ({ page }) => {
    // Create a page to delete in book2
    await page.goto('/books/book2/create-page');
    await page.waitForLoadState('networkidle');

    const pageName = `Page To Delete ${Date.now()}`;
    await page.fill('[name="name"]', pageName);
    await page.click('#save-button');
    await page.waitForLoadState('networkidle');

    const pageUrl = page.url();
    await page.goto(pageUrl + '/delete');

    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Verify the page is gone from book
    await page.goto('/books/book2');
    await expect(page.getByText(pageName)).not.toBeVisible();
  });

  test('recently updated pages list loads', async ({ page }) => {
    await page.goto('/pages/recently-updated');
    await expect(page).toHaveTitle(/Recently Updated Pages/);
    // Should show at least one page
    const items = page.locator('.entity-list-item');
    await expect(items.first()).toBeVisible();
  });

  test('page permissions page loads', async ({ page }) => {
    await page.goto('/books/book1/page/page-1/permissions');
    await expect(page).toHaveTitle(/Permissions/);
  });
});
