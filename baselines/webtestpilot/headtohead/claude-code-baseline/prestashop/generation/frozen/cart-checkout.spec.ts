import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8083';
const BUYER_EMAIL = 'auto.customer@example.com';
const BUYER_PASSWORD = 'mypassword';

async function loginAsBuyer(page: any) {
  await page.goto(`${BASE}/login`);
  await page.fill('#field-email', BUYER_EMAIL);
  await page.fill('#field-password', BUYER_PASSWORD);
  await page.click('#submit-login');
  await page.waitForLoadState('domcontentloaded');
}

/** Add t-shirt to cart and close the confirmation modal */
async function addTShirtToCart(page: any) {
  await page.goto(`${BASE}/men/1-1-hummingbird-printed-t-shirt.html`);
  await page.waitForLoadState('domcontentloaded');
  // Select size (index 1 = first real option after placeholder)
  const sizeSelect = page.locator('select[name="group[1]"]');
  if (await sizeSelect.count() > 0) {
    await sizeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(300);
  }
  await page.locator('.add-to-cart').click();
  await page.waitForTimeout(2000); // let modal appear
  // The modal (#blockcart-modal) appears - navigate away to dismiss it
  // instead of clicking inside it (which can cause page navigation issues)
}

// ─── Add to Cart ──────────────────────────────────────────────────────────────
test('Add to Cart – cart count increments after adding product', async ({ page }) => {
  await page.goto(`${BASE}/men/1-1-hummingbird-printed-t-shirt.html`);
  await page.waitForLoadState('domcontentloaded');

  // Get initial cart count
  const cartCountBefore = await page.locator('.cart-products-count').first().textContent().catch(() => '(0)');

  // Select size
  const sizeSelect = page.locator('select[name="group[1]"]');
  if (await sizeSelect.count() > 0) {
    await sizeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(300);
  }

  // Add to cart
  await page.locator('.add-to-cart').click();
  await page.waitForTimeout(2000);

  // Cart count should have increased
  const cartCountAfter = await page.locator('.cart-products-count').first().textContent().catch(() => '');
  expect(cartCountAfter).toMatch(/[1-9]/);
  // Specifically should be different from (0)
  expect(cartCountAfter).not.toBe('(0)');
});

