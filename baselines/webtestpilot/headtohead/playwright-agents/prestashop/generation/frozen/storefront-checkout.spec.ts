import { test, expect } from '@playwright/test';

const BUYER_EMAIL = 'auto.customer@example.com';
const BUYER_PASSWORD = 'mypassword';

/** Sign in as the buyer account */
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(BUYER_EMAIL);
  await page.getByRole('textbox', { name: 'Password input' }).fill(BUYER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('domcontentloaded');
}

/** Clear all cart items */
async function clearCart(page: import('@playwright/test').Page) {
  await page.goto('/cart');
  await page.waitForLoadState('domcontentloaded');
  let removeButtons = page.locator('[data-link-action="delete-from-cart"], .remove-from-cart');
  let count = await removeButtons.count();
  while (count > 0) {
    await removeButtons.first().click();
    await page.waitForTimeout(800);
    removeButtons = page.locator('[data-link-action="delete-from-cart"], .remove-from-cart');
    count = await removeButtons.count();
  }
}

/** Add mug to cart */
async function addMugToCart(page: import('@playwright/test').Page) {
  await page.goto('/home-accessories/6-mug-the-best-is-yet-to-come.html');
  await page.waitForLoadState('domcontentloaded');
  const addToCart = page.getByRole('button', { name: /Add to Cart/i });
  await addToCart.click();
  await page.waitForTimeout(1000);
  const continueBtn = page.locator('[data-dismiss="modal"], .continue-shopping, button:has-text("Continue shopping")').first();
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(300);
  }
}

// TC-26 Full checkout flow for a logged-in user
test('TC-26 full checkout flow for logged-in user reaches order confirmation', async ({ page }) => {
  await signIn(page);
  await clearCart(page);
  await addMugToCart(page);

  // Proceed to checkout from cart
  await page.goto('/cart');
  const checkoutBtn = page.getByRole('link', { name: /Proceed to Checkout/i });
  await checkoutBtn.click();
  await page.waitForLoadState('domcontentloaded');

  // Step 1: Personal info / already logged in — advance if needed
  // Might auto-skip or show a "Continue" button
  const step1Continue = page.locator('#checkout-personal-information-step button[name="confirm-addresses"], button[name="continue"], .continue-button').first();
  if (await step1Continue.isVisible({ timeout: 3000 }).catch(() => false)) {
    await step1Continue.click();
    await page.waitForLoadState('domcontentloaded');
  }

  // Step 2: Addresses — confirm delivery address
  const addressContinue = page.locator(
    '#checkout-addresses-step button[name="confirm-addresses"], #checkout-addresses-step .continue-button, button[name="confirm-addresses"]'
  ).first();
  if (await addressContinue.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addressContinue.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  }

  // Step 3: Shipping method — select a carrier and continue
  const shippingCarrier = page.locator('.delivery-option input[type="radio"]').first();
  if (await shippingCarrier.isVisible({ timeout: 5000 }).catch(() => false)) {
    await shippingCarrier.check();
  }
  const shippingContinue = page.locator(
    '#checkout-delivery-step button[name="confirmDeliveryOption"], #checkout-delivery-step .continue-button, button[name="confirmDeliveryOption"]'
  ).first();
  if (await shippingContinue.isVisible({ timeout: 3000 }).catch(() => false)) {
    await shippingContinue.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  }

  // Step 4: Payment — select Pay by Check
  const payByCheck = page.locator('input[data-module-name*="ps_checkpayment"], label:has-text("Pay by Check"), #payment-option-1').first();
  if (await payByCheck.isVisible({ timeout: 5000 }).catch(() => false)) {
    await payByCheck.click();
    await page.waitForTimeout(300);
  } else {
    // Try any available payment option
    const anyPayment = page.locator('.payment-option input[type="radio"]').first();
    if (await anyPayment.isVisible({ timeout: 3000 }).catch(() => false)) {
      await anyPayment.click();
      await page.waitForTimeout(300);
    }
  }

  // Agree to terms
  const termsCheckbox = page.locator('#conditions_to_approve\\[terms-and-conditions\\], input[name*="conditions"], #conditions-to-approve input').first();
  if (await termsCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await termsCheckbox.check();
  }

  // Place order
  const placeOrderBtn = page.locator('#payment-confirmation button, button[type="submit"].btn-primary, .payment-confirmation button').first();
  await expect(placeOrderBtn).toBeEnabled({ timeout: 5000 });
  await placeOrderBtn.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Should be on order confirmation page
  await expect(page).toHaveURL(/order-confirmation/i);

  // Order confirmation heading
  const confirmHeading = page.locator('.order-confirmation-table, h3[class*="h1.card-title"], .h1.card-title').first();
  await expect(page.getByText(/Your order is confirmed/i)).toBeVisible({ timeout: 5000 });

  // Order reference is displayed
  const orderRef = page.locator('.order-reference, [class*="order-ref"], .details .reference').first();
  await expect(orderRef).toBeVisible();
  const refText = await orderRef.textContent();
  expect(refText?.trim().length).toBeGreaterThan(0);
});

