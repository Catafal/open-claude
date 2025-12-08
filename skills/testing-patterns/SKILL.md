---
name: testing-patterns
description: Test-First Development patterns including TDD, BDD, and integration testing strategies. Use when writing tests, designing test architecture, or implementing CI/CD testing. Triggers on TDD, test-driven development, BDD, behavior-driven development, red green refactor, Gherkin, Given When Then, test pyramid, integration testing, unit testing, pytest, jest, test coverage, mock, stub, fake, test doubles, CI/CD testing, test first.
---

# Testing Patterns

Comprehensive patterns for **Test-First Development**, including TDD, BDD, and integration testing strategies for building reliable, maintainable software.

---

## Quick Reference

| Pattern | Purpose | Key Concept |
|---------|---------|-------------|
| **TDD** | Write tests first | Red-Green-Refactor cycle |
| **BDD** | Business-readable specs | Given-When-Then |
| **Test Pyramid** | Balance test types | Unit 60% > Integration 30% > E2E 10% |
| **AAA Pattern** | Structure tests | Arrange-Act-Assert |
| **Test Doubles** | Isolate dependencies | Mock, Stub, Fake, Spy |

---

## Test-Driven Development (TDD)

### The Red-Green-Refactor Cycle

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   1. RED       2. GREEN      3. REFACTOR       │
│   Write a     Make it       Improve code       │
│   failing     pass with     while keeping      │
│   test        minimal code  tests green        │
│                                                 │
│   [FAIL] ──→ [PASS] ──→ [PASS] ──→ [FAIL]...  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### TDD Example

```python
import pytest
from decimal import Decimal

# STEP 1: RED - Write a failing test
def test_calculate_discount_for_premium_member():
    """Premium members get 15% discount."""
    calculator = DiscountCalculator()

    discount = calculator.calculate(
        subtotal=Decimal("100.00"),
        member_tier="premium"
    )

    assert discount == Decimal("15.00")


# Run: pytest → FAILS (DiscountCalculator doesn't exist)


# STEP 2: GREEN - Write minimum code to pass
class DiscountCalculator:
    def calculate(self, subtotal: Decimal, member_tier: str) -> Decimal:
        if member_tier == "premium":
            return subtotal * Decimal("0.15")
        return Decimal("0")


# Run: pytest → PASSES


# STEP 3: REFACTOR - Improve while keeping green
class DiscountCalculator:
    DISCOUNT_RATES = {
        "standard": Decimal("0.05"),
        "premium": Decimal("0.15"),
        "vip": Decimal("0.25"),
    }

    def calculate(self, subtotal: Decimal, member_tier: str) -> Decimal:
        rate = self.DISCOUNT_RATES.get(member_tier, Decimal("0"))
        return subtotal * rate


# Run: pytest → STILL PASSES
```

### AAA Pattern (Arrange-Act-Assert)

```python
def test_user_registration_creates_account():
    # ARRANGE - Set up test data and dependencies
    user_service = UserService(
        repository=InMemoryUserRepository(),
        email_service=MockEmailService()
    )
    registration_data = {
        "email": "test@example.com",
        "password": "SecurePass123!",
        "name": "Test User"
    }

    # ACT - Execute the behavior being tested
    result = user_service.register(registration_data)

    # ASSERT - Verify expected outcome
    assert result.success is True
    assert result.user.email == "test@example.com"
    assert result.user.id is not None
```

---

## Behavior-Driven Development (BDD)

### Discovery-Formulation-Automation Cycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  DISCOVERY   │ ──→ │ FORMULATION  │ ──→ │  AUTOMATION  │
│              │     │              │     │              │
│ What could   │     │ What should  │     │ What does    │
│ it do?       │     │ it do?       │     │ it actually  │
│              │     │              │     │ do?          │
│ (Workshop)   │     │ (Gherkin)    │     │ (Code)       │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Gherkin Syntax

