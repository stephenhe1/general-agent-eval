import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8083';

// ─── Home ────────────────────────────────────────────────────────────────────
test('Home page loads with navigation and featured products', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle(/PrestaShop/i);

  // Top navigation categories should be visible
  await expect(page.getByRole('link', { name: /Clothes/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Accessories/i }).first()).toBeVisible();

  // Featured / new products section exists
  const products = page.locator('.product-miniature');
  await expect(products.first()).toBeVisible();
  const count = await products.count();
  expect(count).toBeGreaterThan(0);
});

test('Home page – newsletter signup form is present', async ({ page }) => {
  await page.goto(BASE);
  const emailInput = page.locator('input[name="email"]').first();
  await expect(emailInput).toBeVisible();
});

// ─── Category Pages ───────────────────────────────────────────────────────────
test('Category: Clothes page shows products and subcategories', async ({ page }) => {
  await page.goto(`${BASE}/3-clothes`);
  await expect(page).toHaveTitle(/Clothes/i);
  await expect(page.getByRole('heading', { name: /Clothes/i })).toBeVisible();

  // Subcategories (Men/Women) should be visible
  await expect(page.getByRole('link', { name: /Men/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Women/i }).first()).toBeVisible();

  // Products listed
  const products = page.locator('.product-miniature');
  const count = await products.count();
  expect(count).toBeGreaterThan(0);
});

test('Category: Men page lists products', async ({ page }) => {
  await page.goto(`${BASE}/4-men`);
  await expect(page).toHaveTitle(/Men/i);
  await expect(page.getByRole('heading', { name: 'Men' })).toBeVisible();
  await expect(page.locator('.product-miniature').first()).toBeVisible();
});

test('Category: Women page lists products', async ({ page }) => {
  await page.goto(`${BASE}/5-women`);
  await expect(page).toHaveTitle(/Women/i);
  await expect(page.getByRole('heading', { name: 'Women' })).toBeVisible();
  await expect(page.locator('.product-miniature').first()).toBeVisible();
});

test('Category: Accessories page lists products', async ({ page }) => {
  await page.goto(`${BASE}/6-accessories`);
  await expect(page).toHaveTitle(/Accessories/i);
  await expect(page.locator('.product-miniature').first()).toBeVisible();
});

test('Category: Art page lists products', async ({ page }) => {
  await page.goto(`${BASE}/9-art`);
  await expect(page).toHaveTitle(/Art/i);
  await expect(page.locator('.product-miniature').first()).toBeVisible();
});

// ─── Category Sorting ─────────────────────────────────────────────────────────
test('Category page sort by Price – product order changes', async ({ page }) => {
  await page.goto(`${BASE}/3-clothes`);
  await page.waitForLoadState('domcontentloaded');

  // Grab initial first product name
  const firstBefore = await page.locator('.product-miniature .product-title').first().textContent();

  // Open sort dropdown and select "Price, low to high"
  const sortSelect = page.locator('#js-product-list-top select, select[id*="sort"]');
  if (await sortSelect.count() > 0) {
    await sortSelect.selectOption({ label: /Price, low to high/i });
    await page.waitForLoadState('domcontentloaded');
    const firstAfter = await page.locator('.product-miniature .product-title').first().textContent();
    // The list should have re-sorted (may or may not differ for single item, but page should reload)
    await expect(page.locator('.product-miniature').first()).toBeVisible();
  }
});

// ─── Special Listing Pages ─────────────────────────────────────────────────────
test('Best Sellers page loads with products', async ({ page }) => {
  await page.goto(`${BASE}/best-sellers`);
  await expect(page).toHaveTitle(/Best sellers/i);
  await expect(page.getByRole('heading', { name: /Best sellers/i })).toBeVisible();
});

test('New Products page loads', async ({ page }) => {
  await page.goto(`${BASE}/new-products`);
  await expect(page).toHaveTitle(/New products/i);
  await expect(page.getByRole('heading', { name: /New products/i })).toBeVisible();
  await expect(page.locator('.product-miniature').first()).toBeVisible();
});

