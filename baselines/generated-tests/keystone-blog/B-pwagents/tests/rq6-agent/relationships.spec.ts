// spec: specs/keystone-blog-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

// Matches a post item URL: /posts/<id> (not /posts/create)
const POST_ITEM_URL_RE = /\/posts\/(?!create)[a-z0-9]+/;

// Matches an author item URL: /authors/<id> (not /authors/create)
const AUTHOR_ITEM_URL_RE = /\/authors\/(?!create)[a-z0-9]+/;

// Helper: create a fresh post and return its item page URL.
async function createPost(
  page: import('@playwright/test').Page,
  title: string,
): Promise<string> {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="text"]').first().fill(title);
  await Promise.all([
    page.waitForURL(POST_ITEM_URL_RE),
    page.locator('button:has-text("Create")').click(),
  ]);
  await page.waitForLoadState('networkidle');
  return page.url();
}

// Helper: create a fresh author and return its item page URL.
async function createAuthor(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
): Promise<string> {
  await page.goto('/authors/create');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="text"]').first().fill(name);
  await page.locator('input[type="text"]').nth(1).fill(email);
  await Promise.all([
    page.waitForURL(AUTHOR_ITEM_URL_RE),
    page.locator('button:has-text("Create")').click(),
  ]);
  await page.waitForLoadState('networkidle');
  return page.url();
}

