---
name: code-quality
description: Guide for writing clean, maintainable code following DRY, KISS, YAGNI principles. Use when writing new code, refactoring existing code, or reviewing pull requests. Covers naming conventions, function design, error handling, and code organization. Triggers when users ask about code quality, best practices, or need guidance on writing better code.
---

# Code Quality

Guide for writing clean, maintainable code based on industry best practices.

## Core Philosophy

**Clean Code Is:**
- Well-designed and intentionally structured
- Highly readable by other developers
- Clearly expresses the author's intent
- Easy to understand, modify, and extend

**The Goal:** Code that others (including future you) can understand quickly and modify safely.

---

## The Big Three Principles

### DRY (Don't Repeat Yourself)

Eliminate duplicate code through abstraction.

**Apply When:**
- Same logic appears in multiple places
- Configuration values are hardcoded in multiple files
- Similar data processing patterns repeat

```python
# BAD: Repeated logic
def calculate_user_discount(user):
    if user.years_active > 5:
        return 0.20
    elif user.years_active > 2:
        return 0.10
    return 0

def calculate_order_discount(order):
    if order.user.years_active > 5:
        return 0.20
    elif order.user.years_active > 2:
        return 0.10
    return 0

# GOOD: Single source of truth
def get_loyalty_discount(years_active: int) -> float:
    if years_active > 5:
        return 0.20
    elif years_active > 2:
        return 0.10
    return 0
```

### KISS (Keep It Simple, Stupid)

Prefer straightforward solutions over clever ones.

**Apply When:**
- Designing new features
- Choosing between approaches
- Prototyping or MVP development

```python
# BAD: Over-engineered
class UserValidatorFactory:
    def create_validator(self, validation_type):
        validators = {
            'email': EmailValidator(),
            'name': NameValidator(),
        }
        return validators.get(validation_type)

# GOOD: Simple and direct
def validate_user(email: str, name: str) -> bool:
    return is_valid_email(email) and len(name) > 0
```

### YAGNI (You Aren't Gonna Need It)

Only implement features when actually needed.

**Apply When:**
- Tempted to add "future-proof" code
- Adding configuration options "just in case"
- Building abstractions for hypothetical use cases

```python
# BAD: Speculative feature
class DataProcessor:
    def __init__(self, format='json', compression=None,
                 encryption=None, cache_strategy=None):
        # We only use JSON without compression...
        pass

# GOOD: Build what you need now
class DataProcessor:
    def process_json(self, data: dict) -> dict:
        # Clear, focused implementation
        pass
```

---

## Naming Conventions

### Variables

Use descriptive, intention-revealing names:

```python
# BAD
d = 7  # elapsed time in days
temp = users[0]
data = fetch()

# GOOD
days_since_last_login = 7
first_user = users[0]
active_subscriptions = fetch_subscriptions()
```

### Functions

Name should describe the behavior:

```python
# BAD
def process(x):
    pass

def do_stuff():
    pass

# GOOD
def calculate_monthly_revenue(transactions: list) -> float:
    pass

def send_welcome_email(user: User) -> bool:
    pass
```

### Classes

Represent clear concepts:

```python
# BAD
class Manager:  # Manager of what?
    pass

class Data:  # What kind of data?
    pass

# GOOD
class SubscriptionManager:
    pass

class UserProfile:
    pass
```

### Constants

Use UPPER_CASE:

```python
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT_SECONDS = 30
API_BASE_URL = "https://api.example.com"
```

---

## Function Design

### Single Responsibility

Each function should do one thing well:

```python
# BAD: Does too many things
def process_user(user):
    # Validates user
    if not user.email:
        raise ValueError("Invalid email")
    # Saves to database
    db.save(user)
    # Sends email
    send_email(user.email, "Welcome!")
    # Updates analytics
    analytics.track("user_created", user.id)

# GOOD: Separate concerns
def validate_user(user: User) -> None:
    if not user.email:
        raise ValueError("Invalid email")

def create_user(user: User) -> User:
    validate_user(user)
    return db.save(user)

def on_user_created(user: User) -> None:
    send_welcome_email(user)
    track_user_signup(user)
```

