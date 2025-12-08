# SOLID Anti-Patterns and Violations

Common violations of SOLID principles and how to detect them.

---

## General Anti-Patterns

### 1. God Object / God Class

**Description**: One class handles too many responsibilities.

**Violates**: Single Responsibility Principle (SRP)

**Symptoms**:
- Class has 10+ methods doing unrelated things
- Class name is vague (Manager, Handler, Processor, Helper)
- Changes in one area affect unrelated areas
- Hard to test in isolation

```python
# ANTI-PATTERN
class ApplicationManager:
    def authenticate_user(self): pass
    def validate_input(self): pass
    def save_to_database(self): pass
    def send_email(self): pass
    def generate_report(self): pass
    def calculate_taxes(self): pass
    def log_activity(self): pass
    def render_html(self): pass
    # ... 20+ more methods
```

**Fix**: Break into focused, single-responsibility classes.

---

### 2. Spaghetti Code

**Description**: Code with tangled, unstructured control flow.

**Violates**: Multiple principles (SRP, OCP)

**Symptoms**:
- Deep nesting (5+ levels)
- Global variables everywhere
- No clear module boundaries
- Functions doing many unrelated things

```python
# ANTI-PATTERN
total = 0
user_data = {}

def process():
    global total, user_data
    if user_data.get('type') == 'premium':
        total += 100
        if user_data.get('country') == 'US':
            if user_data.get('age') > 18:
                total -= 10
                # More nested conditions...
```

**Fix**: Restructure with clear responsibilities and dependency injection.

---

### 3. Golden Hammer

**Description**: Using one familiar tool/pattern for everything.

**Violates**: Open-Closed Principle (OCP)

**Symptoms**:
- Forcing inheritance when composition is better
- Using the same pattern regardless of fit
- Ignoring language idioms

```python
# ANTI-PATTERN: Inheritance for everything
class Animal(BaseModel): pass
class Dog(Animal): pass
class DogFood(Dog): pass  # Nonsensical!
class DogWalker(Dog): pass  # Makes no sense!
```

**Fix**: Choose the right pattern for each problem.

---

### 4. Boat Anchor

**Description**: Keeping unused code "just in case."

**Violates**: YAGNI (related to SOLID mindset)

**Symptoms**:
- Commented-out code blocks
- Unused parameters "for future use"
- Empty method implementations
- Feature flags for non-existent features

```python
# ANTI-PATTERN
def process_data(data, format='json', compression=None,
                 encryption=None, cache_strategy=None):
    # Only uses data and format
    # Rest are "for later" - YAGNI violation
    return json.dumps(data)
```

**Fix**: Delete unused code. Version control preserves history.

---

### 5. Magic Numbers and Strings

**Description**: Unexplained literal values scattered in code.

**Symptoms**:
- Numbers without context: `if price > 100:`
- String literals repeated: `if status == "active":`
- Hard to change values consistently

```python
# ANTI-PATTERN
def calculate_discount(price):
    if price > 100:
        return price * 0.15  # What is 0.15?
    return price * 0.05  # What is 0.05?
```

**Fix**: Use named constants.

```python
# CORRECT
PREMIUM_THRESHOLD = 100
PREMIUM_DISCOUNT_RATE = 0.15
STANDARD_DISCOUNT_RATE = 0.05
```

---

### 6. Copy-Paste Programming

**Description**: Duplicating code instead of abstracting.

**Violates**: DRY principle (related to SRP)

**Symptoms**:
- Same logic in multiple places
- Fixing bugs requires multiple edits
- Inconsistent behavior across copies

**Fix**: Extract common functionality into shared functions/classes.

---

## SOLID-Specific Violations

### SRP Violation: Multiple Responsibilities

**Detection Questions**:
- Does the class have more than one reason to change?
- Can I describe the class in one sentence without "and"?
- Are there multiple distinct groups of methods?