test('Add to Cart – product confirmation modal appears', async ({ page }) => {
  await page.goto(`${BASE}/men/1-1-hummingbird-printed-t-shirt.html`);
  await page.waitForLoadState('domcontentloaded');
  const sizeSelect = page.locator('select[name="group[1]"]');
  if (await sizeSelect.count() > 0) {
    await sizeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(300);
  }
  await page.locator('.add-to-cart').click();
  await page.waitForTimeout(2000);
  // The blockcart modal should appear with the product name
  const modal = page.locator('#blockcart-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/Hummingbird/i)).toBeVisible();
});

// ─── Cart Page ────────────────────────────────────────────────────────────────
test('Cart page shows added product with correct name', async ({ page }) => {
  await addTShirtToCart(page);
  await page.goto(`${BASE}/cart?action=show`);
  await expect(page).toHaveTitle(/Cart/i);
  await expect(page.getByRole('heading', { name: /Shopping Cart/i })).toBeVisible();
  await expect(page.getByText(/Hummingbird printed t-shirt/i).first()).toBeVisible();
});

test('Cart page – product price is displayed', async ({ page }) => {
  await addTShirtToCart(page);
  await page.goto(`${BASE}/cart?action=show`);
  const price = page.locator('.product-price, .current-price, .cart-item .price').first();
  await expect(price).toBeVisible();
  const priceText = await price.textContent();
  expect(priceText).toMatch(/[€$£\d]/);
});

test('Cart page – cart total is shown in summary', async ({ page }) => {
  await addTShirtToCart(page);
  await page.goto(`${BASE}/cart?action=show`);
  // Order summary should show a total
  const total = page.locator('.cart-total, .cart-summary-totals .value, .value').first();
  await expect(total).toBeVisible();
});

test('Cart page – quantity can be changed', async ({ page }) => {
  await addTShirtToCart(page);
  await page.goto(`${BASE}/cart?action=show`);

  const qtyInput = page.locator('.js-cart-line-product-quantity, input[data-action*="qty"]').first();
  if (await qtyInput.count() > 0) {
    const valueBefore = await qtyInput.inputValue();
    await qtyInput.fill('2');
    await qtyInput.press('Enter');
    await page.waitForTimeout(2000);
    const valueAfter = await qtyInput.inputValue();
    // Quantity should now be 2
    expect(valueAfter).toBe('2');
  }
});

test('Cart page – removing item clears the product from cart', async ({ page }) => {
  await addTShirtToCart(page);
  await page.goto(`${BASE}/cart?action=show`);

  // Check the product is there before removal
  await expect(page.getByText(/Hummingbird/i).first()).toBeVisible();

  // Find and click the remove button
  const removeBtn = page.locator('.remove-from-cart, [data-link-action="delete-cartproduct"]').first();
  if (await removeBtn.count() > 0) {
    await removeBtn.click();
    await page.waitForTimeout(2000);
    // Product should no longer be in cart
    const hummingbirdItems = await page.locator('.cart-item').filter({ hasText: /Hummingbird/i }).count();
    expect(hummingbirdItems).toBe(0);
  }
});

// ─── Checkout Page ────────────────────────────────────────────────────────────
test('Checkout page shows checkout steps', async ({ page }) => {
  await addTShirtToCart(page);
  await page.goto(`${BASE}/order`);
  await page.waitForLoadState('domcontentloaded');

  // Checkout has steps - at least one should be visible
  const steps = page.locator('.checkout-step, .step-title');
  const count = await steps.count();
  expect(count).toBeGreaterThan(0);

  // Personal Information step should be present
  await expect(page.getByText(/Personal Information/i).first()).toBeVisible();
});

test('Checkout – authenticated buyer progresses through address step', async ({ page }) => {
  await loginAsBuyer(page);
  await addTShirtToCart(page);
  await page.goto(`${BASE}/order`);
  await page.waitForLoadState('domcontentloaded');

  // Addresses step should be current (step 2)
  await expect(page.getByText(/Addresses/i).first()).toBeVisible();

  // Continue button within the CURRENT step should be visible
  // (Step 1's Continue is hidden since it's already complete)
  const continueBtn = page.locator('.checkout-step.-current button.continue, .js-current-step button.continue');
  await expect(continueBtn).toBeVisible();
});

// ─── Full Checkout Flow ───────────────────────────────────────────────────────
test('Full checkout – buyer places order and receives order confirmation', async ({ page }) => {
  await loginAsBuyer(page);

  // Ensure there's an address set up
  await page.goto(`${BASE}/addresses`);
  await page.waitForLoadState('domcontentloaded');
  const existingAddresses = await page.locator('.address-item, .address').count();
  if (existingAddresses === 0) {
    await page.goto(`${BASE}/address`);
    await page.waitForLoadState('domcontentloaded');
    await page.fill('[name="alias"]', 'Home');
    await page.fill('[name="firstname"]', 'Test');
    await page.fill('[name="lastname"]', 'Buyer');
    await page.fill('[name="address1"]', '10 Downing Street');
    await page.fill('[name="city"]', 'London');
    const postcodeField = page.locator('[name="postcode"]');
    if (await postcodeField.count() > 0) await postcodeField.fill('SW1A 2AA');
    await page.click('button.form-control-submit');
    let i = 0;
    while (i < 20 && !page.url().includes('addresses')) {
      await page.waitForTimeout(1000);
      i++;
    }
  }

  // Add item to cart
  await addTShirtToCart(page);

  // Go to checkout
  await page.goto(`${BASE}/order`);
  await page.waitForLoadState('domcontentloaded');

  // ---- STEP 2: Addresses ----
  // Addresses step should be active - click Continue
  const addressContinue = page.locator('.checkout-step.-current button.continue, .checkout-step.-current button:has-text("Continue")').first();
  if (await addressContinue.count() > 0) {
    await addressContinue.click();
    await page.waitForTimeout(1500);
  }

  // ---- STEP 3: Shipping Method ----
  // Select first carrier if available
  const shippingRadio = page.locator('.delivery-options input[type="radio"], [name="delivery_option"]').first();
  if (await shippingRadio.count() > 0) {
    await shippingRadio.check();
    await page.waitForTimeout(500);
  }
  const shippingContinue = page.locator('.checkout-step.-current button.continue, .checkout-step.-current button:has-text("Continue")').first();
  if (await shippingContinue.count() > 0) {
    await shippingContinue.click();
    await page.waitForTimeout(1500);
  }

  // ---- STEP 4: Payment ----
  // Select payment method (wire transfer or check)
  const paymentOption = page.locator('.payment-option input[type="radio"]').first();
  if (await paymentOption.count() > 0) {
    await paymentOption.check();
    await page.waitForTimeout(500);
  }

  // Accept terms of service
  const termsCheckbox = page.locator('#conditions_to_approve\\[terms-and-conditions\\], input[name="conditions_to_approve[terms-and-conditions]"]');
  if (await termsCheckbox.count() > 0 && !(await termsCheckbox.isChecked())) {
    await termsCheckbox.check();
  }

  // Place order
  const placeOrderBtn = page.locator('#payment-confirmation button[type="submit"], button:has-text("Place order")').first();
  if (await placeOrderBtn.count() > 0 && await placeOrderBtn.isVisible()) {
    await placeOrderBtn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 20000 });

    // Verify we got an order confirmation
    const url = page.url();
    const heading = await page.locator('h1, .page-header h1').first().textContent().catch(() => '');
    const isConfirmation = url.includes('confirmation') ||
      /thank you|order confirmed|confirmation/i.test(heading);
    expect(isConfirmation).toBeTruthy();
  }
});

// ─── Guest Checkout Redirect ──────────────────────────────────────────────────
test('Guest trying to checkout sees personal info step', async ({ page }) => {
  // Add item to cart as guest (not logged in)
  await addTShirtToCart(page);
  await page.goto(`${BASE}/order`);
  await page.waitForLoadState('domcontentloaded');

  // Should show the personal information step (guest checkout or login)
  const personalInfoStep = page.getByText(/Personal Information/i).first();
  await expect(personalInfoStep).toBeVisible();
});
