# Information Expert & Creator - Detailed Reference

Deep dive into the foundational GRASP principles for responsibility and creation assignment.

---

## Information Expert

### Core Concept

**Assign responsibility to the class that has the information necessary to fulfill it.**

The Information Expert principle answers the question: "Given a responsibility, which class should have it?"

### Implementation Steps

1. **Identify the Responsibility**
   - What needs to be done?
   - What information is required?

2. **Find the Expert**
   - Which class has the most relevant data?
   - Which class would naturally perform this task?

3. **Assign and Validate**
   - Add the method to the expert class
   - Verify it maintains high cohesion
   - Ensure it doesn't create excessive coupling

### Detailed Examples

```python
from decimal import Decimal
from typing import List
from dataclasses import dataclass, field

# Example 1: Order calculating its own total
@dataclass
class OrderItem:
    product_id: str
    name: str
    price: Decimal
    quantity: int

    def get_subtotal(self) -> Decimal:
        """OrderItem is expert on its own subtotal."""
        return self.price * self.quantity


@dataclass
class Order:
    order_id: str
    customer_id: str
    items: List[OrderItem] = field(default_factory=list)
    discount_rate: Decimal = Decimal('0.0')

    def calculate_subtotal(self) -> Decimal:
        """Order is expert on combining item subtotals."""
        return sum(item.get_subtotal() for item in self.items)

    def calculate_discount(self) -> Decimal:
        """Order is expert on its discount calculation."""
        return self.calculate_subtotal() * self.discount_rate

    def calculate_total(self) -> Decimal:
        """Order is expert on its final total."""
        return self.calculate_subtotal() - self.calculate_discount()

    def get_item_count(self) -> int:
        """Order is expert on its item count."""
        return sum(item.quantity for item in self.items)

    def has_item(self, product_id: str) -> bool:
        """Order is expert on its contents."""
        return any(item.product_id == product_id for item in self.items)


# Example 2: Student managing academic data
@dataclass
class Course:
    course_id: str
    name: str
    credits: int
    grade: float = 0.0

    def get_grade_points(self) -> float:
        """Course is expert on its grade points."""
        return self.grade * self.credits


@dataclass
class Student:
    student_id: str
    name: str
    courses: List[Course] = field(default_factory=list)

    def calculate_gpa(self) -> float:
        """Student is expert on its own GPA."""
        if not self.courses:
            return 0.0

        total_points = sum(c.get_grade_points() for c in self.courses)
        total_credits = sum(c.credits for c in self.courses)

        return total_points / total_credits if total_credits > 0 else 0.0

    def get_academic_standing(self) -> str:
        """Student is expert on its academic standing."""
        gpa = self.calculate_gpa()
        if gpa >= 3.5:
            return "Dean's List"
        elif gpa >= 2.0:
            return "Good Standing"
        else:
            return "Academic Probation"

    def is_enrolled_in(self, course_id: str) -> bool:
        """Student is expert on its enrollments."""
        return any(c.course_id == course_id for c in self.courses)
```

### TypeScript Example

```typescript
// Information Expert in TypeScript
interface ProductData {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
}

class Product {
  constructor(
    readonly id: string,
    readonly name: string,
    private _price: number,
    private _stockQuantity: number
  ) {}

  // Product is expert on its own availability
  isAvailable(quantity: number): boolean {
    return this._stockQuantity >= quantity;
  }

  // Product is expert on its pricing
  calculatePrice(quantity: number): number {
    return this._price * quantity;
  }

  // Product is expert on stock management
  decrementStock(quantity: number): void {
    if (!this.isAvailable(quantity)) {
      throw new Error(`Insufficient stock for ${this.name}`);
    }
    this._stockQuantity -= quantity;
  }

  get price(): number {
    return this._price;
  }

  get stockQuantity(): number {
    return this._stockQuantity;
  }
}

class ShoppingCart {
  private items: Map<string, { product: Product; quantity: number }> = new Map();

  // Cart is expert on its contents
  addItem(product: Product, quantity: number): void {
    const existing = this.items.get(product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.set(product.id, { product, quantity });
    }
  }

  // Cart is expert on its total
  calculateTotal(): number {
    let total = 0;
    for (const { product, quantity } of this.items.values()) {
      total += product.calculatePrice(quantity);
    }
    return total;
  }

  // Cart is expert on item count
  getItemCount(): number {
    let count = 0;
    for (const { quantity } of this.items.values()) {
      count += quantity;
    }
    return count;
  }

  // Cart is expert on whether it contains a product
  containsProduct(productId: string): boolean {
    return this.items.has(productId);
  }
}
```

---

## Creator

### Core Concept

**Assign class B the responsibility to create instances of class A if B:**
- Contains or aggregates A
- Records A
- Closely uses A
- Has the initializing data for A

### Creator Selection Priority

When multiple classes could create an object, use this priority:

1. **Contains/Aggregates** (strongest) - Parent-child relationships
2. **Records** - Manages lifecycle and persistence
3. **Closely Uses** - Frequent collaboration
4. **Has Init Data** (weakest) - Has necessary initialization information

### Detailed Examples