```python
# VIOLATION: Three responsibilities
class UserDashboard:
    def render_html(self):  # UI concern
        pass

    def calculate_statistics(self):  # Business logic
        pass

    def save_to_database(self):  # Data access
        pass
```

---

### OCP Violation: Modifying Existing Code

**Detection Questions**:
- Do I need to modify existing code to add features?
- Are there long if-else or switch statements?
- Is type checking used for behavior selection?

```python
# VIOLATION: Must modify for each new type
def calculate_area(shapes):
    total = 0
    for shape in shapes:
        if shape.type == "circle":
            total += 3.14 * shape.radius ** 2
        elif shape.type == "rectangle":
            total += shape.width * shape.height
        elif shape.type == "triangle":  # New type = modification
            total += 0.5 * shape.base * shape.height
    return total
```

---

### LSP Violation: Broken Substitution

**Detection Questions**:
- Can I substitute derived classes for base classes?
- Do derived classes throw unexpected exceptions?
- Do derived classes strengthen preconditions?

```python
# VIOLATION: Square breaks Rectangle's contract
class Square(Rectangle):
    def set_width(self, width):
        self._width = width
        self._height = width  # Unexpected!

def test_area(rect: Rectangle):
    rect.set_width(5)
    rect.set_height(4)
    assert rect.area() == 20  # Fails for Square!
```

---

### ISP Violation: Fat Interfaces

**Detection Questions**:
- Are there empty or exception-throwing implementations?
- Do clients depend on methods they don't use?
- Is the interface too large or general?

```python
# VIOLATION: Robot forced to implement eat/sleep
class Worker(ABC):
    @abstractmethod
    def work(self): pass
    @abstractmethod
    def eat(self): pass
    @abstractmethod
    def sleep(self): pass

class Robot(Worker):
    def work(self): print("Working")
    def eat(self): pass  # Forced empty!
    def sleep(self): pass  # Forced empty!
```

---

### DIP Violation: Concrete Dependencies

**Detection Questions**:
- Do high-level modules instantiate low-level classes directly?
- Are dependencies hard-coded?
- Is the code difficult to test due to concrete dependencies?

```python
# VIOLATION: Hard-coded dependency
class UserService:
    def __init__(self):
        self.db = MySQLDatabase()  # Direct instantiation!

    def save_user(self, user):
        self.db.save(user)
```

---

## Detection Checklist

Use during code reviews:

### SRP Checklist
- [ ] Each class has a single, well-defined responsibility
- [ ] Class can be described in one sentence without "and"
- [ ] Changes to one requirement don't affect unrelated code
- [ ] Methods are cohesive and related to class purpose

### OCP Checklist
- [ ] New features added through extension, not modification
- [ ] Abstractions used for varying behaviors
- [ ] No long if-else or switch statements for type checking
- [ ] Core logic is stable and unchanged

### LSP Checklist
- [ ] Derived classes can replace base classes seamlessly
- [ ] No strengthened preconditions in derived classes
- [ ] No weakened postconditions in derived classes
- [ ] No unexpected exceptions in derived classes

### ISP Checklist
- [ ] Interfaces are small and focused
- [ ] No empty or exception-throwing method implementations
- [ ] Clients depend only on methods they use
- [ ] Large interfaces split into role-specific ones

### DIP Checklist
- [ ] Dependencies injected, not instantiated
- [ ] Code depends on abstractions, not concrete classes
- [ ] Easy to mock dependencies for testing
- [ ] High-level modules independent of low-level details

---

## Quick Detection Smells

| Smell | Likely Violation |
|-------|-----------------|
| Class name contains "Manager", "Handler", "Processor" | SRP |
| Long if-else chain checking types | OCP |
| Derived class throws "not supported" exception | LSP |
| Empty method implementations | ISP |
| `new ConcreteClass()` inside constructors | DIP |
| Same code in multiple places | DRY (related to SRP) |
| Methods that don't use instance state | Possible SRP |
| Class with 10+ methods | Possible SRP |
| Interface with 5+ methods | Possible ISP |
