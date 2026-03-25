/**
 * Playwright Test Helpers - Auth utilities and shared helpers
 */

const API_URL = 'http://localhost:8000';

/**
 * Register a new user via API for testing
 */
async function registerUser(email, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

/**
 * Login via API and return token
 */
async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

/**
 * Login via API and inject token into page localStorage
 */
async function loginViaAPI(page, email = 'test2@cafe.de', password = 'test123') {
  // Clear storage first
  await page.evaluate(() => localStorage.clear());

  // Try to login
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    // Try to register instead
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }

  // Get fresh token
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await loginRes.json();

  if (data.token) {
    await page.evaluate(token => {
      localStorage.setItem('zapout_token', token);
    }, data.token);
  }

  return data.token;
}

/**
 * Wait for page to be in authenticated state
 */
async function waitForAuthenticated(page) {
  await page
    .waitForFunction(
      () => {
        return localStorage.getItem('zapout_token') !== null;
      },
      { timeout: 5000 }
    )
    .catch(() => {
      // Token might already be set
    });
}

module.exports = {
  registerUser,
  loginUser,
  loginViaAPI,
  waitForAuthenticated,
};
