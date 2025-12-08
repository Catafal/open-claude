# Integration Testing - Detailed Reference

Strategies for testing component interactions: Big Bang, Top-Down, Bottom-Up, and Sandwich approaches.

---

## Integration Testing Approaches

### Comparison

| Approach | When to Use | Pros | Cons |
|----------|-------------|------|------|
| **Big Bang** | Small projects (< 10 modules) | Simple, fast for small systems | Hard to isolate failures |
| **Top-Down** | User-facing features critical | Early UI validation | Needs stubs |
| **Bottom-Up** | Stable data/utility layers | No stubs needed | Late UI testing |
| **Sandwich** | Large, complex systems | Balanced approach | Complex coordination |

---

## Big Bang Integration

**All modules integrated simultaneously.**

```
    ┌─────────────────────────────────────────┐
    │         All Modules Combined            │
    │                                         │
    │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
    │  │ A │ │ B │ │ C │ │ D │ │ E │       │
    │  └───┘ └───┘ └───┘ └───┘ └───┘       │
    │                                         │
    │         Single Integration Test         │
    └─────────────────────────────────────────┘
```

### When to Use
- Small applications (< 10 modules)
- Simple, well-understood interactions
- All modules ready simultaneously

### Example

```python
# tests/integration/test_order_system.py

import pytest
from app.services import (
    UserService,
    ProductService,
    OrderService,
    PaymentService,
    NotificationService
)


class TestOrderSystemIntegration:
    """Big Bang: Test all services working together."""

    @pytest.fixture
    def services(self, test_db, test_email):
        """Create all services with real dependencies."""
        return {
            'user': UserService(test_db),
            'product': ProductService(test_db),
            'order': OrderService(test_db),
            'payment': PaymentService(test_db),
            'notification': NotificationService(test_email)
        }

    def test_complete_order_flow(self, services):
        """Test entire order flow - all components at once."""
        # Setup
        user = services['user'].create_user(
            email="test@example.com",
            name="Test User"
        )
        product = services['product'].create_product(
            name="Test Product",
            price=99.99,
            stock=10
        )

        # Execute full flow
        order = services['order'].create_order(
            user_id=user.id,
            items=[{"product_id": product.id, "quantity": 2}]
        )

        payment = services['payment'].process_payment(
            order_id=order.id,
            amount=order.total
        )

        services['notification'].send_order_confirmation(
            order_id=order.id,
            email=user.email
        )

        # Verify all components worked together
        assert order.status == "paid"
        assert payment.success
        assert product.stock == 8  # Decreased by 2
```

---

## Top-Down Integration

**Start from top-level modules, stub lower-level dependencies.**

```
    Integration Order:
    1. UI/Controller layer (with stubs below)
    2. Service layer (with stubs below)
    3. Repository layer (with stubs below)
    4. Database layer

    ┌─────────────────┐
    │   Controller    │ ← Test first
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │    Service      │ ← Then integrate
    └────────┬────────┘
             │ [Stub]
    ┌────────▼────────┐
    │   Repository    │ ← Then integrate
    └────────┬────────┘
             │ [Stub]
    ┌────────▼────────┐
    │    Database     │ ← Finally integrate
    └─────────────────┘
```

### When to Use
- User-facing features are critical
- Need early validation of user workflows
- Lower layers are unstable or in development

### Example

