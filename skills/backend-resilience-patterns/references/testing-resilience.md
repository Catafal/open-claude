# Testing Resilience - Detailed Reference

Strategies for testing resilience patterns and chaos engineering.

---

## Testing Circuit Breaker

```python
import pytest
from pybreaker import CircuitBreaker, CircuitBreakerError

@pytest.mark.asyncio
async def test_circuit_opens_after_threshold():
    """Test circuit opens after failure threshold"""
    breaker = CircuitBreaker(fail_max=3, reset_timeout=60)

    @breaker
    def failing_function():
        raise Exception("Service unavailable")

    # First 3 calls attempt and fail
    for i in range(3):
        with pytest.raises(Exception):
            failing_function()

    # 4th call fails immediately (circuit open)
    with pytest.raises(CircuitBreakerError):
        failing_function()

    assert breaker.current_state == "open"


@pytest.mark.asyncio
async def test_circuit_half_open_after_timeout():
    """Test circuit transitions to half-open"""
    breaker = CircuitBreaker(fail_max=2, reset_timeout=1)

    @breaker
    def failing_function():
        raise Exception("Fail")

    # Open circuit
    for _ in range(2):
        with pytest.raises(Exception):
            failing_function()

    assert breaker.current_state == "open"

    # Wait for reset timeout
    await asyncio.sleep(1.5)

    # Should be half-open now
    assert breaker.current_state == "half-open"


@pytest.mark.asyncio
async def test_circuit_closes_on_success():
    """Test circuit closes after successful call in half-open"""
    breaker = CircuitBreaker(fail_max=2, reset_timeout=1)
    call_count = 0

    @breaker
    def flaky_function():
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            raise Exception("Fail")
        return "success"

    # Open circuit
    for _ in range(2):
        with pytest.raises(Exception):
            flaky_function()

    # Wait for half-open
    await asyncio.sleep(1.5)

    # Should succeed and close circuit
    result = flaky_function()
    assert result == "success"
    assert breaker.current_state == "closed"
```

---

## Testing Retry Logic

```python
import pytest
from tenacity import retry, stop_after_attempt, wait_fixed, RetryError

def test_retry_succeeds_after_transient_failure():
    """Test retry recovers from transient failures"""
    call_count = 0

    @retry(stop=stop_after_attempt(3), wait=wait_fixed(0.1))
    def flaky_function():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise Exception("Transient failure")
        return "success"

    result = flaky_function()

    assert result == "success"
    assert call_count == 3


def test_retry_exhausts_attempts():
    """Test retry gives up after max attempts"""
    call_count = 0

    @retry(stop=stop_after_attempt(3), wait=wait_fixed(0.1))
    def always_fails():
        nonlocal call_count
        call_count += 1
        raise Exception("Permanent failure")

    with pytest.raises(RetryError):
        always_fails()

    assert call_count == 3


def test_no_retry_on_excluded_exceptions():
    """Test certain exceptions skip retry"""
    from tenacity import retry_if_not_exception_type

    call_count = 0

    @retry(
        stop=stop_after_attempt(3),
        retry=retry_if_not_exception_type(ValueError)
    )
    def raises_value_error():
        nonlocal call_count
        call_count += 1
        raise ValueError("Client error")

    with pytest.raises(ValueError):
        raises_value_error()

    assert call_count == 1  # No retry
```

---

## Testing Timeout

```python
import pytest
import asyncio

@pytest.mark.asyncio
async def test_timeout_prevents_infinite_wait():
    """Test timeout stops long-running operations"""
    async def slow_operation():
        await asyncio.sleep(10)
        return "result"

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(slow_operation(), timeout=1)


@pytest.mark.asyncio
async def test_operation_completes_within_timeout():
    """Test operation succeeds when fast enough"""
    async def fast_operation():
        await asyncio.sleep(0.1)
        return "success"

    result = await asyncio.wait_for(fast_operation(), timeout=5)
    assert result == "success"
```

---

## Testing Fallback

