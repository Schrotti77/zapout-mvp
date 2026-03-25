# ZapOut Security Issues

**Audited:** 2026-03-25
**Auditor:** Jochen (using security-auditor skill)
**Framework:** OWASP Top 10 (2021)

## Summary

| Severity    | Count | Issues                                |
| ----------- | ----- | ------------------------------------- |
| 🔴 Critical | 3     | SEC-CRIT-01, SEC-CRIT-02, SEC-CRIT-03 |
| 🟠 High     | 3     | SEC-HIGH-04, SEC-HIGH-05, SEC-HIGH-06 |
| 🟡 Medium   | 2     | SEC-MED-07, SEC-MED-08                |
| 🟢 Low      | 2     | SEC-LOW-09, SEC-LOW-10                |

## Priority Fix Order

### P1 - Fix Immediately 🔴

1. [SEC-CRIT-01](./SEC-CRIT-01-jwt-secret-default.md) - JWT_SECRET default value
2. [SEC-CRIT-02](./SEC-CRIT-02-websocket-auth-missing.md) - WebSocket authentication missing
3. [SEC-CRIT-03](./SEC-CRIT-03-security-headers-missing.md) - Security headers not configured

### P2 - Fix Soon 🟠

4. [SEC-HIGH-04](./SEC-HIGH-04-merchant-auth-missing.md) - Merchant payment authorization
5. [SEC-HIGH-05](./SEC-HIGH-05-bcrypt-rounds.md) - Bcrypt rounds not explicit
6. [SEC-HIGH-06](./SEC-HIGH-06-rate-limit-per-process.md) - Rate limiting per-process

### P3 - Fix Before Production 🟡

7. [SEC-MED-07](./SEC-MED-07-cashu-token-fail-open.md) - Cashu token fail-open
8. [SEC-MED-08](./SEC-MED-08-token-in-localstorage.md) - Token in localStorage

### P4 - Nice to Have 🟢

9. [SEC-LOW-09](./SEC-LOW-09-request-body-limit.md) - No request body limit
10. [SEC-LOW-10](./SEC-LOW-10-missing-auth-logging.md) - Missing auth audit logging

---

## Already Implemented ✅

| Check                      | Status | Notes                                        |
| -------------------------- | ------ | -------------------------------------------- |
| SQL Injection Prevention   | ✅     | All queries use parameterized statements     |
| SEC-001: Passkey Assertion | ✅     | Challenge + signature + counter verification |
| Password Hashing           | ✅     | bcrypt used                                  |
| CORS Configuration         | ✅     | Origins configurable via env                 |
| Pydantic Validation        | ✅     | Input validation on all models               |
| Error Messages             | ✅     | No stack traces in production                |
| Subprocess Injection       | ✅     | LND calls use argument lists                 |

---

## OWASP Mapping

| OWASP Category                                      | Issues                                |
| --------------------------------------------------- | ------------------------------------- |
| A01:2021 Broken Access Control                      | SEC-CRIT-02, SEC-HIGH-04, SEC-HIGH-06 |
| A02:2021 Cryptographic Failures                     | SEC-CRIT-01, SEC-HIGH-05              |
| A05:2021 Security Misconfiguration                  | SEC-CRIT-03, SEC-MED-07, SEC-LOW-09   |
| A07:2021 Identification and Authentication Failures | SEC-MED-08                            |
| A09:2021 Security Logging and Monitoring Failures   | SEC-LOW-10                            |

---

## Getting Help

If you find a new vulnerability, please:

1. Don't open a public GitHub issue
2. Email security findings privately
3. Document in this folder with "REPORTED-" prefix

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [security-auditor skill](https://clawhub.ai/skills/security-auditor)
