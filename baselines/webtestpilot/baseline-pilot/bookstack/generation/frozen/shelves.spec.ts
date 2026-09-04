import { test, expect } from '@playwright/test';
import { login, uid } from './helpers';

test.describe('Bookshelves', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shelves listing page shows existing shelves', async ({ page }) => {
    await page.goto('/shelves');
    await expect(page).toHaveTitle(/Shelves/);
    await expect(page.getByRole('heading', { name: 'Shelves', exact: true })).toBeVisible();
    // The seeded data has one shelf named "Shelf"
    await expect(page.getByRole('link', { name: 'Shelf', exact: true }).first()).toBeVisible();
  });

  test('create shelf - form is accessible from shelves list', async ({ page }) => {
    await page.goto('/shelves');
    await page.getByRole('link', { name: /Create Shelf|New Shelf/i }).click();
    await expect(page).toHaveURL(/create-shelf/);
    await expect(page.locator('#name')).toBeVisible();
  });

  test('create shelf - new shelf appears in listing', async ({ page }) => {
    const shelfName = uid('Shelf');
    await page.goto('/create-shelf');
    await page.locator('#name').fill(shelfName);
    await page.getByRole('button', { name: 'Save Shelf' }).click();
    // After creation, should redirect to the new shelf view
    await page.waitForURL(/\/shelves\//);
    // The shelf heading should show the new name
    await expect(page.getByRole('heading', { name: shelfName })).toBeVisible();
    // Confirm shelf appears in the listing
    await page.goto('/shelves');
    await expect(page.getByRole('heading', { name: shelfName }).first()).toBeVisible();
  });

  test('view shelf shows its books', async ({ page }) => {
    await page.goto('/shelves/shelf');
    await expect(page).toHaveTitle(/Shelf/);
    // Seeded shelf has books - Book1 and Book2
    await expect(page.getByRole('link', { name: 'Book1' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book2' }).first()).toBeVisible();
  });

  test('edit shelf - name change is persisted', async ({ page }) => {
    // Create a shelf to edit
    const shelfName = uid('EditShelf');
    await page.goto('/create-shelf');
    await page.locator('#name').fill(shelfName);
    await page.getByRole('button', { name: 'Save Shelf' }).click();
    await page.waitForURL(/\/shelves\//);

    // Navigate to edit
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page).toHaveURL(/edit/);
    const updatedName = shelfName + '-updated';
    await page.locator('#name').fill('');
    await page.locator('#name').fill(updatedName);
    await page.getByRole('button', { name: 'Save Shelf' }).click();
    // The slug may change after rename, so wait for any shelves URL
    await page.waitForURL(/\/shelves\//);
    // Verify the updated name appears as a heading
    await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();
  });

  test('delete shelf - shelf is removed from listing', async ({ page }) => {
    // Create a shelf to delete
    const shelfName = uid('DelShelf');
    await page.goto('/create-shelf');
    await page.locator('#name').fill(shelfName);
    await page.getByRole('button', { name: 'Save Shelf' }).click();
    await page.waitForURL(/\/shelves\//);

    // Delete it
    await page.getByRole('link', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/delete/);
    // Confirm deletion
    await page.getByRole('button', { name: 'Confirm' }).click();
    // Should redirect to shelves list
    await page.waitForURL('/shelves');
    // Shelf should no longer appear in the heading list
    await expect(page.getByRole('heading', { name: shelfName })).not.toBeVisible();
  });

  test('shelf permissions page loads', async ({ page }) => {
    await page.goto('/shelves/shelf/permissions');
    await expect(page).toHaveTitle(/Permissions|Shelf/);
    await expect(page.getByRole('heading', { name: 'Shelf Permissions' })).toBeVisible();
  });
});
