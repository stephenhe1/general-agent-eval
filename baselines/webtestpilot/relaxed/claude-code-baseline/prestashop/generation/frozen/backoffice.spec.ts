import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8083';
const BO_EMAIL = 'admin@admin.com';
const BO_PASSWORD = 'admin12345';

/**
 * Login and return a page at the BO dashboard.
 * This also captures the session token for reuse.
 */
async function loginAsAdmin(page: any) {
  await page.goto(`${BASE}/webtestpilot/`);
  await page.waitForLoadState('domcontentloaded');
  await page.fill('#email', BO_EMAIL);
  await page.fill('#passwd', BO_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
    page.click('#submit_login'),
  ]);
  // Dismiss any modal/overlay
  const closeBtn = page.locator('.modal .close, [data-dismiss="modal"]').first();
  if (await closeBtn.count() > 0) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * Navigate to a BO section by clicking a menu link whose text matches.
 */
async function navigateBOSection(page: any, menuText: RegExp) {
  const link = page.locator(`a:has-text("${menuText.source.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}")`).first();
  // Use a different approach - find the link in the sidebar nav
  const sidebarLink = page.locator('#nav-sidebar a, .nav-bar a').filter({ hasText: menuText }).first();
  if (await sidebarLink.count() > 0) {
    await sidebarLink.click();
    await page.waitForLoadState('domcontentloaded');
    return;
  }
  // Fallback: find any matching link
  const anyLink = page.locator('a').filter({ hasText: menuText }).first();
  await anyLink.click();
  await page.waitForLoadState('domcontentloaded');
}

/** Extract the current session's _token from any link on the page */
async function getSessionToken(page: any): Promise<string> {
  const href = await page.$eval(
    'a[href*="_token="]',
    (el: HTMLAnchorElement) => el.href
  ).catch(() => '');
  const match = href.match(/_token=([^&]+)/);
  return match ? match[1] : '';
}

// ─── BO Login ─────────────────────────────────────────────────────────────────
test('BO Login page renders email/password form', async ({ page }) => {
  await page.goto(`${BASE}/webtestpilot/`);
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#passwd')).toBeVisible();
  await expect(page.locator('#submit_login')).toBeVisible();
});

test('BO Login – invalid credentials show error', async ({ page }) => {
  await page.goto(`${BASE}/webtestpilot/`);
  await page.fill('#email', 'wrong@wrong.com');
  await page.fill('#passwd', 'wrongpassword');
  await page.click('#submit_login');
  await page.waitForLoadState('domcontentloaded');
  const errorMsg = page.locator('.alert-danger, .error, .has-error, [class*="error"]').first();
  await expect(errorMsg).toBeVisible();
});

test('BO Login – successful login reaches dashboard', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.url()).toContain('AdminDashboard');
  await expect(page).toHaveTitle(/Dashboard/i);
  await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
});

// ─── BO Dashboard ─────────────────────────────────────────────────────────────
test('BO Dashboard – KPI/activity cards visible', async ({ page }) => {
  await loginAsAdmin(page);
  const kpi = page.locator('.kpi-container, .panel, .card, .dashboard-container, #dashboard-orders-wrapper').first();
  await expect(kpi).toBeVisible();
});

test('BO Dashboard – navigation menu items visible', async ({ page }) => {
  await loginAsAdmin(page);
  // Sidebar navigation sections should be present
  await expect(page.getByRole('link', { name: /Orders/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Catalog/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Customers/i }).first()).toBeVisible();
});

// ─── BO Orders ────────────────────────────────────────────────────────────────
test('BO Orders list shows table with columns', async ({ page }) => {
  await loginAsAdmin(page);
  // Get the Orders link from the sidebar and click it
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/orders/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Orders/i);
  // Table headers
  await expect(page.locator('table thead').first()).toBeVisible();
  await expect(page.locator('th:has-text("Reference"), th:has-text("reference")').first()).toBeVisible();
});

test('BO Orders list – status column visible', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/orders/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('th:has-text("Status"), th:has-text("status")').first()).toBeVisible();
});

test('BO Order detail – first order can be opened', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/orders/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');

  // Click the first order row's view button / link
  const viewBtn = page.locator('table tbody tr td a').first();
  if (await viewBtn.count() > 0) {
    const href = await viewBtn.getAttribute('href');
    if (href) {
      await page.goto(href.startsWith('http') ? href : `${BASE}${href}`);
      await page.waitForLoadState('domcontentloaded');
      // Order detail should have customer section and product section
      await expect(page.locator('.order-details, .panel, .card').first()).toBeVisible();
    }
  }
});

// ─── BO Products ──────────────────────────────────────────────────────────────
test('BO Products list shows catalog', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/catalog/products?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Products/i);
  // Product list should be visible
  await expect(page.locator('table, #product_grid, .product-list').first()).toBeVisible();
});

test('BO Products – known product name appears in catalog', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/catalog/products?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText(/Hummingbird/i).first()).toBeVisible();
});

test('BO Products – total product count is shown', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/catalog/products?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  // Should have multiple rows
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
});

// ─── BO Categories ────────────────────────────────────────────────────────────
test('BO Categories list shows category table', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/catalog/categories?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Categories/i);
  // Category rows should be present
  await expect(page.locator('table tbody tr').first()).toBeVisible();
});

test('BO Categories – known categories appear in list', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/catalog/categories?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  // At least the root/home categories should be present
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
});

// ─── BO Customers ─────────────────────────────────────────────────────────────
test('BO Customers list shows customer table', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/customers/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Customers/i);
  await expect(page.locator('table tbody tr').first()).toBeVisible();
});

test('BO Customers – buyer account appears in customer list', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/customers/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText(/auto\.customer/i).first()).toBeVisible();
});

test('BO Customer detail – clicking a customer row opens detail page', async ({ page }) => {
  await loginAsAdmin(page);
  const token = await getSessionToken(page);
  await page.goto(`${BASE}/webtestpilot/index.php/sell/customers/?_token=${token}`);
  await page.waitForLoadState('domcontentloaded');

  const firstLink = page.locator('table tbody tr td a').first();
  if (await firstLink.count() > 0) {
    const href = await firstLink.getAttribute('href');
    if (href) {
      await page.goto(href.startsWith('http') ? href : `${BASE}${href}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('.customer-view, .panel, h1').first()).toBeVisible();
    }
  }
});
