# SEC-HIGH-06: Rate Limiting is Per-Process

**Severity:** High 🟠
**Priority:** P2
**OWASP:** A01:2021 - Broken Access Control / A04:2021 - Insecure Design
**File:** `backend/main.py:282`
**Status:** Open

## Description

Rate limiting uses in-memory storage (`defaultdict`). In a multi-worker deployment (e.g., Gunicorn with multiple workers), an attacker can bypass rate limits by sending requests to different workers.

## Current Code

```python
login_attempts: Dict[str, List[float]] = defaultdict(list)

def check_rate_limit(ip: str) -> bool:
    now = time()
    login_attempts[ip] = [t for t in login_attempts[ip] if now - t < settings.rate_limit_window]
    # ...
```

## Required Fix

Use Redis for distributed rate limiting:

```python
# Option 1: Use Upstash Ratelimit
from upstash_ratelimit import Ratelimit, Redis
from upstash_redis import Redis as UpstashRedis

redis = UpstashRedis(url=UPSTASH_REDIS_URL, token=UPSTASH_REDIS_TOKEN)
ratelimit = Ratelimit(
    redis=Redis(redis),
    limiter=Ratelimit.sliding_window(5, "1 m"),  # 5 requests per minute
)

# Option 2: Use slowapi with Redis backend
```

## Impact

- Rate limiting can be bypassed with multiple workers
- Brute force attacks become easier
- DoS protection is ineffective

## References

- [OWASP A04:2021](https://owasp.org/Top10/A04_2021-Insecure_Design/)
