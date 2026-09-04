import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Books', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('books list page shows seeded books', async ({ page }) => {
    await page.goto('/books');
    await expect(page).toHaveTitle(/Books/);
    await expect(page.getByText('Book1').first()).toBeVisible();
    await expect(page.getByText('Book2').first()).toBeVisible();
  });

  test('create book - new book appears in books list', async ({ page }) => {
    const bookName = `Test Book ${Date.now()}`;

    await page.goto('/create-book');
    await expect(page).toHaveTitle(/Create New Book/);
    await page.fill('[name="name"]', bookName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should redirect to the new book; use h1 to avoid strict mode violations
    await expect(page).toHaveURL(/\/books\//);
    await expect(page.locator('h1').first()).toContainText(bookName);

    // Verify book appears in books list
    await page.goto('/books');
    await expect(page.getByText(bookName).first()).toBeVisible();
  });

  test('book detail page shows content and action menu', async ({ page }) => {
    await page.goto('/books/book1');
    await expect(page).toHaveTitle(/Book1/);
    // Should have chapters/pages listed
    await expect(page.getByText('Chapter 2').first()).toBeVisible();
    // Action links
    await expect(page.locator('a[href*="/books/book1/edit"]')).toBeVisible();
    await expect(page.locator('a[href*="/books/book1/create-page"]')).toBeVisible();
    await expect(page.locator('a[href*="/books/book1/create-chapter"]')).toBeVisible();
  });

  test('edit book - name update reflected', async ({ page }) => {
    // Create a temp book to edit
    const tempName = `Temp Book ${Date.now()}`;
    await page.goto('/create-book');
    await page.fill('[name="name"]', tempName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const bookUrl = page.url();
    const newName = `Edited Book ${Date.now()}`;

    await page.goto(bookUrl + '/edit');
    await page.fill('[name="name"]', newName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toContainText(newName);
  });

  test('book sort page loads', async ({ page }) => {
    await page.goto('/books/book1/sort');
    await expect(page).toHaveTitle(/Sort Book/);
    await expect(page.getByText('Book1').first()).toBeVisible();
  });

  test('book permissions page loads', async ({ page }) => {
    await page.goto('/books/book1/permissions');
    await expect(page).toHaveTitle(/Permissions/);
  });

  test('copy book - creates a new book', async ({ page }) => {
    await page.goto('/books/book1/copy');

    // Fill in the name for the copy
    const copyName = `Copy of Book1 ${Date.now()}`;
    await page.fill('[name="name"]', copyName);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Should land on the new book page
    await expect(page).toHaveURL(/\/books\//);
    await expect(page.locator('h1').first()).toContainText(copyName);

    // Verify in books list
    await page.goto('/books');
    await expect(page.getByText(copyName).first()).toBeVisible();
  });

  test('delete book - book removed from list', async ({ page }) => {
    // Create a book to delete
    const name = `Book To Delete ${Date.now()}`;
    await page.goto('/create-book');
    await page.fill('[name="name"]', name);
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const bookUrl = page.url();
    await page.goto(bookUrl + '/delete');

    // Submit delete form (Confirm button)
    await page.click('button.button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Go to books list and verify deletion
    await page.goto('/books');
    await expect(page.getByText(name)).not.toBeVisible();
  });
});
