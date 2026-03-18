import { test as base, expect } from '@playwright/test';

const test = base.extend({
  loggedInPage: async ({ page, baseURL }, use) => {
    // Direct API login, then page load
    await page.goto(baseURL);
    const response = await page.request.post(`${baseURL.replace(':3000', ':8000')}/auth/login`, {
      data: { email: 'test2@cafe.de', password: 'test123' },
    });
    if (response.ok()) {
      const data = await response.json();
      await page.evaluate(
        ({ token }) => {
          localStorage.setItem('zapout_token', token);
        },
        { token: data.token }
      );
    }
    await page.goto(baseURL);
    await page.waitForTimeout(2000);
    await use(page);
  },
});

export { test, expect };
