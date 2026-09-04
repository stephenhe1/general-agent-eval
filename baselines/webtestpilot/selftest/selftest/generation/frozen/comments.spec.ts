import { test, expect } from '@playwright/test';

test('adding a comment appends exactly one comment and preserves the thread shape', async ({
  page,
}) => {
  await page.goto('/page/template');
  const before = await page.locator('.comment-box').count();
  const nestedBefore = await page.locator('.comment-branch-children').count();

  // Deliberately NOT the benchmark's literal: an autonomous suite picks its own data.
  await page.getByLabel('Leave a comment here').fill('Great template!');
  await page.getByRole('button', { name: 'Save Comment' }).click();

  await expect(page.locator('.comment-box')).toHaveCount(before + 1);
  await expect(page.locator('.comment-branch-children')).toHaveCount(nestedBefore);
  await expect(page.locator('.comment-box', { hasText: 'Great template!' })).toBeVisible();
});
