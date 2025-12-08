# GRASP Anti-Patterns

Common violations of GRASP principles and how to fix them.

---

## God Class

**Violation:** Low Cohesion, Single Responsibility

**Description:** A class that knows too much or does too much, becoming a central hub that other classes depend on.

### Detection

```python
# GOD CLASS - Multiple unrelated responsibilities
class ApplicationManager:
    def __init__(self):
        self.users = []
        self.orders = []
        self.products = []
        self.reports = []
        self.email_config = {}
        self.database_connection = None

    # User management
    def create_user(self, data): pass
    def update_user(self, user_id, data): pass
    def delete_user(self, user_id): pass
    def authenticate_user(self, credentials): pass

    # Order processing
    def create_order(self, user_id, items): pass
    def process_payment(self, order_id, payment_info): pass
    def ship_order(self, order_id): pass
    def cancel_order(self, order_id): pass

    # Product management
    def add_product(self, data): pass
    def update_inventory(self, product_id, quantity): pass

    # Reporting
    def generate_sales_report(self): pass
    def generate_user_report(self): pass

    # Email
    def send_email(self, to, subject, body): pass
    def configure_smtp(self, config): pass

    # Database
    def connect_database(self, url): pass
    def execute_query(self, sql): pass
```

### Solution

```python
# Split into focused classes with high cohesion

class UserService:
    """Manages user lifecycle only."""
    def __init__(self, repo: UserRepository, auth: AuthService):
        self.repo = repo
        self.auth = auth

    def create_user(self, data): pass
    def update_user(self, user_id, data): pass
    def delete_user(self, user_id): pass


class AuthService:
    """Handles authentication only."""
    def authenticate(self, credentials): pass
    def validate_token(self, token): pass


class OrderService:
    """Manages orders only."""
    def __init__(self, repo: OrderRepository, payment: PaymentService):
        self.repo = repo
        self.payment = payment

    def create_order(self, user_id, items): pass
    def process(self, order_id, payment_info): pass
    def cancel(self, order_id): pass


class EmailService:
    """Handles email only."""
    def send(self, to, subject, body): pass


class ReportService:
    """Generates reports only."""
    def sales_report(self): pass
    def user_report(self): pass
```

---

## Feature Envy

**Violation:** Information Expert

**Description:** A method that is more interested in a class other than the one it's in, constantly accessing data from another object.

### Detection

```python
# FEATURE ENVY - Method envies Order's data
class OrderReporter:
    def generate_summary(self, order):
        # Constantly accessing order's internal data
        total = 0
        for item in order.get_items():           # Envy
            price = item.get_price()              # Envy
            quantity = item.get_quantity()        # Envy
            discount = item.get_discount()        # Envy
            total += price * quantity * (1 - discount)

        tax = order.get_tax_rate() * total        # Envy
        shipping = order.get_shipping_cost()      # Envy

        return {
            'subtotal': total,
            'tax': tax,
            'shipping': shipping,
            'total': total + tax + shipping,
            'customer': order.get_customer().get_name(),  # Envy
            'address': order.get_customer().get_address()  # Envy
        }
```

### Solution

```python
# Move behavior to Information Expert
class Order:
    def calculate_subtotal(self) -> Decimal:
        """Order is expert on its subtotal."""
        return sum(item.calculate_total() for item in self.items)

    def calculate_tax(self) -> Decimal:
        """Order is expert on its tax."""
        return self.calculate_subtotal() * self.tax_rate

    def calculate_total(self) -> Decimal:
        """Order is expert on its total."""
        return self.calculate_subtotal() + self.calculate_tax() + self.shipping_cost

    def get_summary(self) -> dict:
        """Order can generate its own summary."""
        return {
            'subtotal': self.calculate_subtotal(),
            'tax': self.calculate_tax(),
            'shipping': self.shipping_cost,
            'total': self.calculate_total(),
            'customer': self.customer.name,
            'address': self.customer.address
        }


class OrderItem:
    def calculate_total(self) -> Decimal:
        """OrderItem is expert on its total."""
        return self.price * self.quantity * (1 - self.discount)


# Reporter now delegates to expert
class OrderReporter:
    def generate_summary(self, order: Order) -> dict:
        return order.get_summary()  # Delegates to Information Expert
```

---

## Inappropriate Intimacy

**Violation:** Low Coupling

**Description:** Classes that know too much about each other's internal workings, accessing private data or implementation details.

### Detection

