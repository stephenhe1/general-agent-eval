import { test, expect } from '@playwright/test';
import { BASE_URL, enableCORSForBackend } from './helpers';

/** Create a new user via signup UI (requires CORS to be enabled first) */
async function createAndSignInNewUser(page: any): Promise<string> {
  const uniqueUsername = `onboard${Date.now()}`;

  await page.goto(`${BASE_URL}/signup`);
  // SignUpForm: data-test on TextField wrapper div → need ' input' suffix
  await page.locator('[data-test="signup-first-name"] input').fill('Onboard');
  await page.locator('[data-test="signup-last-name"] input').fill('User');
  await page.locator('[data-test="signup-username"] input').fill(uniqueUsername);
  await page.locator('[data-test="signup-password"] input').fill('s3cret');
  await page.locator('[data-test="signup-confirmPassword"] input').fill('s3cret');
  await expect(page.locator('[data-test="signup-submit"]')).toBeEnabled({ timeout: 5000 });
  await page.locator('[data-test="signup-submit"]').click();

  // Signup pushes to /signin
  await page.waitForURL((url) => url.href.includes('/signin'), { timeout: 20000 });

  // Sign in with the new user credentials
  await page.locator('[data-test="signin-username"] input').fill(uniqueUsername);
  await page.locator('[data-test="signin-password"] input').fill('s3cret');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL((url) => !url.href.includes('/signin'), { timeout: 20000 });

  return uniqueUsername;
}

test.describe('User Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    // Enable CORS for all API requests (signup/signin need it)
    await enableCORSForBackend(page);
  });

  test('new user sees onboarding dialog after signup', async ({ page }) => {
    await createAndSignInNewUser(page);

    // The onboarding dialog should appear for new users (no bank accounts)
    await expect(page.locator('[data-test="user-onboarding-dialog"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-test="user-onboarding-dialog-title"]')).toBeVisible();
    await expect(page.locator('[data-test="user-onboarding-dialog-content"]')).toBeVisible();
  });

  test('onboarding - complete bank account creation step', async ({ page }) => {
    await createAndSignInNewUser(page);

    // Onboarding dialog appears
    await expect(page.locator('[data-test="user-onboarding-dialog"]')).toBeVisible({ timeout: 15000 });

    // Click Next to move past intro step
    await page.locator('[data-test="user-onboarding-next"]').click();

    // Bank account form appears in the dialog
    await expect(page.locator('[data-test="bankaccount-form"]')).toBeVisible({ timeout: 10000 });

    // BankAccountForm: data-test on TextField wrapper → need ' input' suffix
    const bankName = `Onboard Bank ${Date.now()}`;
    await page.locator('[data-test="bankaccount-bankName-input"] input').fill(bankName);
    await page.locator('[data-test="bankaccount-routingNumber-input"] input').fill('021000021');
    await page.locator('[data-test="bankaccount-accountNumber-input"] input').fill('9876543210');

    // Submit the bank account form
    await page.locator('[data-test="bankaccount-submit"]').click();

    // Should advance to completion step - next button should appear
    await expect(page.locator('[data-test="user-onboarding-next"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-test="user-onboarding-next"]').click();

    // Dialog should close after completion
    await expect(page.locator('[data-test="user-onboarding-dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Navigate to bank accounts and verify the account was created
    await page.goto(`${BASE_URL}/bankaccounts`);
    await expect(page.locator('[data-test="bankaccount-list"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(bankName)).toBeVisible({ timeout: 10000 });
  });
});
