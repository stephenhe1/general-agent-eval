// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Chapters', () => {
  test('3.4 Edit chapter name', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a chapter per 3.1 so we have a slug to work with
    await page.goto('/books/book1/create-chapter');
    await page.fill('#name', 'Ch Edit Source');
    await page.getByRole('button', { name: 'Save Chapter' }).click();
    await expect(page).toHaveURL(/\/books\/book1\/chapter\//);

    // Capture the chapter URL slug from the redirect
    const chapterUrl = page.url();
    const editUrl = chapterUrl + '/edit';

    // Navigate to the edit page for this chapter
    await page.goto(editUrl);

    // Clear the name field and type the new name
    await page.fill('#name', '');
    await page.fill('#name', 'Ch Edit Renamed');

    // Click Save Chapter
    await page.getByRole('button', { name: 'Save Chapter' }).click();

    // Should redirect to the chapter's updated URL
    await expect(page).toHaveURL(/\/books\/book1\/chapter\//);

    // Page title reflects the new name
    await expect(page).toHaveTitle('Ch Edit Renamed | BookStack');

    // Success notification
    await expect(page.locator('.notification.pos')).toContainText('Chapter successfully updated');

    // Breadcrumb shows the updated chapter name and parent book
    await expect(page.locator('.breadcrumbs')).toContainText('Ch Edit Renamed');
    await expect(page.locator('.breadcrumbs')).toContainText('Book1');
  });
});
