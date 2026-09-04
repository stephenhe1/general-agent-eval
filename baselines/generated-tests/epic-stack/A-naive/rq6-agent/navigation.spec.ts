import { test, expect } from '@playwright/test';
import * as path from 'path';
import { gotoWithRetry } from './helpers';

test.describe('Navigation and Layout - Public', () => {
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('header shows logo linking to home', async ({ page }) => {
    await gotoWithRetry(page, '/');
    const logoLink = page.locator('a[href="/"]').first();
    await expect(logoLink).toBeVisible();
  });

  test('header shows Login button when unauthenticated', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
  });

  test('html element has light or dark theme class', async ({ page }) => {
    await gotoWithRetry(page, '/');
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toMatch(/light|dark/);
  });

  test('navigating from home to login page works', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await page.getByRole('link', { name: /log in/i }).click();
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('navigating from login to signup via Create an account link', async ({ page }) => {
    await gotoWithRetry(page, '/login');
    await page.getByRole('link', { name: /create an account/i }).click();
    await page.waitForURL('**/signup**', { timeout: 10000 });
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('navigating from login to forgot-password via link', async ({ page }) => {
    await gotoWithRetry(page, '/login');
    await page.getByRole('link', { name: /forgot password/i }).click();
    await page.waitForURL('**/forgot-password**', { timeout: 10000 });
    await expect(page.getByLabel(/username or email/i)).toBeVisible();
  });
});

test.describe('Navigation and Layout - Authenticated', () => {
  test.use({ storageState: path.join(__dirname, 'playwright-auth.json') });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('authenticated user sees their name in the nav area', async ({ page }) => {
    await gotoWithRetry(page, '/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.toLowerCase()).toContain('kody');
  });

  test('authenticated header does not show plain Login link', async ({ page }) => {
    await gotoWithRetry(page, '/');
    // When logged in, there should be user-specific nav instead of Login
    const loginLinks = page.getByRole('link', { name: /^log in$/i });
    const count = await loginLinks.count();
    // The "Log In" link for navigation should not be present when logged in
    expect(count).toBe(0);
  });

  test('can navigate from notes page to individual note', async ({ page }) => {
    await gotoWithRetry(page, '/users/kody/notes');
    await page.getByRole('link', { name: 'Basic Koala Facts' }).click();
    await page.waitForURL('**/notes/d27a197e**', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Basic Koala Facts' })).toBeVisible();
  });

  test('note detail page has link back to user profile/notes area', async ({ page }) => {
    await gotoWithRetry(page, '/users/kody/notes/d27a197e');
    // There should be a navigation path back to notes or profile
    const backLinks = page.locator('a[href*="/users/kody"]');
    const count = await backLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