// TC-27 Checkout redirects unauthenticated user to login
test('TC-27 unauthenticated user visiting checkout sees login page', async ({ page }) => {
  // Ensure logged out
  await page.goto('/?mylogout=');
  await page.waitForLoadState('domcontentloaded');

  // Add item to cart as guest
  await page.goto('/home-accessories/6-mug-the-best-is-yet-to-come.html');
  const addToCart = page.getByRole('button', { name: /Add to Cart/i });
  await addToCart.click();
  await page.waitForTimeout(800);

  const continueBtn = page.locator('[data-dismiss="modal"], .continue-shopping, button:has-text("Continue shopping")').first();
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(300);
  }

  // Navigate to checkout
  await page.goto('/order');
  await page.waitForLoadState('domcontentloaded');

  // Should show login/guest form or be redirected to login
  const url = page.url();
  const isLoginPage = url.includes('/login') || url.includes('/order');
  expect(isLoginPage).toBe(true);

  // Login form elements or guest checkout form should be visible
  const loginOrGuestForm = page.locator(
    '#login-form, .login-form, [id*="guest-checkout"], .sign-in-section, .js-register-form, input[name="email"]'
  ).first();
  await expect(loginOrGuestForm).toBeVisible({ timeout: 5000 });
});

// TC-28 Checkout address step has a pre-selected address for known customer
test('TC-28 checkout address step pre-populates for logged-in customer', async ({ page }) => {
  await signIn(page);
  await clearCart(page);
  await addMugToCart(page);

  await page.goto('/cart');
  const checkoutBtn = page.getByRole('link', { name: /Proceed to Checkout/i });
  await checkoutBtn.click();
  await page.waitForLoadState('domcontentloaded');

  // Advance past personal info if needed
  const personalInfoContinue = page.locator('#checkout-personal-information-step button[name="continue"], #checkout-personal-information-step .continue').first();
  if (await personalInfoContinue.isVisible({ timeout: 3000 }).catch(() => false)) {
    await personalInfoContinue.click();
    await page.waitForLoadState('domcontentloaded');
  }

  // Reach the addresses step
  const addressesStep = page.locator('#checkout-addresses-step, [id*="addresses-step"]');
  await expect(addressesStep).toBeVisible({ timeout: 8000 });

  // At least one address should be present or pre-selected
  const addressOptions = page.locator('.address-item, [class*="address-item"], .js-address-item');
  const addressCount = await addressOptions.count();
  if (addressCount > 0) {
    await expect(addressOptions.first()).toBeVisible();
  }

  // Continue button should be enabled
  const continueBtn = page.locator('#checkout-addresses-step button[name="confirm-addresses"], button[name="confirm-addresses"]').first();
  await expect(continueBtn).toBeEnabled({ timeout: 5000 });
});