```python
from datetime import datetime
from typing import List, Optional
from dataclasses import dataclass, field
from uuid import uuid4

# Example 1: Container creates contained items
@dataclass
class CommentReply:
    reply_id: str
    author_id: str
    content: str
    created_at: datetime


@dataclass
class Comment:
    """Comment is CREATOR of CommentReply (contains replies)."""
    comment_id: str
    author_id: str
    content: str
    created_at: datetime
    replies: List[CommentReply] = field(default_factory=list)

    def add_reply(self, author_id: str, content: str) -> CommentReply:
        """Comment creates Reply - it contains/aggregates replies."""
        reply = CommentReply(
            reply_id=str(uuid4()),
            author_id=author_id,
            content=content,
            created_at=datetime.now()
        )
        self.replies.append(reply)
        return reply


@dataclass
class BlogPost:
    """BlogPost is CREATOR of Comment (contains comments)."""
    post_id: str
    title: str
    content: str
    author_id: str
    comments: List[Comment] = field(default_factory=list)

    def add_comment(self, author_id: str, content: str) -> Comment:
        """BlogPost creates Comment - it contains/aggregates comments."""
        comment = Comment(
            comment_id=str(uuid4()),
            author_id=author_id,
            content=content,
            created_at=datetime.now()
        )
        self.comments.append(comment)
        return comment


# Example 2: Class with initialization data creates object
@dataclass
class OrderItem:
    product_id: str
    product_name: str
    price_at_purchase: float
    quantity: int


@dataclass
class Product:
    product_id: str
    name: str
    price: float
    stock: int

    def create_order_item(self, quantity: int) -> OrderItem:
        """
        Product is CREATOR of OrderItem because:
        - It has the initialization data (price, name)
        - The item captures product state at purchase time
        """
        if quantity > self.stock:
            raise ValueError(f"Insufficient stock: {self.stock} available")

        return OrderItem(
            product_id=self.product_id,
            product_name=self.name,
            price_at_purchase=self.price,
            quantity=quantity
        )


# Example 3: Service that records/manages creates objects
@dataclass
class User:
    user_id: str
    email: str
    name: str
    created_at: datetime


class UserRepository:
    """
    UserRepository is CREATOR of User because:
    - It records Users (persistence)
    - It manages User lifecycle
    """
    def __init__(self, db):
        self.db = db
        self._users: dict[str, User] = {}

    def create_user(self, email: str, name: str) -> User:
        """Repository creates User - it records and manages users."""
        user_id = str(uuid4())
        user = User(
            user_id=user_id,
            email=email,
            name=name,
            created_at=datetime.now()
        )
        self._users[user_id] = user
        return user

    def find_by_id(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)
```

### When NOT to Use Creator

Creator pattern should be avoided when:

1. **Complex creation logic** - Use Factory pattern instead
2. **Need flexibility** - Use Abstract Factory or DI
3. **Would create high coupling** - Use Pure Fabrication

```python
# When Creator is NOT appropriate - use Factory instead
from abc import ABC, abstractmethod

class NotificationFactory:
    """
    Factory is appropriate when:
    - Creation logic is complex
    - Need to choose between implementations
    - Want to centralize creation decisions
    """
    @staticmethod
    def create_notification(notification_type: str, message: str) -> 'Notification':
        if notification_type == "email":
            return EmailNotification(message)
        elif notification_type == "sms":
            return SmsNotification(message)
        elif notification_type == "push":
            return PushNotification(message)
        else:
            raise ValueError(f"Unknown notification type: {notification_type}")


class Notification(ABC):
    @abstractmethod
    def send(self, recipient: str) -> None:
        pass


class EmailNotification(Notification):
    def __init__(self, message: str):
        self.message = message

    def send(self, recipient: str) -> None:
        print(f"Sending email to {recipient}: {self.message}")
```

---

## Combining Information Expert and Creator

Often these principles work together:

```python
@dataclass
class Playlist:
    """
    Playlist demonstrates both principles:
    - CREATOR of PlaylistItem (contains them)
    - INFORMATION EXPERT for playlist operations (has the data)
    """
    playlist_id: str
    name: str
    owner_id: str
    items: List['PlaylistItem'] = field(default_factory=list)

    # Creator: Playlist creates PlaylistItem
    def add_song(self, song: 'Song', added_by: str) -> 'PlaylistItem':
        """Creates PlaylistItem - Playlist contains items."""
        item = PlaylistItem(
            song_id=song.song_id,
            song_title=song.title,
            duration_seconds=song.duration_seconds,
            added_by=added_by,
            added_at=datetime.now()
        )
        self.items.append(item)
        return item

    # Information Expert: Playlist knows its duration
    def get_total_duration(self) -> int:
        """Calculates total duration - has all item data."""
        return sum(item.duration_seconds for item in self.items)

    # Information Expert: Playlist knows its contents
    def contains_song(self, song_id: str) -> bool:
        """Checks if song exists - has item data."""
        return any(item.song_id == song_id for item in self.items)

    # Information Expert: Playlist can find its items
    def get_songs_by_user(self, user_id: str) -> List['PlaylistItem']:
        """Filters items - has all item data."""
        return [item for item in self.items if item.added_by == user_id]
```

---

## Compliance Checklist

### Information Expert
- [ ] Class has direct access to all information needed
- [ ] Responsibility is cohesive with class's existing purpose
- [ ] No excessive getter/setter usage to pull data from others
- [ ] Design feels natural and intuitive
- [ ] Doesn't violate SRP by taking on too many responsibilities

### Creator
- [ ] Creator has clear relationship with created object
- [ ] Creation logic isn't duplicated across multiple classes
- [ ] Created objects aren't excessively coupled to creator
- [ ] Creator doesn't become "god class" creating too many types
- [ ] Lifecycle management is clear and logical