### Parameter Limits

Ideal: 0-2 parameters. Maximum: 3.

```python
# BAD: Too many parameters
def create_report(title, author, date, format, include_charts,
                  page_size, orientation, header, footer):
    pass

# GOOD: Use configuration object
@dataclass
class ReportConfig:
    title: str
    author: str
    date: datetime
    format: str = "pdf"
    include_charts: bool = True

def create_report(config: ReportConfig) -> Report:
    pass
```

### Size Limits

- **Maximum 200 lines per function**
- If longer, break into smaller functions

### No Side Effects

Functions should be predictable:

```python
# BAD: Hidden side effect
def get_user_name(user_id: int) -> str:
    user = db.get(user_id)
    user.last_accessed = datetime.now()  # Side effect!
    db.save(user)
    return user.name

# GOOD: Explicit and separate
def get_user_name(user_id: int) -> str:
    user = db.get(user_id)
    return user.name

def update_last_accessed(user_id: int) -> None:
    user = db.get(user_id)
    user.last_accessed = datetime.now()
    db.save(user)
```

---

## Code Organization

### File Size Limits

- **Maximum 1000 lines per file**
- If larger, split into modules

### Import Organization

All imports at the top of the file:

```python
# Standard library
import os
import sys
from datetime import datetime

# Third-party
import requests
from pydantic import BaseModel

# Local
from app.models import User
from app.services import EmailService
```

### Logical Grouping

Related functionality together:

```python
# === Public API ===

def create_user(data: dict) -> User:
    """Create a new user."""
    pass

def get_user(user_id: int) -> User:
    """Retrieve user by ID."""
    pass

# === Internal Implementation ===

def _validate_user_data(data: dict) -> bool:
    """Validate user input data."""
    pass

def _hash_password(password: str) -> str:
    """Hash password for storage."""
    pass
```

---

## Error Handling

### Use Exceptions, Not Error Codes

```python
# BAD: Error codes
def divide(a, b):
    if b == 0:
        return None, "Division by zero"
    return a / b, None

# GOOD: Exceptions
def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
```

### Meaningful Error Messages

```python
# BAD
raise ValueError("Invalid input")

# GOOD
raise ValueError(
    f"User email '{email}' is invalid: must contain '@' symbol"
)
```

### Fail Fast

Validate early, fail explicitly:

```python
def process_order(order: Order) -> Receipt:
    # Validate at the start
    if not order.items:
        raise ValueError("Order must contain at least one item")
    if order.total <= 0:
        raise ValueError(f"Invalid order total: {order.total}")

    # Main processing (only if valid)
    return create_receipt(order)
```

---

## Boy Scout Rule

> "Leave code cleaner than you found it"

When working on code:
1. Fix small issues you encounter (typos, unclear names)
2. Remove dead code
3. Add missing type hints to functions you modify
4. Don't make unrelated large changes (separate PR)

---

## Quick Checklist

### Before Committing

- [ ] All imports at top of file
- [ ] Functions under 200 lines
- [ ] Files under 1000 lines
- [ ] Descriptive variable/function names
- [ ] No commented-out code
- [ ] No hardcoded magic numbers

### Code Review

- [ ] Single responsibility per function/class
- [ ] No obvious DRY violations
- [ ] Error handling at appropriate levels
- [ ] No speculative features (YAGNI)

---

## Tools & Automation

### Python

| Tool | Purpose |
|------|---------|
| **Black** | Code formatting (opinionated) |
| **isort** | Import sorting |
| **Flake8** | Style checking (PEP 8) |
| **Pylint** | Code analysis |
| **mypy** | Type checking |

### JavaScript/TypeScript

| Tool | Purpose |
|------|---------|
| **Prettier** | Code formatting |
| **ESLint** | Linting and style |
| **TypeScript** | Type checking |

### Setup Recommendation

1. Configure formatter (Black/Prettier) with format-on-save
2. Add linter to pre-commit hooks
3. Run type checker in CI pipeline

---

## References

See [principles-detail.md](references/principles-detail.md) for deeper examples of DRY, KISS, YAGNI.

See [checklists.md](references/checklists.md) for complete code quality and review checklists.
