// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Notes listing page shows all seeded note titles', () => {
  test('notes listing page shows all seeded note titles', async ({ page }) => {
    await page.goto('/users/kody/notes');

    await expect(page.getByRole('link', { name: 'Basic Koala Facts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Koalas like to cuddle' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Not bears' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Snowboarding Adventure' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Onewheel Tricks' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Coding Dilemma' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Coding Mentorship' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Koala Fun Facts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Skiing Adventure' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Code Jam Success' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Koala Conservation Efforts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Game day' })).toBeVisible();
  });
});
