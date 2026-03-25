# SEC-MED-08: Auth Token Stored in localStorage

**Severity:** Medium 🟡
**Priority:** P3
**OWASP:** A07:2021 - Identification and Authentication Failures
**File:** `frontend/src/lib/api.js:29`
**Status:** ✅ Fixed in commit 0eeb618

## Description

Auth token stored in localStorage is vulnerable to XSS attacks. If any XSS vulnerability exists in the application, attackers can steal the token.

## Current Code

```javascript
function getAuthToken() {
  return localStorage.getItem('zapout_token');
}
```

## Recommended Fix

Use httpOnly cookies set by the server:

```javascript
// Server sets: Set-Cookie: zapout_token=xxx; HttpOnly; Secure; SameSite=Strict
// Frontend reads from cookie (not accessible to JS)
function getAuthToken() {
  const match = document.cookie.match(/zapout_token=([^;]+)/);
  return match ? match[1] : null;
}
```

## Backend Change Required

In FastAPI:

```python
from fastapi.responses import JSONResponse

response = JSONResponse({"token": token})
response.set_cookie(
    key="zapout_token",
    value=token,
    httponly=True,
    secure=True,  # HTTPS only
    samesite="strict",
    max_age=60 * 60 * 24 * 30  # 30 days
)
return response
```

## Impact

- XSS attacks can steal auth tokens
- Stolen tokens can be used to impersonate users
- Session hijacking possible

## References

- [OWASP A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
