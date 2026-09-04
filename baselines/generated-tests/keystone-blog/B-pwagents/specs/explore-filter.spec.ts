import { test, expect } from '@playwright/test';

test('explore filter panel in authors list', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Find filter button
  const buttons = await page.locator('button').allTextContents();
  console.log('BUTTONS:', JSON.stringify(buttons));
  
  // Find by text that might be filter-related
  const filterBtn = page.locator('button:has-text("Filter")');
  const filterCount = await filterBtn.count();
  console.log('Filter button count:', filterCount);
  
  if (filterCount > 0) {
    await filterBtn.first().click();
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText();
    const lines = body.split('\n').filter(l => l.trim() && l.length < 100);
    console.log('BODY AFTER FILTER CLICK:', JSON.stringify(lines.slice(0, 20)));
    await page.screenshot({ path: '/tmp/filter-panel.png' });
  }
  
  // Also look for columns toggle
  const colButton = page.locator('button:has-text("Columns")');
  const colCount = await colButton.count();
  console.log('Columns button count:', colCount);
});

test('explore author sort URL', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Find Name column header with aria-sort
  const nameHeaders = await page.locator('[aria-sort]').all();
  for (const h of nameHeaders) {
    const text = await h.textContent();
    const sort = await h.getAttribute('aria-sort');
    console.log('HEADER:', text?.trim(), 'aria-sort:', sort);
  }
  
  // Try clicking a header with aria-sort
  const nameHeader = page.locator('[aria-sort]').first();
  if (await nameHeader.count() > 0) {
    await nameHeader.click();
    await page.waitForTimeout(800);
    console.log('URL after sort click:', page.url());
    await page.screenshot({ path: '/tmp/after-sort.png' });
  }
});

test('explore posts filter UI', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  const buttons = await page.locator('button').allTextContents();
  console.log('POSTS BUTTONS:', JSON.stringify(buttons));
  
  const filterBtn = page.locator('button:has-text("Filter")');
  if (await filterBtn.count() > 0) {
    await filterBtn.first().click();
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText();
    const lines = body.split('\n').filter(l => l.trim() && l.length < 100);
    console.log('POSTS FILTER BODY:', JSON.stringify(lines.slice(0, 20)));
    await page.screenshot({ path: '/tmp/posts-filter.png' });
  }
});

test('explore per page selector', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Look for items per page
  const body = await page.locator('body').innerText();
  const lines = body.split('\n').filter(l => l.includes('page') || l.includes('per') || l.includes('10') || l.includes('50'));
  console.log('PER PAGE LINES:', JSON.stringify(lines));
  
  // Check for select elements
  const selects = await page.locator('select').all();
  for (const sel of selects) {
    const val = await sel.inputValue();
    const opts = await sel.locator('option').allTextContents();
    console.log('SELECT VALUE:', val, 'OPTIONS:', JSON.stringify(opts));
  }
  
  // Check for pagination links
  const paginationLinks = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a[href*="first="], a[href*="page="]'));
    return els.map(e => ({ text: e.textContent?.trim(), href: e.getAttribute('href') }));
  });
  console.log('PAGINATION LINKS:', JSON.stringify(paginationLinks));
  
  await page.screenshot({ path: '/tmp/pagination.png' });
});
