# Principles Deep Dive

Detailed examples and guidance for DRY, KISS, and YAGNI principles.

## DRY (Don't Repeat Yourself)

### When to Extract

**Extract when:**
- Same logic appears 3+ times
- Business rule needs single source of truth
- Configuration is duplicated

```python
# BEFORE: Same validation in 3 places
def create_user(email):
    if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
        raise ValueError("Invalid email")
    # ...

def update_user(user_id, email):
    if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
        raise ValueError("Invalid email")
    # ...

def send_invite(email):
    if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
        raise ValueError("Invalid email")
    # ...

# AFTER: Single source of truth
EMAIL_PATTERN = re.compile(r'^[\w\.-]+@[\w\.-]+\.\w+$')

def validate_email(email: str) -> None:
    if not EMAIL_PATTERN.match(email):
        raise ValueError(f"Invalid email format: {email}")

def create_user(email):
    validate_email(email)
    # ...
```

### When NOT to Extract

**Don't extract when:**
- Code looks similar but serves different purposes
- Extraction creates tight coupling
- Only 2 occurrences (wait for the third)

```python
# DON'T extract these - they serve different purposes
def format_user_name(user):
    return f"{user.first_name} {user.last_name}"

def format_author_credit(author):
    return f"{author.first_name} {author.last_name}"

# These might diverge later:
# - User names might need middle name
# - Author credits might need titles (Dr., PhD)
```

---

## KISS (Keep It Simple, Stupid)

### Anti-Pattern: Over-Abstraction

```python
# BAD: Abstract factory for simple case
class NotificationFactory:
    def __init__(self, config):
        self.config = config

    def create_notifier(self, notification_type):
        notifiers = {
            'email': EmailNotifier(self.config),
            'sms': SMSNotifier(self.config),
        }
        return notifiers.get(notification_type)

# Usage (complex for no benefit)
factory = NotificationFactory(config)
notifier = factory.create_notifier('email')
notifier.send(message)

# GOOD: Direct and simple
def send_email(to: str, message: str) -> bool:
    return email_client.send(to, message)

def send_sms(phone: str, message: str) -> bool:
    return sms_client.send(phone, message)

# Usage (clear and direct)
send_email(user.email, message)
```

### Anti-Pattern: Premature Optimization

```python
# BAD: Optimizing before measuring
class CachedUserRepository:
    def __init__(self):
        self._cache = {}
        self._cache_ttl = {}
        self._cache_hits = 0
        self._cache_misses = 0

    def get_user(self, user_id):
        if self._is_cache_valid(user_id):
            self._cache_hits += 1
            return self._cache[user_id]
        # ... complex cache invalidation logic

# GOOD: Simple first, optimize when proven needed
class UserRepository:
    def get_user(self, user_id: int) -> User:
        return self.db.query(User).get(user_id)

# Add caching only after profiling shows it's needed
```

### Decision Framework

Ask yourself:
1. Can a junior developer understand this in 5 minutes?
2. Would the simple version work for 90% of cases?
3. Am I solving an actual problem or a hypothetical one?

If any answer is "yes" to #2 or #3, use the simple approach.

---

## YAGNI (You Aren't Gonna Need It)

### Common Violations

**1. Unused Parameters**

```python
# BAD: Parameters "for future use"
def process_data(data, format='json', compression=None,
                 encryption=None, parallel=False):
    # Only uses data and format, rest are "for later"
    return json.dumps(data)

# GOOD: Only what you need
def process_data(data: dict) -> str:
    return json.dumps(data)
```

**2. Speculative Interfaces**

```python
# BAD: Interface for hypothetical implementations
class DataStore(ABC):
    @abstractmethod
    def save(self, data): pass

    @abstractmethod
    def load(self, id): pass

    @abstractmethod
    def batch_save(self, items): pass  # "Might need this"

    @abstractmethod
    def batch_load(self, ids): pass  # "Might need this"

    @abstractmethod
    def stream(self): pass  # "Might need this"

# GOOD: Only what you actually use
class DataStore(ABC):
    @abstractmethod
    def save(self, data): pass

    @abstractmethod
    def load(self, id): pass
```

**3. Feature Flags for Non-Existent Features**

```python
# BAD
if settings.ENABLE_NEW_DASHBOARD:  # Always False, no code exists
    # TODO: Implement new dashboard
    pass

# GOOD: Just don't add the flag until the feature exists
```

### When to Add Flexibility

Add extension points only when:
- You have 3+ concrete implementations
- External plugins need to integrate
- Requirements explicitly state extensibility

```python
# GOOD: Multiple concrete implementations exist
class PaymentProcessor(ABC):
    @abstractmethod
    def process(self, amount): pass

class StripeProcessor(PaymentProcessor):
    def process(self, amount):
        # Real implementation
        pass

class PayPalProcessor(PaymentProcessor):
    def process(self, amount):
        # Real implementation
        pass
```

---

## Principle Selection Guide

| Situation | Apply |
|-----------|-------|
| Same code in 3+ places | DRY |
| Complex solution to simple problem | KISS |
| "We might need this later" | YAGNI |
| Premature optimization | KISS + YAGNI |
| Speculative abstractions | YAGNI |
| Duplicated business rules | DRY |

### Conflict Resolution

When principles seem to conflict:

**DRY vs KISS**: If extracting code makes it harder to understand, prefer KISS. "A little duplication is better than a bad abstraction."

**DRY vs YAGNI**: Don't create abstractions to DRY up code that might change. Wait until the pattern stabilizes.

**KISS vs Readability**: Simple doesn't mean unreadable. Use clear names and comments where needed.
