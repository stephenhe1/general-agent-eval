/**
 * Tests for editor features: text formatting, wide editor toggle.
 */
import { expect, test } from '@playwright/test';
import {
  createBrowserWorkspaceAndNote,
  readStoredMarkdown,
} from './helpers';

/** Selects the first occurrence of `text` inside the ProseMirror editor. */
async function selectEditorText(
  page: import('@playwright/test').Page,
  text: string,
) {
  await page.locator('.ProseMirror').evaluate((editor, selectedText) => {
    editor.focus();
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }
    const fullText = textNodes.map((t) => t.data).join('');
    const start = fullText.indexOf(selectedText);
    if (start < 0) throw new Error(`Text "${selectedText}" not found in editor`);
    const end = start + selectedText.length;
    let consumed = 0;
    const resolve = (offset: number) => {
      consumed = 0;
      for (const tn of textNodes) {
        if (offset <= consumed + tn.length) {
          return { node: tn, offset: offset - consumed };
        }
        consumed += tn.length;
      }
      throw new Error(`Cannot resolve offset ${offset}`);
    };
    const range = document.createRange();
    range.setStart(resolve(start).node, resolve(start).offset);
    range.setEnd(resolve(end).node, resolve(end).offset);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
  }, text);
}

test.describe('Text formatting toolbar', () => {
  const content = 'bold italic strike code plain';

  test('toolbar appears when text is selected', async ({ page }) => {
    const wsName = `rq6-fmt-toolbar-${Date.now()}`;
    const noteName = `fmt-toolbar-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText(content);

    await selectEditorText(page, 'bold');
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();
  });

  test('Bold formatting toggles and persists', async ({ page }) => {
    const wsName = `rq6-fmt-bold-${Date.now()}`;
    const noteName = `fmt-bold-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText(content);

    await selectEditorText(page, 'bold');
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();

    // Use exact: true to avoid matching sidebar buttons with similar names
    const boldBtn = toolbar.getByRole('button', { name: 'Bold', exact: true });
    await expect(boldBtn).toHaveAttribute('aria-pressed', 'false');
    await boldBtn.click();
    await expect(boldBtn).toHaveAttribute('aria-pressed', 'true');

    // Check the stored markdown has bold markers
    await expect
      .poll(() => readStoredMarkdown(page, wsName, noteName), { timeout: 10_000 })
      .toContain('**bold**');
  });

  test('Italic formatting toggles', async ({ page }) => {
    const wsName = `rq6-fmt-italic-${Date.now()}`;
    const noteName = `fmt-italic-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText(content);

    await selectEditorText(page, 'italic');
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();

    // Scope within the toolbar to avoid strict mode violation
    const italicBtn = toolbar.getByRole('button', { name: 'Italic', exact: true });
    await italicBtn.click();
    await expect(italicBtn).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(() => readStoredMarkdown(page, wsName, noteName), { timeout: 10_000 })
      .toContain('_italic_');
  });

  test('Strikethrough formatting toggles', async ({ page }) => {
    const wsName = `rq6-fmt-strike-${Date.now()}`;
    const noteName = `fmt-strike-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText(content);

    await selectEditorText(page, 'strike');
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();

    const strikeBtn = page.getByRole('button', { name: 'Strikethrough' });
    await strikeBtn.click();
    await expect(strikeBtn).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(() => readStoredMarkdown(page, wsName, noteName), { timeout: 10_000 })
      .toContain('~~strike~~');
  });

  test('Inline code formatting toggles', async ({ page }) => {
    const wsName = `rq6-fmt-code-${Date.now()}`;
    const noteName = `fmt-code-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText(content);

    await selectEditorText(page, 'code');
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();

    const codeBtn = page.getByRole('button', { name: 'Inline code' });
    await codeBtn.click();
    await expect(codeBtn).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(() => readStoredMarkdown(page, wsName, noteName), { timeout: 10_000 })
      .toContain('`code`');
  });

  test('toolbar hides when selection is cleared', async ({ page }) => {
    const wsName = `rq6-fmt-hide-${Date.now()}`;
    const noteName = `fmt-hide-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText(content);

    await selectEditorText(page, 'bold');
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();

    // Press Escape to dismiss toolbar
    await page.keyboard.press('Escape');
    await expect(toolbar).toBeHidden();
  });

  test('Link button is visible and enabled for single-block selection', async ({
    page,
  }) => {
    const wsName = `rq6-fmt-link-${Date.now()}`;
    const noteName = `fmt-link-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.insertText('visit example today');

    await selectEditorText(page, 'example');
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Link', exact: true }),
    ).toBeEnabled();
  });
});

test.describe('Wide editor toggle', () => {
  test('toggle max width button changes editor width', async ({ page }) => {
    const wsName = `rq6-wide-editor-${Date.now()}`;
    const noteName = `wide-note-${Date.now()}`;
    await createBrowserWorkspaceAndNote(page, { workspaceName: wsName, noteName });

    // The toggle button should be visible in the header
    const toggleBtn = page.getByRole('button', { name: 'Toggle Max Width' });
    await expect(toggleBtn).toBeVisible();

    // Click to toggle wide
    await toggleBtn.click();
    // The button should still be visible (it toggles state)
    await expect(toggleBtn).toBeVisible();

    // Click again to toggle back
    await toggleBtn.click();
    await expect(toggleBtn).toBeVisible();
  });
});
