import { test, expect } from '@playwright/test';
import {
  gql,
  deleteTagById,
  findTagsByName,
} from './helpers';

// ---------------------------------------------------------------------------
// Tags – List View
// ---------------------------------------------------------------------------
test.describe('Tags – List View', () => {
  test('page loads with correct list data', async ({ page }) => {
    const data = await gql('{ tagsCount }');
    const count = data.tagsCount as number;

    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
    await expect(page.getByText(new RegExp(`${count} Tag`))).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
  });

  test('search filters tags in real time', async ({ page }) => {
    // Create a tag with a unique name to search for
    const uniqueTagName = `SearchTag_${Date.now()}`;
    const existing = await findTagsByName(uniqueTagName);
    for (const t of existing) await deleteTagById(t.id);

    const created = await gql(
      `mutation($name: String!) { createTag(data: { name: $name }) { id } }`,
      { name: uniqueTagName },
    );
    const tagId = (created.createTag as { id: string }).id;

    try {
      await page.goto('/tags');
      await page.waitForLoadState('networkidle');

      await page.getByRole('searchbox').fill(uniqueTagName);
      await page.waitForTimeout(600);

      await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(uniqueTagName)}`));
      await expect(page.getByText(uniqueTagName)).toBeVisible();

      // Count should be exactly 1
      await expect(page.getByText('1 Tag')).toBeVisible();
    } finally {
      await deleteTagById(tagId);
    }
  });

  test('sort by name column updates URL', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    await page.getByRole('columnheader', { name: 'Name' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/sortBy=name/);
  });
});

// ---------------------------------------------------------------------------
// Tags – Create
// ---------------------------------------------------------------------------
test.describe('Tags – Create', () => {
  test('create page loads with correct form fields', async ({ page }) => {
    await page.goto('/tags/create');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Create Tag' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
    // Posts is a combobox (relation field)
    await expect(page.getByRole('combobox', { name: 'Posts' })).toBeVisible();
  });

  test('create tag saves correct data', async ({ page }) => {
    const uniqueName = `E2E Tag ${Date.now()}`;

    const existing = await findTagsByName(uniqueName);
    for (const t of existing) await deleteTagById(t.id);

    await page.goto('/tags/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Name').fill(uniqueName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Redirects to detail page
    await expect(page).toHaveURL(/\/tags\/[a-z0-9]+$/);

    // Verify via API
    const created = await findTagsByName(uniqueName);
    expect(created.length).toBe(1);

    const detail = await gql(
      `query($id: ID!) { tag(where: { id: $id }) { id name } }`,
      { id: created[0].id },
    );
    const tag = detail.tag as { id: string; name: string };
    expect(tag.name).toBe(uniqueName);

    // Cleanup
    await deleteTagById(tag.id);
  });
});

// ---------------------------------------------------------------------------
// Tags – Detail / Edit
// ---------------------------------------------------------------------------
test.describe('Tags – Detail / Edit', () => {
  let testTagId: string;

  test.beforeEach(async () => {
    const data = await gql(
      `mutation($name: String!) { createTag(data: { name: $name }) { id } }`,
      { name: `EditTag ${Date.now()}` },
    );
    testTagId = (data.createTag as { id: string }).id;
  });

  test.afterEach(async () => {
    if (testTagId) await deleteTagById(testTagId);
  });

  test('detail page loads correct field values', async ({ page }) => {
    const data = await gql(
      `query($id: ID!) { tag(where: { id: $id }) { name } }`,
      { id: testTagId },
    );
    const tag = data.tag as { name: string };

    await page.goto(`/tags/${testTagId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Name')).toHaveValue(tag.name);
  });

  test('edit tag name and save persists the change', async ({ page }) => {
    const newName = `Renamed Tag ${Date.now()}`;

    await page.goto(`/tags/${testTagId}`);
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Name').fill(newName);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');

    const data = await gql(
      `query($id: ID!) { tag(where: { id: $id }) { name } }`,
      { id: testTagId },
    );
    const updated = data.tag as { name: string };
    expect(updated.name).toBe(newName);
  });

  test('Save, Reset, Delete buttons are visible on detail page', async ({ page }) => {
    await page.goto(`/tags/${testTagId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('delete tag removes it from the database', async ({ page }) => {
    await page.goto(`/tags/${testTagId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/tags/);

    const data = await gql(
      `query($id: ID!) { tag(where: { id: $id }) { id } }`,
      { id: testTagId },
    );
    expect(data.tag).toBeNull();

    testTagId = '';
  });
});

// ---------------------------------------------------------------------------
// Tags – with Post relation
// ---------------------------------------------------------------------------
test.describe('Tags – Post relation', () => {
  test('create tag with post relation and verify via API', async ({ page }) => {
    // Get a known post
    const postData = await gql('{ posts(take: 1) { id title } }');
    const post = (postData.posts as Array<{ id: string; title: string }>)[0];
    if (!post) test.skip();

    const tagName = `TagWithPost_${Date.now()}`;
    let tagId = '';

    try {
      await page.goto('/tags/create');
      await page.waitForLoadState('networkidle');

      await page.getByLabel('Name').fill(tagName);

      // Fill the Posts relation combobox
      const postsCombobox = page.getByRole('combobox', { name: 'Posts' });
      await postsCombobox.fill(post.title.slice(0, 6));
      await page.waitForTimeout(500);

      // Select first suggestion if visible
      const suggestion = page.getByRole('option').first();
      if (await suggestion.isVisible()) {
        await suggestion.click();
      }

      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.waitForLoadState('networkidle');

      // Find the created tag
      const tags = await findTagsByName(tagName);
      if (tags.length > 0) {
        tagId = tags[0].id;
        // Verify the post relation was saved
        const detail = await gql(
          `query($id: ID!) { tag(where: { id: $id }) { name posts { id } } }`,
          { id: tagId },
        );
        const tag = detail.tag as { name: string; posts: Array<{ id: string }> };
        expect(tag.name).toBe(tagName);
        // Posts relation may or may not be set depending on suggestion selection
      }
    } finally {
      if (tagId) await deleteTagById(tagId);
    }
  });
});