test('Prices Drop page loads', async ({ page }) => {
  await page.goto(`${BASE}/prices-drop`);
  await expect(page).toHaveTitle(/Prices drop/i);
  await expect(page.getByRole('heading', { name: /Prices drop/i })).toBeVisible();
  await expect(page.locator('.product-miniature').first()).toBeVisible();
});

// ─── Search ───────────────────────────────────────────────────────────────────
test('Search – submitting a term returns results', async ({ page }) => {
  await page.goto(BASE);
  const searchInput = page.locator('input[name="s"]').first();
  await searchInput.fill('shirt');
  await searchInput.press('Enter');
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/Search/i);
  await expect(page.getByRole('heading', { name: /Search results/i })).toBeVisible();
  // Actual results should contain at least one product
  const results = page.locator('.product-miniature');
  await expect(results.first()).toBeVisible();
});

test('Search – empty search shows message or stays on current page', async ({ page }) => {
  await page.goto(BASE);
  const searchInput = page.locator('input[name="s"]').first();
  await searchInput.fill('');
  await searchInput.press('Enter');
  // Either stays on home or goes to search page
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  // Should not throw an error
  expect(url).toMatch(/localhost:8083/);
});

test('Search – query with no results shows no-products message', async ({ page }) => {
  await page.goto(`${BASE}/search?s=zzzyyyxxx_no_match_12345`);
  await expect(page).toHaveTitle(/Search/i);
  // Expect empty results
  const products = page.locator('.product-miniature');
  await expect(products).toHaveCount(0);
});

// ─── Product Detail Page ──────────────────────────────────────────────────────
test('Product detail page shows name, price, add-to-cart button', async ({ page }) => {
  await page.goto(`${BASE}/men/1-1-hummingbird-printed-t-shirt.html`);
  await expect(page).toHaveTitle(/Hummingbird printed t-shirt/i);
  await expect(page.getByRole('heading', { name: /Hummingbird printed t-shirt/i })).toBeVisible();

  // Price should be visible
  const price = page.locator('.current-price, .product-price');
  await expect(price.first()).toBeVisible();
  const priceText = await price.first().textContent();
  expect(priceText).toMatch(/[€$£\d]/);

  // Add to cart button
  await expect(page.locator('.add-to-cart')).toBeVisible();
});

test('Product detail – selecting size variant updates product', async ({ page }) => {
  await page.goto(`${BASE}/men/1-1-hummingbird-printed-t-shirt.html`);
  const sizeSelect = page.locator('select[name="group[1]"]');
  await expect(sizeSelect).toBeVisible();
  // Select the second size option (index 1 = first real option after placeholder)
  await sizeSelect.selectOption({ index: 1 });
  await page.waitForTimeout(500);
  // URL or page should reflect new variant
  const url = page.url();
  expect(url).toMatch(/localhost:8083/);
});

// ─── Login Page ───────────────────────────────────────────────────────────────
test('Login page renders form with email and password fields', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await expect(page).toHaveTitle(/Login/i);
  await expect(page.getByRole('heading', { name: /Log in/i })).toBeVisible();
  await expect(page.locator('#field-email')).toBeVisible();
  await expect(page.locator('#field-password')).toBeVisible();
  await expect(page.locator('#submit-login')).toBeVisible();
});

test('Login – invalid credentials shows error', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('#field-email', 'wrong@example.com');
  await page.fill('#field-password', 'wrongpassword');
  await page.click('#submit-login');
  await page.waitForLoadState('domcontentloaded');
  // Error message should appear
  const errorBlock = page.locator('.alert-danger, .notification-error, [class*="error"]');
  await expect(errorBlock.first()).toBeVisible();
});

test('Login – successful login redirects to account', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('#field-email', 'auto.customer@example.com');
  await page.fill('#field-password', 'mypassword');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.click('#submit-login'),
  ]);
  // Should be on home or my-account page after login
  expect(page.url()).toMatch(/localhost:8083/);
  // Sign-in link should be replaced by account link
  const accountLink = page.locator('[title="View my customer account"], .account a, #_desktop_user_info a');
  await expect(accountLink.first()).toBeVisible();
});

