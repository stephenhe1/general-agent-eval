import { test, expect } from '@playwright/test';
import { createWorkspace, createNoteViaNewFile, openOmniSearch, openAllCommands, openFileContextMenu } from './helpers';

/**
 * Tests for note CRUD flows and editor interactions.
 */

test.describe('Create Note flows', () => {
  test('creates note via New Note button and dialog', async ({ page }) => {
    await createWorkspace(page, 'create-note-dialog-ws');

    // Workspace starts empty
    await expect(page.getByText('No notes found in this workspace.')).toBeVisible();

    // Click New Note
    await page.getByRole('button', { name: /New Note/i }).click();

    // Create Note dialog appears
    await expect(page.getByText('Create Note')).toBeVisible();
    const cmdk = page.locator('[cmdk-input]');
    await expect(cmdk).toBeVisible();
    await expect(cmdk).toHaveAttribute('placeholder', 'Input a note name');

    // Type a note name
    await cmdk.fill('my-dialog-note');

    // "Create" option appears
    await expect(page.locator('[cmdk-item]').filter({ hasText: 'Create' })).toBeVisible();

    // Click Create
    await page.locator('[cmdk-item]').first().click();

    // Navigate to editor with the note (hash navigation - use toHaveURL)
    await expect(page).toHaveURL(/my-dialog-note\.md/, { timeout: 10000 });
    expect(page.url()).toContain('create-note-dialog-ws');
  });

  test('creates untitled note via sidebar New File button', async ({ page }) => {
    await createWorkspace(page, 'create-note-newfile-ws');

    // Click New File in sidebar
    await page.getByTitle('New File').click();

    // Navigate to editor (hash route - use toHaveURL)
    await expect(page).toHaveURL(/route=editor/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // URL contains the untitled note
    expect(page.url()).toContain('untitled-1.md');
    expect(page.url()).toContain('create-note-newfile-ws');

    // Note appears in sidebar
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByText('untitled-1.md').first()).toBeVisible();
  });

  test('creates multiple untitled notes with incrementing names', async ({ page }) => {
    await createWorkspace(page, 'create-multi-note-ws');

    // Create first note
    await page.getByTitle('New File').click();
    await expect(page).toHaveURL(/untitled-1\.md/, { timeout: 10000 });
    expect(page.url()).toContain('untitled-1.md');

    // Create second note from sidebar
    await page.goto('/ws#route=ws-home&wsName=create-multi-note-ws');
    await page.waitForLoadState('networkidle');
    await page.getByTitle('New File').click();
    await expect(page).toHaveURL(/route=editor/, { timeout: 10000 });

    // Second note should be untitled-2.md
    expect(page.url()).toContain('untitled-2.md');

    // Sidebar shows both notes
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByText('untitled-2.md').first()).toBeVisible();
  });

  test('note appears in workspace home Recent notes after creation', async ({ page }) => {
    await createWorkspace(page, 'note-recents-ws');
    await createNoteViaNewFile(page);

    // Go to workspace home
    await page.goto('/ws#route=ws-home&wsName=note-recents-ws');
    await page.waitForLoadState('networkidle');

    // Recent notes section visible
    await expect(page.getByText('Recent notes')).toBeVisible();
    // Note appears at least once (may appear in both sidebar and main area)
    await expect(page.getByText('untitled-1.md').first()).toBeVisible();

    // Empty state message gone
    await expect(page.getByText('No notes found in this workspace.')).not.toBeVisible();
  });
});

