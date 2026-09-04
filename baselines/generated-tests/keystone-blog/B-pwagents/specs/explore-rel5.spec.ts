import { test, expect } from '@playwright/test';

test('explore - author combobox - full workflow to select author and save', async ({ page }) => {
  // Use a simple test post  
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Fill title
  await page.locator('input[type="text"]').first().fill('Test REL Post');
  
  // Now find the Author combobox
  // Author input is labeled "Author" - find by checking labelledby
  const authorInput = page.locator('input[aria-autocomplete="list"]').first();
  await authorInput.fill('Baum');
  await page.waitForTimeout(500);
  
  // Select from listbox
  const options = page.locator('[role="option"]');
  const optCount = await options.count();
  console.log('Options:', optCount);
  if (optCount > 0) {
    const text = await options.first().textContent();
    console.log('First option:', text);
    await options.first().click();
    await page.waitForTimeout(200);
    
    // Check the input value now
    const val = await authorInput.inputValue();
    console.log('Author input after select:', val);
  }
  
  // Save
  await page.locator('button:has-text("Save"), button:has-text("Create")').first().click();
  await page.waitForTimeout(1000);
  
  console.log('URL after save:', page.url());
  const h1 = await page.locator('h1').textContent();
  console.log('H1:', h1);
  
  // Check author is shown
  const body = await page.locator('body').innerText();
  const lines = body.split('\n');
  const authorIdx = lines.findIndex(l => l.trim() === 'Author');
  console.log('AUTHOR SECTION:', JSON.stringify(lines.slice(Math.max(0, authorIdx), authorIdx+5)));
  
  await page.screenshot({ path: '/tmp/post-with-author.png' });
  
  // Cleanup - delete post
  const deleteBtn = page.locator('button:has-text("Delete")');
  if (await deleteBtn.count() > 0) {
    await deleteBtn.click();
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await deleteDialog.locator('button:has-text("Yes, delete")').click();
    await page.waitForLoadState('networkidle');
    console.log('Post deleted');
  }
});

test('explore - how author is shown in relationship field after save', async ({ page }) => {
  // Wuthering Heights (no author assigned currently) - let me try adding one
  await page.goto('/posts/cmt6jom1y000a8o222bd4xosn');
  await page.waitForLoadState('networkidle');
  
  const bodyText = await page.locator('body').innerText();
  console.log('POST BODY:', bodyText.slice(0, 600));
  
  // Find the author input
  const authorInput = page.locator('[role="combobox"]').first();
  await authorInput.clear();
  await authorInput.fill('Bront');
  await page.waitForTimeout(500);
  
  const options = page.locator('[role="option"]');
  const count = await options.count();
  console.log('OPTIONS for Bront:', count);
  const texts = await options.allTextContents();
  console.log('OPTION TEXTS:', JSON.stringify(texts));
  
  if (count > 0) {
    await options.first().click();
    await page.waitForTimeout(200);
    
    // Save
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1000);
    
    const bodyAfterSave = await page.locator('body').innerText();
    const lines = bodyAfterSave.split('\n');
    const authorIdx = lines.findIndex(l => l.trim() === 'Author');
    console.log('AUTHOR AFTER SAVE:', JSON.stringify(lines.slice(authorIdx, authorIdx+5)));
    
    // Reset to no author
    await authorInput.clear();
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(500);
  }
});

test('explore - author inline connection - use Actions for Author / Add author dialog', async ({ page }) => {
  // We know "Add author" opens a dialog to CREATE a new author
  // But the Author field itself is a combobox to SELECT existing ones
  // Let's verify the full flow of using the combobox to add an existing author
  
  await page.goto('/posts/cmt6jom1t00068o22w685fvac');
  await page.waitForLoadState('networkidle');
  
  const body = await page.locator('body').innerText();
  const lines = body.split('\n');
  console.log('TITLE POST BODY:', JSON.stringify(lines.slice(0, 30)));
  
  // Find author combobox - look for Author label
  const authorCombo = page.locator('[role="combobox"]').first();
  const currentVal = await authorCombo.inputValue();
  console.log('Current author value:', currentVal);
  
  // Check what the label says
  const html = await page.evaluate(() => {
    const combos = Array.from(document.querySelectorAll('[role="combobox"]'));
    return combos.map(c => ({
      id: c.id,
      value: (c as HTMLInputElement).value,
      labelledby: c.getAttribute('aria-labelledby'),
    }));
  });
  console.log('COMBOS:', JSON.stringify(html));
});
