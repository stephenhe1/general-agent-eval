import { test, expect } from '@playwright/test';

test('explore relationships - post with author', async ({ page }) => {
  // Wuthering Heights has Emily Bronte
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  const body = await page.locator('body').innerText();
  console.log('WUTHERING BODY:', body.slice(0, 600));
  
  // Click View Author  
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  const menuItems = await page.locator('[role="menuitem"]').allTextContents();
  console.log('AUTHOR MENU:', JSON.stringify(menuItems));
  
  await page.locator('[role="menuitem"]:has-text("View author")').click();
  await page.waitForLoadState('networkidle');
  
  console.log('URL after view author:', page.url());
  const h1 = await page.locator('h1').textContent();
  console.log('H1:', h1);
});

test('explore relationships - post REL author menu items', async ({ page }) => {
  // Create fresh post, check relationship UI
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  // Click Actions for Author  
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  // Check all items and their state
  const items = await page.locator('[role="menuitem"]').all();
  for (const item of items) {
    const text = await item.innerText();
    const disabled = await item.getAttribute('aria-disabled');
    console.log('MENU ITEM:', text, 'disabled:', disabled);
  }
});

test('explore tags on a post - seeded data', async ({ page }) => {
  // Get the post with tags
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  const body = await page.locator('body').innerText();
  console.log('WUTHERING BODY FOR TAGS:', body);
  
  // Check Tags button  
  const tagsBtn = page.locator('button[aria-label="Actions for Tags"]');
  if (await tagsBtn.count() > 0) {
    await tagsBtn.click();
    await page.waitForTimeout(200);
    const menuItems = await page.locator('[role="menuitem"]').allTextContents();
    console.log('TAGS MENU:', JSON.stringify(menuItems));
    await page.keyboard.press('Escape');
  }
});

test('explore - author L Frank Baum detail', async ({ page }) => {
  await page.goto('/authors/cmt6jom1p00058o22anjk2nw4');
  await page.waitForLoadState('networkidle');
  
  const nameInput = await page.locator('input[type="text"]').first().inputValue();
  console.log('AUTHOR NAME:', nameInput);
  
  // Find posts relationship
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('posts');
    return body.slice(Math.max(0, idx-100), idx+500);
  });
  console.log('POSTS HTML:', html.slice(0, 600));
});

test('explore - check Charlotte Bronte and Emily Bronte author IDs', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  const rows = await page.locator('[role="row"][data-href]').all();
  for (const row of rows) {
    const text = await row.textContent();
    const href = await row.getAttribute('data-href');
    if (text?.includes('Bront') || text?.includes('Charlotte')) {
      console.log('BRONTE AUTHOR:', text?.slice(0, 100), 'href:', href);
    }
    if (text?.includes('Arthur') || text?.includes('Emily') || text?.includes('Jane') || text?.includes('Lewis')) {
      console.log('AUTHOR:', text?.slice(0, 80), 'href:', href);
    }
  }
});

test('explore - which seeded posts have authors', async ({ page }) => {
  const postUrls = [
    '/posts/cmt6jom1t00068o22w685fvac',
    '/posts/cmt6jom1v00078o22z63hcsm5',
    '/posts/cmt6jom1w00088o22z2l59mje',
  ];
  
  for (const url of postUrls) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    
    const authorBtn = page.locator('button[aria-label="Actions for Author"]');
    if (await authorBtn.count() > 0) {
      await authorBtn.click();
      await page.waitForTimeout(200);
      
      const items = await page.locator('[role="menuitem"]').all();
      const menuTexts = [];
      for (const item of items) {
        const text = await item.innerText();
        const disabled = await item.getAttribute('aria-disabled');
        menuTexts.push({ text, disabled });
      }
      console.log(`POST ${url} author menu:`, JSON.stringify(menuTexts));
      await page.keyboard.press('Escape');
    }
  }
});
