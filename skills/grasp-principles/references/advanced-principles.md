# Advanced GRASP Principles - Detailed Reference

Polymorphism, Pure Fabrication, Indirection, and Protected Variations.

---

## Polymorphism

### Core Concept

**Use type-based behavior through interfaces/inheritance instead of conditionals.**

When behavior varies based on type, assign the responsibility to the types using polymorphic operations rather than using explicit type checking.

### Problem: Conditional Logic Based on Type

```python
# ANTI-PATTERN: Type checking with if/elif chains
class NotificationSender:
    def send(self, notification_type: str, message: str, recipient: str):
        if notification_type == "email":
            self._send_email(message, recipient)
        elif notification_type == "sms":
            self._send_sms(message, recipient)
        elif notification_type == "push":
            self._send_push(message, recipient)
        elif notification_type == "slack":
            self._send_slack(message, recipient)
        # Adding new type requires modifying this class

    def _send_email(self, message, recipient): pass
    def _send_sms(self, message, recipient): pass
    def _send_push(self, message, recipient): pass
    def _send_slack(self, message, recipient): pass
```

### Solution: Polymorphism

```python
from abc import ABC, abstractmethod


class NotificationChannel(ABC):
    """Abstract base for all notification channels."""

    @abstractmethod
    def send(self, message: str, recipient: str) -> bool:
        """Send notification through this channel."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if channel is currently available."""
        pass


class EmailChannel(NotificationChannel):
    def __init__(self, smtp_client):
        self.smtp = smtp_client

    def send(self, message: str, recipient: str) -> bool:
        return self.smtp.send(to=recipient, body=message)

    def is_available(self) -> bool:
        return self.smtp.is_connected()


class SmsChannel(NotificationChannel):
    def __init__(self, sms_gateway):
        self.gateway = sms_gateway

    def send(self, message: str, recipient: str) -> bool:
        return self.gateway.send_sms(phone=recipient, text=message)

    def is_available(self) -> bool:
        return self.gateway.has_credits()


class PushChannel(NotificationChannel):
    def __init__(self, push_service):
        self.push = push_service

    def send(self, message: str, recipient: str) -> bool:
        return self.push.send_notification(device_id=recipient, message=message)

    def is_available(self) -> bool:
        return True


# Usage - no conditionals needed
class NotificationService:
    def __init__(self, channels: list[NotificationChannel]):
        self.channels = channels

    def notify(self, message: str, recipient: str) -> bool:
        for channel in self.channels:
            if channel.is_available():
                if channel.send(message, recipient):
                    return True
        return False
```

### Polymorphism with Strategy Pattern

```python
from abc import ABC, abstractmethod
from decimal import Decimal


class PricingStrategy(ABC):
    """Strategy for calculating prices."""

    @abstractmethod
    def calculate_price(self, base_price: Decimal, quantity: int) -> Decimal:
        pass


class StandardPricing(PricingStrategy):
    def calculate_price(self, base_price: Decimal, quantity: int) -> Decimal:
        return base_price * quantity


class BulkPricing(PricingStrategy):
    def __init__(self, bulk_threshold: int, discount_rate: Decimal):
        self.bulk_threshold = bulk_threshold
        self.discount_rate = discount_rate

    def calculate_price(self, base_price: Decimal, quantity: int) -> Decimal:
        total = base_price * quantity
        if quantity >= self.bulk_threshold:
            total *= (1 - self.discount_rate)
        return total


class SubscriptionPricing(PricingStrategy):
    def __init__(self, monthly_fee: Decimal, per_item_discount: Decimal):
        self.monthly_fee = monthly_fee
        self.per_item_discount = per_item_discount

    def calculate_price(self, base_price: Decimal, quantity: int) -> Decimal:
        discounted_price = base_price * (1 - self.per_item_discount)
        return discounted_price * quantity


class Order:
    def __init__(self, pricing_strategy: PricingStrategy):
        self.strategy = pricing_strategy
        self.items: list[tuple[Decimal, int]] = []

    def add_item(self, price: Decimal, quantity: int):
        self.items.append((price, quantity))

    def calculate_total(self) -> Decimal:
        # Polymorphism - delegates to strategy without conditionals
        return sum(
            self.strategy.calculate_price(price, qty)
            for price, qty in self.items
        )
```

---

## Pure Fabrication

### Core Concept

**Create artificial classes that don't represent domain concepts when needed for design quality.**

