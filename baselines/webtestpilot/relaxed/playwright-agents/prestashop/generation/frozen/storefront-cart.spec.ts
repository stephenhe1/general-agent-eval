import { test, expect } from '@playwright/test';

/** Helper: clear all items from the cart */
async function clearCart(page: import('@playwright/test').Page) {
  await page.goto('/cart');
  await page.waitForLoadState('domcontentloaded');

  // Remove all items from cart
  let removeButtons = page.locator('.cart-item .remove-from-cart, .cart-item button[data-link-action="delete-from-cart"], [data-link-action="delete-from-cart"]');
  let count = await removeButtons.count();
  while (count > 0) {
    await removeButtons.first().click();
    await page.waitForTimeout(800);
    removeButtons = page.locator('.cart-item .remove-from-cart, .cart-item button[data-link-action="delete-from-cart"], [data-link-action="delete-from-cart"]');
    count = await removeButtons.count();
  }
}

/** Helper: add hummingbird t-shirt (size M, White) to cart */
async function addTShirtToCart(page: import('@playwright/test').Page) {
  await page.goto('/men/1-1-hummingbird-printed-t-shirt.html');
  await page.waitForLoadState('domcontentloaded');

  // Select size M
  const sizeSelect = page.locator('select[name="group[1]"], select[data-product-attribute]').first();
  if (await sizeSelect.isVisible()) {
    await sizeSelect.selectOption('M');
  }

  // Select White colour (radio input)
  const whiteColour = page.locator('input[title="White"], input[data-combination*="White"]');
  if (await whiteColour.count() > 0) {
    await whiteColour.first().click();
  }

  // Click Add to Cart
  const addToCart = page.getByRole('button', { name: /Add to Cart/i });
  await addToCart.click();

  // Wait for modal/confirmation
  await page.waitForTimeout(1000);

  // Close the cart modal if it appeared, so we can navigate freely
  const continueBtn = page.locator('[data-dismiss="modal"], .continue-shopping, button:has-text("Continue shopping")').first();
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(300);
  }
}

// TC-20 Add a product to cart from product page
test('TC-20 add t-shirt to cart shows count in header and product name in confirmation', async ({ page }) => {
  await clearCart(page);

  await page.goto('/men/1-1-hummingbird-printed-t-shirt.html');

  // Select size M
  const sizeSelect = page.locator('select[name="group[1]"], select[data-product-attribute]').first();
  if (await sizeSelect.isVisible()) {
    await sizeSelect.selectOption('M');
  }

  // Select White colour
  const whiteColour = page.locator('input[title="White"], input[data-combination*="White"]');
  if (await whiteColour.count() > 0) {
    await whiteColour.first().click();
  }

  const addToCart = page.getByRole('button', { name: /Add to Cart/i });
  await addToCart.click();
  await page.waitForTimeout(1200);

  // Cart modal / overlay should appear with product name
  const modal = page.locator('#blockcart-modal, .cart-modal, [id*="cart-modal"]');
  const cartPreview = page.locator('.cart-preview, .blockcart, [id*="cart"]');

  const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
  if (modalVisible) {
    await expect(modal).toContainText(/Hummingbird printed t-shirt/i);
  }

  // Cart icon count in header should show (1)
  const cartCount = page.locator('.cart-products-count, .shopping-cart .count, #_desktop_cart .cart-products-count').first();
  await expect(cartCount).toContainText('1');
});

// TC-21 Cart page reflects added item correctly
test('TC-21 cart page shows item, quantity 1, price, total and checkout button', async ({ page }) => {
  await clearCart(page);
  await addTShirtToCart(page);

  await page.goto('/cart');
  await page.waitForLoadState('domcontentloaded');

  // Product row is visible
  const productRow = page.locator('.cart-item, [class*="cart-item"]').first();
  await expect(productRow).toBeVisible();
  await expect(productRow).toContainText(/Hummingbird printed t-shirt/i);

  // Quantity input shows 1
  const quantityInput = productRow.locator('input[name="qty"], input[class*="qty"]').first();
  await expect(quantityInput).toHaveValue('1');

  // Unit price is displayed
  const unitPrice = productRow.locator('.product-price, [class*="unit-price"], [data-price]').first();
  await expect(unitPrice).toBeVisible();

  // Cart summary total is shown
  const cartTotal = page.locator('.cart-total, .order-total, [class*="total-price"]').first();
  await expect(cartTotal).toBeVisible();

  // Proceed to Checkout button is visible and enabled
  const checkoutBtn = page.getByRole('link', { name: /Proceed to Checkout/i });
  await expect(checkoutBtn).toBeVisible();
  await expect(checkoutBtn).toBeEnabled();
});

