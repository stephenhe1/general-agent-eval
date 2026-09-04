/**
 * Tests for the Welcome page (/) — shown when no workspace is open.
 */
import { expect, test } from '@playwright/test';

test.describe('Welcome page', () => {
  test('shows welcome heading and Create Workspace button for new user', async ({
    page,
  }) => {
    await page.goto('/');
    // One of the two welcome messages is shown (use specific text matchers to
    // avoid accidentally matching sr-only headings from dialogs like "All Files")
    const heading = page
      .getByRole('heading', { name: 'Welcome to Bangle' })
      .or(page.getByRole('heading', { name: 'Welcome back!' }));
    await expect(heading).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Create Workspace' }),
    ).toBeVisible();
  });

  test('shows "Create a workspace to get started" when there are no workspaces', async ({
    page,
    context,
  }) => {
    // Use a fresh context with no IndexedDB data
    await context.clearCookies();
    await page.goto('/');
    // The empty message for the recent workspaces list
    await expect(
      page.getByText('Create a workspace to get started.'),
    ).toBeVisible();
  });

  test('Create Workspace button opens the workspace creation dialog', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    // The dialog should show storage type options
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await expect(
      page.getByRole('radio', { name: 'Browser Save workspace data' }),
    ).toBeVisible();
  });

  test('Landing page button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Landing page' }),
    ).toBeVisible();
  });

  test('after creating a workspace it appears in the recent workspaces list', async ({
    page,
  }) => {
    await page.goto('/');
    const wsName = `rq6-welcome-ws-${Date.now()}`;
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page
      .getByRole('radio', { name: 'Browser Save workspace data' })
      .click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name', { exact: true }).fill(wsName);
    await page.getByRole('button', { name: 'Create' }).click();

    // Should navigate away from welcome page to WS home
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();

    // Navigate back to welcome page
    await page.goto('/');
    // The workspace should now appear in the recent workspaces list
    await expect(page.getByRole('link', { name: wsName })).toBeVisible();
  });
});
