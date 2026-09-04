// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Note with images renders image elements with correct alt text', () => {
  test('note with images renders image elements with correct alt text', async ({ page }) => {
    await page.goto('/users/kody/notes/d27a197e');

    const koalaCartoon = page.getByRole('img', { name: 'an adorable koala cartoon illustration' });
    const koalaEating = page.getByRole('img', { name: 'a cartoon illustration of a koala in a tree eating' });

    await expect(koalaCartoon).toBeVisible();
    await expect(koalaEating).toBeVisible();

    await expect(koalaCartoon).toHaveAttribute('src', /kody-notes/);
    await expect(koalaEating).toHaveAttribute('src', /kody-notes/);
  });
});
