# SEC-MED-07: Cashu Token Verification Fails Open

**Severity:** Medium 🟡
**Priority:** P3
**OWASP:** A05:2021 - Security Misconfiguration
**File:** `backend/main.py:1050`
**Status:** ✅ Fixed in commit 0eeb618

## Description

Cashu token verification silently accepts invalid tokens if the mint is unreachable. This is a "fail open" design which could be exploited.

## Current Code

```python
except requests.RequestException as e:
    # Wenn Mint nicht erreichbar, nehmen wir an Token ist gültig
    return {
        "valid": True,
        "amount": total_amount,
        "unspent": len(proofs),
        "spent": 0,
        "error": str(e),
    }
```

## Required Fix

Fail closed (deny) when verification fails:

```python
except requests.RequestException as e:
    raise ExternalServiceError(
        "Cashu",
        f"Mint at {mint_url} not reachable for token verification: {e}"
    )
```

## Impact

- Invalid/spent tokens could be accepted as valid
- Double-spending detection is bypassed when mint is down
- Economic loss possible

## References

- [OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
