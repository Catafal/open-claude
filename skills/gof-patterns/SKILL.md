---
name: gof-patterns
description: Gang of Four design patterns for object-oriented programming. Use when designing object creation (Factory, Builder, Singleton), structure (Adapter, Decorator, Facade), or behavior (Strategy, Observer, Command). Triggers on Factory pattern, Builder pattern, Strategy pattern, Observer pattern, Decorator pattern, creational patterns, structural patterns, behavioral patterns, or general OOP design questions.
---

# Gang of Four Design Patterns

Classic design patterns for object-oriented programming with Python and TypeScript examples.

## Overview

**Gang of Four (GoF)**: Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides (1994)

**23 Classic Patterns** organized into three categories:

| Category | Purpose | Key Patterns |
|----------|---------|--------------|
| **Creational** (5) | Object creation mechanisms | Factory, Builder, Singleton |
| **Structural** (7) | Object composition | Adapter, Decorator, Facade |
| **Behavioral** (11) | Object communication | Strategy, Observer, Command |

---

## Creational Patterns

### Factory Pattern

**Purpose**: Create objects without specifying exact class

**Problem**: Direct instantiation couples code to concrete classes

```python
from abc import ABC, abstractmethod

# Product interface
class User(ABC):
    @abstractmethod
    def get_permissions(self) -> list[str]:
        pass

# Concrete products
class AdminUser(User):
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email

    def get_permissions(self) -> list[str]:
        return ["read", "write", "delete", "admin"]

class GuestUser(User):
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email

    def get_permissions(self) -> list[str]:
        return ["read"]

# Factory
class UserFactory:
    @staticmethod
    def create_user(user_type: str, name: str, email: str) -> User:
        if user_type == "admin":
            return AdminUser(name, email)
        elif user_type == "guest":
            return GuestUser(name, email)
        else:
            raise ValueError(f"Unknown user type: {user_type}")

# Usage
user = UserFactory.create_user("admin", "John", "john@example.com")
```

**When to Use**: Complex object creation, decouple client from concrete classes

---

### Builder Pattern

**Purpose**: Construct complex objects step by step

**Problem**: Constructor with many parameters is unwieldy

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class User:
    name: str
    email: str
    age: Optional[int] = None
    preferences: dict = field(default_factory=dict)

class UserBuilder:
    def __init__(self):
        self._name: Optional[str] = None
        self._email: Optional[str] = None
        self._age: Optional[int] = None
        self._preferences: dict = {}

    def with_name(self, name: str) -> "UserBuilder":
        self._name = name
        return self

    def with_email(self, email: str) -> "UserBuilder":
        self._email = email
        return self

    def with_age(self, age: int) -> "UserBuilder":
        self._age = age
        return self

    def with_preference(self, key: str, value: any) -> "UserBuilder":
        self._preferences[key] = value
        return self

    def build(self) -> User:
        if not self._name or not self._email:
            raise ValueError("Name and email are required")
        return User(
            name=self._name,
            email=self._email,
            age=self._age,
            preferences=self._preferences
        )

# Fluent interface usage
user = (UserBuilder()
    .with_name("John Doe")
    .with_email("john@example.com")
    .with_age(30)
    .with_preference("theme", "dark")
    .build()
)
```

**When to Use**: Many optional parameters, complex construction, immutable objects

---

### Singleton Pattern

**Purpose**: Ensure class has only one instance

**Warning**: Often considered an anti-pattern due to global state

```python
class DatabaseConnection:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.connection = "connection_object"

# Better alternative: Module-level instance
# config.py
class Config:
    def __init__(self):
        self.settings = {"debug": False}

config = Config()  # Single instance at module level
```

**When to Use**: Rarely! Prefer dependency injection or module-level instances.

---

## Structural Patterns

### Adapter Pattern

**Purpose**: Convert interface of class into another interface clients expect

**Problem**: Incompatible interfaces between systems

```python
from abc import ABC, abstractmethod

# External library (can't modify)
class ExternalPaymentGateway:
    def process_transaction(self, card_number: str, amount_cents: int):
        return {"status": "success", "transaction_id": "ext_123"}

# Our interface
class PaymentProcessor(ABC):
    @abstractmethod
    def pay(self, amount_dollars: float, payment_method: str) -> dict:
        pass

# Adapter
class ExternalGatewayAdapter(PaymentProcessor):
    def __init__(self):
        self.gateway = ExternalPaymentGateway()

    def pay(self, amount_dollars: float, payment_method: str) -> dict:
        amount_cents = int(amount_dollars * 100)
        result = self.gateway.process_transaction(payment_method, amount_cents)
        return {
            "success": result["status"] == "success",
            "transaction_id": result["transaction_id"]
        }

