import { test as base } from '@playwright/test';

// Helper to login via API
export const test = base.extend({
  loggedInPage: async ({ page, baseURL }, use) => {
    // Login via API
    const response = await page.request.post(`${baseURL.replace(':3000', ':8000')}/auth/login`, {
      data: {
        email: 'test2@cafe.de',
        password: 'test123',
      },
    });

    if (response.ok()) {
      const data = await response.json();
      await page.goto(baseURL);
      await page.evaluate(token => {
        localStorage.setItem('zapout_token', token);
      }, data.token);
    }

    await use(page);
  },
});

// Common selectors
export const selectors = {
  // Navigation
  navHome: 'button:has-text("Home")',
  navCashu: 'button:has-text("Cashu")',
  navMerchant: 'button:has-text("Merchant")',
  navSettings: 'button:has-text("Settings")',
  navCart: 'button:has-text("Cart")',

  // Auth
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',
  logoutButton: 'button:has-text("Logout")',

  // Dashboard
  amountInput: 'input[placeholder*="Betrag"]',
  payButton: 'button:has-text("Zahlen")',

  // Cashu
  cashuMintButton: 'button:has-text("Generieren")',
  cashuTokenInput: 'textarea[placeholder*="Token"]',

  // Cart
  addToCartButton: 'button:has-text("In den Warenkorb")',
  checkoutButton: 'button:has-text("Zur Kasse")',
};
