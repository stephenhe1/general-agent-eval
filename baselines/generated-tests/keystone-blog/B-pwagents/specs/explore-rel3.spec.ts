import { test, expect } from '@playwright/test';

test('explore - relationship search input for Add Author', async ({ page }) => {
  await page.goto('/posts/cmt6jom1w00088o22z2l59mje');
  await page.waitForLoadState('networkidle');
  
  // Click Add author
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  await page.locator('[role="menuitem"]:has-text("Add author")').click();
  await page.waitForTimeout(500);
  
  // Find the search input
  const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
  const searchCount = await searchInput.count();
  console.log('Search input count:', searchCount);
  
  // Get all inputs
  const allInputs = await page.locator('input').all();
  for (const inp of allInputs) {
    const placeholder = await inp.getAttribute('placeholder');
    const type = await inp.getAttribute('type');
    const value = await inp.inputValue();
    console.log('INPUT:', { placeholder, type, value });
  }
  
  // Get dialog or popup HTML
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('placeholder="');
    return body.slice(Math.max(0, idx-500), idx+1500);
  });
  console.log('POPUP HTML:', html.slice(0, 1000));
  
  await page.screenshot({ path: '/tmp/add-author-search.png' });
});

test('explore - view author menu item state when author exists', async ({ page }) => {
  // Test post that HAS an author (Wuthering Heights = Emily Bronte)
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  // Get the author relationship section HTML
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    // Find area around Author section
    const idx = body.indexOf('aria-label="Actions for Author"');
    return body.slice(Math.max(0, idx-500), idx+1000);
  });
  console.log('AUTHOR SECTION:', html.slice(0, 1200));
  
  // Click Actions for Author
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  const items = await page.locator('[role="menuitem"]').all();
  for (const item of items) {
    const text = await item.innerText();
    const disabled = await item.getAttribute('aria-disabled');
    console.log('MENU ITEM:', { text, disabled });
  }
});

test('explore - find which post has author assigned', async ({ page }) => {
  // Check all seeded posts to find one with an author
  const postHrefs = [
    '/posts/cmt6jom1t00068o22w685fvac',  // Updated Title
    '/posts/cmt6jom1v00078o22z63hcsm5',  // Wuthering Heights
    '/posts/cmt6jom1w00088o22z2l59mje',  // test item
    '/posts/cmt6jom1x00098o22w4kztt6z',  // test item
    '/posts/cmt6jom1y000a8o222bd4xosn',  // test item
  ];
  
  for (const href of postHrefs) {
    await page.goto(href);
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body').innerText();
    // Find author related lines
    const lines = body.split('\n');
    const authorIdx = lines.findIndex(l => l.trim() === 'Author');
    if (authorIdx >= 0) {
      console.log(`${href} - Author section:`, JSON.stringify(lines.slice(authorIdx, authorIdx+5)));
    }
  }
});

test('explore - add author search popup structure', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Click Add author  
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  await page.locator('[role="menuitem"]:has-text("Add author")').click();
  await page.waitForTimeout(500);
  
  // Full HTML of popup
  const html = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    if (dialogs.length > 0) return dialogs[0].innerHTML.slice(0, 2000);
    
    // Try to find popup any other way
    const body = document.body.innerHTML;
    const idx = body.indexOf('Baum');
    return idx > -1 ? body.slice(Math.max(0, idx-1000), idx+500) : 'no baum found';
  });
  console.log('POPUP HTML:', html);
  
  await page.screenshot({ path: '/tmp/add-author-popup.png' });
});
