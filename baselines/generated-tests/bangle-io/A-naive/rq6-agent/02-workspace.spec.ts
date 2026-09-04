import { test, expect } from '@playwright/test';
import { createWorkspace, openAllCommands } from './helpers';

/**
 * Tests for workspace-related flows.
 */

test.describe('Create Workspace flow', () => {
  test('creates a browser workspace via Create Workspace dialog', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Workspace' }).click();

    // Dialog shows workspace type selection
    await expect(page.getByText('Select a workspace type')).toBeVisible();

    // Browser option is pre-selected (aria-checked=true)
    const browserRadio = page.getByRole('radio', { name: /Browser/ });
    await expect(browserRadio).toBeVisible();
    await expect(browserRadio).toHaveAttribute('aria-checked', 'true');

    // Click Next
    await page.getByRole('button', { name: 'Next' }).click();

    // Name entry step
    await expect(page.getByText('Enter Workspace Name')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Workspace Name' })).toBeVisible();

    // Create button is disabled until name is entered
    const createBtn = page.getByRole('button', { name: 'Create' });
    await expect(createBtn).toBeDisabled();

    // Fill name and create
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('new-browser-ws-test');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Navigate to workspace home
    await page.waitForURL('**/ws#route=ws-home**', { timeout: 10000 });
    expect(page.url()).toContain('wsName=new-browser-ws-test');

    // Workspace name appears in sidebar
    await expect(page.getByText('new-browser-ws-test').first()).toBeVisible();
  });

  test('Back button returns to type selection from name entry', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Now at name entry
    await expect(page.getByText('Enter Workspace Name')).toBeVisible();

    // Click Back
    await page.getByRole('button', { name: 'Back' }).click();

    // Returns to type selection
    await expect(page.getByText('Select a workspace type')).toBeVisible();
  });

  test('Close button dismisses create workspace dialog', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await expect(page.getByText('Select a workspace type')).toBeVisible();

    // Click Close (X button)
    await page.getByRole('button', { name: 'Close' }).click();

    // Dialog is dismissed
    await expect(page.getByText('Select a workspace type')).not.toBeVisible();
    // Still on welcome page
    await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeVisible();
  });

  test('Native File System option can be selected', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Workspace' }).click();

    // Native File System option
    const nativeFsRadio = page.getByRole('radio', { name: /Native File System/ });
    await expect(nativeFsRadio).toBeVisible();
    await expect(nativeFsRadio).toHaveAttribute('aria-checked', 'false');

    // Click it
    await nativeFsRadio.click();
    await expect(nativeFsRadio).toHaveAttribute('aria-checked', 'true');
    // Browser should now be unchecked
    await expect(page.getByRole('radio', { name: /Browser/ })).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('Workspace selector in sidebar', () => {
  test('clicking workspace name shows workspace list with New Workspace option', async ({ page }) => {
    await createWorkspace(page, 'ws-selector-test');

    // Click the workspace button in sidebar header
    const wsButton = page.locator('[data-sidebar="menu-button"][data-size="lg"]').first();
    await wsButton.click();

    // Dropdown shows "Workspaces" heading and current workspace
    await expect(page.getByText('Workspaces')).toBeVisible();
    await expect(page.locator('[cmdk-item], [role="menuitem"]').filter({ hasText: 'ws-selector-test' })).toBeVisible();

    // "New Workspace" option
    await expect(page.locator('[cmdk-item], [role="menuitem"]').filter({ hasText: 'New Workspace' })).toBeVisible();

    // Close
    await page.keyboard.press('Escape');
  });

  test('workspace selector lists all created workspaces', async ({ page }) => {
    // Create two workspaces
    await createWorkspace(page, 'ws-list-test-1');
    await createWorkspace(page, 'ws-list-test-2');

    // Now on ws-list-test-2; open selector
    const wsButton = page.locator('[data-sidebar="menu-button"][data-size="lg"]').first();
    await wsButton.click();
    await page.waitForTimeout(300);

    // Both workspaces should be listed
    const items = page.locator('[cmdk-item], [role="menuitem"]');
    await expect(items.filter({ hasText: 'ws-list-test-1' })).toBeVisible();
    await expect(items.filter({ hasText: 'ws-list-test-2' })).toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('Switch Workspace', () => {
  test('Switch Workspace button opens workspace switcher dialog', async ({ page }) => {
    await createWorkspace(page, 'switch-ws-test');

    await page.getByRole('button', { name: /Switch Workspace/i }).click();

    // The badge text says "Switch Workspace" - use the cmdk badge locator specifically
    await expect(page.locator('[data-state="open"]').getByText('Switch Workspace')).toBeVisible({ timeout: 5000 });
    // Current workspace should be listed
    await expect(page.locator('[cmdk-item]').filter({ hasText: 'switch-ws-test' })).toBeVisible();
  });

  test('switching workspace navigates to new workspace home', async ({ page }) => {
    // Create two workspaces
    await createWorkspace(page, 'switch-source-ws');
    await createWorkspace(page, 'switch-target-ws');

    // Now on switch-target-ws; go back to switch-source-ws
    await page.goto('/ws#route=ws-home&wsName=switch-source-ws');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Switch Workspace/i }).click();
    await page.waitForTimeout(300);

    // Select switch-target-ws
    await page.locator('[cmdk-item]').filter({ hasText: 'switch-target-ws' }).click();

    // Hash navigation - poll URL instead of waitForURL (which needs load event)
    await expect(page).toHaveURL(/wsName=switch-target-ws/, { timeout: 10000 });
    expect(page.url()).toContain('wsName=switch-target-ws');
    await expect(page.getByText('switch-target-ws').first()).toBeVisible();
  });
});

test.describe('Delete Workspace flow', () => {
  test('delete workspace shows confirm dialog then deletes workspace', async ({ page }) => {
    await createWorkspace(page, 'delete-ws-test-a');

    // Remember what's in the workspace list before deletion
    const wsButton = page.locator('[data-sidebar="menu-button"][data-size="lg"]').first();
    await wsButton.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');

    // Use All Commands to find Delete Workspace
    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Delete Workspace/ }).click();
    await page.waitForTimeout(300);

    // Select the workspace to delete
    await page.locator('[cmdk-item]').filter({ hasText: 'delete-ws-test-a' }).click();
    await page.waitForTimeout(300);

    // Confirm dialog appears
    await expect(page.getByText('Confirm Delete')).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete the workspace "delete-ws-test-a"/)).toBeVisible();

    // Click Delete to confirm
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(1000);

    // Should navigate away from the deleted workspace
    // The workspace should no longer exist - navigating to it should show not found
    await page.goto('/ws#route=ws-home&wsName=delete-ws-test-a');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Workspace Not Found')).toBeVisible();
  });

  test('Cancel on delete workspace confirm does not delete workspace', async ({ page }) => {
    await createWorkspace(page, 'delete-ws-cancel-test');

    await openAllCommands(page);
    await page.locator('[cmdk-item]').filter({ hasText: /Delete Workspace/ }).click();
    await page.waitForTimeout(300);

    await page.locator('[cmdk-item]').filter({ hasText: 'delete-ws-cancel-test' }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Confirm Delete')).toBeVisible();

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(500);

    // Dialog dismissed
    await expect(page.getByText('Confirm Delete')).not.toBeVisible();

    // Workspace still exists
    await page.goto('/ws#route=ws-home&wsName=delete-ws-cancel-test');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('delete-ws-cancel-test').first()).toBeVisible();
    await expect(page.getByText('Workspace Not Found')).not.toBeVisible();
  });
});

test.describe('New Workspace from app menu', () => {
  test('app menu New Workspace opens create dialog', async ({ page }) => {
    await createWorkspace(page, 'app-menu-newws-test');

    await page.locator('button', { hasText: 'Bangle.io' }).click();
    await page.getByRole('menuitem', { name: /New Workspace/i }).click();

    // Create workspace dialog opens
    await expect(page.getByText('Select a workspace type')).toBeVisible();
  });
});
