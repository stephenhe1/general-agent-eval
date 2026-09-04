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

async function goToProducts(page: any) {
  // In PrestaShop 8, controller=AdminProducts triggers a file download.
  // Use the new-style route by extracting the token-bearing href from the sidebar.
  const productsHref: string | null = await page.evaluate(() => {
    const links = document.querySelectorAll<HTMLAnchorElement>('#nav-sidebar a');
    for (const l of links) {
      if (l.href.includes('/sell/catalog/products')) return l.href;
    }
    return null;
  });
  // productsHref always resolves when already logged in
  await page.goto(productsHref!);
  await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
}

/**
 * Navigate to the edit page for a product by its ID.
 * Direct navigation without a _token fails CSRF check; we navigate via
 * the products list which carries the token in the edit link href.
 */
async function goToProductEdit(page: any, productId: number) {
  await goToProducts(page);
  // Find the edit link for the specific product ID and click it
  const editLink = page.locator(`table tbody tr a[href*="/products-v2/${productId}/edit"]`).first();
  const href = await editLink.getAttribute('href');
  await page.goto(href!);
  await page.waitForLoadState('domcontentloaded');
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

test.describe('BO-PROD — Products', () => {
  test('BO-PROD-01 — Products list renders seed catalog', async ({ page }) => {
    await loginToBackOffice(page);
    await goToProducts(page);

    const thead = page.locator('table thead');
    await expect(thead).toContainText('Name');
    await expect(thead).toContainText('Reference');
    await expect(thead).toContainText('Category');
    await expect(thead).toContainText('Price');
    await expect(thead).toContainText('Quantity');

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    // Seed data has 19 products
    expect(count).toBeGreaterThanOrEqual(19);

    // Row for "Customizable mug" exists
    await expect(page.locator('table tbody')).toContainText('Customizable mug');
    await expect(page.locator('table tbody')).toContainText('demo_14');
    await expect(page.locator('table tbody')).toContainText('Home Accessories');
  });

  test('BO-PROD-02 — Filter products by category "Stationery"', async ({ page }) => {
    await loginToBackOffice(page);
    await goToProducts(page);

    // Category filter is a text input in PS8 products-v2 grid
    const categoryFilter = page.locator('#product_category');
    await categoryFilter.fill('Stationery');
    await page.locator('button.grid-search-button').click();
    await page.waitForLoadState('domcontentloaded');

    const tbody = page.locator('table tbody');
    await expect(tbody).toContainText('Hummingbird notebook');
    await expect(tbody).toContainText('Brown bear notebook');

    // Every row should be in Stationery only
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('Stationery');
    }
  });

  test('BO-PROD-03 — Edit product #19 name', async ({ page }) => {
    await loginToBackOffice(page);
    await goToProductEdit(page, 19);

    // Change the product name (English locale field)
    const nameInput = page.locator('input[name="product[header][name][1]"]');
    await nameInput.clear();
    await nameInput.fill('Customizable Mug (edited)');

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();

    // Navigate back to products list and verify the name
    await goToProducts(page);
    await expect(page.locator('table tbody')).toContainText('Customizable Mug (edited)');

    // Restore original name to avoid polluting other tests
    await goToProductEdit(page, 19);
    const nameInputRestore = page.locator('input[name="product[header][name][1]"]');
    await nameInputRestore.clear();
    await nameInputRestore.fill('Customizable mug');
    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');
  });

  test('BO-PROD-04 — Toggle product status off for Customizable mug', async ({ page }) => {
    await loginToBackOffice(page);
    await goToProducts(page);

    // Find the row for Customizable mug
    const mugRow = page.locator('table tbody tr').filter({ hasText: 'Customizable mug' });
    await expect(mugRow).toBeVisible();

    // Disable: click the "Off" (value=0) radio inside the ps-switch toggle
    const offRadio = mugRow.locator('.ps-switch input[value="0"]');
    await offRadio.click();
    await page.waitForLoadState('networkidle');

    // Confirm the "Off" radio is now checked (product is disabled)
    await expect(offRadio).toBeChecked();

    // Re-enable to keep state clean for subsequent tests
    const onRadio = mugRow.locator('.ps-switch input[value="1"]');
    await onRadio.click();
    await page.waitForLoadState('networkidle');
    await expect(onRadio).toBeChecked();
  });

  test('BO-PROD-05 — Create a new simple product', async ({ page }) => {
    await loginToBackOffice(page);
    await goToProducts(page);

    await page.getByRole('link', { name: /New product/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // PS8 shows a product type selection step with button choices and a submit button.
    // "Standard product" button is pre-selected; click "Add new product" to proceed.
    const addNewProductBtn = page.getByRole('button', { name: /Add new product/i });
    if (await addNewProductBtn.count() > 0) {
      await addNewProductBtn.click();
      await page.waitForLoadState('domcontentloaded');
    }

    // Fill product name (visible on the default Description tab)
    const nameInput = page.locator('input[name="product[header][name][1]"]');
    await nameInput.clear();
    await nameInput.fill('Test Product Auto');

    // Fill reference (on the Details tab)
    await page.locator('a[href="#product_details-tab"]').click();
    await page.waitForTimeout(300);
    const refInput = page.locator('input[name="product[details][references][reference]"]');
    await refInput.fill('TEST-AUTO-001');

    // Fill price (tax excl.) — on the Pricing tab
    await page.locator('a[href="#product_pricing-tab"]').click();
    await page.waitForTimeout(300);
    // PS8 uses product[pricing][retail_price][price_tax_excluded]
    const priceInput = page.locator(
      'input[name="product[pricing][retail_price][price_tax_excluded]"]'
    );
    await priceInput.fill('9.99');

    // Fill stock quantity — on the Stocks tab
    await page.locator('a[href="#product_stock-tab"]').click();
    await page.waitForTimeout(300);
    const qtyInput = page.locator('input[name="product[stock][quantities][delta_quantity][delta]"]');
    await qtyInput.fill('10');

    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success')).toBeVisible();
    await expect(page).toHaveURL(/\/products-v2\/\d+\/edit/);

    // Navigate to products list and verify the new product is listed
    await goToProducts(page);
    await expect(page.locator('table tbody')).toContainText('Test Product Auto');
  });

  test('BO-PROD-06 — Product edit form tabs are all accessible for product #19', async ({ page }) => {
    await loginToBackOffice(page);
    await goToProductEdit(page, 19);

    // Key tabs / sections should be present
    for (const tab of ['Description', 'Details', 'Pricing', 'Stock']) {
      await expect(
        page.getByRole('link', { name: tab }).or(page.getByRole('tab', { name: tab }))
      ).toBeVisible();
    }

    // Key form fields must be present
    await expect(page.locator('input[name="product[header][name][1]"]')).toBeVisible();
    await expect(
      page.locator('input[name="product[details][references][reference]"]')
    ).toBeVisible();
  });
});
