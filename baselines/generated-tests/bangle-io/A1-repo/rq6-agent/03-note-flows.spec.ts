/**
 * Tests for note creation, editing, deletion, renaming, and starring.
 */
import { expect, test } from '@playwright/test';
import {
  createBrowserWorkspaceAndNote,
  getEditorText,
  readStoredMarkdown,
  ctrlKey,
} from './helpers';

test.describe('Create note', () => {
  test('creates a note and opens it in the editor', async ({ page }) => {
    const wsName = `rq6-note-create-${Date.now()}`;
    const noteName = `hello-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // Editor should be visible with correct breadcrumb
    await expect(page.locator('.ProseMirror')).toBeVisible();
    await expect(
      page
        .getByLabel('breadcrumb')
        .getByRole('button', { name: `${noteName}.md` }),
    ).toBeVisible();
  });

  test('create note from WS Home New Note button', async ({ page }) => {
    const wsName = `rq6-note-wshome-${Date.now()}`;
    // Create workspace
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page
      .getByRole('radio', { name: 'Browser Save workspace data' })
      .click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name', { exact: true }).fill(wsName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();

    const noteName = `ws-home-note-${Date.now()}`;
    await page.getByRole('button', { name: 'New Note' }).click();
    await page.getByPlaceholder('Input a note name').fill(noteName);
    await page.getByRole('option', { name: 'Create' }).click();

    // Should open the editor
    await expect(page.locator('.ProseMirror')).toBeVisible();
    await expect(
      page
        .getByLabel('breadcrumb')
        .getByRole('button', { name: `${noteName}.md` }),
    ).toBeVisible();
  });
});

test.describe('Edit note content', () => {
  test('typed text appears in the editor', async ({ page }) => {
    const wsName = `rq6-note-edit-${Date.now()}`;
    const noteName = `edit-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText('Hello world!');
    const text = await getEditorText(page);
    expect(text).toContain('Hello world!');
  });

  test('content persists after page reload', async ({ page }) => {
    const wsName = `rq6-note-persist-${Date.now()}`;
    const noteName = `persist-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText('Persisted content');

    // Wait for auto-save (poll IndexedDB)
    await expect
      .poll(() => readStoredMarkdown(page, wsName, noteName), { timeout: 10_000 })
      .toBe('Persisted content');

    await page.reload({ waitUntil: 'networkidle' });
    const textAfterReload = await getEditorText(page);
    expect(textAfterReload).toContain('Persisted content');
  });

  test('heading syntax renders as heading', async ({ page }) => {
    const wsName = `rq6-note-heading-${Date.now()}`;
    const noteName = `heading-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    // Use editor.pressSequentially (locator method) not page.keyboard.pressSequentially
    await editor.pressSequentially('# My Heading', { delay: 20 });
    // ProseMirror renders H1
    await expect(editor.locator('h1')).toHaveText('My Heading');
  });

  test('markdown is stored with correct heading syntax', async ({ page }) => {
    const wsName = `rq6-note-md-${Date.now()}`;
    const noteName = `md-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially('# Stored Heading', { delay: 20 });

    await expect
      .poll(() => readStoredMarkdown(page, wsName, noteName), { timeout: 10_000 })
      .toBe('# Stored Heading');
  });
});

test.describe('Delete note', () => {
  test('deleting a note via sidebar removes it and WS Home becomes empty', async ({
    page,
  }) => {
    const wsName = `rq6-note-del-${Date.now()}`;
    const noteName = `del-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // Confirm the editor is open and the note exists in the sidebar
    await expect(page.locator('.ProseMirror')).toBeVisible();

    // The sidebar file item has data-sidebar="menu-button"; there are two
    // (one in "Opened" section, one in "Files" section) — use first().
    const sidebarFileLink = page.locator(
      `[data-sidebar="menu-button"][href*="${encodeURIComponent(noteName)}"]`,
    ).first();
    await expect(sidebarFileLink).toBeVisible();
    await sidebarFileLink.hover();

    // The action button (MoreHorizontal, data-sidebar="menu-action") appears
    // on hover with opacity-0 → opacity-100.
    const actionBtn = page.locator('[data-sidebar="menu-action"]').first();
    await actionBtn.click();

    // The dropdown should show "Delete" option
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Step 1: The "Delete Note" single-select dialog opens, pre-filtered with the note.
    // The badge "Delete Note" confirms the dialog is open.
    await expect(page.getByText('Delete Note')).toBeVisible({ timeout: 5000 });
    // Select the note option (the note path pre-filters it)
    const noteOption = page.getByRole('option', { name: new RegExp(noteName) });
    await noteOption.click();

    // Step 2: The confirmation alert dialog opens
    await expect(
      page.getByRole('alertdialog', { name: 'Confirm Delete' }),
    ).toBeVisible({ timeout: 5000 });
    // Click the "Delete" continue button
    await page.getByRole('button', { name: 'Delete' }).last().click();

    // Navigate to WS home; the workspace should have no notes now
    await page.goto(`/ws#route=ws-home&wsName=${encodeURIComponent(wsName)}`);
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();
    await expect(
      page.getByText('No notes found in this workspace.'),
    ).toBeVisible();
  });
});

test.describe('Star / Unstar note', () => {
  test('starring a note persists and shows star icon in WS Home', async ({
    page,
  }) => {
    const wsName = `rq6-note-star-${Date.now()}`;
    const noteName = `star-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // The star button is in the header
    const starBtn = page.getByRole('button', { name: 'Star this item' });
    await expect(starBtn).toBeVisible();
    await starBtn.click();

    // Button label should change to "Unstar this item"
    await expect(
      page.getByRole('button', { name: 'Unstar this item' }),
    ).toBeVisible();

    // Navigate to WS home; note should show a star icon
    await page.goto(`/ws#route=ws-home&wsName=${encodeURIComponent(wsName)}`);
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();
    // The note link should be visible in the recent notes list
    await expect(
      page.getByRole('link', { name: `${noteName}.md` }),
    ).toBeVisible();
  });

  test('unstarring removes the star', async ({ page }) => {
    const wsName = `rq6-note-unstar-${Date.now()}`;
    const noteName = `unstar-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // Star it
    await page.getByRole('button', { name: 'Star this item' }).click();
    await expect(
      page.getByRole('button', { name: 'Unstar this item' }),
    ).toBeVisible();

    // Unstar it
    await page.getByRole('button', { name: 'Unstar this item' }).click();
    await expect(
      page.getByRole('button', { name: 'Star this item' }),
    ).toBeVisible();
  });
});

test.describe('Note not found (WS Path Not Found)', () => {
  test('navigating to a non-existent note shows Note Not Found view', async ({
    page,
  }) => {
    const wsName = `rq6-note-404-${Date.now()}`;
    // Create workspace first
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page
      .getByRole('radio', { name: 'Browser Save workspace data' })
      .click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name', { exact: true }).fill(wsName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();

    // Navigate to a path that doesn't exist
    const wsPath = `${wsName}:nonexistent-note.md`;
    await page.goto(
      `/ws#route=editor&wsPath=${encodeURIComponent(wsPath)}`,
    );

    // Should show NoteNotFoundView
    await expect(page.getByText('Note Not Found')).toBeVisible();
  });
});
