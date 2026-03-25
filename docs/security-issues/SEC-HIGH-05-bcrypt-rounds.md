# SEC-HIGH-05: Bcrypt Salt Rounds Not Explicit

**Severity:** High 🟠
**Priority:** P2
**OWASP:** A02:2021 - Cryptographic Failures
**File:** `backend/main.py:588`
**Status:** ✅ Fixed in commit e245a51

## Description

Bcrypt uses default salt rounds. OWASP recommends 12 rounds as of 2023. Default may change in future bcrypt versions.

## Current Code

```python
salt = bcrypt.gensalt()
```

## Required Fix

```python
# 12 rounds is OWASP recommendation (2023)
salt = bcrypt.gensalt(rounds=12)
```

## Impact

- Future bcrypt version might use different default
- Explicit is better than implicit for security parameters

## References

- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
