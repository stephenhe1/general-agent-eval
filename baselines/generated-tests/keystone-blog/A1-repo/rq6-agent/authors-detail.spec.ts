import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Helper: create a fresh author and land on its detail page.
 * Uses CUID length (25 chars) to avoid matching the create page URL ("create" is 6 chars).
 */
async function createAuthor(page: Page, name: string, email: string): Promise<string> {
  await page.goto('/authors/create');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name*').fill(name);
  await page.getByLabel('Email*').fill(email);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/\/authors\/[a-z0-9]{20,}$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return page.url();
}

test.describe('Author Detail Page (/authors/[id])', () => {
  test('loads with correct field values for a seeded author', async ({ page }) => {
    // Navigate via the list page and use data-href
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'Arthur Conan Doyle' }).first();
    const href = await row.getAttribute('data-href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // Heading
    await expect(page.getByRole('heading', { name: 'Arthur Conan Doyle' })).toBeVisible();

    // Name field has correct value
    const nameInput = page.getByLabel('Name*');
    await expect(nameInput).toHaveValue('Arthur Conan Doyle');

    // Email field has correct value
    const emailInput = page.getByLabel('Email*');
    await expect(emailInput).toHaveValue('arthur.cd@email.com');

    // Action buttons present
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('edit author name: Save persists the new value', async ({ page }) => {
    const originalName = `EditMe ${Date.now()}`;
    const updatedName = `EditMe Updated ${Date.now()}`;
    const email = `editme${Date.now()}@example.com`;

    // Create a fresh author and land on detail page
    await createAuthor(page, originalName, email);

    // Wait for form to be hydrated with the original value
    const nameInput = page.getByLabel('Name*');
    await expect(nameInput).toHaveValue(originalName);

    // Change the name
    await nameInput.fill(updatedName);

    // Save button should be enabled after change
    const saveBtn = page.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');

    // The heading and Name field should reflect the updated name
    await expect(page.getByLabel('Name*')).toHaveValue(updatedName);
    await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();

    // Verify it appears in the list via search (Keystone uses virtual scrolling)
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(updatedName);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  test('reset discards unsaved changes', async ({ page }) => {
    const originalName = `ResetMe ${Date.now()}`;
    const email = `resetme${Date.now()}@example.com`;

    await createAuthor(page, originalName, email);

    // Wait for form hydration
    const nameInput = page.getByLabel('Name*');
    await expect(nameInput).toHaveValue(originalName);

    // Change name without saving
    await nameInput.fill('Temporary Changed Name');
    await expect(nameInput).toHaveValue('Temporary Changed Name');

    // Verify Reset is enabled (form is dirty)
    const resetBtn = page.getByRole('button', { name: 'Reset' });
    await expect(resetBtn).toBeEnabled();

    // Click Reset — Keystone shows a confirmation dialog
    await resetBtn.click();
    await page.waitForTimeout(300);

    // Confirm in the "Reset changes" dialog
    const resetDialog = page.getByRole('alertdialog').filter({ hasText: 'Reset changes' });
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole('button', { name: 'Yes, reset' }).click();
    await page.waitForLoadState('networkidle');

    // Name should revert to original
    await expect(nameInput).toHaveValue(originalName);
  });

  test('delete author: confirmation dialog and removal from list', async ({ page }) => {
    const name = `DeleteMe ${Date.now()}`;
    const email = `deleteme${Date.now()}@example.com`;

    await createAuthor(page, name, email);

    // Wait for page to load
    await expect(page.getByLabel('Name*')).toHaveValue(name);

    // Click Delete
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    // Confirmation dialog (alertdialog role) should appear
    const dialog = page.getByRole('alertdialog').filter({ hasText: 'Are you sure' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Are you sure you want to delete/)).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    // Wait for navigation to authors list
    await page.waitForURL(/\/authors/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    // Confirm the authors list page is fully rendered
    await expect(page.getByRole('heading', { name: 'Authors' })).toBeVisible();

    // Author should not be in any list row
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);
  });

  test('delete author: Cancel keeps the author', async ({ page }) => {
    const name = `CancelDelete ${Date.now()}`;
    const email = `canceldelete${Date.now()}@example.com`;

    await createAuthor(page, name, email);

    await expect(page.getByLabel('Name*')).toHaveValue(name);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    // Find and cancel the confirmation dialog
    const dialog = page.getByRole('alertdialog').filter({ hasText: 'Are you sure' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Should remain on the author detail page
    await expect(page).toHaveURL(/\/authors\/[a-z0-9]{20,}$/);
    await expect(page.getByLabel('Name*')).toHaveValue(name);
  });

  test('Item ID field shows the author id and has copy button', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'Arthur Conan Doyle' }).first();
    const href = await row.getAttribute('data-href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    const itemIdInput = page.getByLabel('Item ID');
    await expect(itemIdInput).toBeVisible();
    const idValue = await itemIdInput.inputValue();
    expect(idValue.length).toBeGreaterThan(0);

    // Copy button
    await expect(page.getByRole('button', { name: 'copy id' })).toBeVisible();
  });

  test('author detail shows existing posts relationship', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'Arthur Conan Doyle' }).first();
    const href = await row.getAttribute('data-href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // Arthur should have "The Adventures of Sherlock Holmes" as a post
    await expect(page.getByText('The Adventures of Sherlock Holmes')).toBeVisible();
  });
});
