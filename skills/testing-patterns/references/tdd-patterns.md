# TDD Patterns - Detailed Reference

Test-Driven Development patterns, Red-Green-Refactor cycle, and boundary testing techniques.

---

## The Red-Green-Refactor Cycle

### Phase 1: RED - Write a Failing Test

**Purpose:** Define expected behavior before implementation.

```python
import pytest
from decimal import Decimal


# Step 1.1: Create test file following naming conventions
# File: tests/unit/services/test_pricing_service.py


# Step 1.2: Write descriptive test name
def test_calculate_total_with_quantity_discount_applies_10_percent():
    """Orders with 10+ items get 10% discount."""
    # Step 1.3: Apply Arrange-Act-Assert pattern

    # ARRANGE
    pricing_service = PricingService()
    items = [
        {"product_id": "A", "price": Decimal("10.00"), "quantity": 5},
        {"product_id": "B", "price": Decimal("20.00"), "quantity": 5},
    ]

    # ACT
    total = pricing_service.calculate_total(items)

    # ASSERT - 10 items total, (50 + 100) * 0.9 = 135
    assert total == Decimal("135.00")


# Step 1.4: Run test and verify it fails for the RIGHT reason
# pytest tests/unit/services/test_pricing_service.py
# Expected: ModuleNotFoundError or AttributeError (class doesn't exist)
```

### Phase 2: GREEN - Make the Test Pass

**Purpose:** Write minimum code to pass the test.

```python
# Step 2.1: Write minimum code to pass
from decimal import Decimal


class PricingService:
    """Pricing calculations for orders."""

    QUANTITY_DISCOUNT_THRESHOLD = 10
    QUANTITY_DISCOUNT_RATE = Decimal("0.10")

    def calculate_total(self, items: list[dict]) -> Decimal:
        """Calculate order total with applicable discounts."""
        subtotal = sum(
            Decimal(str(item["price"])) * item["quantity"]
            for item in items
        )

        total_quantity = sum(item["quantity"] for item in items)

        if total_quantity >= self.QUANTITY_DISCOUNT_THRESHOLD:
            discount = subtotal * self.QUANTITY_DISCOUNT_RATE
            return subtotal - discount

        return subtotal


# Step 2.2: Run tests and verify all pass
# pytest tests/unit/services/test_pricing_service.py -v
# Expected: 1 passed
```

### Phase 3: REFACTOR - Improve Code Quality

**Purpose:** Improve design while maintaining green tests.

```python
# Step 3.1: Identify improvement opportunities
# - Extract discount logic
# - Make thresholds configurable
# - Add type hints


# Step 3.2: Refactor incrementally (run tests after each change)
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


class DiscountStrategy(Protocol):
    """Protocol for discount calculations."""

    def calculate_discount(self, subtotal: Decimal, items: list[dict]) -> Decimal:
        ...


@dataclass
class QuantityDiscount:
    """Discount based on total quantity."""

    threshold: int = 10
    rate: Decimal = Decimal("0.10")

    def calculate_discount(self, subtotal: Decimal, items: list[dict]) -> Decimal:
        total_quantity = sum(item["quantity"] for item in items)
        if total_quantity >= self.threshold:
            return subtotal * self.rate
        return Decimal("0")


class PricingService:
    """Pricing calculations with pluggable discounts."""

    def __init__(self, discounts: list[DiscountStrategy] | None = None):
        self.discounts = discounts or [QuantityDiscount()]

    def calculate_total(self, items: list[dict]) -> Decimal:
        subtotal = self._calculate_subtotal(items)
        total_discount = sum(
            d.calculate_discount(subtotal, items) for d in self.discounts
        )
        return subtotal - total_discount

    def _calculate_subtotal(self, items: list[dict]) -> Decimal:
        return sum(
            Decimal(str(item["price"])) * item["quantity"]
            for item in items
        )


# Step 3.3: Verify tests still pass
# pytest tests/unit/services/test_pricing_service.py -v
# Expected: 1 passed
```

---

## Boundary Value Testing

### Identify Boundaries

For any range or threshold, test:
- Just below the boundary
- At the boundary
- Just above the boundary

```python
class TestQuantityDiscount:
    """Test discount threshold boundaries."""

    def test_9_items_no_discount(self):
        """Just below threshold - no discount."""
        service = PricingService()
        items = [{"product_id": "A", "price": Decimal("10.00"), "quantity": 9}]

        total = service.calculate_total(items)

        assert total == Decimal("90.00")  # No discount

    def test_10_items_gets_discount(self):
        """At threshold - discount applies."""
        service = PricingService()
        items = [{"product_id": "A", "price": Decimal("10.00"), "quantity": 10}]

        total = service.calculate_total(items)

        assert total == Decimal("90.00")  # 10% discount applied

    def test_11_items_gets_discount(self):
        """Above threshold - discount applies."""
        service = PricingService()
        items = [{"product_id": "A", "price": Decimal("10.00"), "quantity": 11}]

        total = service.calculate_total(items)

        assert total == Decimal("99.00")  # 10% discount: 110 * 0.9
```

### Edge Cases

```python
class TestEdgeCases:
    """Test edge cases and special values."""

    def test_empty_items_returns_zero(self):
        """Empty list should return zero."""
        service = PricingService()

        total = service.calculate_total([])

        assert total == Decimal("0")

    def test_zero_quantity_item_ignored(self):
        """Items with zero quantity don't contribute."""
        service = PricingService()
        items = [
            {"product_id": "A", "price": Decimal("10.00"), "quantity": 0},
            {"product_id": "B", "price": Decimal("20.00"), "quantity": 1},
        ]

        total = service.calculate_total(items)

        assert total == Decimal("20.00")

    def test_very_large_quantity(self):
        """Large quantities handled correctly."""
        service = PricingService()
        items = [{"product_id": "A", "price": Decimal("10.00"), "quantity": 1000000}]

        total = service.calculate_total(items)

        assert total == Decimal("9000000.00")  # With 10% discount

    def test_decimal_precision_maintained(self):
        """Decimal precision not lost in calculations."""
        service = PricingService()
        items = [{"product_id": "A", "price": Decimal("10.33"), "quantity": 3}]

        total = service.calculate_total(items)

        assert total == Decimal("30.99")
```

