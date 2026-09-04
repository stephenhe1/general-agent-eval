import { test, expect } from '@playwright/test';

test.describe('Post Create Page (/posts/create)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/posts/create');
    await page.waitForLoadState('networkidle');
  });

  test('create form loads with correct fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create Post' })).toBeVisible();

    // Required title field
    await expect(page.getByLabel('Title*')).toBeVisible();

    // Status segmented control — the widget uses role="radio" (aria role overrides button tag)
    await expect(page.getByRole('radio', { name: 'Published' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Draft' })).toBeVisible();

    // Content section is present (check for the label)
    await expect(page.locator('label').filter({ hasText: 'Content' })).toBeVisible();

    // Publish Date calendar button
    await expect(page.getByRole('button', { name: /Calendar/ })).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  });

  test('submitting with empty title shows required validation error', async ({ page }) => {
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(500);

    // Keystone shows "Title must not be empty" for the required title field
    await expect(page.getByText(/must not be empty/i)).toBeVisible();

    // Should remain on create page
    await expect(page).toHaveURL(/\/posts\/create/);
  });

  test('happy path: create a post with title and draft status', async ({ page }) => {
    const testTitle = `Test Post ${Date.now()}`;

    await page.getByLabel('Title*').fill(testTitle);

    // Draft is the default - leave as is
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    // CUID IDs are 25 chars long; "create" is 6 chars
    await page.waitForURL(/\/posts\/[a-z0-9]{20,}$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Should redirect to the new post's detail page
    await expect(page).toHaveURL(/\/posts\/[a-z0-9]{20,}$/);

    // Title should be displayed in heading and field
    await expect(page.getByRole('heading', { name: testTitle })).toBeVisible();
    await expect(page.getByLabel('Title*')).toHaveValue(testTitle);

    // Verify the post appears in the list by searching for it
    // (Keystone uses virtual scrolling — search filters to a single result)
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(testTitle);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(testTitle)).toBeVisible();
  });

  test('create a post with Published status', async ({ page }) => {
    const testTitle = `Published Post ${Date.now()}`;

    await page.getByLabel('Title*').fill(testTitle);

    // Click "Published" in status segmented control (role="radio")
    await page.getByRole('radio', { name: 'Published' }).click();

    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/posts\/[a-z0-9]{20,}$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Should land on detail page
    await expect(page).toHaveURL(/\/posts\/[a-z0-9]{20,}$/);

    // Title field should be on detail page
    await expect(page.getByLabel('Title*')).toHaveValue(testTitle);

    // Verify appears in list via search
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(testTitle);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(testTitle)).toBeVisible();
  });

  test('breadcrumb Posts link navigates back to posts list', async ({ page }) => {
    // Breadcrumb "Posts" link navigates to /posts
    await page.getByRole('link', { name: 'Posts' }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/posts/);
    await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
  });

  test('Publish Date field has a Calendar button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Calendar/ })).toBeVisible();
  });
});
