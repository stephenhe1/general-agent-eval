import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('company details page shows heading "Company Details"', async ({ page }) => {
    await goto(page, '/settings/company_details');
    await expect(page.getByRole('heading', { name: 'Company Details' })).toBeVisible();
  });

  test('company details shows current company name "Untitled Company"', async ({ page }) => {
    await goto(page, '/settings/company_details');
    // The Company Name field should contain "Untitled Company"
    const companyNameInput = page.getByLabel('Company Name');
    await expect(companyNameInput).toHaveValue('Untitled Company');
  });

  test('company details form has Details, Address, Logo, Defaults tabs', async ({ page }) => {
    await goto(page, '/settings/company_details');
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Address' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Logo' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Defaults' })).toBeVisible();
  });

  test('settings sidebar shows Basic Settings section', async ({ page }) => {
    await goto(page, '/settings/company_details');
    await expect(page.getByText('BASIC SETTINGS')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Company Details' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'User Details' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Localization' })).toBeVisible();
  });

  test('user details settings page loads', async ({ page }) => {
    await goto(page, '/settings/user_details');
    await expect(page.getByRole('heading', { name: 'User Details' })).toBeVisible();
  });

  test('localization settings page loads', async ({ page }) => {
    await goto(page, '/settings/localization');
    await expect(page.getByRole('heading', { name: 'Localization' })).toBeVisible();
  });

  test('payment settings page loads', async ({ page }) => {
    await goto(page, '/settings/payment_settings');
    await page.waitForLoadState('networkidle');
    // Verify we're on a settings page
    expect(page.url()).toContain('/settings');
  });

  test('settings navigation links are all visible', async ({ page }) => {
    await goto(page, '/settings/company_details');
    const settingsLinks = [
      'Company Details', 'User Details', 'Localization',
      'Payment Settings', 'Tax Settings', 'Product Settings',
      'Task Settings', 'Expense Settings', 'Workflow Settings',
      'Account Management',
    ];
    for (const link of settingsLinks) {
      await expect(page.getByRole('link', { name: link })).toBeVisible();
    }
  });

  test('saving company name change updates the value', async ({ page }) => {
    await goto(page, '/settings/company_details');

    const companyNameInput = page.getByLabel('Company Name');
    // Store original value
    const originalValue = await companyNameInput.inputValue();
    expect(originalValue).toBe('Untitled Company');

    // Update the name
    await companyNameInput.clear();
    await companyNameInput.fill('Test Company Name');

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Reload and check new value
    await goto(page, '/settings/company_details');
    await expect(page.getByLabel('Company Name')).toHaveValue('Test Company Name');

    // Restore original value
    await page.getByLabel('Company Name').clear();
    await page.getByLabel('Company Name').fill(originalValue);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
  });
});
