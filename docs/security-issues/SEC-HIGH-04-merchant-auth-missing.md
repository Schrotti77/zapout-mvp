# SEC-HIGH-04: Merchant Payment Request Missing Authorization

**Severity:** High 🟠
**Priority:** P2
**OWASP:** A01:2021 - Broken Access Control
**File:** `backend/main.py:1247`
**Status:** Open

## Description

The `/merchant/payment-request` endpoint verifies user authentication but doesn't verify that the payment belongs to the authenticated user before creating invoices. This could allow users to create payment requests under other users' accounts.

## Current Code

```python
@app.post("/merchant/payment-request")
def create_merchant_payment_request(request: dict, user_id: int = Depends(verify_token)):
    # Creates invoice without verifying ownership
    amount_cents = request.get("amount_cents")
    # ...
```

## Required Fix

Add ownership verification:

```python
@app.post("/merchant/payment-request")
def create_merchant_payment_request(request: dict, user_id: int = Depends(verify_token)):
    # Verify user exists and has merchant permissions
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not c.fetchone():
        conn.close()
        raise NotFoundError("User", str(user_id))
    conn.close()

    # Create invoice for verified user
    # ...
```

## Impact

- Potential for unauthorized invoice creation
- Billing confusion
- Could be exploited for DoS (creating many invoices)

## References

- [OWASP A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
