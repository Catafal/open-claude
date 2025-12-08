# Behavioral Patterns - Detailed Reference

Extended examples for behavioral design patterns.

---

## Chain of Responsibility

**Pass Request Along Chain**

```python
from abc import ABC, abstractmethod
from typing import Optional

class Handler(ABC):
    def __init__(self):
        self._next_handler: Optional[Handler] = None

    def set_next(self, handler: "Handler") -> "Handler":
        self._next_handler = handler
        return handler

    @abstractmethod
    def handle(self, request: str) -> Optional[str]:
        pass

class AuthHandler(Handler):
    def handle(self, request: str) -> Optional[str]:
        if "auth" in request:
            return "Auth handled"
        elif self._next_handler:
            return self._next_handler.handle(request)
        return None

class ValidationHandler(Handler):
    def handle(self, request: str) -> Optional[str]:
        if "validate" in request:
            return "Validation handled"
        elif self._next_handler:
            return self._next_handler.handle(request)
        return None

class ProcessingHandler(Handler):
    def handle(self, request: str) -> Optional[str]:
        return "Processing handled"

# Build chain
auth = AuthHandler()
validation = ValidationHandler()
processing = ProcessingHandler()

auth.set_next(validation).set_next(processing)

# Use chain
result = auth.handle("validate request")
```

---

## State Pattern

**Object Behavior Changes Based on State**

```python
from abc import ABC, abstractmethod

class State(ABC):
    @abstractmethod
    def handle(self, context: "Context") -> str:
        pass

class IdleState(State):
    def handle(self, context: "Context") -> str:
        context.state = ProcessingState()
        return "Starting processing..."

class ProcessingState(State):
    def handle(self, context: "Context") -> str:
        context.state = CompletedState()
        return "Processing complete"

class CompletedState(State):
    def handle(self, context: "Context") -> str:
        context.state = IdleState()
        return "Reset to idle"

class Context:
    def __init__(self):
        self.state: State = IdleState()

    def request(self) -> str:
        return self.state.handle(self)

# Usage
context = Context()
print(context.request())  # Starting processing...
print(context.request())  # Processing complete
print(context.request())  # Reset to idle
```

---

## Mediator Pattern

**Centralize Complex Communications**

```python
from abc import ABC, abstractmethod
from typing import List

class Mediator(ABC):
    @abstractmethod
    def notify(self, sender: "Component", event: str) -> None:
        pass

class ChatRoom(Mediator):
    def __init__(self):
        self.users: List[User] = []

    def add_user(self, user: "User") -> None:
        self.users.append(user)
        user.mediator = self

    def notify(self, sender: "User", message: str) -> None:
        for user in self.users:
            if user != sender:
                user.receive(f"[{sender.name}]: {message}")

class User:
    def __init__(self, name: str):
        self.name = name
        self.mediator: Mediator = None

    def send(self, message: str) -> None:
        self.mediator.notify(self, message)

    def receive(self, message: str) -> None:
        print(f"{self.name} received: {message}")

# Usage
chat = ChatRoom()
alice = User("Alice")
bob = User("Bob")

chat.add_user(alice)
chat.add_user(bob)

alice.send("Hello!")  # Bob receives it
```

---

## Iterator Pattern

**Traverse Collection Without Exposing Structure**

```python
from abc import ABC, abstractmethod
from typing import List, TypeVar, Generic

T = TypeVar('T')

class Iterator(ABC, Generic[T]):
    @abstractmethod
    def has_next(self) -> bool:
        pass

    @abstractmethod
    def next(self) -> T:
        pass

class ListIterator(Iterator[T]):
    def __init__(self, items: List[T]):
        self._items = items
        self._position = 0

    def has_next(self) -> bool:
        return self._position < len(self._items)

    def next(self) -> T:
        item = self._items[self._position]
        self._position += 1
        return item

# Python's built-in iteration
class CustomCollection:
    def __init__(self):
        self._items = []

    def add(self, item) -> None:
        self._items.append(item)

    def __iter__(self):
        return iter(self._items)

# Usage
collection = CustomCollection()
collection.add("a")
collection.add("b")
for item in collection:
    print(item)
```

---

## Memento Pattern

**Capture and Restore State**

```python
from dataclasses import dataclass
from typing import List

@dataclass
class Memento:
    """Stores state snapshot"""
    state: str

class Editor:
    """Originator - creates and restores mementos"""
    def __init__(self):
        self._content = ""

    def type(self, text: str) -> None:
        self._content += text

    def get_content(self) -> str:
        return self._content

    def save(self) -> Memento:
        return Memento(self._content)

    def restore(self, memento: Memento) -> None:
        self._content = memento.state

class History:
    """Caretaker - manages mementos"""
    def __init__(self):
        self._mementos: List[Memento] = []

    def push(self, memento: Memento) -> None:
        self._mementos.append(memento)

    def pop(self) -> Memento:
        return self._mementos.pop()

# Usage
editor = Editor()
history = History()

editor.type("Hello ")
history.push(editor.save())

editor.type("World")
history.push(editor.save())

editor.type("!!!")

print(editor.get_content())  # Hello World!!!
editor.restore(history.pop())
print(editor.get_content())  # Hello World
```

---

## Visitor Pattern

**Add Operations Without Changing Classes**

```python
from abc import ABC, abstractmethod

class Visitor(ABC):
    @abstractmethod
    def visit_circle(self, circle: "Circle") -> str:
        pass

    @abstractmethod
    def visit_square(self, square: "Square") -> str:
        pass

class Shape(ABC):
    @abstractmethod
    def accept(self, visitor: Visitor) -> str:
        pass

class Circle(Shape):
    def __init__(self, radius: float):
        self.radius = radius

    def accept(self, visitor: Visitor) -> str:
        return visitor.visit_circle(self)

class Square(Shape):
    def __init__(self, side: float):
        self.side = side

    def accept(self, visitor: Visitor) -> str:
        return visitor.visit_square(self)

class AreaCalculator(Visitor):
    def visit_circle(self, circle: Circle) -> str:
        return f"Circle area: {3.14 * circle.radius ** 2}"

    def visit_square(self, square: Square) -> str:
        return f"Square area: {square.side ** 2}"

# Usage
shapes = [Circle(5), Square(4)]
calculator = AreaCalculator()

for shape in shapes:
    print(shape.accept(calculator))
```

---

## Pattern Selection Guide

| Pattern | Use Case |
|---------|----------|
| **Chain of Responsibility** | Pass request through handler chain |
| **Command** | Encapsulate action as object |
| **Iterator** | Traverse collection uniformly |
| **Mediator** | Centralize complex communications |
| **Memento** | Capture/restore object state |
| **Observer** | Notify dependents of state change |
| **State** | Behavior varies by internal state |
| **Strategy** | Interchangeable algorithms |
| **Template Method** | Define algorithm skeleton |
| **Visitor** | Add operations without changing classes |
