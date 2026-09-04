// spec: specs/keystone-blog-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// LIST SORT
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LIST-SORT', () => {

  // LIST-SORT-01: Sort authors by Name ascending
  test('LIST-SORT-01: Sort authors by Name ascending', async ({ page }) => {
    // Step 1: Navigate to the authors list
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 2: Click the Name column header to sort ascending
    // Keystone renders sortable headers as elements with [aria-sort] attribute
    await page.locator('[aria-sort]').filter({ hasText: 'Name' }).click();
    await page.waitForLoadState('networkidle');

    // Step 3: Assert URL contains sortBy=name
    await expect(page).toHaveURL(/sortBy=name/);

    // Step 4: Meaningful postcondition — collect visible author names and assert alphabetical order
    // Extract only the first rowheader (Name column) to avoid name+email concatenation issues
    const rows = page.locator('[role="row"][data-href]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const nameCell = rows.nth(i).locator('[role="rowheader"]').first();
      const text = await nameCell.textContent();
      if (text) names.push(text.trim());
    }
    // Check names are in ascending alphabetical order (case-insensitive)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    expect(names).toEqual(sorted);
  });

  // LIST-SORT-02: Sort authors by Name descending
  test('LIST-SORT-02: Sort authors by Name descending', async ({ page }) => {
    // Step 1: Navigate to the authors list already sorted ascending
    await page.goto('/authors?sortBy=name');
    await page.waitForLoadState('networkidle');

    // Step 2: Click the Name column header a second time to sort descending
    await page.locator('[aria-sort]').filter({ hasText: 'Name' }).click();
    await page.waitForLoadState('networkidle');

    // Step 3: Assert URL contains sortBy=-name (descending)
    await expect(page).toHaveURL(/sortBy=-name/);

    // Step 4: Meaningful postcondition — collect visible author names and assert reverse alphabetical order
    // Extract only the first rowheader (Name column) to avoid name+email concatenation issues
    const rows = page.locator('[role="row"][data-href]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const nameCell = rows.nth(i).locator('[role="rowheader"]').first();
      const text = await nameCell.textContent();
      if (text) names.push(text.trim());
    }
    const sortedDesc = [...names].sort((a, b) => b.localeCompare(a, undefined, { sensitivity: 'base' }));
    expect(names).toEqual(sortedDesc);
  });

  // LIST-SORT-03: Sort posts by Status
  test('LIST-SORT-03: Sort posts by Status', async ({ page }) => {
    // Step 1: Navigate to the posts list
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    // Step 2: Click the Status column header to sort ascending
    await page.locator('[aria-sort]').filter({ hasText: 'Status' }).click();
    await page.waitForLoadState('networkidle');

    // Step 3: Assert URL contains sortBy=status
    await expect(page).toHaveURL(/sortBy=status/);

    // Step 4: Meaningful postcondition — at least one row is visible after sort
    const rows = page.locator('[role="row"][data-href]');
    await expect(rows).not.toHaveCount(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// LIST FILTER
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LIST-FILTER', () => {

  // LIST-FILTER-01: Filter authors by Name containing a unique token
  test('LIST-FILTER-01: Filter authors by Name containing "Frank"', async ({ page }) => {
    const AUTHOR_ITEM_URL_RE = /\/authors\/(?!create)[a-z0-9]+/;
    const filterToken = `Frank${Date.now()}`;

    // Setup: Create a test author whose name contains the filter token
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="text"]').first().fill(`L. ${filterToken} Baum`);
    await page.locator('input[type="text"]').nth(1).fill(`filter-test-${Date.now()}@example.com`);
    await Promise.all([
      page.waitForURL(AUTHOR_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');
    const authorUrl = page.url();

    // Step 1: Navigate to the authors list
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 2: Click the Filter button to open the filter field chooser
    await page.locator('button:has-text("Filter")').click();
    await page.waitForTimeout(300);

    // Step 3: Click "Name" from the filter menu
    await page.locator('[role="menuitem"]:has-text("Name")').click();
    await page.waitForTimeout(300);

    // Step 4: Fill the unique filter token in the filter value input
    await page.locator('input[type="text"]').last().fill(filterToken);

    // Step 5: Click the "Add" button to apply the filter
    await page.locator('button:has-text("Add")').last().click();
    await page.waitForLoadState('networkidle');

    // Step 6: Assert URL contains the filter parameter
    await expect(page).toHaveURL(/filter=/);

    // Step 7: Meaningful postcondition — only authors containing the filter token are shown
    const rows = page.locator('[role="row"][data-href]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // All visible rows should contain the filter token somewhere in their text
    for (let i = 0; i < count; i++) {
      const text = (await rows.nth(i).textContent()) ?? '';
      expect(text.toLowerCase()).toContain(filterToken.toLowerCase());
    }

    // Cleanup: delete the test author
    await page.goto(authorUrl);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Delete")').click();
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });
    await deleteDialog.locator('button:has-text("Yes, delete")').click();
    await page.waitForLoadState('networkidle');
  });

  // LIST-FILTER-02: Filter posts by Status = Published
  test('LIST-FILTER-02: Filter posts by Status = Published', async ({ page }) => {
    // Step 1: Navigate to the posts list
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    // Step 2: Open the Filter menu
    await page.locator('button:has-text("Filter")').click();
    await page.waitForTimeout(300);

    // Step 3: Click "Status" from the filter menu
    await page.locator('[role="menuitem"]:has-text("Status")').click();
    await page.waitForTimeout(300);

    // Step 4: Select the "published" option in the status filter grid
    // Keystone renders enum filter options as [role="row"] items in a [role="grid"] panel
    // Each option has a data-key matching the enum value and contains a checkbox
    const filterGrid = page.locator('[role="grid"][aria-label="Matches"]');
    const publishedRow = filterGrid.locator('[role="row"][data-key="published"]');
    await publishedRow.locator('input[aria-label="Select"]').click();
    await page.waitForTimeout(200);

    // Step 5: Click the "Add" button to apply the filter
    await page.locator('button:has-text("Add")').last().click();
    await page.waitForLoadState('networkidle');

    // Step 6: Assert URL contains the filter parameter
    await expect(page).toHaveURL(/filter=/);

    // Step 7: Meaningful postcondition — at least one published post row is visible
    const rows = page.locator('[role="row"][data-href]');
    await expect(rows).not.toHaveCount(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// LIST COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LIST-COLUMNS', () => {

  // LIST-COLUMNS-01: Toggle Email column off then back on
  test('LIST-COLUMNS-01: Toggle Email column off then back on', async ({ page }) => {
    // Step 1: Navigate to the authors list with all default columns
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert the Email column header is initially visible
    const emailHeader = page.locator('[aria-sort]').filter({ hasText: 'Email' });
    await expect(emailHeader).toBeVisible();

    // Step 3: Open the Columns toggle menu
    await page.locator('button:has-text("Columns")').click();
    await page.waitForTimeout(300);

    // Step 4: Click the Email checkbox in the columns menu to hide it
    // Keystone renders column toggles as [role="menuitemcheckbox"] with data-key attribute
    await page.locator('[role="menuitemcheckbox"][data-key="email"]').click();
    await page.waitForTimeout(300);

    // Step 5: Close the menu by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    // Step 6: Meaningful postcondition — Email column header is no longer visible
    await expect(emailHeader).not.toBeVisible();

    // Step 7: Re-open the Columns menu and toggle Email back on
    await page.locator('button:has-text("Columns")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="menuitemcheckbox"][data-key="email"]').click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    // Step 8: Assert the Email column header is visible again
    await expect(emailHeader).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// LIST PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LIST-PAGINATION', () => {

  // LIST-PAGINATION-01: Change per-page count to 10
  test('LIST-PAGINATION-01: Change per-page count to 10', async ({ page }) => {
    // Step 1: Navigate to the authors list
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Step 2: Find the per-page select control and change it to 10
    // Keystone renders the page size selector as a <select> element
    const perPageSelect = page.locator('select').first();
    await expect(perPageSelect).toBeVisible();
    await perPageSelect.selectOption('10');
    await page.waitForLoadState('networkidle');

    // Step 3: Assert URL reflects the per-page=10 parameter
    await expect(page).toHaveURL(/pageSize=10/);

    // Step 4: Meaningful postcondition — the select now shows 10 as its value
    await expect(perPageSelect).toHaveValue('10');
  });

});
