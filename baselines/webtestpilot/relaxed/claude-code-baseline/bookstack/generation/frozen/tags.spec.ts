import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Tags', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('tags list page shows seeded tags', async ({ page }) => {
    await page.goto('/tags');
    await expect(page).toHaveTitle(/Tags/);
    // Seeded tags: "env" and "Sample Tag"
    await expect(page.getByText('env').first()).toBeVisible();
    await expect(page.getByText('Sample Tag').first()).toBeVisible();
  });

  test('filter tags by name shows results', async ({ page }) => {
    await page.goto('/tags?name=env');
    await expect(page).toHaveTitle(/Tags/);
    // Should show items tagged with "env"
    const items = page.locator('.entity-list-item, .tag-item, [class*="tag"]');
    await expect(items.first()).toBeVisible();
  });

  test('clicking tag name link filters items', async ({ page }) => {
    await page.goto('/tags');
    // Find the "env" tag link and click it
    const envLink = page.getByRole('link', { name: /env/i }).first();
    await expect(envLink).toBeVisible();
    await envLink.click();
    await page.waitForLoadState('networkidle');
    // Should filter by that tag
    await expect(page).toHaveURL(/tags.*name=env|search.*env/);
  });
});