```gherkin
Feature: User Authentication
  As a registered user
  I want to log in to my account
  So that I can access protected features

  Scenario: Successful login with valid credentials
    Given a user with email "user@example.com" exists
    And the user's password is "SecurePass123!"
    When the user logs in with email "user@example.com" and password "SecurePass123!"
    Then the login should succeed
    And the user should receive an access token
    And the token should expire in 24 hours

  Scenario: Failed login with wrong password
    Given a user with email "user@example.com" exists
    When the user logs in with email "user@example.com" and password "wrong_password"
    Then the login should fail
    And the error message should be "Invalid credentials"

  Scenario Outline: Password validation
    When a user attempts to register with password "<password>"
    Then the registration should "<result>"

    Examples:
      | password        | result  |
      | short           | fail    |
      | NoNumbers       | fail    |
      | ValidPass123    | succeed |
```

### Step Definitions (Python/Behave)

```python
from behave import given, when, then


@given('a user with email "{email}" exists')
def step_impl(context, email):
    context.user = create_test_user(email=email)


@given('the user\'s password is "{password}"')
def step_impl(context, password):
    context.user.set_password(password)
    context.db.save(context.user)


@when('the user logs in with email "{email}" and password "{password}"')
def step_impl(context, email, password):
    context.response = context.auth_service.login(email, password)


@then('the login should succeed')
def step_impl(context):
    assert context.response.success is True


@then('the user should receive an access token')
def step_impl(context):
    assert context.response.token is not None
    assert len(context.response.token) > 0
```

---

## Test Pyramid

### Structure

```
        /\
       /  \          E2E Tests (10%)
      /____\         - Full user workflows
     /      \        - Slow, expensive
    /        \       - Few but critical
   /__________\
  /            \     Integration Tests (30%)
 /              \    - Component interaction
/________________\   - API contracts
                     - Database operations

Unit Tests (60%)
- Individual functions
- Fast, isolated
- Many tests
```

### Coverage Targets

| Test Level | Coverage Target | Execution Speed | Cost |
|------------|-----------------|-----------------|------|
| Unit | 80% line coverage | < 1ms per test | Low |
| Integration | All critical paths | < 500ms per test | Medium |
| E2E/Acceptance | Major workflows | < 10s per test | High |

---

## Test Doubles

### Types and When to Use

| Double | Purpose | Use When |
|--------|---------|----------|
| **Mock** | Verify interactions | Testing method calls |
| **Stub** | Provide canned responses | Need predictable data |
| **Fake** | Simplified implementation | Need working but simple version |
| **Spy** | Record calls for later | Need to verify calls without replacing |

### Examples

```python
from unittest.mock import Mock, MagicMock, patch


# MOCK - Verify interactions
def test_order_sends_notification():
    notification_service = Mock()
    order_service = OrderService(notification=notification_service)

    order_service.complete_order(order_id="123")

    notification_service.send.assert_called_once_with(
        type="order_complete",
        order_id="123"
    )


# STUB - Provide canned responses
def test_get_user_returns_cached_data():
    cache = Mock()
    cache.get.return_value = {"id": "123", "name": "John"}  # Stubbed response

    user_service = UserService(cache=cache)
    user = user_service.get_user("123")

    assert user.name == "John"


# FAKE - Simplified working implementation
class FakeUserRepository:
    """In-memory implementation for testing."""

    def __init__(self):
        self.users = {}

    def save(self, user):
        self.users[user.id] = user

    def find_by_id(self, user_id):
        return self.users.get(user_id)


def test_user_creation():
    repo = FakeUserRepository()  # Works but simpler than real DB
    service = UserService(repository=repo)

    user = service.create_user({"name": "John", "email": "john@example.com"})

    assert repo.find_by_id(user.id) is not None


# SPY - Record calls
def test_logging_during_process():
    logger = Mock()
    processor = DataProcessor(logger=logger)

    processor.process(data)

    # Spy: Check what was logged
    assert logger.info.call_count == 3
    assert "Starting process" in str(logger.info.call_args_list[0])
```

---

## Test Naming Conventions

### Pattern: `test_<method>_<condition>_<expected_result>`

