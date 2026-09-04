import { test, expect } from '@playwright/test';

test('explore - "View author" from post page - why does it stay on post page?', async ({ page }) => {
  // Click View author but navigate to author page
  await page.goto('/posts/cmt6jom1t00068o22w685fvac');
  await page.waitForLoadState('networkidle');
  
  // Check the author value
  const authorVal = await page.locator('[role="combobox"]').first().inputValue();
  console.log('Author:', authorVal);
  
  // Click Actions for Author
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  // Try clicking view author with waitForNavigation
  try {
    await Promise.all([
      page.waitForNavigation({ timeout: 5000 }),
      page.locator('[role="menuitem"]:has-text("View author")').click()
    ]);
    console.log('Navigation happened. URL:', page.url());
  } catch (e) {
    console.log('No navigation in 5s. URL:', page.url());
    
    // Wait for URL change
    await page.waitForTimeout(1000);
    console.log('URL after 1s:', page.url());
  }
  
  await page.screenshot({ path: '/tmp/view-author-action2.png' });
});

test('explore - "View author" opens in new window/tab?', async ({ page, context }) => {
  await page.goto('/posts/cmt6jom1t00068o22w685fvac');
  await page.waitForLoadState('networkidle');
  
  // Listen for new page
  const pagePromise = context.waitForEvent('page', { timeout: 3000 }).catch(() => null);
  
  // Click Actions for Author  
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  await page.locator('[role="menuitem"]:has-text("View author")').click();
  
  const newPage = await pagePromise;
  if (newPage) {
    await newPage.waitForLoadState('networkidle');
    console.log('NEW PAGE URL:', newPage.url());
    console.log('NEW PAGE H1:', await newPage.locator('h1').textContent());
  } else {
    console.log('No new page. Current URL:', page.url());
    const h1 = await page.locator('h1').textContent();
    console.log('Current H1:', h1);
  }
});

test('explore - view author - what happens after click (is it a link in menu)?', async ({ page }) => {
  await page.goto('/posts/cmt6jom1t00068o22w685fvac');
  await page.waitForLoadState('networkidle');
  
  // Click Actions for Author
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  // Get the menuitem HTML
  const html = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    return items.map(i => i.outerHTML).join('\n');
  });
  console.log('MENU ITEMS HTML:', html);
});

test('explore - author posts relationship in author page', async ({ page }) => {
  // Arthur Conan Doyle has posts
  await page.goto('/authors/cmt6jom0z00008o22yi12s6ra');
  await page.waitForLoadState('networkidle');
  
  const body = await page.locator('body').innerText();
  console.log('ARTHUR BODY:', body.slice(0, 600));
  
  // Check posts in the relationship section
  const postLinks = await page.locator('a[href*="/posts/"]').all();
  for (const link of postLinks) {
    const text = await link.textContent();
    const href = await link.getAttribute('href');
    console.log('POST LINK:', text?.trim(), href);
  }
});

test('explore - post create rich text - which contenteditable is the content field', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Get all contenteditables
  const editors = await page.locator('[contenteditable="true"]').all();
  console.log('ContentEditable count:', editors.length);
  
  for (let i = 0; i < editors.length; i++) {
    const text = await editors[i].textContent();
    const ariaLabel = await editors[i].getAttribute('aria-label');
    const role = await editors[i].getAttribute('role');
    const placeholder = await editors[i].getAttribute('data-placeholder');
    console.log(`Editor ${i}:`, { text: text?.slice(0, 30), ariaLabel, role, placeholder });
  }
  
  // The content field should be the ProseMirror editor
  // Find it by role="textbox" or data-testid
  const textbox = page.locator('[role="textbox"][contenteditable="true"]');
  console.log('Textbox count:', await textbox.count());
  
  if (await textbox.count() > 0) {
    const first = textbox.first();
    await first.click();
    await first.type('Test content for rich text');
    await page.waitForTimeout(200);
    console.log('Content after type:', await first.textContent());
  }
  
  await page.screenshot({ path: '/tmp/rich-text-content.png' });
});
