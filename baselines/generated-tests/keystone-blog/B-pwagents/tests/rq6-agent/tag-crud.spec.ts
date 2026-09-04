// spec: specs/keystone-blog-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

// Matches a tag item page URL: /tags/<id> where id is a cuid-like string (not "create")
const TAG_ITEM_URL_RE = /\/tags\/(?!create)[a-z0-9]+/;

// Helper: delete the tag on the current item page (waits for redirect to /tags).
async function deleteCurrentTag(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('button:has-text("Delete")').click();
  const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
  await expect(deleteDialog).toBeVisible({ timeout: 5000 });
  await Promise.all([
    page.waitForURL(/\/tags(\?|$)/),
    deleteDialog.locator('button:has-text("Yes, delete")').click(),
  ]);
  await page.waitForLoadState('networkidle');
}

// ─────────────────────────────────────────────────────────────────────────────
// TAG CREATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('TAG-CREATE', () => {

  // TAG-CREATE-01: Create tag with a name
  test('TAG-CREATE-01: Create tag with a name', async ({ page }) => {
    const tagName = `E2E Test Tag ${Date.now()}`;

    // Step 1: Navigate to the create form
    await page.goto('/tags/create');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill Name with a unique name
    await page.locator('label').filter({ hasText: 'Name' }).locator('..').locator('input[type="text"]').fill(tagName);

    // Step 3: Click Create and wait for navigation
    await Promise.all([
      page.waitForURL(TAG_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');

    // Step 4: Assert URL matches /tags/[id]
    await expect(page).toHaveURL(TAG_ITEM_URL_RE);

    // Step 5: Meaningful postcondition — h1 contains the tag name we entered
    await expect(page.locator('h1')).toContainText('E2E Test Tag');

    // Cleanup
    await deleteCurrentTag(page);
  });

  // TAG-CREATE-02: Create tag with empty name (edge case — allowed)
  test('TAG-CREATE-02: Create tag with empty name (edge case — allowed)', async ({ page }) => {
    // Step 1: Navigate to the create form
    await page.goto('/tags/create');
    await page.waitForLoadState('networkidle');

    // Step 2: Leave Name empty

    // Step 3: Click Create
    await Promise.all([
      page.waitForURL(TAG_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');

    // Step 4: Assert URL matches /tags/[id] (navigation occurred — empty name allowed)
    // Note: This verifies the app accepts empty tag names
    await expect(page).toHaveURL(TAG_ITEM_URL_RE);

    // Cleanup
    await deleteCurrentTag(page);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TAG READ
// ─────────────────────────────────────────────────────────────────────────────

test.describe('TAG-READ', () => {

  // TAG-READ-01: Tags list shows existing records
  test('TAG-READ-01: Tags list shows existing records', async ({ page }) => {
    // Step 1: Navigate to the tags list
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert at least one row with a data-href exists
    const tagRows = page.locator('[role="row"][data-href]');
    await expect(tagRows).not.toHaveCount(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TAG UPDATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('TAG-UPDATE', () => {

  // TAG-UPDATE-01: Update tag name and save
  test('TAG-UPDATE-01: Update tag name and save', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const updatedName = `Tag Updated ${uniqueSuffix}`;

    // Step 1: Create a fresh tag to update (avoid mutating seed data)
    await page.goto('/tags/create');
    await page.waitForLoadState('networkidle');
    await page.locator('label').filter({ hasText: 'Name' }).locator('..').locator('input[type="text"]').fill(`Tag For Update ${uniqueSuffix}`);
    await Promise.all([
      page.waitForURL(TAG_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');

    // Step 2: Fill Name with the updated name
    const nameInput = page.locator('label').filter({ hasText: 'Name' }).locator('..').locator('input[type="text"]');
    await nameInput.fill(updatedName);

    // Step 3: Click Save
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(2000);

    // Step 4: Meaningful postcondition — h1 contains the updated tag name
    await expect(page.locator('h1')).toContainText('Tag Updated');

    // Cleanup
    await deleteCurrentTag(page);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TAG DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('TAG-DELETE', () => {

  // TAG-DELETE-01: Delete tag with confirmation
  test('TAG-DELETE-01: Delete tag with confirmation', async ({ page }) => {
    const tagName = `Tag To Delete ${Date.now()}`;

    // Step 1: Create a fresh tag to delete
    await page.goto('/tags/create');
    await page.waitForLoadState('networkidle');
    await page.locator('label').filter({ hasText: 'Name' }).locator('..').locator('input[type="text"]').fill(tagName);
    await Promise.all([
      page.waitForURL(TAG_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(TAG_ITEM_URL_RE);

    // Step 2: Click the Delete button
    await page.locator('button:has-text("Delete")').click();

    // Step 3: Wait for confirmation dialog
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });

    // Step 4: Click "Yes, delete" in the dialog and wait for redirect
    await Promise.all([
      page.waitForURL(/\/tags(\?|$)/),
      deleteDialog.locator('button:has-text("Yes, delete")').click(),
    ]);
    await page.waitForLoadState('networkidle');

    // Step 5: Meaningful postcondition — URL ends with /tags (redirected to list)
    await expect(page).toHaveURL(/\/tags(\?|$)/);
  });

});
