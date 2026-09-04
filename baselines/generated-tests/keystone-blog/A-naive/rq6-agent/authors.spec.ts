import { test, expect } from '@playwright/test';
import {
  gql,
  deleteAuthorById,
  findAuthorsByName,
  applyFilter,
} from './helpers';

// ---------------------------------------------------------------------------
// Authors – List View
// ---------------------------------------------------------------------------
test.describe('Authors – List View', () => {
  test('page loads with correct list data', async ({ page }) => {
    const data = await gql('{ authorsCount authors(take: 1) { id name email } }');
    const count = data.authorsCount as number;
    const firstAuthor = (data.authors as Array<{ id: string; name: string; email: string }>)[0];

    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Heading
    await expect(page.getByRole('heading', { name: 'Authors' })).toBeVisible();

    // Count shown in the footer (e.g. "7 Authors")
    await expect(page.getByText(new RegExp(`${count} Author`))).toBeVisible();

    // A known author's name appears somewhere in the grid
    if (firstAuthor) {
      await expect(page.getByText(firstAuthor.name)).toBeVisible();
    }

    // Column headers
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
  });

  test('search filters rows in real time', async ({ page }) => {
    // Pick an author whose name is unique enough to filter
    const data = await gql('{ authors(take: 1) { name } }');
    const targetName = (data.authors as Array<{ name: string }>)[0].name;
    const firstWord = targetName.split(' ')[0]; // e.g. "Arthur"

    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    const initialCount = await gql('{ authorsCount }');
    const total = initialCount.authorsCount as number;

    const searchBox = page.getByRole('searchbox');
    await searchBox.fill(firstWord);
    await page.waitForTimeout(600); // debounce

    // URL should contain the search term
    await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(firstWord)}`));

    // Table should now show fewer rows (the matching author's name must be visible)
    await expect(page.getByText(targetName)).toBeVisible();

    // The count shown at the bottom should be ≤ total
    const countText = await page.locator('text=/\\d+ Author/').textContent();
    const shownCount = parseInt(countText?.match(/(\d+)/)?.[1] ?? '0', 10);
    expect(shownCount).toBeLessThanOrEqual(total);
  });

  test('sort by name column changes URL', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    await page.getByRole('columnheader', { name: 'Name' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/sortBy=name/);
  });

  test('filter by name returns matching authors', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    await applyFilter(page, 'Name', 'Emily');

    // URL should reflect the filter (format: filter=name_contains_i_"Emily")
    await expect(page).toHaveURL(/filter=name/);

    // The matching author should be visible
    await expect(page.getByText('Emily Brontë')).toBeVisible();

    // Non-matching authors should not be visible
    await expect(page.getByText('Arthur Conan Doyle')).not.toBeVisible();

    // Filter chip text is displayed
    await expect(page.getByText(/Name contains/)).toBeVisible();
  });

  test('column toggle shows/hides Id column', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Id column should not be visible by default
    await expect(page.getByRole('columnheader', { name: 'Id' })).not.toBeVisible();

    // Open Columns menu and enable Id
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitemcheckbox', { name: 'Id' }).click();
    // Close the menu by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Id column header should now appear in the grid
    await expect(page.getByRole('columnheader', { name: 'Id' })).toBeVisible();
  });

  test('bulk select all shows action bar with Delete and selected count', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    const selectAll = page.getByRole('checkbox', { name: 'Select All' });
    await selectAll.check();
    await page.waitForTimeout(300);

    // An action bar should appear with Delete button
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

    // Check the "N selected" text is visible
    await expect(page.getByText(/\d+ selected/, { exact: false })).toBeVisible();

    // Uncheck to reset
    await selectAll.uncheck();
  });

  test('pagination – change page size', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // The page-size selector shows current value (50)
    const pageSizeBtn = page.getByRole('button', { name: '50' });
    await expect(pageSizeBtn).toBeVisible();

    // Click the page-size button to open the listbox
    await pageSizeBtn.click();
    await page.waitForTimeout(300);

    // Select 10 from the options listbox (exact to avoid matching "100")
    await page.getByRole('option', { name: '10', exact: true }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/pageSize=10/);
  });
});

// ---------------------------------------------------------------------------
// Authors – Create
// ---------------------------------------------------------------------------
test.describe('Authors – Create', () => {
  test('create page loads with correct form fields', async ({ page }) => {
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Create Author' })).toBeVisible();
    await expect(page.getByLabel('Name*')).toBeVisible();
    await expect(page.getByLabel('Email*')).toBeVisible();
    // Posts is a combobox (relation field)
    await expect(page.getByRole('combobox', { name: 'Posts' })).toBeVisible();
  });

  test('required-field validation – empty submit stays on create page', async ({ page }) => {
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(500);

    // Should still be on create page
    await expect(page).toHaveURL(/\/authors\/create/);
  });

  test('create author saves correct data', async ({ page }) => {
    const uniqueName = `Test Author ${Date.now()}`;
    const uniqueEmail = `test_${Date.now()}@example.com`;

    // Cleanup any leftover from a previous run
    const existing = await findAuthorsByName(uniqueName);
    for (const a of existing) await deleteAuthorById(a.id);

    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Name*').fill(uniqueName);
    await page.getByLabel('Email*').fill(uniqueEmail);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Should redirect to the author's detail page
    await expect(page).toHaveURL(/\/authors\/[a-z0-9]+$/);

    // Verify via GraphQL that the author was created with the correct values
    const created = await findAuthorsByName(uniqueName);
    expect(created.length).toBe(1);

    const detail = await gql(
      `query($id: ID!) { author(where: { id: $id }) { id name email } }`,
      { id: created[0].id },
    );
    const author = detail.author as { id: string; name: string; email: string };
    expect(author.name).toBe(uniqueName);
    expect(author.email).toBe(uniqueEmail);

    // Cleanup
    await deleteAuthorById(author.id);
  });
});

// ---------------------------------------------------------------------------
// Authors – Detail / Edit
// ---------------------------------------------------------------------------
test.describe('Authors – Detail / Edit', () => {
  // We create a dedicated author to test editing without affecting seed data.
  let testAuthorId: string;

  test.beforeEach(async () => {
    const data = await gql(
      `mutation($name: String!, $email: String!) {
         createAuthor(data: { name: $name, email: $email }) { id }
       }`,
      { name: `Edit Test Author ${Date.now()}`, email: `edit_${Date.now()}@test.com` },
    );
    testAuthorId = (data.createAuthor as { id: string }).id;
  });

  test.afterEach(async () => {
    if (testAuthorId) await deleteAuthorById(testAuthorId);
  });

  test('detail page loads correct field values', async ({ page }) => {
    const data = await gql(
      `query($id: ID!) { author(where: { id: $id }) { name email } }`,
      { id: testAuthorId },
    );
    const author = data.author as { name: string; email: string };

    await page.goto(`/authors/${testAuthorId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Name*')).toHaveValue(author.name);
    await expect(page.getByLabel('Email*')).toHaveValue(author.email);
  });

  test('edit name and save persists the change', async ({ page }) => {
    const newName = `Renamed Author ${Date.now()}`;

    await page.goto(`/authors/${testAuthorId}`);
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Name*').fill(newName);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');

    // Verify via API that the name was updated
    const data = await gql(
      `query($id: ID!) { author(where: { id: $id }) { name } }`,
      { id: testAuthorId },
    );
    const updated = data.author as { name: string };
    expect(updated.name).toBe(newName);
  });

  test('Save, Reset, Delete buttons are visible on detail page', async ({ page }) => {
    await page.goto(`/authors/${testAuthorId}`);
    await page.waitForLoadState('networkidle');

    // Verify the Save, Reset, Delete buttons are all present
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('delete author removes it from the database', async ({ page }) => {
    await page.goto(`/authors/${testAuthorId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(400);

    // Keystone shows a confirmation modal – click the "Yes, delete" button
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Should navigate back to the authors list
    await expect(page).toHaveURL(/\/authors/);

    // Verify via GraphQL that the author no longer exists
    const data = await gql(
      `query($id: ID!) { author(where: { id: $id }) { id } }`,
      { id: testAuthorId },
    );
    expect(data.author).toBeNull();

    // Prevent afterEach from erroring on a non-existent author
    testAuthorId = '';
  });
});

// ---------------------------------------------------------------------------
// Authors – Bulk Delete via list search + Select All
// ---------------------------------------------------------------------------
test.describe('Authors – Bulk Delete', () => {
  const UNIQUE_PREFIX = `BulkDel_${Date.now()}`;
  const author1Name = `${UNIQUE_PREFIX}_A`;
  const author2Name = `${UNIQUE_PREFIX}_B`;
  let id1 = '';
  let id2 = '';

  test.beforeEach(async () => {
    const d1 = await gql(
      `mutation { createAuthor(data: { name: "${author1Name}", email: "bd1_${Date.now()}@test.com" }) { id } }`,
    );
    id1 = (d1.createAuthor as { id: string }).id;
    const d2 = await gql(
      `mutation { createAuthor(data: { name: "${author2Name}", email: "bd2_${Date.now()}@test.com" }) { id } }`,
    );
    id2 = (d2.createAuthor as { id: string }).id;
  });

  test.afterEach(async () => {
    if (id1) await deleteAuthorById(id1);
    if (id2) await deleteAuthorById(id2);
  });

  test('select filtered items and bulk-delete removes them', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Search with the unique prefix to show only the two test authors
    await page.getByRole('searchbox').fill(UNIQUE_PREFIX);
    await page.waitForTimeout(600);

    // Should now show exactly the two bulk-delete authors
    await expect(page.getByText('2 Authors')).toBeVisible();

    // Select all (only 2 visible)
    await page.getByRole('checkbox', { name: 'Select All' }).check();
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
    await expect(page.getByText('2 selected')).toBeVisible();

    // Delete
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Verify both authors were deleted via API
    const check1 = await gql(`query { author(where: { id: "${id1}" }) { id } }`);
    const check2 = await gql(`query { author(where: { id: "${id2}" }) { id } }`);
    expect(check1.author).toBeNull();
    expect(check2.author).toBeNull();

    // Prevent afterEach cleanup errors
    id1 = '';
    id2 = '';
  });
});
