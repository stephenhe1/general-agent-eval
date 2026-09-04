import { test, expect } from '@playwright/test';
import { login, uid } from './helpers';

test.describe('Chapters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('view chapter shows heading', async ({ page }) => {
    await page.goto('/books/book1/chapter/chapter-2');
    await expect(page).toHaveTitle(/Chapter 2/);
    await expect(page.getByRole('heading', { name: 'Chapter 2', level: 1 })).toBeVisible();
  });

  test('create chapter - new chapter appears in book', async ({ page }) => {
    const chapterName = uid('Chapter');
    await page.goto('/books/book2/create-chapter');
    await expect(page).toHaveTitle(/Create|Chapter/i);
    await page.locator('#name').fill(chapterName);
    await page.getByRole('button', { name: 'Save Chapter' }).click();
    // After creation, should be on the chapter view
    await page.waitForURL(/chapter/);
    await expect(page.getByRole('heading', { name: chapterName, level: 1 })).toBeVisible();
    // Verify chapter appears in book view
    await page.goto('/books/book2');
    await expect(page.getByRole('heading', { name: chapterName }).first()).toBeVisible();
  });

  test('edit chapter - name change is persisted', async ({ page }) => {
    // Create a chapter first
    const chapterName = uid('EditChapter');
    await page.goto('/books/book2/create-chapter');
    await page.locator('#name').fill(chapterName);
    await page.getByRole('button', { name: 'Save Chapter' }).click();
    await page.waitForURL(/chapter/);

    // Edit the chapter
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page).toHaveURL(/edit/);
    const updatedName = chapterName + '-v2';
    await page.locator('#name').fill('');
    await page.locator('#name').fill(updatedName);
    await page.getByRole('button', { name: 'Save Chapter' }).click();
    // URL slug may change after rename
    await page.waitForURL(/chapter/);
    await expect(page.getByRole('heading', { name: updatedName, level: 1 })).toBeVisible();
  });

  test('delete chapter - chapter is removed from book', async ({ page }) => {
    const chapterName = uid('DelChapter');
    await page.goto('/books/book2/create-chapter');
    await page.locator('#name').fill(chapterName);
    await page.getByRole('button', { name: 'Save Chapter' }).click();
    await page.waitForURL(/chapter/);

    // Delete the chapter
    await page.getByRole('link', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/delete/);
    await page.getByRole('button', { name: 'Confirm' }).click();
    // Should redirect back to the book
    await page.waitForURL(/\/books\/book2/);
    await expect(page.getByRole('heading', { name: chapterName })).not.toBeVisible();
  });

  test('chapter permissions page loads', async ({ page }) => {
    await page.goto('/books/book1/chapter/chapter-2/permissions');
    await expect(page).toHaveTitle(/Permissions|Chapter/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('chapter html export returns the chapter content', async ({ page }) => {
    const response = await page.request.get('/books/book1/chapter/chapter-2/export/html');
    expect(response.status()).toBe(200);
    const body = await response.text();
    // Content should reference the chapter name
    expect(body).toContain('Chapter 2');
  });
});
