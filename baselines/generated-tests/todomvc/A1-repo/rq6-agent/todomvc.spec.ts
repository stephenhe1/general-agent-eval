/**
 * TodoMVC E2E Tests
 *
 * Covers all pages, routes, and user flows for the React TypeScript TodoMVC app.
 * The app persists state in localStorage under the key "APP_STATE".
 * Each test clears localStorage before running to ensure a clean slate.
 */

import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the app and wipe any persisted todos so each test starts fresh. */
async function freshPage(page: Page, path = '/'): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('APP_STATE'))
  if (path !== '/') {
    await page.goto(path)
  } else {
    await page.reload()
  }
}

/** Add one todo via the new-todo input. */
async function addTodo(page: Page, text: string): Promise<void> {
  const input = page.getByTestId('new-todo-input-text')
  await input.fill(text)
  await input.press('Enter')
}

/** Add multiple todos in order. */
async function addTodos(page: Page, texts: string[]): Promise<void> {
  for (const t of texts) {
    await addTodo(page, t)
  }
}

/** Return the text content of all visible todo labels. */
async function getTodoTexts(page: Page): Promise<string[]> {
  return page.getByTestId('todo-body-text').allTextContents()
}

/** Return the count of todo items currently in the list. */
async function getTodoCount(page: Page): Promise<number> {
  return page.getByTestId('todo-item').count()
}

// ---------------------------------------------------------------------------
// Pages / Routes
// ---------------------------------------------------------------------------

test.describe('Pages and Routes', () => {
  test('/ renders main TodoMVC page with header and input', async ({ page }) => {
    await freshPage(page, '/')
    await expect(page.locator('h1')).toHaveText('todos')
    await expect(page.getByTestId('new-todo-input-text')).toBeVisible()
    await expect(page.getByTestId('new-todo-input-text')).toHaveAttribute(
      'placeholder',
      'What needs to be done?'
    )
  })

  test('/active renders the active filter page', async ({ page }) => {
    await freshPage(page, '/')
    // addTodos prepends: "Completed task" ends up at index 0, "Active task" at index 1
    await addTodos(page, ['Active task', 'Completed task'])
    // Complete the first item (newest = "Completed task")
    const items = page.getByTestId('todo-item')
    await items.nth(0).getByTestId('todo-item-complete-check').click()
    // Navigate to /active
    await page.goto('/active')
    const labels = await getTodoTexts(page)
    // Only the uncompleted "Active task" should appear
    expect(labels).toContain('Active task')
    expect(labels).not.toContain('Completed task')
  })

  test('/completed renders the completed filter page', async ({ page }) => {
    await freshPage(page, '/')
    // addTodos prepends: "Completed task" ends up at index 0, "Active task" at index 1
    await addTodos(page, ['Active task', 'Completed task'])
    // Complete the first item (newest = "Completed task")
    const items = page.getByTestId('todo-item')
    await items.nth(0).getByTestId('todo-item-complete-check').click()
    await page.goto('/completed')
    const labels = await getTodoTexts(page)
    // Only the completed "Completed task" shows
    expect(labels).toHaveLength(1)
    expect(labels[0]).toBe('Completed task')
  })

  test('unknown route renders 404 Not Found page', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await expect(page.locator('h1')).toHaveText('Page Not Found')
  })
})

// ---------------------------------------------------------------------------
// Todo Creation
// ---------------------------------------------------------------------------

