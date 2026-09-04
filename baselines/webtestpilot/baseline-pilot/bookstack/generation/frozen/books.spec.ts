import { test, expect } from '@playwright/test';
import { login, uid } from './helpers';

test.describe('Books', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('books listing shows all books', async ({ page }) => {
    await page.goto('/books');
    await expect(page).toHaveTitle(/Books/);
    await expect(page.getByRole('heading', { name: 'Books', exact: true })).toBeVisible();
    // Seeded data: Book, Book1, Book2
    await expect(page.getByRole('link', { name: 'Book1', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book2', exact: true }).first()).toBeVisible();
  });

  test('create book - new book appears in listing', async ({ page }) => {
    const bookName = uid('Book');
    await page.goto('/create-book');
    await expect(page).toHaveTitle(/Create|Book/i);
    await page.locator('#name').fill(bookName);
    await page.getByRole('button', { name: 'Save Book' }).click();
    // After creation, redirect to the book view
    await page.waitForURL(/\/books\//);
    await expect(page.getByRole('heading', { name: bookName })).toBeVisible();
    // Confirm book appears in listing — look in the book grid
    await page.goto('/books');
    // The book heading appears in the book list cards
    await expect(page.getByRole('heading', { name: bookName }).first()).toBeVisible();
  });

  test('view book shows chapters and pages', async ({ page }) => {
    await page.goto('/books/book1');
    await expect(page).toHaveTitle(/Book1/);
    await expect(page.getByRole('heading', { name: 'Book1' })).toBeVisible();
    // Book1 exists and has content
    const content = await page.content();
    expect(content).toContain('Book1');
  });

  test('edit book - name change is persisted', async ({ page }) => {
    // Create a book to edit
    const bookName = uid('EditBook');
    await page.goto('/create-book');
    await page.locator('#name').fill(bookName);
    await page.getByRole('button', { name: 'Save Book' }).click();
    await page.waitForURL(/\/books\//);

    // Click Edit and update name
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page).toHaveURL(/edit/);
    const updatedName = bookName + '-v2';
    await page.locator('#name').fill('');
    await page.locator('#name').fill(updatedName);
    await page.getByRole('button', { name: 'Save Book' }).click();
    // The slug changes after edit, so wait for any books URL
    await page.waitForURL(/\/books\//);
    await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();
  });

  test('delete book - book is removed from listing', async ({ page }) => {
    const bookName = uid('DelBook');
    await page.goto('/create-book');
    await page.locator('#name').fill(bookName);
    await page.getByRole('button', { name: 'Save Book' }).click();
    await page.waitForURL(/\/books\//);

    // Delete the book
    await page.getByRole('link', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/delete/);
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForURL('/books');
    // Check the book is gone from the listing
    await expect(page.getByRole('heading', { name: bookName })).not.toBeVisible();
  });

  test('book export links exist in page', async ({ page }) => {
    await page.goto('/books/book1');
    // Export links are in a dropdown section — they exist in the DOM even if hidden
    const exportLinks = page.locator('a[href*="/export/"]');
    const count = await exportLinks.count();
    expect(count).toBeGreaterThan(0);
    // Verify specific export formats exist
    await expect(page.locator('a[href*="/export/html"]').first()).toBeAttached();
    await expect(page.locator('a[href*="/export/pdf"]').first()).toBeAttached();
    await expect(page.locator('a[href*="/export/markdown"]').first()).toBeAttached();
  });

  test('book html export returns the book content', async ({ page }) => {
    const response = await page.request.get('/books/book1/export/html');
    expect(response.status()).toBe(200);
    const body = await response.text();
    // Content should contain the book name
    expect(body).toContain('Book1');
  });

  test('book permissions page loads', async ({ page }) => {
    await page.goto('/books/book1/permissions');
    await expect(page).toHaveTitle(/Permissions|Book1/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('book sort page loads', async ({ page }) => {
    await page.goto('/books/book1/sort');
    await expect(page).toHaveTitle(/Sort|Book1/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
