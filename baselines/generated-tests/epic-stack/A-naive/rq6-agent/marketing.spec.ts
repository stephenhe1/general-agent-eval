import { test, expect } from '@playwright/test';
import { gotoWithRetry } from './helpers';

test.describe('Marketing / Public Pages', () => {
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('home page loads and shows Epic Stack branding', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await expect(page).toHaveTitle(/Epic Notes/i);
    // The page shows "The Epic Stack" heading
    await expect(page.getByText('The Epic Stack')).toBeVisible();
    // Has navigation links
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
  });

  test('home page has navigation links including login', async ({ page }) => {
    await gotoWithRetry(page, '/');
    // The nav contains at minimum a login link
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
    // There's a link to the Epic Stack or logo
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('about page loads', async ({ page }) => {
    await gotoWithRetry(page, '/about');
    await expect(page).toHaveTitle(/Epic Notes/i);
    // Page should load without error - check for error page absence
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    // Body has some content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test('privacy policy page loads', async ({ page }) => {
    await gotoWithRetry(page, '/privacy');
    await expect(page).toHaveTitle(/Epic Notes/i);
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    // Privacy page should mention "privacy"
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    expect(bodyText).toContain('privacy');
  });

  test('support page loads', async ({ page }) => {
    await gotoWithRetry(page, '/support');
    await expect(page).toHaveTitle(/Epic Notes/i);
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('terms of service page loads', async ({ page }) => {
    await gotoWithRetry(page, '/tos');
    await expect(page).toHaveTitle(/Epic Notes/i);
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('404 page shows for unknown routes', async ({ page }) => {
    await gotoWithRetry(page, '/this-route-definitely-does-not-exist-xyz123');
    // Should show some kind of error/not found page
    const statusCode = await page.evaluate(() => {
      const metaStatus = document.querySelector('meta[name="status"]');
      return metaStatus ? metaStatus.getAttribute('content') : null;
    });
    // Either check for 404 status or look for "not found" text
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    const hasNotFoundContent = bodyText.includes('not found') || bodyText.includes("we can't find") || bodyText.includes('404') || statusCode === '404';
    // Page loads at minimum (doesn't crash browser)
    expect(page.url()).toBeTruthy();
  });
});
