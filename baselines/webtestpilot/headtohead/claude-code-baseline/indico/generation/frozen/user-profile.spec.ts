import { test, expect } from '@playwright/test';

test.describe('User Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
  });

  test('user dashboard renders with profile information', async ({ page }) => {
    await page.goto('/user/dashboard/');
    await expect(page).toHaveTitle(/My Profile.*Indico/);

    const bodyText = await page.locator('body').textContent();
    // Should show admin user info
    expect(bodyText).toMatch(/Admin User|admin@admin.com/i);
    expect(bodyText).toMatch(/Dashboard/i);
  });

  test('user dashboard shows profile section links', async ({ page }) => {
    await page.goto('/user/dashboard/');

    // Dashboard navigation items
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Dashboard|Personal data|Preferences/i);
  });

  test('user preferences page renders language settings', async ({ page }) => {
    await page.goto('/user/preferences/');
    await expect(page).toHaveTitle(/My Profile.*Indico/);

    const bodyText = await page.locator('body').textContent();
    // Language selection visible
    expect(bodyText).toMatch(/Language|Preferences/i);
    expect(bodyText).toMatch(/English|Deutsch|Français/i);
  });

  test('user profile menu accessible from session bar', async ({ page }) => {
    await page.goto('/');

    // Session bar should show user name
    await expect(page.locator('#session-bar')).toContainText('A. User');

    // "My profile" link is directly visible in session bar
    await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible();

    // "My preferences" and "Logout" are in the session bar dropdown (not directly visible)
    // but they exist in the DOM
    await expect(page.locator('a[href*="/user/preferences/"]')).toHaveCount(1);
    await expect(page.locator('a[href*="/logout/"]')).toHaveCount(1);
  });

  test('my profile link navigates to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'My profile' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/user\/dashboard\//);
    await expect(page).toHaveTitle(/My Profile.*Indico/);
  });

  test('user profile page sections are all accessible', async ({ page }) => {
    await page.goto('/user/dashboard/');

    // Navigate to preferences
    const prefsLink = page.getByRole('link', { name: 'Preferences' });
    if (await prefsLink.count() > 0) {
      await prefsLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/user\/preferences\//);
    }
  });
});
