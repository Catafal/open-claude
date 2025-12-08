---
name: grasp-principles
description: GRASP (General Responsibility Assignment Software Patterns) principles for object-oriented design. Use when deciding which class should have a responsibility, how to reduce coupling, or where to place behavior. Triggers on responsibility assignment, Information Expert, Creator pattern, Controller, Low Coupling, High Cohesion, Polymorphism, Pure Fabrication, Indirection, Protected Variations, which class should, where to put this method.
---

# GRASP Principles

**GRASP** (General Responsibility Assignment Software Patterns) is a set of nine fundamental principles for assigning responsibilities to classes and objects in object-oriented design. Created by Craig Larman, GRASP answers the critical question: **"Which class should be responsible for this behavior?"**

---

## Quick Reference

| Principle | Purpose | When to Use |
|-----------|---------|-------------|
| **Information Expert** | Assign to class with the data | Data operations, calculations |
| **Creator** | Assign creation to related class | Object instantiation |
| **Controller** | Handle system events | UI layer separation |
| **Low Coupling** | Minimize dependencies | All design decisions |
| **High Cohesion** | Related responsibilities together | Class design |
| **Polymorphism** | Inheritance for variation | Type-based behavior |
| **Pure Fabrication** | Create helper classes | When no natural fit exists |
| **Indirection** | Add intermediary | Decouple dependencies |
| **Protected Variations** | Shield from changes | Stable interfaces |

---

## The Nine GRASP Principles

### 1. Information Expert

**Assign responsibility to the class that has the information necessary to fulfill it.**

The class with the most relevant data should perform operations on that data.

```python
# ANTI-PATTERN: External class calculating order total
class OrderCalculator:
    def calculate_total(self, order):
        total = 0
        for item in order.get_items():  # Feature envy!
            total += item.price * item.quantity
        return total

# CORRECT: Order is the Information Expert
class Order:
    def __init__(self):
        self.items: list[OrderItem] = []

    def calculate_total(self) -> Decimal:
        """Order has the data, so it calculates the total."""
        return sum(item.price * item.quantity for item in self.items)

    def get_item_count(self) -> int:
        """Order knows its own item count."""
        return sum(item.quantity for item in self.items)
```

**Key Benefits:**
- Keeps data and behavior together (encapsulation)
- Reduces coupling between classes
- Creates intuitive, natural designs

---

### 2. Creator

**Assign class B to create class A if B contains, records, closely uses, or has initialization data for A.**

```python
# ANTI-PATTERN: Generic factory with no relationship
class ObjectFactory:
    @staticmethod
    def create_order_item(product_id: str, qty: int):
        return OrderItem(product_id, qty)

# CORRECT: ShoppingCart creates OrderItems (it contains them)
class ShoppingCart:
    def __init__(self):
        self.items: list[OrderItem] = []

    def add_product(self, product: Product, quantity: int) -> None:
        """ShoppingCart is the natural creator of OrderItems."""
        order_item = OrderItem(product, quantity)
        self.items.append(order_item)
```

**Creator Criteria (choose class that):**
1. Contains or aggregates instances of A
2. Records instances of A
3. Closely uses instances of A
4. Has the initialization data for A

---

### 3. Controller

**Assign system event handling to a class representing the use case or the overall system.**

The controller is the first object beyond the UI that receives and coordinates system operations.

```python
# CORRECT: Use-case Controller
class CheckoutController:
    """Handles checkout use case - delegates to domain objects."""

    def __init__(self, order_service: OrderService, payment_service: PaymentService):
        self.order_service = order_service
        self.payment_service = payment_service

    def process_checkout(self, cart: ShoppingCart, payment_info: PaymentInfo) -> Order:
        """Coordinates the checkout process without containing business logic."""
        # Validate
        if not cart.items:
            raise ValueError("Cart is empty")

        # Delegate to domain objects
        order = self.order_service.create_order(cart)
        self.payment_service.process_payment(order, payment_info)

        return order
```

**Controller Types:**
- **Use-case Controller:** Handles specific use case (e.g., `CheckoutController`)
- **Facade Controller:** Represents overall system (e.g., `LibrarySystem`)

