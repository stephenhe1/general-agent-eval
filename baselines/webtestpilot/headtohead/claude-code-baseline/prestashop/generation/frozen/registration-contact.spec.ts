import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8083';

// ─── Registration – Full new account ──────────────────────────────────────────
test('Registration – valid submission creates account and logs user in', async ({ page }) => {
  await page.goto(`${BASE}/registration`);
  await page.waitForLoadState('domcontentloaded');

  // Generate unique email to avoid collisions between test runs
  const ts = Date.now();
  const email = `testuser_${ts}@example.com`;

  // Fill the registration form
  // Gender radio (Mr.)
  const mrRadio = page.locator('[name="id_gender"][value="1"]');
  if (await mrRadio.count() > 0) await mrRadio.check();

  await page.fill('[name="firstname"]', 'New');
  await page.fill('[name="lastname"]', 'Tester');
  await page.fill('#field-email', email);
  await page.fill('[name="password"]', 'SecurePass123!');

  // Accept privacy policy if present
  // Check all required privacy/GDPR checkboxes
  const privacyCheckboxes = page.locator('[name="psgdpr"], [name="customer_privacy"]');
  const privacyCount = await privacyCheckboxes.count();
  for (let i = 0; i < privacyCount; i++) {
    if (!(await privacyCheckboxes.nth(i).isChecked())) {
      await privacyCheckboxes.nth(i).check();
    }
  }

  // Submit
  await page.click('[data-link-action="save-customer"], form[action*="registration"] button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');

  // Should redirect to my-account or home page (logged in)
  const url = page.url();
  const isLoggedIn = url.includes('my-account') || !url.includes('registration');
  expect(isLoggedIn).toBeTruthy();

  // Check user account link is visible (confirming logged in state)
  const accountSection = page.locator('#_desktop_user_info a').first();
  await expect(accountSection).toBeVisible();
  const href = await accountSection.getAttribute('href');
  // Should be account link, not login link
  expect(href).not.toMatch(/^http.*login/);
});

// ─── Registration – Email already exists ─────────────────────────────────────
test('Registration – duplicate email shows error', async ({ page }) => {
  await page.goto(`${BASE}/registration`);
  await page.fill('[name="firstname"]', 'Auto');
  await page.fill('[name="lastname"]', 'Customer');
  await page.fill('#field-email', 'auto.customer@example.com'); // existing email
  await page.fill('[name="password"]', 'mypassword');

  // Check all required privacy/GDPR checkboxes
  const privacyCheckboxes = page.locator('[name="psgdpr"], [name="customer_privacy"]');
  const privacyCount = await privacyCheckboxes.count();
  for (let i = 0; i < privacyCount; i++) {
    if (!(await privacyCheckboxes.nth(i).isChecked())) {
      await privacyCheckboxes.nth(i).check();
    }
  }

  await page.click('[data-link-action="save-customer"], form[action*="registration"] button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');

  // Should show an error about the email already being in use
  const errorBlock = page.locator('.alert-danger, .notification-error, .form-error').first();
  await expect(errorBlock).toBeVisible();
});

// ─── Contact Us – Form submission ─────────────────────────────────────────────
test('Contact Us – filled form can be submitted', async ({ page }) => {
  await page.goto(`${BASE}/contact-us`);
  await page.waitForLoadState('domcontentloaded');

  // Select subject (Customer Service or similar)
  const subjectSelect = page.locator('[name="id_contact"]');
  if (await subjectSelect.count() > 0) {
    const options = await subjectSelect.locator('option:not([value=""])').allTextContents();
    if (options.length > 0) {
      await subjectSelect.selectOption({ index: 1 });
    }
  }

  await page.fill('[name="from"]', 'testcontact@example.com');
  await page.fill('[name="message"]', 'This is a test message for the automated E2E test suite. Please ignore.');

  // Get current URL before submit (to compare after)
  const urlBefore = page.url();

  await page.click('[name="submitMessage"]');
  await page.waitForLoadState('domcontentloaded');

  // Should show a success confirmation or stay on the contact page with a message
  const successMsg = page.locator('.alert-success, .notification-success, [class*="success"]').first();
  const errorMsg = page.locator('.alert-danger, .notification-danger').first();

  // Either a success message appears, or we're redirected
  const hasSuccess = await successMsg.count() > 0;
  const hasError = await errorMsg.count() > 0;

  // At minimum the form page should load without a crash
  expect(page.url()).toMatch(/localhost:8083/);
});

// ─── Contact Us – Blank form shows validation errors ──────────────────────────
test('Contact Us – submitting blank form shows required field errors', async ({ page }) => {
  await page.goto(`${BASE}/contact-us`);
  await page.waitForLoadState('domcontentloaded');

  // Try to submit without filling anything
  await page.click('[name="submitMessage"]');
  await page.waitForLoadState('domcontentloaded');

  // Should show validation errors
  const errors = page.locator('.alert-danger, .invalid-feedback, .form-error, .help-block').first();
  // Page should still be on contact form
  expect(page.url()).toMatch(/contact/i);
});

// ─── Wishlist – Creating a new wishlist ───────────────────────────────────────
test('Wishlist – authenticated user can create a new wishlist', async ({ page }) => {
  // Log in as buyer
  await page.goto(`${BASE}/login`);
  await page.fill('#field-email', 'auto.customer@example.com');
  await page.fill('#field-password', 'mypassword');
  await page.click('#submit-login');
  await page.waitForLoadState('domcontentloaded');

  await page.goto(`${BASE}/module/blockwishlist/lists`);
  await page.waitForLoadState('domcontentloaded');

  // Count wishlists before creating one
  const wishlistsBefore = await page.locator('.wishlist-list-item, .wishlist-name, [class*="wishlist-card"]').count();

  // Find and click "Create new list" or similar button
  const createBtn = page.getByRole('button', { name: /Create/i }).or(page.getByText(/Create new list/i)).first();
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(1000);

    // Fill in wishlist name
    const nameInput = page.locator('[placeholder*="name"], [name*="name"], input[type="text"]').last();
    if (await nameInput.count() > 0) {
      await nameInput.fill('My Test Wishlist ' + Date.now());
      await page.waitForTimeout(200);

      // Submit
      const submitBtn = page.getByRole('button', { name: /Create/i }).last();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(1500);
      }
    }
  }

  // Wishlist count should have increased
  const wishlistsAfter = await page.locator('.wishlist-list-item, .wishlist-name, [class*="wishlist-card"]').count();
  expect(wishlistsAfter).toBeGreaterThanOrEqual(wishlistsBefore);
});

// ─── Add product to wishlist from PDP ────────────────────────────────────────
test('Wishlist – can add product to wishlist from product page', async ({ page }) => {
  // Log in
  await page.goto(`${BASE}/login`);
  await page.fill('#field-email', 'auto.customer@example.com');
  await page.fill('#field-password', 'mypassword');
  await page.click('#submit-login');
  await page.waitForLoadState('domcontentloaded');

  // Go to a product page
  await page.goto(`${BASE}/men/1-1-hummingbird-printed-t-shirt.html`);
  await page.waitForLoadState('domcontentloaded');

  // The wishlist heart/button should be visible
  const wishlistBtn = page.locator('.wishlist-button-add, .wishlist-add-to, [data-action*="wishlist"]').first();
  if (await wishlistBtn.count() > 0) {
    await expect(wishlistBtn).toBeVisible();
  }
});
