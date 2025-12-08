---
name: solid-principles
description: Guide for applying SOLID principles in object-oriented design. Use when designing classes, interfaces, and inheritance hierarchies. Covers Single Responsibility (SRP), Open-Closed (OCP), Liskov Substitution (LSP), Interface Segregation (ISP), and Dependency Inversion (DIP). Triggers when users ask about SOLID, class design, abstraction, dependency injection, or object-oriented architecture.
---

# SOLID Principles

Guide for writing maintainable, flexible object-oriented code using the five SOLID principles.

## What is SOLID?

SOLID is a mnemonic acronym representing five fundamental principles for object-oriented design:

| Principle | Acronym | Core Concept |
|-----------|---------|--------------|
| Single Responsibility | **S** | One class, one responsibility |
| Open-Closed | **O** | Open for extension, closed for modification |
| Liskov Substitution | **L** | Derived classes must be substitutable for base classes |
| Interface Segregation | **I** | Small, specific interfaces over large, general ones |
| Dependency Inversion | **D** | Depend on abstractions, not concretions |

### When to Apply SOLID

**Apply SOLID when:**
- Building new features or systems
- Refactoring existing code
- Code is becoming difficult to maintain
- Multiple developers work on the same codebase
- Requirements are expected to change

**Consider alternatives when:**
- Building quick prototypes or proof-of-concepts
- Working on small, isolated scripts
- Performance is the absolute priority over maintainability

---

## S - Single Responsibility Principle (SRP)

### Definition

> "A class should have only one reason to change"

Every class should have only one responsibility, handling one specific aspect of the application's functionality.

### Benefits

- Easier to understand and maintain
- Reduced coupling between components
- Easier to test in isolation
- Changes are localized to specific areas

### Guidelines

**DO:**
- Create focused classes with clear, single purposes
- Separate data access, business logic, and presentation concerns
- Use descriptive class names that indicate the single responsibility

**DON'T:**
- Create "God Objects" that handle multiple concerns
- Mix UI rendering with business logic
- Combine data validation with data persistence

### Python Example

```python
# VIOLATION: Multiple responsibilities
class UserManager:
    def authenticate(self, username, password):
        # Authentication logic
        pass

    def validate_email(self, email):
        # Validation logic
        pass

    def send_email(self, to, subject, body):
        # Email sending logic
        pass

    def save_to_database(self, user):
        # Database logic
        pass

# CORRECT: Single responsibilities
class UserAuthenticator:
    """Handles user authentication only"""
    def authenticate(self, username: str, password: str) -> bool:
        # Authentication logic
        pass

class EmailValidator:
    """Handles email validation only"""
    def validate(self, email: str) -> bool:
        # Validation logic
        pass

class EmailService:
    """Handles email sending only"""
    def send(self, to: str, subject: str, body: str) -> bool:
        # Email sending logic
        pass

class UserRepository:
    """Handles user data persistence only"""
    def save(self, user) -> None:
        # Database logic
        pass
```

### TypeScript Example

```typescript
// VIOLATION: Multiple responsibilities
class Invoice {
    calculateTotal(): number {
        // Calculation logic
        return 0;
    }

    printInvoice(): void {
        // Printing logic
    }

    saveToDatabase(): void {
        // Database logic
    }
}

// CORRECT: Single responsibilities
class Invoice {
    calculateTotal(): number {
        // Calculation logic only
        return 0;
    }
}

class InvoicePrinter {
    print(invoice: Invoice): void {
        // Printing logic only
    }
}

class InvoiceRepository {
    save(invoice: Invoice): void {
        // Database logic only
    }
}
```

### Decision Question

> "How many reasons does this class have to change?"

If the answer is more than one, split the class.

---

## O - Open-Closed Principle (OCP)

### Definition

> "Software entities should be open for extension but closed for modification"

You should be able to add new functionality without changing existing code.

### Benefits

- Reduces risk of breaking existing functionality
- Makes code more flexible and adaptable
- Encourages use of abstraction and polymorphism
- Simplifies testing of new features

### Guidelines

**DO:**
- Use interfaces and abstract classes to define contracts
- Implement new features by adding new classes
- Leverage polymorphism for varying behaviors

**DON'T:**
- Modify existing, working code to add features
- Use long chains of if-else or switch statements
- Hard-code dependencies to concrete implementations

### Python Example

