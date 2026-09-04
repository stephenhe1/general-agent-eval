// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 21: Toggle Sidebar', () => {
  test('should collapse and expand the sidebar using toggle button', async ({ page }) => {
    // Set up workspace ws-sidebar-toggle
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('radio', { name: /Browser/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-sidebar-toggle');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Create a file so we are on an editor page
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForURL(/untitled-1/);

    // Verify the sidebar is visible (contains the workspace name)
    const sidebarEl = page.locator('.peer[data-state]');
    await expect(sidebarEl).toHaveAttribute('data-state', 'expanded');
    await expect(page.locator('[data-sidebar="sidebar"]')).toContainText('ws-sidebar-toggle');

    // Click the Toggle Sidebar button to collapse
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await page.waitForTimeout(300);

    // After collapsing: sidebar data-state is collapsed, content is off-screen
    await expect(sidebarEl).toHaveAttribute('data-state', 'collapsed');
    const collapsedBox = await page.locator('[data-sidebar="sidebar"]').boundingBox();
    expect(collapsedBox!.x).toBeLessThan(0);

    // Click the Toggle Sidebar button again to expand
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await page.waitForTimeout(300);

    // After expanding: sidebar is visible again with workspace name and files list
    await expect(sidebarEl).toHaveAttribute('data-state', 'expanded');
    const expandedBox = await page.locator('[data-sidebar="sidebar"]').boundingBox();
    expect(expandedBox!.x).toBeGreaterThanOrEqual(0);
    await expect(page.locator('[data-sidebar="sidebar"]')).toContainText('ws-sidebar-toggle');
    await expect(page.locator('[data-sidebar="sidebar"]')).toContainText('Files');
  });
});
