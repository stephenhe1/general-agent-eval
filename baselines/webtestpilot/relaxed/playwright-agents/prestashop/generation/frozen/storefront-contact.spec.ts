import { test, expect } from '@playwright/test';

// TC-49 Contact form renders with required fields
test('TC-49 contact us page shows subject, email, message fields and send button', async ({ page }) => {
  await page.goto('/contact-us');

  // Page heading
  await expect(page.getByRole('heading', { name: /Contact us|Send a message/i })).toBeVisible();

  // Subject dropdown
  const subjectSelect = page.locator('select[name="id_contact"], select#id_contact');
  await expect(subjectSelect).toBeVisible();

  // Email field
  const emailField = page.getByRole('textbox', { name: /email/i });
  await expect(emailField).toBeVisible();

  // Message textarea
  const messageField = page.locator('textarea[name="message"], #message');
  await expect(messageField).toBeVisible();

  // Optional file attachment
  const attachmentField = page.locator('input[type="file"], input[name*="attach"]');
  await expect(attachmentField.first()).toBeVisible();

  // Send button
  const sendBtn = page.getByRole('button', { name: /Send/i });
  await expect(sendBtn).toBeVisible();
});

// TC-50 Contact form submission with empty fields shows validation errors
test('TC-50 submitting empty contact form shows at least one validation error', async ({ page }) => {
  await page.goto('/contact-us');

  // Click Send without filling any fields
  const sendBtn = page.getByRole('button', { name: /Send/i });
  await sendBtn.click();
  await page.waitForTimeout(500);

  // Form should not submit — stay on same page
  await expect(page).toHaveURL(/contact-us/i);

  // At least one validation error should be shown
  const errorMessages = page.locator('.alert-danger, .form-error, [class*="error"]:visible, .has-error, .field-error');
  const count = await errorMessages.count();
  expect(count).toBeGreaterThanOrEqual(1);
});