When assigning a responsibility to an Information Expert would decrease cohesion or increase coupling, create a new class that doesn't represent a domain concept.

### When to Use

- Information Expert would violate cohesion
- Need technical services (persistence, logging, caching)
- Want reusability across domain objects
- Domain object would become too complex

### Example: Repository Pattern (Pure Fabrication)

```python
from abc import ABC, abstractmethod
from typing import Optional


# Domain object - should focus on business logic
class User:
    def __init__(self, user_id: str, email: str, name: str):
        self.user_id = user_id
        self.email = email
        self.name = name
        self.active = True

    def deactivate(self) -> None:
        """Business logic belongs here."""
        self.active = False

    def change_email(self, new_email: str) -> None:
        """Business logic with validation."""
        if not self._is_valid_email(new_email):
            raise ValueError("Invalid email format")
        self.email = new_email

    def _is_valid_email(self, email: str) -> bool:
        return "@" in email and "." in email


# Pure Fabrication - doesn't exist in domain but needed for design
class UserRepository(ABC):
    """
    Pure Fabrication: Repository is not a domain concept.
    It exists to:
    - Keep User focused on business logic
    - Make persistence reusable
    - Enable testing with mock repositories
    """

    @abstractmethod
    def save(self, user: User) -> None:
        pass

    @abstractmethod
    def find_by_id(self, user_id: str) -> Optional[User]:
        pass

    @abstractmethod
    def find_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    def delete(self, user_id: str) -> None:
        pass


class PostgresUserRepository(UserRepository):
    """Concrete implementation of Pure Fabrication."""

    def __init__(self, connection):
        self.conn = connection

    def save(self, user: User) -> None:
        self.conn.execute(
            "INSERT INTO users (id, email, name, active) VALUES (?, ?, ?, ?)"
            "ON CONFLICT (id) DO UPDATE SET email=?, name=?, active=?",
            (user.user_id, user.email, user.name, user.active,
             user.email, user.name, user.active)
        )

    def find_by_id(self, user_id: str) -> Optional[User]:
        row = self.conn.query_one(
            "SELECT id, email, name, active FROM users WHERE id = ?",
            (user_id,)
        )
        if row:
            user = User(row['id'], row['email'], row['name'])
            user.active = row['active']
            return user
        return None

    def find_by_email(self, email: str) -> Optional[User]:
        row = self.conn.query_one(
            "SELECT id, email, name, active FROM users WHERE email = ?",
            (email,)
        )
        if row:
            user = User(row['id'], row['email'], row['name'])
            user.active = row['active']
            return user
        return None

    def delete(self, user_id: str) -> None:
        self.conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
```

### Other Pure Fabrication Examples

```python
# Logger - technical service, not domain concept
class Logger:
    def info(self, message: str): pass
    def error(self, message: str, exc: Exception = None): pass


# Cache - technical service
class Cache:
    def get(self, key: str) -> Optional[any]: pass
    def set(self, key: str, value: any, ttl: int = 300): pass
    def delete(self, key: str): pass


# EventPublisher - infrastructure concern
class EventPublisher:
    def publish(self, event: DomainEvent): pass


# UnitOfWork - transaction management
class UnitOfWork:
    def begin(self): pass
    def commit(self): pass
    def rollback(self): pass
```

---

## Indirection

### Core Concept

**Add an intermediate object to reduce direct coupling between components.**

Indirection introduces an intermediary to mediate between other components, reducing coupling and improving flexibility.

### Common Indirection Patterns

1. **Adapter** - Translates interfaces
2. **Facade** - Simplifies complex subsystem
3. **Mediator** - Coordinates interactions
4. **Proxy** - Controls access

### Example: Adapter for Indirection

