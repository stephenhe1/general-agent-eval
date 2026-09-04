import { test, expect } from '@playwright/test';

/**
 * User Onboarding area — scenarios 6.1 through 6.4
 *
 * Onboarding is shown to newly-registered users who have not yet created a
 * bank account.  Each test creates a fresh user via the REST API so the
 * onboarding wizard always starts from scratch.
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

/** Register a new user and log in as them.  Returns the generated username. */
async function registerAndLogin(page: any): Promise<string> {
  await setupCORSProxy(page);

  const username = `onboard_${Date.now()}`;

  // Create user via API (bypasses CORS entirely — this is a server-side request)
  const resp = await page.request.post('http://localhost:3001/users', {
    data: {
      firstName: 'New',
      lastName: 'User',
      username,
      password: 'testpass123',
      confirmPassword: 'testpass123',
    },
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
    },
  });
  expect(resp.status()).toBe(201);

  await page.goto('/signin');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill('testpass123');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL('**/');
  await page.waitForTimeout(500);

  return username;
}

test.describe('User Onboarding', () => {
  // -------------------------------------------------------------------------
  // 6.1 — Onboarding dialog is shown to new users after first sign-in
  // -------------------------------------------------------------------------
  test('6.1 onboarding dialog appears for a new user', async ({ page }) => {
    await registerAndLogin(page);

    // Dialog with welcome message is visible
    await expect(page.locator('[data-test="user-onboarding-dialog"]')).toBeVisible();
    await expect(page.locator('[data-test="user-onboarding-dialog-title"]')).toBeVisible();
    await expect(page.locator('[data-test="user-onboarding-dialog-content"]')).toBeVisible();
    await expect(page.locator('[data-test="user-onboarding-next"]')).toBeVisible();
    await expect(page.locator('[data-test="user-onboarding-logout"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6.2 — Clicking "Next" on step 1 advances to the bank-account creation form
  // -------------------------------------------------------------------------
  test('6.2 clicking Next on welcome step shows bank account creation form', async ({
    page,
  }) => {
    await registerAndLogin(page);

    await page.locator('[data-test="user-onboarding-next"]').click();
    await page.waitForTimeout(500);

    // Bank account form fields are shown inside the dialog
    await expect(page.locator('[data-test="bankaccount-form"]')).toBeVisible();
    await expect(page.locator('[data-test="bankaccount-bankName-input"]')).toBeVisible();
    await expect(page.locator('[data-test="bankaccount-routingNumber-input"]')).toBeVisible();
    await expect(page.locator('[data-test="bankaccount-accountNumber-input"]')).toBeVisible();
    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6.3 — Completing the bank-account form advances to the final step
  // -------------------------------------------------------------------------
  test('6.3 completing bank account form advances to the final step', async ({ page }) => {
    await registerAndLogin(page);

    // Step 1 — welcome
    await page.locator('[data-test="user-onboarding-next"]').click();
    await page.waitForTimeout(500);

    // Step 2 — bank account form (MUI TextField wrappers need input child)
    await page.locator('[data-test="bankaccount-bankName-input"] input').fill('First National');
    await page.locator('[data-test="bankaccount-routingNumber-input"] input').fill('021000021');
    await page.locator('[data-test="bankaccount-accountNumber-input"] input').fill('123456789');
    await page.locator('[data-test="bankaccount-submit"]').click();
    await page.waitForTimeout(1000);

    // After submission the dialog stays open for the final congratulations step
    await expect(page.locator('[data-test="user-onboarding-dialog"]')).toBeVisible();
    // The "Next" button is still present on the third step
    await expect(page.locator('[data-test="user-onboarding-next"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6.4 — Completing all steps dismisses the onboarding dialog
  // -------------------------------------------------------------------------
  test('6.4 completing all onboarding steps dismisses the dialog', async ({ page }) => {
    await registerAndLogin(page);

    // Step 1
    await page.locator('[data-test="user-onboarding-next"]').click();
    await page.waitForTimeout(500);

    // Step 2 — bank account
    await page.locator('[data-test="bankaccount-bankName-input"] input').fill('First National');
    await page.locator('[data-test="bankaccount-routingNumber-input"] input').fill('021000021');
    await page.locator('[data-test="bankaccount-accountNumber-input"] input').fill('123456789');
    await page.locator('[data-test="bankaccount-submit"]').click();
    await page.waitForTimeout(1000);

    // Step 3 — congratulations: click Next to close
    await page.locator('[data-test="user-onboarding-next"]').click();
    await page.waitForTimeout(1000);

    // Dialog is no longer visible
    await expect(page.locator('[data-test="user-onboarding-dialog"]')).not.toBeVisible();

    // The home page is still accessible
    await expect(page.locator('[data-test="sidenav"]')).toBeVisible();
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible();
  });
});
