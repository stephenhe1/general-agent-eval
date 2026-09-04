/**
 * Tests for navigation, error pages (Not Found, Workspace Not Found, WS Path Not Found).
 */
import { expect, test } from '@playwright/test';

test.describe('Not Found page', () => {
  test('shows Page Not Found heading', async ({ page }) => {
    // Navigate to an invalid route
    await page.goto('/ws#route=not-found');
    await expect(page.getByText('Page Not Found')).toBeVisible();
  });

  test('Go to Welcome Screen button navigates to welcome page', async ({
    page,
  }) => {
    await page.goto('/ws#route=not-found');
    await expect(page.getByText('Page Not Found')).toBeVisible();
    await page.getByRole('button', { name: 'Go to Welcome Screen' }).click();
    // Should navigate to welcome page
    await expect(
      page.getByRole('button', { name: 'Create Workspace' }),
    ).toBeVisible();
  });
});

test.describe('Workspace Not Found page', () => {
  test('shows Workspace Not Found heading when workspace does not exist', async ({
    page,
  }) => {
    await page.goto('/ws#route=workspace-not-found&wsName=nonexistent-ws-xyz');
    await expect(page.getByText('Workspace Not Found')).toBeVisible();
  });

  test('shows Go to Welcome Screen and Create Workspace buttons', async ({
    page,
  }) => {
    await page.goto('/ws#route=workspace-not-found&wsName=nonexistent-ws-xyz');
    // WorkspaceNotFoundView shows "Go to Welcome Screen" and "Create Workspace"
    await expect(
      page.getByRole('button', { name: 'Go to Welcome Screen' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create Workspace' }),
    ).toBeVisible();
  });

  test('Create Workspace button opens the workspace creation dialog', async ({
    page,
  }) => {
    await page.goto('/ws#route=workspace-not-found&wsName=nonexistent-ws-xyz');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await expect(page.getByRole('radiogroup')).toBeVisible();
  });

  test('navigating to a non-existent workspace shows workspace not found', async ({
    page,
  }) => {
    await page.goto('/ws#route=ws-home&wsName=totally-does-not-exist-xyz-123');
    // App should route to workspace-not-found or ws-home shows a not-found view
    await expect(
      page.getByText('Workspace Not Found'),
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('WS Path Not Found (Note Not Found)', () => {
  test('shows Note Not Found for an invalid wsPath in editor route', async ({
    page,
  }) => {
    // Use a wsPath that points to a workspace/note that doesn't exist
    const wsPath = encodeURIComponent('nonexistent-ws-rq6:ghost-note.md');
    await page.goto(`/ws#route=editor&wsPath=${wsPath}`);
    await expect(
      page.getByText('Note Not Found').or(page.getByText('Workspace Not Found')),
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Breadcrumb navigation', () => {
  test('Home link in breadcrumb navigates to welcome page', async ({ page }) => {
    await page.goto('/');
    // When at the welcome page the breadcrumb shows the Home icon
    const homeBtn = page.getByRole('link', { name: 'Home' });
    if (await homeBtn.isVisible()) {
      await homeBtn.click();
      await expect(
        page.getByRole('button', { name: 'Create Workspace' }),
      ).toBeVisible();
    } else {
      // Create a workspace so we can see the ws-name breadcrumb
      await page.getByRole('button', { name: 'Create Workspace' }).click();
      await page.getByRole('radio', { name: 'Browser Save workspace data' }).click();
      await page.getByRole('button', { name: 'Next' }).click();
      const wsName = `rq6-bc-${Date.now()}`;
      await page.getByLabel('Workspace Name', { exact: true }).fill(wsName);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('heading', { name: wsName })).toBeVisible();

      // Navigate to welcome page using Home link
      await page.getByRole('link', { name: 'Home' }).click();
      await expect(
        page.getByRole('button', { name: 'Create Workspace' }),
      ).toBeVisible();
    }
  });

  test('Home link in editor breadcrumb navigates to WS Home', async ({
    page,
  }) => {
    // Create workspace & note
    const wsName = `rq6-bc-ws-${Date.now()}`;
    const noteName = `bc-note-${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('radio', { name: 'Browser Save workspace data' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name', { exact: true }).fill(wsName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();

    await page.getByRole('button', { name: 'New Note' }).click();
    await page.getByPlaceholder('Input a note name').fill(noteName);
    await page.getByRole('option', { name: 'Create' }).click();
    await expect(page.locator('.ProseMirror')).toBeVisible();

    // Editor breadcrumb shows a "Home" link (folder icon) that navigates to ws-home.
    // It's rendered as a link with title="Home".
    const homeLink = page.getByLabel('breadcrumb').getByRole('link', { name: 'Home' });
    await expect(homeLink).toBeVisible();
    await homeLink.click();

    // Should be on WS Home for this workspace
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();
  });
});
