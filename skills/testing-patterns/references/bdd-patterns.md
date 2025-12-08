# BDD Patterns - Detailed Reference

Behavior-Driven Development patterns, Gherkin syntax, and Example Mapping techniques.

---

## The BDD Cycle

### Discovery → Formulation → Automation

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  DISCOVERY          FORMULATION         AUTOMATION              │
│  (Workshops)        (Gherkin)           (Step Definitions)      │
│                                                                 │
│  "What could        "What should        "What does              │
│   it do?"            it do?"             it actually do?"       │
│                                                                 │
│  Business +         Given-When-Then     Executable              │
│  Dev + QA           scenarios           specifications          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Mapping Workshop

### Structure

Use colored cards/stickies:
- **Yellow**: Feature/User Story (at top)
- **Blue**: Business Rules
- **Green**: Examples (concrete scenarios)
- **Red**: Questions (unknowns)

```
┌─────────────────────────────────────────────────────────────────┐
│ [YELLOW] User Story                                             │
│ As a customer, I want to apply discount codes                   │
│ so I can save money on my order                                 │
└─────────────────────────────────────────────────────────────────┘
        │
        ├── [BLUE] Rule: Codes expire after 30 days
        │       │
        │       ├── [GREEN] Valid code applied → discount shown
        │       ├── [GREEN] Expired code → "Code expired" message
        │       └── [RED] What happens if code expires during checkout?
        │
        ├── [BLUE] Rule: Only one code per order
        │       │
        │       ├── [GREEN] Apply second code → replaces first
        │       └── [GREEN] Already has discount → shows warning
        │
        └── [BLUE] Rule: Minimum order value of $25
                │
                ├── [GREEN] $30 order with code → discount applied
                ├── [GREEN] $20 order with code → "Minimum $25" error
                └── [RED] What if removing items drops below minimum?
```

---

## Gherkin Syntax

### Feature File Structure

```gherkin
# File: features/discount_codes.feature

Feature: Discount Code Application
  As a customer
  I want to apply discount codes to my order
  So that I can save money on purchases

  Background:
    Given a customer is logged in
    And the shopping cart contains items worth $50

  # Basic scenario
  Scenario: Apply valid discount code
    Given a valid 10% discount code "SAVE10" exists
    When the customer applies code "SAVE10"
    Then the discount of $5 should be applied
    And the order total should be $45

  # Scenario with data table
  Scenario: Apply code with minimum order value
    Given the following discount codes exist:
      | code   | discount | min_order |
      | SAVE10 | 10%      | $25       |
      | SAVE20 | 20%      | $50       |
    When the customer applies code "SAVE10"
    Then the discount should be applied

  # Scenario outline for multiple cases
  Scenario Outline: Code validation
    Given a discount code "<code>" with status "<status>"
    When the customer applies code "<code>"
    Then the result should be "<result>"

    Examples:
      | code      | status  | result                    |
      | VALID10   | active  | success                   |
      | EXPIRED10 | expired | Code has expired          |
      | USED10    | used    | Code already used         |
      | INVALID   | invalid | Code not found            |

  # Edge case scenarios
  Scenario: Remove discount code
    Given the customer has applied discount code "SAVE10"
    When the customer removes the discount code
    Then no discount should be applied
    And the order total should be $50
```

### Best Practices for Gherkin

```gherkin
# ✅ GOOD - Business language, declarative
Scenario: Premium member gets free shipping
  Given a premium member with items in cart
  When the member proceeds to checkout
  Then shipping should be free

# ❌ BAD - Technical, implementation-focused
Scenario: Test premium shipping
  Given database has user with premium_flag=true
  When POST /api/checkout with user_id=123
  Then response.shipping_cost == 0


# ✅ GOOD - Focused scenario
Scenario: Password must have minimum length
  When a user registers with password "short"
  Then registration should fail with "Password too short"

# ❌ BAD - Tests too many things
Scenario: User registration
  When a user submits registration form
  Then the form should validate email
  And the form should validate password length
  And the form should validate password complexity
  And the form should check for existing email
  And user should be created
  And confirmation email should be sent


# ✅ GOOD - Specific and concrete
Scenario: Apply 10% discount to $100 order
  Given an order totaling $100
  When a 10% discount code is applied
  Then the total should be $90

# ❌ BAD - Vague
Scenario: Apply discount
  Given an order
  When discount is applied
  Then total is updated
```

---

## Step Definitions

### Python with Behave

