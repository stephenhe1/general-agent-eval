import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Helper: create a tag and return its detail page URL. */
async function createTag(page: Page, name: string): Promise<string> {
  await page.goto('/tags/create');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  // CUID IDs are 25 chars; "create" is 6 chars — length discriminates them
  await page.waitForURL(/\/tags\/[a-z0-9]{20,}$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return page.url();
}

test.describe('Tags List Page (/tags)', () => {
  test('tags list page loads', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
    await expect(page).toHaveURL(/\/tags/);
  });

  test('tags list shows empty state or items', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    // Page should load without errors - either empty or with items
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('New tag button navigates to create page', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    // Keystone renders "New X" as an anchor with role="button" override
    await page.getByRole('button', { name: 'New tag' }).click();
    await page.waitForURL(/\/tags\/create/);
    await expect(page).toHaveURL(/\/tags\/create/);
  });

  test('after creating a tag, the list shows the new tag', async ({ page }) => {
    const tagName = `ListTag ${Date.now()}`;
    await createTag(page, tagName);

    // Navigate to the tags list
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    // Use search to find the tag (virtual scrolling: only ~16 rows in DOM at a time)
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(tagName);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(tagName)).toBeVisible();
  });
});

test.describe('Tag Create Page (/tags/create)', () => {
  test('create form loads with Name and Posts fields', async ({ page }) => {
    await page.goto('/tags/create');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Create Tag' })).toBeVisible();

    // Name field (not required in schema)
    await expect(page.getByLabel('Name')).toBeVisible();

    // Posts relationship field
    await expect(page.getByRole('combobox', { name: 'Posts' })).toBeVisible();

    // Create button
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  });

  test('happy path: create a tag and verify it appears in the list', async ({ page }) => {
    const tagName = `TestTag ${Date.now()}`;

    await createTag(page, tagName);

    // Should be on detail page (not create page)
    await expect(page).toHaveURL(/\/tags\/.+/);
    await expect(page).not.toHaveURL(/\/tags\/create/);

    // Tag name should be visible on detail page
    await expect(page.getByLabel('Name')).toHaveValue(tagName);

    // Verify appears in the list via search (virtual scrolling: only ~16 rows rendered)
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(tagName);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(tagName)).toBeVisible();
  });

  test('tag detail shows Save, Reset, Delete buttons', async ({ page }) => {
    const tagName = `DetailTag ${Date.now()}`;
    await createTag(page, tagName);

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('edit tag name: Save persists the new value', async ({ page }) => {
    const originalName = `EditTag ${Date.now()}`;
    const updatedName = `EditTag Updated ${Date.now()}`;

    const detailUrl = await createTag(page, originalName);

    // Navigate to detail page fresh
    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    // Wait for form hydration
    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toHaveValue(originalName);

    // Edit the name
    await nameInput.fill(updatedName);

    const saveBtn = page.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');

    // Name should be updated on the detail page
    await expect(page.getByLabel('Name')).toHaveValue(updatedName);

    // Reload to confirm server-side persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Name')).toHaveValue(updatedName);

    // Verify in list via search (virtual scrolling: only ~16 rows in DOM at a time)
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(updatedName);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  test('reset tag: discards unsaved name changes', async ({ page }) => {
    const originalName = `ResetTag ${Date.now()}`;
    const detailUrl = await createTag(page, originalName);

    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toHaveValue(originalName);

    await nameInput.fill('Temporary Name');
    await expect(nameInput).toHaveValue('Temporary Name');

    // Verify Reset is enabled (form is dirty)
    const resetBtn = page.getByRole('button', { name: 'Reset' });
    await expect(resetBtn).toBeEnabled();

    // Click Reset — Keystone shows a "Reset changes" confirmation dialog
    await resetBtn.click();
    await page.waitForTimeout(300);

    const resetDialog = page.getByRole('alertdialog').filter({ hasText: 'Reset changes' });
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole('button', { name: 'Yes, reset' }).click();
    await page.waitForLoadState('networkidle');

    // Name should revert to original
    await expect(nameInput).toHaveValue(originalName);
  });

  test('delete tag: confirmation and removal from list', async ({ page }) => {
    const tagName = `DeleteTag ${Date.now()}`;
    const detailUrl = await createTag(page, tagName);

    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    // Delete
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    // Confirmation dialog
    const dialog = page.getByRole('alertdialog').filter({ hasText: 'Are you sure' });
    await expect(dialog).toBeVisible();

    await page.getByRole('button', { name: 'Yes, delete' }).click();
    // Wait for navigation to tags list (URL may include query params like ?column=...)
    await page.waitForURL(/\/tags/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    // Wait for list page heading to confirm DOM is settled
    await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();

    // Tag should not be in any list row
    await expect(page.getByRole('row').filter({ hasText: tagName })).toHaveCount(0);
  });

  test('delete tag: Cancel keeps the tag', async ({ page }) => {
    const tagName = `CancelDeleteTag ${Date.now()}`;
    const detailUrl = await createTag(page, tagName);

    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    const dialog = page.getByRole('alertdialog').filter({ hasText: 'Are you sure' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Should remain on detail page
    await expect(page).toHaveURL(/\/tags\/[a-z0-9]{20,}$/);
    await expect(page.getByLabel('Name')).toHaveValue(tagName);
  });
});
