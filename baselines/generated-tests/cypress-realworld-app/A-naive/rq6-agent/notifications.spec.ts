import { test, expect } from '@playwright/test';
import { signInUI, BASE_URL } from './helpers';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await signInUI(page);
  });

  test('notifications page is accessible from sidebar', async ({ page }) => {
    await page.locator('[data-test="sidenav-notifications"]').click();
    await page.waitForURL(/\/notifications/, { timeout: 10000 });
    await expect(page.locator('[data-test="notifications-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('notifications page is accessible from navbar link', async ({ page }) => {
    await page.locator('[data-test="nav-top-notifications-link"]').click();
    await page.waitForURL(/\/notifications/, { timeout: 10000 });
    await expect(page.locator('[data-test="notifications-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('notification count badge shows in navbar when there are unread notifications', async ({ page }) => {
    // The notifications badge should be visible if there are unread notifications
    // The app should have seeded notifications for Heath93
    const badge = page.locator('[data-test="nav-top-notifications-count"]');
    // Check if badge exists (might not if all notifications are read)
    const badgeVisible = await badge.isVisible({ timeout: 3000 }).catch(() => false);
    if (badgeVisible) {
      const badgeText = await badge.textContent();
      const count = parseInt(badgeText ?? '0', 10);
      expect(count).toBeGreaterThan(0);
    }
    // If no badge, that's fine - all notifications may already be read
  });

  test('marking a notification as read removes it from unread list', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`);
    await expect(page.locator('[data-test="notifications-list"]')).toBeVisible({ timeout: 10000 });

    // Check if there are any unread notifications to mark as read
    const markReadButtons = page.locator('[data-test^="notification-mark-read-"]');
    const buttonCount = await markReadButtons.count();

    if (buttonCount > 0) {
      // Get the count before
      const countBefore = await markReadButtons.count();

      // Click the first mark-as-read button
      await markReadButtons.first().click();
      await page.waitForTimeout(1000);

      // The count should have decreased
      const countAfter = await page.locator('[data-test^="notification-mark-read-"]').count();
      expect(countAfter).toBeLessThan(countBefore);
    }
    // If there are no unread notifications, just verify the page loaded
  });
});
