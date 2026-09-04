// spec: specs/keystone-blog-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

// Matches an author item page URL: /authors/<id>
const AUTHOR_ITEM_URL_RE = /\/authors\/(?!create)[a-z0-9]+/;

// Helper: create a fresh author and return its item page URL.
async function createAuthor(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
): Promise<string> {
  await page.goto('/authors/create');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="text"]').first().fill(name);
  await page.locator('input[type="text"]').nth(1).fill(email);
  await Promise.all([
    page.waitForURL(AUTHOR_ITEM_URL_RE),
    page.locator('button:has-text("Create")').click(),
  ]);
  await page.waitForLoadState('networkidle');
  return page.url();
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST BULK DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LIST-BULK-DELETE', () => {

  // LIST-BULK-DELETE-01: Select two authors and bulk-delete them
  test('LIST-BULK-DELETE-01: Select two authors and bulk-delete them', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create two fresh authors to bulk-delete (avoids touching seed data)
    await createAuthor(page, `Bulk Delete A ${ts}`, `bulk-a-${ts}@example.com`);
    await createAuthor(page, `Bulk Delete B ${ts}`, `bulk-b-${ts}@example.com`);

    // Step 2: Navigate to the authors list
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 3: Select the first two author rows using the row-level checkboxes
    // Keystone renders per-row selection as input[aria-label="Select"] inside each row
    const checkboxes = page.locator('input[aria-label="Select"]');
    await expect(checkboxes).not.toHaveCount(0);
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Step 4: Assert the bulk-action "Delete" button appears after selection
    const bulkDeleteBtn = page.locator('button:has-text("Delete")').filter({ hasText: /Delete/i });
    await expect(bulkDeleteBtn.first()).toBeVisible({ timeout: 5000 });

    // Step 5: Click the bulk Delete button
    await bulkDeleteBtn.first().click();
    await page.waitForTimeout(300);

    // Step 6: Wait for and assert the confirmation dialog
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });
    await expect(deleteDialog).toContainText('Are you sure');

    // Step 7: Confirm deletion and wait for the page to reload
    await deleteDialog.locator('button:has-text("Yes, delete")').click();
    await page.waitForLoadState('networkidle');

    // Step 8: Meaningful postcondition — the two bulk-deleted authors no longer appear in the list
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toContain(`Bulk Delete A ${ts}`);
    expect(pageText).not.toContain(`Bulk Delete B ${ts}`);
  });

  // LIST-BULK-DELETE-02: Cancel bulk delete — authors remain in list
  test('LIST-BULK-DELETE-02: Cancel bulk delete — authors remain in list', async ({ page }) => {
    // Step 1: Navigate to the authors list
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 2: Record the initial total author count from the pagination summary.
    // Note: DOM row counts are unreliable with Keystone's virtualised list renderer —
    // selecting a row removes data-href/data-key from DOM rows due to re-rendering.
    // The pagination element ([aria-label="Pagination"]) always shows the true total.
    const paginationEl = page.locator('[aria-label="Pagination"]');
    const initialPaginationText = await paginationEl.innerText();
    const initialMatch = initialPaginationText.match(/(\d+) Authors/);
    expect(initialMatch).not.toBeNull();
    const initialCount = parseInt(initialMatch![1]);
    expect(initialCount).toBeGreaterThan(0);

    // Step 3: Select the first author row
    const checkboxes = page.locator('input[aria-label="Select"]');
    await checkboxes.nth(0).check();

    // Step 4: Click the bulk Delete button to open the confirmation dialog
    const bulkDeleteBtn = page.locator('button:has-text("Delete")').first();
    await expect(bulkDeleteBtn).toBeVisible({ timeout: 5000 });
    await bulkDeleteBtn.click();
    await page.waitForTimeout(300);

    // Step 5: Assert the delete confirmation dialog is visible
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });

    // Step 6: Click Cancel in the dialog
    await deleteDialog.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Step 7: Assert the dialog is closed
    await expect(deleteDialog).toHaveCount(0);

    // Step 8: Meaningful postcondition — the total count is unchanged (no items were deleted)
    const afterPaginationText = await paginationEl.innerText();
    const afterMatch = afterPaginationText.match(/(\d+) Authors/);
    expect(afterMatch).not.toBeNull();
    const afterCount = parseInt(afterMatch![1]);
    expect(afterCount).toBe(initialCount);
  });

});
