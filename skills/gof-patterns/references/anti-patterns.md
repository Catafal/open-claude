# GoF Anti-Patterns and Violations

Common mistakes when applying Gang of Four patterns.

---

## God Object

**Description**: One class handles too many responsibilities

**Violates**: Single Responsibility, defeats purpose of Factory/Strategy patterns

```python
# ANTI-PATTERN
class ApplicationManager:
    def authenticate(self): pass
    def validate_input(self): pass
    def save_to_database(self): pass
    def send_email(self): pass
    def generate_report(self): pass
    def calculate_taxes(self): pass
```

**Fix**: Break into focused classes (use Factory to create them)

---

## Spaghetti Code

**Description**: Tangled control flow, no clear pattern

**Symptoms**:
- Deep nesting (5+ levels)
- Long if-else chains
- No abstraction

```python
# ANTI-PATTERN
def process(data, user_type, action, format):
    if user_type == "admin":
        if action == "create":
            if format == "json":
                # ... deep nesting continues
```

**Fix**: Use Strategy pattern for varying behaviors

---

## Golden Hammer

**Description**: Using one pattern for everything

**Example**: Using inheritance for everything when composition is better

```python
# ANTI-PATTERN - Forcing inheritance
class Dog(Animal): pass
class DogFood(Dog): pass  # Nonsensical!

# CORRECT - Use composition/interfaces
class Dog(Eatable, Walkable): pass
```

---

## Factory Over-Engineering

**Description**: Creating factories for simple object creation

```python
# ANTI-PATTERN - Unnecessary factory
class StringFactory:
    @staticmethod
    def create_string(value):
        return str(value)

# Just use the constructor!
s = str(value)
```

**When Factory IS appropriate**:
- Multiple related types to create
- Creation logic is complex
- Need to decouple client from concrete classes

---

## Singleton Abuse

**Description**: Using Singleton for everything

**Problems**:
- Global state
- Hard to test
- Hidden dependencies

```python
# ANTI-PATTERN
class Database:
    _instance = None
    # ... singleton logic

# BETTER - Use dependency injection
class UserService:
    def __init__(self, database: Database):
        self.db = database
```

---

## Decorator Explosion

**Description**: Too many decorators making code unreadable

```python
# ANTI-PATTERN
@timing
@logging
@caching
@retrying
@validating
@authenticating
def process():
    pass
```

**Fix**: Combine related behaviors into single decorator or use middleware

---

## Observer Memory Leaks

**Description**: Not detaching observers

```python
# ANTI-PATTERN - Never detaches
class BadSubject:
    def attach(self, observer):
        self._observers.append(observer)
    # No detach method!

# CORRECT
class GoodSubject:
    def attach(self, observer):
        self._observers.append(observer)

    def detach(self, observer):
        self._observers.remove(observer)
```

---

## Detection Checklist

| Smell | Likely Problem |
|-------|----------------|
| Class with 10+ methods doing unrelated things | God Object |
| Long if-else checking types | Missing Strategy/Factory |
| `new ConcreteClass()` in business logic | Missing Dependency Injection |
| Empty method implementations | Violated Interface Segregation |
| Global state accessed everywhere | Singleton abuse |
| Decorator stack 5+ deep | Decorator explosion |
| Observers never removed | Memory leak risk |

---

## Quick Detection Smells

- **God Class**: Name contains "Manager", "Handler", "Processor"
- **Missing Pattern**: Long switch/if-else on types
- **Singleton Abuse**: `ClassName.getInstance()` everywhere
- **Over-Engineering**: Factory for single concrete class
- **Coupling**: Direct instantiation of dependencies
