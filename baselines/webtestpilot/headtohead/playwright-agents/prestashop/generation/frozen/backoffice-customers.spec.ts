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

async function goToCustomers(page: any) {
  await page.goto(`${BO_URL}index.php?controller=AdminCustomers`);
  // PrestaShop uses "Manage your Customers" as the H1
  await expect(
    page.getByRole('heading', { name: /Customers/i, level: 1 })
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

test.describe('BO-CUST — Customers', () => {
  test('BO-CUST-01 — Customers list shows seed accounts', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCustomers(page);

    const thead = page.locator('table thead');
    await expect(thead).toContainText('First name');
    await expect(thead).toContainText('Last name');
    await expect(thead).toContainText('Email address');

    const tbody = page.locator('table tbody');
    await expect(tbody).toContainText('auto.customer@example.com');
    await expect(tbody).toContainText('pub@prestashop.com');

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('BO-CUST-02 — View customer profile for John DOE', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php/sell/customers/2/view`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/sell\/customers\/2\/view/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('J. DOE');

    // Sections visible on the profile page
    for (const section of ['Orders', 'Carts', 'Addresses']) {
      await expect(
        page.getByRole('heading', { name: section })
          .or(page.locator('.card-header').filter({ hasText: section }))
      ).toBeVisible();
    }

    // The orders section should mention 5 orders
    await expect(page.locator('body')).toContainText('5');
  });

  test('BO-CUST-03 — Create a new customer', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCustomers(page);

    await page.getByRole('link', { name: /Add new customer/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Social title: Mr.
    await page.locator('input[name="customer[id_gender]"][value="1"]').click();

    await page.getByLabel(/First name/i).fill('Test');
    await page.getByLabel(/Last name/i).fill('User');

    const emailInput = page.getByLabel(/Email address/i);
    await emailInput.fill('test.auto.new@example.com');

    await page.getByLabel(/^Password/i).fill('Passw0rd!');

    // Ensure enabled is Yes
    const enabledToggle = page.locator('input[name="customer[active]"][value="1"]');
    if (await enabledToggle.count() > 0) {
      await enabledToggle.click();
    }

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to list or customer view
    await expect(page.locator('.alert-success')).toBeVisible();
    await expect(page.locator('body')).toContainText('test.auto.new@example.com');
  });

  test('BO-CUST-04 — Edit customer last name for Auto Customer', async ({ page }) => {
    await loginToBackOffice(page);
    await goToCustomers(page);

    // Find the Auto Customer row and click edit
    const autoRow = page.locator('table tbody tr').filter({ hasText: 'auto.customer@example.com' });
    await autoRow.getByRole('link', { name: /Edit/i }).click();
    await page.waitForLoadState('domcontentloaded');

    const lastNameInput = page.getByLabel(/Last name/i);
    await lastNameInput.clear();
    await lastNameInput.fill('CustomerEdited');

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();

    // Customers list should show the updated name
    await goToCustomers(page);
    await expect(page.locator('table tbody')).toContainText('CustomerEdited');

    // Restore original last name
    const editedRow = page.locator('table tbody tr').filter({ hasText: 'CustomerEdited' });
    await editedRow.getByRole('link', { name: /Edit/i }).click();
    await page.waitForLoadState('domcontentloaded');
    const restoreInput = page.getByLabel(/Last name/i);
    await restoreInput.clear();
    await restoreInput.fill('Customer');
    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');
  });

  test('BO-CUST-06 — Add a private note to customer profile', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php/sell/customers/2/view`);
    await page.waitForLoadState('domcontentloaded');

    const noteText = `Private note auto ${Date.now()}`;
    const textarea = page.locator('textarea[name="private_note"]')
      .or(page.locator('textarea').filter({ hasText: '' }).first());
    await textarea.fill(noteText);

    await page.getByRole('button', { name: /Save note/i })
      .or(page.getByRole('button', { name: /Save/i }).last())
      .click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();

    // Reload and confirm persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('textarea[name="private_note"]')
      .or(page.locator('textarea').filter({ hasText: '' }).first())
    ).toContainText(noteText.substring(0, 20));
  });
});
