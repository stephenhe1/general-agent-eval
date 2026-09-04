import { test, expect } from '@playwright/test'
import { loginAsKody, KODY_USERNAME } from './helpers'

test.describe('Settings / Profile (authenticated)', () => {
	test.slow() // Login and profile operations can be slow

	test.beforeEach(async ({ page }) => {
		await loginAsKody(page)
	})

	test('profile settings page loads and shows current user info', async ({
		page,
	}) => {
		await page.goto('/settings/profile')
		await expect(page).toHaveURL(/\/settings\/profile/)
		// Should show the username
		await expect(page.locator('input[name="username"]')).toHaveValue(
			KODY_USERNAME,
		)
	})

	test('profile settings shows current email', async ({ page }) => {
		await page.goto('/settings/profile')
		await expect(page.locator('body')).toContainText(/kody@kcd\.dev/)
	})

	test('profile settings has navigation links to sub-settings', async ({
		page,
	}) => {
		await page.goto('/settings/profile')
		await expect(page.getByRole('link', { name: /photo/i })).toBeVisible()
		await expect(page.getByRole('link', { name: /password/i })).toBeVisible()
	})

	test('update profile name and verify change persists', async ({ page }) => {
		await page.goto('/settings/profile')
		const nameInput = page.locator('input[name="name"]')
		await expect(nameInput).toBeVisible()

		const testName = `KodyTest-${Date.now()}`

		await nameInput.clear()
		await nameInput.fill(testName)

		// Use Promise.all to start listening for the POST BEFORE clicking, so we
		// don't miss a fast response. The fetcher.Form POSTs to /settings/profile.
		await Promise.all([
			page.waitForResponse(
				(r) =>
					r.request().method() === 'POST' &&
					r.url().includes('/settings/profile'),
			),
			page.getByRole('button', { name: /save changes/i }).click(),
		])

		// Wait for React Router to revalidate loaders after the action
		await page.waitForLoadState('networkidle')

		// Navigate fresh to the public profile page to confirm the new name is in DB
		// (the loader re-fetches user from Prisma on each GET request)
		await page.goto(`/users/${KODY_USERNAME}`)
		await page.waitForLoadState('networkidle')
		await expect(
			page.getByRole('heading', { name: testName }),
		).toBeVisible({ timeout: 10000 })

		// Restore original name "Kody"
		await page.goto('/settings/profile')
		await page.waitForLoadState('networkidle')
		await Promise.all([
			page.waitForResponse(
				(r) =>
					r.request().method() === 'POST' &&
					r.url().includes('/settings/profile'),
			),
			(async () => {
				await page.locator('input[name="name"]').clear()
				await page.locator('input[name="name"]').fill('Kody')
				await page.getByRole('button', { name: /save changes/i }).click()
			})(),
		])
		await page.waitForLoadState('networkidle')
	})

	test('profile photo page loads with file upload input', async ({ page }) => {
		await page.goto('/settings/profile/photo')
		await expect(page).toHaveURL(/\/settings\/profile\/photo/)
		await expect(page.locator('input[type="file"]')).toBeVisible()
	})

	test('password settings page shows change password form', async ({
		page,
	}) => {
		await page.goto('/settings/profile/password')
		await expect(page).toHaveURL(/\/settings\/profile\/password/)
		await expect(
			page.locator('input[name="currentPassword"]'),
		).toBeVisible()
		await expect(page.locator('input[name="newPassword"]')).toBeVisible()
	})

	test('two-factor authentication page loads', async ({ page }) => {
		await page.goto('/settings/profile/two-factor')
		await expect(page).toHaveURL(/\/settings\/profile\/two-factor/)
		await expect(page.locator('body')).toContainText(/two.factor|2FA/i)
	})

	test('2FA page shows enable 2FA option when not enabled', async ({
		page,
	}) => {
		await page.goto('/settings/profile/two-factor')
		await expect(page.locator('body')).toContainText(/Enable 2FA|not enabled/i)
	})

	test('connections page loads', async ({ page }) => {
		await page.goto('/settings/profile/connections')
		await expect(page).toHaveURL(/\/settings\/profile\/connections/)
		await expect(page.locator('body')).toBeVisible()
	})

	test('passkeys management page loads', async ({ page }) => {
		await page.goto('/settings/profile/passkeys')
		await expect(page).toHaveURL(/\/settings\/profile\/passkeys/)
		await expect(page.locator('body')).toBeVisible()
	})

	test('change email page requires recent verification', async ({ page }) => {
		await page.goto('/settings/profile/change-email')
		// Either shows the form or redirects to /verify for recent verification check
		const url = page.url()
		expect(
			url.includes('/settings/profile/change-email') ||
				url.includes('/verify'),
		).toBeTruthy()
	})
})

test.describe('Settings - unauthenticated redirects', () => {
	test('profile page redirects to login when not authenticated', async ({
		page,
	}) => {
		await page.goto('/settings/profile')
		await expect(page).toHaveURL(/\/login/)
	})

	test('photo page redirects to login when not authenticated', async ({
		page,
	}) => {
		await page.goto('/settings/profile/photo')
		await expect(page).toHaveURL(/\/login/)
	})

	test('password page redirects to login when not authenticated', async ({
		page,
	}) => {
		await page.goto('/settings/profile/password')
		await expect(page).toHaveURL(/\/login/)
	})

	test('2FA page redirects to login when not authenticated', async ({
		page,
	}) => {
		await page.goto('/settings/profile/two-factor')
		await expect(page).toHaveURL(/\/login/)
	})
})
