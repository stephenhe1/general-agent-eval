import { test, expect } from '@playwright/test'
import { loginAsKody, KODY_USERNAME } from './helpers'

// Known note IDs from seed data
const KNOWN_NOTE_ID = 'd27a197e' // "Basic Koala Facts"
const KNOWN_NOTE_TITLE = 'Basic Koala Facts'

test.describe('User Directory', () => {
	test('users page shows Epic Notes Users heading', async ({ page }) => {
		await page.goto('/users')
		await expect(page.getByRole('heading', { name: 'Epic Notes Users' })).toBeVisible()
	})

	test('users page shows list of users including kody', async ({ page }) => {
		await page.goto('/users')
		// Should show kody in the user list
		await expect(
			page.getByRole('link', { name: /kody/i }),
		).toBeVisible()
	})

	test('user search returns matching users', async ({ page }) => {
		await page.goto('/users')
		const searchInput = page.locator('input[name="search"]').first()
		await searchInput.fill('kody')
		await page.getByRole('button', { name: 'Search' }).first().click()
		await page.waitForLoadState('networkidle')
		await expect(page.getByRole('link', { name: /kody/i })).toBeVisible()
	})

	test('user search returns no results for nonsense query', async ({ page }) => {
		await page.goto('/users')
		const searchInput = page.locator('input[name="search"]').first()
		await searchInput.fill('zzzznotauserxxxxxx9999')
		await page.getByRole('button', { name: 'Search' }).first().click()
		await page.waitForLoadState('networkidle')
		// The heading should still be present but no user links
		await expect(page.getByRole('heading', { name: 'Epic Notes Users' })).toBeVisible()
		const kodyLink = page.getByRole('link', { name: /kody/i })
		await expect(kodyLink).not.toBeVisible()
	})

	test('clicking user link navigates to user profile', async ({ page }) => {
		await page.goto('/users')
		await page.getByRole('link', { name: /kody/i }).first().click()
		await expect(page).toHaveURL(/\/users\/kody/)
	})

	test('user profile page shows username and profile content', async ({
		page,
	}) => {
		await page.goto('/users/kody')
		await expect(page.locator('body')).toContainText('Kody')
		// Has link to notes - use first() to handle multiple matches
		await expect(
			page.getByRole('link', { name: /kody.*notes|notes/i }).first(),
		).toBeVisible()
	})

	test('user profile page notes link navigates to notes', async ({ page }) => {
		await page.goto('/users/kody')
		// Use href-based selector to be resilient to display-name changes made by
		// the settings tests running in parallel on the shared kody account.
		await page.locator('a[href="/users/kody/notes"]').click()
		await expect(page).toHaveURL(/\/users\/kody\/notes/)
	})

	test('user notes page shows list of notes', async ({ page }) => {
		await page.goto('/users/kody/notes')
		// Seed data has these notes
		await expect(
			page.getByRole('link', { name: KNOWN_NOTE_TITLE }),
		).toBeVisible()
	})

	test('clicking a note shows note title and content', async ({ page }) => {
		await page.goto('/users/kody/notes')
		await page.getByRole('link', { name: KNOWN_NOTE_TITLE }).click()
		await expect(page).toHaveURL(
			new RegExp(`/users/kody/notes/${KNOWN_NOTE_ID}`),
		)
		// Note heading should be visible
		await expect(
			page.getByRole('heading', { name: KNOWN_NOTE_TITLE }),
		).toBeVisible()
	})

	test('note page shows content without auth', async ({ page }) => {
		await page.goto(`/users/kody/notes/${KNOWN_NOTE_ID}`)
		await expect(
			page.getByRole('heading', { name: KNOWN_NOTE_TITLE }),
		).toBeVisible()
		await expect(page.locator('body')).toContainText(/eucalyptus/i)
	})

	test('note page does NOT show edit button when unauthenticated', async ({
		page,
	}) => {
		await page.goto(`/users/kody/notes/${KNOWN_NOTE_ID}`)
		await page.waitForLoadState('networkidle')
		await expect(page.getByRole('link', { name: /edit/i })).not.toBeVisible()
	})

	test('note page shows edit button when authenticated as owner', async ({
		page,
	}) => {
		test.slow()
		await loginAsKody(page)
		await page.goto(`/users/kody/notes/${KNOWN_NOTE_ID}`)
		await expect(page.getByRole('link', { name: /edit/i })).toBeVisible()
	})

	test('non-existent note shows 404 error', async ({ page }) => {
		await page.goto('/users/kody/notes/nonexistent-note-id-xyz')
		await expect(page.locator('body')).toContainText(
			/no note with the id|not found/i,
		)
	})

	test('non-existent user shows 404 error', async ({ page }) => {
		await page.goto('/users/nonexistentuser12345xyz')
		await expect(page.locator('body')).toContainText(
			/not found|no user|does not exist/i,
		)
	})
})

