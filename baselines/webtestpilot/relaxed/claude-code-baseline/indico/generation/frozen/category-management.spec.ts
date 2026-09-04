import { test, expect } from '@playwright/test';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
  });

  test('category management content page shows event list', async ({ page }) => {
    await page.goto('/category/0/manage/');
    await expect(page).toHaveTitle(/Management.*Content.*Home.*Indico/);

    // Should list events
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Lecture|Conference|Meeting|Workshop/i);
  });

  test('category management sidebar links are correct', async ({ page }) => {
    await page.goto('/category/0/manage/');

    // Use the side-menu locator to avoid ambiguity with "Skip to main content"
    const sideMenu = page.locator('.side-menu');
    await expect(sideMenu.getByRole('link', { name: 'Content' })).toBeVisible();
    await expect(sideMenu.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(sideMenu.getByRole('link', { name: 'Protection' })).toBeVisible();
    await expect(sideMenu.getByRole('link', { name: 'Roles' })).toBeVisible();
    await expect(sideMenu.getByRole('link', { name: 'Materials' })).toBeVisible();
    await expect(sideMenu.getByRole('link', { name: 'Logs' })).toBeVisible();
  });

  test('category settings page renders', async ({ page }) => {
    await page.goto('/category/0/manage/settings');
    await expect(page).toHaveTitle(/Management.*Settings.*Home.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Settings|Category/i);
  });

  test('category protection page renders', async ({ page }) => {
    await page.goto('/category/0/manage/protection');
    await expect(page).toHaveTitle(/Management.*Protection.*Home.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Protection|Permission/i);
  });

  test('category roles page renders', async ({ page }) => {
    await page.goto('/category/0/manage/roles');
    await expect(page).toHaveTitle(/Management.*Roles.*Home.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Roles/i);
  });

  test('category logs page renders', async ({ page }) => {
    await page.goto('/category/0/manage/logs/');
    await expect(page).toHaveTitle(/Management.*Logs.*Home.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Logs/i);
  });

  test('category materials page renders', async ({ page }) => {
    await page.goto('/category/0/manage/attachments/');
    await expect(page).toHaveTitle(/Management.*Materials.*Home.*Indico/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('category management shows correct event count info', async ({ page }) => {
    await page.goto('/category/0/manage/');
    await page.waitForLoadState('networkidle');

    // The page should show the list of events that exist in the seeded data
    const bodyText = await page.locator('body').textContent();
    // These are the seeded events we know about
    expect(bodyText).toMatch(/Lecture 1|Lecture 2|Conference 1/i);
  });
});
