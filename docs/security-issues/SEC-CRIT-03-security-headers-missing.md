# SEC-CRIT-03: No Security Headers Configured

**Severity:** Critical 🔴
**Priority:** P1
**OWASP:** A05:2021 - Security Misconfiguration
**File:** `backend/main.py`
**Status:** Open

## Description

FastAPI application doesn't set security headers:

- No `X-Frame-Options` (clickjacking protection)
- No `Content-Security-Policy` (XSS protection)
- No `Strict-Transport-Security` (HTTPS enforcement)
- No `X-Content-Type-Options` (MIME sniffing)
- No `Referrer-Policy`

## Required Fix

Add middleware in `main.py`:

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # For HTTPS:
    # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Add to app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

## Impact

- Clickjacking attacks possible
- XSS attacks more effective without CSP
- Information leakage via Referrer header
- MIME type sniffing attacks

## References

- [OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
- [Security Headers](https://securityheaders.com/)
