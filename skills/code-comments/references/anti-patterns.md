# Comment Anti-Patterns

Detailed examples of comment anti-patterns to avoid, with solutions.

## 1. Rotting Comments (Most Dangerous)

Comments that become outdated as code evolves. Research shows comments have 2-3x higher "rot rate" than code in active projects.

### Example

```python
# BAD: Comment references 3 tiers but code now supports 5
# Calculate discount based on user tier (Bronze/Silver/Gold)
discount = calculate_tier_discount(user.membership_level)
# Code now handles: Bronze, Silver, Gold, Platinum, Diamond
```

### Prevention Strategies

1. **Keep comments high-level** - Less likely to become stale
2. **Review comments during code reviews** - Check for accuracy
3. **Delete rather than update** - If code is self-explanatory
4. **Avoid specific implementation details** - High change rate

### Good Practice

```python
# Legal requirement: tier-based discounts per customer agreement
discount = calculate_tier_discount(user.membership_level)
```

---

## 2. End-of-Scope Comments

Comments marking the end of code blocks indicate the function is too long or complex.

### Example

```python
# BAD: Indicates function needs refactoring
def process_user_data(user):
    if user.is_active:
        for order in user.orders:
            if order.status == "pending":
                # ... 50 lines of processing ...
                if order.requires_review:
                    # ... 30 more lines ...
                # end if requires_review
            # end if order is pending
        # end for each order
    # end if user is active
```

### Solution

Refactor into smaller, well-named functions:

```python
def process_user_data(user):
    if not user.is_active:
        return

    for order in user.orders:
        process_pending_order(order)


def process_pending_order(order):
    if order.status != "pending":
        return

    # Clear, focused processing
    validate_order(order)
    if order.requires_review:
        flag_for_review(order)
```

---

## 3. Section Dividers as Band-Aid

Using section comments to organize unrelated functionality within a single class violates Single Responsibility Principle.

### Example

```python
# BAD: Class does too many things
class UserManager:
    # === Validation Methods ===
    def validate_email(self): ...
    def validate_password(self): ...
    def validate_username(self): ...

    # === Database Methods ===
    def save_to_db(self): ...
    def load_from_db(self): ...
    def delete_from_db(self): ...

    # === Email Methods ===
    def send_welcome_email(self): ...
    def send_password_reset(self): ...
    def send_verification(self): ...

    # === Authentication Methods ===
    def login(self): ...
    def logout(self): ...
    def refresh_token(self): ...
```

### Solution

Split into focused classes:

```python
class UserValidator:
    def validate_email(self): ...
    def validate_password(self): ...
    def validate_username(self): ...


class UserRepository:
    def save(self, user): ...
    def load(self, user_id): ...
    def delete(self, user_id): ...


class UserNotifier:
    def send_welcome_email(self, user): ...
    def send_password_reset(self, user): ...
    def send_verification(self, user): ...


class AuthService:
    def login(self, credentials): ...
    def logout(self, session): ...
    def refresh_token(self, token): ...
```

---

## 4. Emotional/Complaint Comments

Unprofessional comments that vent frustration or blame others.

### Examples

```python
# BAD: Unprofessional
# This is stupid but management wants it this way
legacy_format = convert_to_deprecated_format(data)

# BAD: Passive-aggressive
# TODO: Fix this horrible hack when we have time (we never will)
workaround_for_bug_1234()

# BAD: Blame-shifting
# I don't know why this works but don't touch it
magic_number = 42.7

# BAD: Hostile
# WTF was the previous developer thinking?
refactored_mess = cleanup_legacy_code()
```

### Solutions

Use professional language and reference issue trackers:

```python
# Maintaining backward compatibility with v1 API format
# See migration plan: JIRA-4521
legacy_format = convert_to_deprecated_format(data)

# Workaround for upstream library bug
# Tracked: https://github.com/lib/issue/1234
# Remove after upgrading to v2.0
workaround_for_bug_1234()

# Empirically determined coefficient for signal normalization
# Derived from calibration tests (see docs/calibration.md)
normalization_factor = 42.7
```

---

## 5. Excessive Decorative Headers

Banner comments that waste vertical space without adding value.

### Example

```python
# ********************************************************************************
# ********************************************************************************
# **                                                                            **
# **                           USER AUTHENTICATION                              **
# **                                                                            **
# **            Login and Session Management Functions                          **
# **                                                                            **
# ********************************************************************************
# ********************************************************************************
```

This uses 8 lines to convey information that needs 2.

### Solution

Minimal, informative headers:

```python
# ============================================================================
# User Authentication - Login and Session Management
# ============================================================================
```

Or better yet, if the file is well-named (`user_auth.py`), no header is needed.

---

## 6. Commented-Out Code

Dead code left in comments clutters the codebase and confuses readers.

### Example

```python
def calculate_price(item):
    base_price = item.price

    # Old discount logic - keeping in case we need to revert
    # if item.category == "electronics":
    #     discount = 0.1
    # elif item.category == "clothing":
    #     discount = 0.15
    # else:
    #     discount = 0.05

    # New tiered discount system
    discount = get_tiered_discount(item)

    return base_price * (1 - discount)
```

### Solution

Delete commented code. Use version control for history:

```python
def calculate_price(item):
    base_price = item.price
    discount = get_tiered_discount(item)
    return base_price * (1 - discount)
```

If context is needed, add a proper comment:

```python
def calculate_price(item):
    base_price = item.price
    # Tiered discounts replaced category-based system (commit abc123)
    discount = get_tiered_discount(item)
    return base_price * (1 - discount)
```

---

## 7. Redundant Documentation

Comments that repeat information already in the code.

### Example

```python
# BAD: Every line restates the obvious
def add_user(name, email):
    # Create a new user dictionary
    user = {}

    # Set the name field to the name parameter
    user["name"] = name

    # Set the email field to the email parameter
    user["email"] = email

    # Set created_at to the current time
    user["created_at"] = datetime.now()

    # Return the user dictionary
    return user
```

### Solution

Only comment the non-obvious:

```python
def add_user(name, email):
    return {
        "name": name,
        "email": email,
        "created_at": datetime.now(),  # UTC timestamp for audit trail
    }
```

---

## Summary: Red Flags to Watch For

| Anti-Pattern | Red Flag | Solution |
|--------------|----------|----------|
| Rotting | Comment contradicts code | Update or delete |
| End-of-scope | `# end if`, `# end for` | Refactor to smaller functions |
| Section dividers | Multiple `===` in one class | Split into separate classes |
| Emotional | Frustration, blame, profanity | Professional language + issue tracker |
| Decorative | ASCII art, long borders | Minimal headers |
| Commented code | Code in `# ` blocks | Delete (use git) |
| Redundant | Comment = code in English | Delete |
