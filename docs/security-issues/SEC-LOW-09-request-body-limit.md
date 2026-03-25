# SEC-LOW-09: No Request Body Size Limit

**Severity:** Low 🟢
**Priority:** P4
**OWASP:** A05:2021 - Security Misconfiguration
**File:** `backend/main.py`
**Status:** ✅ Fixed in commit bb4ae5d

## Description

No explicit limit on request body size. Large payloads could cause memory exhaustion.

## Required Fix

```python
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    body_limit=1_000_000,  # 1MB limit
)
```

## Impact

- Potential for memory exhaustion via large payloads
- DoS vulnerability
- Cost increase from processing large requests

## References

- [OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
