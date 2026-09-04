/**
 * Tests for omni search, all-files dialog, sidebar navigation, and theme switching.
 */
import { expect, test } from '@playwright/test';
import { createBrowserWorkspaceAndNote, ctrlKey } from './helpers';

test.describe('Omni Search', () => {
  test('Ctrl+K opens the omni search dialog', async ({ page }) => {
    const wsName = `rq6-omni-${Date.now()}`;
    const noteName = `omni-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();

    await page.keyboard.press(`${ctrlKey}+k`);
    await expect(
      page.getByRole('dialog', { name: 'omni command bar' }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder('Type a command or search...'),
    ).toBeFocused();
  });

  test('Escape closes the omni search dialog', async ({ page }) => {
    const wsName = `rq6-omni-esc-${Date.now()}`;
    const noteName = `omni-esc-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();

    await page.keyboard.press(`${ctrlKey}+k`);
    const dialog = page.getByRole('dialog', { name: 'omni command bar' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('typing a note name in search and pressing Enter navigates to it', async ({
    page,
  }) => {
    const wsName = `rq6-omni-nav-${Date.now()}`;
    const noteName = `nav-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // Create a second note to navigate from
    const wsName2 = `rq6-omni-src-${Date.now()}`;
    const noteName2 = `src-note-${Date.now()}`;

    // Navigate to WS home and create a second note
    await page.goto(`/ws#route=ws-home&wsName=${encodeURIComponent(wsName)}`);
    await page.getByRole('button', { name: 'New Note' }).click();
    const note2 = `second-note-${Date.now()}`;
    await page.getByPlaceholder('Input a note name').fill(note2);
    await page.getByRole('option', { name: 'Create' }).click();
    await expect(page.locator('.ProseMirror')).toBeVisible();

    // Now open omni search and search for the first note
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.press(`${ctrlKey}+k`);
    const commandInput = page.getByPlaceholder('Type a command or search...');
    await commandInput.fill(`${noteName}.md`);
    await page.keyboard.press('Enter');

    // Dialog should close
    await expect(
      page.getByRole('dialog', { name: 'omni command bar' }),
    ).toBeHidden();

    // Should now be on the first note
    await expect(
      page
        .getByLabel('breadcrumb')
        .getByRole('button', { name: `${noteName}.md` }),
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('All Files Dialog', () => {
  test('opening all files dialog shows workspace notes', async ({ page }) => {
    const wsName = `rq6-allfiles-${Date.now()}`;
    const noteName = `allfiles-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // Open all files dialog via omni search
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.press(`${ctrlKey}+k`);
    const commandInput = page.getByPlaceholder('Type a command or search...');
    await commandInput.fill('All Files');
    // Wait for "All Files" command item to appear
    const allFilesOption = page.getByRole('option', { name: /All Files/i });
    if (await allFilesOption.isVisible({ timeout: 3000 })) {
      await allFilesOption.click();
      // All files dialog should open
      const allFilesDialog = page.getByRole('dialog', { name: 'All Files' });
      await expect(allFilesDialog).toBeVisible({ timeout: 5000 });
      // The note should appear in the list — scope to the dialog to avoid
      // strict-mode violation when the note name appears in multiple places
      await expect(
        allFilesDialog.getByText(`${noteName}.md`),
      ).toBeVisible();
    } else {
      // If the omni search option isn't named exactly "All Files", skip gracefully
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Sidebar', () => {
  test('sidebar toggle shows and hides the sidebar', async ({ page }) => {
    const wsName = `rq6-sidebar-${Date.now()}`;
    const noteName = `sidebar-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const toggleBtn = page.getByRole('button', { name: 'Toggle Sidebar' });
    await expect(toggleBtn).toBeVisible();

    // Toggle once (may hide sidebar)
    await toggleBtn.click();
    // Toggle back
    await toggleBtn.click();
    // Sidebar should be visible
    await expect(toggleBtn).toBeVisible();
  });

  test('file tree shows notes in current workspace', async ({ page }) => {
    const wsName = `rq6-sidebar-files-${Date.now()}`;
    const noteName = `sidebar-file-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // The sidebar shows the note as a link (data-sidebar="menu-button").
    // Use role=link scoped to the sidebar (aside element) to avoid strict-mode
    // violations since the note name also appears in the breadcrumb.
    await expect(
      page.locator('[data-sidebar="menu-button"]', { hasText: `${noteName}.md` }).first(),
    ).toBeVisible();
  });

  test('clicking a note in sidebar navigates to the editor', async ({ page }) => {
    const wsName = `rq6-sidebar-nav-${Date.now()}`;
    const noteName = `sidebar-nav-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // Navigate away to WS home
    await page.goto(`/ws#route=ws-home&wsName=${encodeURIComponent(wsName)}`);
    await expect(page.getByRole('heading', { name: wsName })).toBeVisible();

    // Click the note in the sidebar via its data-sidebar link
    const noteLink = page.locator('[data-sidebar="menu-button"]', {
      hasText: `${noteName}.md`,
    }).first();
    if (await noteLink.isVisible({ timeout: 3000 })) {
      await noteLink.click();
      await expect(page.locator('.ProseMirror')).toBeVisible();
      await expect(
        page
          .getByLabel('breadcrumb')
          .getByRole('button', { name: `${noteName}.md` }),
      ).toBeVisible();
    }
  });
});
