# Structural Patterns - Detailed Reference

Extended examples for structural design patterns.

---

## Bridge Pattern

**Separate Abstraction from Implementation**

```python
from abc import ABC, abstractmethod

# Implementation interface
class Renderer(ABC):
    @abstractmethod
    def render_circle(self, radius: float) -> str:
        pass

    @abstractmethod
    def render_square(self, side: float) -> str:
        pass

# Concrete implementations
class VectorRenderer(Renderer):
    def render_circle(self, radius: float) -> str:
        return f"Drawing circle with vectors, radius: {radius}"

    def render_square(self, side: float) -> str:
        return f"Drawing square with vectors, side: {side}"

class RasterRenderer(Renderer):
    def render_circle(self, radius: float) -> str:
        return f"Drawing circle with pixels, radius: {radius}"

    def render_square(self, side: float) -> str:
        return f"Drawing square with pixels, side: {side}"

# Abstraction
class Shape(ABC):
    def __init__(self, renderer: Renderer):
        self.renderer = renderer

    @abstractmethod
    def draw(self) -> str:
        pass

# Refined abstractions
class Circle(Shape):
    def __init__(self, renderer: Renderer, radius: float):
        super().__init__(renderer)
        self.radius = radius

    def draw(self) -> str:
        return self.renderer.render_circle(self.radius)

class Square(Shape):
    def __init__(self, renderer: Renderer, side: float):
        super().__init__(renderer)
        self.side = side

    def draw(self) -> str:
        return self.renderer.render_square(self.side)

# Usage - Mix and match
vector = VectorRenderer()
raster = RasterRenderer()

circle_vector = Circle(vector, 5.0)
circle_raster = Circle(raster, 5.0)
```

---

## Composite Pattern

**Tree Structures**

```python
from abc import ABC, abstractmethod
from typing import List

class FileSystemItem(ABC):
    @abstractmethod
    def get_size(self) -> int:
        pass

    @abstractmethod
    def display(self, indent: int = 0) -> str:
        pass

class File(FileSystemItem):
    def __init__(self, name: str, size: int):
        self.name = name
        self.size = size

    def get_size(self) -> int:
        return self.size

    def display(self, indent: int = 0) -> str:
        return "  " * indent + f"File: {self.name} ({self.size}B)"

class Directory(FileSystemItem):
    def __init__(self, name: str):
        self.name = name
        self.children: List[FileSystemItem] = []

    def add(self, item: FileSystemItem) -> None:
        self.children.append(item)

    def remove(self, item: FileSystemItem) -> None:
        self.children.remove(item)

    def get_size(self) -> int:
        return sum(child.get_size() for child in self.children)

    def display(self, indent: int = 0) -> str:
        result = "  " * indent + f"Dir: {self.name}/"
        for child in self.children:
            result += "\n" + child.display(indent + 1)
        return result

# Usage
root = Directory("root")
docs = Directory("docs")
docs.add(File("readme.md", 1024))
docs.add(File("guide.pdf", 5120))
root.add(docs)
root.add(File("main.py", 2048))

print(root.display())
print(f"Total size: {root.get_size()}B")
```

---

## Proxy Pattern

**Control Access to Object**

```python
from abc import ABC, abstractmethod

class Image(ABC):
    @abstractmethod
    def display(self) -> str:
        pass

class RealImage(Image):
    def __init__(self, filename: str):
        self.filename = filename
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        print(f"Loading {self.filename} from disk...")

    def display(self) -> str:
        return f"Displaying {self.filename}"

class ProxyImage(Image):
    def __init__(self, filename: str):
        self.filename = filename
        self._real_image: RealImage = None

    def display(self) -> str:
        # Lazy loading
        if self._real_image is None:
            self._real_image = RealImage(self.filename)
        return self._real_image.display()

# Usage - Image loaded only when displayed
proxy = ProxyImage("large_photo.jpg")  # No loading yet
print("Image proxy created")
print(proxy.display())  # Now it loads
```

---

## Flyweight Pattern

**Share Common State**

```python
class TreeType:
    """Flyweight - shared state"""
    def __init__(self, name: str, color: str, texture: str):
        self.name = name
        self.color = color
        self.texture = texture

class TreeFactory:
    """Flyweight factory"""
    _tree_types: dict = {}

    @classmethod
    def get_tree_type(cls, name: str, color: str, texture: str) -> TreeType:
        key = f"{name}_{color}_{texture}"
        if key not in cls._tree_types:
            cls._tree_types[key] = TreeType(name, color, texture)
        return cls._tree_types[key]

class Tree:
    """Contains unique state + flyweight reference"""
    def __init__(self, x: int, y: int, tree_type: TreeType):
        self.x = x
        self.y = y
        self.tree_type = tree_type

# Usage - Many trees share few TreeTypes
forest = []
for i in range(1000):
    tree_type = TreeFactory.get_tree_type("Oak", "Green", "Bark")
    forest.append(Tree(i * 10, i * 5, tree_type))

# Only 1 TreeType object created despite 1000 trees
```

---

## Pattern Selection Guide

| Pattern | Use Case |
|---------|----------|
| **Adapter** | Make incompatible interfaces work together |
| **Bridge** | Separate abstraction from implementation |
| **Composite** | Treat individual and groups uniformly |
| **Decorator** | Add behavior without subclassing |
| **Facade** | Simplify complex subsystem interface |
| **Flyweight** | Share common state across many objects |
| **Proxy** | Control access (lazy loading, caching, security) |
