# Low Coupling & High Cohesion - Detailed Reference

The two principles that measure the quality of responsibility assignment.

---

## Low Coupling

### Core Concept

**Minimize dependencies between classes to reduce the impact of changes.**

Coupling measures how strongly one element is connected to, has knowledge of, or depends on other elements.

### Coupling Types (Best to Worst)

| Type | Description | Example |
|------|-------------|---------|
| **No Coupling** | Classes are independent | Utility functions |
| **Data Coupling** | Pass simple data parameters | `process(user_id: str)` |
| **Stamp Coupling** | Pass data structures | `process(user: UserDTO)` |
| **Control Coupling** | Pass control flags | `process(data, is_admin=True)` |
| **Common Coupling** | Share global data | Global config objects |
| **Content Coupling** | Direct internal access | Accessing private members ❌ |

### Implementation Guidelines

```python
from abc import ABC, abstractmethod
from typing import Protocol


# HIGH COUPLING (Anti-Pattern)
class OrderProcessor:
    """Tightly coupled to specific implementations."""

    def __init__(self):
        # Direct dependencies on concrete classes
        self.email_service = SmtpEmailService()
        self.database = PostgresDatabase()
        self.payment = StripePaymentGateway()
        self.inventory = WarehouseInventorySystem()

    def process(self, order: Order):
        # Knows about internal details
        if self.inventory._internal_stock_check(order.product_id):
            self.database.raw_connection.execute("INSERT...")
            self.payment.stripe_specific_method()
            self.email_service.smtp_send()


# LOW COUPLING (Correct)
class EmailPort(Protocol):
    """Abstract interface - stable contract."""
    def send_confirmation(self, order: Order) -> None: ...


class DatabasePort(Protocol):
    """Abstract interface - stable contract."""
    def save_order(self, order: Order) -> None: ...


class PaymentPort(Protocol):
    """Abstract interface - stable contract."""
    def process_payment(self, amount: float) -> PaymentResult: ...


class OrderProcessor:
    """Loosely coupled - depends on abstractions."""

    def __init__(
        self,
        email: EmailPort,
        database: DatabasePort,
        payment: PaymentPort
    ):
        self.email = email
        self.database = database
        self.payment = payment

    def process(self, order: Order) -> None:
        # Uses only public interfaces
        self.database.save_order(order)
        self.payment.process_payment(order.total)
        self.email.send_confirmation(order)
```

### Measuring Coupling

**Coupling indicators to watch:**
- Number of imports from other modules
- Number of constructor parameters
- How many classes need to change when one changes
- Knowledge of internal implementation details

```python
# High coupling indicators:
class BadClass:
    def method(self):
        # Knows about internal implementation
        result = other_object._private_method()

        # Accesses internal state
        value = another_object.internal_list[0]

        # Uses specific types
        if isinstance(obj, SpecificImplementation):
            pass


# Low coupling indicators:
class GoodClass:
    def method(self, data: Protocol):
        # Uses only public interface
        result = data.public_method()

        # Doesn't know about internals
        value = data.get_value()

        # Works with abstractions
        data.perform_action()
```

### Reducing Coupling Strategies

1. **Depend on Interfaces, Not Implementations**
```python
# Instead of:
def process(self, service: ConcreteEmailService):
    pass

# Use:
def process(self, service: EmailPort):
    pass
```

2. **Use Dependency Injection**
```python
# Instead of:
class OrderService:
    def __init__(self):
        self.repo = OrderRepository()  # Creates dependency

# Use:
class OrderService:
    def __init__(self, repo: OrderRepositoryPort):
        self.repo = repo  # Injected dependency
```

3. **Apply Law of Demeter**
```python
# Instead of (train wreck):
customer.get_address().get_city().get_zipcode()

# Use:
customer.get_shipping_zipcode()
```

---

## High Cohesion

### Core Concept

**Keep class responsibilities focused and related.**

Cohesion measures how strongly related and focused the responsibilities of a single class are.

### Cohesion Types (Best to Worst)

| Type | Description | Quality |
|------|-------------|---------|
| **Functional** | All elements contribute to single task | ✅ Best |
| **Sequential** | Output of one is input to next | Good |
| **Communicational** | Operate on same data | Good |
| **Procedural** | Steps in a process | Moderate |
| **Temporal** | Happen at same time | Poor |
| **Logical** | Grouped by category | Poor |
| **Coincidental** | No relationship | ❌ Worst |

### Implementation Guidelines

