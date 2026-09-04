import { test, expect } from '@playwright/test';

const BO_URL = 'http://localhost:8083/webtestpilot/';
const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'admin12345';

async function loginToBackOffice(page: any) {
  await page.goto(BO_URL);
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Log in/i }).click();
  await page.waitForURL(/controller=AdminDashboard/);
}

async function goToCartRules(page: any) {
  await page.goto(`${BO_URL}index.php?controller=AdminCartRules`);
  await expect(page.getByRole('heading', { name: /Cart Rules/i, level: 1 })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Promotions — Cart Rules
// ---------------------------------------------------------------------------

test.describe('BO-PROMO — Cart Rules', () => {
  test('BO-PROMO-01 — Cart rules list is empty by default', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCartRules(page);

    const thead = page.locator('table thead');
    await expect(thead).toContainText('Name');
    await expect(thead).toContainText('Code');
    await expect(thead).toContainText('Status');

    // Seed data has no cart rules — expect empty state message
    await expect(page.locator('body')).toContainText(/No records found/i);
  });

  test('BO-PROMO-02 — Create a percentage discount cart rule SUMMER10', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCartRules(page);

    await page.getByRole('link', { name: /Add new cart rule/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // --- Information tab ---
    await page.getByLabel(/Name/i).first().fill('SUMMER10');

    const codeInput = page.getByLabel(/Code/i);
    await codeInput.fill('SUMMER10');

    // Ensure Active is Yes
    const activeYes = page.locator('input[name="cart_rule[active]"][value="1"]')
      .or(page.locator('input#active_on'));
    if (await activeYes.count() > 0) {
      await activeYes.click();
    }

    // --- Conditions tab ---
    await page.getByRole('link', { name: /Conditions/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Minimum purchase amount = 0 (leave default or set explicitly)
    const minAmountInput = page.locator('input[name="cart_rule[minimum_amount]"]');
    if (await minAmountInput.count() > 0) {
      await minAmountInput.fill('0');
    }

    // --- Actions tab ---
    await page.getByRole('link', { name: /Actions/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Select Percent discount type
    await page.locator('select[name="cart_rule[reduction_percent_type]"]')
      .or(page.getByLabel(/Discount type/i))
      .selectOption({ label: /Percent/i });

    const percentInput = page.locator('input[name="cart_rule[reduction_percent]"]')
      .or(page.getByLabel(/Discount value/i));
    await percentInput.fill('10');

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();

    // Navigate to list and verify the rule appears
    await goToCartRules(page);
    const tbody = page.locator('table tbody');
    await expect(tbody).toContainText('SUMMER10');

    // Code column should show SUMMER10
    const ruleRow = page.locator('table tbody tr').filter({ hasText: 'SUMMER10' });
    await expect(ruleRow).toContainText('SUMMER10');
  });

  test('BO-PROMO-03 — Create a fixed-amount discount cart rule FIXED5', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCartRules(page);

    await page.getByRole('link', { name: /Add new cart rule/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByLabel(/Name/i).first().fill('FIXED5');
    await page.getByLabel(/Code/i).fill('FIXED5');

    // Actions tab
    await page.getByRole('link', { name: /Actions/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('select[name="cart_rule[reduction_percent_type]"]')
      .or(page.getByLabel(/Discount type/i))
      .selectOption({ label: /Amount/i });

    const amountInput = page.locator('input[name="cart_rule[reduction_amount]"]')
      .or(page.getByLabel(/Discount value/i));
    await amountInput.fill('5');

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();

    await goToCartRules(page);
    await expect(page.locator('table tbody')).toContainText('FIXED5');
  });

  test('BO-PROMO-04 — Disable a cart rule', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCartRules(page);

    // Find a rule that is currently enabled and toggle it off
    const ruleRow = page.locator('table tbody tr').first();
    const statusToggle = ruleRow.locator('.list-action-enable, input[name*="active"]');

    // Click the enabled badge/toggle to flip to disabled
    await statusToggle.click();
    await page.waitForLoadState('domcontentloaded');

    // After toggle the status cell should reflect disabled
    await expect(ruleRow.locator('td')).toContainText(/No|0|Disabled/i);
  });

  test('BO-PROMO-05 — Delete a cart rule', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCartRules(page);

    // Pick the first available rule
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const firstRow = rows.first();
    const ruleName = (await firstRow.locator('td').nth(1).textContent() || '').trim();

    // Click delete for this row
    await firstRow.getByRole('link', { name: /Delete/i }).click();

    // Accept confirm dialog
    await page.getByRole('button', { name: /OK|Yes|Confirm/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Rule should no longer appear
    await expect(page.locator('table tbody')).not.toContainText(ruleName);
  });
});
