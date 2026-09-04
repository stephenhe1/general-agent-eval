// spec: specs/keystone-blog-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

// Matches an author item page URL: /authors/<id> where id is a cuid-like string (not "create")
const AUTHOR_ITEM_URL_RE = /\/authors\/(?!create)[a-z0-9]+/;

// Helper: navigate to the first author's item page from the list
async function getFirstAuthorHref(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  const firstRow = page.locator('[role="row"][data-href]').first();
  const href = await firstRow.getAttribute('data-href');
  if (!href) throw new Error('No author row with data-href found');
  return href;
}

// Helper: create a fresh author and return its item page URL.
// Waits until the page navigates away from /authors/create to the new item page.
async function createAuthor(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
): Promise<string> {
  await page.goto('/authors/create');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="text"]').first().fill(name);
  await page.locator('input[type="text"]').nth(1).fill(email);
  // Wait for URL to reach the new item page after clicking Create
  await Promise.all([
    page.waitForURL(AUTHOR_ITEM_URL_RE),
    page.locator('button:has-text("Create")').click(),
  ]);
  await page.waitForLoadState('networkidle');
  return page.url();
}

// Helper: delete the author at the current item page and wait for redirect to list.
// Uses the "Delete item" alertdialog (filtered by content) to avoid matching
// the "Author created" toast alertdialog that may also be present.
async function deleteCurrentAuthor(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('button:has-text("Delete")').click();
  // Filter the correct dialog — the "Author created" toast also uses alertdialog
  const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
  await expect(deleteDialog).toBeVisible({ timeout: 5000 });
  // Wait for navigation back to the list after confirming delete
  await Promise.all([
    page.waitForURL(/\/authors(\?|$)/),
    deleteDialog.locator('button:has-text("Yes, delete")').click(),
  ]);
  await page.waitForLoadState('networkidle');
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHOR CREATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AUTHOR-CREATE', () => {

  // AUTHOR-CREATE-01: Create author with valid required fields
  test('AUTHOR-CREATE-01: Create author with valid required fields', async ({ page }) => {
    const name = 'Test Author Create';
    const email = `test-create-${Date.now()}@example.com`;

    // Step 1: Navigate to the create form
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill the Name field
    await page.locator('input[type="text"]').first().fill(name);

    // Step 3: Fill the Email field
    await page.locator('input[type="text"]').nth(1).fill(email);

    // Step 4: Click "Create" to submit and wait for navigation to the new item page
    await Promise.all([
      page.waitForURL(AUTHOR_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');

    // Step 5: Assert URL navigated to the new author's item page (not the create page)
    await expect(page).toHaveURL(AUTHOR_ITEM_URL_RE);

    // Step 6: Meaningful postcondition — h1 reflects the new author's name
    await expect(page.locator('h1')).toContainText(name);

    // Cleanup
    await deleteCurrentAuthor(page);
  });

  // AUTHOR-CREATE-02: Validation — missing required Name
  test('AUTHOR-CREATE-02: Validation — missing required Name', async ({ page }) => {
    // Step 1: Navigate to the create form
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    // Step 2: Leave Name empty, fill only Email
    await page.locator('input[type="text"]').nth(1).fill('validation@example.com');

    // Step 3: Click Create
    await page.locator('button:has-text("Create")').click();
    await page.waitForTimeout(500);

    // Step 4: Assert URL still ends with /authors/create (no navigation)
    await expect(page).toHaveURL(/\/authors\/create$/);

    // Step 5: Assert validation error is visible near the Name field
    await expect(page.getByText('Name must not be empty')).toBeVisible();
  });

  // AUTHOR-CREATE-03: Validation — missing required Email
  test('AUTHOR-CREATE-03: Validation — missing required Email', async ({ page }) => {
    // Step 1: Navigate to the create form
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill Name, leave Email empty
    await page.locator('input[type="text"]').first().fill('No Email Author');

    // Step 3: Click Create
    await page.locator('button:has-text("Create")').click();
    await page.waitForTimeout(500);

    // Step 4: Assert URL still ends with /authors/create
    await expect(page).toHaveURL(/\/authors\/create$/);

    // Step 5: Assert validation error is visible near the Email field
    await expect(page.getByText('Email must not be empty')).toBeVisible();
  });

  // AUTHOR-CREATE-04: "Create another" button after creation
  test('AUTHOR-CREATE-04: "Create another" button after creation', async ({ page }) => {
    const name = 'Create Another Test';
    const email = `another-${Date.now()}@example.com`;

    // Step 1: Navigate to the create form
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill Name and Email
    await page.locator('input[type="text"]').first().fill(name);
    await page.locator('input[type="text"]').nth(1).fill(email);

    // Step 3: Click Create and wait for navigation to the new author item page
    await Promise.all([
      page.waitForURL(AUTHOR_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');

    // Confirm we are on the new author item page
    await expect(page).toHaveURL(AUTHOR_ITEM_URL_RE);

    // Step 4: Assert "Create another" button is visible on the item page
    const createAnotherBtn = page.locator('button:has-text("Create another")');
    await expect(createAnotherBtn).toBeVisible();

    // Step 5: Click "Create another" and assert URL ends with /authors/create
    await createAnotherBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/authors\/create$/);

    // Cleanup: find and delete the author created in this test
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');
    const rows = await page.locator('[role="row"][data-href]').all();
    for (const row of rows) {
      const text = await row.textContent();
      if (text?.includes(name)) {
        const href = await row.getAttribute('data-href');
        if (href) {
          await page.goto(href);
          await page.waitForLoadState('networkidle');
          await deleteCurrentAuthor(page);
        }
        break;
      }
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHOR READ
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AUTHOR-READ', () => {

  // AUTHOR-READ-01: Authors list shows existing records
  test('AUTHOR-READ-01: Authors list shows existing records', async ({ page }) => {
    // Step 1: Navigate to the authors list
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert at least one row with a data-href exists (these are the author item links)
    // Keystone's list view uses [role="row"][data-href] — not standard <a> elements
    const authorRows = page.locator('[role="row"][data-href]');
    await expect(authorRows).not.toHaveCount(0);
  });

  // AUTHOR-READ-02: View author item page
  test('AUTHOR-READ-02: View author item page', async ({ page }) => {
    // Step 1: Navigate to the authors list
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 2: Get the first author's href from the row's data-href attribute
    const firstRow = page.locator('[role="row"][data-href]').first();
    const href = await firstRow.getAttribute('data-href');
    expect(href).toBeTruthy();
    expect(href).toMatch(AUTHOR_ITEM_URL_RE);

    // Step 3: Navigate to the author item page
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // Step 4: Assert URL matches the author item page pattern
    await expect(page).toHaveURL(AUTHOR_ITEM_URL_RE);

    // Step 5: Assert h1 is non-empty
    await expect(page.locator('h1')).not.toBeEmpty();

    // Step 6: Assert Name and Email inputs are present and populated
    const nameInput = page.locator('input[type="text"]').first();
    const emailInput = page.locator('input[type="text"]').nth(1);

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();

    // Meaningful postcondition: both inputs have non-empty values
    const nameValue = await nameInput.inputValue();
    const emailValue = await emailInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);
    expect(emailValue.length).toBeGreaterThan(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHOR UPDATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AUTHOR-UPDATE', () => {

  // AUTHOR-UPDATE-01: Update author name and save
  test('AUTHOR-UPDATE-01: Update author name and save', async ({ page }) => {
    const uniqueSuffix = Date.now();

    // Step 1: Create a fresh author to update (avoids mutating seed data permanently)
    const originalName = `Author Update Test ${uniqueSuffix}`;
    const authorUrl = await createAuthor(page, originalName, `update-${uniqueSuffix}@example.com`);

    // Step 2: Navigate to the author item page
    await page.goto(authorUrl);
    await page.waitForLoadState('networkidle');

    // Step 3: Read the current Name value and verify it matches what we created
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toHaveValue(originalName);

    // Step 4: Fill the Name input with a unique updated name
    const updatedName = `Author Updated Name ${uniqueSuffix}`;
    await nameInput.fill(updatedName);

    // Step 5: Click Save
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(2000);

    // Step 6: Meaningful postcondition — h1 now contains the updated name
    await expect(page.locator('h1')).toContainText(updatedName);

    // Cleanup
    await deleteCurrentAuthor(page);
  });

  // AUTHOR-UPDATE-02: Reset button is present; navigating away discards unsaved changes
  test('AUTHOR-UPDATE-02: Reset button is present on author edit page', async ({ page }) => {
    // Step 1: Navigate to an author item page
    const href = await getFirstAuthorHref(page);
    await page.goto(href);
    await page.waitForLoadState('networkidle');

    // Step 2: Read the current Name value
    const nameInput = page.locator('input[type="text"]').first();
    const originalName = await nameInput.inputValue();
    expect(originalName.length).toBeGreaterThan(0);

    // Step 3: Fill Name with a new value to trigger an unsaved change
    await nameInput.fill('WILL BE DISCARDED');

    // Step 4: Assert the Reset button is visible
    const resetBtn = page.locator('button:has-text("Reset")');
    await expect(resetBtn).toBeVisible();

    // Step 5: Click Reset
    await resetBtn.click();
    await page.waitForTimeout(500);

    // Step 6: Meaningful postcondition — navigating back to the author's page shows the
    // original value is still stored on the server (Reset did not save the change)
    await page.goto(href);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="text"]').first()).toHaveValue(originalName);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHOR DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AUTHOR-DELETE', () => {

  // AUTHOR-DELETE-01: Delete author with confirmation
  test('AUTHOR-DELETE-01: Delete author with confirmation', async ({ page }) => {
    // Step 1: Create a fresh author specifically for this deletion test
    // Use a unique email to avoid conflicts if the test has run before
    const uniqueEmail = `delete-${Date.now()}@example.com`;
    await createAuthor(page, 'Author To Delete', uniqueEmail);
    await expect(page).toHaveURL(AUTHOR_ITEM_URL_RE);

    // Step 2: Click the Delete button on the item page
    await page.locator('button:has-text("Delete")').click();

    // Step 3: Wait for and assert the "Delete item" confirmation dialog
    // Note: the "Author created" toast also uses [role="alertdialog"] — filter by content
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });

    // Step 4: Assert the dialog has the confirmation message
    await expect(deleteDialog).toContainText('Are you sure');

    // Step 5: Click "Yes, delete" inside the dialog and wait for redirect
    await Promise.all([
      page.waitForURL(/\/authors(\?|$)/),
      deleteDialog.locator('button:has-text("Yes, delete")').click(),
    ]);
    await page.waitForLoadState('networkidle');

    // Step 6: Meaningful postcondition — redirected to the authors list (h1 is "Authors")
    await expect(page.locator('h1')).toContainText('Authors');
  });

  // AUTHOR-DELETE-02: Cancel author deletion
  test('AUTHOR-DELETE-02: Cancel author deletion', async ({ page }) => {
    // Step 1: Navigate to an existing author item page
    const href = await getFirstAuthorHref(page);
    await page.goto(href);
    await page.waitForLoadState('networkidle');

    const authorUrl = page.url();
    await expect(page).toHaveURL(AUTHOR_ITEM_URL_RE);

    // Step 2: Click the Delete button to open the confirmation dialog
    await page.locator('button:has-text("Delete")').click();

    // Step 3: Wait for the delete confirmation alertdialog
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });

    // Step 4: Click Cancel in the dialog
    await deleteDialog.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Step 5: Assert the delete dialog is gone
    await expect(deleteDialog).toHaveCount(0);

    // Step 6: Meaningful postcondition — URL still matches the author item page (not redirected)
    await expect(page).toHaveURL(AUTHOR_ITEM_URL_RE);
    expect(page.url()).toBe(authorUrl);
  });

});
