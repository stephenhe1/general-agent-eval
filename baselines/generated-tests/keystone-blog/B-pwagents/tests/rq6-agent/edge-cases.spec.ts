// spec: specs/keystone-blog-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

test.describe('EDGE', () => {

  // EDGE-01: Navigate to a non-existent author ID — shows "Not found" in-place
  test('EDGE-01: Navigate to a non-existent author ID — shows "Not found" in-place', async ({ page }) => {
    // Step 1: Navigate to an author URL with a deliberately invalid ID
    await page.goto('/authors/does-not-exist-00000');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert the URL has NOT changed (no redirect to another page)
    await expect(page).toHaveURL(/\/authors\/does-not-exist-00000/);

    // Step 3: Meaningful postcondition — the page body contains a "Not found" message
    // Keystone displays: "The item with ID '<id>' doesn't exist"
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).toContain('not found');
  });

  // EDGE-02: Navigate to a non-existent post ID — shows "Not found" in-place
  test('EDGE-02: Navigate to a non-existent post ID — shows "Not found" in-place', async ({ page }) => {
    // Step 1: Navigate to a post URL with a deliberately invalid ID
    await page.goto('/posts/does-not-exist-00000');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert the URL has NOT changed (no redirect)
    await expect(page).toHaveURL(/\/posts\/does-not-exist-00000/);

    // Step 3: Meaningful postcondition — the page body contains a "Not found" message
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).toContain('not found');
  });

  // EDGE-03: Tags list is accessible directly but has no sidebar nav link
  test('EDGE-03: Tags list is accessible directly but has no sidebar nav link', async ({ page }) => {
    // Step 1: Navigate to the dashboard to check sidebar
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert no Tags link exists in the sidebar navigation
    await expect(page.locator('nav a[href="/tags"]')).toHaveCount(0);

    // Step 3: Navigate directly to /tags
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    // Step 4: Assert the URL is on the tags list page
    await expect(page).toHaveURL(/\/tags/);

    // Step 5: Meaningful postcondition — the "New tag" create link is present,
    // confirming the Tags list is fully accessible even without a sidebar link
    await expect(page.locator('a[href="/tags/create"]')).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// RICH TEXT
// ─────────────────────────────────────────────────────────────────────────────

test.describe('RICH-TEXT', () => {

  // RICH-TEXT-01: Enter text in the rich text editor and save
  test('RICH-TEXT-01: Enter text in the rich text editor and save', async ({ page }) => {
    const ts = Date.now();
    const richTextContent = `Test paragraph ${ts}`;

    // Matches a post item URL: /posts/<id> (not /posts/create)
    const POST_ITEM_URL_RE = /\/posts\/(?!create)[a-z0-9]+/;

    // Step 1: Navigate to the post create page
    await page.goto('/posts/create');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill in a unique title
    await page.locator('input[type="text"]').first().fill(`Rich Text Test ${ts}`);

    // Step 3: Click Create and wait for navigation to the new post item page
    await Promise.all([
      page.waitForURL(POST_ITEM_URL_RE),
      page.locator('button:has-text("Create")').click(),
    ]);
    await page.waitForLoadState('networkidle');
    const postUrl = page.url();

    // Step 4: Locate the ProseMirror rich text editor and click to focus it
    // Keystone's document field renders a contenteditable div with role="textbox"
    const editor = page.locator('[role="textbox"][contenteditable="true"]');
    await expect(editor).toBeVisible();
    await editor.click();

    // Step 5: Type rich text content using keyboard input
    await page.keyboard.type(richTextContent);
    await page.waitForTimeout(300);

    // Step 6: Click Save to persist the content
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(2000);

    // Step 7: Reload the page to confirm the content was saved server-side
    await page.goto(postUrl);
    await page.waitForLoadState('networkidle');

    // Step 8: Meaningful postcondition — the editor contains the typed text after reload
    const editorContent = await page.locator('[role="textbox"][contenteditable="true"]').innerText();
    expect(editorContent).toContain(richTextContent);

    // Cleanup: delete the test post
    await page.locator('button:has-text("Delete")').click();
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });
    await Promise.all([
      page.waitForURL(/\/posts(\?|$)/),
      deleteDialog.locator('button:has-text("Yes, delete")').click(),
    ]);
    await page.waitForLoadState('networkidle');
  });

});
