/**
 * ZapOut E2E Tests
 * Playwright-based end-to-end tests for the frontend
 */

const { test, expect } = require('@playwright/test');

test.describe('ZapOut E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
  });

  test('homepage loads', async ({ page }) => {
    await expect(page).toHaveTitle(/ZapOut/i);
    await expect(page.locator('text=ZapOut')).toBeVisible();
    await expect(page.locator('text=Bitcoin Payments')).toBeVisible();
  });

  test('registration form visible', async ({ page }) => {
    await expect(page.locator('text=Registrieren')).toBeVisible();
    await expect(page.locator('input[placeholder="E-Mail"]')).toBeVisible();
  });

  test('can switch between screens', async ({ page }) => {
    // Go to login
    await page.click('text=Login');
    await expect(page.locator('h2:has-text("Login")')).toBeVisible();
  });

  test('unauthenticated cannot access payments', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page.locator('text=Registrieren')).toBeVisible();
  });
});

test.describe('ZapOut API Integration', () => {
  test('backend health check', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('can register user via API', async ({ request }) => {
    const uniqueEmail = `apitest-${Date.now()}@example.com`;
    const response = await request.post('http://localhost:8000/auth/register', {
      data: {
        email: uniqueEmail,
        password: 'testpass123',
      },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.token).toBeDefined();
  });

  test('can login after registration', async ({ request }) => {
    const uniqueEmail = `logintest-${Date.now()}@example.com`;

    // Register
    await request.post('http://localhost:8000/auth/register', {
      data: { email: uniqueEmail, password: 'mypassword' },
    });

    // Login
    const loginRes = await request.post('http://localhost:8000/auth/login', {
      data: { email: uniqueEmail, password: 'mypassword' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const data = await loginRes.json();
    expect(data.token).toBeDefined();
  });

  test('rate limiting works', async ({ request }) => {
    // Try to login with wrong password 5 times
    for (let i = 0; i < 5; i++) {
      await request.post('http://localhost:8000/auth/login', {
        data: { email: 'ratelimit@test.com', password: 'wrong' },
      });
    }

    // 6th attempt should be blocked
    const response = await request.post('http://localhost:8000/auth/login', {
      data: { email: 'ratelimit@test.com', password: 'wrong' },
    });
    expect(response.status()).toBe(429);
  });
});
