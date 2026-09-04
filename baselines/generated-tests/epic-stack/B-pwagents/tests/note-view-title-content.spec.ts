// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Individual note view shows correct title and content text', () => {
  test('individual note view shows correct title and content text', async ({ page }) => {
    await page.goto('/users/kody/notes/d27a197e');

    await expect(page.getByRole('heading', { name: 'Basic Koala Facts' })).toBeVisible();
    await expect(
      page.getByText('Koalas are found in the eucalyptus forests of eastern Australia.'),
    ).toBeVisible();
  });
});
