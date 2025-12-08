# Test Pyramid - Detailed Reference

Balancing Unit, Integration, and End-to-End tests for optimal coverage and speed.

---

## The Test Pyramid

```
                 /\
                /  \          End-to-End Tests (10%)
               /    \         Slow, expensive, fragile
              /______\        Test user journeys
             /        \
            /          \      Integration Tests (30%)
           /____________\     Moderate speed
          /              \    Test component interaction
         /                \
        /__________________\  Unit Tests (60%)
                              Fast, cheap, stable
                              Test individual units
```

---

## Unit Tests (60%)

### Characteristics
- **Speed:** < 1ms per test
- **Isolation:** No external dependencies
- **Scope:** Single function, method, or class
- **Cost:** Low (no infrastructure needed)

### What to Unit Test

```python
# Business logic
def test_calculate_tax():
    result = calculate_tax(subtotal=100, tax_rate=0.08)
    assert result == Decimal("8.00")


# Data transformations
def test_format_currency():
    result = format_currency(1234.56)
    assert result == "$1,234.56"


# Validation rules
def test_validate_email_rejects_invalid():
    result = validate_email("not-an-email")
    assert result.is_valid is False
    assert "Invalid email format" in result.error


# State transitions
def test_order_can_transition_from_pending_to_processing():
    order = Order(status=OrderStatus.PENDING)
    order.start_processing()
    assert order.status == OrderStatus.PROCESSING


# Edge cases
def test_divide_by_zero_raises_error():
    with pytest.raises(DivisionError):
        calculate_average([])
```

### What NOT to Unit Test

```python
# ❌ Don't unit test third-party code
def test_json_dumps_works():
    result = json.dumps({"key": "value"})  # Trust the library
    assert result == '{"key": "value"}'


# ❌ Don't unit test trivial code
def test_getter_returns_value():
    user = User(name="John")
    assert user.name == "John"  # No logic to test


# ❌ Don't unit test framework code
def test_fastapi_route_decorator():
    # Trust FastAPI handles routes correctly
    pass
```

### Unit Test Structure

```python
# tests/unit/services/test_pricing_service.py

import pytest
from decimal import Decimal
from unittest.mock import Mock

from app.services.pricing import PricingService, DiscountCalculator


class TestPricingService:
    """Unit tests for PricingService."""

    @pytest.fixture
    def mock_discount_calculator(self):
        return Mock(spec=DiscountCalculator)

    @pytest.fixture
    def pricing_service(self, mock_discount_calculator):
        return PricingService(discount_calculator=mock_discount_calculator)

    def test_calculate_subtotal_sums_item_prices(self, pricing_service):
        items = [
            {"price": Decimal("10.00"), "quantity": 2},
            {"price": Decimal("25.00"), "quantity": 1},
        ]

        result = pricing_service.calculate_subtotal(items)

        assert result == Decimal("45.00")

    def test_calculate_subtotal_empty_list_returns_zero(self, pricing_service):
        result = pricing_service.calculate_subtotal([])
        assert result == Decimal("0")

    def test_apply_discount_uses_calculator(
        self,
        pricing_service,
        mock_discount_calculator
    ):
        mock_discount_calculator.calculate.return_value = Decimal("5.00")

        result = pricing_service.apply_discount(
            subtotal=Decimal("50.00"),
            discount_code="SAVE10"
        )

        mock_discount_calculator.calculate.assert_called_once_with(
            Decimal("50.00"),
            "SAVE10"
        )
        assert result == Decimal("45.00")
```

---

## Integration Tests (30%)

### Characteristics
- **Speed:** 100ms - 1s per test
- **Dependencies:** Real databases, caches, message queues
- **Scope:** Multiple components working together
- **Cost:** Medium (needs test infrastructure)

### What to Integration Test

```python
# Database operations
def test_user_repository_saves_and_retrieves(db_session):
    repo = UserRepository(db_session)
    user = User(email="test@example.com", name="Test")

    saved = repo.save(user)
    retrieved = repo.find_by_id(saved.id)

    assert retrieved.email == "test@example.com"


# API endpoints
def test_create_order_endpoint(client, authenticated_user, test_db):
    response = client.post(
        "/api/orders",
        json={"items": [{"product_id": "P1", "quantity": 2}]},
        headers={"Authorization": f"Bearer {authenticated_user.token}"}
    )

    assert response.status_code == 201
    assert "order_id" in response.json()


# Service interactions
def test_checkout_service_processes_payment(
    checkout_service,
    test_db,
    test_payment_gateway
):
    cart = create_cart_with_items()

    result = checkout_service.process(cart)

    assert result.payment_status == "completed"
    assert result.order.status == "paid"


# External service integration
def test_email_service_sends_via_smtp(email_service, smtp_server):
    email_service.send(
        to="recipient@example.com",
        subject="Test",
        body="Hello"
    )

    assert len(smtp_server.received) == 1
    assert smtp_server.received[0]["to"] == "recipient@example.com"
```

### Integration Test Setup

```python
# conftest.py for integration tests

import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer


@pytest.fixture(scope="session")
def postgres_container():
    """Spin up PostgreSQL container for tests."""
    with PostgresContainer("postgres:15") as postgres:
        yield postgres


@pytest.fixture(scope="function")
def test_db(postgres_container):
    """Fresh database for each test."""
    engine = create_engine(postgres_container.get_connection_url())
    Base.metadata.create_all(engine)

    yield engine

    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session")
def redis_container():
    """Spin up Redis container for tests."""
    with RedisContainer("redis:7") as redis:
        yield redis
```

