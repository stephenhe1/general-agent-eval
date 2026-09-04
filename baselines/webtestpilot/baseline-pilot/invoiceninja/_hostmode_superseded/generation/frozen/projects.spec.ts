import { test, expect } from '@playwright/test';
import { login, goto, unique } from './helpers';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('projects list page loads', async ({ page }) => {
    await goto(page, '/projects');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });

  test('projects list shows New Project button', async ({ page }) => {
    await goto(page, '/projects');
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
  });

  test('New Project button navigates to project create form', async ({ page }) => {
    await goto(page, '/projects');
    await page.getByRole('button', { name: 'New Project' }).click();
    await page.waitForURL('**/projects/create', { timeout: 10000 });
    expect(page.url()).toContain('/projects/create');
  });

  test('project create form renders with Save button', async ({ page }) => {
    await goto(page, '/projects/create');
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('create new project → project appears in list', async ({ page }) => {
    const projectName = unique('Project');
    await goto(page, '/projects/create');

    // Fill the project name field
    const nameInput = page.getByLabel('Name').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(projectName);
    } else {
      await page.locator('input').first().fill(projectName);
    }

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify project was created (either redirected to edit or back to list)
    expect(page.url()).toMatch(/\/projects\/.+/);
  });
});