# Usage
processor: PaymentProcessor = ExternalGatewayAdapter()
result = processor.pay(99.99, "4111-1111-1111-1111")
```

**When to Use**: Integrate external libraries, legacy code, third-party APIs

---

### Decorator Pattern

**Purpose**: Add behavior to objects dynamically without modifying their structure

```python
from abc import ABC, abstractmethod

# Component interface
class Coffee(ABC):
    @abstractmethod
    def cost(self) -> float:
        pass

    @abstractmethod
    def description(self) -> str:
        pass

class SimpleCoffee(Coffee):
    def cost(self) -> float:
        return 2.0

    def description(self) -> str:
        return "Simple coffee"

# Decorator base
class CoffeeDecorator(Coffee):
    def __init__(self, coffee: Coffee):
        self._coffee = coffee

    def cost(self) -> float:
        return self._coffee.cost()

    def description(self) -> str:
        return self._coffee.description()

# Concrete decorators
class MilkDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return self._coffee.cost() + 0.5

    def description(self) -> str:
        return self._coffee.description() + ", milk"

class SugarDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return self._coffee.cost() + 0.2

    def description(self) -> str:
        return self._coffee.description() + ", sugar"

# Stack decorators
coffee = SimpleCoffee()
coffee = MilkDecorator(coffee)
coffee = SugarDecorator(coffee)
print(f"{coffee.description()}: ${coffee.cost()}")  # Simple coffee, milk, sugar: $2.7
```

#### Python Function Decorators

```python
import time
from functools import wraps

def timing_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.time() - start:.3f}s")
        return result
    return wrapper

@timing_decorator
def slow_function(n: int) -> int:
    time.sleep(1)
    return n ** 2
```

**When to Use**: Add responsibilities dynamically, flexible alternative to subclassing

---

### Facade Pattern

**Purpose**: Provide simplified interface to complex subsystem

```python
# Complex subsystem
class UserAPI:
    def get_user(self, user_id: str):
        return {"id": user_id, "name": "John"}

class OrderAPI:
    def get_orders(self, user_id: str):
        return [{"id": "order1", "total": 99.99}]

class PaymentAPI:
    def get_payment_methods(self, user_id: str):
        return [{"type": "card", "last4": "1234"}]

# Facade - Simple interface
class UserDashboardFacade:
    def __init__(self):
        self.user_api = UserAPI()
        self.order_api = OrderAPI()
        self.payment_api = PaymentAPI()

    def get_dashboard_data(self, user_id: str) -> dict:
        """Get all dashboard data in one call"""
        return {
            "user": self.user_api.get_user(user_id),
            "recent_orders": self.order_api.get_orders(user_id)[:5],
            "payment_methods": self.payment_api.get_payment_methods(user_id)
        }

# Usage
facade = UserDashboardFacade()
dashboard = facade.get_dashboard_data("user123")
```

**When to Use**: Simplify complex subsystems, decouple client from subsystem

---

## Behavioral Patterns

### Strategy Pattern

**Purpose**: Define family of algorithms, make them interchangeable

```python
from abc import ABC, abstractmethod

# Strategy interface
class PaymentStrategy(ABC):
    @abstractmethod
    def pay(self, amount: float) -> dict:
        pass

# Concrete strategies
class CreditCardPayment(PaymentStrategy):
    def __init__(self, card_number: str):
        self.card_number = card_number

    def pay(self, amount: float) -> dict:
        print(f"Paying ${amount} with credit card")
        return {"status": "success", "method": "credit_card"}

class PayPalPayment(PaymentStrategy):
    def __init__(self, email: str):
        self.email = email

    def pay(self, amount: float) -> dict:
        print(f"Paying ${amount} with PayPal")
        return {"status": "success", "method": "paypal"}

# Context
class ShoppingCart:
    def __init__(self):
        self.items = []
        self.payment_strategy: PaymentStrategy = None

    def add_item(self, item: str, price: float):
        self.items.append({"item": item, "price": price})

    def set_payment_strategy(self, strategy: PaymentStrategy):
        self.payment_strategy = strategy

    def checkout(self) -> dict:
        total = sum(item["price"] for item in self.items)
        return self.payment_strategy.pay(total)

# Switch strategies at runtime
cart = ShoppingCart()
cart.add_item("Laptop", 999.99)

cart.set_payment_strategy(CreditCardPayment("4111-1111-1111-1111"))
cart.checkout()