```python
# INAPPROPRIATE INTIMACY
class OrderProcessor:
    def process(self, order):
        # Accessing internal implementation details
        order._internal_items.append(new_item)      # Private access!
        order._status = "processing"                 # Private access!

        # Knowing about internal structure
        if order._discount_calculator._rules:        # Deep intimate knowledge
            discount = order._discount_calculator._apply_rules()

        # Directly manipulating internals
        order._total = order._calculate_raw_total()  # Should use public method


class Order:
    def __init__(self):
        self._internal_items = []
        self._status = "new"
        self._total = 0
        self._discount_calculator = DiscountCalculator()

    def _calculate_raw_total(self):
        pass
```

### Solution

```python
# Use public interfaces, hide implementation
class Order:
    def __init__(self):
        self._items = []
        self._status = OrderStatus.NEW
        self._discount_calculator = DiscountCalculator()

    def add_item(self, item: OrderItem) -> None:
        """Public method for adding items."""
        self._items.append(item)

    def start_processing(self) -> None:
        """Public method for status transition."""
        if self._status != OrderStatus.NEW:
            raise InvalidStatusTransition()
        self._status = OrderStatus.PROCESSING

    def calculate_total(self) -> Decimal:
        """Public method for total calculation."""
        subtotal = sum(item.total for item in self._items)
        discount = self._discount_calculator.calculate(self)
        return subtotal - discount


class OrderProcessor:
    def process(self, order: Order) -> None:
        # Uses only public interface
        order.start_processing()
        total = order.calculate_total()
        # Process payment etc.
```

---

## Anemic Domain Model

**Violation:** Information Expert

**Description:** Domain objects that have little or no business logic, with behavior living in separate service classes.

### Detection

```python
# ANEMIC DOMAIN MODEL
# Data-only class
class Product:
    def __init__(self, product_id, name, price, stock):
        self.product_id = product_id
        self.name = name
        self.price = price
        self.stock = stock
    # No behavior - just data


# All logic in external service
class ProductService:
    def is_available(self, product, quantity):
        return product.stock >= quantity

    def apply_discount(self, product, discount_rate):
        return product.price * (1 - discount_rate)

    def reserve_stock(self, product, quantity):
        if product.stock >= quantity:
            product.stock -= quantity
            return True
        return False

    def calculate_price(self, product, quantity):
        return product.price * quantity
```

### Solution

```python
# RICH DOMAIN MODEL - Information Expert
class Product:
    def __init__(self, product_id: str, name: str, price: Decimal, stock: int):
        self.product_id = product_id
        self.name = name
        self._price = price
        self._stock = stock
        self._discount_rate = Decimal('0')

    # Product is expert on availability
    def is_available(self, quantity: int) -> bool:
        return self._stock >= quantity

    # Product is expert on its pricing
    def get_price(self, quantity: int = 1) -> Decimal:
        discounted = self._price * (1 - self._discount_rate)
        return discounted * quantity

    # Product is expert on stock management
    def reserve_stock(self, quantity: int) -> None:
        if not self.is_available(quantity):
            raise InsufficientStockError(self.product_id, quantity, self._stock)
        self._stock -= quantity

    # Product is expert on discounts
    def apply_discount(self, discount_rate: Decimal) -> None:
        if discount_rate < 0 or discount_rate > 1:
            raise ValueError("Discount rate must be between 0 and 1")
        self._discount_rate = discount_rate

    @property
    def stock(self) -> int:
        return self._stock


# Service now coordinates rather than contains logic
class ProductService:
    def __init__(self, repo: ProductRepository):
        self.repo = repo

    def purchase(self, product_id: str, quantity: int) -> PurchaseResult:
        product = self.repo.find(product_id)
        product.reserve_stock(quantity)  # Delegates to Information Expert
        self.repo.save(product)
        return PurchaseResult(
            product_id=product_id,
            total=product.get_price(quantity)
        )
```

---

## Shotgun Surgery

**Violation:** High Cohesion, Low Coupling

**Description:** A change requires making many small changes to many different classes.

### Detection

When adding a new feature requires:
- Modifying 5+ files
- Touching unrelated classes
- Making similar changes in multiple places

