import { test, expect } from "@playwright/test";
import { loginAsDefaultUser, BASE } from "./helpers";

test.describe("Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefaultUser(page);
  });

  test("notifications list loads with items", async ({ page }) => {
    await page.goto(`${BASE}/notifications`);
    await page.waitForURL(/\/notifications/, { timeout: 5000 });

    const list = page.locator('[data-test="notifications-list"]');
    await expect(list).toBeVisible({ timeout: 10000 });

    // Heath93 has unread notifications
    const items = page.locator('[data-test^="notification-list-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 5000 });
    expect(await items.count()).toBeGreaterThan(0);
  });

  test("notifications page accessible via sidenav", async ({ page }) => {
    await page.locator('[data-test="sidenav-notifications"]').click();
    await page.waitForURL(/\/notifications/, { timeout: 5000 });
    await expect(
      page.locator('[data-test="notifications-list"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test("notifications accessible via nav bar icon", async ({ page }) => {
    await page.locator('[data-test="nav-top-notifications-link"]').click();
    await page.waitForURL(/\/notifications/, { timeout: 5000 });
    await expect(
      page.locator('[data-test="notifications-list"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test("notification badge count decreases after dismissing a notification", async ({
    page,
  }) => {
    // Navigate to notifications and dismiss one
    await page.goto(`${BASE}/notifications`);
    const items = page.locator('[data-test^="notification-list-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    const countInListBefore = await items.count();
    expect(countInListBefore).toBeGreaterThan(0);

    // Get the nav badge count while on the notifications page
    // Wait for the badge to reflect the loaded notifications count
    const badge = page.locator('[data-test="nav-top-notifications-count"]');
    // The badge may or may not be rendered; capture list count as ground truth
    const firstItem = items.first();
    const dataTest = await firstItem.getAttribute("data-test");
    const notifId = dataTest?.replace("notification-list-item-", "");
    const dismissBtn = firstItem.locator(
      `[data-test="notification-mark-read-${notifId}"]`
    );
    await expect(dismissBtn).toBeVisible({ timeout: 3000 });
    await dismissBtn.click();
    await page.waitForTimeout(800);

    // After dismissal the notification disappears from the list
    const countInListAfter = await page
      .locator('[data-test^="notification-list-item-"]')
      .count();
    expect(countInListAfter).toBe(countInListBefore - 1);

    // Navigate to home and verify the nav badge reflects the updated count
    await page.goto(`${BASE}/`);
    // Wait until the notifications data has loaded (badge becomes non-undefined)
    // By waiting for the badge count to appear or for the badge count element
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-test="nav-top-notifications-count"]');
        if (!el) return false;
        // Check if the badge span has rendered (even if count is 0)
        return el.textContent !== null;
      },
      { timeout: 10000 }
    );

    // Verify the badge count matches the remaining notifications in the list
    // The badge shows allNotifications.length (loaded from API), so we just
    // assert it's not more than countInListBefore (could be 0 if all dismissed)
    const badgeText = await badge.textContent().catch(() => "0");
    const badgeCount = parseInt(badgeText || "0");
    expect(badgeCount).toBeLessThanOrEqual(countInListBefore);
    expect(badgeCount).toBe(countInListAfter);
  });

  test("dismiss (mark as read) a notification removes it from unread list", async ({
    page,
  }) => {
    await page.goto(`${BASE}/notifications`);
    await page.waitForURL(/\/notifications/, { timeout: 5000 });

    const items = page.locator('[data-test^="notification-list-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    const countBefore = await items.count();

    // Get the ID of the first notification
    const firstItem = items.first();
    const dataTest = await firstItem.getAttribute("data-test");
    const notifId = dataTest?.replace("notification-list-item-", "");

    // Find and click the dismiss/mark-as-read button
    const dismissBtn = firstItem.locator(
      `[data-test="notification-mark-read-${notifId}"]`
    );
    await expect(dismissBtn).toBeVisible({ timeout: 3000 });
    await dismissBtn.click();
    await page.waitForTimeout(500);

    // After marking as read, count should decrease
    const countAfter = await page
      .locator('[data-test^="notification-list-item-"]')
      .count();
    expect(countAfter).toBe(countBefore - 1);
  });
});