```python
from abc import ABC, abstractmethod
from typing import List

# VIOLATION: Must modify to add new shapes
class AreaCalculator:
    def calculate_area(self, shapes: List):
        total_area = 0
        for shape in shapes:
            if shape.type == "circle":
                total_area += 3.14 * shape.radius ** 2
            elif shape.type == "rectangle":
                total_area += shape.width * shape.height
            # Must add new elif for each new shape
        return total_area

# CORRECT: Open for extension, closed for modification
class Shape(ABC):
    """Abstract base class for all shapes"""
    @abstractmethod
    def area(self) -> float:
        pass

class Circle(Shape):
    """Circle implementation"""
    def __init__(self, radius: float):
        self.radius = radius

    def area(self) -> float:
        return 3.14 * self.radius ** 2

class Rectangle(Shape):
    """Rectangle implementation"""
    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height

class Triangle(Shape):
    """New shape added without modifying existing code"""
    def __init__(self, base: float, height: float):
        self.base = base
        self.height = height

    def area(self) -> float:
        return 0.5 * self.base * self.height

class AreaCalculator:
    """Calculator works with any shape without modification"""
    def calculate_total_area(self, shapes: List[Shape]) -> float:
        return sum(shape.area() for shape in shapes)
```

### TypeScript Example

```typescript
// VIOLATION: Must modify for new discount types
function calculateDiscount(customerType: string, amount: number): number {
    if (customerType === "regular") {
        return amount * 0.1;
    } else if (customerType === "premium") {
        return amount * 0.2;
    }
    // Must add new else if for each type
    return 0;
}

// CORRECT: Open for extension
interface DiscountStrategy {
    calculate(amount: number): number;
}

class RegularDiscount implements DiscountStrategy {
    calculate(amount: number): number {
        return amount * 0.1;
    }
}

class PremiumDiscount implements DiscountStrategy {
    calculate(amount: number): number {
        return amount * 0.2;
    }
}

class VIPDiscount implements DiscountStrategy {
    calculate(amount: number): number {
        return amount * 0.3;
    }
}

class DiscountCalculator {
    calculate(strategy: DiscountStrategy, amount: number): number {
        return strategy.calculate(amount);
    }
}
```

### Decision Question

> "Can I add new functionality without modifying existing code?"

If no, introduce abstractions.

---

## L - Liskov Substitution Principle (LSP)

### Definition

> "Derived classes must be substitutable for their base classes"

Objects of a superclass should be replaceable with objects of a subclass without altering program correctness.

### Benefits

- Ensures reliable inheritance hierarchies
- Prevents unexpected behavior in polymorphic code
- Maintains contract integrity across class hierarchies
- Enables safe code reuse

### Guidelines

**DO:**
- Ensure derived classes honor the contract of the base class
- Maintain or strengthen preconditions
- Maintain or weaken postconditions
- Preserve invariants of the base class

**DON'T:**
- Throw exceptions in derived classes for base class methods
- Return different types than the base class specifies
- Require stronger preconditions than the base class
- Violate the expected behavior of the base class

### Python Example

```python
from abc import ABC, abstractmethod

# VIOLATION: Square changes Rectangle's behavior
class Rectangle:
    def __init__(self, width: float, height: float):
        self._width = width
        self._height = height

    def set_width(self, width: float):
        self._width = width

    def set_height(self, height: float):
        self._height = height

    def area(self) -> float:
        return self._width * self._height

class Square(Rectangle):
    """Violates LSP: changing width affects height"""
    def set_width(self, width: float):
        self._width = width
        self._height = width  # Unexpected behavior!

    def set_height(self, height: float):
        self._width = height  # Unexpected behavior!
        self._height = height

def test_rectangle(rect: Rectangle):
    rect.set_width(5)
    rect.set_height(4)
    assert rect.area() == 20  # Fails for Square!

# CORRECT: Separate, independent implementations
class Shape(ABC):
    """Base abstraction for all shapes"""
    @abstractmethod
    def area(self) -> float:
        pass

class Rectangle(Shape):
    """Rectangle with independent width and height"""
    def __init__(self, width: float, height: float):
        self._width = width
        self._height = height

    def area(self) -> float:
        return self._width * self._height

class Square(Shape):
    """Square with single side dimension"""
    def __init__(self, side: float):
        self._side = side

    def area(self) -> float:
        return self._side ** 2
```

### TypeScript Example

```typescript
// VIOLATION: Bird base class doesn't work for all birds
class Bird {
    fly(): void {
        console.log("Flying");
    }
}

class Penguin extends Bird {
    // Penguins can't fly - violates LSP!
    fly(): void {
        throw new Error("Penguins cannot fly!");
    }
}

// CORRECT: Use appropriate abstractions
interface Bird {
    move(): void;
}

class FlyingBird implements Bird {
    move(): void {
        console.log("Flying");
    }
}

class Penguin implements Bird {
    move(): void {
        console.log("Swimming");
    }
}

class Ostrich implements Bird {
    move(): void {
        console.log("Running");
    }
}
```

### Decision Question

> "Can I replace the base class with any derived class without breaking the code?"

If no, redesign the inheritance hierarchy.

---

## I - Interface Segregation Principle (ISP)

### Definition