test.describe('Notes Management (authenticated as kody)', () => {
	test.slow() // These tests involve login which can be slow

	test.beforeEach(async ({ page }) => {
		await loginAsKody(page)
	})

	test('new note page shows title, content and submit button', async ({
		page,
	}) => {
		await page.goto(`/users/${KODY_USERNAME}/notes/new`)
		await expect(page.locator('input[name="title"]')).toBeVisible()
		await expect(page.locator('textarea[name="content"]')).toBeVisible()
		await expect(page.getByRole('button', { name: /submit/i })).toBeVisible()
	})

	test('create a new note and verify it appears in notes list', async ({
		page,
	}) => {
		const uniqueTitle = `Test Note ${Date.now()}`
		const noteContent = 'This is e2e test note content'

		await page.goto(`/users/${KODY_USERNAME}/notes/new`)
		await page.locator('input[name="title"]').fill(uniqueTitle)
		await page.locator('textarea[name="content"]').fill(noteContent)
		await page.getByRole('button', { name: /submit/i }).click()

		// Should redirect to the new note's view page
		await expect(page).toHaveURL(/\/users\/kody\/notes\/[a-zA-Z0-9]+$/)
		// The note heading should show the correct title
		await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible()

		// Navigate to notes list and verify it appears there
		await page.goto(`/users/${KODY_USERNAME}/notes`)
		await expect(page.getByRole('link', { name: uniqueTitle })).toBeVisible()
	})

	test('edit a note and verify the update is saved', async ({ page }) => {
		const originalTitle = `OriginalTitle-${Date.now()}`
		const updatedTitle = `UpdatedTitle-${Date.now()}`

		// Create a note first
		await page.goto(`/users/${KODY_USERNAME}/notes/new`)
		await page.locator('input[name="title"]').fill(originalTitle)
		await page.locator('textarea[name="content"]').fill('Original content')
		await page.getByRole('button', { name: /submit/i }).click()
		await expect(page).toHaveURL(/\/users\/kody\/notes\/[a-zA-Z0-9]+$/)

		// Edit the note
		await page.getByRole('link', { name: /edit/i }).click()
		await expect(page).toHaveURL(/\/edit$/)

		const titleInput = page.locator('input[name="title"]')
		await titleInput.clear()
		await titleInput.fill(updatedTitle)
		await page.getByRole('button', { name: /submit/i }).click()

		// Should redirect back to the note view with updated title
		await expect(page).toHaveURL(/\/users\/kody\/notes\/[a-zA-Z0-9]+$/)
		await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
	})

	test('delete a note and verify it is removed from notes list', async ({
		page,
	}) => {
		const noteTitle = `DeleteTest-${Date.now()}`

		// Create a note to delete
		await page.goto(`/users/${KODY_USERNAME}/notes/new`)
		await page.locator('input[name="title"]').fill(noteTitle)
		await page.locator('textarea[name="content"]').fill('Content to be deleted')
		await page.getByRole('button', { name: /submit/i }).click()
		await expect(page).toHaveURL(/\/users\/kody\/notes\/[a-zA-Z0-9]+$/)

		// Delete the note
		await page.getByRole('button', { name: /delete/i }).click()

		// Should redirect to notes list
		await expect(page).toHaveURL(/\/users\/kody\/notes$/)

		// The deleted note should no longer be in the list
		await expect(page.getByRole('link', { name: noteTitle })).not.toBeVisible()
	})

	test('new note form shows error for empty title', async ({ page }) => {
		await page.goto(`/users/${KODY_USERNAME}/notes/new`)
		// Leave title empty, fill content
		await page.locator('textarea[name="content"]').fill('Some content')
		await page.getByRole('button', { name: /submit/i }).click()
		// Should NOT redirect to a note ID - URL stays at /new or shows error
		await expect(page).not.toHaveURL(/\/notes\/[a-zA-Z0-9]{8}$/)
	})

	test('notes list has New Note link', async ({ page }) => {
		await page.goto(`/users/${KODY_USERNAME}/notes`)
		const newNoteLink = page.getByRole('link', { name: /new note/i })
		await expect(newNoteLink).toBeVisible()
		await newNoteLink.click()
		await expect(page).toHaveURL(/\/notes\/new$/)
	})

	test('unauthenticated access to new note redirects to login', async ({
		browser,
	}) => {
		// Use a completely fresh browser context (no session)
		const freshContext = await browser.newContext()
		const freshPage = await freshContext.newPage()
		await freshPage.goto(`/users/${KODY_USERNAME}/notes/new`)
		await expect(freshPage).toHaveURL(/\/login/)
		await freshContext.close()
	})
})
