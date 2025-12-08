# Testing Anti-Patterns

Common testing mistakes and how to fix them.

---

## Flaky Tests

**Description:** Tests that sometimes pass and sometimes fail without code changes.

### Detection

```python
# FLAKY: Depends on timing
def test_async_operation():
    start_async_operation()
    time.sleep(1)  # Hope it's done by now!
    assert get_result() is not None


# FLAKY: Depends on test order
class TestUser:
    def test_create(self):
        create_user("test@example.com")

    def test_find(self):
        # Assumes test_create ran first!
        user = find_user("test@example.com")
        assert user is not None


# FLAKY: Depends on current time
def test_is_expired():
    token = create_token(expires_in_minutes=5)
    # Might fail if test runs at 23:59
    assert token.expires_at.date() == datetime.now().date()
```

### Solution

```python
# FIXED: Explicit waiting
def test_async_operation():
    start_async_operation()

    # Wait with timeout and condition
    result = wait_for(
        condition=lambda: get_result() is not None,
        timeout=5.0,
        poll_interval=0.1
    )
    assert result is not None


# FIXED: Independent tests
class TestUser:
    @pytest.fixture
    def user(self):
        return create_user("test@example.com")

    def test_create(self, user):
        assert user.email == "test@example.com"

    def test_find(self, user):
        found = find_user(user.email)
        assert found.id == user.id


# FIXED: Freeze time
from freezegun import freeze_time

@freeze_time("2025-01-15 12:00:00")
def test_is_expired():
    token = create_token(expires_in_minutes=5)
    assert token.expires_at == datetime(2025, 1, 15, 12, 5, 0)
```

---

## Over-Mocking

**Description:** Mocking so much that tests don't verify real behavior.

### Detection

```python
# OVER-MOCKED: Tests nothing real
def test_create_order(
    mock_order_service,
    mock_payment_service,
    mock_inventory_service,
    mock_notification_service,
    mock_logger
):
    mock_order_service.create.return_value = Order(id="123")
    mock_payment_service.charge.return_value = PaymentResult(success=True)
    mock_inventory_service.reserve.return_value = True

    # What are we actually testing here?
    result = checkout(
        mock_order_service,
        mock_payment_service,
        mock_inventory_service,
        mock_notification_service
    )

    # Just verifying mocks were called - no real behavior tested
    mock_order_service.create.assert_called_once()
```

### Solution

```python
# Use real implementations for unit tests
def test_order_calculates_total_correctly():
    order = Order()
    order.add_item(product=Product(price=29.99), quantity=2)
    order.add_item(product=Product(price=15.00), quantity=1)

    assert order.total == Decimal("74.98")


# Use fakes instead of mocks for integration
class FakePaymentGateway:
    """Fake that behaves like real gateway."""

    def __init__(self):
        self.charges = []

    def charge(self, amount: Decimal, token: str) -> PaymentResult:
        if token == "FAIL":
            return PaymentResult(success=False, error="Card declined")

        self.charges.append({"amount": amount, "token": token})
        return PaymentResult(success=True, transaction_id=str(uuid4()))


def test_checkout_processes_payment(test_db):
    gateway = FakePaymentGateway()
    checkout_service = CheckoutService(
        order_repo=RealOrderRepository(test_db),
        payment=gateway
    )

    result = checkout_service.process(cart, token="valid_token")

    assert result.success
    assert len(gateway.charges) == 1
```

---

## Testing Implementation Details

**Description:** Tests that break when refactoring even though behavior is unchanged.

### Detection

```python
# BRITTLE: Tests internal implementation
def test_user_service_uses_cache():
    service = UserService()
    service.get_user("123")

    # Breaks if we change caching strategy
    assert service._cache["123"] is not None
    assert service._cache_hits == 0
    assert service._cache_misses == 1


# BRITTLE: Tests private method
def test_calculate_internal_score():
    calculator = ScoreCalculator()

    # Private method - implementation detail
    score = calculator._calculate_weighted_average([1, 2, 3], [0.5, 0.3, 0.2])

    assert score == 1.7
```

### Solution

```python
# ROBUST: Tests public behavior
def test_user_service_returns_user_data():
    service = UserService()

    user = service.get_user("123")

    assert user.id == "123"
    assert user.name is not None


# ROBUST: Tests observable behavior
def test_get_user_caches_result():
    db = Mock()
    db.query.return_value = User(id="123", name="John")
    service = UserService(db=db)

    # First call
    user1 = service.get_user("123")
    # Second call
    user2 = service.get_user("123")

    # Verify behavior (not implementation)
    assert user1.id == user2.id
    assert db.query.call_count == 1  # Called once, cached second time
```

---

## Test-After Development (TAD)

**Description:** Writing tests after implementation, leading to tests that validate what code does, not what it should do.

### Detection

```python
# TAD: Test mirrors implementation exactly
def test_format_name():
    """Written after seeing the implementation."""
    result = format_name("john", "doe")

    # Just validates current behavior, not requirements
    assert result == "John Doe"  # But should it be "DOE, John"?


# TAD: Tests happy path only
def test_divide():
    result = divide(10, 2)
    assert result == 5
    # Never thought about divide by zero!
```

### Solution