```python
# Good names - clear and descriptive
def test_authenticate_with_valid_credentials_returns_token(): pass
def test_calculate_discount_with_zero_subtotal_returns_zero(): pass
def test_validate_email_with_invalid_format_raises_error(): pass
def test_process_order_when_out_of_stock_raises_insufficient_stock_error(): pass

# Bad names - vague or too technical
def test_auth(): pass
def test_happy_path(): pass
def test_it_works(): pass
def test_scenario_1(): pass
```

---

## Test Organization

```
tests/
├── unit/                           # Fast, isolated tests
│   ├── services/
│   │   ├── test_user_service.py
│   │   └── test_order_service.py
│   ├── models/
│   │   └── test_user.py
│   └── utils/
│       └── test_validators.py
├── integration/                    # Component interaction tests
│   ├── api/
│   │   ├── test_auth_endpoints.py
│   │   └── test_order_endpoints.py
│   └── database/
│       └── test_user_repository.py
├── e2e/                           # End-to-end tests
│   └── test_checkout_flow.py
├── features/                      # BDD scenarios
│   ├── authentication/
│   │   └── login.feature
│   └── orders/
│       └── checkout.feature
├── conftest.py                    # Shared fixtures
└── factories.py                   # Test data factories
```

---

## Fixtures and Test Data

### Pytest Fixtures

```python
# conftest.py
import pytest
from your_app import create_app, db


@pytest.fixture
def app():
    """Create application for testing."""
    app = create_app(testing=True)
    yield app


@pytest.fixture
def client(app):
    """Test client for API testing."""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Database session with automatic cleanup."""
    with app.app_context():
        db.create_all()
        yield db.session
        db.session.rollback()
        db.drop_all()


@pytest.fixture
def authenticated_user(db_session):
    """Create and return an authenticated user."""
    user = User(email="test@example.com", name="Test User")
    user.set_password("password123")
    db_session.add(user)
    db_session.commit()
    return user
```

### Factory Pattern for Test Data

```python
# factories.py
import factory
from datetime import datetime
from your_app.models import User, Order


class UserFactory(factory.Factory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f'user{n}@example.com')
    name = factory.Faker('name')
    created_at = factory.LazyFunction(datetime.utcnow)


class OrderFactory(factory.Factory):
    class Meta:
        model = Order

    order_id = factory.Sequence(lambda n: f'ORD-{n:05d}')
    user = factory.SubFactory(UserFactory)
    status = "pending"
    total = factory.Faker('pydecimal', min_value=10, max_value=1000)


# Usage in tests
def test_order_processing():
    user = UserFactory(name="John Doe")
    order = OrderFactory(user=user, status="pending")

    assert order.user.name == "John Doe"
```

---

## CI/CD Testing Strategy

### Pipeline Stages

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on: [push, pull_request]

jobs:
  # Stage 1: Fast Feedback (< 2 minutes)
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests
        run: pytest tests/unit --cov=src --cov-fail-under=80

  # Stage 2: Integration (< 10 minutes)
  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests
        run: pytest tests/integration

  # Stage 3: E2E (< 30 minutes)
  e2e-tests:
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run E2E tests
        run: pytest tests/e2e

  # Stage 4: BDD Scenarios
  bdd-tests:
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run BDD scenarios
        run: behave tests/features
```

---

## Quality Metrics

| Metric | Target | Red Threshold |
|--------|--------|---------------|
| Line Coverage | ≥ 80% | < 70% |
| Branch Coverage | ≥ 70% | < 60% |
| Test Success Rate | 100% | < 95% |
| Test Flakiness | < 1% | > 5% |
| Build Time | < 10 min | > 15 min |

---

## See Also

### In This Skill
- [TDD Patterns](references/tdd-patterns.md) - Red-Green-Refactor, boundary testing
- [BDD Patterns](references/bdd-patterns.md) - Gherkin syntax, Example Mapping
- [Integration Testing](references/integration-testing.md) - Big Bang, Top-Down, Bottom-Up
- [Test Pyramid](references/test-pyramid.md) - Unit/Integration/E2E balance
- [Anti-Patterns](references/anti-patterns.md) - Common testing mistakes

### Related Skills
- **backend-patterns** - Repository, Service Layer patterns
- **frontend-patterns** - React Testing Library patterns