// Helper: delete the item at the current page and wait for redirect to list.
async function deleteCurrentItem(page: import('@playwright/test').Page, listPath: string): Promise<void> {
  await page.locator('button:has-text("Delete")').click();
  const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
  await expect(deleteDialog).toBeVisible({ timeout: 5000 });
  await Promise.all([
    page.waitForURL(new RegExp(`\\/${listPath.replace('/', '')}(\\?|$)`)),
    deleteDialog.locator('button:has-text("Yes, delete")').click(),
  ]);
  await page.waitForLoadState('networkidle');
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('REL', () => {

  // REL-01: Add an author to a post via the relationship combobox
  test('REL-01: Add an author to a post via the relationship combobox', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create a fresh post (no author) to use as the test target
    const postUrl = await createPost(page, `Rel Test Post ${ts}`);

    // Step 2: Navigate to the post item page
    await page.goto(postUrl);
    await page.waitForLoadState('networkidle');

    // Step 3: Locate the Author relationship combobox (first combobox on the page)
    // and type a partial name to search — use a letter to get any existing author
    const authorCombobox = page.locator('[role="combobox"]').first();
    await authorCombobox.click();
    await authorCombobox.type('t');
    await page.waitForTimeout(600);

    // Step 4: Assert a dropdown option appears (pick first real option, not "No results")
    const option = page.locator('[role="option"]').filter({ hasNotText: /no results/i }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    const selectedAuthorName = (await option.textContent()) ?? '';

    // Step 5: Click the option to select the author
    await option.click();
    await page.waitForTimeout(300);

    // Step 6: Click Save to persist the relationship
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(2000);

    // Step 7: Meaningful postcondition — the author name is now visible in the Author field
    const comboboxValue = await page.locator('[role="combobox"]').first().inputValue();
    expect(comboboxValue.trim().length).toBeGreaterThan(0);
    // The combobox should show the author name we selected
    expect(comboboxValue.toLowerCase()).toContain(selectedAuthorName.trim().toLowerCase().slice(0, 5));

    // Cleanup
    await deleteCurrentItem(page, 'posts');
  });

  // REL-02: View related author from a post that already has an author assigned
  test('REL-02: View related author from a post that already has an author assigned', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create a fresh post and assign an existing author to it
    const postUrl = await createPost(page, `Rel Author View Test ${ts}`);

    // Step 2: Navigate to the post item page
    await page.goto(postUrl);
    await page.waitForLoadState('networkidle');

    // Step 3: Assign an existing author via the combobox
    const authorCombobox = page.locator('[role="combobox"]').first();
    await authorCombobox.click();
    await authorCombobox.fill('t');
    await page.waitForTimeout(600);
    // Pick first real option (not "No results")
    const authorOption = page.locator('[role="option"]').filter({ hasNotText: /no results/i }).first();
    await expect(authorOption).toBeVisible({ timeout: 5000 });
    const authorName = await authorOption.textContent();
    await authorOption.click();
    await page.waitForTimeout(300);

    // Save the relationship
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(2000);

    // Step 4: Assert the Author field is populated (combobox has a value)
    const authorValue = await authorCombobox.inputValue();
    expect(authorValue.length).toBeGreaterThan(0);

    // Step 5: Open the Actions menu for the Author field
    await page.locator('button[aria-label="Actions for Author"]').click();
    await page.waitForTimeout(300);

    // Step 6: Assert the "View author" menu item is present
    const viewAuthorItem = page.locator('[role="menuitem"]').filter({ hasText: /view author/i });
    await expect(viewAuthorItem).toBeVisible();

    // Step 7: Meaningful postcondition — the author name shown in the combobox matches
    // the author we selected
    expect(authorValue.toLowerCase()).toContain((authorName ?? '').trim().toLowerCase().slice(0, 5));

    // Close the menu
    await page.keyboard.press('Escape');

    // Cleanup
    await deleteCurrentItem(page, 'posts');
  });

  // REL-03: View related posts from an author's item page
  test('REL-03: View related posts from an author\'s item page', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create a fresh author to use as the test subject
    const authorUrl = await createAuthor(
      page,
      `Rel Author Posts Test ${ts}`,
      `rel-author-posts-${ts}@example.com`,
    );

    // Step 2: Create a fresh post and assign the author to it
    const postUrl = await createPost(page, `Rel Author Post ${ts}`);

    // Step 3: On the post page, assign the author via the combobox
    await page.goto(postUrl);
    await page.waitForLoadState('networkidle');

    const authorCombobox = page.locator('[role="combobox"]').first();
    await authorCombobox.click();
    await authorCombobox.fill(`Rel Author Posts Test ${ts}`);
    await page.waitForTimeout(600);
    const authorOption = page.locator('[role="option"]').filter({ hasNotText: /no results/i }).first();
    await expect(authorOption).toBeVisible({ timeout: 5000 });
    await authorOption.click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(2000);

    // Step 4: Navigate to the author's item page
    await page.goto(authorUrl);
    await page.waitForLoadState('networkidle');

    // Step 5: Assert we are on the correct author item page
    await expect(page).toHaveURL(AUTHOR_ITEM_URL_RE);
    const nameInput = page.locator('label').filter({ hasText: 'Name' }).locator('..').locator('input[type="text"]');
    const authorName = await nameInput.inputValue();
    expect(authorName.length).toBeGreaterThan(0);

    // Step 6: Locate the Posts relationship section and find linked post links
    // In Keystone's admin UI, related items appear as anchor links with the list path
    const postLinks = page.locator('a[href*="/posts/"]');
    const postLinkCount = await postLinks.count();
    expect(postLinkCount).toBeGreaterThan(0);

    // Step 7: Meaningful postcondition — at least one post link navigates to a valid post page
    const firstPostHref = await postLinks.first().getAttribute('href');
    expect(firstPostHref).toMatch(/\/posts\/(?!create)[a-z0-9]+/);

    // Cleanup: delete the post and author
    await page.goto(postUrl);
    await page.waitForLoadState('networkidle');
    await deleteCurrentItem(page, 'posts');
    await page.goto(authorUrl);
    await page.waitForLoadState('networkidle');
    await deleteCurrentItem(page, 'authors');
  });

  // REL-04: Add tags to a post via the Tags relationship combobox
  test('REL-04: Add tags to a post via the Tags relationship combobox', async ({ page }) => {
    const ts = Date.now();

    // Step 1: Create a fresh post to use as the test target
    const postUrl = await createPost(page, `Tags Rel Test ${ts}`);

    // Step 2: Navigate to the post item page
    await page.goto(postUrl);
    await page.waitForLoadState('networkidle');

    // Step 3: Locate the Tags relationship combobox (second combobox on the page)
    // and type a partial tag name to search
    const tagsCombobox = page.locator('[role="combobox"]').nth(1);
    await tagsCombobox.click();
    await tagsCombobox.type('ITag');
    await page.waitForTimeout(600);

    // Step 4: Assert a dropdown option for an existing tag appears
    const option = page.locator('[role="option"]').filter({ hasText: /ITag/i });
    await expect(option).toBeVisible({ timeout: 5000 });

    // Step 5: Click the option to select the tag
    await option.click();
    await page.waitForTimeout(300);

    // Step 6: Click Save to persist the relationship
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(2000);

    // Step 7: Reload the page and confirm the tag is still associated
    await page.goto(postUrl);
    await page.waitForLoadState('networkidle');

    // Step 8: Meaningful postcondition — the tag name is visible somewhere on the post page
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).toContain('itag');

    // Cleanup
    await deleteCurrentItem(page, 'posts');
  });

});
