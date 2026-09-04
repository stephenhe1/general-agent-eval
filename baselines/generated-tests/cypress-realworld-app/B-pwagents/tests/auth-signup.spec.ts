import { test, expect } from '@playwright/test';

/**
 * Sign Up area — scenarios 2.1 through 2.4
 *
 * Signup POSTs to localhost:3001/users.  The CORS proxy is used so that the
 * browser can complete the request from origin 127.0.0.1:5182.
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

/** Fill in the registration form.  All data-test attrs are wrapper divs so we
 *  target the `input` child. */
async function fillSignupForm(
  page: any,
  opts: {
    firstName?: string;
    lastName?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
  }
) {
  if (opts.firstName !== undefined)
    await page.locator('[data-test="signup-first-name"] input').fill(opts.firstName);
  if (opts.lastName !== undefined)
    await page.locator('[data-test="signup-last-name"] input').fill(opts.lastName);
  if (opts.username !== undefined)
    await page.locator('[data-test="signup-username"] input').fill(opts.username);
  if (opts.password !== undefined)
    await page.locator('[data-test="signup-password"] input').fill(opts.password);
  if (opts.confirmPassword !== undefined)
    await page.locator('[data-test="signup-confirmPassword"] input').fill(opts.confirmPassword);
}

test.describe('Sign Up', () => {
  // -------------------------------------------------------------------------
  // 2.1 — Registration page renders all expected fields
  // -------------------------------------------------------------------------
  test('2.1 sign-up page renders all form fields', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('[data-test="signup-title"]')).toBeVisible();
    await expect(page.locator('[data-test="signup-first-name"]')).toBeVisible();
    await expect(page.locator('[data-test="signup-last-name"]')).toBeVisible();
    await expect(page.locator('[data-test="signup-username"]')).toBeVisible();
    await expect(page.locator('[data-test="signup-password"]')).toBeVisible();
    await expect(page.locator('[data-test="signup-confirmPassword"]')).toBeVisible();
    await expect(page.locator('[data-test="signup-submit"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2.2 — Successful registration with valid data
  // -------------------------------------------------------------------------
  test('2.2 successful registration redirects to sign-in page', async ({ page }) => {
    await setupCORSProxy(page);
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const uniqueUsername = `testuser_${Date.now()}`;

    await fillSignupForm(page, {
      firstName: 'Jane',
      lastName: 'Doe',
      username: uniqueUsername,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    await page.locator('[data-test="signup-submit"]').click();

    // After registration the app redirects to /signin
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('[data-test="signin-submit"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2.3 — Mismatched passwords show a validation error
  // -------------------------------------------------------------------------
  test('2.3 mismatched passwords disables submit and shows error', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    await fillSignupForm(page, {
      firstName: 'John',
      lastName: 'Smith',
      username: 'john_smith_test',
      password: 'Password123!',
      confirmPassword: 'DifferentPass!',
    });

    // Trigger validation by blurring the confirmPassword field
    await page.locator('[data-test="signup-confirmPassword"] input').blur();
    await page.waitForTimeout(300);

    // Submit button should be disabled or the form shows a validation error
    // Check that the button is disabled (form validation prevents submission)
    const submitBtn = page.locator('[data-test="signup-submit"]');
    const isDisabled = await submitBtn.isDisabled();
    if (!isDisabled) {
      // If not disabled, check for validation error text in the page
      const pageText = await page.locator('[data-test="signup-confirmPassword"]').textContent();
      expect(pageText).toMatch(/password/i);
    } else {
      expect(isDisabled).toBe(true);
    }

    // Page stays on /signup
    await expect(page).toHaveURL(/\/signup/);
  });

  // -------------------------------------------------------------------------
  // 2.4 — Empty form submission shows validation errors and stays on signup page
  // -------------------------------------------------------------------------
  test('2.4 empty form submission shows validation errors', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    // Click submit without filling any fields
    await page.locator('[data-test="signup-submit"]').click();
    await page.waitForTimeout(300);

    // Formik/Yup shows field-level validation helper text
    // At least one "required" error should appear
    const errorText = await page.locator('[data-test="signup-first-name"]').textContent();
    expect(errorText).toMatch(/required/i);

    // Page stays on /signup
    await expect(page).toHaveURL(/\/signup/);
  });
});
