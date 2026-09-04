import { test, expect } from '@playwright/test';
import * as path from 'path';
import { uniqueName } from './helpers';

// Use pre-authenticated session for all tests in this file
test.use({ storageState: path.join(__dirname, 'playwright-auth.json') });

// A known note from the seeded data
const KNOWN_NOTE_URL = '/users/kody/notes/d27a197e';
const KNOWN_NOTE_TITLE = 'Basic Koala Facts';

/** Wait for navigation to a real note page (not the /new form) */
async function waitForNoteCreated(page: any) {
  await page.waitForURL(
    (url: URL) => /\/users\/kody\/notes\/(?!new$).+/.test(url.pathname),
    { timeout: 20000 }
  );
}

/** Navigate and verify we landed on the expected URL, with retry on rate limit */
async function gotoAndVerify(page: any, url: string, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    await page.goto(url);
    // If we ended up on the login page, the session is invalid - fail fast
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error(`Expected ${url} but got redirected to login: ${currentUrl}`);
    }
    // Check for rate limit response
    const bodyText = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
    if (bodyText && bodyText.includes('Too many requests')) {
      const waitMs = (attempt + 1) * 6000; // 6s, 12s, 18s, 24s
      await page.waitForTimeout(waitMs);
      continue;
    }
    return currentUrl;
  }
  throw new Error(`Rate limited after ${retries} retries for ${url}`);
}

