import { test, expect } from '@playwright/test';

test.use({
  launchOptions: {
    args: ['--disable-web-security'],
  },
});

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/signin');
  await page.locator('input[name="username"]').fill('Heath93');
  await page.locator('input[name="password"]').fill('s3cret');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL('**/');
}

test.describe('Area 3: User Settings', () => {
  test('3.1 User settings page displays current profile values', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="sidenav-user-settings"]').click();
    await expect(page).toHaveURL(/\/user\/settings/);

    // Postconditions
    await expect(page.locator('[data-test="user-settings-form"]')).toBeVisible();
    await expect(page.locator('[data-test="user-settings-firstName-input"]')).toHaveValue('Ted');
    await expect(page.locator('[data-test="user-settings-lastName-input"]')).toHaveValue('Parisian');
    await expect(page.locator('[data-test="user-settings-email-input"]')).toHaveValue('Santos.Runte65@gmail.com');
    await expect(page.locator('[data-test="user-settings-phoneNumber-input"]')).toHaveValue('398-225-9900');
    await expect(page.locator('[data-test="user-settings-submit"]')).toBeVisible();
  });

  test('3.2 Update first name, last name, email, and phone; verify changes persist', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="sidenav-user-settings"]').click();
    await expect(page).toHaveURL(/\/user\/settings/);

    // Clear and update each field
    await page.locator('[data-test="user-settings-firstName-input"]').clear();
    await page.locator('[data-test="user-settings-firstName-input"]').fill('TedUpdated');

    await page.locator('[data-test="user-settings-lastName-input"]').clear();
    await page.locator('[data-test="user-settings-lastName-input"]').fill('ParisianUpdated');

    await page.locator('[data-test="user-settings-email-input"]').clear();
    await page.locator('[data-test="user-settings-email-input"]').fill('updated@example.com');

    await page.locator('[data-test="user-settings-phoneNumber-input"]').clear();
    await page.locator('[data-test="user-settings-phoneNumber-input"]').fill('555-999-0000');

    await page.locator('[data-test="user-settings-submit"]').click();

    // Wait for save
    await page.waitForTimeout(500);

    // Postconditions
    await expect(page.locator('[data-test="sidenav-user-full-name"]')).toContainText('TedUpdated');
    await expect(page.locator('[data-test="user-settings-firstName-input"]')).toHaveValue('TedUpdated');
    await expect(page.locator('[data-test="user-settings-lastName-input"]')).toHaveValue('ParisianUpdated');
    await expect(page.locator('[data-test="user-settings-email-input"]')).toHaveValue('updated@example.com');
    await expect(page.locator('[data-test="user-settings-phoneNumber-input"]')).toHaveValue('555-999-0000');

    // Teardown: Restore original values
    await page.locator('[data-test="user-settings-firstName-input"]').clear();
    await page.locator('[data-test="user-settings-firstName-input"]').fill('Ted');

    await page.locator('[data-test="user-settings-lastName-input"]').clear();
    await page.locator('[data-test="user-settings-lastName-input"]').fill('Parisian');

    await page.locator('[data-test="user-settings-email-input"]').clear();
    await page.locator('[data-test="user-settings-email-input"]').fill('Santos.Runte65@gmail.com');

    await page.locator('[data-test="user-settings-phoneNumber-input"]').clear();
    await page.locator('[data-test="user-settings-phoneNumber-input"]').fill('398-225-9900');

    await page.locator('[data-test="user-settings-submit"]').click();
    await page.waitForTimeout(500);

    // Verify restore succeeded
    await expect(page.locator('[data-test="user-settings-firstName-input"]')).toHaveValue('Ted');
    await expect(page.locator('[data-test="user-settings-lastName-input"]')).toHaveValue('Parisian');
  });

  test('3.3 Save button is disabled and error shown when first name is cleared', async ({ page }) => {
    await signIn(page);

    await page.goto('/user/settings');
    await expect(page.locator('[data-test="user-settings-form"]')).toBeVisible();

    // Clear the first name field
    await page.locator('[data-test="user-settings-firstName-input"]').clear();
    // Move focus away to trigger blur validation
    await page.locator('[data-test="user-settings-lastName-input"]').click();

    // Postconditions
    await expect(
      page.locator('.MuiFormHelperText-root').filter({ hasText: 'Enter a first name' })
    ).toBeVisible();
    await expect(page.locator('[data-test="user-settings-submit"]')).toBeDisabled();

    // Re-entering a first name re-enables the Save button
    await page.locator('[data-test="user-settings-firstName-input"]').fill('Ted');
    await expect(page.locator('[data-test="user-settings-submit"]')).toBeEnabled();
  });

  test('3.4 Save button is disabled and error shown when email is not a valid format', async ({ page }) => {
    await signIn(page);

    await page.goto('/user/settings');
    await expect(page.locator('[data-test="user-settings-form"]')).toBeVisible();

    // Clear email and type an invalid format
    await page.locator('[data-test="user-settings-email-input"]').clear();
    await page.locator('[data-test="user-settings-email-input"]').fill('notanemail');
    // Move focus away to trigger blur validation
    await page.locator('[data-test="user-settings-firstName-input"]').click();

    // Postconditions
    await expect(
      page.locator('.MuiFormHelperText-root').filter({ hasText: 'Must contain a valid email address' })
    ).toBeVisible();
    await expect(page.locator('[data-test="user-settings-submit"]')).toBeDisabled();

    // Correct the email — error clears and button re-enables
    await page.locator('[data-test="user-settings-email-input"]').clear();
    await page.locator('[data-test="user-settings-email-input"]').fill('valid@example.com');
    await page.locator('[data-test="user-settings-firstName-input"]').click();
    await expect(page.locator('[data-test="user-settings-submit"]')).toBeEnabled();
  });
});
