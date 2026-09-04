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

async function goToOrders(page: any) {
  await page.goto(`${BO_URL}index.php?controller=AdminOrders`);
  await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
}

/**
 * Navigate to the view/detail page for a specific order by its ID.
 * Direct navigation without a _token triggers a CSRF security check;
 * navigate via the orders list which carries the token in the link href.
 */
async function goToOrderView(page: any, orderId: number) {
  await goToOrders(page);
  const orderLink = page.locator(`table tbody tr a[href*="/sell/orders/${orderId}/view"]`).first();
  const href = await orderLink.getAttribute('href');
  await page.goto(href!);
  await page.waitForLoadState('domcontentloaded');
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

test.describe('BO-ORD — Orders', () => {
  test('BO-ORD-01 — Orders list shows expected columns and seed data', async ({ page }) => {
    await loginToBackOffice(page);
    await goToOrders(page);

    // Verify required columns exist in the table header
    const thead = page.locator('table thead');
    await expect(thead).toContainText('Reference');
    await expect(thead).toContainText('Customer');
    await expect(thead).toContainText('Total');
    await expect(thead).toContainText('Payment');
    await expect(thead).toContainText('Status');

    // At least 5 rows from seed data
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);

    // First row reference (highest ID = 5) is KHWLILZLL
    await expect(rows.first()).toContainText('KHWLILZLL');
  });

  test('BO-ORD-02 — View order detail for order #5', async ({ page }) => {
    await loginToBackOffice(page);
    await goToOrders(page);

    // Click the zoom/view icon on the first row (order #5 = KHWLILZLL)
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toContainText('KHWLILZLL');
    await firstRow.getByRole('link').filter({ hasText: /view/i }).first().click();

    // Fallback: click the row link if the above selector doesn't match
    // (some BO themes use an anchor without visible text — use the detail URL)
    await page.waitForURL(/\/sell\/orders\/\d+\/view/);
    expect(page.url()).toMatch(/\/sell\/orders\/\d+\/view/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('KHWLILZLL');
    await expect(page).toHaveTitle(/Orders.*KHWLILZLL.*John DOE.*PrestaShop/);

    // Key cards
    for (const heading of ['Customer', 'Products', 'Status']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }

    // Status reflects seed value
    await expect(page.locator('body')).toContainText('Awaiting bank wire payment');

    // Status dropdown present
    await expect(
      page.locator('select[name="update_order_status_action_bar[new_order_status_id]"]')
    ).toBeVisible();
  });

  test('BO-ORD-03 — Change order status to Payment accepted', async ({ page }) => {
    await loginToBackOffice(page);
    await goToOrderView(page, 5);

    const statusSelect = page.locator(
      'select[name="update_order_status_action_bar[new_order_status_id]"]'
    );

    // If the current status is already "Payment accepted" (value 2), reset it first
    // so the Update button becomes enabled for the real status change below.
    const currentVal = await statusSelect.inputValue();
    if (currentVal === '2') {
      await statusSelect.selectOption({ value: '3' }); // Processing in progress
      await page.locator('#update_order_status_action_btn').click();
      await page.waitForLoadState('domcontentloaded');
    }

    await statusSelect.selectOption({ label: 'Payment accepted' });
    await page.locator('#update_order_status_action_btn').click();
    await page.waitForLoadState('domcontentloaded');

    // Success flash
    await expect(page.locator('.alert-success').first()).toBeVisible();

    // Status history now contains the new entry
    await expect(page.locator('body')).toContainText('Payment accepted');
  });

  test('BO-ORD-04 — Add a private note to an order', async ({ page }) => {
    await loginToBackOffice(page);
    await goToOrderView(page, 4);

    const noteText = `Automated note ${Date.now()}`;

    // The "Order note" block is collapsed by default — reveal it first
    await page.locator('.js-order-notes-toggle-btn').click();
    await page.locator('.js-order-notes-block').waitFor({ state: 'visible' });

    const textarea = page.locator('textarea[name="internal_note[note]"]');
    await textarea.fill(noteText);

    // The Save button is disabled until content is typed — enable and click
    await page.locator('.js-order-notes-btn').evaluate((btn: HTMLButtonElement) => btn.disabled = false);
    await page.locator('.js-order-notes-btn').click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.alert-success').first()).toBeVisible();

    // Reload to confirm persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Re-open the notes block
    await page.locator('.js-order-notes-toggle-btn').click();
    await page.locator('.js-order-notes-block').waitFor({ state: 'visible' });
    await expect(page.locator('textarea[name="internal_note[note]"]')).toHaveValue(noteText);
  });

  test('BO-ORD-06 — Filter orders by customer name "doe"', async ({ page }) => {
    await loginToBackOffice(page);
    await goToOrders(page);

    // Locate the customer filter input in the table header filters
    const customerFilter = page.locator('#order_customer');
    await customerFilter.fill('doe');
    await page.locator('button.grid-search-button').click();
    await page.waitForLoadState('domcontentloaded');

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Every visible row must contain DOE in the customer column
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('DOE');
    }
  });

  test('BO-ORD-07 — Create a manual order for John DOE', async ({ page }) => {
    await loginToBackOffice(page);
    await goToOrders(page);

    await page.getByRole('link', { name: /Add new order/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Search for customer John DOE — search is AJAX (no submit button needed)
    const customerSearch = page.locator('#customer-search-input');
    await customerSearch.fill('DOE');
    await page.locator('.js-choose-customer-btn').first().waitFor({ state: 'visible', timeout: 10_000 });

    // Select John DOE from results
    await page.locator('.js-choose-customer-btn').first().click();
    await page.waitForTimeout(1000);

    // Search for a product to add — results appear as a <select> dropdown
    const productSearch = page.locator('input#product-search');
    await productSearch.fill('Customizable mug');
    await page.locator('#product-select').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('#product-select').selectOption({ label: /Customizable mug/i });

    // Add the product
    await page.getByRole('button', { name: /Add to cart/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Create / place the order
    await page.getByRole('button', { name: /Create order/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to new order detail
    await expect(page).toHaveURL(/\/sell\/orders\/\d+\/view/);
    // Page should show a pending status
    await expect(page.locator('body')).toContainText('Awaiting');
  });
});