```python
# LOW COHESION (Anti-Pattern)
class UserManager:
    """Does too many unrelated things."""

    def create_user(self, data: dict) -> User:
        pass

    def send_welcome_email(self, user: User) -> None:
        # Email is unrelated to user management
        pass

    def generate_analytics_report(self) -> Report:
        # Analytics is completely unrelated
        pass

    def validate_credit_card(self, card: str) -> bool:
        # Payment validation is unrelated
        pass

    def resize_profile_image(self, image: bytes) -> bytes:
        # Image processing is unrelated
        pass


# HIGH COHESION (Correct)
class UserService:
    """Focused on user lifecycle management only."""

    def __init__(self, repo: UserRepository):
        self.repo = repo

    def create_user(self, data: CreateUserDTO) -> User:
        user = User.from_dto(data)
        return self.repo.save(user)

    def update_user(self, user_id: str, data: UpdateUserDTO) -> User:
        user = self.repo.find_by_id(user_id)
        user.update(data)
        return self.repo.save(user)

    def delete_user(self, user_id: str) -> None:
        self.repo.delete(user_id)

    def find_user(self, user_id: str) -> User | None:
        return self.repo.find_by_id(user_id)


class EmailService:
    """Focused on email operations only."""

    def __init__(self, smtp_client: SmtpClient):
        self.smtp = smtp_client

    def send_welcome_email(self, user: User) -> None:
        self.smtp.send(
            to=user.email,
            template="welcome",
            context={"name": user.name}
        )

    def send_password_reset(self, user: User, token: str) -> None:
        self.smtp.send(
            to=user.email,
            template="password_reset",
            context={"token": token}
        )


class ImageProcessor:
    """Focused on image operations only."""

    def resize(self, image: bytes, width: int, height: int) -> bytes:
        pass

    def crop(self, image: bytes, x: int, y: int, w: int, h: int) -> bytes:
        pass

    def convert_format(self, image: bytes, target_format: str) -> bytes:
        pass
```

### Measuring Cohesion

**LCOM (Lack of Cohesion of Methods) Metric:**

```python
class ExampleClass:
    def __init__(self):
        self.field_a = None
        self.field_b = None
        self.field_c = None

    def method_1(self):
        # Uses field_a, field_b
        pass

    def method_2(self):
        # Uses field_b, field_c
        pass

    def method_3(self):
        # Uses field_a only
        pass

# LCOM calculation:
# - method_1 shares field_b with method_2 (connected)
# - method_1 shares field_a with method_3 (connected)
# - method_2 doesn't share with method_3 (disconnected)
# Lower LCOM = Higher cohesion
```

**Simple heuristic:**
- If a class has methods that don't use most of the class's fields, cohesion may be low
- If you can split a class into two without creating many dependencies, cohesion is low

### Improving Cohesion Strategies

1. **Split Classes by Responsibility**
```python
# Before: Low cohesion
class Order:
    def calculate_total(self): pass
    def print_invoice(self): pass  # Should be separate
    def send_email(self): pass     # Should be separate

# After: High cohesion
class Order:
    def calculate_total(self): pass
    def get_line_items(self): pass
    def apply_discount(self): pass

class InvoicePrinter:
    def print(self, order: Order): pass

class OrderNotifier:
    def notify(self, order: Order): pass
```

2. **Group Related Methods**
```python
# If methods always work together, they should be in the same class
class ShippingCalculator:
    def calculate_weight(self, items: list[Item]) -> float:
        return sum(item.weight for item in items)

    def calculate_dimensions(self, items: list[Item]) -> Dimensions:
        # Uses same data as calculate_weight
        pass

    def calculate_shipping_cost(self, items: list[Item]) -> Decimal:
        weight = self.calculate_weight(items)
        dims = self.calculate_dimensions(items)
        return self._compute_cost(weight, dims)
```

3. **Extract Unrelated Functionality**
```python
# Before: Utility methods mixed with business logic
class UserService:
    def create_user(self): pass
    def format_date(self, date): pass  # Utility - extract!
    def validate_email(self, email): pass  # Could be separate

# After: Focused responsibilities
class UserService:
    def __init__(self, validator: EmailValidator):
        self.validator = validator

    def create_user(self, email: str):
        if not self.validator.is_valid(email):
            raise ValueError("Invalid email")
        pass

class EmailValidator:
    def is_valid(self, email: str) -> bool:
        pass
```

---

## Coupling and Cohesion Trade-offs

### The Balance

- **High cohesion often reduces coupling** - focused classes have fewer dependencies
- **Low coupling often improves cohesion** - classes aren't doing work for others

### When They Conflict

Sometimes reducing coupling increases the number of classes, which might seem to reduce overall system cohesion:

```python
# High cohesion per class, but more classes needed
class OrderValidator:
    def validate(self, order: Order) -> ValidationResult: pass

class OrderPersistence:
    def save(self, order: Order) -> None: pass

class OrderNotifier:
    def notify(self, order: Order) -> None: pass

class OrderService:
    """Coordinates other services - maintains low coupling."""

    def __init__(
        self,
        validator: OrderValidator,
        persistence: OrderPersistence,
        notifier: OrderNotifier
    ):
        self.validator = validator
        self.persistence = persistence
        self.notifier = notifier

    def process_order(self, order: Order) -> None:
        result = self.validator.validate(order)
        if result.is_valid:
            self.persistence.save(order)
            self.notifier.notify(order)
```

**This is acceptable because:**
- Each class has high cohesion (single responsibility)
- Classes are loosely coupled (depend on interfaces)
- System is more testable and maintainable
- Changes are localized to specific classes

---

## Compliance Checklist

### Low Coupling
- [ ] Classes depend on interfaces, not implementations
- [ ] Constructor doesn't create its own dependencies
- [ ] Methods don't access internal state of other objects
- [ ] Changes to one class don't cascade to many others
- [ ] Law of Demeter is followed (no train wrecks)
- [ ] Dependency Injection is used where appropriate

### High Cohesion
- [ ] All methods in class relate to single purpose
- [ ] Class can be described in one sentence without "and"
- [ ] Most methods use most of the class's fields
- [ ] Class cannot be easily split into unrelated parts
- [ ] Utility methods are extracted to separate classes
- [ ] No "Manager" or "Processor" classes doing everything