```python
from abc import ABC, abstractmethod


# External service we don't control
class StripePaymentGateway:
    """Third-party payment service with its own interface."""

    def create_charge(self, amount_cents: int, currency: str, token: str) -> dict:
        # Stripe-specific implementation
        return {"id": "ch_123", "status": "succeeded"}

    def refund_charge(self, charge_id: str, amount_cents: int) -> dict:
        return {"id": "re_123", "status": "succeeded"}


# Our domain interface
class PaymentPort(ABC):
    """Our application's payment interface."""

    @abstractmethod
    def process_payment(self, amount: float, token: str) -> PaymentResult:
        pass

    @abstractmethod
    def refund(self, transaction_id: str, amount: float) -> RefundResult:
        pass


# Indirection: Adapter translates between interfaces
class StripePaymentAdapter(PaymentPort):
    """
    Indirection layer:
    - Isolates our app from Stripe's interface
    - Handles currency conversion
    - Translates between our domain and Stripe's API
    """

    def __init__(self, gateway: StripePaymentGateway):
        self.gateway = gateway

    def process_payment(self, amount: float, token: str) -> PaymentResult:
        # Convert to Stripe's expected format
        amount_cents = int(amount * 100)

        try:
            result = self.gateway.create_charge(
                amount_cents=amount_cents,
                currency="usd",
                token=token
            )
            return PaymentResult(
                success=result["status"] == "succeeded",
                transaction_id=result["id"]
            )
        except Exception as e:
            return PaymentResult(success=False, error=str(e))

    def refund(self, transaction_id: str, amount: float) -> RefundResult:
        amount_cents = int(amount * 100)
        try:
            result = self.gateway.refund_charge(transaction_id, amount_cents)
            return RefundResult(success=True, refund_id=result["id"])
        except Exception as e:
            return RefundResult(success=False, error=str(e))


# Our application code uses the abstraction
class OrderService:
    def __init__(self, payment: PaymentPort):
        self.payment = payment  # Depends on our interface, not Stripe

    def process_order(self, order: Order, payment_token: str) -> Order:
        result = self.payment.process_payment(order.total, payment_token)
        if result.success:
            order.mark_paid(result.transaction_id)
        return order
```

### Example: Facade for Indirection

```python
class OrderFacade:
    """
    Facade provides simplified interface to complex subsystem.
    Indirection reduces coupling between clients and subsystem.
    """

    def __init__(
        self,
        inventory: InventoryService,
        payment: PaymentService,
        shipping: ShippingService,
        notification: NotificationService
    ):
        self.inventory = inventory
        self.payment = payment
        self.shipping = shipping
        self.notification = notification

    def place_order(self, cart: ShoppingCart, payment_info: PaymentInfo) -> Order:
        """
        Single entry point hides complexity of:
        - Inventory checking
        - Payment processing
        - Shipping calculation
        - Notifications
        """
        # Check inventory
        for item in cart.items:
            if not self.inventory.is_available(item.product_id, item.quantity):
                raise InsufficientStockError(item.product_id)

        # Create order
        order = Order.from_cart(cart)

        # Process payment
        payment_result = self.payment.charge(payment_info, order.total)
        if not payment_result.success:
            raise PaymentFailedError(payment_result.error)

        order.mark_paid(payment_result.transaction_id)

        # Reserve inventory
        for item in cart.items:
            self.inventory.reserve(item.product_id, item.quantity)

        # Calculate shipping
        shipping = self.shipping.calculate(order)
        order.set_shipping(shipping)

        # Send notification
        self.notification.send_order_confirmation(order)

        return order
```

---

## Protected Variations

### Core Concept

**Design to protect against variations and changes using stable interfaces.**

Identify points of predicted variation or instability and create stable interfaces around them.

### Variation Points

Common sources of variation:
- External systems and APIs
- Data formats
- Business rules
- Hardware/platform differences
- User interface requirements

### Example: Protected Against Data Source Variations

