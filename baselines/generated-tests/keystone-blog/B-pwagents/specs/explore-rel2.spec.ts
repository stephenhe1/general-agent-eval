import { test, expect } from '@playwright/test';

test('explore - view author from Wuthering Heights post', async ({ page }) => {
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  // Click Actions for Author
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  // Check menu items - need to know if View author is enabled
  const viewItem = page.locator('[role="menuitem"]:has-text("View author")');
  const disabled = await viewItem.getAttribute('aria-disabled');
  console.log('"View author" disabled attr:', disabled);
  
  // What's the post content around Author section?
  const authorSection = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('Actions for Author');
    return body.slice(Math.max(0, idx-300), idx+1000);
  });
  console.log('AUTHOR SECTION HTML:', authorSection.slice(0, 800));
});

test('explore - add author to Wuthering Heights via relationship', async ({ page }) => {
  // First check current state - does Wuthering Heights have an author?
  await page.goto('/posts/cmt6jom1v00078o22z63hcsm5');
  await page.waitForLoadState('networkidle');
  
  // Get relationship section
  const bodyText = await page.locator('body').innerText();
  // Find author section
  const lines = bodyText.split('\n');
  const authorIdx = lines.findIndex(l => l.includes('Author'));
  console.log('AUTHOR SECTION LINES:', JSON.stringify(lines.slice(Math.max(0, authorIdx-1), authorIdx+10)));
  
  // Click "Add author"
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  await page.locator('[role="menuitem"]:has-text("Add author")').click();
  await page.waitForTimeout(500);
  
  // What appeared?
  const bodyAfter = await page.locator('body').innerText();
  console.log('BODY AFTER ADD AUTHOR:', bodyAfter.slice(0, 500));
  
  // Check for search input
  const inputs = await page.locator('input').all();
  for (const inp of inputs) {
    const label = await inp.getAttribute('aria-label');
    const placeholder = await inp.getAttribute('placeholder');
    const type = inp.getAttribute('type');
    console.log('INPUT:', { label, placeholder });
  }
  
  await page.screenshot({ path: '/tmp/add-author-rel.png' });
});

test('explore - see tags list to know which tags exist', async ({ page }) => {
  await page.goto('/tags');
  await page.waitForLoadState('networkidle');
  
  const rows = await page.locator('[role="row"][data-href]').all();
  for (const row of rows) {
    const text = await row.textContent();
    const href = await row.getAttribute('data-href');
    console.log('TAG:', text?.slice(0, 60), 'href:', href);
  }
});

test('explore - rich text editor on post create', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Find content-editable
  const editor = page.locator('div[contenteditable="true"]');
  const editorCount = await editor.count();
  console.log('Contenteditable count:', editorCount);
  
  if (editorCount > 0) {
    // Click inside and type
    await editor.first().click();
    await editor.first().type('Hello rich text content');
    await page.waitForTimeout(200);
    
    const content = await editor.first().textContent();
    console.log('EDITOR CONTENT:', content);
  }
  
  await page.screenshot({ path: '/tmp/rich-text-editor.png' });
});

test('explore - edge case non-existent author', async ({ page }) => {
  await page.goto('/authors/does-not-exist-00000');
  await page.waitForLoadState('networkidle');
  
  const url = page.url();
  console.log('URL:', url);
  
  const h1 = await page.locator('h1').textContent().catch(() => 'N/A');
  console.log('H1:', h1);
  
  const body = await page.locator('body').innerText();
  console.log('BODY:', body.slice(0, 300));
  
  await page.screenshot({ path: '/tmp/non-existent-author.png' });
});
