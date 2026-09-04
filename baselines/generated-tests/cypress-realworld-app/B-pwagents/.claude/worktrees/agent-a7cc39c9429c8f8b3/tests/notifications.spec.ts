import { test, expect } from '@playwright/test';

test.use({
  launchOptions: {
    args: ['--disable-web-security'],
  },
});

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/signin');
  await page.locator('input[name="username"]').fill('Heath93');
  await page.locator('input[name="password"]').fill('s3cret');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL('**/');
}

test.describe('Area 4: Notifications', () => {
  test('4.1 Notifications page displays all unread notifications with count badge', async ({ page }) => {
    await signIn(page);

    // Assert the badge shows a non-zero number on home page
    const badgeLocator = page.locator('[data-test="nav-top-notifications-count"]');
    await expect(badgeLocator).toBeVisible();
    const badgeText = await badgeLocator.textContent();
    const badgeCount = parseInt(badgeText ?? '0', 10);
    expect(badgeCount).toBeGreaterThan(0);

    // Navigate to notifications page
    await page.locator('[data-test="sidenav-notifications"]').click();
    await expect(page).toHaveURL(/\/notifications/);

    // Postconditions
    await expect(page.locator('[data-test="notifications-list"]')).toBeVisible();
    const notificationItems = page.locator('[data-test^="notification-list-item-"]');
    await expect(notificationItems.first()).toBeVisible();
    const itemCount = await notificationItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Each item has a Dismiss button
    await expect(page.locator('[data-test^="notification-mark-read-"]').first()).toBeVisible();
  });

  test('4.2 Clicking "Dismiss" on a notification removes it from the list and decrements the badge', async ({ page }) => {
    await signIn(page);

    await page.goto('/notifications');
    await expect(page.locator('[data-test="notifications-list"]')).toBeVisible();

    // Record current badge count
    const badgeLocator = page.locator('[data-test="nav-top-notifications-count"]');
    await expect(badgeLocator).toBeVisible();
    const initialBadgeText = await badgeLocator.textContent();
    const initialCount = parseInt(initialBadgeText ?? '0', 10);

    // Get the first notification item's id from its data-test attribute
    const firstItem = page.locator('[data-test^="notification-list-item-"]').first();
    await expect(firstItem).toBeVisible();
    const firstItemDataTest = await firstItem.getAttribute('data-test');
    // Extract the id portion from e.g. "notification-list-item-_8SPNU0ETv"
    const notificationId = firstItemDataTest?.replace('notification-list-item-', '') ?? '';

    // Count all items before dismissal
    const allItems = page.locator('[data-test^="notification-list-item-"]');
    const initialItemCount = await allItems.count();

    // Click the dismiss button for that notification
    await page.locator(`[data-test="notification-mark-read-${notificationId}"]`).click();

    // Wait for list to update
    await page.waitForTimeout(500);

    // Postconditions
    // Badge shows N-1
    const updatedBadgeText = await badgeLocator.textContent();
    const updatedCount = parseInt(updatedBadgeText ?? '0', 10);
    expect(updatedCount).toBe(initialCount - 1);

    // The dismissed item is gone
    await expect(page.locator(`[data-test="notification-list-item-${notificationId}"]`)).toHaveCount(0);

    // Total item count decreased by 1
    const finalItemCount = await allItems.count();
    expect(finalItemCount).toBe(initialItemCount - 1);
  });

  test('4.3 Dismissing all notifications empties the list and resets the badge to 0', async ({ page }) => {
    await signIn(page);

    await page.goto('/notifications');
    await expect(page.locator('[data-test="notifications-list"]')).toBeVisible();

    // Dismiss all notifications one by one
    // We keep clicking the first dismiss button until none remain
    const dismissButtons = page.locator('[data-test^="notification-mark-read-"]');
    let count = await dismissButtons.count();

    while (count > 0) {
      await dismissButtons.first().click();
      await page.waitForTimeout(300);
      count = await dismissButtons.count();
    }

    // Postconditions
    // Badge either not visible or shows 0
    const badgeLocator = page.locator('[data-test="nav-top-notifications-count"]');
    const isBadgeVisible = await badgeLocator.isVisible();
    if (isBadgeVisible) {
      const badgeText = await badgeLocator.textContent();
      expect(parseInt(badgeText ?? '0', 10)).toBe(0);
    }

    // No notification items remain
    await expect(page.locator('[data-test^="notification-list-item-"]')).toHaveCount(0);
  });

  test('4.4 Notification count badge on the top navigation matches the number of notification list items', async ({ page }) => {
    await signIn(page);

    // Record badge count on home page
    const badgeLocator = page.locator('[data-test="nav-top-notifications-count"]');
    await expect(badgeLocator).toBeVisible();
    const badgeText = await badgeLocator.textContent();
    const badgeCount = parseInt(badgeText ?? '0', 10);

    // Navigate to notifications page
    await page.goto('/notifications');
    await expect(page.locator('[data-test="notifications-list"]')).toBeVisible();

    // Count notification items
    const notificationItems = page.locator('[data-test^="notification-list-item-"]');
    const itemCount = await notificationItems.count();

    // Postcondition: item count equals badge count
    expect(itemCount).toBe(badgeCount);
  });
});
