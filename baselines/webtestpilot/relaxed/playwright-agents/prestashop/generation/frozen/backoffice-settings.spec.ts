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

// ---------------------------------------------------------------------------
// Settings — Shop Parameters
// ---------------------------------------------------------------------------

test.describe('BO-SETTINGS — Shop Parameters', () => {
  test('BO-SETTINGS-01 — General preferences page loads', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminPreferences`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Preferences', level: 1 })).toBeVisible();

    // Required form fields / toggles
    for (const label of ['Enable SSL', 'Increase security']) {
      const field = page.getByText(label, { exact: false });
      await expect(field.first()).toBeVisible();
    }

    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
  });

  test('BO-SETTINGS-02 — Order settings page loads', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminOrderPreferences`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Order settings/i, level: 1 })).toBeVisible();

    // Required toggles
    for (const label of ['Enable final summary', 'guest checkout', 'reordering']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('BO-SETTINGS-03 — Product settings page loads', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminPprefs`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Product Settings/i, level: 1 })).toBeVisible();

    for (const label of ['Catalog mode', 'Show prices', 'Number of days']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('BO-SETTINGS-04 — Customer settings page loads', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminCustomerPreferences`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Customers/i, level: 1 })).toBeVisible();

    for (const label of ['Redisplay cart at login', 'Send email after registration', 'B2B mode']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('BO-SETTINGS-05 — Save a settings change and verify persistence', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminPreferences`);
    await page.waitForLoadState('domcontentloaded');

    // Find the "Increase front office security" toggle and read its current state
    // PrestaShop uses ps_switch / radio pairs for Yes / No
    const yesRadio = page.locator('input[name="PS_USE_HTMLPURIFIER"][value="1"]')
      .or(page.locator('input[id="PS_TOKEN_ENABLE_on"]'));
    const noRadio = page.locator('input[name="PS_USE_HTMLPURIFIER"][value="0"]')
      .or(page.locator('input[id="PS_TOKEN_ENABLE_off"]'));

    const isYesChecked = await yesRadio.first().isChecked().catch(() => false);

    // Toggle to the opposite value
    if (isYesChecked) {
      await noRadio.first().click();
    } else {
      await yesRadio.first().click();
    }

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();

    // Reload and assert toggle is still at the changed value
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    if (isYesChecked) {
      await expect(noRadio.first()).toBeChecked();
    } else {
      await expect(yesRadio.first()).toBeChecked();
    }

    // Restore the original setting
    if (isYesChecked) {
      await yesRadio.first().click();
    } else {
      await noRadio.first().click();
    }
    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');
  });
});

// ---------------------------------------------------------------------------
// Customer Service
// ---------------------------------------------------------------------------

test.describe('BO-CS — Customer Service', () => {
  test('BO-CS-01 — Customer service threads list loads', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminCustomerThreads`);
    await page.waitForLoadState('domcontentloaded');

    // H1 contains "Customer Service" or "Customer Threads"
    await expect(
      page.getByRole('heading', { level: 1 }).filter({ hasText: /Customer/i })
    ).toBeVisible();

    // No server error
    await expect(page).not.toHaveTitle(/Error/i);
  });

  test('BO-CS-02 — Order messages list loads', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminOrderMessage`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).not.toHaveTitle(/Error/i);
    // The page renders without a fatal error
    await expect(page.locator('h1, .page-title')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Team / Employees
// ---------------------------------------------------------------------------

test.describe('BO-TEAM — Team / Employees', () => {
  test('BO-TEAM-01 — Employee list shows admin account', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminEmployees`);
    await page.waitForLoadState('domcontentloaded');

    // At least one row (the admin account)
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Table should show email / profile info
    await expect(page.locator('table tbody')).toContainText('admin@admin.com');
  });

  test('BO-TEAM-02 — Edit own employee profile form fields are present', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminEmployees`);
    await page.waitForLoadState('domcontentloaded');

    // Click edit on the first employee (admin)
    await page.locator('table tbody tr').first().getByRole('link', { name: /Edit/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // H1 should say "Edit: ..."
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Edit/i);

    // Required form fields
    await expect(page.locator('input[name="employee[firstname]"]')).toBeVisible();
    await expect(page.locator('input[name="employee[lastname]"]')).toBeVisible();
    await expect(page.locator('input[name="employee[email]"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('BO-NAV — Navigation', () => {
  test('BO-NAV-01 — Sidebar sections expand correctly', async ({ page }) => {
    await loginToBackOffice(page);

    const sidebar = page.locator('#nav-sidebar');

    // Orders section expands to show sub-links
    await sidebar.getByRole('link', { name: /^Orders$/i }).first().click();
    await expect(sidebar.getByRole('link', { name: /^Invoices$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^Shopping Carts$/i })).toBeVisible();

    // Catalog section
    await sidebar.getByRole('link', { name: /^Catalog$/i }).first().click();
    await expect(sidebar.getByRole('link', { name: /^Products$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^Categories$/i })).toBeVisible();

    // Customers section
    await sidebar.getByRole('link', { name: /^Customers$/i }).first().click();
    await expect(sidebar.getByRole('link', { name: /^Addresses$/i })).toBeVisible();
  });

  test('BO-NAV-02 — Quick Access "New product" navigates correctly', async ({ page }) => {
    await loginToBackOffice(page);

    // Click the Quick Access dropdown in the header
    await page.getByRole('link', { name: /Quick Access/i }).click();
    await page.getByRole('link', { name: /New product/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Should be on a new product creation page
    await expect(page).toHaveURL(/products/i);
  });
});
