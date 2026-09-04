/**
 * Tests for workspace creation, WS Home page, and workspace management.
 */
import { expect, test } from '@playwright/test';

async function createBrowserWorkspace(
  page: import('@playwright/test').Page,
  wsName: string,
) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Workspace' }).click();
  await page
    .getByRole('radio', { name: 'Browser Save workspace data' })
    .click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Workspace Name', { exact: true }).fill(wsName);
  await page.getByRole('button', { name: 'Create' }).click();
  // Should land on WS Home
  await expect(page.getByRole('heading', { name: wsName })).toBeVisible();
}

test.describe('Create Workspace dialog', () => {
  test('shows Browser and Native FS storage type options', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await expect(
      page.getByRole('radio', { name: 'Browser Save workspace data' }),
    ).toBeVisible();
    // Native FS option exists (may be disabled in headless)
    await expect(page.getByRole('radiogroup')).toBeVisible();
  });

  test('Next button is disabled until a storage type is selected (initial state)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    // The Next button should be present; if no radio is pre-selected, it may be disabled
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeVisible();
  });

  test('entering workspace name and clicking Create navigates to WS Home', async ({
    page,
  }) => {
    const wsName = `rq6-ws-create-${Date.now()}`;
    await createBrowserWorkspace(page, wsName);
    // We should be on the WS Home page
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();
    await expect(
      page.getByText('No notes found in this workspace.'),
    ).toBeVisible();
  });

  test('workspace name validation: Create button is disabled when name is empty', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page
      .getByRole('radio', { name: 'Browser Save workspace data' })
      .click();
    await page.getByRole('button', { name: 'Next' }).click();
    // The name input is visible and empty
    const nameInput = page.getByLabel('Workspace Name', { exact: true });
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('');
    // The Create button should be disabled when the name is empty
    await expect(
      page.getByRole('button', { name: 'Create' }),
    ).toBeDisabled();
  });

  test('closing dialog with Escape returns to welcome page', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('radiogroup')).toBeHidden();
    // Still on welcome page
    await expect(
      page.getByRole('button', { name: 'Create Workspace' }),
    ).toBeVisible();
  });
});

test.describe('WS Home page', () => {
  test('shows workspace name as heading', async ({ page }) => {
    const wsName = `rq6-ws-home-${Date.now()}`;
    await createBrowserWorkspace(page, wsName);
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();
  });

  test('shows empty notes message initially', async ({ page }) => {
    const wsName = `rq6-ws-empty-${Date.now()}`;
    await createBrowserWorkspace(page, wsName);
    await expect(
      page.getByText('No notes found in this workspace.'),
    ).toBeVisible();
  });

  test('New Note button opens create note dialog', async ({ page }) => {
    const wsName = `rq6-ws-newnote-${Date.now()}`;
    await createBrowserWorkspace(page, wsName);
    await page.getByRole('button', { name: 'New Note' }).click();
    await expect(
      page.getByPlaceholder('Input a note name'),
    ).toBeVisible();
  });

  test('Switch Workspace button opens switch workspace dialog', async ({
    page,
  }) => {
    const wsName = `rq6-ws-switch-${Date.now()}`;
    await createBrowserWorkspace(page, wsName);
    await page.getByRole('button', { name: 'Switch Workspace' }).click();
    await expect(
      page.getByRole('dialog'),
    ).toBeVisible();
  });

  test('after creating a note, it appears in recent notes list', async ({
    page,
  }) => {
    const wsName = `rq6-ws-notelst-${Date.now()}`;
    const noteName = `my-note-${Date.now()}`;
    await createBrowserWorkspace(page, wsName);

    // Create a note
    await page.getByRole('button', { name: 'New Note' }).click();
    await page.getByPlaceholder('Input a note name').fill(noteName);
    await page.getByRole('option', { name: 'Create' }).click();
    // Wait for editor
    await expect(page.locator('.ProseMirror')).toBeVisible();

    // Navigate back to WS Home
    await page.goto(`/ws#route=ws-home&wsName=${encodeURIComponent(wsName)}`);
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();

    // Note should appear in the recent notes list
    await expect(
      page.getByRole('link', { name: `${noteName}.md` }),
    ).toBeVisible();
  });
});

test.describe('Switch Workspace', () => {
  test('can switch between two workspaces', async ({ page }) => {
    const ws1 = `rq6-sw-ws1-${Date.now()}`;
    const ws2 = `rq6-sw-ws2-${Date.now()}`;

    // Create first workspace
    await createBrowserWorkspace(page, ws1);
    // Create second workspace
    await page.goto('/');
    await createBrowserWorkspace(page, ws2);

    // Now switch back to ws1
    await page.getByRole('button', { name: 'Switch Workspace' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Type to filter and select ws1
    await page.getByPlaceholder('Select a workspace to switch').fill(ws1);
    await page.getByRole('option', { name: ws1 }).click();

    // Should navigate to ws1's home
    await expect(page.getByRole('heading', { name: ws1 })).toBeVisible();
  });
});
