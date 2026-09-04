// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 37: Page Not Found State', () => {
  test('should show Page Not Found page for an unrecognized route', async ({ page }) => {
    // Navigate to a nonexistent route
    await page.goto('http://127.0.0.1:5173/ws#route=nonexistent-route&wsName=ugx-baseline');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Postconditions: page shows "Page Not Found" heading
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();

    // Go to Welcome Screen button is present
    await expect(page.getByRole('button', { name: 'Go to Welcome Screen' })).toBeVisible();
  });
});
