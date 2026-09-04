import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('sidebar navigation links are present on every main page', async ({ page }) => {
    const routes = ['/', '/authors', '/posts', '/tags'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const mainNav = page.locator('nav[aria-label="main"]');

      // Sidebar links in the main nav
      await expect(mainNav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(mainNav.getByRole('link', { name: 'Authors' })).toBeVisible();
      await expect(mainNav.getByRole('link', { name: 'Posts' })).toBeVisible();
    }
  });

  test('Keystone logo navigates to dashboard', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Keystone' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('Dashboard sidebar link navigates to /', async ({ page }) => {
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    await page.locator('nav[aria-label="main"]').getByRole('link', { name: 'Dashboard' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('Authors sidebar link navigates to /authors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav[aria-label="main"]').getByRole('link', { name: 'Authors' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/authors/);
    await expect(page.getByRole('heading', { name: 'Authors' })).toBeVisible();
  });

  test('Posts sidebar link navigates to /posts', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav[aria-label="main"]').getByRole('link', { name: 'Posts' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/posts/);
    await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
  });

  test('/no-access page shows access-denied message', async ({ page }) => {
    await page.goto('/no-access');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('No access')).toBeVisible();
    await expect(page.getByText(/Unable to access/i)).toBeVisible();
  });

  test('authors list breadcrumb: clicking Authors navigates back to /authors', async ({ page }) => {
    // Go to a seeded author detail page
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'George Eliot' }).first();
    const href = await row.getAttribute('data-href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // The first "Authors" link in DOM order is the breadcrumb
    // (page breadcrumb comes before sidebar in the DOM structure)
    await page.getByRole('link', { name: 'Authors' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/authors/);
  });

  test('posts list breadcrumb: clicking Posts navigates back to /posts', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-href]').filter({ hasText: 'Jabberwocky' }).first();
    const href = await row.getAttribute('data-href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // The first "Posts" link is the breadcrumb
    await page.getByRole('link', { name: 'Posts' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/posts/);
  });

  test('create author breadcrumb shows Authors and Create', async ({ page }) => {
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');

    // Breadcrumb has "Authors" link and "Create" text
    await expect(page.getByRole('link', { name: 'Authors' }).first()).toBeVisible();
    await expect(page.getByText('Create').first()).toBeVisible();
  });

  test('create post breadcrumb shows Posts and Create', async ({ page }) => {
    await page.goto('/posts/create');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: 'Posts' }).first()).toBeVisible();
    await expect(page.getByText('Create').first()).toBeVisible();
  });
});
