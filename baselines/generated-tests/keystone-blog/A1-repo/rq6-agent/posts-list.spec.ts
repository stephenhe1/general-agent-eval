import { test, expect } from '@playwright/test';

test.describe('Posts List Page (/posts)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');
  });

  test('displays the posts list with seeded data', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();

    // All 8 seeded posts should be visible
    await expect(page.getByText('The Adventures of Sherlock Holmes')).toBeVisible();
    await expect(page.getByText('Wuthering Heights')).toBeVisible();
    await expect(page.getByText('Emma')).toBeVisible();
    await expect(page.getByText('Sense and Sensibility')).toBeVisible();
    await expect(page.getByText('Through the Looking-Glass')).toBeVisible();
    await expect(page.getByText('Jabberwocky')).toBeVisible();
    await expect(page.getByText('Middlemarch')).toBeVisible();
    await expect(page.getByText('The Wonderful Wizard of Oz')).toBeVisible();

    // Count indicator shows posts (>= 8 seeded)
    const countText = await page.getByText(/\d+ Post/).textContent();
    const count = parseInt(countText!);
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('shows table columns: Title, Status, Publish Date', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Publish Date' })).toBeVisible();
  });

  test('shows published and draft status for seeded posts', async ({ page }) => {
    // Both Published and Draft statuses should appear in the list
    const publishedRows = page.getByText('Published');
    const draftRows = page.getByText('Draft');
    await expect(publishedRows.first()).toBeVisible();
    await expect(draftRows.first()).toBeVisible();
  });

  test('shows New post button linking to create page', async ({ page }) => {
    // "New post" link has role="button" (explicit)
    const newPostBtn = page.getByRole('button', { name: 'New post' });
    await expect(newPostBtn).toBeVisible();
    await newPostBtn.click();
    await page.waitForURL(/\/posts\/create/);
    await expect(page).toHaveURL(/\/posts\/create/);
  });

  test('search input filters posts by title', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill('Middlemarch');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Middlemarch')).toBeVisible();
    await expect(page.getByText('The Adventures of Sherlock Holmes')).not.toBeVisible();
    await expect(page.getByText(/1 Post/)).toBeVisible();
  });

  test('search clears and restores filtered posts', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill('Middlemarch');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/1 Post/)).toBeVisible();

    // Clear search
    await searchInput.clear();
    await page.waitForLoadState('networkidle');

    // Seeded posts should be visible again
    await expect(page.getByText('Middlemarch')).toBeVisible();
    await expect(page.getByText('Wuthering Heights')).toBeVisible();

    // Count is back to full (>= 8)
    const countText = await page.getByText(/\d+ Post/).textContent();
    const count = parseInt(countText!);
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('Select All checkbox selects all posts and shows Delete action', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Select All' }).click();
    await page.waitForTimeout(300);

    // Shows count selected and Delete button
    await expect(page.getByText(/\d+ selected/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

    // Deselect to clean up
    await page.getByRole('checkbox', { name: 'Select All' }).click();
    await page.waitForTimeout(200);
  });

  test('clicking a post row navigates to post detail page', async ({ page }) => {
    const row = page.locator('[data-href]').filter({ hasText: 'Wuthering Heights' }).first();
    const href = await row.getAttribute('data-href');
    expect(href).toMatch(/\/posts\/.+/);

    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/posts\//);
    await expect(page.getByRole('heading', { name: 'Wuthering Heights' })).toBeVisible();
  });
});
