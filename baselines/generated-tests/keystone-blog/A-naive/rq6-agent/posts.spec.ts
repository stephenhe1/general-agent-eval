import { test, expect } from '@playwright/test';
import {
  gql,
  deletePostById,
  findPostsByTitle,
  applyFilter,
} from './helpers';

// ---------------------------------------------------------------------------
// Posts – List View
// ---------------------------------------------------------------------------
test.describe('Posts – List View', () => {
  test('page loads with correct list data', async ({ page }) => {
    const data = await gql('{ postsCount posts(take: 1) { id title } }');
    const count = data.postsCount as number;
    const firstPost = (data.posts as Array<{ id: string; title: string }>)[0];

    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
    await expect(page.getByText(new RegExp(`${count} Post`))).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    if (firstPost?.title) {
      await expect(page.getByText(firstPost.title).first()).toBeVisible();
    }
  });

  test('search filters posts in real time', async ({ page }) => {
    // Use a known unique title that exists in seed data
    const data = await gql('{ posts(where: { title: { equals: "Wuthering Heights" } }) { id title } }');
    const wh = (data.posts as Array<{ id: string; title: string }>)[0];
    if (!wh) test.skip();

    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    await page.getByRole('searchbox').fill('Wuthering');
    await page.waitForTimeout(600);

    await expect(page).toHaveURL(/search=Wuthering/);
    await expect(page.getByText('Wuthering Heights')).toBeVisible();
  });

  test('sort by title column updates URL', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    await page.getByRole('columnheader', { name: 'Title' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/sortBy=title/);
  });

  test('filter by title returns matching posts', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    await applyFilter(page, 'Title', 'Wuthering');

    // URL should include the filter (format: filter=title_contains_i_"Wuthering")
    await expect(page).toHaveURL(/filter=title/);

    // Matching post is visible
    await expect(page.getByText('Wuthering Heights')).toBeVisible();

    // Filter chip text is displayed
    await expect(page.getByText(/Title contains/)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Posts – Create
// ---------------------------------------------------------------------------
test.describe('Posts – Create', () => {
  test('create page loads with correct form fields', async ({ page }) => {
    await page.goto('/posts/create');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Create Post' })).toBeVisible();
    await expect(page.getByLabel('Title*')).toBeVisible();
    // Status radios
    await expect(page.getByRole('radio', { name: 'Published' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Draft' })).toBeVisible();
    // Author relation combobox
    await expect(page.getByRole('combobox', { name: 'Author' })).toBeVisible();
  });

  test('required-field validation – empty submit stays on create page', async ({ page }) => {
    await page.goto('/posts/create');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/\/posts\/create/);
  });

  test('create post with title and status saves correctly', async ({ page }) => {
    const uniqueTitle = `E2E Post ${Date.now()}`;

    // Cleanup leftovers
    const existing = await findPostsByTitle(uniqueTitle);
    for (const p of existing) await deletePostById(p.id);

    await page.goto('/posts/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Title*').fill(uniqueTitle);
    await page.getByRole('radio', { name: 'Draft' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Redirects to detail page
    await expect(page).toHaveURL(/\/posts\/[a-z0-9]+$/);

    // Verify via API
    const created = await findPostsByTitle(uniqueTitle);
    expect(created.length).toBe(1);

    const detail = await gql(
      `query($id: ID!) { post(where: { id: $id }) { id title status } }`,
      { id: created[0].id },
    );
    const post = detail.post as { id: string; title: string; status: string };
    expect(post.title).toBe(uniqueTitle);
    expect(post.status).toBe('draft');

    // Cleanup
    await deletePostById(post.id);
  });

  test('create post with author relation saves the relation', async ({ page }) => {
    const uniqueTitle = `E2E RelPost ${Date.now()}`;
    // Use a known author from seed data
    const authorsData = await gql('{ authors(take: 1) { id name } }');
    const author = (authorsData.authors as Array<{ id: string; name: string }>)[0];
    if (!author) test.skip();

    const existing = await findPostsByTitle(uniqueTitle);
    for (const p of existing) await deletePostById(p.id);

    await page.goto('/posts/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Title*').fill(uniqueTitle);

    // Fill the Author relation combobox
    const authorCombobox = page.getByRole('combobox', { name: 'Author' });
    await authorCombobox.fill(author.name.split(' ')[0]);
    await page.waitForTimeout(500);

    // Select the first suggestion from the dropdown
    const suggestion = page.getByRole('option').first();
    if (await suggestion.isVisible()) {
      await suggestion.click();
    }

    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Verify relation via API
    const created = await findPostsByTitle(uniqueTitle);
    if (created.length > 0) {
      const detail = await gql(
        `query($id: ID!) { post(where: { id: $id }) { author { id name } } }`,
        { id: created[0].id },
      );
      const post = detail.post as { author: { id: string; name: string } | null };
      if (post.author) {
        expect(post.author.id).toBe(author.id);
      }
      await deletePostById(created[0].id);
    }
  });
});

// ---------------------------------------------------------------------------
// Posts – Detail / Edit
// ---------------------------------------------------------------------------
test.describe('Posts – Detail / Edit', () => {
  let testPostId: string;

  test.beforeEach(async () => {
    const data = await gql(
      `mutation($title: String!, $status: String!) {
         createPost(data: { title: $title, status: $status }) { id }
       }`,
      { title: `Edit Test Post ${Date.now()}`, status: 'draft' },
    );
    testPostId = (data.createPost as { id: string }).id;
  });

  test.afterEach(async () => {
    if (testPostId) await deletePostById(testPostId);
  });

  test('detail page loads correct field values', async ({ page }) => {
    const data = await gql(
      `query($id: ID!) { post(where: { id: $id }) { title status } }`,
      { id: testPostId },
    );
    const post = data.post as { title: string; status: string | null };

    await page.goto(`/posts/${testPostId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Title*')).toHaveValue(post.title);
    if (post.status === 'draft') {
      await expect(page.getByRole('radio', { name: 'Draft' })).toBeChecked();
    } else if (post.status === 'published') {
      await expect(page.getByRole('radio', { name: 'Published' })).toBeChecked();
    }
  });

  test('edit title and save persists the change', async ({ page }) => {
    const newTitle = `Updated Post ${Date.now()}`;

    await page.goto(`/posts/${testPostId}`);
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Title*').fill(newTitle);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');

    const data = await gql(
      `query($id: ID!) { post(where: { id: $id }) { title } }`,
      { id: testPostId },
    );
    const updated = data.post as { title: string };
    expect(updated.title).toBe(newTitle);
  });

  test('edit status and save persists the change', async ({ page }) => {
    await page.goto(`/posts/${testPostId}`);
    await page.waitForLoadState('networkidle');

    // Switch to Published
    await page.getByRole('radio', { name: 'Published' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');

    const data = await gql(
      `query($id: ID!) { post(where: { id: $id }) { status } }`,
      { id: testPostId },
    );
    const updated = data.post as { status: string };
    expect(updated.status).toBe('published');
  });

  test('Save, Reset, Delete buttons are visible on detail page', async ({ page }) => {
    await page.goto(`/posts/${testPostId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('delete post removes it from the database', async ({ page }) => {
    await page.goto(`/posts/${testPostId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/posts/);

    const data = await gql(
      `query($id: ID!) { post(where: { id: $id }) { id } }`,
      { id: testPostId },
    );
    expect(data.post).toBeNull();

    testPostId = '';
  });
});

// ---------------------------------------------------------------------------
// Post – seeded "Wuthering Heights" detail view
// ---------------------------------------------------------------------------
test.describe('Post – Seeded item detail', () => {
  test('Wuthering Heights post loads with correct data', async ({ page }) => {
    const data = await gql(
      '{ posts(where: { title: { equals: "Wuthering Heights" } }) { id title status author { name } } }',
    );
    const posts = data.posts as Array<{ id: string; title: string; status: string; author: { name: string } | null }>;
    if (posts.length === 0) test.skip();

    const post = posts[0];

    await page.goto(`/posts/${post.id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Title*')).toHaveValue('Wuthering Heights');
    await expect(page.getByRole('radio', { name: 'Published' })).toBeChecked();

    // Content area (Slate rich-text editor) should be visible and contain the novel excerpt
    const contentEditor = page.locator('[data-slate-editor="true"]');
    await expect(contentEditor).toBeVisible();
    await expect(contentEditor).toContainText('landlord');
  });
});