```python
# TDD: Test defines expected behavior FIRST
def test_format_name_capitalizes_first_letters():
    """Written BEFORE implementation."""
    result = format_name("john", "doe")
    assert result == "John Doe"


def test_format_name_handles_already_capitalized():
    result = format_name("JOHN", "DOE")
    assert result == "John Doe"  # Normalize


def test_format_name_handles_empty_input():
    with pytest.raises(ValueError):
        format_name("", "doe")


# TDD: Think about edge cases BEFORE implementation
def test_divide_by_zero_raises_error():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)
```

---

## Insufficient Negative Testing

**Description:** Testing only happy paths, missing error scenarios.

### Detection

```python
# INCOMPLETE: Only happy path
class TestUserRegistration:
    def test_register_user(self):
        result = register("valid@email.com", "SecurePass123!")
        assert result.success is True

    # Missing:
    # - Invalid email
    # - Weak password
    # - Duplicate email
    # - Empty fields
    # - SQL injection attempts
```

### Solution

```python
# COMPLETE: Test all scenarios
class TestUserRegistration:
    # Happy path
    def test_register_with_valid_data_succeeds(self):
        result = register("valid@email.com", "SecurePass123!")
        assert result.success is True

    # Validation errors
    def test_register_with_invalid_email_fails(self):
        result = register("not-an-email", "SecurePass123!")
        assert result.success is False
        assert "Invalid email" in result.error

    def test_register_with_weak_password_fails(self):
        result = register("valid@email.com", "weak")
        assert result.success is False
        assert "Password too weak" in result.error

    # Business rules
    def test_register_with_duplicate_email_fails(self):
        register("existing@email.com", "SecurePass123!")
        result = register("existing@email.com", "SecurePass123!")
        assert result.success is False
        assert "Email already registered" in result.error

    # Edge cases
    def test_register_with_empty_email_fails(self):
        result = register("", "SecurePass123!")
        assert result.success is False

    # Security
    def test_register_sanitizes_email(self):
        result = register("test@email.com'; DROP TABLE users;--", "SecurePass123!")
        # Should handle safely, not execute SQL
        assert result.success is False or "test@email.com" not in result.user.email
```

---

## Slow Test Suites

**Description:** Tests take too long, developers skip running them.

### Detection

```bash
# Test suite takes > 10 minutes
$ pytest
================== 500 passed in 15:32 ==================

# Symptoms:
# - Developers skip tests locally
# - CI pipeline is a bottleneck
# - Tests run only on PR, not during development
```

### Solution

```python
# 1. Follow test pyramid (more unit, fewer E2E)

# 2. Mark slow tests
@pytest.mark.slow
def test_complex_integration():
    pass

# Run fast tests by default
# pytest -m "not slow"


# 3. Use in-memory databases for unit tests
@pytest.fixture
def fast_db():
    engine = create_engine("sqlite:///:memory:")
    yield engine


# 4. Parallelize tests
# pytest -n auto  # Use all CPU cores


# 5. Use test fixtures efficiently
@pytest.fixture(scope="module")  # Not scope="function"
def expensive_setup():
    # Only runs once per module
    return setup_expensive_resource()


# 6. Profile slow tests
# pytest --durations=10  # Show 10 slowest tests
```

---

## Assertion Roulette

**Description:** Multiple assertions without clear failure messages.

### Detection

```python
# BAD: Which assertion failed?
def test_user_profile():
    user = get_user_profile("123")
    assert user.name == "John"
    assert user.email == "john@example.com"
    assert user.age == 30
    assert user.active is True
    assert len(user.orders) == 5
    assert user.created_at.year == 2024
    # If this fails, output: "AssertionError" - which one?
```

### Solution

```python
# GOOD: Clear, focused tests
def test_user_profile_returns_correct_name():
    user = get_user_profile("123")
    assert user.name == "John", f"Expected 'John', got '{user.name}'"


def test_user_profile_returns_correct_email():
    user = get_user_profile("123")
    assert user.email == "john@example.com"


# Or use structured assertions
def test_user_profile():
    user = get_user_profile("123")

    # Descriptive assertion messages
    assert user.name == "John", "User name should be 'John'"
    assert user.active, "User should be active"

    # Or verify object as a whole
    expected = UserProfile(
        name="John",
        email="john@example.com",
        active=True
    )
    assert user == expected  # Single clear assertion
```

---

## Detection Checklist

| Code Smell | Anti-Pattern |
|------------|--------------|
| `time.sleep()` in tests | Flaky Tests |
| Every dependency is mocked | Over-Mocking |
| Tests break on refactoring | Testing Implementation |
| Tests written after code | TAD (Test-After Development) |
| Only happy path tested | Insufficient Negative Testing |
| Test suite > 10 minutes | Slow Test Suite |
| Multiple asserts, unclear failure | Assertion Roulette |
| `@skip` or `@xfail` growing | Ignored/Skipped Tests |
| Tests depend on order | Test Coupling |

---

## Quick Fixes

1. **Flaky tests** → Use explicit waits, freeze time, isolate tests
2. **Over-mocking** → Use fakes, test real behavior
3. **Testing implementation** → Test public interfaces only
4. **TAD** → Write tests first (TDD)
5. **Missing negative tests** → Ask "what could go wrong?"
6. **Slow tests** → Follow pyramid, parallelize, profile
7. **Assertion roulette** → One logical assertion per test
8. **Ignored tests** → Fix or delete, never ignore
9. **Test coupling** → Use fixtures, each test independent
