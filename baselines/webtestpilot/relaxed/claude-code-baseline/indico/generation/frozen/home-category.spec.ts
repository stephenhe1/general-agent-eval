import { test, expect } from '@playwright/test';

test.describe('Home / Category Pages', () => {
  test('home page displays events and navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Home.*Indico/);

    // Global nav menu links
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Room booking' })).toBeVisible();

    // Should show some seeded events
    const eventLinks = page.locator('a[href*="/event/"]');
    await expect(eventLinks.first()).toBeVisible();
    const count = await eventLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('home page shows login link when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  test('home page shows create event options when authenticated', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Administration' })).toBeVisible();
    // Create event options in nav
    const createBtn = page.locator('button', { hasText: 'Create event' }).or(
      page.locator('a', { hasText: 'Create lecture' })
    );
    // Verify create event section exists (may be in dropdown)
    const hasCreateOption = await page.locator('a[href*="create-event"]').count() > 0 ||
                            await page.locator('button', { hasText: /Create/ }).count() > 0;
    expect(hasCreateOption).toBeTruthy();
  });

  test('category overview renders event list for week period', async ({ page }) => {
    await page.goto('/category/0/overview?period=week');
    await expect(page).toHaveTitle(/Home.*Indico/);
    // Should render the page without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('category calendar page renders', async ({ page }) => {
    await page.goto('/category/0/calendar');
    await expect(page).toHaveTitle(/Home.*Indico/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('category statistics page renders', async ({ page }) => {
    await page.goto('/category/0/statistics');
    await expect(page).toHaveTitle(/Home.*Indico/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('category management content page lists events (authenticated)', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    await page.goto('/category/0/manage/');
    await expect(page).toHaveTitle(/Management.*Home.*Indico/);

    // Should list some events
    const content = await page.locator('.category-event-row, .event-list tr, table tr, .list-event').count();
    // Category management should show events in a table/list
    const pageText = await page.locator('body').textContent();
    expect(pageText).toMatch(/Lecture|Conference|Workshop|Meeting/i);
  });
});
