import { test, expect } from '@playwright/test';

test('explore columns toggle popup structure', async ({ page }) => {
  await page.goto('/authors?column=name&column=email&column=posts');
  await page.waitForLoadState('networkidle');
  
  // Click Columns button
  const colBtn = page.locator('button:has-text("Columns")');
  await colBtn.click();
  await page.waitForTimeout(300);
  
  // Get the menu that opened
  const menu = page.locator('[role="menu"]');
  const menuCount = await menu.count();
  console.log('Menu count:', menuCount);
  
  if (menuCount > 0) {
    const menuText = await menu.first().innerText();
    console.log('Menu text:', menuText);
    
    const menuItems = await menu.locator('[role="menuitemcheckbox"]').all();
    for (const item of menuItems) {
      const text = await item.innerText();
      const checked = await item.getAttribute('aria-checked');
      const key = await item.getAttribute('data-key');
      console.log('MENUITEMCHECKBOX:', { text, checked, key });
    }
  }
  
  await page.screenshot({ path: '/tmp/columns-menu.png' });
});

test('explore columns toggle - click Email checkbox in menu', async ({ page }) => {
  await page.goto('/authors?column=name&column=email&column=posts');
  await page.waitForLoadState('networkidle');
  
  // Click Columns button
  await page.locator('button:has-text("Columns")').click();
  await page.waitForTimeout(300);
  
  // Find Email menuitemcheckbox
  const emailItem = page.locator('[role="menuitemcheckbox"][data-key="email"]');
  const emailCount = await emailItem.count();
  console.log('Email menuitemcheckbox count:', emailCount);
  
  if (emailCount > 0) {
    const checkedBefore = await emailItem.getAttribute('aria-checked');
    console.log('Email checked before:', checkedBefore);
    
    await emailItem.click();
    await page.waitForTimeout(300);
    
    const checkedAfter = await emailItem.getAttribute('aria-checked');
    console.log('Email checked after:', checkedAfter);
    
    console.log('URL after toggle:', page.url());
    
    // Check if Email column header is still visible
    const emailHeader = page.locator('[aria-sort]').filter({ hasText: 'Email' });
    const emailHeaderVisible = await emailHeader.isVisible().catch(() => false);
    console.log('Email header visible after toggle:', emailHeaderVisible);
  }
  
  await page.screenshot({ path: '/tmp/columns-email-toggle.png' });
});

test('explore relationships on a post page', async ({ page }) => {
  // Navigate to Wuthering Heights post
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  const body = await page.locator('body').innerText();
  console.log('POST BODY:', body.slice(0, 800));
  
  // Check author relationship
  const authorBtn = page.locator('button[aria-label="Actions for Author"]');
  console.log('Author actions button:', await authorBtn.count());
  
  if (await authorBtn.count() > 0) {
    await authorBtn.click();
    await page.waitForTimeout(200);
    
    const menuItems = await page.locator('[role="menuitem"]').allTextContents();
    console.log('AUTHOR MENU ITEMS:', JSON.stringify(menuItems));
    
    // Close menu
    await page.keyboard.press('Escape');
  }
  
  await page.screenshot({ path: '/tmp/post-relationships.png' });
});

test('explore author with posts - L. Frank Baum', async ({ page }) => {
  // L. Frank Baum's page
  await page.goto('/authors/cmt6jom1p00058o22anjk2nw4');
  await page.waitForLoadState('networkidle');
  
  const body = await page.locator('body').innerText();
  console.log('BAUM BODY:', body.slice(0, 800));
  
  // Check posts section
  const postsSection = page.locator('[data-field="posts"]').first();
  if (await postsSection.count() > 0) {
    console.log('POSTS SECTION:', await postsSection.innerText());
  }
  
  await page.screenshot({ path: '/tmp/baum-author.png' });
});

test('explore seeded posts - which have authors', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  const rows = await page.locator('[role="row"][data-href]').all();
  for (const row of rows) {
    const text = await row.textContent();
    const href = await row.getAttribute('data-href');
    console.log('POST ROW:', text?.slice(0, 100), 'href:', href);
  }
  
  // Check one post's author
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('Author');
    return body.slice(idx, idx + 1000);
  });
  console.log('POST AUTHOR SECTION HTML:', html);
});
