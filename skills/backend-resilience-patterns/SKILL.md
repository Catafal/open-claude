---
name: backend-resilience-patterns
description: Resilience patterns for handling failures in distributed systems. Use when building fault-tolerant services or protecting against cascading failures. Triggers on Circuit Breaker, Retry pattern, Timeout pattern, Bulkhead, Fallback, resilience, fault tolerance, error handling, exponential backoff, rate limiting, chaos engineering, tenacity, pybreaker.
---

# Backend Resilience Patterns

Patterns for building fault-tolerant systems that handle failures gracefully.

## Overview

**Five Core Resilience Patterns**:

| Pattern | Purpose | Key Benefit |
|---------|---------|-------------|
| **Circuit Breaker** | Stop calling failing services | Prevent cascading failures |
| **Retry** | Auto-retry transient failures | Handle temporary issues |
| **Timeout** | Limit wait time | Prevent indefinite blocking |
| **Bulkhead** | Isolate resource pools | Prevent resource exhaustion |
| **Fallback** | Provide alternatives | Maintain functionality |

**Key Libraries**:
```bash
pip install pybreaker tenacity httpx
```

---

## Circuit Breaker Pattern

**Purpose**: Automatically stop calling failing services to allow recovery time

### Three States

```
┌─────────┐  Failures exceed    ┌─────────┐
│ CLOSED  │────threshold───────>│  OPEN   │
│(Normal) │                     │(Blocked)│
└─────────┘                     └────┬────┘
     ▲                               │
     │                               │ After timeout
     │      Success                  │
     │  ┌─────────┐                  │
     └──│HALF-OPEN│<─────────────────┘
        │(Testing)│
        └─────────┘
```

### Using `pybreaker`

```python
from pybreaker import CircuitBreaker, CircuitBreakerError
import requests

# Configure circuit breaker
llm_breaker = CircuitBreaker(
    fail_max=5,              # Open after 5 failures
    reset_timeout=60,        # Try again after 60 seconds
    exclude=[ValueError],    # Don't count these as failures
)

@llm_breaker
def call_llm_api(prompt: str) -> str:
    """Call LLM API with circuit breaker protection"""
    response = requests.post(
        "https://api.llm-provider.com/generate",
        json={"prompt": prompt},
        timeout=10
    )
    response.raise_for_status()
    return response.json()["text"]


# Usage
try:
    result = call_llm_api("Explain quantum computing")
except CircuitBreakerError:
    # Circuit is open, service is down
    result = "Service temporarily unavailable"
```

### FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from pybreaker import CircuitBreaker, CircuitBreakerError
import httpx

app = FastAPI()
external_api_breaker = CircuitBreaker(fail_max=5, reset_timeout=60)

