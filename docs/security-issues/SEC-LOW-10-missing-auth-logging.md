# SEC-LOW-10: Missing Security Audit Logging

**Severity:** Low 🟢
**Priority:** P4
**OWASP:** A09:2021 - Security Logging and Monitoring Failures
**File:** `backend/main.py:login()`
**Status:** ✅ Fixed in commit bb4ae5d

## Description

Failed login attempts are not logged with enough detail for security auditing and incident response.

## Required Fix

Add structured logging:

```python
if not row:
    logger.warning(
        "Login failed - user not found",
        extra={
            "extra_fields": {
                "email": credentials.email,
                "ip": client_ip,
                "reason": "user_not_found"
            }
        }
    )
    raise AuthenticationError("Invalid credentials")
```

## Impact

- Difficult to detect brute force attacks
- Missing audit trail for security incidents
- Compliance issues (PCI-DSS, GDPR)

## References

- [OWASP A09:2021](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)