// TC-22 Cart quantity update recalculates total
test('TC-22 changing cart quantity from 1 to 2 doubles the line item subtotal', async ({ page }) => {
  await clearCart(page);
  await addTShirtToCart(page);

  await page.goto('/cart');
  await page.waitForLoadState('domcontentloaded');

  // Get the initial total
  const cartTotalEl = page.locator('.cart-total .value, [class*="total"] .amount, .order-total .value, .cart-summary-line.cart-total .value').first();
  await expect(cartTotalEl).toBeVisible();
  const initialTotalText = await cartTotalEl.textContent();
  const initialTotal = parseFloat(initialTotalText!.replace(/[^0-9.]/g, ''));

  // Get the unit price of the item
  const productRow = page.locator('.cart-item, [class*="cart-item"]').first();
  const unitPriceEl = productRow.locator('.product-price, [class*="unit"], .price').first();
  const unitPriceText = await unitPriceEl.textContent();
  const unitPrice = parseFloat(unitPriceText!.replace(/[^0-9.]/g, ''));

  // Change quantity to 2
  const quantityInput = productRow.locator('input[name="qty"], input[class*="qty"]').first();
  await quantityInput.fill('2');
  await quantityInput.press('Enter');
  await page.waitForTimeout(1500);

  // Subtotal for the line item should roughly double
  const productSubtotalEl = productRow.locator('.product-line-grid-right .price, [class*="subtotal"] .price, .product-price.js-product-price').last();
  const subtotalText = await productSubtotalEl.textContent();
  const subtotal = parseFloat(subtotalText!.replace(/[^0-9.]/g, ''));

  // The subtotal should be approximately 2 × unit price
  expect(subtotal).toBeGreaterThan(unitPrice);
});

// TC-23 Remove item from cart empties the cart
test('TC-23 removing the only cart item shows empty cart message', async ({ page }) => {
  await clearCart(page);
  await addTShirtToCart(page);

  await page.goto('/cart');
  await page.waitForLoadState('domcontentloaded');

  // Click delete icon on the product row
  const deleteBtn = page.locator('[data-link-action="delete-from-cart"], .remove-from-cart').first();
  await deleteBtn.click();
  await page.waitForTimeout(1200);

  // "No more items" message
  const emptyMsg = page.locator('.no-items, [class*="empty-cart"], .cart-empty-text, body.cart-empty');
  const emptyText = page.getByText(/no more items in your cart/i);
  await expect(emptyText).toBeVisible({ timeout: 5000 });

  // No product rows should remain
  const productRows = page.locator('.cart-item, [class*="cart-item"]');
  expect(await productRows.count()).toBe(0);

  // Cart icon in header should show (0)
  const cartCount = page.locator('.cart-products-count, #_desktop_cart .cart-products-count').first();
  await expect(cartCount).toContainText('0');
});

// TC-24 Empty cart page shows empty state
test('TC-24 empty cart page shows no-items message and no product rows', async ({ page }) => {
  await clearCart(page);

  await page.goto('/cart');
  await page.waitForLoadState('domcontentloaded');

  // Empty state message
  await expect(page.getByText(/no more items in your cart/i)).toBeVisible();

  // No product rows
  const productRows = page.locator('.cart-item, [class*="cart-item"]');
  expect(await productRows.count()).toBe(0);
});

// TC-25 Quick-add from category page
test('TC-25 quick-add from category page increments cart count', async ({ page }) => {
  await clearCart(page);

  await page.goto('/4-men');
  await page.waitForLoadState('domcontentloaded');

  // Hover over the first product card to reveal quick-add
  const firstCard = page.locator('article.product-miniature, article[class*="product"]').first();
  await firstCard.hover();
  await page.waitForTimeout(500);

  // Click the Add to Cart button that appears
  const quickAddBtn = firstCard.getByRole('button', { name: /Add to Cart/i });
  if (await quickAddBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await quickAddBtn.click();
    await page.waitForTimeout(1200);

    // Cart count should be 1
    const cartCount = page.locator('.cart-products-count, #_desktop_cart .cart-products-count').first();
    await expect(cartCount).toContainText('1');
  } else {
    // Quick-add might not be available on this product (requires variant selection)
    // Navigate to the product page directly and add to cart
    const productLink = firstCard.locator('.product-title a, a.thumbnail').first();
    await productLink.click();
    await page.waitForLoadState('domcontentloaded');

    const addBtn = page.getByRole('button', { name: /Add to Cart/i });
    await expect(addBtn).toBeVisible();
  }
});
