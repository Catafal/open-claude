# Creational Patterns - Detailed Reference

Extended examples for creational design patterns.

---

## Factory Method Pattern

**Full Implementation with Multiple Factories**

```python
from abc import ABC, abstractmethod

# Abstract Creator
class DocumentFactory(ABC):
    @abstractmethod
    def create_document(self) -> "Document":
        pass

    def process(self, content: str) -> str:
        doc = self.create_document()
        doc.write(content)
        return doc.save()

# Abstract Product
class Document(ABC):
    @abstractmethod
    def write(self, content: str) -> None:
        pass

    @abstractmethod
    def save(self) -> str:
        pass

# Concrete Products
class PDFDocument(Document):
    def __init__(self):
        self.content = ""

    def write(self, content: str) -> None:
        self.content = content

    def save(self) -> str:
        return f"PDF saved: {self.content}"

class WordDocument(Document):
    def __init__(self):
        self.content = ""

    def write(self, content: str) -> None:
        self.content = content

    def save(self) -> str:
        return f"Word saved: {self.content}"

# Concrete Factories
class PDFFactory(DocumentFactory):
    def create_document(self) -> Document:
        return PDFDocument()

class WordFactory(DocumentFactory):
    def create_document(self) -> Document:
        return WordDocument()

# Usage
pdf_factory = PDFFactory()
result = pdf_factory.process("Hello World")
```

---

## Abstract Factory Pattern

**For Creating Families of Related Objects**

```python
from abc import ABC, abstractmethod

# Abstract Products
class Button(ABC):
    @abstractmethod
    def render(self) -> str:
        pass

class Checkbox(ABC):
    @abstractmethod
    def render(self) -> str:
        pass

# Concrete Products - Material Design
class MaterialButton(Button):
    def render(self) -> str:
        return "<MaterialButton/>"

class MaterialCheckbox(Checkbox):
    def render(self) -> str:
        return "<MaterialCheckbox/>"

# Concrete Products - iOS Design
class IOSButton(Button):
    def render(self) -> str:
        return "<IOSButton/>"

class IOSCheckbox(Checkbox):
    def render(self) -> str:
        return "<IOSCheckbox/>"

# Abstract Factory
class UIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button:
        pass

    @abstractmethod
    def create_checkbox(self) -> Checkbox:
        pass

# Concrete Factories
class MaterialUIFactory(UIFactory):
    def create_button(self) -> Button:
        return MaterialButton()

    def create_checkbox(self) -> Checkbox:
        return MaterialCheckbox()

class IOSUIFactory(UIFactory):
    def create_button(self) -> Button:
        return IOSButton()

    def create_checkbox(self) -> Checkbox:
        return IOSCheckbox()

# Client code works with factory
def render_ui(factory: UIFactory):
    button = factory.create_button()
    checkbox = factory.create_checkbox()
    return f"{button.render()} {checkbox.render()}"
```

---

## Prototype Pattern

**Clone Existing Objects**

```python
import copy
from abc import ABC, abstractmethod

class Prototype(ABC):
    @abstractmethod
    def clone(self) -> "Prototype":
        pass

class Document(Prototype):
    def __init__(self, title: str, content: str):
        self.title = title
        self.content = content
        self.metadata = {"created": "2025-01-01"}

    def clone(self) -> "Document":
        # Deep copy for nested objects
        return copy.deepcopy(self)

# Usage
original = Document("Template", "Default content")
clone = original.clone()
clone.title = "New Document"
```

---

## Builder with Director

**Separate Construction Logic**

```python
from abc import ABC, abstractmethod

class House:
    def __init__(self):
        self.walls = None
        self.roof = None
        self.windows = None
        self.garage = None

class HouseBuilder(ABC):
    @abstractmethod
    def build_walls(self) -> None:
        pass

    @abstractmethod
    def build_roof(self) -> None:
        pass

    @abstractmethod
    def build_windows(self) -> None:
        pass

    @abstractmethod
    def build_garage(self) -> None:
        pass

    @abstractmethod
    def get_result(self) -> House:
        pass

class ModernHouseBuilder(HouseBuilder):
    def __init__(self):
        self.house = House()

    def build_walls(self) -> None:
        self.house.walls = "Glass walls"

    def build_roof(self) -> None:
        self.house.roof = "Flat roof"

    def build_windows(self) -> None:
        self.house.windows = "Floor-to-ceiling windows"

    def build_garage(self) -> None:
        self.house.garage = "Underground garage"

    def get_result(self) -> House:
        return self.house

class Director:
    def __init__(self, builder: HouseBuilder):
        self.builder = builder

    def build_minimal_house(self) -> House:
        self.builder.build_walls()
        self.builder.build_roof()
        return self.builder.get_result()

    def build_full_house(self) -> House:
        self.builder.build_walls()
        self.builder.build_roof()
        self.builder.build_windows()
        self.builder.build_garage()
        return self.builder.get_result()
```

---

## When to Use Each Pattern

| Pattern | Use Case |
|---------|----------|
| **Simple Factory** | Hide creation logic behind static method |
| **Factory Method** | Defer instantiation to subclasses |
| **Abstract Factory** | Create families of related objects |
| **Builder** | Complex object with many optional parts |
| **Prototype** | Clone expensive-to-create objects |
| **Singleton** | Single instance (use sparingly!) |
