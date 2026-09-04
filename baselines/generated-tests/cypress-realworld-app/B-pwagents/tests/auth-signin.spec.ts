import { test, expect } from '@playwright/test';

/**
 * Sign In area — scenarios 1.1 through 1.5
 *
 * The backend (localhost:3001) enforces CORS for localhost:3000 only, but the
 * frontend runs at 127.0.0.1:5182.  All tests that need a real API session use
 * setupCORSProxy() to intercept outbound XHR and add the correct
 * Access-Control-Allow-Origin header so the browser accepts the response.
 */

async function setupCORSProxy(page: any) {
  await page.route('http://localhost:3001/**', async (route: any) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': request.headers()['origin'] || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        },
        body: '',
      });
    }
    try {
      const response = await route.fetch();
      const body = await response.body();
      const headers = response.headers();
      headers['access-control-allow-origin'] =
        request.headers()['origin'] || 'http://127.0.0.1:5182';
      headers['access-control-allow-credentials'] = 'true';
      await route.fulfill({ status: response.status(), headers, body });
    } catch {
      await route.abort();
    }
  });
}

test.describe('Sign In', () => {
  // -------------------------------------------------------------------------
  // 1.1 — Sign-in page renders correctly
  // -------------------------------------------------------------------------
  test('1.1 sign-in page renders all expected elements', async ({ page }) => {
    await page.goto('/signin');
    await page.waitForLoadState('domcontentloaded');

    // Username and password fields are present
    await expect(page.locator('[data-test="signin-username"]')).toBeVisible();
    await expect(page.locator('[data-test="signin-password"]')).toBeVisible();
    // Submit button
    await expect(page.locator('[data-test="signin-submit"]')).toBeVisible();
    await expect(page.locator('[data-test="signin-submit"]')).toHaveText(/sign in/i);
    // "Sign up" link is present
    await expect(page.locator('[data-test="signup"]')).toBeVisible();
    // No error message on initial load
    await expect(page.locator('[data-test="signin-error"]')).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 1.2 — Successful login with valid credentials
  // -------------------------------------------------------------------------
  test('1.2 login with valid credentials navigates to home', async ({ page }) => {
    await setupCORSProxy(page);
    await page.goto('/signin');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[name="username"]').fill('Heath93');
    await page.locator('input[name="password"]').fill('s3cret');
    await page.locator('[data-test="signin-submit"]').click();

    await page.waitForURL('**/');

    // Sidenav is shown — user is authenticated
    await expect(page.locator('[data-test="sidenav"]')).toBeVisible();
    await expect(page.locator('[data-test="sidenav-username"]')).toContainText('Heath93');
  });

  // -------------------------------------------------------------------------
  // 1.3 — Wrong password shows error message
  // -------------------------------------------------------------------------
  test('1.3 wrong password shows error and stays on sign-in page', async ({ page }) => {
    await setupCORSProxy(page);
    await page.goto('/signin');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[name="username"]').fill('Heath93');
    await page.locator('input[name="password"]').fill('wrongpassword');
    await page.locator('[data-test="signin-submit"]').click();

    // Error alert is displayed
    await expect(page.locator('[data-test="signin-error"]')).toBeVisible();
    await expect(page.locator('[data-test="signin-error"]')).toContainText(
      /username or password is invalid/i
    );

    // Page stays on sign-in
    await expect(page).toHaveURL(/\/signin/);
  });

  // -------------------------------------------------------------------------
  // 1.4 — Non-existent username shows error
  // -------------------------------------------------------------------------
  test('1.4 non-existent username shows error and stays on sign-in page', async ({ page }) => {
    await setupCORSProxy(page);
    await page.goto('/signin');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[name="username"]').fill('userDoesNotExist99999');
    await page.locator('input[name="password"]').fill('s3cret');
    await page.locator('[data-test="signin-submit"]').click();

    await expect(page.locator('[data-test="signin-error"]')).toBeVisible();
    await expect(page.locator('[data-test="signin-error"]')).toContainText(
      /username or password is invalid/i
    );
    await expect(page).toHaveURL(/\/signin/);
  });

  // -------------------------------------------------------------------------
  // 1.5 — Sign-up link is present and the /signup route renders the registration form
  // -------------------------------------------------------------------------
  test('1.5 sign-up link is present and /signup route renders the registration form', async ({
    page,
  }) => {
    await page.goto('/signin');
    await page.waitForLoadState('domcontentloaded');

    // The sign-up link exists with the correct href
    const signupLink = page.locator('[data-test="signup"]');
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute('href', '/signup');

    // Navigating directly to /signup renders the registration form
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-test="signup-title"]')).toBeVisible();
    await expect(page.locator('[data-test="signup-submit"]')).toBeVisible();
  });
});