```python
import pytest

@pytest.mark.asyncio
async def test_fallback_used_on_primary_failure():
    """Test fallback activates when primary fails"""
    async def get_with_fallback():
        try:
            raise Exception("Primary failed")
        except Exception:
            return {"source": "fallback", "data": "cached"}

    result = await get_with_fallback()
    assert result["source"] == "fallback"


@pytest.mark.asyncio
async def test_fallback_chain():
    """Test multiple fallbacks in sequence"""
    call_log = []

    async def primary():
        call_log.append("primary")
        raise Exception("Primary failed")

    async def secondary():
        call_log.append("secondary")
        raise Exception("Secondary failed")

    async def tertiary():
        call_log.append("tertiary")
        return "success"

    async def get_with_chain():
        for service in [primary, secondary, tertiary]:
            try:
                return await service()
            except Exception:
                continue
        raise Exception("All services failed")

    result = await get_with_chain()
    assert result == "success"
    assert call_log == ["primary", "secondary", "tertiary"]
```

---

## Fault Injection Testing

```python
import random
import asyncio

class FaultInjector:
    """Inject faults for chaos testing"""

    def __init__(
        self,
        failure_rate: float = 0.3,
        latency_ms: int = 0,
        latency_jitter_ms: int = 0
    ):
        self.failure_rate = failure_rate
        self.latency_ms = latency_ms
        self.latency_jitter_ms = latency_jitter_ms

    async def inject(self):
        """Apply configured faults"""
        # Inject latency
        if self.latency_ms > 0:
            jitter = random.randint(-self.latency_jitter_ms, self.latency_jitter_ms)
            delay = max(0, self.latency_ms + jitter) / 1000
            await asyncio.sleep(delay)

        # Inject failure
        if random.random() < self.failure_rate:
            raise Exception("Injected fault")


@pytest.mark.asyncio
async def test_system_handles_random_failures():
    """Test system resilience with fault injection"""
    from tenacity import retry, stop_after_attempt

    injector = FaultInjector(failure_rate=0.5, latency_ms=100)

    @retry(stop=stop_after_attempt(5))
    async def resilient_operation():
        await injector.inject()
        return "success"

    # Should eventually succeed despite 50% failure rate
    result = await resilient_operation()
    assert result == "success"


@pytest.mark.asyncio
async def test_timeout_with_latency_injection():
    """Test timeout behavior with injected latency"""
    injector = FaultInjector(failure_rate=0, latency_ms=500)

    async def slow_due_to_injection():
        await injector.inject()
        return "success"

    # 200ms timeout should fail with 500ms latency
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(slow_due_to_injection(), timeout=0.2)
```

---

## Integration Testing

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_full_resilience_stack():
    """Test all patterns working together"""
    from pybreaker import CircuitBreaker
    from tenacity import retry, stop_after_attempt

    circuit = CircuitBreaker(fail_max=3, reset_timeout=60)
    call_count = 0

    @retry(stop=stop_after_attempt(2))
    @circuit
    async def resilient_call():
        nonlocal call_count
        call_count += 1
        if call_count < 4:
            raise Exception("Transient")
        return "success"

    # First call: 2 retries, fails
    with pytest.raises(Exception):
        await resilient_call()
    assert call_count == 2

    # Second call: 2 retries, fails, opens circuit
    with pytest.raises(Exception):
        await resilient_call()
    assert call_count == 4  # Would be more but circuit limits
```

---

## Mock Service for Testing

```python
class MockExternalService:
    """Configurable mock service for testing"""

    def __init__(self):
        self.response_delay = 0
        self.failure_rate = 0
        self.failure_message = "Service error"
        self.call_count = 0

    async def call(self, *args, **kwargs):
        self.call_count += 1

        # Simulate latency
        if self.response_delay > 0:
            await asyncio.sleep(self.response_delay)

        # Simulate failures
        if random.random() < self.failure_rate:
            raise Exception(self.failure_message)

        return {"status": "ok", "call_count": self.call_count}


@pytest.fixture
def mock_service():
    return MockExternalService()


@pytest.mark.asyncio
async def test_with_mock_service(mock_service):
    """Test resilience with configurable mock"""
    mock_service.failure_rate = 0.3
    mock_service.response_delay = 0.1

    successes = 0
    failures = 0

    for _ in range(10):
        try:
            await mock_service.call()
            successes += 1
        except Exception:
            failures += 1

    # With 30% failure rate, expect some of each
    assert successes > 0
    assert failures > 0
```

---

## Best Practices

1. **Test each pattern independently** before combining
2. **Use deterministic tests** for unit tests (no randomness)
3. **Use statistical tests** for chaos engineering
4. **Mock external services** - don't call real APIs in tests
5. **Test edge cases**: zero timeout, 100% failure rate
6. **Test recovery**: verify circuit closes, retries succeed