test.describe('Todo Creation', () => {
  test('typing text and pressing Enter adds a todo to the list', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Buy milk')
    const count = await getTodoCount(page)
    expect(count).toBe(1)
    const texts = await getTodoTexts(page)
    expect(texts).toContain('Buy milk')
  })

  test('new todo is prepended (appears at the top of the list)', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'First todo')
    await addTodo(page, 'Second todo')
    const texts = await getTodoTexts(page)
    // "Second todo" was added last and should be first (prepend behaviour)
    expect(texts[0]).toBe('Second todo')
    expect(texts[1]).toBe('First todo')
  })

  test('adding a todo increments the item count in the footer', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Task one')
    const countEl = page.locator('[data-cy="remaining-uncompleted-todo-count"]')
    await expect(countEl).toHaveText('1')
    await addTodo(page, 'Task two')
    await expect(countEl).toHaveText('2')
  })

  test('whitespace-only input does NOT create a todo', async ({ page }) => {
    await freshPage(page)
    const input = page.getByTestId('new-todo-input-text')
    await input.fill('   ')
    await input.press('Enter')
    // The TodoList/UnderBar are only rendered when todoList.length > 0
    const todoListVisible = await page.getByTestId('todo-list').isVisible().catch(() => false)
    expect(todoListVisible).toBe(false)
  })

  test('input field clears after a successful creation', async ({ page }) => {
    await freshPage(page)
    const input = page.getByTestId('new-todo-input-text')
    await input.fill('Clear me after submit')
    await input.press('Enter')
    await expect(input).toHaveValue('')
  })

  test('adding multiple todos creates all of them', async ({ page }) => {
    await freshPage(page)
    const items = ['Alpha', 'Beta', 'Gamma']
    await addTodos(page, items)
    const texts = await getTodoTexts(page)
    expect(texts).toHaveLength(3)
    for (const t of items) {
      expect(texts).toContain(t)
    }
  })
})

// ---------------------------------------------------------------------------
// Todo Deletion
// ---------------------------------------------------------------------------

