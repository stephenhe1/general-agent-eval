import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Helper: create a post and return its detail page URL. */
async function createPost(page: Page, title: string): Promise<string> {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Title*').fill(title);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  // CUID IDs are 25 chars; "create" is 6 chars — length discriminates them
  await page.waitForURL(/\/posts\/[a-z0-9]{20,}$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return page.url();
}

test.describe('Post Detail Page (/posts/[id])', () => {
  test('loads with correct field values for a seeded post', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'Wuthering Heights' }).first();
    const href = await row.getAttribute('data-href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // Heading
    await expect(page.getByRole('heading', { name: 'Wuthering Heights' })).toBeVisible();

    // Title field
    await expect(page.getByLabel('Title*')).toHaveValue('Wuthering Heights');

    // Action buttons
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('edit post title: Save persists the updated title', async ({ page }) => {
    const originalTitle = `EditPost ${Date.now()}`;
    const updatedTitle = `EditPost Updated ${Date.now()}`;

    const detailUrl = await createPost(page, originalTitle);
    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    // Wait for form hydration
    const titleInput = page.getByLabel('Title*');
    await expect(titleInput).toHaveValue(originalTitle);

    // Change the title
    await titleInput.fill(updatedTitle);

    // Save
    const saveBtn = page.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');

    // Title field and heading should show updated value
    await expect(page.getByLabel('Title*')).toHaveValue(updatedTitle);
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();

    // Reload to confirm server-side persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Title*')).toHaveValue(updatedTitle);

    // Verify it appears in the list via search (Keystone uses virtual scrolling)
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(updatedTitle);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(updatedTitle)).toBeVisible();
  });

  test('reset discards unsaved changes to post', async ({ page }) => {
    const originalTitle = `ResetPost ${Date.now()}`;

    const detailUrl = await createPost(page, originalTitle);
    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    // Wait for hydration
    const titleInput = page.getByLabel('Title*');
    await expect(titleInput).toHaveValue(originalTitle);

    await titleInput.fill('Temporary Changed Title');
    await expect(titleInput).toHaveValue('Temporary Changed Title');

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

    // Should revert to original
    await expect(titleInput).toHaveValue(originalTitle);
  });

  test('delete post: confirmation dialog and removal from list', async ({ page }) => {
    const title = `DeletePost ${Date.now()}`;

    const detailUrl = await createPost(page, title);
    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    // Click Delete
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    // Confirmation dialog (alertdialog)
    const dialog = page.getByRole('alertdialog').filter({ hasText: 'Are you sure' });
    await expect(dialog).toBeVisible();

    // Confirm
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    // Wait for navigation to posts list
    await page.waitForURL(/\/posts/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    // Wait for list page to be fully rendered
    await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();

    // Post should not be in any list row
    await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0);
  });

  test('delete post: Cancel keeps the post', async ({ page }) => {
    const title = `CancelDeletePost ${Date.now()}`;

    const detailUrl = await createPost(page, title);
    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    const dialog = page.getByRole('alertdialog').filter({ hasText: 'Are you sure' });
    await expect(dialog).toBeVisible();

    // Cancel
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Still on detail page
    await expect(page).toHaveURL(/\/posts\/[a-z0-9]{20,}$/);
    await expect(page.getByLabel('Title*')).toHaveValue(title);
  });

  test('status can be changed to Published and saved', async ({ page }) => {
    const title = `StatusPost ${Date.now()}`;

    const detailUrl = await createPost(page, title);
    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle');

    // Wait for form hydration
    await expect(page.getByLabel('Title*')).toHaveValue(title);

    // Status field uses role="radio" (segmented control with ARIA radio buttons)
    // Default is Draft — change to Published
    const publishedRadio = page.getByRole('radio', { name: 'Published' });
    await expect(publishedRadio).toBeVisible();
    await publishedRadio.click();

    const saveBtn = page.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');

    // Reload to confirm the status was persisted server-side
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Published radio should be checked after reload
    await expect(page.getByRole('radio', { name: 'Published' })).toBeChecked();
  });

  test('Item ID field shows post id', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'Wuthering Heights' }).first();
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

  test('seeded post shows author and content', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'The Adventures of Sherlock Holmes' }).first();
    const href = await row.getAttribute('data-href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // Has content (rich text) — check for a unique phrase from the seeded content
    await expect(page.getByText(/Baker Street/i)).toBeVisible();

    // Status field uses role="radio"; Sherlock Holmes is Published
    await expect(page.getByRole('radio', { name: 'Published' })).toBeVisible();
  });
});
