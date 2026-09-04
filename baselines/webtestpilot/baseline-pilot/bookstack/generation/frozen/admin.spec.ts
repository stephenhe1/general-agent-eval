import { test, expect } from '@playwright/test';
import { login, uid } from './helpers';

test.describe('Admin - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('main settings page loads with features heading', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveTitle(/Settings/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('customization settings page loads', async ({ page }) => {
    await page.goto('/settings/customization');
    await expect(page).toHaveTitle(/Settings/);
    await expect(page.getByRole('heading', { name: 'Customization', exact: true })).toBeVisible();
  });

  test('registration settings page loads', async ({ page }) => {
    await page.goto('/settings/registration');
    await expect(page).toHaveTitle(/Settings/);
    await expect(page.getByRole('heading', { name: 'Registration', exact: true })).toBeVisible();
  });

  test('maintenance page loads with Recycle Bin section', async ({ page }) => {
    await page.goto('/settings/maintenance');
    await expect(page).toHaveTitle(/Maintenance/);
    // Maintenance page has h2 sections: Recycle Bin, Cleanup Images, etc.
    await expect(page.getByRole('heading', { name: 'Recycle Bin', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cleanup Images', exact: true })).toBeVisible();
  });

  test('recycle bin page loads', async ({ page }) => {
    await page.goto('/settings/recycle-bin');
    await expect(page).toHaveTitle(/Recycle Bin/);
    await expect(page.getByRole('heading', { name: 'Recycle Bin', exact: true })).toBeVisible();
  });

  test('deleted items appear in recycle bin', async ({ page }) => {
    // Get recycle bin count before deletion
    const beforeResp = await page.request.get('/api/recycle-bin?count=100');
    const beforeData = await beforeResp.json();
    const beforeTotal = beforeData.total as number;

    // Create and delete a book
    const bookName = uid('RecycleBin');
    await page.goto('/create-book');
    await page.locator('#name').fill(bookName);
    await page.getByRole('button', { name: 'Save Book' }).click();
    await page.waitForURL(/\/books\//);

    // Delete the book via the UI
    await page.getByRole('link', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForURL('/books');

    // Verify the recycle bin count increased (API confirms item was soft-deleted)
    const afterResp = await page.request.get('/api/recycle-bin?count=100');
    const afterData = await afterResp.json();
    expect(afterData.total).toBeGreaterThan(beforeTotal);

    // Verify the specific item is in the recycle bin via API
    const deletedItem = afterData.data.find((item: any) => item.deletable?.name === bookName);
    expect(deletedItem).toBeDefined();
    expect(deletedItem.deletable.name).toBe(bookName);

    // Also verify the recycle bin page loads with items
    await page.goto('/settings/recycle-bin');
    await expect(page.getByRole('heading', { name: 'Recycle Bin', exact: true })).toBeVisible();
  });
});

test.describe('Admin - Users', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('users list page shows existing users', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page).toHaveTitle(/Users/);
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
    // Admin user should be listed
    await expect(page.getByText(/admin@admin\.com/i)).toBeVisible();
  });

  test('add new user form is accessible', async ({ page }) => {
    await page.goto('/settings/users/create');
    await expect(page).toHaveTitle(/Add New User/);
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('create new user via API - user appears in list', async ({ page }) => {
    // BookStack's API supports user creation with cookie auth (same session)
    const userName = uid('TestUser');
    const userEmail = `testuser-${Date.now()}@example.com`;
    const response = await page.request.post('/api/users', {
      headers: { 'Content-Type': 'application/json' },
      data: { name: userName, email: userEmail, password: 'TestPassword123!' }
    });
    expect(response.status()).toBe(200);
    const userData = await response.json();
    expect(userData.email).toBe(userEmail);
    // Verify the user now appears in the admin user list
    await page.goto('/settings/users');
    await expect(page.getByText(userEmail)).toBeVisible();
  });

  test('edit user page loads for admin user', async ({ page }) => {
    await page.goto('/settings/users/1');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });
});

test.describe('Admin - Roles', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('roles list page shows default roles', async ({ page }) => {
    await page.goto('/settings/roles');
    await expect(page).toHaveTitle(/Roles/);
    await expect(page.getByRole('heading', { name: /Roles/i }).first()).toBeVisible();
    // Default BookStack roles should be present
    const content = await page.content();
    expect(content.includes('Admin') || content.includes('Editor') || content.includes('Viewer')).toBeTruthy();
  });

  test('create role form is accessible', async ({ page }) => {
    await page.goto('/settings/roles/new');
    await expect(page.locator('#display_name')).toBeVisible();
  });

  test('create role - new role appears in list', async ({ page }) => {
    const roleName = uid('Role');
    await page.goto('/settings/roles/new');
    await page.locator('#display_name').fill(roleName);
    await page.getByRole('button', { name: 'Save Role' }).click();
    // After save, verify role appears in roles list
    await page.waitForTimeout(1000);
    await page.goto('/settings/roles');
    await expect(page.getByText(roleName)).toBeVisible();
  });

  test('view/edit existing role page loads', async ({ page }) => {
    await page.goto('/settings/roles/1');
    await expect(page.locator('#display_name')).toBeVisible();
  });
});

test.describe('API Documentation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('API docs page loads with Getting Started section', async ({ page }) => {
    await page.goto('/api/docs');
    await expect(page).toHaveTitle(/API/);
    // API docs page has h1 headings for each endpoint group
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
    // Use exact match to avoid strict mode violation from sub-headings
    await expect(page.getByRole('heading', { name: 'books', exact: true }).first()).toBeVisible();
  });
});