cart.set_payment_strategy(PayPalPayment("user@example.com"))
cart.checkout()
```

**When to Use**: Multiple algorithms for same task, switch at runtime

---

### Observer Pattern

**Purpose**: Define one-to-many dependency where observers are notified of state changes

```python
from abc import ABC, abstractmethod
from typing import List

class Observer(ABC):
    @abstractmethod
    def update(self, subject: "Subject") -> None:
        pass

class Subject:
    def __init__(self):
        self._observers: List[Observer] = []
        self._state: any = None

    def attach(self, observer: Observer) -> None:
        self._observers.append(observer)

    def detach(self, observer: Observer) -> None:
        self._observers.remove(observer)

    def notify(self) -> None:
        for observer in self._observers:
            observer.update(self)

    @property
    def state(self) -> any:
        return self._state

    @state.setter
    def state(self, value: any) -> None:
        self._state = value
        self.notify()

# Concrete observers
class EmailNotifier(Observer):
    def update(self, subject: Subject) -> None:
        print(f"Email: State changed to {subject.state}")

class Logger(Observer):
    def update(self, subject: Subject) -> None:
        print(f"Log: State changed to {subject.state}")

# Usage
subject = Subject()
subject.attach(EmailNotifier())
subject.attach(Logger())

subject.state = "Order Placed"  # Both observers notified
```

#### Modern Event Bus Version

```python
from typing import Callable, Dict, List

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, callback: Callable) -> None:
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def publish(self, event_type: str, data: any = None) -> None:
        if event_type in self._subscribers:
            for callback in self._subscribers[event_type]:
                callback(data)

# Usage
event_bus = EventBus()
event_bus.subscribe("user.registered", lambda u: print(f"Welcome {u['email']}"))
event_bus.publish("user.registered", {"email": "user@example.com"})
```

**When to Use**: One-to-many relationships, event-driven systems, pub/sub

---

### Command Pattern

**Purpose**: Encapsulate request as object, enabling queuing, logging, undo

```python
from abc import ABC, abstractmethod
from typing import List

class Command(ABC):
    @abstractmethod
    def execute(self) -> None:
        pass

    @abstractmethod
    def undo(self) -> None:
        pass

class TextEditor:
    def __init__(self):
        self.text = ""

    def write(self, text: str) -> None:
        self.text += text

    def delete(self, length: int) -> None:
        self.text = self.text[:-length]

class WriteCommand(Command):
    def __init__(self, editor: TextEditor, text: str):
        self.editor = editor
        self.text = text

    def execute(self) -> None:
        self.editor.write(self.text)

    def undo(self) -> None:
        self.editor.delete(len(self.text))

class CommandHistory:
    def __init__(self):
        self.history: List[Command] = []

    def execute(self, command: Command) -> None:
        command.execute()
        self.history.append(command)

    def undo(self) -> None:
        if self.history:
            command = self.history.pop()
            command.undo()

# Usage
editor = TextEditor()
history = CommandHistory()

history.execute(WriteCommand(editor, "Hello "))
history.execute(WriteCommand(editor, "World"))
print(editor.text)  # "Hello World"

history.undo()
print(editor.text)  # "Hello "
```

**When to Use**: Undo/redo, queue operations, log operations, transactions

---

## Quick Reference

| Pattern | Use When | Key Benefit |
|---------|----------|-------------|
| **Factory** | Object creation is complex | Decouple client from concrete classes |
| **Builder** | Many optional parameters | Fluent, readable construction |
| **Singleton** | Single instance needed (rare!) | Global access point |
| **Adapter** | Incompatible interfaces | Integrate external systems |
| **Decorator** | Add behavior dynamically | Flexible extension |
| **Facade** | Complex subsystem | Simplified interface |
| **Strategy** | Multiple algorithms | Runtime switching |
| **Observer** | State change notifications | Loose coupling |
| **Command** | Need undo/redo | Encapsulate operations |

---

## See Also: Related Patterns

### In `backend-patterns`
- **Repository Pattern**: Uses Factory concepts for data access
- **Dependency Injection**: Modern evolution of Factory pattern

### In `frontend-patterns`
- **Container/Presenter**: Separation pattern like Facade
- **Custom Hooks**: Strategy pattern for React logic

### In `ai-agent-patterns`
- **Router Architecture**: Strategy pattern for agent selection
- **Event Bus**: Observer pattern in agent communication

---

## References

See [creational-patterns.md](references/creational-patterns.md) for detailed creational patterns.

See [structural-patterns.md](references/structural-patterns.md) for detailed structural patterns.

See [behavioral-patterns.md](references/behavioral-patterns.md) for detailed behavioral patterns.

See [anti-patterns.md](references/anti-patterns.md) for common violations.
