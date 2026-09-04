import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Admin - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('settings features page loads with toggles', async ({ page }) => {
    await page.goto('/settings/features');
    await expect(page).toHaveTitle(/Settings/);
    // Should have toggle-switch labels visible (BookStack uses CSS toggle switches)
    await expect(page.locator('label.toggle-switch').first()).toBeVisible();
  });

  test('settings customization page loads', async ({ page }) => {
    await page.goto('/settings/customization');
    await expect(page).toHaveTitle(/Settings/);
  });

  test('settings registration page loads', async ({ page }) => {
    await page.goto('/settings/registration');
    await expect(page).toHaveTitle(/Settings/);
  });

  test('settings maintenance page loads', async ({ page }) => {
    await page.goto('/settings/maintenance');
    await expect(page).toHaveTitle(/Maintenance/);
  });

  test('audit log page loads', async ({ page }) => {
    await page.goto('/settings/audit');
    await expect(page).toHaveTitle(/Audit Log/);
    // Heading should be present
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });

  test('recycle bin page loads', async ({ page }) => {
    await page.goto('/settings/recycle-bin');
    await expect(page).toHaveTitle(/Recycle Bin/);
  });

  test('licenses page loads', async ({ page }) => {
    await page.goto('/licenses');
    await expect(page).toHaveTitle(/Licenses/);
  });
});

test.describe('Admin - Users', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('users list page shows seeded users', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page).toHaveTitle(/Users/);
    // Admin user should be listed
    await expect(page.getByText('admin@admin.com').first()).toBeVisible();
    // Create user link
    await expect(page.locator('a[href*="/settings/users/create"]')).toBeVisible();
  });

  test('create user - new user appears in users list', async ({ page }) => {
    const timestamp = Date.now();
    const userName = `Test User ${timestamp}`;
    const userEmail = `testuser${timestamp}@example.com`;

    await page.goto('/settings/users/create');
    await expect(page).toHaveTitle(/Add New User/);

    await page.fill('[name="name"]', userName);
    await page.fill('[name="email"]', userEmail);

    // The "Send user invite email" toggle is enabled by default, disabling password field.
    // Click the toggle label to disable it and enable password entry.
    const sendInviteToggle = page.locator('label.toggle-switch:has-text("Send user invite email")');
    await sendInviteToggle.click();
    await page.waitForTimeout(300);

    await page.fill('[name="password"]', 'password123!');
    await page.fill('[name="password-confirm"]', 'password123!');

    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should redirect to users list or user edit page
    await expect(page).toHaveURL(/\/settings\/users/);

    // Verify user appears in list
    await page.goto('/settings/users');
    await expect(page.getByText(userEmail).first()).toBeVisible();
  });

  test('edit user - name update saved', async ({ page }) => {
    await page.goto('/settings/users/1');

    const originalName = await page.inputValue('[name="name"]');
    const newName = `Admin Edited ${Date.now()}`;

    await page.fill('[name="name"]', newName);
    // Use the Save button from the user edit form (not the search submit)
    await page.locator('button.button[type="submit"]:has-text("Save")').click();
    await page.waitForLoadState('networkidle');

    // Go back and verify
    await page.goto('/settings/users/1');
    await expect(page.locator('[name="name"]')).toHaveValue(newName);

    // Restore original name
    await page.fill('[name="name"]', originalName);
    await page.locator('button.button[type="submit"]:has-text("Save")').click();
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Admin - Roles', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('roles list shows seeded roles', async ({ page }) => {
    await page.goto('/settings/roles');
    await expect(page).toHaveTitle(/Roles/);
    // Should have Admin role
    await expect(page.getByText('Admin').first()).toBeVisible();
    // Create role link - BookStack uses /settings/roles/new
    await expect(page.locator('a[href*="/settings/roles/new"]')).toBeVisible();
  });

  test('edit role page loads with permissions', async ({ page }) => {
    await page.goto('/settings/roles/1');
    await expect(page).toHaveTitle(/Edit Role/);
    // BookStack uses toggle-switch labels (CSS toggles) for permissions
    await expect(page.locator('label.toggle-switch').first()).toBeVisible();
    // Should have permission labels
    await expect(page.getByText('Manage app settings')).toBeVisible();
  });
});

test.describe('Admin - Webhooks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('webhooks list page loads', async ({ page }) => {
    await page.goto('/settings/webhooks');
    await expect(page).toHaveTitle(/Webhooks/);
    await expect(page.locator('a[href*="/settings/webhooks/create"]')).toBeVisible();
  });

  test('create webhook - webhook appears in list', async ({ page }) => {
    const hookName = `Test Webhook ${Date.now()}`;

    await page.goto('/settings/webhooks/create');
    await expect(page).toHaveTitle(/Create New Webhook/);

    await page.fill('[name="name"]', hookName);
    await page.fill('[name="endpoint"]', 'https://example.com/webhook');
    // Timeout field is required
    await page.fill('[name="timeout"]', '5');
    // BookStack uses toggle-switch labels for event selection (hidden checkboxes)
    // Click the "page_create" event toggle label
    await page.locator('label.toggle-switch:has-text("page_create")').click();

    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should redirect to webhooks list or webhook edit
    await expect(page).toHaveURL(/\/settings\/webhooks/);

    // Verify webhook is in list
    await page.goto('/settings/webhooks');
    await expect(page.getByText(hookName).first()).toBeVisible();
  });
});
