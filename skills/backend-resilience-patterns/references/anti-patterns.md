# Resilience Anti-Patterns

Common mistakes when implementing resilience patterns.

---

## Missing Timeout

**Description**: External calls without timeout configuration

**Problems**:
- Thread/connection exhaustion
- Cascading failures
- Poor user experience

```python
# ANTI-PATTERN
def get_data():
    return requests.get("https://slow-api.com/data")  # May hang forever!

# CORRECT
def get_data():
    return requests.get(
        "https://slow-api.com/data",
        timeout=(3, 10)  # (connect, read) timeouts
    )
```

---

## Retry Without Backoff

**Description**: Immediate retries that overwhelm recovering services

**Problems**:
- Amplifies load on failing services
- Prevents recovery
- Thundering herd effect

```python
# ANTI-PATTERN - Immediate retries
@retry(stop=stop_after_attempt(5))  # No wait between retries!
def call_service():
    return requests.get("https://api.example.com/data")

# CORRECT - Exponential backoff
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60)
)
def call_service():
    return requests.get("https://api.example.com/data", timeout=10)
```

---

## Retry Non-Idempotent Operations

**Description**: Retrying operations that can cause duplicates

**Problems**:
- Duplicate payments
- Multiple records created
- Data inconsistency

```python
# ANTI-PATTERN - Retrying payment
@retry(stop=stop_after_attempt(3))
def process_payment(amount, user_id):
    # If this succeeds but we don't get response, retry creates duplicate!
    return payment_api.charge(amount, user_id)

# CORRECT - Use idempotency key
@retry(stop=stop_after_attempt(3))
def process_payment(amount, user_id, idempotency_key):
    return payment_api.charge(
        amount=amount,
        user_id=user_id,
        idempotency_key=idempotency_key  # Prevents duplicates
    )
```

---

## Circuit Breaker Without Fallback

**Description**: Circuit opens but no alternative provided

**Problems**:
- Users see errors during outages
- No graceful degradation
- Poor user experience

```python
# ANTI-PATTERN - No fallback
@circuit_breaker
def get_recommendations(user_id):
    return recommendation_service.get(user_id)
    # When circuit opens, users get errors!

# CORRECT - With fallback
@circuit_breaker
def get_recommendations(user_id):
    try:
        return recommendation_service.get(user_id)
    except CircuitBreakerError:
        # Return popular items as fallback
        return get_popular_items()
```

---

## Bulkhead Too Large

**Description**: Bulkhead limits set too high to be effective

**Problems**:
- Doesn't protect against exhaustion
- Resources still get overwhelmed
- Pattern provides false security

```python
# ANTI-PATTERN - Bulkhead limit too high
llm_semaphore = asyncio.Semaphore(1000)  # Effectively no limit!

# CORRECT - Meaningful limit based on capacity
llm_semaphore = asyncio.Semaphore(5)  # Based on API limits and costs
```

---

## Catching All Exceptions

**Description**: Treating all errors as transient failures

**Problems**:
- Wastes resources on permanent failures
- Delays error feedback
- Hides bugs

```python
# ANTI-PATTERN - Catch everything
@retry(stop=stop_after_attempt(5))
def call_api(data):
    return api.post(data)  # Retries even on 400 Bad Request!

# CORRECT - Only retry transient errors
@retry(
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((
        requests.Timeout,
        requests.ConnectionError
    ))
)
def call_api(data):
    response = api.post(data, timeout=10)
    response.raise_for_status()
    return response.json()
```

---

## No Jitter on Backoff

**Description**: All clients retry at exactly the same time

**Problems**:
- Thundering herd effect
- Synchronized load spikes
- Extends outage duration

```python
# ANTI-PATTERN - Fixed backoff (all retry at same time)
@retry(wait=wait_fixed(5))  # All clients retry every 5s
def call_service():
    pass

# CORRECT - Randomized jitter
@retry(
    wait=wait_exponential(multiplier=1, min=2, max=60) +
         wait_random(min=0, max=2)  # Add jitter
)
def call_service():
    pass
```

---

## Silent Failures

**Description**: Resilience patterns hide failures without alerting

**Problems**:
- Issues go unnoticed
- No opportunity to fix root cause
- Slow degradation

```python
# ANTI-PATTERN - Silent fallback
async def get_data(key):
    try:
        return await primary_service.get(key)
    except Exception:
        return await cache.get(key)  # No logging!

# CORRECT - Log degradation
async def get_data(key):
    try:
        return await primary_service.get(key)
    except Exception as e:
        logger.warning(f"Primary failed: {e}. Using cache.")
        metrics.increment("service.degraded", tags=["service:primary"])
        return await cache.get(key)
```

---

## Wrong Circuit Breaker Scope

**Description**: One circuit breaker for multiple endpoints

**Problems**:
- Healthy endpoints blocked
- Overly aggressive circuit opening
- Unnecessary service degradation

```python
# ANTI-PATTERN - Single circuit for all endpoints
api_circuit = CircuitBreaker(fail_max=5)

@api_circuit
def get_users():
    return api.get("/users")

@api_circuit
def get_orders():
    return api.get("/orders")  # Blocked if /users fails!

# CORRECT - Per-endpoint circuits
users_circuit = CircuitBreaker(fail_max=5)
orders_circuit = CircuitBreaker(fail_max=5)

@users_circuit
def get_users():
    return api.get("/users")

@orders_circuit
def get_orders():
    return api.get("/orders")
```

---

## Detection Checklist

| Smell | Likely Problem |
|-------|----------------|
| `requests.get(url)` without timeout | Missing Timeout |
| `@retry` without `wait=` | Retry Without Backoff |
| `@retry` on POST/PUT without idempotency | Retry Non-Idempotent |
| `CircuitBreakerError` with no handler | Circuit Without Fallback |
| Semaphore(100+) for external calls | Bulkhead Too Large |
| `except Exception:` in retry | Catching All Exceptions |
| `wait_fixed` without jitter | No Jitter |
| No logging in except blocks | Silent Failures |
| One circuit for multiple endpoints | Wrong Circuit Scope |

---

## Quick Fixes

1. **Add timeout to all external calls** - Even 60s is better than none
2. **Use exponential backoff + jitter** - `wait_exponential() + wait_random()`
3. **Only retry transient failures** - Network, 5xx, not 4xx
4. **Add idempotency keys** - For all non-GET requests
5. **Always have fallbacks** - Cache, defaults, or error messages
6. **Log degradation** - Track when fallbacks activate
7. **Scope circuits appropriately** - Per endpoint or service
