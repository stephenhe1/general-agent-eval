import { test, expect } from '@playwright/test'
import { loginAs, loginAsKody, KODY_USERNAME, KODY_PASSWORD } from './helpers'

test.describe('Authentication', () => {
	test('login page renders form correctly', async ({ page }) => {
		await page.goto('/login')
		await expect(page).toHaveTitle(/Epic Notes/)
		await expect(
			page.getByRole('heading', { name: 'Welcome back!' }),
		).toBeVisible()
		await expect(page.locator('#login-form-username')).toBeVisible()
		await expect(page.locator('#login-form-password')).toBeVisible()
		await expect(
			page.locator('button[type="submit"]').filter({ hasText: 'Log in' }),
		).toBeVisible()
	})

	test('login with valid credentials shows user menu', async ({ page }) => {
		test.slow()
		await loginAsKody(page)
		// After login, user menu should be visible (no longer on /login)
		await expect(page).not.toHaveURL(/\/login/)
		await page.waitForLoadState('networkidle')
		await expect(page.getByRole('link', { name: 'User menu' })).toBeVisible()
	})

	test('login shows error with invalid credentials', async ({ page }) => {
		await page.goto('/login')
		await page.locator('#login-form-username').fill('invaliduser123')
		await page.locator('#login-form-password').fill('wrongpassword')
		await page
			.locator('button[type="submit"]')
			.filter({ hasText: 'Log in' })
			.click()
		// Should stay on login and show error message
		await expect(page).toHaveURL(/\/login/)
		await expect(page.locator('body')).toContainText(
			/Invalid username or password/i,
		)
	})

	test('logout clears session and returns to public state', async ({ page }) => {
		test.slow()
		await loginAsKody(page)
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		// User menu should be visible
		await expect(page.getByRole('link', { name: 'User menu' })).toBeVisible()

		// Open user dropdown and click Logout
		await page.getByRole('link', { name: 'User menu' }).click()
		await page.getByRole('menuitem', { name: /Logout/i }).click()

		// After logout, Log In link should appear
		await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible()
	})

	test('signup page renders email field', async ({ page }) => {
		await page.goto('/signup')
		await expect(page).toHaveTitle(/Epic Notes/)
		await expect(page.locator('input[name="email"]')).toBeVisible()
	})

	test('forgot password page renders correctly', async ({ page }) => {
		await page.goto('/forgot-password')
		await expect(page).toHaveTitle(/Epic Notes/)
		await expect(
			page.locator('input[name="usernameOrEmail"]'),
		).toBeVisible()
		await expect(
			page.getByRole('button', { name: /recover/i }),
		).toBeVisible()
	})

	test('forgot password accepts submission without crashing', async ({
		page,
	}) => {
		await page.goto('/forgot-password')
		await page
			.locator('input[name="usernameOrEmail"]')
			.fill('nonexistent@example.com')
		await page.getByRole('button', { name: /recover/i }).click()
		await page.waitForLoadState('networkidle')
		// Should show some response (page stays accessible)
		await expect(page.locator('body')).toBeVisible()
	})

	test('login page has forgot password link', async ({ page }) => {
		await page.goto('/login')
		await expect(
			page.getByRole('link', { name: /forgot.*password/i }),
		).toBeVisible()
	})

	test('login page has Create an account link to signup', async ({ page }) => {
		await page.goto('/login')
		const createAccountLink = page.getByRole('link', {
			name: /Create an account/i,
		})
		await expect(createAccountLink).toBeVisible()
		await createAccountLink.click()
		await expect(page).toHaveURL(/\/signup/)
	})

	test('login with redirectTo redirects to the requested page', async ({
		page,
	}) => {
		test.slow()
		await page.goto('/login?redirectTo=/users/kody')
		await page.locator('#login-form-username').fill(KODY_USERNAME)
		await page.locator('#login-form-password').fill(KODY_PASSWORD)
		await page
			.locator('button[type="submit"]')
			.filter({ hasText: 'Log in' })
			.click()
		await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 })
		await expect(page).toHaveURL(/\/users\/kody/)
	})

	test('protected routes redirect to login when unauthenticated', async ({
		page,
	}) => {
		await page.goto('/settings/profile')
		await expect(page).toHaveURL(/\/login/)
	})

	test('/me redirects to own profile when logged in', async ({ page }) => {
		test.slow()
		await loginAsKody(page)
		await page.goto('/me')
		await expect(page).toHaveURL(new RegExp(`/users/${KODY_USERNAME}`))
	})
})
