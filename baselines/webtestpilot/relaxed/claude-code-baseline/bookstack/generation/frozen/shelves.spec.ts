import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Shelves', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shelves list page shows seeded shelf', async ({ page }) => {
    await page.goto('/shelves');
    await expect(page).toHaveTitle(/Shelves/);
    // The seeded shelf named "Shelf" should appear
    await expect(page.getByText('Shelf').first()).toBeVisible();
  });

  test('create shelf - new shelf appears in shelves list', async ({ page }) => {
    const uniqueName = `Test Shelf ${Date.now()}`;

    await page.goto('/create-shelf');
    await expect(page).toHaveTitle(/Create New Shelf/);

    await page.fill('[name="name"]', uniqueName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should redirect to the new shelf; use h1 to avoid strict mode violation
    await expect(page).toHaveURL(/\/shelves\//);
    await expect(page.locator('h1').first()).toContainText(uniqueName);

    // Verify in shelves list
    await page.goto('/shelves');
    await expect(page.getByText(uniqueName).first()).toBeVisible();
  });

  test('shelf detail page shows linked books and actions', async ({ page }) => {
    await page.goto('/shelves/shelf');
    await expect(page).toHaveTitle(/Shelf/);
    // Should have books listed
    await expect(page.locator('a[href*="/books/book1"]')).toBeVisible();
    // Action links available
    await expect(page.locator('a[href*="/edit"]')).toBeVisible();
    await expect(page.locator('a[href*="/delete"]')).toBeVisible();
  });

  test('edit shelf - name update reflected on detail page', async ({ page }) => {
    const originalName = `Shelf Edit Test ${Date.now()}`;
    const updatedName = `Shelf Updated ${Date.now()}`;

    await page.goto('/create-shelf');
    await page.fill('[name="name"]', originalName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const shelfUrl = page.url();

    await page.goto(shelfUrl + '/edit');
    await page.fill('[name="name"]', updatedName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Use h1 for main page heading to avoid strict mode violation
    await expect(page.locator('h1').first()).toContainText(updatedName);
  });

  test('delete shelf - shelf removed from list', async ({ page }) => {
    const name = `Shelf To Delete ${Date.now()}`;

    await page.goto('/create-shelf');
    await page.fill('[name="name"]', name);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const shelfUrl = page.url();
    const deleteUrl = shelfUrl + '/delete';

    await page.goto(deleteUrl);
    // Submit delete form
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should be redirected to shelves list; confirm shelf is gone
    await page.goto('/shelves');
    await expect(page.locator('h1').filter({ hasText: name })).not.toBeVisible();
    await expect(page.getByText(name)).not.toBeVisible();
  });
});