@external_api_breaker
async def fetch_external_data(endpoint: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(endpoint, timeout=10.0)
        response.raise_for_status()
        return response.json()

@app.get("/data/{item_id}")
async def get_data(item_id: str):
    try:
        data = await fetch_external_data(f"https://api.example.com/items/{item_id}")
        return data
    except CircuitBreakerError:
        cached_data = await get_from_cache(item_id)
        if cached_data:
            return {"data": cached_data, "source": "cache", "status": "degraded"}
        raise HTTPException(status_code=503, detail="Service unavailable")
```

---

## Retry Pattern

**Purpose**: Automatically retry failed operations that might succeed on retry

### Exponential Backoff with `tenacity`

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log
)
import logging
import requests

logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)),
    before_sleep=before_sleep_log(logger, logging.WARNING)
)
def call_external_api(endpoint: str, data: dict):
    """
    Retry configuration:
    - Max 5 attempts
    - Wait: 2s, 4s, 8s, 16s, 32s (capped at 60s)
    - Only retry on network errors
    """
    response = requests.post(endpoint, json=data, timeout=10)
    response.raise_for_status()
    return response.json()
```

### Async Retry

```python
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, RetryError
import httpx

async def fetch_with_retry(url: str) -> dict:
    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    ):
        with attempt:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10.0)
                response.raise_for_status()
                return response.json()
```

### When to Retry

| Status Code | Retry? | Reason |
|-------------|--------|--------|
| 408 Timeout | ✅ Yes | Transient |
| 429 Rate Limit | ✅ Yes (with backoff) | Recoverable |
| 500-504 | ✅ Yes | Server issue |
| 400 Bad Request | ❌ No | Client error |
| 401/403 | ❌ No | Auth failure |
| 404 Not Found | ❌ No | Resource missing |

---

## Timeout Pattern

**Purpose**: Limit wait time for operations to prevent indefinite blocking

### Basic Timeout

```python
import requests

# Separate connection and read timeouts
response = requests.get(
    "https://api.example.com/data",
    timeout=(3, 10)  # (connect_timeout, read_timeout)
)

# Single timeout for both
response = requests.get(
    "https://api.example.com/data",
    timeout=10
)
```

### Async Timeout

```python
import asyncio
import httpx

async def fetch_with_timeout(url: str, timeout_seconds: float = 10):
    try:
        async with httpx.AsyncClient() as client:
            response = await asyncio.wait_for(
                client.get(url),
                timeout=timeout_seconds
            )
            return response.json()
    except asyncio.TimeoutError:
        print(f"Request timed out after {timeout_seconds}s")
        raise
```

### Recommended Timeouts

| Operation Type | Recommended Timeout |
|----------------|---------------------|
| Database queries | 5-30 seconds |
| Internal API calls | 5-10 seconds |
| External API calls | 10-30 seconds |
| LLM API calls | 30-60 seconds |
| Health checks | 1-2 seconds |

---

## Bulkhead Pattern

**Purpose**: Isolate resources into separate pools to prevent total system failure

### Thread Pool Bulkheads

```python
from concurrent.futures import ThreadPoolExecutor

# Separate thread pools for different workloads
video_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="video")
payment_executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="payment")

# Heavy tasks isolated
for i in range(100):
    video_executor.submit(process_heavy_video, video_id=i)

# Payments unaffected by video processing
payment_executor.submit(process_payment, payment_id=123)
```

### Async Bulkhead with Semaphores

```python
import asyncio

class AsyncBulkhead:
    def __init__(self, max_concurrent: int):
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def execute(self, coro):
        async with self.semaphore:
            return await coro

# Separate bulkheads for different operations
llm_bulkhead = AsyncBulkhead(max_concurrent=5)    # Max 5 LLM calls
db_bulkhead = AsyncBulkhead(max_concurrent=20)    # Max 20 DB queries
api_bulkhead = AsyncBulkhead(max_concurrent=10)   # Max 10 API calls

async def process_request(request_id: str):
    async with llm_bulkhead.semaphore:
        llm_result = await call_llm(request_id)

    async with db_bulkhead.semaphore:
        db_result = await query_database(llm_result)

    return db_result
```

---

## Fallback Pattern

**Purpose**: Provide alternative responses when primary operation fails

### Cache Fallback

```python
async def get_user_profile(user_id: str):
    cache_key = f"user_profile:{user_id}"

    try:
        # Try primary operation
        result = await external_api.get(f"/users/{user_id}")
        # Cache successful result
        await redis.setex(cache_key, 3600, json.dumps(result))
        return result
    except Exception as e:
        logger.warning(f"Primary failed: {e}. Trying cache.")
        # Fallback to cache
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
        raise
```

### Multi-Service Fallback

```python
async def translate_text(text: str, target_lang: str) -> str:
    services = [
        ("primary", translate_with_deepl),
        ("secondary", translate_with_google),
        ("tertiary", translate_with_libre),
    ]

    for service_name, service_func in services:
        try:
            result = await service_func(text, target_lang)
            logger.info(f"Translation success using {service_name}")
            return result
        except Exception as e:
            logger.warning(f"{service_name} failed: {e}")
            continue

    # All services failed
    return f"[Translation unavailable] {text}"
```

---

## Combining Patterns

### Complete Resilience Stack

```python
from tenacity import retry, stop_after_attempt, wait_exponential
from pybreaker import CircuitBreaker
import asyncio

# Circuit breaker
llm_circuit = CircuitBreaker(fail_max=5, reset_timeout=60)

# Bulkhead
llm_semaphore = asyncio.Semaphore(5)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
@llm_circuit
async def resilient_llm_call(prompt: str) -> str:
    """
    LLM call with complete resilience:
    1. Timeout (10s)
    2. Retry (3 attempts with backoff)
    3. Circuit breaker (opens after 5 failures)
    4. Fallback (cached response)
    """
    try:
        async with asyncio.timeout(10):
            response = await call_llm_api(prompt)
            # Cache successful response
            cache_key = f"llm:{hash(prompt)}"
            await redis.setex(cache_key, 3600, response)
            return response
    except Exception as e:
        # Fallback: try cache
        cache_key = f"llm:{hash(prompt)}"
        cached = await redis.get(cache_key)
        if cached:
            return cached
        return "Unable to process request. Please try again."


async def process_user_request(request: str):
    async with llm_semaphore:  # Bulkhead
        return await resilient_llm_call(request)
```

---

## Quick Reference

### Pattern Selection

| Scenario | Recommended Patterns |
|----------|---------------------|
| External API call | Timeout + Retry + Circuit Breaker + Fallback |
| Database query | Timeout + Connection pooling (Bulkhead) |
| LLM API call | All five patterns |
| Microservice call | Circuit Breaker + Retry + Timeout |
| Critical operation | Circuit Breaker + Fallback (mandatory) |
| High-volume endpoint | Bulkhead + Circuit Breaker |

### Configuration Examples

```python
# Critical payment service (strict)
payment_breaker = CircuitBreaker(
    fail_max=3,              # Open quickly
    reset_timeout=120,       # Long recovery
)

# Flaky third-party API (lenient)
analytics_breaker = CircuitBreaker(
    fail_max=10,             # Allow more failures
    reset_timeout=30,        # Quick retry
)
```

---

## See Also

### In This Skill
- [combining-patterns.md](references/combining-patterns.md) - Complete resilient client implementation
- [testing-resilience.md](references/testing-resilience.md) - Chaos engineering and fault injection
- [anti-patterns.md](references/anti-patterns.md) - Common resilience mistakes

### Related Skills
- **backend-patterns**: Service Layer, Repository patterns
- **gof-patterns**: Strategy for fallback selection
