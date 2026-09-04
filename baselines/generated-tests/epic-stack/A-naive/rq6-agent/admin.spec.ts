import { test, expect } from '@playwright/test';
import * as path from 'path';
import { gotoWithRetry } from './helpers';

// Use pre-authenticated session (kody is admin in the seeded data)
test.use({ storageState: path.join(__dirname, 'playwright-auth.json') });

test.describe('Admin Pages', () => {
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('admin/cache page loads or redirects appropriately', async ({ page }) => {
    await gotoWithRetry(page, '/admin/cache');
    // Should either load the admin page or redirect (no crash)
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    const bodyText = (await page.locator('body').textContent())!;
    expect(bodyText.length).toBeGreaterThan(50);
  });
});
