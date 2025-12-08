# Combining Resilience Patterns - Detailed Reference

Complete examples of combining multiple resilience patterns.

---

## Resilient HTTP Client

Complete implementation combining all five patterns:

```python
from dataclasses import dataclass
from typing import Optional, Callable
import httpx
import asyncio
import json
from pybreaker import CircuitBreaker, CircuitBreakerError
from tenacity import (
    AsyncRetrying,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

@dataclass
class ResilientClientConfig:
    """Configuration for resilient HTTP client"""
    max_retries: int = 3
    timeout: float = 10.0
    circuit_fail_max: int = 5
    circuit_reset_timeout: int = 60
    max_concurrent: int = 10
    cache_ttl: int = 3600


class ResilientHTTPClient:
    """
    HTTP client with comprehensive resilience:
    - Timeout: Prevent indefinite waits
    - Retry: Handle transient failures
    - Circuit Breaker: Stop calling failing services
    - Bulkhead: Limit concurrent requests
    - Fallback: Return cached data on failure
    """

    def __init__(self, config: ResilientClientConfig, cache_backend):
        self.config = config
        self.cache = cache_backend
        self.circuit = CircuitBreaker(
            fail_max=config.circuit_fail_max,
            reset_timeout=config.circuit_reset_timeout
        )
        self.semaphore = asyncio.Semaphore(config.max_concurrent)

    async def get(self, url: str, fallback: Optional[Callable] = None):
        """Resilient GET request"""
        # Bulkhead: limit concurrency
        async with self.semaphore:
            return await self._resilient_request(url, fallback)

    async def _resilient_request(self, url: str, fallback: Optional[Callable]):
        """Execute request with all resilience patterns"""
        cache_key = f"http_cache:{url}"

        # Check circuit breaker first
        if not self.circuit.allow_request():
            return await self._handle_circuit_open(cache_key, fallback)

        # Retry with exponential backoff
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self.config.max_retries),
                wait=wait_exponential(multiplier=1, min=2, max=10),
                retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError))
            ):
                with attempt:
                    # Timeout
                    async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                        response = await client.get(url)
                        response.raise_for_status()

                        # Success: cache and return
                        result = response.json()
                        await self.cache.setex(
                            cache_key,
                            self.config.cache_ttl,
                            json.dumps(result)
                        )
                        self.circuit.record_success()
                        return result

        except Exception as e:
            self.circuit.record_failure()
            return await self._handle_failure(cache_key, fallback, e)

    async def _handle_circuit_open(self, cache_key: str, fallback: Optional[Callable]):
        """Handle when circuit is open"""
        # Try cache
        cached = await self.cache.get(cache_key)
        if cached:
            return {"data": json.loads(cached), "source": "cache", "degraded": True}

        # Try fallback
        if fallback:
            return await fallback()

        raise CircuitBreakerError("Circuit is open and no fallback available")

    async def _handle_failure(self, cache_key: str, fallback: Optional[Callable], error):
        """Handle request failure"""
        # Try cache
        cached = await self.cache.get(cache_key)
        if cached:
            return {"data": json.loads(cached), "source": "cache", "degraded": True}

        # Try fallback
        if fallback:
            return await fallback()

        raise error
```

---

## Usage Examples

### Basic Usage

```python
async def main():
    config = ResilientClientConfig(
        max_retries=3,
        timeout=10.0,
        circuit_fail_max=5,
        max_concurrent=10
    )

    client = ResilientHTTPClient(config, redis_client)

    # Simple request
    data = await client.get("https://api.example.com/users/123")

    # With custom fallback
    async def get_default_user():
        return {"id": "unknown", "name": "Guest User"}

    data = await client.get(
        "https://api.example.com/users/123",
        fallback=get_default_user
    )
```

### Service-Specific Clients

```python
# LLM Service Client - Higher timeouts, lower concurrency
llm_config = ResilientClientConfig(
    max_retries=2,
    timeout=60.0,        # LLMs are slow
    circuit_fail_max=3,  # Open quickly
    max_concurrent=5,    # Limit concurrent calls (cost)
    cache_ttl=3600
)
llm_client = ResilientHTTPClient(llm_config, redis_client)

# Analytics Service - Higher concurrency, shorter timeout
analytics_config = ResilientClientConfig(
    max_retries=3,
    timeout=5.0,
    circuit_fail_max=10,  # More tolerant
    max_concurrent=50,    # Handle bursts
    cache_ttl=300         # Shorter cache
)
analytics_client = ResilientHTTPClient(analytics_config, redis_client)
```

---

## FastAPI Integration

```python
from fastapi import FastAPI, Depends, HTTPException
from functools import lru_cache

app = FastAPI()

@lru_cache
def get_user_client() -> ResilientHTTPClient:
    """Singleton client for user service"""
    config = ResilientClientConfig(
        max_retries=3,
        timeout=10.0,
        max_concurrent=20
    )
    return ResilientHTTPClient(config, redis_client)


@app.get("/users/{user_id}")
async def get_user(
    user_id: str,
    client: ResilientHTTPClient = Depends(get_user_client)
):
    async def fallback():
        return {"id": user_id, "name": "Unknown", "source": "fallback"}

    try:
        result = await client.get(
            f"https://user-service/users/{user_id}",
            fallback=fallback
        )
        return result
    except CircuitBreakerError:
        raise HTTPException(503, "User service temporarily unavailable")
```

---

## Monitoring Integration

```python
from prometheus_client import Counter, Histogram, Gauge

# Metrics
request_total = Counter('resilient_client_requests_total', 'Total requests', ['service', 'status'])
request_duration = Histogram('resilient_client_request_duration_seconds', 'Request duration', ['service'])
circuit_state = Gauge('resilient_client_circuit_state', 'Circuit breaker state', ['service'])


class MonitoredResilientClient(ResilientHTTPClient):
    """Resilient client with Prometheus metrics"""

    def __init__(self, service_name: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.service_name = service_name

    async def get(self, url: str, fallback=None):
        with request_duration.labels(service=self.service_name).time():
            try:
                result = await super().get(url, fallback)
                status = "degraded" if result.get("degraded") else "success"
                request_total.labels(service=self.service_name, status=status).inc()
                return result
            except Exception as e:
                request_total.labels(service=self.service_name, status="error").inc()
                raise
```

---

## Pattern Ordering

**Recommended order (outer to inner)**:

1. **Bulkhead** (outermost) - Limit entry
2. **Circuit Breaker** - Fail fast if service down
3. **Retry** - Handle transient failures
4. **Timeout** - Limit wait time
5. **Fallback** (innermost) - Last resort

```python
async def resilient_call():
    async with bulkhead:                    # 1. Bulkhead
        if not circuit.allow_request():      # 2. Circuit Breaker
            return fallback_data
        try:
            for attempt in retry_policy:     # 3. Retry
                with attempt:
                    async with timeout(10):  # 4. Timeout
                        return await call_service()
        except Exception:
            return fallback_response()       # 5. Fallback
```
