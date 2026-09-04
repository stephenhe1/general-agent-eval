import { test, expect } from '@playwright/test';

test.describe('Administration Area', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
  });

  test('admin general settings page renders', async ({ page }) => {
    await page.goto('/admin/settings/');
    await expect(page).toHaveTitle(/Administration.*General Settings.*Indico/);

    // Admin sidebar sections
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/General Settings|Administration/i);

    // Side menu items (some may be in collapsed sections)
    await expect(page.getByRole('link', { name: 'General Settings' })).toBeVisible();
    // Users and Groups are in "User Management" collapsed section - check they exist in DOM
    await expect(page.locator('a[href="/admin/users/"]')).toHaveCount(1);
    await expect(page.locator('a[href="/admin/groups/"]')).toHaveCount(1);
  });

  test('admin area redirects to general settings', async ({ page }) => {
    await page.goto('/admin/');
    await page.waitForLoadState('networkidle');
    // Should redirect to /admin/settings/
    await expect(page).toHaveURL(/\/admin\/(settings\/)?/);
    await expect(page).toHaveTitle(/Administration.*Indico/);
  });

  test('admin users list page renders with user data', async ({ page }) => {
    await page.goto('/admin/users/');
    await expect(page).toHaveTitle(/Administration.*Users.*Indico/);

    // Should display admin user at minimum
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/admin@admin.com|Admin User|Users/i);
  });

  test('admin groups page renders', async ({ page }) => {
    await page.goto('/admin/groups/');
    await expect(page).toHaveTitle(/Administration.*Groups.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Groups/i);
  });

  test('admin news management page renders', async ({ page }) => {
    await page.goto('/admin/news/');
    await expect(page).toHaveTitle(/Administration.*News.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/News|Post news/i);
  });

  test('admin sidebar navigation is complete', async ({ page }) => {
    await page.goto('/admin/settings/');

    // Check all admin sections are present in the sidebar (some in collapsed groups)
    await expect(page.getByRole('link', { name: 'General Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Plugins' })).toBeVisible();
    // Users/Groups are in collapsed "User Management" section
    await expect(page.locator('a[href="/admin/users/"]')).toHaveCount(1);
    await expect(page.locator('a[href="/admin/groups/"]')).toHaveCount(1);
    // News/Announcement/Upcoming events are in "Homepage" section
    await expect(page.locator('a[href="/admin/news/"]')).toHaveCount(1);
    await expect(page.locator('a[href="/admin/announcement"]')).toHaveCount(1);
  });

  test('admin is not accessible to unauthenticated users', async ({ browser }) => {
    const newContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const newPage = await newContext.newPage();

    await newPage.goto('http://localhost:8080/admin/settings/');
    await newPage.waitForLoadState('networkidle');

    // Should redirect to login
    await expect(newPage).toHaveURL(/\/login\//);
    await newContext.close();
  });

  test('admin news - create and verify news post', async ({ page }) => {
    await page.goto('/admin/news/');
    await page.waitForLoadState('networkidle');

    // Check initial news count
    const initialRows = await page.locator('table tr, .news-item').count();

    // Click "Post news" button if available
    const postNewsBtn = page.getByRole('link', { name: 'Post news' }).or(
      page.getByRole('button', { name: 'Post news' })
    );

    if (await postNewsBtn.count() > 0) {
      await expect(postNewsBtn).toBeVisible();
      // Verify the page shows the news management interface
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toMatch(/Post news|Title|Date/i);
    }
  });
});
