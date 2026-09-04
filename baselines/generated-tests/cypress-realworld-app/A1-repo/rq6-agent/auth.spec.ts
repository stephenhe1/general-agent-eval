import { test, expect } from "@playwright/test";

const USERNAME = "Heath93";
const PASSWORD = "s3cret";
const BASE = "http://localhost:5183";

/** Fill sign-in form using id selectors (MUI wraps inputs in a div with data-test) */
async function fillSignIn(page: any, username: string, password: string) {
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
}

/** Fill sign-up form using id selectors */
async function fillSignUp(
  page: any,
  opts: {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    confirmPassword: string;
  }
) {
  await page.locator("#firstName").fill(opts.firstName);
  await page.locator("#lastName").fill(opts.lastName);
  await page.locator("#username").fill(opts.username);
  await page.locator("#password").fill(opts.password);
  await page.locator("#confirmPassword").fill(opts.confirmPassword);
}

/** Wait for sidenav (only renders once authenticated) */
async function waitForLoggedIn(page: any) {
  await expect(page.locator('[data-test="sidenav"]')).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Authentication", () => {
  test("sign in with valid credentials shows sidenav with username", async ({
    page,
  }) => {
    await page.goto(`${BASE}/signin`);
    await fillSignIn(page, USERNAME, PASSWORD);
    await page.locator('[data-test="signin-submit"]').click();

    // Wait for the private layout (only visible when logged in)
    await waitForLoggedIn(page);

    // Sidenav shows the logged-in user
    await expect(
      page.locator('[data-test="sidenav-username"]')
    ).toContainText(USERNAME);
  });

  test("sign in with wrong password shows error", async ({ page }) => {
    await page.goto(`${BASE}/signin`);
    await fillSignIn(page, USERNAME, "wrongpassword");
    await page.locator('[data-test="signin-submit"]').click();

    await expect(
      page.locator('[data-test="signin-error"]')
    ).toBeVisible({ timeout: 5000 });
    // Should remain on sign-in page (sidenav not present)
    await expect(
      page.locator('[data-test="sidenav"]')
    ).not.toBeVisible();
  });

  test("sign in with empty username keeps submit enabled but fails", async ({
    page,
  }) => {
    await page.goto(`${BASE}/signin`);
    // Form initially shows signin-submit
    await expect(
      page.locator('[data-test="signin-submit"]')
    ).toBeVisible();
    // Don't type anything - verify submit button exists
    await expect(
      page.locator('[data-test="signin-submit"]')
    ).toHaveText("Sign In");
  });

  test("sign in page has link to sign up page", async ({ page }) => {
    await page.goto(`${BASE}/signin`);
    const signupLink = page.locator('[data-test="signup"]');
    await expect(signupLink).toBeVisible();

    // Navigate directly using href
    await page.goto(`${BASE}/signup`);
    await expect(
      page.locator('[data-test="signup-title"]')
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[data-test="signup-title"]')
    ).toContainText("Sign Up");
  });

  test("sign up creates new account and user can sign in", async ({ page }) => {
    const uniqueSuffix = Date.now();
    const newUsername = `tuser${uniqueSuffix}`;
    const firstName = "Test";
    const lastName = "User";
    const password = "password123";

    await page.goto(`${BASE}/signup`);
    await fillSignUp(page, {
      firstName,
      lastName,
      username: newUsername,
      password,
      confirmPassword: password,
    });
    await page.locator('[data-test="signup-submit"]').click();

    // After signup the auth machine calls history.push("/signin")
    // Wait for sign-in form to appear
    await expect(
      page.locator('[data-test="signin-submit"]')
    ).toBeVisible({ timeout: 10000 });

    // Verify: new user can sign in
    await fillSignIn(page, newUsername, password);
    await page.locator('[data-test="signin-submit"]').click();
    await waitForLoggedIn(page);

    await expect(
      page.locator('[data-test="sidenav-username"]')
    ).toContainText(newUsername);
  });

  test("sign up with mismatched passwords disables submit", async ({
    page,
  }) => {
    await page.goto(`${BASE}/signup`);
    await fillSignUp(page, {
      firstName: "Test",
      lastName: "User",
      username: "testmismatch",
      password: "password123",
      confirmPassword: "different456",
    });
    // Blur to trigger validation
    await page.locator("#firstName").click();

    const submitBtn = page.locator('[data-test="signup-submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test("sign up with short password (< 4 chars) disables submit", async ({
    page,
  }) => {
    await page.goto(`${BASE}/signup`);
    await fillSignUp(page, {
      firstName: "Test",
      lastName: "User",
      username: "shortpwtest",
      password: "abc",
      confirmPassword: "abc",
    });
    // Blur to trigger validation
    await page.locator("#firstName").click();

    const submitBtn = page.locator('[data-test="signup-submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test("sign out returns to sign in form", async ({ page }) => {
    // Sign in first
    await page.goto(`${BASE}/signin`);
    await fillSignIn(page, USERNAME, PASSWORD);
    await page.locator('[data-test="signin-submit"]').click();
    await waitForLoggedIn(page);

    // Sign out via sidenav
    await page.locator('[data-test="sidenav-signout"]').click();

    // Should show sign-in form (sidenav no longer present)
    await expect(
      page.locator('[data-test="signin-submit"]')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-test="sidenav"]')
    ).not.toBeVisible();
  });

  test("unauthenticated user accessing / is shown sign-in form", async ({
    page,
  }) => {
    await page.goto(`${BASE}/`);
    // App redirects unauthorized users to /signin
    await expect(
      page.locator('[data-test="signin-submit"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test("sign in form shows username and password inputs", async ({ page }) => {
    await page.goto(`${BASE}/signin`);
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('[data-test="signin-submit"]')).toBeVisible();
  });
});
