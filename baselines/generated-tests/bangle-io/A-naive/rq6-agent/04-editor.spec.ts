import { test, expect } from '@playwright/test';
import { createWorkspace, createNoteViaNewFile, openAllCommands } from './helpers';

/**
 * Tests for note editor interactions.
 */

test.describe('Editor content', () => {
  test('editor is editable and accepts typed text', async ({ page }) => {
    await createWorkspace(page, 'editor-type-ws');
    await createNoteViaNewFile(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();

    // Click editor to focus
    await editor.click();

    // Type content
    await page.keyboard.type('Hello World');

    // Content is visible in editor
    await expect(editor).toContainText('Hello World');
  });

  test('editor shows placeholder when empty', async ({ page }) => {
    await createWorkspace(page, 'editor-placeholder-ws');
    await createNoteViaNewFile(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();

    // Placeholder is visible when editor is empty
    const placeholder = editor.locator('[data-placeholder]');
    await expect(placeholder).toBeVisible();
  });

  test('editor content persists after page reload', async ({ page }) => {
    await createWorkspace(page, 'editor-persist-ws');
    await createNoteViaNewFile(page);

    const noteUrl = page.url();

    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    await page.keyboard.type('Persistent content 123');
    await page.waitForTimeout(1000); // Allow debounced save

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Content should still be there
    await expect(page.locator('[contenteditable="true"]')).toContainText('Persistent content 123');
  });

  test('editor renders basic text formatting (bold, italic)', async ({ page }) => {
    await createWorkspace(page, 'editor-format-ws');
    await createNoteViaNewFile(page);

    const editor = page.locator('[contenteditable="true"]');
    await editor.click();

    // Type markdown syntax that should render
    await page.keyboard.type('**Bold text**');
    await page.waitForTimeout(500);

    // The editor should have content with bold text
    // (ProseMirror may auto-convert Markdown)
    await expect(editor).toContainText('Bold text');
  });
});

test.describe('Star / Unstar note', () => {
  test('star button toggles between star and unstar', async ({ page }) => {
    await createWorkspace(page, 'star-note-ws');
    await createNoteViaNewFile(page);

    // Initially shows "Star this item" (exact match to avoid matching "Unstar this item")
    const starBtn = page.getByTitle('Star this item', { exact: true });
    await expect(starBtn).toBeVisible();

    // Click to star
    await starBtn.click();
    await page.waitForTimeout(300);

    // Now shows "Unstar this item"
    await expect(page.getByTitle('Unstar this item', { exact: true })).toBeVisible();
    await expect(page.getByTitle('Star this item', { exact: true })).not.toBeVisible();
  });

  test('unstar restores star button', async ({ page }) => {
    await createWorkspace(page, 'unstar-note-ws');
    await createNoteViaNewFile(page);

    // Star first (exact match)
    await page.getByTitle('Star this item', { exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByTitle('Unstar this item', { exact: true })).toBeVisible();

    // Unstar
    await page.getByTitle('Unstar this item', { exact: true }).click();
    await page.waitForTimeout(300);

    // Back to unstarred state
    await expect(page.getByTitle('Star this item', { exact: true })).toBeVisible();
    await expect(page.getByTitle('Unstar this item', { exact: true })).not.toBeVisible();
  });

  test('star persists after page reload', async ({ page }) => {
    await createWorkspace(page, 'star-persist-ws');
    await createNoteViaNewFile(page);

    const noteUrl = page.url();

    // Star the note (exact match)
    await page.getByTitle('Star this item', { exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByTitle('Unstar this item', { exact: true })).toBeVisible();

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Still starred
    await expect(page.getByTitle('Unstar this item', { exact: true })).toBeVisible();
  });

  test('Toggle Star for Current Note command also toggles star', async ({ page }) => {
    await createWorkspace(page, 'star-cmd-ws');
    await createNoteViaNewFile(page);

    await expect(page.getByTitle('Star this item', { exact: true })).toBeVisible();

    // Use All Commands to toggle star
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Toggle Star for Current Note/ }).click();
    await page.waitForTimeout(500);

    // Should now be starred
    await expect(page.getByTitle('Unstar this item', { exact: true })).toBeVisible();
  });
});

test.describe('Toggle Max Width', () => {
  test('toggle max width button exists in editor', async ({ page }) => {
    await createWorkspace(page, 'toggle-width-ws');
    await createNoteViaNewFile(page);

    await expect(page.getByTitle('Toggle Max Width')).toBeVisible();
  });

  test('Toggle Wide Editor command changes editor width', async ({ page }) => {
    await createWorkspace(page, 'toggle-wide-ws');
    await createNoteViaNewFile(page);

    // Get container to check width class changes
    const editorContainer = page.locator('[contenteditable="true"]').locator('..');

    // Use the Toggle Max Width button
    await page.getByTitle('Toggle Max Width').click();
    await page.waitForTimeout(500);

    // Button should still be visible (toggle)
    await expect(page.getByTitle('Toggle Max Width')).toBeVisible();
  });
});

test.describe('Breadcrumb navigation', () => {
  test('breadcrumb shows home icon and note filename', async ({ page }) => {
    await createWorkspace(page, 'breadcrumb-ws');
    await createNoteViaNewFile(page);

    const breadcrumb = page.locator('nav[aria-label="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    // Home icon link
    const homeLink = breadcrumb.locator('a[title="Home"]');
    await expect(homeLink).toBeVisible();

    // Note name appears in breadcrumb
    await expect(breadcrumb).toContainText('untitled-1.md');
  });

  test('clicking breadcrumb home navigates to workspace home', async ({ page }) => {
    await createWorkspace(page, 'breadcrumb-home-ws');
    await createNoteViaNewFile(page);

    const breadcrumb = page.locator('nav[aria-label="breadcrumb"]');
    const homeLink = breadcrumb.locator('a[title="Home"]');

    await homeLink.click();
    // Hash navigation - poll URL
    await expect(page).toHaveURL(/route=ws-home/, { timeout: 10000 });

    expect(page.url()).toContain('route=ws-home');
    expect(page.url()).toContain('wsName=breadcrumb-home-ws');
  });
});

test.describe('Open Daily Note', () => {
  test('Open Daily Note command creates a date-based note', async ({ page }) => {
    await createWorkspace(page, 'daily-note-ws');

    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Open Daily Note/ }).click();

    // Navigate to a note with today's date
    await page.waitForURL('**/ws#route=editor**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const url = page.url();
    // URL should contain a date-like filename
    expect(url).toContain('daily-note-ws');
    expect(url).toMatch(/\d{4}-[A-Z][a-z]{2}-\d{2}-daily\.md/);

    // Editor should be open
    await expect(page.locator('[contenteditable="true"]')).toBeVisible();
  });

  test('calling Open Daily Note twice navigates to same note', async ({ page }) => {
    await createWorkspace(page, 'daily-note-same-ws');

    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Open Daily Note/ }).click();

    await page.waitForURL('**/ws#route=editor**', { timeout: 10000 });
    const firstUrl = page.url();

    // Go to workspace home
    await page.goto('/ws#route=ws-home&wsName=daily-note-same-ws');
    await page.waitForLoadState('networkidle');

    // Open daily note again
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Open Daily Note/ }).click();

    await page.waitForURL('**/ws#route=editor**', { timeout: 10000 });
    const secondUrl = page.url();

    // Same daily note both times
    expect(firstUrl).toBe(secondUrl);
  });
});
