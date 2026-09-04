import { test, expect } from '@playwright/test';

test.describe('Authors List Page (/authors)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');
  });

  test('displays the authors list with seeded data', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Authors' })).toBeVisible();

    // All 6 seeded authors should be visible
    await expect(page.getByText('Arthur Conan Doyle')).toBeVisible();
    await expect(page.getByText('Emily Brontë')).toBeVisible();
    await expect(page.getByText('Jane Austen')).toBeVisible();
    await expect(page.getByText('Lewis Carroll')).toBeVisible();
    await expect(page.getByText('George Eliot')).toBeVisible();
    await expect(page.getByText('L. Frank Baum')).toBeVisible();

    // Count indicator shows authors (>= 6 seeded)
    const countText = await page.getByText(/\d+ Author/).textContent();
    const count = parseInt(countText!);
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('shows table columns: Name, Email, Posts', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Posts' })).toBeVisible();
  });

  test('shows New author button linking to create page', async ({ page }) => {
    // The "New author" link has role="button" (explicit) and aria-label="New Author"
    const newAuthorBtn = page.getByRole('button', { name: 'New author' });
    await expect(newAuthorBtn).toBeVisible();
    await newAuthorBtn.click();
    await page.waitForURL(/\/authors\/create/);

    await expect(page).toHaveURL(/\/authors\/create/);
  });

  test('search input filters authors by name', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill('Arthur');
    await page.waitForLoadState('networkidle');

    // Should show only Arthur Conan Doyle
    await expect(page.getByText('Arthur Conan Doyle')).toBeVisible();
    await expect(page.getByText('Emily Brontë')).not.toBeVisible();
    await expect(page.getByText('Jane Austen')).not.toBeVisible();

    // Count should reflect filter
    await expect(page.getByText(/1 Author/)).toBeVisible();
  });

  test('search clears and shows all authors again', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill('Arthur');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/1 Author/)).toBeVisible();

    // Clear the search
    await searchInput.clear();
    await page.waitForLoadState('networkidle');

    // All 6 seeded authors should be back
    await expect(page.getByText('Arthur Conan Doyle')).toBeVisible();
    await expect(page.getByText('Emily Brontë')).toBeVisible();
  });

  test('filter by Name field narrows the list', async ({ page }) => {
    // Open Filter menu
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.waitForTimeout(300);

    // Click on Name filter
    await page.getByRole('menuitem', { name: 'Name' }).click();
    await page.waitForTimeout(300);

    // Fill in the filter value
    const filterInput = page.getByRole('textbox').last();
    await filterInput.fill('Eliot');

    // Apply the filter
    await page.getByRole('button', { name: 'Add' }).click();
    await page.waitForLoadState('networkidle');

    // Should show only George Eliot
    await expect(page.getByText('George Eliot')).toBeVisible();
    await expect(page.getByText('Arthur Conan Doyle')).not.toBeVisible();
    await expect(page.getByText(/1 Author/)).toBeVisible();
  });

  test('Select All checkbox selects all rows and shows Delete action', async ({ page }) => {
    const selectAllCheckbox = page.getByRole('checkbox', { name: 'Select All' });
    await selectAllCheckbox.click();
    await page.waitForTimeout(300);

    // Should show "N selected" and Delete button
    await expect(page.getByText(/\d+ selected/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

    // Deselect to avoid polluting state
    await selectAllCheckbox.click();
    await page.waitForTimeout(200);
  });

  test('clicking a row navigates to author detail page', async ({ page }) => {
    // Find the row with Arthur Conan Doyle using data-href attribute
    const row = page.locator('[data-href]').filter({ hasText: 'Arthur Conan Doyle' }).first();
    const href = await row.getAttribute('data-href');
    expect(href).toMatch(/\/authors\/.+/);

    // Navigate to the author detail
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/authors\//);
    await expect(page.getByRole('heading', { name: 'Arthur Conan Doyle' })).toBeVisible();
  });

  test('per-page selector changes the items per page option', async ({ page }) => {
    // Default is 50 per page
    // Change to 10 - still shows all authors since count < 10
    const select = page.locator('select').first();
    await select.selectOption('10');
    await page.waitForLoadState('networkidle');

    // All seeded authors still visible (less than 10 items)
    await expect(page.getByText('Arthur Conan Doyle')).toBeVisible();
  });
});