test.describe('Todo Deletion', () => {
  test('clicking destroy button removes the todo from the list', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Delete me')
    const countBefore = await getTodoCount(page)
    expect(countBefore).toBe(1)

    // Hover to make destroy button visible (CSS :hover), then click
    const item = page.getByTestId('todo-item').first()
    await item.hover()
    await item.getByTestId('delete-todo-btn').click()

    const countAfter = await getTodoCount(page)
    expect(countAfter).toBe(0)
    const texts = await getTodoTexts(page)
    expect(texts).not.toContain('Delete me')
  })

  test('deleting a todo decrements the item count', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Keep me', 'Remove me'])
    const countEl = page.locator('[data-cy="remaining-uncompleted-todo-count"]')
    await expect(countEl).toHaveText('2')

    const items = page.getByTestId('todo-item')
    const first = items.first()
    await first.hover()
    await first.getByTestId('delete-todo-btn').click()

    await expect(countEl).toHaveText('1')
  })

  test('deleting the last todo hides the footer and list', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Only todo')
    const item = page.getByTestId('todo-item').first()
    await item.hover()
    await item.getByTestId('delete-todo-btn').click()

    // TodoList and UnderBar should be hidden when list is empty
    await expect(page.getByTestId('todo-list')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Todo Completion Toggle (Individual)
// ---------------------------------------------------------------------------

test.describe('Todo Completion Toggle', () => {
  test('clicking checkbox marks a todo as completed (gets completed CSS class)', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Mark me complete')
    const checkbox = page.getByTestId('todo-item-complete-check').first()
    expect(await checkbox.isChecked()).toBe(false)

    await checkbox.click()

    expect(await checkbox.isChecked()).toBe(true)
    // data-testid="todo-item" is on the <li> itself — check its class directly
    await expect(page.getByTestId('todo-item').first()).toHaveClass(/completed/)
  })

  test('clicking checkbox again un-completes a todo', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Toggle me')
    const checkbox = page.getByTestId('todo-item-complete-check').first()

    await checkbox.click() // complete
    expect(await checkbox.isChecked()).toBe(true)
    await checkbox.click() // incomplete
    expect(await checkbox.isChecked()).toBe(false)
    // data-testid="todo-item" is on the <li> itself — check its class directly
    await expect(page.getByTestId('todo-item').first()).not.toHaveClass(/completed/)
  })

  test('completing a todo decrements the remaining-count display', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Task A', 'Task B'])
    const countEl = page.locator('[data-cy="remaining-uncompleted-todo-count"]')
    await expect(countEl).toHaveText('2')

    await page.getByTestId('todo-item-complete-check').first().click()
    await expect(countEl).toHaveText('1')
  })

  test('completing all todos individually shows Clear completed button', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Single task')
    await page.getByTestId('todo-item-complete-check').first().click()

    await expect(page.locator('[data-cy="clear-completed-button"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Toggle All
// ---------------------------------------------------------------------------

test.describe('Toggle All', () => {
  test('toggle-all marks all todos as complete', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Task 1', 'Task 2', 'Task 3'])

    await page.getByTestId('toggle-all-btn').click()

    const checkboxes = page.getByTestId('todo-item-complete-check')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      expect(await checkboxes.nth(i).isChecked()).toBe(true)
    }
    // Remaining count should be 0
    const countEl = page.locator('[data-cy="remaining-uncompleted-todo-count"]')
    await expect(countEl).toHaveText('0')
  })

  test('unchecking toggle-all marks all todos as incomplete', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Task 1', 'Task 2'])

    const toggleAll = page.getByTestId('toggle-all-btn')
    await toggleAll.click() // mark all complete
    await toggleAll.click() // mark all incomplete

    const checkboxes = page.getByTestId('todo-item-complete-check')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      expect(await checkboxes.nth(i).isChecked()).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Todo Editing
// ---------------------------------------------------------------------------

test.describe('Todo Editing', () => {
  test('single click on label enters edit mode', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Editable item')
    // Click the label to enter edit mode
    await page.getByTestId('todo-body-text').first().click()
    // The edit input should be visible
    const editInput = page.getByTestId('todo-edit-input').first()
    await expect(editInput).toBeVisible()
    await expect(editInput).toBeFocused()
  })

  test('edit mode shows current text in the edit input', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Original text')
    await page.getByTestId('todo-body-text').first().click()
    const editInput = page.getByTestId('todo-edit-input').first()
    await expect(editInput).toHaveValue('Original text')
  })

  test('typing new text + Enter saves and updates the label', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Old text')
    await page.getByTestId('todo-body-text').first().click()

    const editInput = page.getByTestId('todo-edit-input').first()
    await editInput.fill('New text')
    await editInput.press('Enter')

    // Edit mode should close; label should show updated text
    const labels = await getTodoTexts(page)
    expect(labels).toContain('New text')
    expect(labels).not.toContain('Old text')
  })

  test('pressing Escape in edit mode closes edit without losing a valid value', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Escape test')
    await page.getByTestId('todo-body-text').first().click()

    const editInput = page.getByTestId('todo-edit-input').first()
    await editInput.fill('Escape test updated')
    await editInput.press('Escape')

    // After Escape, the item's text is the updated value (the input already has it)
    const labels = await getTodoTexts(page)
    expect(labels).toContain('Escape test updated')
  })

  test('blurring edit input with valid text saves the edit', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Blur save')
    await page.getByTestId('todo-body-text').first().click()

    const editInput = page.getByTestId('todo-edit-input').first()
    await editInput.fill('Blur saved text')
    // Click elsewhere to blur
    await page.locator('h1').click()

    const labels = await getTodoTexts(page)
    expect(labels).toContain('Blur saved text')
  })

  test('blurring edit input with empty text deletes the todo', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Keep me', 'Delete via blank edit'])
    const countBefore = await getTodoCount(page)
    expect(countBefore).toBe(2)

    // Click to edit the first item (newest = "Delete via blank edit")
    await page.getByTestId('todo-body-text').first().click()
    const editInput = page.getByTestId('todo-edit-input').first()
    await editInput.fill('')
    await page.locator('h1').click()

    const texts = await getTodoTexts(page)
    expect(texts).not.toContain('Delete via blank edit')
    expect(texts).toContain('Keep me')
    expect(await getTodoCount(page)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Footer / Filters
// ---------------------------------------------------------------------------

test.describe('Footer and Filters', () => {
  test('footer shows correct item count when todos exist', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Item A', 'Item B', 'Item C'])
    const countEl = page.locator('[data-cy="remaining-uncompleted-todo-count"]')
    await expect(countEl).toHaveText('3')
  })

  test('All filter link navigates to / and shows all todos', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Todo 1', 'Todo 2'])
    // Complete one
    await page.getByTestId('todo-item-complete-check').first().click()
    // Go to completed first
    await page.goto('/completed')
    // Then click All
    await page.locator('[data-cy="all-filter"]').click()
    await expect(page).toHaveURL('/')
    expect(await getTodoCount(page)).toBe(2)
  })

  test('Active filter link navigates to /active and hides completed todos', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Active todo', 'Completed todo'])
    // Complete the first item (newest = "Completed todo" due to prepend)
    await page.getByTestId('todo-item-complete-check').first().click()
    // Click Active filter
    await page.locator('[data-cy="active-filter"]').click()
    await expect(page).toHaveURL('/active')
    const texts = await getTodoTexts(page)
    expect(texts).toContain('Active todo')
    expect(texts).not.toContain('Completed todo')
  })

  test('Completed filter link navigates to /completed and hides active todos', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Active todo', 'Completed todo'])
    // Complete the first item (newest = "Completed todo")
    await page.getByTestId('todo-item-complete-check').first().click()
    // Click Completed filter
    await page.locator('[data-cy="completed-filter"]').click()
    await expect(page).toHaveURL('/completed')
    const texts = await getTodoTexts(page)
    expect(texts).toContain('Completed todo')
    expect(texts).not.toContain('Active todo')
  })

  test('selected filter link has "selected" class', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Any todo')
    // Active filter
    await page.locator('[data-cy="active-filter"]').click()
    await expect(page.locator('[data-cy="active-filter"]')).toHaveClass(/selected/)
    await expect(page.locator('[data-cy="all-filter"]')).not.toHaveClass(/selected/)
  })

  test('Clear completed button is hidden when no todos are completed', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Incomplete task')
    const clearBtn = page.locator('[data-cy="clear-completed-button"]')
    await expect(clearBtn).not.toBeVisible()
  })

  test('Clear completed button appears when at least one todo is completed', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Complete this')
    await page.getByTestId('todo-item-complete-check').first().click()
    await expect(page.locator('[data-cy="clear-completed-button"]')).toBeVisible()
  })

  test('Clear completed button removes all completed todos', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Keep active', 'Clear me 1', 'Clear me 2'])
    // Complete the first two (newest two)
    const checkboxes = page.getByTestId('todo-item-complete-check')
    await checkboxes.nth(0).click()
    await checkboxes.nth(1).click()

    const countBefore = await getTodoCount(page)
    expect(countBefore).toBe(3)

    await page.locator('[data-cy="clear-completed-button"]').click()

    const texts = await getTodoTexts(page)
    expect(texts).toHaveLength(1)
    expect(texts).toContain('Keep active')
    expect(texts).not.toContain('Clear me 1')
    expect(texts).not.toContain('Clear me 2')
  })

  test('footer disappears when all todos are deleted', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Solo task')
    await page.getByTestId('todo-item-complete-check').first().click()
    await page.locator('[data-cy="clear-completed-button"]').click()
    // Footer should not be visible when list is empty
    await expect(page.locator('.footer')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Persistence (LocalStorage)
// ---------------------------------------------------------------------------

test.describe('Persistence', () => {
  test('todos survive a page reload', async ({ page }) => {
    await freshPage(page)
    await addTodos(page, ['Persistent A', 'Persistent B'])

    // Reload
    await page.reload()

    const texts = await getTodoTexts(page)
    expect(texts).toContain('Persistent A')
    expect(texts).toContain('Persistent B')
  })

  test('completed state survives a page reload', async ({ page }) => {
    await freshPage(page)
    await addTodo(page, 'Complete and reload')
    await page.getByTestId('todo-item-complete-check').first().click()

    await page.reload()

    const checkbox = page.getByTestId('todo-item-complete-check').first()
    expect(await checkbox.isChecked()).toBe(true)
    // data-testid="todo-item" is on the <li> itself — check its class directly
    await expect(page.getByTestId('todo-item').first()).toHaveClass(/completed/)
  })
})

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

test.describe('Empty State', () => {
  test('fresh page has no todo items, no footer, no list', async ({ page }) => {
    await freshPage(page)
    // Should not see a footer or list
    await expect(page.locator('.footer')).not.toBeVisible()
    await expect(page.getByTestId('todo-list')).not.toBeVisible()
  })

  test('header and input are always visible even with empty list', async ({ page }) => {
    await freshPage(page)
    await expect(page.locator('h1')).toHaveText('todos')
    await expect(page.getByTestId('new-todo-input-text')).toBeVisible()
  })
})