```python
# tests/integration/test_top_down.py

class TestOrderControllerIntegration:
    """Top-Down: Start with controller, stub services."""

    def test_create_order_endpoint(self, client, mock_order_service):
        """Test controller with stubbed service."""
        mock_order_service.create_order.return_value = Order(
            id="ORD-123",
            status="pending",
            total=199.98
        )

        response = client.post("/api/orders", json={
            "items": [{"product_id": "PROD-1", "quantity": 2}]
        })

        assert response.status_code == 201
        assert response.json()["order_id"] == "ORD-123"


class TestOrderServiceIntegration:
    """Top-Down: Service with real controller, stubbed repository."""

    def test_create_order_persists(self, order_service, mock_repository):
        """Test service with stubbed repository."""
        mock_repository.save.return_value = Order(id="ORD-123")

        order = order_service.create_order(
            user_id="USER-1",
            items=[{"product_id": "PROD-1", "quantity": 2}]
        )

        mock_repository.save.assert_called_once()
        assert order.id == "ORD-123"


class TestOrderRepositoryIntegration:
    """Top-Down: Repository with real database."""

    def test_save_order_to_database(self, order_repository, test_db):
        """Test repository with real database."""
        order = Order(
            user_id="USER-1",
            items=[OrderItem(product_id="PROD-1", quantity=2)],
            status="pending"
        )

        saved = order_repository.save(order)

        # Verify in real database
        from_db = order_repository.find_by_id(saved.id)
        assert from_db is not None
        assert from_db.status == "pending"
```

---

## Bottom-Up Integration

**Start from lowest-level modules, integrate upward.**

```
    Integration Order:
    1. Database layer (tested first)
    2. Repository layer (uses real DB)
    3. Service layer (uses real repo)
    4. Controller layer (uses real service)

    ┌─────────────────┐
    │   Controller    │ ← Test last
    └────────▲────────┘
             │
    ┌────────┴────────┐
    │    Service      │ ← Then integrate
    └────────▲────────┘
             │
    ┌────────┴────────┐
    │   Repository    │ ← Then integrate
    └────────▲────────┘
             │
    ┌────────┴────────┐
    │    Database     │ ← Test first
    └─────────────────┘
```

### When to Use
- Data layer is critical
- Utility modules are foundational
- Top layers depend heavily on bottom layers being correct

### Example

```python
# tests/integration/test_bottom_up.py

# Level 1: Database layer
class TestDatabaseConnection:
    """Bottom-Up: Test database operations first."""

    def test_connection_pool(self, db_engine):
        """Test database connection works."""
        with db_engine.connect() as conn:
            result = conn.execute("SELECT 1")
            assert result.fetchone()[0] == 1

    def test_schema_created(self, db_engine):
        """Test tables exist."""
        inspector = inspect(db_engine)
        tables = inspector.get_table_names()
        assert "users" in tables
        assert "orders" in tables


# Level 2: Repository layer (uses real DB)
class TestUserRepository:
    """Bottom-Up: Repository with real database."""

    def test_save_and_retrieve_user(self, user_repository, test_db):
        user = User(email="test@example.com", name="Test")

        saved = user_repository.save(user)
        retrieved = user_repository.find_by_id(saved.id)

        assert retrieved.email == "test@example.com"


# Level 3: Service layer (uses real repository)
class TestUserService:
    """Bottom-Up: Service with real repository."""

    def test_register_user(self, user_service, test_db):
        result = user_service.register(
            email="new@example.com",
            password="SecurePass123!"
        )

        assert result.success
        assert user_service.find_by_email("new@example.com") is not None


# Level 4: Controller layer (uses real service)
class TestUserController:
    """Bottom-Up: Controller with real service."""

    def test_register_endpoint(self, client, test_db):
        response = client.post("/api/users/register", json={
            "email": "api@example.com",
            "password": "SecurePass123!"
        })

        assert response.status_code == 201
        assert "user_id" in response.json()
```

---

## Sandwich (Hybrid) Integration

**Combine Top-Down and Bottom-Up simultaneously.**

```
    ┌─────────────────┐
    │   Controller    │ ← Top-Down starts here
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │    Service      │ ← Meet in the middle
    └────────▲────────┘
             │
    ┌────────┴────────┐
    │   Repository    │ ← Bottom-Up starts here
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │    Database     │ ← Bottom-Up starts here
    └─────────────────┘
```

### When to Use
- Large, complex systems
- Multiple teams working in parallel
- Both UI and data layers are critical

### Example