```python
# features/steps/discount_steps.py
from behave import given, when, then
from decimal import Decimal


@given('a customer is logged in')
def step_impl(context):
    context.customer = create_test_customer()
    context.session = login(context.customer)


@given('the shopping cart contains items worth ${amount:d}')
def step_impl(context, amount):
    context.cart = ShoppingCart(customer=context.customer)
    context.cart.add_item(create_product(price=Decimal(str(amount))))


@given('a valid {discount_percent:d}% discount code "{code}" exists')
def step_impl(context, discount_percent, code):
    context.discount_code = create_discount_code(
        code=code,
        discount_percent=discount_percent,
        status='active'
    )


@given('the following discount codes exist')
def step_impl(context):
    context.discount_codes = {}
    for row in context.table:
        code = create_discount_code(
            code=row['code'],
            discount=row['discount'],
            min_order=parse_currency(row['min_order'])
        )
        context.discount_codes[row['code']] = code


@when('the customer applies code "{code}"')
def step_impl(context, code):
    context.result = context.cart.apply_discount_code(code)


@then('the discount of ${amount:d} should be applied')
def step_impl(context, amount):
    assert context.cart.discount == Decimal(str(amount))


@then('the order total should be ${amount:d}')
def step_impl(context, amount):
    assert context.cart.total == Decimal(str(amount))


@then('the result should be "{expected_result}"')
def step_impl(context, expected_result):
    if expected_result == "success":
        assert context.result.success is True
    else:
        assert context.result.error == expected_result
```

### Reusable Steps

```python
# features/steps/common_steps.py

@given('a user with email "{email}" exists')
def step_user_exists(context, email):
    """Reusable step for creating test users."""
    context.user = create_or_get_user(email=email)


@given('the user is authenticated')
def step_user_authenticated(context):
    """Reusable step for authentication."""
    context.auth_token = authenticate(context.user)


@then('the operation should succeed')
def step_operation_succeeds(context):
    """Generic success assertion."""
    assert context.result.success is True


@then('the operation should fail with "{error}"')
def step_operation_fails(context, error):
    """Generic failure assertion."""
    assert context.result.success is False
    assert error in context.result.error
```

---

## JavaScript with Cucumber.js

```javascript
// features/step_definitions/discount_steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('a customer is logged in', function () {
  this.customer = createTestCustomer();
  this.session = login(this.customer);
});

Given('the shopping cart contains items worth ${int}', function (amount) {
  this.cart = new ShoppingCart(this.customer);
  this.cart.addItem(createProduct({ price: amount }));
});

Given('a valid {int}% discount code {string} exists', function (percent, code) {
  this.discountCode = createDiscountCode({
    code: code,
    discountPercent: percent,
    status: 'active'
  });
});

When('the customer applies code {string}', function (code) {
  this.result = this.cart.applyDiscountCode(code);
});

Then('the discount of ${int} should be applied', function (amount) {
  assert.strictEqual(this.cart.discount, amount);
});

Then('the order total should be ${int}', function (amount) {
  assert.strictEqual(this.cart.total, amount);
});
```

---

## Handling Data Tables

```gherkin
# Feature file with data tables
Scenario: Bulk add items to cart
  Given the following products exist:
    | sku   | name          | price  | stock |
    | SKU-1 | Blue T-Shirt  | 29.99  | 100   |
    | SKU-2 | Red Hat       | 15.00  | 50    |
    | SKU-3 | Black Jeans   | 49.99  | 25    |
  When I add the following items to cart:
    | sku   | quantity |
    | SKU-1 | 2        |
    | SKU-3 | 1        |
  Then my cart should contain:
    | name         | quantity | subtotal |
    | Blue T-Shirt | 2        | 59.98    |
    | Black Jeans  | 1        | 49.99    |
```

```python
# Step definition for data tables
@given('the following products exist')
def step_impl(context):
    for row in context.table:
        create_product(
            sku=row['sku'],
            name=row['name'],
            price=Decimal(row['price']),
            stock=int(row['stock'])
        )


@when('I add the following items to cart')
def step_impl(context):
    for row in context.table:
        context.cart.add_item(
            sku=row['sku'],
            quantity=int(row['quantity'])
        )


@then('my cart should contain')
def step_impl(context):
    cart_items = {item.name: item for item in context.cart.items}

    for row in context.table:
        item = cart_items.get(row['name'])
        assert item is not None, f"Item {row['name']} not in cart"
        assert item.quantity == int(row['quantity'])
        assert item.subtotal == Decimal(row['subtotal'])
```

---

## Tags for Organization

```gherkin
@authentication @smoke
Feature: User Authentication

  @positive @critical
  Scenario: Successful login
    ...

  @negative @security
  Scenario: Login with invalid password
    ...

  @slow @nightly
  Scenario: Password lockout after multiple failures
    ...
```

```bash
# Run only smoke tests
behave --tags=@smoke

# Run all except slow tests
behave --tags="not @slow"

# Run critical authentication tests
behave --tags="@authentication and @critical"
```

---

## BDD Best Practices Checklist

- [ ] Discovery workshop held before writing scenarios
- [ ] Scenarios written in business language
- [ ] Each scenario tests one behavior
- [ ] Scenarios are independent
- [ ] Step definitions are reusable
- [ ] Avoid UI-specific details in scenarios
- [ ] Use Scenario Outline for variations
- [ ] Questions documented and resolved
- [ ] Tags used for organization
- [ ] Living documentation maintained