test.describe('Notes Management', () => {
  // Add delay between tests to avoid hitting the server's rate limiter
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('notes list page shows sidebar with note titles and New Note link', async ({ page }) => {
    await gotoAndVerify(page, '/users/kody/notes');
    // Should show note titles in a list
    const noteLinks = page.locator('a[href*="/users/kody/notes/"]');
    await expect(noteLinks.first()).toBeVisible({ timeout: 15000 });
    const count = await noteLinks.count();
    expect(count).toBeGreaterThan(0);
    // There should be a "New Note" link
    await expect(page.getByRole('link', { name: /new note/i })).toBeVisible();
  });

  test('notes list sidebar shows seeded note titles', async ({ page }) => {
    await gotoAndVerify(page, '/users/kody/notes');
    // The seeded notes should appear in the list
    await expect(page.getByRole('link', { name: KNOWN_NOTE_TITLE })).toBeVisible({ timeout: 15000 });
  });

  test('note detail page shows title heading and content', async ({ page }) => {
    await gotoAndVerify(page, KNOWN_NOTE_URL);
    // Note detail should show a heading with the note title
    await expect(page.getByRole('heading', { name: KNOWN_NOTE_TITLE })).toBeVisible({ timeout: 15000 });
    // Should have some content visible
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.toLowerCase()).toContain('koala');
  });

  test('note detail page shows Edit link and Delete button for owner', async ({ page }) => {
    await gotoAndVerify(page, KNOWN_NOTE_URL);
    // Owner (kody) should see Edit link (exact match to avoid sidebar collision) and Delete button
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /delete/i })).toBeVisible({ timeout: 15000 });
  });

  test('create new note: navigates to created note and shows its title', async ({ page }) => {
    const noteTitle = uniqueName('Test Note');
    const noteContent = `Content for ${noteTitle}`;

    await gotoAndVerify(page, '/users/kody/notes/new');
    await page.getByLabel('Title').fill(noteTitle);
    await page.getByLabel('Content').fill(noteContent);

    await page.getByRole('button', { name: 'Submit' }).click();

    // Wait for navigation to the newly created note (not /new)
    await waitForNoteCreated(page);

    // The new note's title should be visible (as heading, not just sidebar link)
    await expect(page.getByRole('heading', { name: noteTitle })).toBeVisible({ timeout: 15000 });
  });

  test('create note then verify it appears in notes list sidebar', async ({ page }) => {
    const noteTitle = uniqueName('ListCheck Note');

    await gotoAndVerify(page, '/users/kody/notes/new');
    await page.getByLabel('Title').fill(noteTitle);
    await page.getByLabel('Content').fill('Some test content here');
    await page.getByRole('button', { name: 'Submit' }).click();

    // Wait for navigation to created note
    await waitForNoteCreated(page);

    // Navigate to the notes list — new note should appear in sidebar
    await gotoAndVerify(page, '/users/kody/notes');
    await expect(page.getByRole('link', { name: noteTitle })).toBeVisible({ timeout: 10000 });
  });

  test('edit note: updated title is persisted and shown', async ({ page }) => {
    // Create a note to edit
    const originalTitle = uniqueName('EditMe');
    const updatedTitle = uniqueName('Edited');

    await gotoAndVerify(page, '/users/kody/notes/new');
    await page.getByLabel('Title').fill(originalTitle);
    await page.getByLabel('Content').fill('Original content');
    await page.getByRole('button', { name: 'Submit' }).click();
    await waitForNoteCreated(page);

    // Click the Edit link (exact match to avoid matching sidebar note title)
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.waitForURL(url => url.pathname.endsWith('/edit'), { timeout: 10000 });

    // Update the title
    const titleField = page.getByLabel('Title');
    await titleField.clear();
    await titleField.fill(updatedTitle);
    await page.getByRole('button', { name: 'Submit' }).click();

    // Should navigate back to the note detail (not /edit)
    await page.waitForURL(url => !url.pathname.endsWith('/edit'), { timeout: 15000 });

    // Updated title should be visible as heading
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible({ timeout: 15000 });
  });

  test('edit note form is pre-filled with current note title', async ({ page }) => {
    await gotoAndVerify(page, KNOWN_NOTE_URL);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.waitForURL('**/edit', { timeout: 10000 });

    // Title field should be pre-filled with the known note title
    const titleValue = await page.getByLabel('Title').inputValue();
    expect(titleValue).toBe(KNOWN_NOTE_TITLE);
  });

  test('delete note: note is removed from the list after deletion', async ({ page }) => {
    // Create a note specifically to delete
    const noteTitle = uniqueName('ToDelete');

    await gotoAndVerify(page, '/users/kody/notes/new');
    await page.getByLabel('Title').fill(noteTitle);
    await page.getByLabel('Content').fill('This note will be deleted');
    await page.getByRole('button', { name: 'Submit' }).click();
    await waitForNoteCreated(page);

    // Capture the created note's URL
    const noteUrl = page.url();
    const notePath = new URL(noteUrl).pathname;

    // Verify note appears in list before deletion
    await gotoAndVerify(page, '/users/kody/notes');
    await expect(page.getByRole('link', { name: noteTitle })).toBeVisible({ timeout: 10000 });

    // Return to the note and delete it
    await page.goto(noteUrl);
    await page.getByRole('button', { name: /delete/i }).click();

    // Wait for navigation after deletion (should go to notes list or another note)
    await page.waitForURL(url => url.pathname !== notePath, { timeout: 15000 });

    // Verify the note is no longer in the list
    await gotoAndVerify(page, '/users/kody/notes');
    await expect(page.getByRole('link', { name: noteTitle })).not.toBeVisible({ timeout: 10000 });
  });

  test('new note form: empty title prevents submission', async ({ page }) => {
    await gotoAndVerify(page, '/users/kody/notes/new');
    // Leave title empty, fill only content
    await page.getByLabel('Content').fill('Some content without a title');
    await page.getByRole('button', { name: 'Submit' }).click();

    // Wait briefly; form should not navigate to a newly created note
    await page.waitForTimeout(1500);
    // URL should still be /new (not navigated to a created note)
    expect(page.url()).toContain('/notes/new');
  });

  test('New Note link from sidebar navigates to note creation form', async ({ page }) => {
    await gotoAndVerify(page, '/users/kody/notes');
    await page.getByRole('link', { name: /new note/i }).click();
    await page.waitForURL('**/notes/new', { timeout: 10000 });
    await expect(page.getByLabel('Title')).toBeVisible();
    await expect(page.getByLabel('Content')).toBeVisible();
  });

  test('clicking note title in sidebar navigates to that note', async ({ page }) => {
    await gotoAndVerify(page, '/users/kody/notes');
    // Click the known note link in sidebar using its role
    await page.getByRole('link', { name: KNOWN_NOTE_TITLE }).click();
    await page.waitForURL(`**/notes/d27a197e**`, { timeout: 10000 });
    // Heading (not the sidebar link) should be visible
    await expect(page.getByRole('heading', { name: KNOWN_NOTE_TITLE })).toBeVisible({ timeout: 15000 });
  });
});