**Key Rule:** Controllers coordinate but don't contain business logic.

---

### 4. Low Coupling

**Minimize dependencies between classes to reduce impact of changes.**

```python
# HIGH COUPLING: Direct dependency on concrete class
class OrderProcessor:
    def __init__(self):
        self.email_service = SmtpEmailService()  # Tight coupling!
        self.database = PostgresDatabase()       # Tight coupling!

    def process(self, order: Order):
        self.database.save(order)
        self.email_service.send_confirmation(order)

# LOW COUPLING: Depend on abstractions
class OrderProcessor:
    def __init__(self, db: DatabasePort, email: EmailPort):
        self.db = db        # Depends on interface
        self.email = email  # Depends on interface

    def process(self, order: Order):
        self.db.save(order)
        self.email.send_confirmation(order)
```

**Coupling Types (best to worst):**
1. No coupling (ideal)
2. Data coupling (passing simple data)
3. Stamp coupling (passing data structures)
4. Control coupling (passing control flags)
5. Common coupling (shared global data)
6. Content coupling (direct internal access) ❌

---

### 5. High Cohesion

**Keep class responsibilities focused and related.**

A class should have a single, well-defined purpose with all its methods contributing to that purpose.

```python
# LOW COHESION: Class doing unrelated things
class UserManager:
    def create_user(self, data): pass
    def send_email(self, to, body): pass      # Unrelated!
    def generate_report(self): pass            # Unrelated!
    def validate_credit_card(self, card): pass # Unrelated!

# HIGH COHESION: Focused responsibilities
class UserService:
    """Manages user lifecycle only."""
    def create_user(self, data): pass
    def update_user(self, user_id, data): pass
    def delete_user(self, user_id): pass
    def find_user(self, user_id): pass

class EmailService:
    """Handles email operations only."""
    def send_email(self, to, body): pass
    def send_template(self, to, template_id): pass
```

**Cohesion Types (best to worst):**
1. Functional (ideal) - All elements contribute to one task
2. Sequential - Output of one is input to another
3. Communicational - Operate on same data
4. Procedural - Steps in a process
5. Temporal - Happen at same time
6. Logical - Grouped by category
7. Coincidental (worst) - No relationship ❌

---

### 6. Polymorphism

**Use type-based behavior through interfaces/inheritance instead of conditionals.**

```python
# ANTI-PATTERN: Type checking with conditionals
class PaymentProcessor:
    def process(self, payment_type: str, amount: Decimal):
        if payment_type == "credit_card":
            # Credit card logic
            pass
        elif payment_type == "paypal":
            # PayPal logic
            pass
        elif payment_type == "bank_transfer":
            # Bank transfer logic
            pass

# CORRECT: Polymorphism
from abc import ABC, abstractmethod

class PaymentMethod(ABC):
    @abstractmethod
    def process(self, amount: Decimal) -> PaymentResult:
        pass

class CreditCardPayment(PaymentMethod):
    def process(self, amount: Decimal) -> PaymentResult:
        # Credit card specific logic
        return PaymentResult(success=True)

class PayPalPayment(PaymentMethod):
    def process(self, amount: Decimal) -> PaymentResult:
        # PayPal specific logic
        return PaymentResult(success=True)

# Usage - no conditionals needed
def checkout(payment: PaymentMethod, amount: Decimal):
    return payment.process(amount)
```

---

### 7. Pure Fabrication

**Create artificial classes that don't represent domain concepts when needed for design quality.**

```python
# Problem: Where should database saving logic go?
# User is the Information Expert for user data, but not for persistence

# SOLUTION: Pure Fabrication - UserRepository
class UserRepository:
    """
    Pure Fabrication: Doesn't represent a domain concept,
    but improves cohesion and reusability.
    """
    def __init__(self, db: DatabaseConnection):
        self.db = db

    def save(self, user: User) -> None:
        self.db.execute(
            "INSERT INTO users (email, name) VALUES (?, ?)",
            (user.email, user.name)
        )

    def find_by_id(self, user_id: str) -> User | None:
        row = self.db.query("SELECT * FROM users WHERE id = ?", (user_id,))
        return User.from_row(row) if row else None
```

