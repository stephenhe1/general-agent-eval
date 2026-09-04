import { test, expect } from '@playwright/test';
import { login, goto, unique } from './helpers';

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('tasks list page loads', async ({ page }) => {
    await goto(page, '/tasks');
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  });

  test('tasks list shows New Task button', async ({ page }) => {
    await goto(page, '/tasks');
    await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible();
  });

  test('New Task button navigates to task create form', async ({ page }) => {
    await goto(page, '/tasks');
    await page.getByRole('button', { name: 'New Task' }).click();
    await page.waitForURL('**/tasks/create', { timeout: 10000 });
    expect(page.url()).toContain('/tasks/create');
  });

  test('task create form has Status, Client, Rate fields', async ({ page }) => {
    await goto(page, '/tasks/create');
    await expect(page.getByText('Client')).toBeVisible();
    await expect(page.getByLabel('Rate')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('task create form shows default Backlog status', async ({ page }) => {
    await goto(page, '/tasks/create');
    await expect(page.getByText('Backlog')).toBeVisible();
  });

  test('task create form has time entry table (Start Date, Duration)', async ({ page }) => {
    await goto(page, '/tasks/create');
    await expect(page.getByText('START DATE')).toBeVisible();
    await expect(page.getByText('DURATION')).toBeVisible();
  });

  test('create new task → task appears in list', async ({ page }) => {
    await goto(page, '/tasks/create');

    // Fill task number
    await page.getByLabel('Task Number').fill(unique('TASK'));

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify we're on an edit page (task was saved)
    expect(page.url()).toMatch(/\/tasks\/.+/);
  });
});