test.describe('Rename Note', () => {
  test('renames note via sidebar context menu', async ({ page }) => {
    await createWorkspace(page, 'rename-note-ws');
    await createNoteViaNewFile(page);

    const beforeUrl = page.url();
    expect(beforeUrl).toContain('untitled-1.md');

    // Open context menu and click Rename
    await openFileContextMenu(page, 'untitled-1.md');
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    // Rename dialog appears with current name pre-filled
    const cmdk = page.locator('[cmdk-input]');
    await expect(cmdk).toBeVisible();
    const currentValue = await cmdk.inputValue();
    expect(currentValue).toBe('untitled-1');

    // Clear and enter new name
    await cmdk.clear();
    await cmdk.fill('renamed-note');

    // Click "Confirm name change"
    await page.locator('[cmdk-item]').filter({ hasText: /Confirm name change/ }).click();

    // Hash navigation: poll URL for the change
    await expect(page).toHaveURL(/renamed-note\.md/, { timeout: 10000 });
    expect(page.url()).toContain('renamed-note.md');
    expect(page.url()).not.toContain('untitled-1.md');

    // Sidebar shows new name
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByText('renamed-note.md').first()).toBeVisible();
  });

  test('rename dialog is pre-filled with current note name (without extension)', async ({ page }) => {
    await createWorkspace(page, 'rename-prefill-ws');
    await createNoteViaNewFile(page);

    await openFileContextMenu(page, 'untitled-1.md');
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    // Pre-filled with "untitled-1" (no .md extension)
    const cmdk = page.locator('[cmdk-input]');
    await expect(cmdk).toBeVisible();
    expect(await cmdk.inputValue()).toBe('untitled-1');

    // Badge text shows file being renamed
    await expect(page.getByText(/Renaming "untitled-1"/)).toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('Delete Note', () => {
  test('deletes note via sidebar context menu with confirmation', async ({ page }) => {
    await createWorkspace(page, 'delete-ctx-ws');
    await createNoteViaNewFile(page);

    const sidebarBefore = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebarBefore.getByText('untitled-1.md').first()).toBeVisible();

    // Open context menu and click Delete
    await openFileContextMenu(page, 'untitled-1.md');
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    // Delete Note dialog appears with note pre-selected
    await expect(page.getByText('Delete Note')).toBeVisible();
    await expect(page.locator('[cmdk-item]').filter({ hasText: 'untitled-1.md' })).toBeVisible();

    // Click the note to confirm selection
    await page.locator('[cmdk-item]').filter({ hasText: 'untitled-1.md' }).click();
    await page.waitForTimeout(300);

    // AlertDialog "Confirm Delete" appears
    await expect(page.getByText('Confirm Delete')).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete "untitled-1"/)).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(1000);

    // Navigate back to ws-home to check note is gone
    await page.goto('/ws#route=ws-home&wsName=delete-ctx-ws');
    await page.waitForLoadState('networkidle');

    // Note should no longer appear
    await expect(page.getByText('No notes found in this workspace.')).toBeVisible();
    await expect(page.getByText('untitled-1.md')).not.toBeVisible();
  });

  test('Cancel on delete confirmation does not delete the note', async ({ page }) => {
    await createWorkspace(page, 'delete-cancel-ws');
    await createNoteViaNewFile(page);

    await openFileContextMenu(page, 'untitled-1.md');
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.waitForTimeout(300);

    // Click the note
    await page.locator('[cmdk-item]').filter({ hasText: 'untitled-1.md' }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Confirm Delete')).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(500);

    // Dialog dismissed
    await expect(page.getByText('Confirm Delete')).not.toBeVisible();

    // Note still exists - go to ws-home
    await page.goto('/ws#route=ws-home&wsName=delete-cancel-ws');
    await page.waitForLoadState('networkidle');
    // Note appears in recent notes or sidebar
    await expect(page.getByText('untitled-1.md').first()).toBeVisible();
  });

  test('deletes note via omni search Delete Note command', async ({ page }) => {
    await createWorkspace(page, 'delete-omni-ws');
    await createNoteViaNewFile(page);

    await openOmniSearch(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Delete Note/ }).click();
    await page.waitForTimeout(300);

    // Note appears in list
    await expect(page.locator('[cmdk-item]').filter({ hasText: 'untitled-1.md' })).toBeVisible();

    // Click to select
    await page.locator('[cmdk-item]').filter({ hasText: 'untitled-1.md' }).click();
    await page.waitForTimeout(300);

    // Confirm delete
    await expect(page.getByText('Confirm Delete')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(1000);

    // Workspace should now show empty state
    await page.goto('/ws#route=ws-home&wsName=delete-omni-ws');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No notes found in this workspace.')).toBeVisible();
  });
});

test.describe('Move Note', () => {
  test('Move dialog shows "No directories found" when no directories exist', async ({ page }) => {
    await createWorkspace(page, 'move-nodirs-ws');
    await createNoteViaNewFile(page);

    await openFileContextMenu(page, 'untitled-1.md');
    await page.getByRole('menuitem', { name: 'Move' }).click();

    // Move dialog appears
    await expect(page.getByText(/Move "untitled-1"/)).toBeVisible();
    await expect(page.getByText('No directories found')).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('Move dialog shows directory options after creating a directory', async ({ page }) => {
    await createWorkspace(page, 'move-withdirs-ws');

    // Create a named note at root level FIRST (before the directory exists)
    await page.getByRole('button', { name: /New Note/i }).click();
    const noteInput = page.locator('[cmdk-input]');
    await noteInput.waitFor({ state: 'visible', timeout: 5000 });
    await noteInput.fill('root-level-note');
    await page.locator('[cmdk-item]').first().click();
    await expect(page).toHaveURL(/root-level-note\.md/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Create a directory via All Commands — app auto-creates a note inside the directory
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /^New Directory/ }).click();
    await page.waitForTimeout(300);
    await page.locator('[cmdk-input]').fill('my-folder');
    await page.locator('[cmdk-item]').filter({ hasText: 'Create' }).click();
    // App navigates to the auto-created note inside my-folder
    await expect(page).toHaveURL(/my-folder/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate directly to root-level-note.md (which is at the workspace root, not inside my-folder)
    await page.goto('/ws#route=editor&wsPath=move-withdirs-ws%3Aroot-level-note.md');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/root-level-note\.md/, { timeout: 5000 });

    // Open context menu for the root-level note in the sidebar
    await openFileContextMenu(page, 'root-level-note.md');
    await page.getByRole('menuitem', { name: 'Move' }).click();

    // my-folder directory should be listed as a move target
    await expect(page.getByText(/Move "root-level-note"/)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[cmdk-item]').filter({ hasText: 'my-folder' })).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
  });
});

test.describe('Clone Note', () => {
  test('clone note creates a copy of the current note', async ({ page }) => {
    await createWorkspace(page, 'clone-note-ws');
    await createNoteViaNewFile(page);

    const originalUrl = page.url();
    expect(originalUrl).toContain('untitled-1.md');

    // Open omni search and click Clone Note
    await openOmniSearch(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Clone Note/ }).click();

    // Wait for URL to change to the cloned note (hash navigation - use toHaveURL)
    await expect(page).toHaveURL(/untitled-1-copy-1\.md/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // URL should point to copy
    const clonedUrl = page.url();
    expect(clonedUrl).toContain('untitled-1-copy-1.md');
    expect(clonedUrl).not.toEqual(originalUrl);

    // Sidebar shows both notes
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByText('untitled-1-copy-1.md').first()).toBeVisible();

    // Go to workspace home to verify both files
    await page.goto('/ws#route=ws-home&wsName=clone-note-ws');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('untitled-1.md').first()).toBeVisible();
    await expect(page.getByText('untitled-1-copy-1.md').first()).toBeVisible();
  });
});

test.describe('New Directory', () => {
  test('creates a directory via All Commands palette', async ({ page }) => {
    await createWorkspace(page, 'newdir-ws');

    // Open All Commands (New Directory is in All Commands, not default omni search)
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /^New Directory/ }).click();
    await page.waitForTimeout(300);

    // Create Directory dialog appears
    await expect(page.getByText('Create Directory')).toBeVisible();
    const cmdk = page.locator('[cmdk-input]');
    await expect(cmdk).toBeVisible();

    // Enter directory name
    await cmdk.fill('test-folder');

    // Create option available
    await expect(page.locator('[cmdk-item]').filter({ hasText: 'Create' })).toBeVisible();
    await page.locator('[cmdk-item]').filter({ hasText: 'Create' }).click();

    // App creates a note INSIDE the directory automatically and navigates to it.
    // The URL now contains test-folder in the wsPath, confirming the directory was created.
    await expect(page).toHaveURL(/test-folder/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify a note inside test-folder was created and the editor is open
    const url = page.url();
    expect(url).toContain('test-folder');
    expect(url).toContain('newdir-ws');

    // Editor is open for the auto-created note inside the directory
    await expect(page.locator('[contenteditable="true"]')).toBeVisible();

    // Sidebar shows test-folder in the path
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByText(/test-folder/).first()).toBeVisible();
  });
});