**When to Use Pure Fabrication:**
- Information Expert would create low cohesion or high coupling
- Need technical services (persistence, logging, communication)
- Want to improve reusability across domain objects

---

### 8. Indirection

**Add an intermediate object to reduce direct coupling between components.**

```python
# DIRECT COUPLING: OrderService directly calls PaymentGateway
class OrderService:
    def __init__(self):
        self.stripe = StripeGateway()  # Direct dependency

    def process_order(self, order: Order):
        self.stripe.charge(order.total)  # Tightly coupled

# INDIRECTION: PaymentAdapter as intermediary
class PaymentAdapter:
    """Indirection layer between OrderService and payment providers."""

    def __init__(self, gateway: PaymentGateway):
        self.gateway = gateway

    def process_payment(self, amount: Decimal) -> PaymentResult:
        try:
            return self.gateway.charge(amount)
        except GatewayError as e:
            return PaymentResult(success=False, error=str(e))

class OrderService:
    def __init__(self, payment: PaymentAdapter):
        self.payment = payment  # Depends on abstraction

    def process_order(self, order: Order):
        self.payment.process_payment(order.total)
```

**Common Indirection Patterns:**
- Adapters (interface translation)
- Facades (simplified interface)
- Mediators (coordinate interactions)
- Proxies (control access)

---

### 9. Protected Variations

**Design to protect against variations and changes using stable interfaces.**

```python
# UNPROTECTED: Changes to data format break everything
class DataProcessor:
    def process(self, data: dict):
        # Assumes specific structure - brittle!
        name = data["user"]["name"]
        email = data["user"]["contact"]["email"]

# PROTECTED VARIATIONS: Stable interface shields from changes
from abc import ABC, abstractmethod

class DataSource(ABC):
    """Stable interface - implementation can vary."""

    @abstractmethod
    def get_user_name(self) -> str:
        pass

    @abstractmethod
    def get_user_email(self) -> str:
        pass

class JsonDataSource(DataSource):
    def __init__(self, data: dict):
        self.data = data

    def get_user_name(self) -> str:
        return self.data["user"]["name"]

    def get_user_email(self) -> str:
        return self.data["user"]["contact"]["email"]

class XmlDataSource(DataSource):
    def __init__(self, xml_element):
        self.root = xml_element

    def get_user_name(self) -> str:
        return self.root.find("user/name").text

    def get_user_email(self) -> str:
        return self.root.find("user/contact/email").text

class DataProcessor:
    def process(self, source: DataSource):
        # Protected from data format changes
        name = source.get_user_name()
        email = source.get_user_email()
```

---

## GRASP Decision Flowchart

When assigning a responsibility, ask these questions in order:

```
1. Which class has the data needed? → Information Expert
2. Which class should create this object? → Creator
3. Who handles system events? → Controller
4. Does this increase coupling? → Low Coupling
5. Does this reduce cohesion? → High Cohesion
6. Is behavior varying by type? → Polymorphism
7. No natural fit? → Pure Fabrication
8. Need to decouple? → Indirection
9. Is this a variation point? → Protected Variations
```

---

## GRASP vs SOLID Integration

| Design Phase | Use |
|--------------|-----|
| "Which class should do X?" | GRASP |
| "How should class X be designed?" | SOLID |

**Apply together:**
1. Use **Information Expert** to assign responsibility
2. Verify with **SRP** that class doesn't have too many reasons to change
3. Use **Creator** to determine who instantiates objects
4. Apply **DIP** if creation needs flexibility
5. Use **Low Coupling** + **DIP** to depend on abstractions
6. Use **Polymorphism** + **OCP** for extensible type-based behavior

---

## See Also

### In This Skill
- [Information Expert & Creator Details](references/information-expert-creator.md)
- [Low Coupling & High Cohesion](references/coupling-cohesion.md)
- [Advanced Principles](references/advanced-principles.md) - Polymorphism, Pure Fabrication, Indirection, Protected Variations
- [Anti-Patterns](references/anti-patterns.md)

### Related Skills
- **gof-patterns** - Factory, Strategy patterns (complementary to GRASP)
- **backend-patterns** - Repository, Service Layer (applies GRASP principles)
