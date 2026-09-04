import { test, expect } from '@playwright/test';

// Intentionally broken on the clean application. The evaluator must classify this
// as clean-failing and refuse to let it count as detecting any injected fault.
test('intentionally clean-failing probe', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nonexistent Section' })).toBeVisible({
    timeout: 2000,
  });
});
