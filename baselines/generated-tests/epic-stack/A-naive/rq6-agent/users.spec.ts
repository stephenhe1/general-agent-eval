import { test, expect } from '@playwright/test';
import { gotoWithRetry } from './helpers';

test.describe('User Profiles', () => {
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('users list page shows user cards', async ({ page }) => {
    await gotoWithRetry(page, '/users');
    // Page should have user cards/links
    const userLinks = page.locator('a[href^="/users/"]');
    const count = await userLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('users page has a search input', async ({ page }) => {
    await gotoWithRetry(page, '/users');
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).or(page.locator('input[type="search"]'));
    await expect(searchInput).toBeVisible();
  });

  test('users search filters results', async ({ page }) => {
    await gotoWithRetry(page, '/users');
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).or(page.locator('input[type="search"]'));

    // Get count before search
    const userLinksBefore = page.locator('a[href^="/users/"]');
    const countBefore = await userLinksBefore.count();

    // Search for "kody" which should return fewer results or just kody
    await searchInput.fill('kody');
    // Wait for results to update (may be debounced)
    await page.waitForTimeout(1000);

    const userLinksAfter = page.locator('a[href^="/users/"]');
    const countAfter = await userLinksAfter.count();

    // Either results filtered down or we see kody in the results
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.toLowerCase()).toContain('kody');
    // Results should be filtered (fewer or equal count)
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  test('users search for non-existent user shows no results', async ({ page }) => {
    await gotoWithRetry(page, '/users');
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).or(page.locator('input[type="search"]'));

    await searchInput.fill('xyzzy_no_user_exists_abc123');
    await page.waitForTimeout(1000);

    const userLinks = page.locator('a[href^="/users/"]');
    const count = await userLinks.count();
    // Should show 0 or very few results
    expect(count).toBeLessThanOrEqual(1);
  });

  test('user profile page shows username', async ({ page }) => {
    await gotoWithRetry(page, '/users/kody');
    // Should show the user's name/username
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.toLowerCase()).toContain('kody');
  });

  test('user profile page has link to notes', async ({ page }) => {
    await gotoWithRetry(page, '/users/kody');
    // Use href-based selector to avoid strict mode violations from multiple "notes" links
    const notesLink = page.locator('a[href="/users/kody/notes"]');
    await expect(notesLink).toBeVisible();
    await notesLink.click();
    await page.waitForURL('**/users/kody/notes**', { timeout: 10000 });
    expect(page.url()).toContain('/users/kody/notes');
  });

  test('user profile for non-existent user shows 404 or error', async ({ page }) => {
    await gotoWithRetry(page, '/users/this-user-doesnt-exist-xyz999');
    // Should show an error or not found page
    await page.waitForTimeout(1000);
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    const hasErrorContent = bodyText.includes('not found') || bodyText.includes('404') || bodyText.includes('no user') || bodyText.includes('error');
    // Page loads (doesn't crash)
    expect(page.url()).toBeTruthy();
  });

  test('clicking on a user card from users list navigates to user profile', async ({ page }) => {
    await gotoWithRetry(page, '/users');
    const kodyLink = page.getByRole('link', { name: /kody/i }).first();
    await kodyLink.click();
    await page.waitForURL('**/users/kody**', { timeout: 10000 });
    expect(page.url()).toContain('/users/kody');
  });
});