```python
# SHOTGUN SURGERY - Adding new notification type requires changes everywhere

# Change 1: Add to enum
class NotificationType(Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    SLACK = "slack"  # New

# Change 2: Update sender
class NotificationSender:
    def send(self, type, message, recipient):
        if type == NotificationType.SLACK:  # New branch
            self._send_slack(message, recipient)

# Change 3: Update formatter
class MessageFormatter:
    def format(self, type, message):
        if type == NotificationType.SLACK:  # New branch
            return self._format_for_slack(message)

# Change 4: Update validator
class RecipientValidator:
    def validate(self, type, recipient):
        if type == NotificationType.SLACK:  # New branch
            return self._validate_slack_channel(recipient)

# Change 5: Update config
class NotificationConfig:
    def get_config(self, type):
        if type == NotificationType.SLACK:  # New branch
            return self._slack_config
```

### Solution

```python
# Use Polymorphism to encapsulate variation
from abc import ABC, abstractmethod


class NotificationChannel(ABC):
    """Each channel encapsulates all its behavior."""

    @abstractmethod
    def send(self, message: str, recipient: str) -> bool:
        pass

    @abstractmethod
    def format_message(self, message: str) -> str:
        pass

    @abstractmethod
    def validate_recipient(self, recipient: str) -> bool:
        pass


class SlackChannel(NotificationChannel):
    """Adding new channel = adding ONE class."""

    def __init__(self, config: SlackConfig):
        self.config = config

    def send(self, message: str, recipient: str) -> bool:
        formatted = self.format_message(message)
        # Slack-specific send logic
        return True

    def format_message(self, message: str) -> str:
        # Slack-specific formatting
        return f"*{message}*"

    def validate_recipient(self, recipient: str) -> bool:
        # Slack-specific validation
        return recipient.startswith("#") or recipient.startswith("@")


# Adding new channel requires only:
# 1. Create new class implementing NotificationChannel
# 2. Register it in configuration
```

---

## Speculative Generality

**Violation:** Protected Variations (misapplied)

**Description:** Creating abstractions, hooks, or generality that aren't needed yet, "in case we need it later."

### Detection

```python
# SPECULATIVE GENERALITY
class AbstractUserFactoryBuilder(ABC):
    """We might need different user factories someday..."""
    @abstractmethod
    def build_factory(self): pass


class UserFactoryBuilderImpl(AbstractUserFactoryBuilder):
    def build_factory(self):
        return UserFactory()


class UserFactory(ABC):
    """We might need different user creation strategies..."""
    @abstractmethod
    def create_user(self, data): pass


class DefaultUserFactory(UserFactory):
    def create_user(self, data):
        return User(**data)  # Only implementation ever needed


# Parameters "for future use"
class User:
    def __init__(self, name, email,
                 future_param_1=None,  # "We might need this"
                 future_param_2=None,  # "Just in case"
                 extensible_data=None):  # "For flexibility"
        pass
```

### Solution

```python
# YAGNI - You Aren't Gonna Need It
class User:
    """Simple, focused implementation."""

    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email


class UserService:
    """Direct implementation without unnecessary abstraction."""

    def __init__(self, repo: UserRepository):
        self.repo = repo

    def create_user(self, name: str, email: str) -> User:
        user = User(name=name, email=email)
        return self.repo.save(user)


# Add abstraction ONLY when you have multiple implementations
# or when Protected Variations is genuinely needed
```

---

## Detection Checklist

| Code Smell | Likely GRASP Violation |
|------------|------------------------|
| Class > 500 lines | God Class (Low Cohesion) |
| Method uses many getters from another class | Feature Envy (Information Expert) |
| Accessing private members of other classes | Inappropriate Intimacy (Low Coupling) |
| Data classes + separate Service classes | Anemic Domain Model (Information Expert) |
| Small change touches many files | Shotgun Surgery (High Cohesion) |
| Unused abstractions "for the future" | Speculative Generality |
| Long if/elif chains based on type | Missing Polymorphism |
| New keyword scattered everywhere | Missing Creator pattern |
| Business logic in UI/Controller | Missing Controller pattern |

---

## Quick Fixes

1. **God Class** → Split by responsibility into focused classes
2. **Feature Envy** → Move method to the class whose data it uses
3. **Inappropriate Intimacy** → Use public interfaces, hide internals
4. **Anemic Domain Model** → Move behavior to domain objects
5. **Shotgun Surgery** → Use Polymorphism to encapsulate variation
6. **Speculative Generality** → Remove unused abstraction, add when needed
7. **Type-checking conditionals** → Apply Polymorphism
8. **Scattered object creation** → Apply Creator pattern
9. **Business logic in controllers** → Extract to domain objects/services
