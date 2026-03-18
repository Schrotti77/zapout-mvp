import { test, expect } from '@playwright/test';

test.describe('Auth API', () => {
  test('should login successfully', async ({ page, baseURL }) => {
    const response = await page.request.post(`${baseURL.replace(':3000', ':8000')}/auth/login`, {
      data: { email: 'test2@cafe.de', password: 'test123' },
    });
    if (response.status() === 429) {
      test.skip();
    }
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.token).toBeTruthy();
  });

  test('should reject invalid credentials', async ({ page, baseURL }) => {
    const response = await page.request.post(`${baseURL.replace(':3000', ':8000')}/auth/login`, {
      data: { email: 'invalid@test.de', password: 'wrong' },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