```python
from abc import ABC, abstractmethod
from typing import List


# Stable interface protects against data source variations
class ProductCatalog(ABC):
    """Stable interface - implementation can vary."""

    @abstractmethod
    def get_product(self, product_id: str) -> Product:
        pass

    @abstractmethod
    def search_products(self, query: str) -> List[Product]:
        pass

    @abstractmethod
    def get_products_by_category(self, category: str) -> List[Product]:
        pass


# Variation 1: Database implementation
class DatabaseProductCatalog(ProductCatalog):
    def __init__(self, db_connection):
        self.db = db_connection

    def get_product(self, product_id: str) -> Product:
        row = self.db.query_one("SELECT * FROM products WHERE id = ?", (product_id,))
        return Product.from_row(row) if row else None

    def search_products(self, query: str) -> List[Product]:
        rows = self.db.query(
            "SELECT * FROM products WHERE name LIKE ?",
            (f"%{query}%",)
        )
        return [Product.from_row(row) for row in rows]

    def get_products_by_category(self, category: str) -> List[Product]:
        rows = self.db.query(
            "SELECT * FROM products WHERE category = ?",
            (category,)
        )
        return [Product.from_row(row) for row in rows]


# Variation 2: External API implementation
class ApiProductCatalog(ProductCatalog):
    def __init__(self, api_client):
        self.api = api_client

    def get_product(self, product_id: str) -> Product:
        response = self.api.get(f"/products/{product_id}")
        return Product.from_json(response.json())

    def search_products(self, query: str) -> List[Product]:
        response = self.api.get("/products/search", params={"q": query})
        return [Product.from_json(p) for p in response.json()]

    def get_products_by_category(self, category: str) -> List[Product]:
        response = self.api.get(f"/categories/{category}/products")
        return [Product.from_json(p) for p in response.json()]


# Variation 3: Cache with fallback
class CachedProductCatalog(ProductCatalog):
    def __init__(self, cache: Cache, fallback: ProductCatalog):
        self.cache = cache
        self.fallback = fallback

    def get_product(self, product_id: str) -> Product:
        cached = self.cache.get(f"product:{product_id}")
        if cached:
            return cached

        product = self.fallback.get_product(product_id)
        if product:
            self.cache.set(f"product:{product_id}", product, ttl=3600)
        return product

    # ... other methods with caching


# Application code is protected from variations
class ProductService:
    def __init__(self, catalog: ProductCatalog):
        self.catalog = catalog  # Works with any implementation

    def get_product_details(self, product_id: str) -> ProductDetails:
        product = self.catalog.get_product(product_id)
        return ProductDetails.from_product(product)
```

### Example: Protected Against Business Rule Variations

```python
from abc import ABC, abstractmethod


# Stable interface for discount calculation
class DiscountRule(ABC):
    """Protected variations: Business rules can change."""

    @abstractmethod
    def applies_to(self, order: Order) -> bool:
        pass

    @abstractmethod
    def calculate_discount(self, order: Order) -> Decimal:
        pass


class BulkDiscountRule(DiscountRule):
    def __init__(self, min_items: int, discount_percent: Decimal):
        self.min_items = min_items
        self.discount_percent = discount_percent

    def applies_to(self, order: Order) -> bool:
        return order.item_count >= self.min_items

    def calculate_discount(self, order: Order) -> Decimal:
        return order.subtotal * self.discount_percent


class LoyaltyDiscountRule(DiscountRule):
    def __init__(self, min_orders: int, discount_percent: Decimal):
        self.min_orders = min_orders
        self.discount_percent = discount_percent

    def applies_to(self, order: Order) -> bool:
        return order.customer.order_count >= self.min_orders

    def calculate_discount(self, order: Order) -> Decimal:
        return order.subtotal * self.discount_percent


class SeasonalDiscountRule(DiscountRule):
    def __init__(self, start_date: date, end_date: date, discount_percent: Decimal):
        self.start_date = start_date
        self.end_date = end_date
        self.discount_percent = discount_percent

    def applies_to(self, order: Order) -> bool:
        return self.start_date <= order.order_date <= self.end_date

    def calculate_discount(self, order: Order) -> Decimal:
        return order.subtotal * self.discount_percent


# Discount engine is protected from rule variations
class DiscountEngine:
    def __init__(self, rules: list[DiscountRule]):
        self.rules = rules

    def calculate_total_discount(self, order: Order) -> Decimal:
        total_discount = Decimal('0')
        for rule in self.rules:
            if rule.applies_to(order):
                total_discount += rule.calculate_discount(order)
        return total_discount
```

---

## Compliance Checklist

### Polymorphism
- [ ] Type-based conditionals replaced with polymorphic calls
- [ ] Each type handles its own behavior
- [ ] New types can be added without modifying existing code
- [ ] Interfaces/abstract classes define contracts

### Pure Fabrication
- [ ] Technical concerns separated from domain logic
- [ ] Domain objects maintain high cohesion
- [ ] Fabricated classes are reusable
- [ ] Clear naming indicates non-domain nature (Repository, Service, etc.)

### Indirection
- [ ] Intermediary reduces coupling between components
- [ ] External system changes don't cascade
- [ ] Testing is simplified through indirection
- [ ] Clear purpose for each indirection layer

### Protected Variations
- [ ] Variation points identified and documented
- [ ] Stable interfaces hide implementation details
- [ ] Changes isolated to specific implementations
- [ ] New variations can be added without system changes
