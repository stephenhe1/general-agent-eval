import { test, expect } from '@playwright/test';

test('explore move note - with unique note name', async ({ page }) => {
  const WS = 'ws-move-exp21';

  await page.goto('http://127.0.0.1:5173/');

  // Create workspace
  await page.getByRole('button', { name: 'Create Workspace' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'Workspace Name' }).fill(WS);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/ws-home/);

  // Create directory - also creates target-folder/untitled-1.md
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(400);
  await page.keyboard.type('New Directory');
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: 'New Directory' }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Input directory name').fill('target-folder');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  // At target-folder/untitled-1.md

  // Create root note with unique name
  await page.goto(`http://127.0.0.1:5173/ws#route=ws-home&wsName=${WS}`);
  await page.waitForTimeout(400);
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(400);
  await page.keyboard.type('New Note');
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: /^> New Note$/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Input a note name').fill('unique-note-abc');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  console.log('Root unique note:', page.url());
  // At unique-note-abc.md

  // Now try Move Note - moving unique-note-abc to target-folder
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(400);
  await page.keyboard.type('Move Note');
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: /Move Note/i }).first().click();
  await page.waitForTimeout(600);

  const opts = await page.locator('[cmdk-item]').allTextContents();
  console.log('Move options:', opts);

  const targetOpt = page.locator('[cmdk-item]').filter({ hasText: 'target-folder/' }).first();
  await targetOpt.click();
  await page.waitForTimeout(1500);

  console.log('After move URL:', page.url());
  const body = await page.locator('body').innerText();
  console.log('Body:', body.slice(0, 400));
  await page.screenshot({ path: '/tmp/move-unique-note.png' });
});