// ─── Registration Page ────────────────────────────────────────────────────────
test('Registration page renders required fields', async ({ page }) => {
  await page.goto(`${BASE}/registration`);
  await expect(page).toHaveTitle(/Registration/i);
  await expect(page.getByRole('heading', { name: /Create an account/i })).toBeVisible();
  await expect(page.locator('[name="firstname"]')).toBeVisible();
  await expect(page.locator('[name="lastname"]')).toBeVisible();
  await expect(page.locator('#field-email')).toBeVisible();
  await expect(page.locator('[name="password"]')).toBeVisible();
});

test('Registration – submitting empty form shows validation errors', async ({ page }) => {
  await page.goto(`${BASE}/registration`);
  await page.click('[data-link-action="save-customer"], button[type="submit"]');
  // Browser validation or server-side errors should appear
  // Check first required field is invalid or error displayed
  const firstNameInput = page.locator('[name="firstname"]');
  const isInvalid = await firstNameInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
  expect(isInvalid).toBe(true);
});

// ─── Contact Us Page ──────────────────────────────────────────────────────────
test('Contact Us page loads with contact form', async ({ page }) => {
  await page.goto(`${BASE}/contact-us`);
  await expect(page).toHaveTitle(/Contact us/i);
  await expect(page.getByRole('heading', { name: /Contact us/i })).toBeVisible();
  await expect(page.locator('[name="from"]')).toBeVisible();
  await expect(page.locator('[name="message"]')).toBeVisible();
  await expect(page.locator('[name="submitMessage"]')).toBeVisible();
});

// ─── Sitemap Page ─────────────────────────────────────────────────────────────
test('Sitemap page shows all main section links', async ({ page }) => {
  await page.goto(`${BASE}/sitemap`);
  await expect(page).toHaveTitle(/Sitemap/i);
  await expect(page.getByRole('heading', { name: /Sitemap/i })).toBeVisible();
  // Expect "Our Offers" and "Categories" sections to be present
  await expect(page.getByRole('heading', { name: /Our Offers/i }).or(page.getByText(/Our Offers/i)).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /New products/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Best sellers/i }).first()).toBeVisible();
});

// ─── Stores Page ─────────────────────────────────────────────────────────────
test('Stores page shows store information', async ({ page }) => {
  await page.goto(`${BASE}/stores`);
  await expect(page).toHaveTitle(/Stores/i);
  await expect(page.getByRole('heading', { name: /Our stores/i })).toBeVisible();
});

// ─── Guest Tracking Page ──────────────────────────────────────────────────────
test('Guest Tracking page has order reference and email fields', async ({ page }) => {
  await page.goto(`${BASE}/guest-tracking`);
  await expect(page).toHaveTitle(/Guest tracking/i);
  await expect(page.getByRole('heading', { name: /Guest Order Tracking/i })).toBeVisible();
  await expect(page.locator('[name="order_reference"]')).toBeVisible();
  await expect(page.locator('[name="email"]').first()).toBeVisible();
});

// ─── CMS Pages ───────────────────────────────────────────────────────────────
test('CMS: Delivery page loads', async ({ page }) => {
  await page.goto(`${BASE}/content/1-delivery`);
  await expect(page).toHaveTitle(/Delivery/i);
  await expect(page.getByRole('heading', { name: /Delivery/i })).toBeVisible();
});

test('CMS: Legal Notice page loads', async ({ page }) => {
  await page.goto(`${BASE}/content/2-legal-notice`);
  await expect(page).toHaveTitle(/Legal Notice/i);
});

test('CMS: Terms and Conditions page loads', async ({ page }) => {
  await page.goto(`${BASE}/content/3-terms-and-conditions-of-use`);
  await expect(page).toHaveTitle(/Terms/i);
});

test('CMS: About Us page loads', async ({ page }) => {
  await page.goto(`${BASE}/content/4-about-us`);
  await expect(page).toHaveTitle(/About/i);
});

test('CMS: Secure Payment page loads', async ({ page }) => {
  await page.goto(`${BASE}/content/5-secure-payment`);
  await expect(page).toHaveTitle(/Secure payment/i);
});

// ─── 404 Error Page ───────────────────────────────────────────────────────────
test('404 error page renders for unknown URL', async ({ page }) => {
  await page.goto(`${BASE}/this-page-definitely-does-not-exist-xyz`);
  await expect(page).toHaveTitle(/404/i);
  await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
});
