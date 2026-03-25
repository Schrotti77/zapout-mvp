# SEC-CRIT-01: JWT_SECRET Default Value

**Severity:** Critical 🔴
**Priority:** P1
**OWASP:** A02:2021 - Cryptographic Failures
**File:** `backend/app/auth_passkey.py:32`
**Status:** ✅ Fixed in commit 95b2827

## Description

`JWT_SECRET` defaults to `secrets.token_hex(32)` if not set. This means:

- Server restart invalidates all existing tokens
- Multiple instances have different secrets
- Tokens issued before restart become invalid

## Current Code

```python
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
```

## Required Fix

```python
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
```

## Impact

- All users must re-login after server restart
- Horizontal scaling is broken (each instance has different secret)
- Potential for weak secret if env var is empty string

## References

- [OWASP A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)
