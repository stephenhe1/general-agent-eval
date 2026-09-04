import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('sidebar Authors link navigates to authors list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('navigation').getByRole('link', { name: 'Authors' }).click();
    await expect(page).toHaveURL(/\/authors/);
    await expect(page.getByRole('heading', { name: 'Authors' })).toBeVisible();
  });

  test('sidebar Posts link navigates to posts list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('navigation').getByRole('link', { name: 'Posts' }).click();
    await expect(page).toHaveURL(/\/posts/);
    await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
  });

  test('sidebar Dashboard link navigates back to dashboard', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('breadcrumb on authors list links back to dashboard via Keystone logo', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // Keystone logo / name links to home
    await page.getByRole('link', { name: 'Keystone' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('breadcrumb on author detail links back to authors list', async ({ page }) => {
    // Get a known author ID
    const res = await fetch('http://127.0.0.1:3200/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ authors(take: 1) { id } }' }),
    });
    const data = (await res.json()) as { data: { authors: Array<{ id: string }> } };
    const authorId = data.data.authors[0]?.id;
    if (!authorId) test.skip();

    await page.goto(`/authors/${authorId}`);
    await page.waitForLoadState('networkidle');

    // The breadcrumb shows "Authors" – clicking it goes to /authors
    const breadcrumb = page.getByRole('link', { name: 'Authors' });
    await breadcrumb.first().click();
    await expect(page).toHaveURL(/\/authors/);
  });

  test('"New author" button on list page navigates to create page', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    // The "New author" element has role="button" (an <a> with role="button" override)
    await page.getByRole('button', { name: 'New author' }).click();
    await expect(page).toHaveURL(/\/authors\/create/);
    await expect(page.getByRole('heading', { name: 'Create Author' })).toBeVisible();
  });

  test('"New post" button on list page navigates to create page', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New post' }).click();
    await expect(page).toHaveURL(/\/posts\/create/);
    await expect(page.getByRole('heading', { name: 'Create Post' })).toBeVisible();
  });

  test('"New tag" button on list page navigates to create page', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New tag' }).click();
    await expect(page).toHaveURL(/\/tags\/create/);
    await expect(page.getByRole('heading', { name: 'Create Tag' })).toBeVisible();
  });
});