```python
# tests/integration/test_sandwich.py

# Top-Down team: Start from UI
class TestUIIntegration:
    """Top-Down: Test user interface flows."""

    def test_checkout_page_loads(self, browser, mock_backend):
        """Test UI with stubbed backend."""
        mock_backend.get_cart.return_value = {"items": [], "total": 0}

        browser.get("/checkout")

        assert browser.find_element_by_id("checkout-form").is_displayed()


# Bottom-Up team: Start from data
class TestDataIntegration:
    """Bottom-Up: Test data layer."""

    def test_order_persistence(self, order_repository, test_db):
        """Test data operations with real database."""
        order = create_order(items=[...])

        saved = order_repository.save(order)
        retrieved = order_repository.find_by_id(saved.id)

        assert retrieved.total == order.total


# Middle layer: Integrate when both sides ready
class TestServiceIntegration:
    """Sandwich: Service layer connects both."""

    def test_checkout_service_full_integration(
        self,
        checkout_service,
        test_db,
        test_payment_gateway
    ):
        """Test service with real data and payment layers."""
        # Uses real repository (from bottom-up)
        # Will be called by real controller (from top-down)

        cart = create_cart_with_items()
        result = checkout_service.process_checkout(cart)

        assert result.order.status == "completed"
        assert result.payment.success
```

---

## Database Integration Testing

### Test Database Setup

```python
# conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture(scope="session")
def db_engine():
    """Create test database engine."""
    engine = create_engine("postgresql://test:test@localhost/test_db")
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create session with automatic rollback."""
    connection = db_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def user_repository(db_session):
    """Repository with test session."""
    return UserRepository(session=db_session)
```

### Testing Database Operations

```python
class TestDatabaseOperations:
    """Integration tests for database operations."""

    def test_transaction_rollback_on_error(self, db_session, user_repository):
        """Test transaction rollback when error occurs."""
        user = User(email="test@example.com")
        user_repository.save(user)

        # This should rollback the entire transaction
        with pytest.raises(IntegrityError):
            duplicate = User(email="test@example.com")  # Duplicate email
            user_repository.save(duplicate)

        # Verify first user was also rolled back
        assert user_repository.find_by_email("test@example.com") is None

    def test_concurrent_updates(self, db_session, product_repository):
        """Test optimistic locking for concurrent updates."""
        product = Product(name="Test", stock=10, version=1)
        product_repository.save(product)

        # Simulate concurrent update
        product_v1 = product_repository.find_by_id(product.id)
        product_v2 = product_repository.find_by_id(product.id)

        product_v1.stock = 8
        product_repository.save(product_v1)

        product_v2.stock = 5
        with pytest.raises(OptimisticLockError):
            product_repository.save(product_v2)
```

---

## API Integration Testing

```python
# tests/integration/test_api.py

class TestAPIIntegration:
    """Integration tests for API endpoints."""

    @pytest.fixture
    def api_client(self, test_db):
        """Test client with real database."""
        app.config['TESTING'] = True
        app.config['DATABASE_URL'] = test_db.url
        return app.test_client()

    def test_create_and_retrieve_user(self, api_client):
        """Test full API flow for user creation."""
        # Create
        create_response = api_client.post("/api/users", json={
            "email": "api@test.com",
            "name": "API Test"
        })
        assert create_response.status_code == 201
        user_id = create_response.json()["id"]

        # Retrieve
        get_response = api_client.get(f"/api/users/{user_id}")
        assert get_response.status_code == 200
        assert get_response.json()["email"] == "api@test.com"

    def test_api_error_handling(self, api_client):
        """Test API returns proper errors."""
        response = api_client.post("/api/users", json={
            "email": "invalid-email"  # Missing required fields
        })
        assert response.status_code == 400
        assert "error" in response.json()
```

---

## CI/CD Integration Testing

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: pytest tests/integration -v --tb=short
```

---

## Integration Testing Checklist

- [ ] Test database chosen (same type as production)
- [ ] Test data isolated (transactions rolled back)
- [ ] External services stubbed appropriately
- [ ] API contracts validated
- [ ] Error handling tested
- [ ] Performance acceptable (< 500ms per test)
- [ ] CI/CD pipeline configured
- [ ] All critical paths covered
