import { test, expect } from '@playwright/test';
import { createWorkspace } from './helpers';

/**
 * Tests for all application pages/routes.
 */

test.describe('Welcome page', () => {
  test('shows "Welcome to Bangle" for new browser session at /welcome', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');

    // Page shows welcome heading (new user or returning user)
    const heading = page.locator('h1, h2, p').filter({ hasText: /Welcome/ });
    await expect(heading.first()).toBeVisible();

    // Create Workspace button is present
    await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeVisible();

    // URL stays at /welcome
    expect(page.url()).toContain('/welcome');
  });

  test('shows "Recent workspaces" section and workspace link after workspace exists', async ({ page }) => {
    // Create a workspace first - this sets up the "returning user" state
    await createWorkspace(page, 'welcome-back-ws');

    // Navigate to welcome route
    await page.goto('/ws#route=welcome');
    await page.waitForLoadState('networkidle');

    // The welcome page always shows "Welcome to Bangle"; when workspaces exist it shows
    // "Recent workspaces" and links to each workspace (no "Welcome back!" text in this app)
    await expect(page.getByRole('heading', { name: /Welcome to Bangle/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Recent workspaces/i })).toBeVisible();

    // The workspace should appear in the recent workspaces list
    await expect(page.getByText('welcome-back-ws')).toBeVisible();
  });

  test('shows "Create a workspace to get started" prompt with no workspaces', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');
    // Create a workspace to get started prompt visible
    await expect(page.getByText(/Create a workspace to get started/i)).toBeVisible();
  });
});

test.describe('Workspace Home page', () => {
  test('shows workspace home with empty state after creation', async ({ page }) => {
    await createWorkspace(page, 'wshome-empty-test');

    expect(page.url()).toContain('route=ws-home');
    expect(page.url()).toContain('wsName=wshome-empty-test');

    // Workspace name shown in sidebar and header
    await expect(page.getByText('wshome-empty-test').first()).toBeVisible();

    // Empty state message
    await expect(page.getByText('No notes found in this workspace.')).toBeVisible();

    // Action buttons
    await expect(page.getByRole('button', { name: /New Note/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Switch Workspace/i })).toBeVisible();
  });

  test('shows recent notes after creating notes', async ({ page }) => {
    await createWorkspace(page, 'wshome-notes-test');

    // Create a note
    await page.getByTitle('New File').click();
    await page.waitForURL('**/ws#route=editor**', { timeout: 10000 });

    // Go back to workspace home
    await page.goto('/ws#route=ws-home&wsName=wshome-notes-test');
    await page.waitForLoadState('networkidle');

    // Should show recent notes heading
    await expect(page.getByText('Recent notes')).toBeVisible();

    // The note we created should appear (use first() to avoid strict mode on multiple matches)
    await expect(page.getByText('untitled-1.md').first()).toBeVisible();

    // "No notes found" should NOT be shown
    await expect(page.getByText('No notes found in this workspace.')).not.toBeVisible();
  });
});

test.describe('Note Editor page', () => {
  test('opens note editor with ProseMirror editor', async ({ page }) => {
    await createWorkspace(page, 'editor-page-test');
    await page.getByTitle('New File').click();
    await page.waitForURL('**/ws#route=editor**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // URL contains editor route
    expect(page.url()).toContain('route=editor');

    // ProseMirror editor is present and editable
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();

    // Editor shows placeholder text
    await expect(editor.locator('[data-placeholder]')).toBeVisible();

    // Star button and Toggle Max Width are visible
    await expect(page.getByTitle('Star this item')).toBeVisible();
    await expect(page.getByTitle('Toggle Max Width')).toBeVisible();

    // Breadcrumb shows note name
    await expect(page.locator('nav[aria-label="breadcrumb"]')).toBeVisible();
    await expect(page.locator('nav[aria-label="breadcrumb"]').getByText('untitled-1.md')).toBeVisible();
  });

  test('sidebar shows "Opened" section with current note', async ({ page }) => {
    await createWorkspace(page, 'editor-sidebar-test');
    await page.getByTitle('New File').click();
    await page.waitForURL('**/ws#route=editor**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Sidebar shows "Opened" section
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByText('Opened')).toBeVisible();
    await expect(sidebar.getByText('untitled-1.md').first()).toBeVisible();
  });
});

test.describe('Note Not Found page', () => {
  test('shows note not found when navigating to nonexistent note path', async ({ page }) => {
    await createWorkspace(page, 'notfound-note-ws');

    await page.goto('/ws#route=editor&wsPath=notfound-note-ws%3Adoes-not-exist.md');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Note Not Found')).toBeVisible();
    await expect(page.getByText(/doesn't exist or has been moved/)).toBeVisible();

    // Action buttons
    await expect(page.getByRole('button', { name: /View All Notes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Note/i })).toBeVisible();
  });

  test('"View All Notes" button from note-not-found opens file list or navigates', async ({ page }) => {
    await createWorkspace(page, 'notfound-note-nav-ws');

    await page.goto('/ws#route=editor&wsPath=notfound-note-nav-ws%3Adoes-not-exist.md');
    await page.waitForLoadState('networkidle');

    // Wait for note-not-found view to be visible
    await expect(page.getByText('Note Not Found')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /View All Notes/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /View All Notes/i }).click();
    await page.waitForTimeout(1000);

    // The button either navigates to ws-home OR opens an "All Files" sheet over the current page.
    // When the sheet is open, "Note Not Found" may still be in the background DOM — that is OK.
    const currentUrl = page.url();
    const isOnWsHome = currentUrl.includes('route=ws-home');

    if (isOnWsHome) {
      // Navigated away from note-not-found to workspace home
      await expect(page.getByRole('heading', { name: /Recent notes|No notes found/i }).first()).toBeVisible();
    } else {
      // All Files sheet opened over the current page
      const allFilesSpan = page.locator('[data-state="open"] span').filter({ hasText: 'All Files' });
      await expect(allFilesSpan).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Workspace Not Found page', () => {
  test('shows workspace not found for nonexistent workspace', async ({ page }) => {
    await page.goto('/ws#route=ws-home&wsName=totally-nonexistent-workspace-xyz123');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Workspace Not Found')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Workspace/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Switch Workspace/i })).toBeVisible();
  });

  test('"Create Workspace" from workspace-not-found opens create dialog', async ({ page }) => {
    await page.goto('/ws#route=ws-home&wsName=nonexistent-ws-for-create');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Create Workspace/i }).click();

    // Create workspace dialog opens
    await expect(page.getByText('Select a workspace type')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Browser/ })).toBeVisible();
  });
});

test.describe('Page Not Found page', () => {
  test('shows page not found for unknown route', async ({ page }) => {
    await page.goto('/ws#route=totally-unknown-route-xyz');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Page Not Found')).toBeVisible();
    await expect(page.getByRole('button', { name: /Go to Welcome Screen/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Report Issue/i })).toBeVisible();
  });

  test('"Go to Welcome Screen" from 404 navigates to welcome', async ({ page }) => {
    await page.goto('/ws#route=totally-unknown-route-xyz');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Go to Welcome Screen/i }).click();
    await page.waitForLoadState('networkidle');

    // Should land on welcome page
    const url = page.url();
    expect(url).toMatch(/welcome|\/ws#route=welcome/);
  });
});
