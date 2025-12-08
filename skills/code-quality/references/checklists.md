# Code Quality Checklists

Complete checklists for code quality and code reviews.

---

## Code Quality Checklist

### Naming

- [ ] Variables have descriptive, intention-revealing names
- [ ] Functions clearly describe their behavior
- [ ] Classes represent clear concepts
- [ ] Constants use UPPER_CASE convention
- [ ] No abbreviations or cryptic shortcuts
- [ ] Names are searchable and pronounceable

### Functions

- [ ] Each function does one thing well
- [ ] Maximum 200 lines per function
- [ ] 0-3 parameters (avoid more)
- [ ] No hidden side effects
- [ ] Clear return types with type hints
- [ ] Meaningful function names

### Structure

- [ ] Maximum 1000 lines per file
- [ ] Related functionality grouped logically
- [ ] All imports at top of file
- [ ] Clear separation of concerns
- [ ] Public API separated from internal implementation

### Error Handling

- [ ] Uses exceptions, not error codes
- [ ] Meaningful error messages with context
- [ ] Proper exception hierarchy
- [ ] Clean up resources appropriately (try/finally, context managers)
- [ ] Fail fast - validate early

### Testing

- [ ] Unit tests for all business logic
- [ ] Tests are readable and maintainable
- [ ] Test names describe scenarios
- [ ] Tests are independent and repeatable
- [ ] Edge cases covered

### Documentation

- [ ] Comments explain "why" not "what"
- [ ] No redundant comments
- [ ] Public APIs have docstrings
- [ ] Complex algorithms documented

---

## Code Review Checklist

### Before Requesting Review

- [ ] Code is formatted consistently (ran formatter)
- [ ] All tests pass locally
- [ ] No linter warnings
- [ ] Meaningful commit messages
- [ ] Self-review completed
- [ ] PR description explains the change
- [ ] No commented-out code
- [ ] No debug/print statements left in

### During Review (As Reviewer)

**Functionality:**
- [ ] Code does what it claims to do
- [ ] Edge cases handled
- [ ] No obvious bugs or logic errors

**Design:**
- [ ] Single responsibility per function/class
- [ ] No obvious DRY violations
- [ ] No over-engineering (KISS)
- [ ] No speculative features (YAGNI)

**Quality:**
- [ ] Clear naming throughout
- [ ] Appropriate error handling
- [ ] No magic numbers/strings
- [ ] Type hints present

**Communication:**
- [ ] Ask open-ended questions
- [ ] Suggest alternatives with examples
- [ ] Focus on learning, not criticism
- [ ] Acknowledge good practices
- [ ] Explain reasoning for suggestions

### After Review

- [ ] Responded to all comments
- [ ] Made agreed-upon changes
- [ ] Re-ran tests after changes
- [ ] Updated related documentation if needed

---

## Pre-Commit Checklist

Quick checks before every commit:

```
[ ] Code compiles/runs without errors
[ ] Tests pass
[ ] Linter passes (no warnings)
[ ] No hardcoded secrets/credentials
[ ] No TODO comments without issue reference
[ ] Imports sorted and at top
[ ] No print/debug statements
```

---

## Pull Request Template

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Checklist
- [ ] Tests pass
- [ ] Linter passes
- [ ] Self-reviewed
- [ ] Documentation updated (if needed)
```

---

## Quick Decision Trees

### Should I Add This Abstraction?

```
Do you have 3+ concrete implementations?
├── YES → Consider abstraction
└── NO → Keep it simple, no abstraction
```

### Should I Optimize This Code?

```
Is performance actually a problem?
├── NO → Don't optimize (KISS)
└── YES → Did you measure/profile?
          ├── NO → Measure first
          └── YES → Optimize the bottleneck
```

### Should I Extract This Function?

```
Is the code >20 lines AND doing multiple things?
├── YES → Extract
└── NO → Does the same logic appear 3+ times?
          ├── YES → Extract (DRY)
          └── NO → Leave inline
```
