import { test, expect } from '@playwright/test';

test('explore posts list link - check actual row structure', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  // Check the list items structure
  const listItems = await page.evaluate(() => {
    // The Keystone list doesn't use standard tables; it uses a custom grid
    const allLinks = Array.from(document.querySelectorAll('a[href*="/posts/"]'));
    return allLinks.map(a => ({
      text: a.textContent?.trim().slice(0, 50),
      href: a.getAttribute('href')
    }));
  });
  console.log('POST ITEM LINKS:', JSON.stringify(listItems.slice(0, 5)));
  
  // Check the grid/list container
  const gridContent = await page.evaluate(() => {
    const grid = document.querySelector('[class*="list"], [class*="List"], [class*="grid"]');
    return grid?.textContent?.slice(0, 200) || 'no grid found';
  });
  console.log('GRID CONTENT:', gridContent);
  
  await page.screenshot({ path: '/tmp/posts-list-structure.png' });
});

test('explore save/update author item', async ({ page }) => {
  await page.goto('/authors/cmt6jom1p00058o22anjk2nw4');
  await page.waitForLoadState('networkidle');
  
  // L. Frank Baum - get current state
  const nameInput = page.locator('input[type="text"]').first();
  const originalName = await nameInput.inputValue();
  console.log('Original name:', originalName);
  
  // Change the name temporarily
  await nameInput.fill('L. Frank Baum Updated');
  
  // Click Save
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(1500);
  
  console.log('URL after save:', page.url());
  const headings = await page.locator('h1').allTextContents();
  console.log('H1 after save:', JSON.stringify(headings));
  
  // Look for success toast
  const toastContent = await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[role="status"]'));
    return toasts.map(t => t.textContent?.trim() || '');
  });
  console.log('TOASTS after save:', JSON.stringify(toastContent));
  
  // Restore original name
  await nameInput.fill(originalName);
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: '/tmp/save-author.png' });
});

test('explore inline create modal - Add Tag from post create', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  await page.click('button[aria-label="Actions for Tags"]');
  await page.waitForTimeout(300);
  await page.click('[role="menuitem"]:has-text("Add tag")');
  await page.waitForTimeout(500);
  
  // Get modal structure
  const modal = page.locator('[role="dialog"]');
  const modalHeadings = await modal.locator('h1, h2, h3').allTextContents();
  console.log('MODAL HEADINGS:', JSON.stringify(modalHeadings));
  
  const modalLabels = await modal.locator('label').allTextContents();
  console.log('MODAL LABELS:', JSON.stringify(modalLabels));
  
  const modalButtons = await modal.locator('button').allTextContents();
  console.log('MODAL BUTTONS:', JSON.stringify(modalButtons));
  
  // Fill the tag name
  const tagInput = modal.locator('input[type="text"]').first();
  await tagInput.fill('New Test Tag MODAL');
  
  // Click Add
  await modal.locator('button:has-text("Add")').click();
  await page.waitForTimeout(1000);
  
  // Check modal closed and tag is shown
  const modalExists = await page.locator('[role="dialog"]').count();
  console.log('Modal after add:', modalExists);
  
  const body = await page.locator('body').innerText();
  const tagLine = body.split('\n').filter(l => l.includes('New Test Tag') || l.includes('tag'));
  console.log('TAG IN BODY:', JSON.stringify(tagLine));
  
  await page.screenshot({ path: '/tmp/tag-added-modal.png' });
});

test('explore "view author" from post create relationship', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  await page.click('button[aria-label="Actions for Author"]');
  await page.waitForTimeout(300);
  
  const menuItems = await page.locator('[role="menuitem"]').allTextContents();
  console.log('AUTHOR MENU ITEMS:', JSON.stringify(menuItems));
  
  // Click "View author"
  await page.click('[role="menuitem"]:has-text("View author")');
  await page.waitForTimeout(1000);
  
  console.log('URL after view author:', page.url());
  const headings = await page.locator('h1').allTextContents();
  console.log('HEADINGS:', JSON.stringify(headings));
  
  await page.screenshot({ path: '/tmp/view-author-action.png' });
});

test('explore save post changes', async ({ page }) => {
  // Use "Wuthering Heights" post
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  const titleInput = page.locator('input[type="text"]').first();
  const originalTitle = await titleInput.inputValue();
  console.log('Original title:', originalTitle);
  
  // Change title
  await titleInput.fill('Wuthering Heights - Updated');
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(1500);
  
  const h1 = await page.locator('h1').textContent();
  console.log('H1 after save:', h1);
  
  // Check toast
  const toastContent = await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[role="status"]'));
    return toasts.map(t => t.textContent?.trim() || '');
  });
  console.log('TOASTS after save:', JSON.stringify(toastContent));
  
  // Restore
  await titleInput.fill(originalTitle);
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: '/tmp/post-save.png' });
});

test('explore sort by Email in authors list', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Sort by Email
  const emailHeader = page.locator('[aria-sort="none"]:has-text("Email")').first();
  if (await emailHeader.count() > 0) {
    await emailHeader.click();
    await page.waitForTimeout(500);
    console.log('URL after Email sort:', page.url());
    
    // Click again for descending
    await emailHeader.click();
    await page.waitForTimeout(500);
    console.log('URL after Email sort descending:', page.url());
  }
  
  await page.screenshot({ path: '/tmp/sort-email.png' });
});

test('explore Tags list - row content', async ({ page }) => {
  await page.goto('/tags');
  await page.waitForLoadState('networkidle');
  
  // Get all links  
  const allLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/tags/"]'));
    return links.map(l => ({ text: l.textContent?.trim(), href: l.getAttribute('href') }));
  });
  console.log('TAG LINKS:', JSON.stringify(allLinks));
  
  // Check content
  const body = await page.locator('body').innerText();
  const lines = body.split('\n').filter(l => l.trim() && l.length < 100);
  console.log('TAGS LIST BODY:', JSON.stringify(lines.slice(0, 15)));
  
  await page.screenshot({ path: '/tmp/tags-list-content.png' });
});
