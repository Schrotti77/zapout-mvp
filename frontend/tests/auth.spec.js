import { test, expect, selectors } from './helpers';

test.describe('Authentication', () => {
  test('should show login screen by default', async ({ page }) => {
    await page.goto('/');

    // Should show login form
    await expect(page.locator('h2:has-text("Anmelden")')).toBeVisible();
    await expect(page.locator(selectors.emailInput)).toBeVisible();
    await expect(page.locator(selectors.passwordInput)).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill login form
    await page.locator(selectors.emailInput).fill('test2@cafe.de');
    await page.locator(selectors.passwordInput).fill('test123');
    await page.locator(selectors.submitButton).click();

    // Should redirect to dashboard
    await expect(page.locator('h1:has-text("ZapOut")')).toBeVisible({ timeout: 5000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill login form with wrong password
    await page.locator(selectors.emailInput).fill('test2@cafe.de');
    await page.locator(selectors.passwordInput).fill('wrongpassword');
    await page.locator(selectors.submitButton).click();

    // Should show error message
    await expect(page.locator('text=/Fehler|Ungültig|Invalid/i')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to register screen', async ({ page }) => {
    await page.goto('/');

    // Click register link
    await page.locator('text=Noch kein Konto? Registrieren').click();

    // Should show register form
    await expect(page.locator('h2:has-text("Registrieren")')).toBeVisible();
  });

  test('should register new user', async ({ page, baseURL }) => {
    await page.goto('/');

    // Navigate to register
    await page.locator('text=Noch kein Konto? Registrieren').click();

    // Fill register form with unique email
    const timestamp = Date.now();
    await page.locator(selectors.emailInput).fill(`playwright-${timestamp}@test.de`);
    await page.locator('input[placeholder*="Passwort"]').fill('Test123456');
    await page.locator('input[placeholder*="Wiederholen"]').fill('Test123456');
    await page.locator(selectors.submitButton).click();

    // Should login after registration
    await expect(page.locator('h1:has-text("ZapOut")')).toBeVisible({ timeout: 5000 });
  });

  test('should logout', async ({ page, loggedInPage }) => {
    await page.goto('/');

    // Navigate to settings
    await loggedInPage.locator(selectors.navSettings).click();

    // Click logout
    await page.locator(selectors.logoutButton).click();

    // Should show login screen
    await expect(page.locator('h2:has-text("Anmelden")')).toBeVisible({ timeout: 5000 });
  });
});