---

## End-to-End Tests (10%)

### Characteristics
- **Speed:** 1s - 30s per test
- **Dependencies:** Full system running
- **Scope:** Complete user workflows
- **Cost:** High (needs full environment)

### What to E2E Test

```python
# Critical user journeys only
def test_new_user_signup_and_first_purchase(browser, test_environment):
    """E2E: Complete new user flow."""
    # Sign up
    browser.get("/signup")
    browser.fill("email", "new@example.com")
    browser.fill("password", "SecurePass123!")
    browser.click("submit")
    assert browser.current_url == "/welcome"

    # Browse products
    browser.click("shop")
    browser.click("product-1")
    browser.click("add-to-cart")

    # Checkout
    browser.click("checkout")
    browser.fill("card-number", "4111111111111111")
    browser.fill("expiry", "12/25")
    browser.fill("cvv", "123")
    browser.click("place-order")

    # Verify
    assert "Order Confirmed" in browser.page_source
    assert "confirmation email" in browser.page_source


# Happy paths for core features
def test_returning_user_reorders(browser, existing_user, previous_order):
    """E2E: Reorder flow for returning customer."""
    browser.login(existing_user)
    browser.get(f"/orders/{previous_order.id}")
    browser.click("reorder")
    browser.click("confirm")

    assert "Order Placed" in browser.page_source
```

### E2E Test Best Practices

```python
# Keep E2E tests focused on critical paths
class TestCriticalUserJourneys:
    """E2E tests for most important user flows."""

    @pytest.mark.e2e
    def test_signup_to_first_purchase(self, browser):
        """Most critical conversion funnel."""
        pass

    @pytest.mark.e2e
    def test_login_and_checkout_existing_cart(self, browser):
        """Key returning customer flow."""
        pass

    @pytest.mark.e2e
    def test_password_reset_flow(self, browser):
        """Important recovery flow."""
        pass

# Use page objects for maintainability
class CheckoutPage:
    def __init__(self, browser):
        self.browser = browser

    def fill_payment_details(self, card_number, expiry, cvv):
        self.browser.fill("card-number", card_number)
        self.browser.fill("expiry", expiry)
        self.browser.fill("cvv", cvv)

    def place_order(self):
        self.browser.click("place-order")
        return OrderConfirmationPage(self.browser)


def test_checkout(browser):
    checkout = CheckoutPage(browser)
    checkout.fill_payment_details("4111111111111111", "12/25", "123")
    confirmation = checkout.place_order()
    assert confirmation.order_number is not None
```

---

## Anti-Pattern: Ice Cream Cone

```
    ❌ ANTI-PATTERN: Inverted Pyramid

    ┌──────────────────────────────────┐
    │        E2E Tests (60%)           │
    │    Slow, fragile, expensive      │
    └──────────────────────────────────┘
           /                    \
          /   Integration (30%)  \
         /                        \
        ┌──────────────────────────┐
        │     Unit Tests (10%)     │
        │    Neglected            │
        └──────────────────────────┘

Problems:
- Slow feedback loop
- Hard to debug failures
- Expensive to maintain
- Fragile tests
```

---

## Coverage Guidelines

### Per Layer

| Test Type | Line Coverage | Branch Coverage |
|-----------|---------------|-----------------|
| Unit | 80% minimum | 70% minimum |
| Integration | Critical paths | N/A |
| E2E | Major journeys | N/A |

### What Coverage Means

```python
# High coverage ≠ Good tests

# ❌ High coverage, poor test
def test_calculate_total():
    service = PricingService()
    result = service.calculate_total([])
    assert result >= 0  # Always passes, tests nothing useful


# ✅ Meaningful coverage
def test_calculate_total_with_discount():
    service = PricingService()
    items = [{"price": 100, "quantity": 2}]  # $200 subtotal

    result = service.calculate_total(items, discount_code="SAVE10")

    assert result == Decimal("180.00")  # 10% off
```

---

## Test Execution Strategy

### During Development

```bash
# Run unit tests continuously (watch mode)
pytest tests/unit --watch

# Run affected tests before commit
pytest tests/unit tests/integration -x --tb=short
```

### In CI/CD Pipeline

```yaml
stages:
  # Stage 1: Fast feedback (< 2 min)
  unit:
    - pytest tests/unit --cov=src --cov-fail-under=80

  # Stage 2: Integration (< 10 min)
  integration:
    needs: unit
    - pytest tests/integration

  # Stage 3: E2E (< 30 min, can run in parallel)
  e2e:
    needs: integration
    - pytest tests/e2e -n 4  # 4 parallel processes

  # Nightly: Full regression
  nightly:
    schedule: "0 2 * * *"
    - pytest tests/ --full-regression
```

---

## Test Pyramid Checklist

### Unit Tests
- [ ] 60%+ of test suite
- [ ] < 1ms per test average
- [ ] No external dependencies
- [ ] All business logic covered
- [ ] 80%+ line coverage

### Integration Tests
- [ ] 30% of test suite
- [ ] < 1s per test average
- [ ] Test database used (same type as prod)
- [ ] All API endpoints tested
- [ ] Critical service interactions covered

### E2E Tests
- [ ] 10% of test suite
- [ ] Only critical user journeys
- [ ] Stable selectors (data-testid)
- [ ] Page objects for maintainability
- [ ] Runs in CI pipeline
