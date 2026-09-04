// spec: specs/admin-categories-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login/');
  await page.getByRole('textbox', { name: 'Username or email' }).fill('admin@admin.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('webtestpilot');
  await page.getByRole('button', { name: /Login/ }).click();
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('View Home Category', async ({ page }) => {
    // Navigate to the home page (root category)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Main categories heading should be visible
    await expect(page.getByRole('heading', { name: 'Main categories' })).toBeVisible();
  });

  test('View Category Management Page', async ({ page }) => {
    // Navigate to category management
    await page.goto('/category/0/manage/');
    await page.waitForLoadState('domcontentloaded');

    // Management page should show "Home" in the banner title
    await expect(page.locator('.banner .title').getByText('Home')).toBeVisible();
    // Create subcategory button should be present
    await expect(page.getByRole('button', { name: 'Create subcategory' })).toBeVisible();
  });

  test('Create a New Subcategory', async ({ page }) => {
    const categoryName = `Test Category ${Date.now()}`;

    // Navigate to category management
    await page.goto('/category/0/manage/');
    await page.waitForLoadState('domcontentloaded');

    // Click "Create subcategory" button
    await page.getByRole('button', { name: 'Create subcategory' }).click();

    // Wait for dialog/form to appear
    await page.waitForSelector('#title', { timeout: 10000 });
    // Fill in category title
    await page.locator('#title').fill(categoryName);

    // Click Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Wait for the category to be created and the page to update
    await page.waitForLoadState('domcontentloaded');

    // New category should appear in the list
    await expect(page.getByRole('link', { name: categoryName })).toBeVisible({ timeout: 10000 });
  });

  test('View Category Settings', async ({ page }) => {
    // Navigate to category settings
    await page.goto('/category/0/manage/settings');
    await page.waitForLoadState('domcontentloaded');

    // Settings page should load - the "Settings" nav link is visible and active
    await expect(page.locator('.side-menu').getByRole('link', { name: 'Settings' })).toBeVisible();
    // The settings form content should be visible (look for settings form area)
    await expect(page.locator('.content-column').first()).toBeVisible();
  });

  test('Category Protection Settings Accessible', async ({ page }) => {
    // Navigate to category protection settings
    await page.goto('/category/0/manage/protection');
    await page.waitForLoadState('domcontentloaded');

    // Protection page should load
    await expect(page).not.toHaveURL(/\/login\//);
    await expect(page.getByRole('link', { name: 'Protection' })).toBeVisible();
  });
});