> "Clients should not be forced to depend on interfaces they do not use"

Large interfaces should be split into smaller, more specific ones so that clients only know about methods relevant to them.

### Benefits

- Reduces coupling between components
- Improves code clarity and readability
- Makes interfaces easier to implement
- Prevents "fat" interfaces with unused methods

### Guidelines

**DO:**
- Create focused, role-specific interfaces
- Split large interfaces into smaller, cohesive ones
- Use interface composition when needed
- Design interfaces from the client's perspective

**DON'T:**
- Force classes to implement methods they don't need
- Create monolithic interfaces with many methods
- Use empty or exception-throwing implementations

### Python Example

```python
from abc import ABC, abstractmethod

# VIOLATION: Large interface forces unused implementations
class Worker(ABC):
    @abstractmethod
    def work(self):
        pass

    @abstractmethod
    def eat(self):
        pass

    @abstractmethod
    def sleep(self):
        pass

class RobotWorker(Worker):
    def work(self):
        print("Robot working")

    def eat(self):
        pass  # Robots don't eat - forced implementation!

    def sleep(self):
        pass  # Robots don't sleep - forced implementation!

# CORRECT: Segregated interfaces
class Workable(ABC):
    """Interface for entities that can work"""
    @abstractmethod
    def work(self):
        pass

class Eatable(ABC):
    """Interface for entities that can eat"""
    @abstractmethod
    def eat(self):
        pass

class Sleepable(ABC):
    """Interface for entities that can sleep"""
    @abstractmethod
    def sleep(self):
        pass

class HumanWorker(Workable, Eatable, Sleepable):
    """Human implements all three interfaces"""
    def work(self):
        print("Human working")

    def eat(self):
        print("Human eating")

    def sleep(self):
        print("Human sleeping")

class RobotWorker(Workable):
    """Robot only implements what it needs"""
    def work(self):
        print("Robot working")
```

### TypeScript Example

```typescript
// VIOLATION: Fat interface
interface Restaurant {
    acceptOnlineOrder(): void;
    takeTelephoneOrder(): void;
    payOnline(): void;
    walkInCustomerOrder(): void;
    payInPerson(): void;
}

// Small cafe forced to implement unnecessary methods
class SmallCafe implements Restaurant {
    acceptOnlineOrder(): void {
        throw new Error("Not supported");
    }
    takeTelephoneOrder(): void {
        throw new Error("Not supported");
    }
    payOnline(): void {
        throw new Error("Not supported");
    }
    walkInCustomerOrder(): void {
        console.log("Taking walk-in order");
    }
    payInPerson(): void {
        console.log("Processing payment");
    }
}

// CORRECT: Segregated interfaces
interface OnlineOrderable {
    acceptOnlineOrder(): void;
    payOnline(): void;
}

interface WalkInOrderable {
    walkInCustomerOrder(): void;
    payInPerson(): void;
}

class SmallCafe implements WalkInOrderable {
    walkInCustomerOrder(): void {
        console.log("Taking walk-in order");
    }
    payInPerson(): void {
        console.log("Processing payment");
    }
}

class LargeRestaurant implements OnlineOrderable, WalkInOrderable {
    acceptOnlineOrder(): void {
        console.log("Accepting online order");
    }
    payOnline(): void {
        console.log("Processing online payment");
    }
    walkInCustomerOrder(): void {
        console.log("Taking walk-in order");
    }
    payInPerson(): void {
        console.log("Processing in-person payment");
    }
}
```

### Decision Question

> "Does this interface force clients to depend on methods they don't use?"

If yes, split the interface.

---

## D - Dependency Inversion Principle (DIP)

### Definition

> "Depend on abstractions, not on concretions"

High-level modules should not depend on low-level modules. Both should depend on abstractions.

### Benefits

- Reduces coupling between modules
- Makes code more testable (easy to mock dependencies)
- Increases flexibility and maintainability
- Enables dependency injection patterns

### Guidelines

**DO:**
- Define interfaces for dependencies
- Inject dependencies through constructors or methods
- Depend on abstract types, not concrete implementations
- Use dependency injection containers when appropriate

**DON'T:**
- Instantiate dependencies directly within classes
- Hard-code references to concrete classes
- Create tight coupling between layers

### Python Example

