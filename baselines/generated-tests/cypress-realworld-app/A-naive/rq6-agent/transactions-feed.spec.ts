import { test, expect } from '@playwright/test';
import { signInUI, BASE_URL } from './helpers';

test.describe('Transaction Feed', () => {
  test.beforeEach(async ({ page }) => {
    await signInUI(page);
  });

  test('public transactions tab shows transaction list', async ({ page }) => {
    await page.locator('[data-test="nav-public-tab"]').click();
    await page.waitForURL(/\//, { timeout: 5000 });

    // The transaction list should appear with at least one item
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible({ timeout: 10000 });
    const items = page.locator('[data-test^="transaction-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('personal transactions tab shows personal list', async ({ page }) => {
    await page.locator('[data-test="nav-personal-tab"]').click();
    await page.waitForURL(/\/personal/, { timeout: 5000 });
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('contacts transactions tab shows contacts list', async ({ page }) => {
    await page.locator('[data-test="nav-contacts-tab"]').click();
    await page.waitForURL(/\/contacts/, { timeout: 5000 });
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('transaction feed navigation tabs are all visible', async ({ page }) => {
    await expect(page.locator('[data-test="nav-transaction-tabs"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-public-tab"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-personal-tab"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-contacts-tab"]')).toBeVisible();
  });

  test('amount range filter chip opens popover with slider at desktop width', async ({ page }) => {
    // At 1280px viewport the component uses a Popover (not a Drawer)
    await page.locator('[data-test="transaction-list-filter-amount-range-button"]').click();

    // The popover contains the amount range slider
    await expect(
      page.locator('[data-test="transaction-list-filter-amount-range-slider"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('date range filter chip opens popover with calendar at desktop width', async ({ page }) => {
    // At 1280px viewport the component uses a Popover (not a Drawer)
    await page.locator('[data-test="transaction-list-filter-date-range-button"]').click();

    // The popover/drawer contains a calendar (data-test is dynamic, just check something appeared)
    // The RangeCalendar uses dataTest="transaction-list-filter-date-range"
    await expect(
      page.getByRole('table').first()  // calendar renders a table
        .or(page.locator('[data-test="transaction-list-filter-date-range"]'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('clicking a transaction item navigates to transaction detail', async ({ page }) => {
    await page.locator('[data-test="nav-public-tab"]').click();
    await expect(page.locator('[data-test^="transaction-item-"]').first()).toBeVisible({ timeout: 10000 });

    await page.locator('[data-test^="transaction-item-"]').first().click();
    await expect(page).toHaveURL(/\/transaction\//, { timeout: 10000 });
    await expect(page.locator('[data-test="transaction-detail-header"]')).toBeVisible({ timeout: 10000 });
  });
});
