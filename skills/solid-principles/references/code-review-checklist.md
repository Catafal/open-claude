# SOLID Code Review Checklist

Complete checklist for reviewing code against SOLID principles.

---

## Pre-Review Quick Check

Before diving deep, scan for obvious issues:

```
[ ] No classes with "Manager", "Handler", "Helper" names
[ ] No long if-else chains (5+ branches)
[ ] No empty method implementations
[ ] No `new ConcreteClass()` inside constructors
[ ] No duplicate code blocks
```

---

## SOLID Principles Review

### S - Single Responsibility Principle

**Review Focus**: One reason to change per class

- [ ] Each class has a single, well-defined responsibility
- [ ] Class can be described in one sentence without using "and"
- [ ] Changes to one business requirement don't affect unrelated code
- [ ] All methods in a class are cohesive (related to the same purpose)
- [ ] Class doesn't mix concerns (UI + Business Logic + Data Access)

**Key Question**: "If this class needs to change, how many different reasons could cause that change?"

---

### O - Open-Closed Principle

**Review Focus**: Extend without modifying

- [ ] New features can be added by creating new classes
- [ ] Existing, tested code doesn't need modification for new features
- [ ] Polymorphism is used for varying behaviors (not if-else chains)
- [ ] Abstract base classes or interfaces define extension points
- [ ] No type checking (isinstance, typeof) for behavior selection

**Key Question**: "Can I add new functionality without changing existing code?"

---

### L - Liskov Substitution Principle

**Review Focus**: Derived classes are substitutable

- [ ] Derived classes can replace base classes without issues
- [ ] No exceptions thrown in derived classes for base class methods
- [ ] Derived classes don't strengthen preconditions
- [ ] Derived classes don't weaken postconditions
- [ ] Base class invariants are preserved in derived classes

**Key Question**: "Does every test that passes for the base class also pass for derived classes?"

---

### I - Interface Segregation Principle

**Review Focus**: Small, focused interfaces

- [ ] Interfaces are small and role-specific (1-3 methods ideal)
- [ ] No empty or exception-throwing method implementations
- [ ] Classes don't implement methods they don't need
- [ ] Large interfaces are split into cohesive smaller ones
- [ ] Clients depend only on methods they actually use

**Key Question**: "Does any class implementing this interface have methods it doesn't need?"

---

### D - Dependency Inversion Principle

**Review Focus**: Depend on abstractions

- [ ] Dependencies are injected (constructor, method, or property)
- [ ] High-level modules don't import low-level concrete classes
- [ ] Code depends on interfaces/abstract classes, not implementations
- [ ] Dependencies can be mocked for testing
- [ ] No `new ConcreteClass()` for service dependencies

**Key Question**: "Can I easily swap implementations without changing this class?"

---

## Quick Reference Table

| Principle | Key Question | Red Flag |
|-----------|-------------|----------|
| **SRP** | How many reasons to change? | Class does 3+ unrelated things |
| **OCP** | Can I extend without modifying? | Long if-else/switch chains |
| **LSP** | Can derived replace base? | "Not supported" exceptions |
| **ISP** | Are there unused methods? | Empty method implementations |
| **DIP** | Do I depend on abstractions? | `new ConcreteClass()` in constructor |

---

## Review Conversation Starters

Instead of just pointing out violations, ask constructive questions:

**For SRP concerns**:
- "What would need to change if [requirement X] changes?"
- "Could we separate [responsibility A] from [responsibility B]?"

**For OCP concerns**:
- "How would we add a new [type/behavior] here?"
- "Could we use polymorphism instead of this conditional?"

**For LSP concerns**:
- "Does this derived class fully honor the base class contract?"
- "Would existing tests pass if we substituted this class?"

**For ISP concerns**:
- "Do all implementers of this interface need all these methods?"
- "Could we split this into smaller, more focused interfaces?"

**For DIP concerns**:
- "How would we test this class in isolation?"
- "What if we needed to switch to a different implementation?"

---

## Code Review Best Practices

### Before Requesting Review

- [ ] Self-reviewed against this checklist
- [ ] All tests pass
- [ ] No linter warnings
- [ ] Clear commit messages
- [ ] PR description explains the change

### During Review (As Reviewer)

**Functionality**:
- [ ] Code does what it claims to do
- [ ] Edge cases handled appropriately
- [ ] No obvious bugs or logic errors

**SOLID Compliance**:
- [ ] Single responsibility per class
- [ ] Extension without modification
- [ ] Proper inheritance hierarchies
- [ ] Focused interfaces
- [ ] Dependency injection used

**Quality**:
- [ ] Clear naming throughout
- [ ] Appropriate error handling
- [ ] No magic numbers/strings
- [ ] Type hints/annotations present

### After Review

- [ ] Responded to all comments
- [ ] Made agreed-upon changes
- [ ] Re-ran tests after changes
- [ ] Updated documentation if needed

---

## Severity Guidelines

When reporting issues, categorize by severity:

**Critical** (Must fix):
- DIP violation creating untestable code
- LSP violation causing runtime errors
- SRP violation in core business logic

**Major** (Should fix):
- OCP violation requiring frequent modifications
- ISP violation with many empty implementations
- Significant code duplication

**Minor** (Consider fixing):
- Small SRP concerns in utility classes
- Slight over-engineering
- Minor naming improvements

---

## Example Review Comments

### Good Comments

```
"This class seems to handle both validation and persistence.
Could we separate these into a UserValidator and UserRepository?
This would make each easier to test independently."

"I notice we're checking shape.type to determine behavior.
Would a Shape interface with an area() method help us
add new shapes without modifying this function?"

"This test would be easier if we could inject a mock database.
Consider adding a Database interface parameter to the constructor."
```

### Less Helpful Comments

```
"This violates SRP." (No guidance)
"Bad design." (No specifics)
"Refactor this." (No direction)
```

---

## Post-Review Action Items

After identifying SOLID violations:

1. **Prioritize**: Fix critical issues first
2. **Scope**: Keep refactoring focused
3. **Test**: Add tests before refactoring
4. **Iterate**: Small, incremental improvements
5. **Document**: Note architectural decisions