```python
from abc import ABC, abstractmethod

# VIOLATION: High-level depends on low-level concrete class
class MySQLDatabase:
    """Low-level concrete implementation"""
    def save(self, data):
        print(f"Saving {data} to MySQL")

class UserService:
    """High-level module tightly coupled to MySQL"""
    def __init__(self):
        self.db = MySQLDatabase()  # Hard-coded dependency!

    def save_user(self, user):
        self.db.save(user)

# CORRECT: Both depend on abstraction
class Database(ABC):
    """Abstraction for database operations"""
    @abstractmethod
    def save(self, data):
        pass

class MySQLDatabase(Database):
    """Low-level concrete implementation"""
    def save(self, data):
        print(f"Saving {data} to MySQL")

class PostgreSQLDatabase(Database):
    """Alternative implementation"""
    def save(self, data):
        print(f"Saving {data} to PostgreSQL")

class UserService:
    """High-level module depends on abstraction"""
    def __init__(self, database: Database):
        self.db = database  # Dependency injection!

    def save_user(self, user):
        self.db.save(user)

# Usage: Inject the dependency
mysql_db = MySQLDatabase()
user_service = UserService(mysql_db)

# Easy to switch implementations
postgres_db = PostgreSQLDatabase()
user_service = UserService(postgres_db)
```

### TypeScript Example

```typescript
// VIOLATION: Direct dependency on concrete class
class EmailService {
    sendEmail(to: string, message: string): void {
        console.log(`Sending email to ${to}: ${message}`);
    }
}

class UserNotification {
    private emailService: EmailService;

    constructor() {
        this.emailService = new EmailService();  // Hard-coded!
    }

    notifyUser(user: string, message: string): void {
        this.emailService.sendEmail(user, message);
    }
}

// CORRECT: Depend on abstraction
interface MessageService {
    send(to: string, message: string): void;
}

class EmailService implements MessageService {
    send(to: string, message: string): void {
        console.log(`Sending email to ${to}: ${message}`);
    }
}

class SMSService implements MessageService {
    send(to: string, message: string): void {
        console.log(`Sending SMS to ${to}: ${message}`);
    }
}

class UserNotification {
    constructor(private messageService: MessageService) {}

    notifyUser(user: string, message: string): void {
        this.messageService.send(user, message);
    }
}

// Usage: Flexible dependency injection
const emailNotifier = new UserNotification(new EmailService());
const smsNotifier = new UserNotification(new SMSService());
```

### Decision Question

> "Am I depending on concrete implementations or abstractions?"

If concrete, introduce abstractions and use dependency injection.

---

## Decision Framework

Use this flowchart when making design decisions:

```
┌─────────────────────────────────────┐
│ New Feature or Refactoring Needed   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Does it violate SRP?                │
│ (More than one reason to change?)   │
└─────┬───────────────────────────────┘
      │ Yes → Split into focused classes
      │ No ↓
┌─────────────────────────────────────┐
│ Does it violate OCP?                │
│ (Requires modifying existing code?) │
└─────┬───────────────────────────────┘
      │ Yes → Use abstraction/polymorphism
      │ No ↓
┌─────────────────────────────────────┐
│ Does it violate LSP?                │
│ (Derived class breaks contract?)    │
└─────┬───────────────────────────────┘
      │ Yes → Redesign inheritance hierarchy
      │ No ↓
┌─────────────────────────────────────┐
│ Does it violate ISP?                │
│ (Forces unused dependencies?)       │
└─────┬───────────────────────────────┘
      │ Yes → Split into smaller interfaces
      │ No ↓
┌─────────────────────────────────────┐
│ Does it violate DIP?                │
│ (Depends on concrete classes?)      │
└─────┬───────────────────────────────┘
      │ Yes → Introduce abstractions
      │ No ↓
┌─────────────────────────────────────┐
│ ✅ Design is SOLID                  │
└─────────────────────────────────────┘
```

---

## Quick Reference Table

| Principle | Key Question | Quick Test |
|-----------|-------------|-----------|
| **SRP** | How many reasons to change? | Can I describe it in one sentence? |
| **OCP** | Can I extend without modifying? | Are there long if-else chains? |
| **LSP** | Can derived replace base? | Do derived classes throw unexpected errors? |
| **ISP** | Are there unused methods? | Are there empty implementations? |
| **DIP** | Do I depend on abstractions? | Are dependencies injected? |

---

## When to Compromise

SOLID principles are guidelines, not absolute rules. Consider compromising when:

**Performance is Critical:**
- Abstraction layers may add overhead
- Direct implementation might be necessary
- Document the decision and reasons

**Simple, Isolated Scripts:**
- Over-engineering simple scripts wastes time
- YAGNI applies to architecture too
- Keep it simple for throwaway code

**Prototyping:**
- Quick proof-of-concepts don't need perfect design
- Refactor when moving to production
- Mark prototype code clearly

**Third-Party Constraints:**
- External libraries may impose design constraints
- Create adapter layers to isolate violations
- Document architectural compromises

---

## References

See [language-examples.md](references/language-examples.md) for Java, JavaScript, Go, and Rust examples.

See [anti-patterns.md](references/anti-patterns.md) for common SOLID violations and how to detect them.

See [code-review-checklist.md](references/code-review-checklist.md) for code review guidelines.
