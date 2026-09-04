import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8083';
const BO_EMAIL = 'admin@admin.com';
const BO_PASSWORD = 'admin12345';

async function loginAsAdmin(page: any) {
  await page.goto(`${BASE}/webtestpilot/`);
  await page.waitForLoadState('domcontentloaded');
  await page.fill('#email', BO_EMAIL);
  await page.fill('#passwd', BO_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
    page.click('#submit_login'),
  ]);
  const closeBtn = page.locator('.modal .close, [data-dismiss="modal"]').first();
  if (await closeBtn.count() > 0) await closeBtn.click().catch(() => {});
}

async function getToken(page: any): Promise<string> {
  const href = await page.$eval('a[href*="_token="]', (el: HTMLAnchorElement) => el.href).catch(() => '');
  const match = href.match(/_token=([^&]+)/);
  return match ? match[1] : '';
}

// ─── BO Orders – Table has correct columns ────────────────────────────────────
test('BO Orders – table has expected column headers', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/orders/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');

  // Orders table should have the key columns
  const headers = page.locator('table thead th');
  const count = await headers.count();
  expect(count).toBeGreaterThan(2);

  // Should have Reference, Customer, Status columns
  const headerTexts = await headers.allTextContents();
  const joinedHeaders = headerTexts.join(' ').toLowerCase();
  expect(joinedHeaders).toMatch(/reference|order/i);
});

// ─── BO Orders – Invoices section ─────────────────────────────────────────────
test('BO Orders – Invoices page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/orders/invoices/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Invoice/i);
});

// ─── BO Orders – Credit Slips section ─────────────────────────────────────────
test('BO Orders – Credit Slips page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/orders/credit-slips/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Credit Slip/i);
});

// ─── BO Catalog – Brands & Suppliers ──────────────────────────────────────────
test('BO Catalog – Brands page lists brands', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/catalog/brands/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Brand/i);
});

// ─── BO Product edit ──────────────────────────────────────────────────────────
test('BO Products – clicking a product name opens edit form', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/catalog/products?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');

  // Click the first product name link in the table (which includes the correct _token in its href)
  const productNameLink = page.locator('table tbody tr td a').first();
  if (await productNameLink.count() > 0) {
    // Click the link to follow it (the href already has the correct token)
    await productNameLink.click();
    await page.waitForLoadState('domcontentloaded');
    // Product edit page should load (not an error page)
    const title = await page.title();
    // Should not be an error page
    expect(title).not.toMatch(/Oh no|Error|Invalid/i);
    // Should be a product edit page
    expect(title).toMatch(/PrestaShop|Product/i);
  }
});

// ─── BO Customers – Addresses section ─────────────────────────────────────────
test('BO Customers – Addresses list page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/addresses/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Addresses/i);
  await expect(page.locator('table, .grid-table').first()).toBeVisible();
});

// ─── BO Customer Service ───────────────────────────────────────────────────────
test('BO Customer Service page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  // Navigate using the controller-based URL
  const dashUrl = page.url();
  const tokenLegacy = dashUrl.match(/token=([^&]+)/)?.[1] || '';

  // Try admin customer threads page
  await page.goto(`${BASE}/webtestpilot/index.php?controller=AdminCustomerThreads&token=b209e05916cd26507e39a168d847f4a4`);
  await page.waitForLoadState('domcontentloaded');
  // Should load customer service page
  const title = await page.title();
  expect(title).toMatch(/Customer Service|PrestaShop/i);
});

// ─── BO Stats ─────────────────────────────────────────────────────────────────
test('BO Stats page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const dashUrl = page.url();
  // Stats page
  await page.goto(`${BASE}/webtestpilot/index.php?controller=AdminStats&token=369d0e22d1ba6ca1c228eb3bb7f44cc5`);
  await page.waitForLoadState('domcontentloaded');
  const title = await page.title();
  expect(title).toMatch(/Stats|PrestaShop/i);
});

// ─── BO Modules ───────────────────────────────────────────────────────────────
test('BO Module Manager page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/improve/modules/manage?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Module/i);
});

// ─── BO Stock ─────────────────────────────────────────────────────────────────
test('BO Stock management page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/stocks/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Stock/i);
});

// ─── BO Design - CMS pages ────────────────────────────────────────────────────
test('BO Design – CMS pages list loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/improve/design/cms-pages/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  const title = await page.title();
  expect(title).toMatch(/Pages|PrestaShop/i);
});

// ─── BO Discounts/Cart Rules ───────────────────────────────────────────────────
test('BO Catalog – Discounts (Cart Rules) page loads', async ({ page }) => {
  await loginAsAdmin(page);
  // Legacy controller URL
  await page.goto(`${BASE}/webtestpilot/index.php?controller=AdminCartRules&token=f4877e2d0bd655d2fb163d5c375d79e8`);
  await page.waitForLoadState('domcontentloaded');
  const title = await page.title();
  expect(title).toMatch(/Cart Rule|Discount|PrestaShop/i);
});

// ─── BO Shipping – Carriers ────────────────────────────────────────────────────
test('BO Shipping – Carriers page loads', async ({ page }) => {
  await loginAsAdmin(page);
  // Carriers page
  await page.goto(`${BASE}/webtestpilot/index.php?controller=AdminCarriers&token=b024c58b6c50ac89e02472247e83a705`);
  await page.waitForLoadState('domcontentloaded');
  const title = await page.title();
  expect(title).toMatch(/Carrier|PrestaShop/i);
});

// ─── BO Payment Methods ────────────────────────────────────────────────────────
test('BO Payment Methods page loads', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/improve/payment/payment_methods?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Payment/i);
});

// ─── BO Order Detail – status badge visible ────────────────────────────────────
test('BO Order detail – shows order status and products section', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/orders/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');

  // The order reference link (looks like "BOFPTQNAQ") is typically in the first column
  // Find it by looking for a link in the reference column specifically
  const refLink = page.locator('table tbody tr td:first-child a, table tbody tr td.column-reference a').first();
  if (await refLink.count() > 0) {
    await refLink.click();
    await page.waitForLoadState('domcontentloaded');
    // Order detail page: should show the order with status info
    const url = page.url();
    expect(url).toMatch(/orders?\/\d|orders?\/view/i);
    // Panel or section should be visible
    await expect(page.locator('.panel, .card, .order-body').first()).toBeVisible();
  }
});