---

## Equivalence Partitioning

Group inputs into classes that should behave identically.

```python
class TestPasswordStrength:
    """Test password validation using equivalence partitions."""

    # Partition 1: Weak passwords (< 8 chars)
    @pytest.mark.parametrize("password", [
        "",           # Empty
        "a",          # Single char
        "abc123",     # 6 chars
        "1234567",    # 7 chars
    ])
    def test_weak_passwords_rejected(self, password):
        """Passwords under 8 characters are rejected."""
        assert validate_password(password).is_valid is False

    # Partition 2: Medium passwords (8-15 chars, basic requirements)
    @pytest.mark.parametrize("password", [
        "password123",     # 11 chars
        "MySecret99",      # 10 chars
        "Abcdefgh1",       # 9 chars
    ])
    def test_medium_passwords_accepted(self, password):
        """Medium strength passwords are accepted."""
        assert validate_password(password).is_valid is True

    # Partition 3: Strong passwords (16+ chars, all requirements)
    @pytest.mark.parametrize("password", [
        "MyVerySecureP@ss123!",
        "SuperStrong!Password99",
    ])
    def test_strong_passwords_accepted(self, password):
        """Strong passwords are accepted."""
        result = validate_password(password)
        assert result.is_valid is True
        assert result.strength == "strong"
```

---

## Test Independence

Each test should run independently without relying on other tests.

```python
# ❌ WRONG - Tests depend on each other
class TestUserBad:
    user = None

    def test_create_user(self):
        TestUserBad.user = create_user("test@example.com")
        assert TestUserBad.user is not None

    def test_update_user(self):
        # Depends on test_create_user running first!
        TestUserBad.user.name = "Updated"
        assert TestUserBad.user.name == "Updated"


# ✅ CORRECT - Each test is independent
class TestUserGood:

    @pytest.fixture
    def user(self):
        """Fresh user for each test."""
        return create_user("test@example.com")

    def test_create_user(self, user):
        assert user is not None
        assert user.email == "test@example.com"

    def test_update_user(self, user):
        user.name = "Updated"
        assert user.name == "Updated"

    def test_delete_user(self, user):
        delete_user(user.id)
        assert find_user(user.id) is None
```

---

## Test One Thing Per Test

```python
# ❌ WRONG - Testing multiple things
def test_user_authentication():
    # Testing registration
    result = register("test@example.com", "password")
    assert result.success
    assert result.user is not None

    # Testing login
    login_result = login("test@example.com", "password")
    assert login_result.success
    assert login_result.token is not None

    # Testing wrong password
    wrong_result = login("test@example.com", "wrong")
    assert wrong_result.success is False


# ✅ CORRECT - One thing per test
def test_register_creates_user():
    result = register("test@example.com", "password")
    assert result.success
    assert result.user.email == "test@example.com"


def test_login_with_valid_credentials_returns_token():
    register("test@example.com", "password")

    result = login("test@example.com", "password")

    assert result.success
    assert result.token is not None


def test_login_with_wrong_password_fails():
    register("test@example.com", "password")

    result = login("test@example.com", "wrong")

    assert result.success is False
    assert result.error == "Invalid credentials"
```

---

## Negative Testing

Always test failure paths, not just happy paths.

```python
class TestOrderCreation:
    """Test both success and failure scenarios."""

    # Happy path
    def test_create_order_success(self, authenticated_user, available_product):
        result = create_order(
            user_id=authenticated_user.id,
            items=[{"product_id": available_product.id, "quantity": 1}]
        )
        assert result.success is True
        assert result.order.status == "pending"

    # Failure: Unauthenticated
    def test_create_order_without_auth_fails(self, available_product):
        result = create_order(
            user_id=None,
            items=[{"product_id": available_product.id, "quantity": 1}]
        )
        assert result.success is False
        assert result.error == "Authentication required"

    # Failure: Empty cart
    def test_create_order_empty_items_fails(self, authenticated_user):
        result = create_order(user_id=authenticated_user.id, items=[])
        assert result.success is False
        assert result.error == "Order must have at least one item"

    # Failure: Out of stock
    def test_create_order_out_of_stock_fails(self, authenticated_user, out_of_stock_product):
        result = create_order(
            user_id=authenticated_user.id,
            items=[{"product_id": out_of_stock_product.id, "quantity": 1}]
        )
        assert result.success is False
        assert "out of stock" in result.error.lower()

    # Failure: Invalid quantity
    def test_create_order_negative_quantity_fails(self, authenticated_user, available_product):
        result = create_order(
            user_id=authenticated_user.id,
            items=[{"product_id": available_product.id, "quantity": -1}]
        )
        assert result.success is False
        assert result.error == "Quantity must be positive"
```

---

## TDD Best Practices Checklist

- [ ] Write test BEFORE implementation
- [ ] Test fails for expected reason (not syntax errors)
- [ ] Write minimum code to pass
- [ ] Refactor after green
- [ ] One logical assertion per test
- [ ] Test both happy and failure paths
- [ ] Test boundary values
- [ ] Each test is independent
- [ ] Descriptive test names
- [ ] AAA pattern (Arrange-Act-Assert)
