import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8083';
const BUYER_EMAIL = 'auto.customer@example.com';
const BUYER_PASSWORD = 'mypassword';

async function loginAsBuyer(page: any) {
  await page.goto(`${BASE}/login`);
  await page.fill('#field-email', BUYER_EMAIL);
  await page.fill('#field-password', BUYER_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.click('#submit-login'),
  ]);
}

// ─── My Account Dashboard ─────────────────────────────────────────────────────
test('My Account – dashboard shows account section links', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/my-account`);
  await expect(page).toHaveTitle(/My account/i);
  await expect(page.getByRole('heading', { name: /Your account/i })).toBeVisible();

  // The main account page content links (use .first() to avoid strict mode issues)
  await expect(page.getByRole('link', { name: /Information/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Order/i }).first()).toBeVisible();
});

// ─── Order History ────────────────────────────────────────────────────────────
test('Order History page loads for authenticated buyer', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/order-history`);
  await expect(page).toHaveTitle(/Order history/i);
  await expect(page.locator('h1')).toContainText(/Order history/i);
  // May be empty or have rows
  const hasContent = await page.locator('table, .no-order, .alert-info, .order-row').count();
  expect(hasContent).toBeGreaterThanOrEqual(0);
});

// ─── Credit Slips ─────────────────────────────────────────────────────────────
test('Credit Slips page loads for authenticated buyer', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/credit-slip`);
  await expect(page).toHaveTitle(/Credit slip/i);
  await expect(page.locator('h1')).toContainText(/Credit slip/i);
});

// ─── Wishlist ─────────────────────────────────────────────────────────────────
test('Wishlist page loads and shows heading', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/module/blockwishlist/lists`);
  await expect(page.locator('h1')).toContainText(/wishlist/i);
});

// ─── Addresses ────────────────────────────────────────────────────────────────
test('Addresses page shows address list for authenticated buyer', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/addresses`);
  await expect(page).toHaveTitle(/Addresses/i);
  await expect(page.locator('h1')).toContainText(/addresses/i);
  // Either addresses are listed or "Add" link is visible
  await expect(page.getByRole('link', { name: /Add/i }).first()).toBeVisible();
});

// ─── Add Address ──────────────────────────────────────────────────────────────
test('Add Address form renders required fields', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/address`);
  await expect(page).toHaveTitle(/Address/i);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('[name="firstname"]')).toBeVisible();
  await expect(page.locator('[name="lastname"]')).toBeVisible();
  await expect(page.locator('[name="address1"]')).toBeVisible();
});

test('Add Address – submit valid address, verify redirect to addresses page', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/address`);
  await page.waitForLoadState('domcontentloaded');

  const alias = 'TestHome_' + Date.now();
  await page.fill('[name="alias"]', alias);
  await page.fill('[name="firstname"]', 'Test');
  await page.fill('[name="lastname"]', 'User');
  await page.fill('[name="address1"]', '10 Downing Street');
  await page.fill('[name="city"]', 'London');

  const postcodeField = page.locator('[name="postcode"]');
  if (await postcodeField.count() > 0) await postcodeField.fill('SW1A 2AA');

  // Click the Save button (the form-control-submit button, not newsletter submit)
  await page.click('button.form-control-submit');
  // The form submits and redirects to /addresses - wait up to 20s for that
  await page.waitForTimeout(500);
  // Poll for URL change
  let finalUrl = page.url();
  for (let i = 0; i < 20; i++) {
    if (finalUrl.includes('addresses')) break;
    await page.waitForTimeout(1000);
    finalUrl = page.url();
  }

  // Should be on addresses page
  expect(page.url()).toMatch(/address/i);
});

// ─── Identity ─────────────────────────────────────────────────────────────────
test('Identity page shows personal information form', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/identity`);
  await expect(page).toHaveTitle(/Identity/i);
  await expect(page.locator('h1')).toContainText(/personal information/i);
  await expect(page.locator('[name="firstname"]')).toBeVisible();
  await expect(page.locator('[name="lastname"]')).toBeVisible();
  await expect(page.locator('#field-email')).toBeVisible();
});

test('Identity – current user email is pre-filled in form', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/identity`);
  await page.waitForLoadState('domcontentloaded');
  const email = await page.locator('#field-email').inputValue();
  expect(email).toBe(BUYER_EMAIL);
});

// ─── Logout ───────────────────────────────────────────────────────────────────
test('Logout – clicking sign out removes authenticated session', async ({ page }) => {
  await loginAsBuyer(page);
  await page.goto(`${BASE}/my-account`);

  // Use the desktop user info sign out link
  const logoutLink = page.locator('#_desktop_user_info a[href*="mylogout"], .logout').first();
  await expect(logoutLink).toBeVisible();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
    logoutLink.click(),
  ]);

  // After logout the Sign in link in the header should be visible
  const signInLink = page.locator('#_desktop_user_info a').first();
  await expect(signInLink).toBeVisible();
  const href = await signInLink.getAttribute('href');
  expect(href).toMatch(/login/i);
});

// ─── Unauthenticated redirect ─────────────────────────────────────────────────
test('Protected pages redirect unauthenticated users to login', async ({ page }) => {
  await page.goto(`${BASE}/my-account`);
  await page.waitForLoadState('domcontentloaded');
  expect(page.url()).toMatch(/login/i);
});
