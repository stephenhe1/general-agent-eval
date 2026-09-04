import { test, expect } from '@playwright/test';

test('explore - REL verify author shown after linking + save post with author', async ({ page }) => {
  // Create a post, select existing author via combobox, save and check
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Fill title
  await page.locator('input[type="text"]').first().fill('Test Author Link Post ' + Date.now());
  
  // Find author combobox (labeled Author) and type
  const authorInput = page.locator('[role="combobox"]').first();
  await authorInput.clear();
  await authorInput.type('Baum');
  await page.waitForTimeout(800);
  
  const options = page.locator('[role="option"]');
  console.log('Options count:', await options.count());
  const texts = await options.allTextContents();
  console.log('Options texts:', JSON.stringify(texts));
  
  if (await options.count() > 0) {
    await options.first().click();
    await page.waitForTimeout(200);
    console.log('Selected author:', await authorInput.inputValue());
  }
  
  // Save (Create button)
  await page.locator('button:has-text("Save"), button:has-text("Create")').first().click();
  await page.waitForTimeout(1500);
  
  console.log('URL after save:', page.url());
  
  const authorVal = await page.locator('[role="combobox"]').first().inputValue();
  console.log('Author after save:', authorVal);
  
  const body = await page.locator('body').innerText();
  const hasBaum = body.includes('Baum') || body.includes('baum');
  console.log('Has Baum in body:', hasBaum);
  
  // Check the full HTML for author display
  const authorSectionHTML = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('Actions for Author');
    return body.slice(Math.max(0, idx-1500), idx+200);
  });
  console.log('AUTHOR SECTION HTML (around combobox):', authorSectionHTML.slice(0, 600));
  
  await page.screenshot({ path: '/tmp/post-author-saved.png' });
  
  // Cleanup
  const deleteBtn = page.locator('button:has-text("Delete")');
  if (await deleteBtn.count() > 0) {
    await deleteBtn.click();
    const deleteDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Are you sure' });
    await deleteDialog.locator('button:has-text("Yes, delete")').click();
    await page.waitForLoadState('networkidle');
  }
});

test('explore - view author from post page - click View Author and check navigation', async ({ page }) => {
  // Use the post that has Arthur Conan Doyle
  await page.goto('/posts/cmt6jom1t00068o22w685fvac');
  await page.waitForLoadState('networkidle');
  
  const authorVal = await page.locator('[role="combobox"]').first().inputValue();
  console.log('Author value:', authorVal);
  
  // Click Actions for Author
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  const menuItems = await page.locator('[role="menuitem"]').allTextContents();
  console.log('Menu items:', JSON.stringify(menuItems));
  
  // Click View author
  await page.locator('[role="menuitem"]:has-text("View author")').click();
  await page.waitForLoadState('networkidle');
  
  console.log('URL:', page.url());
  const h1 = await page.locator('h1').textContent();
  console.log('H1:', h1);
  
  await page.screenshot({ path: '/tmp/view-author-nav.png' });
});

test('explore - tags - add existing tag to post', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Fill title
  await page.locator('input[type="text"]').first().fill('Test Tag Post ' + Date.now());
  
  // Find Tags combobox - should be the second combobox
  const tagInput = page.locator('[role="combobox"]').nth(1);
  await tagInput.clear();
  await tagInput.type('ITag');
  await page.waitForTimeout(500);
  
  const options = page.locator('[role="option"]');
  console.log('Tag options:', await options.count());
  const texts = await options.allTextContents();
  console.log('Tag options:', JSON.stringify(texts));
  
  if (await options.count() > 0) {
    await options.first().click();
    await page.waitForTimeout(200);
    console.log('Tag input after:', await tagInput.inputValue());
  }
  
  await page.screenshot({ path: '/tmp/tag-combobox.png' });
});

test('explore - author from post page - author section has link', async ({ page }) => {
  // We need to understand how the author IS shown on the post page
  await page.goto('/posts/cmt6jom1t00068o22w685fvac');
  await page.waitForLoadState('networkidle');
  
  // The combobox shows "Arthur Conan Doyle" - but "View author" should navigate to the author
  // Let's see what's around the combobox 
  const authorInput = page.locator('[role="combobox"]').first();
  const val = await authorInput.inputValue();
  console.log('Author value:', val);
  
  // Is the author name a link?
  const links = await page.locator('a[href*="/authors/"]').all();
  for (const link of links) {
    const text = await link.textContent();
    const href = await link.getAttribute('href');
    console.log('AUTHOR LINK:', text, href);
  }
  
  // Get the field container HTML  
  const html = await page.evaluate(() => {
    const combos = Array.from(document.querySelectorAll('[role="combobox"]'));
    const first = combos[0];
    const container = first?.closest('[class*="css"]')?.parentElement?.parentElement?.parentElement;
    return container?.innerHTML?.slice(0, 2000) || 'no container';
  });
  console.log('AUTHOR FIELD HTML:', html.slice(0, 1000));
});
