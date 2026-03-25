# SEC-CRIT-02: WebSocket Authentication Missing

**Severity:** Critical 🔴
**Priority:** P1
**OWASP:** A01:2021 - Broken Access Control
**File:** `backend/main.py:605`
**Status:** ✅ Fixed in commit 95b2827

## Description

WebSocket endpoint `/ws/payments/{payment_id}` doesn't verify authentication token. Any client can subscribe to any payment_id and receive real-time updates.

## Current Code

```python
@app.websocket("/ws/payments/{payment_id}")
async def websocket_payment(websocket: WebSocket, payment_id: int):
    await manager.connect(websocket, str(payment_id))
```

## Required Fix

```python
@app.websocket("/ws/payments/{payment_id}")
async def websocket_payment(
    websocket: WebSocket,
    payment_id: int,
    token: str = Query(None)
):
    if not token:
        await websocket.close(code=4001)
        return

    try:
        user_id = verify_token(token)
    except AuthenticationError:
        await websocket.close(code=4001)
        return

    # Verify payment belongs to user
    if not payment_belongs_to_user(payment_id, user_id):
        await websocket.close(code=4003)
        return

    await manager.connect(websocket, str(payment_id))
```

## Impact

- Unauthorized access to payment status updates
- Information disclosure of payment amounts and statuses
- Potential for monitoring competitor payments

## References

- [OWASP A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [WebSocket Security](https://www.geeksforgeeks.org/websocket-security/)
