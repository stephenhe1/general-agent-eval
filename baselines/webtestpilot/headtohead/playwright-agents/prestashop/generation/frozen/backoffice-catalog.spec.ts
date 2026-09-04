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
// Categories
// ---------------------------------------------------------------------------

test.describe('BO-CAT — Categories', () => {
  test('BO-CAT-01 — Categories list shows seed data', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminCategories`);

    await expect(page.getByRole('heading', { name: 'Categories', level: 1 })).toBeVisible();

    const thead = page.locator('table thead');
    await expect(thead).toContainText('Name');
    await expect(thead).toContainText('Description');
    await expect(thead).toContainText('Products');

    const tbody = page.locator('table tbody');
    await expect(tbody).toContainText('Clothes');
    await expect(tbody).toContainText('Accessories');
    await expect(tbody).toContainText('Art');

    // At least 3 rows
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('BO-CAT-02 — Create a new category', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminCategories`);

    await page.getByRole('link', { name: /Add new category/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByLabel(/Name/i).fill('Test Category Auto');

    // Parent category = Home (root)
    const parentSelect = page.locator('select[name="id_parent"]');
    await parentSelect.selectOption({ label: /Home/i });

    // Active = Yes
    const activeYes = page.locator('input[name="active"][value="1"]');
    if (await activeYes.count() > 0) {
      await activeYes.click();
    }

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();
    await expect(page.locator('body')).toContainText('Test Category Auto');
  });

  test('BO-CAT-03 — Edit Accessories category description', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminCategories`);

    const accessoriesRow = page.locator('table tbody tr').filter({ hasText: 'Accessories' });
    await accessoriesRow.getByRole('link', { name: /Edit/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // The description may be in a rich-text iframe or a textarea
    const descTextarea = page.locator('textarea[name^="description"]');
    const frameLocator = page.frameLocator('iframe[id*="description"]').locator('body');

    if (await descTextarea.count() > 0) {
      await descTextarea.fill('Updated accessories description for automation test');
    } else {
      // TinyMCE iframe
      await frameLocator.click();
      await page.keyboard.selectAll();
      await page.keyboard.type('Updated accessories description for automation test');
    }

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();
  });

  test('BO-CAT-04 — Delete a throwaway category', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminCategories`);

    // First, create a throwaway category to delete
    await page.getByRole('link', { name: /Add new category/i }).click();
    await page.waitForLoadState('domcontentloaded');

    const throwawayName = `Throwaway Cat ${Date.now()}`;
    await page.getByLabel(/Name/i).fill(throwawayName);
    const parentSelect = page.locator('select[name="id_parent"]');
    await parentSelect.selectOption({ label: /Home/i });
    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Now go back to list and delete it
    await page.goto(`${BO_URL}index.php?controller=AdminCategories`);
    const throwawayRow = page.locator('table tbody tr').filter({ hasText: throwawayName });
    await expect(throwawayRow).toBeVisible();

    // Select the checkbox for this row
    await throwawayRow.locator('input[type="checkbox"]').check();

    // Use bulk action > delete
    const bulkSelect = page.locator('select[name="categoryAction"], #bulk-action-select');
    await bulkSelect.selectOption({ label: /Delete/i });

    await page.getByRole('button', { name: /Apply/i }).click();

    // Confirm the dialog if present
    page.on('dialog', dialog => dialog.accept());
    await page.waitForLoadState('domcontentloaded');

    // Row should be gone
    await expect(page.locator('table tbody')).not.toContainText(throwawayName);
  });
});

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

test.describe('BO-BRAND — Brands', () => {
  test('BO-BRAND-01 — Brands list shows seed data', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminManufacturers`);

    await expect(page.getByRole('heading', { name: 'Brands', level: 1 })).toBeVisible();

    const tbody = page.locator('table tbody');
    await expect(tbody).toContainText('Graphic Corner');
    await expect(tbody).toContainText('Studio Design');

    const thead = page.locator('table thead');
    await expect(thead).toContainText('Name');
    await expect(thead).toContainText('Products');
  });

  test('BO-BRAND-02 — Create a new brand', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminManufacturers`);

    await page.getByRole('link', { name: /Add new brand/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByLabel(/Name/i).fill('Auto Brand Test');

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();

    // Verify brand appears in the list
    await page.goto(`${BO_URL}index.php?controller=AdminManufacturers`);
    await expect(page.locator('table tbody')).toContainText('Auto Brand Test');
  });
});

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

test.describe('BO-STOCK — Stock Management', () => {
  test('BO-STOCK-01 — Stock page loads with product inventory', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminStockManagement`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Stock', level: 1 })).toBeVisible();

    // At least one product row is present
    const rows = page.locator('table tbody tr, .stock-overview-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('BO-STOCK-02 — Edit product quantity for Customizable mug', async ({ page }) => {
    await loginToBackOffice(page);
    await page.goto(`${BO_URL}index.php?controller=AdminStockManagement`);
    await page.waitForLoadState('domcontentloaded');

    // Search for the Customizable mug
    const searchInput = page.getByRole('textbox', { name: /search/i });
    await searchInput.fill('Customizable mug');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('domcontentloaded');

    // Find the row and note current quantity
    const mugRow = page.locator('table tbody tr').filter({ hasText: 'Customizable mug' }).first();
    const availableCell = mugRow.locator('td').nth(7); // Available column (0-indexed)
    const initialQty = parseInt((await availableCell.textContent() || '0').trim(), 10);

    // Click edit / update quantity
    const deltaInput = mugRow.locator('input[type="number"], input.edit-quantity');
    await deltaInput.fill('5');
    await mugRow.getByRole('button', { name: /Apply/i })
      .or(mugRow.getByRole('button', { name: /Confirm/i }))
      .click();
    await page.waitForLoadState('domcontentloaded');

    // Available quantity should have increased by 5
    const updatedQty = parseInt((await availableCell.textContent() || '0').trim(), 10);
    expect(updatedQty).toBe(initialQty + 5);
  });
});
