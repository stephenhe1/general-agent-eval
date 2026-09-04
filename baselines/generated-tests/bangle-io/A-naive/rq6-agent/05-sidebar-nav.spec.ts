import { test, expect } from '@playwright/test';
import { createWorkspace, createNoteViaNewFile, openAllCommands } from './helpers';

/**
 * Tests for sidebar and navigation features.
 */

test.describe('Sidebar toggle', () => {
  test('Toggle Sidebar button collapses and restores sidebar', async ({ page }) => {
    await createWorkspace(page, 'sidebar-toggle-ws');

    // Sidebar visible initially
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();

    // Click toggle to collapse
    await page.getByRole('button', { name: /Toggle Sidebar/i }).click();
    await page.waitForTimeout(500);

    // Sidebar collapses - wrapper should have collapsed state
    const hasCollapsed = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-collapsible]');
      return wrapper?.getAttribute('data-collapsible') === 'collapsed' ||
             wrapper?.getAttribute('data-state') === 'collapsed';
    });
    expect(hasCollapsed).toBe(true);

    // Toggle back to expanded
    await page.getByRole('button', { name: /Toggle Sidebar/i }).click();
    await page.waitForTimeout(500);

    await expect(sidebar).toBeVisible();
  });
});

test.describe('App Actions menu (Bangle.io button)', () => {
  test('Bangle.io button opens app actions dropdown with expected items', async ({ page }) => {
    await createWorkspace(page, 'app-actions-ws');

    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.waitForTimeout(300);

    // Menu items present
    const menuItems = page.locator('[role="menuitem"]');
    await expect(menuItems.filter({ hasText: 'New Note' })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'New Workspace' })).toBeVisible();
    await expect(menuItems.filter({ hasText: /Omni Search/ })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'All Commands' })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'Change Theme' })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'Homepage' })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'GitHub Project' })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'Report an Issue' })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'Twitter' })).toBeVisible();
    await expect(menuItems.filter({ hasText: 'Discord' })).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('New Note from app actions opens create note dialog', async ({ page }) => {
    await createWorkspace(page, 'app-menu-newnote-ws');

    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: 'New Note' }).click();

    // Create Note dialog opens
    await expect(page.getByText('Create Note')).toBeVisible();
    await expect(page.locator('[cmdk-input]')).toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('Omni Search', () => {
  test('search button opens omni search with expected sections', async ({ page }) => {
    await createWorkspace(page, 'omni-search-ws');
    await createNoteViaNewFile(page);

    // Navigate to ws-home to get consistent search context
    await page.goto('/ws#route=ws-home&wsName=omni-search-ws');
    await page.waitForLoadState('networkidle');

    // Open omni search via button
    const searchBtn = page.locator('[role="button"]', { hasText: /Search/ });
    await searchBtn.first().click();
    await page.waitForTimeout(300);

    // CMDK dialog is open
    await expect(page.locator('[cmdk-input]')).toBeVisible();
    await expect(page.locator('[cmdk-input]')).toHaveAttribute('placeholder', 'Type a command or search...');

    // Commands section present
    await expect(page.locator('[cmdk-group-heading]').filter({ hasText: /Commands/ })).toBeVisible();

    // Close
    await page.keyboard.press('Escape');
    await expect(page.locator('[cmdk-input]')).not.toBeVisible();
  });

  test('omni search filters results by typed text', async ({ page }) => {
    await createWorkspace(page, 'omni-filter-ws');
    await createNoteViaNewFile(page);

    const searchBtn = page.locator('[role="button"]', { hasText: /Search/ });
    await searchBtn.first().click();
    await page.waitForTimeout(300);

    const cmdk = page.locator('[cmdk-input]');
    await cmdk.fill('Delete');
    await page.waitForTimeout(300);

    // Should show Delete-related items
    const items = page.locator('[cmdk-item]');
    await expect(items.filter({ hasText: /Delete Note/ })).toBeVisible();

    // Should not show unrelated items like "Clone Note"
    await expect(items.filter({ hasText: /^Clone Note$/ })).not.toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('omni search shows notes in groups', async ({ page }) => {
    await createWorkspace(page, 'omni-notes-ws');
    await createNoteViaNewFile(page);

    // Open search from editor (has context)
    const searchBtn = page.locator('[role="button"]', { hasText: /Search/ });
    await searchBtn.first().click();
    await page.waitForTimeout(300);

    // Groups should include Recent Notes and All Notes
    const groups = page.locator('[cmdk-group-heading]');
    const groupTexts = await groups.allTextContents();

    // At minimum, there should be some groups
    expect(groupTexts.length).toBeGreaterThan(0);

    // Note should appear in some section (use first() to avoid strict mode)
    await expect(page.locator('[cmdk-item]').filter({ hasText: 'untitled-1.md' }).first()).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('Omni Search command from app actions opens search', async ({ page }) => {
    await createWorkspace(page, 'omni-cmd-ws');

    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /Omni Search/ }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('[cmdk-input]')).toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('All Commands palette', () => {
  test('All Commands shows full list of available commands', async ({ page }) => {
    await createWorkspace(page, 'all-cmds-palette-ws');

    await openAllCommands(page);

    const items = page.locator('[cmdk-item]');
    const itemTexts = await items.allTextContents();

    // All expected commands present (use some() to be flexible about exact text)
    const hasCommand = (text: string) => itemTexts.some(t => t.includes(text));
    expect(hasCommand('Clone Note')).toBe(true);
    expect(hasCommand('Delete Note')).toBe(true);
    expect(hasCommand('Delete Workspace')).toBe(true);
    expect(hasCommand('New Directory')).toBe(true);
    expect(hasCommand('New Note')).toBe(true);
    expect(hasCommand('New Workspace')).toBe(true);
    expect(hasCommand('Open Daily Note')).toBe(true);
    expect(hasCommand('Quick New Note')).toBe(true);
    expect(hasCommand('Rename Note')).toBe(true);
    expect(hasCommand('Switch Workspace')).toBe(true);
    expect(hasCommand('View All Files')).toBe(true);

    await page.keyboard.press('Escape');
  });

  test('All Commands filters by search', async ({ page }) => {
    await createWorkspace(page, 'all-cmds-filter-ws');

    await openAllCommands(page);

    // Filter by "Daily"
    await page.locator('[cmdk-input]').fill('Daily');
    await page.waitForTimeout(300);

    // Only daily-related commands visible
    const items = page.locator('[cmdk-item]');
    await expect(items.filter({ hasText: /Open Daily Note/ })).toBeVisible();
    await expect(items.filter({ hasText: /^Delete Note$/ })).not.toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('Change Theme', () => {
  test('theme dialog shows System, Light, Dark options', async ({ page }) => {
    await createWorkspace(page, 'theme-dialog-ws');

    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /Change Theme/i }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Change Theme')).toBeVisible();
    await expect(page.getByText('Themes')).toBeVisible();

    const items = page.locator('[cmdk-item]');
    await expect(items.filter({ hasText: 'System' })).toBeVisible();
    await expect(items.filter({ hasText: 'Light' })).toBeVisible();
    await expect(items.filter({ hasText: 'Dark' })).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('selecting Dark theme changes html data-theme attribute', async ({ page }) => {
    await createWorkspace(page, 'theme-dark-ws');

    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /Change Theme/i }).click();
    await page.waitForTimeout(300);

    // Select Dark
    await page.locator('[cmdk-item]').filter({ hasText: 'Dark' }).click();
    await page.waitForTimeout(500);

    // html element should have dark theme class
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('BU_dark-scheme');

    const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(dataTheme).toBe('BU_dark-scheme');
  });

  test('selecting Light theme sets light theme', async ({ page }) => {
    await createWorkspace(page, 'theme-light-ws');

    // Set to dark first
    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /Change Theme/i }).click();
    await page.waitForTimeout(300);
    await page.locator('[cmdk-item]').filter({ hasText: 'Dark' }).click();
    await page.waitForTimeout(300);

    // Now set to light
    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /Change Theme/i }).click();
    await page.waitForTimeout(300);
    await page.locator('[cmdk-item]').filter({ hasText: 'Light' }).click();
    await page.waitForTimeout(500);

    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('BU_light-scheme');
  });

  test('Switch Theme command from All Commands works', async ({ page }) => {
    await createWorkspace(page, 'theme-switch-cmd-ws');

    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Switch Theme/ }).click();
    await page.waitForTimeout(300);

    // Theme dialog opens
    await expect(page.getByText('Change Theme')).toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('View All Files', () => {
  test('View All Files command opens a sheet with all files listed', async ({ page }) => {
    await createWorkspace(page, 'viewallfiles-ws');
    await createNoteViaNewFile(page);

    // Open All Commands
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /View All Files/ }).click();
    await page.waitForTimeout(500);

    // Sheet opens showing "All Files" - look for the visible span (not sr-only)
    const allFilesSpan = page.locator('[data-state="open"] span').filter({ hasText: 'All Files' });
    await expect(allFilesSpan).toBeVisible({ timeout: 5000 });

    // The note we created should be listed (use first() to avoid strict mode)
    await expect(page.getByText('untitled-1.md').first()).toBeVisible();

    // Close the sheet
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(300);
    await expect(allFilesSpan).not.toBeVisible();
  });

  test('All Files sheet shows all notes in workspace', async ({ page }) => {
    await createWorkspace(page, 'viewallfiles-multi-ws');
    await createNoteViaNewFile(page);

    // Create another note
    await page.goto('/ws#route=ws-home&wsName=viewallfiles-multi-ws');
    await page.waitForLoadState('networkidle');
    await createNoteViaNewFile(page);

    // Open All Files
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /View All Files/ }).click();
    await page.waitForTimeout(500);

    // Both notes visible in the sheet
    const sheet = page.locator('[data-state="open"]').filter({ hasText: 'All Files' }).last();
    await expect(sheet.getByText('untitled-1.md')).toBeVisible();
    await expect(sheet.getByText('untitled-2.md')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
  });
});

test.describe('Focus Editor command', () => {
  test('Focus Editor command is available in omni search', async ({ page }) => {
    await createWorkspace(page, 'focus-editor-ws');
    await createNoteViaNewFile(page);

    // Open omni search
    const searchBtn = page.locator('[role="button"]', { hasText: /Search/ });
    await searchBtn.first().click();
    await page.waitForTimeout(300);

    // Focus Editor command should be visible
    await expect(page.locator('[cmdk-item]').filter({ hasText: /Focus Editor/ })).toBeVisible();

    // Click it
    await page.locator('[cmdk-item]').filter({ hasText: /Focus Editor/ }).click();
    await page.waitForTimeout(500);

    // Command palette should be closed and editor should be visible
    await expect(page.locator('[cmdk-input]')).not.toBeVisible();
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();
  });
});

test.describe('Go to Workspace Home command', () => {
  test('Go to Workspace Home navigates from editor to ws-home', async ({ page }) => {
    await createWorkspace(page, 'goto-wshome-ws');
    await createNoteViaNewFile(page);

    // Currently in editor
    expect(page.url()).toContain('route=editor');

    // Open All Commands and click Go to Workspace Home
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Go to Workspace Home/ }).click();

    // Hash navigation - poll URL
    await expect(page).toHaveURL(/route=ws-home/, { timeout: 10000 });
    expect(page.url()).toContain('wsName=goto-wshome-ws');
  });
});
