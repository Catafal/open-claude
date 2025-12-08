---
name: code-comments
description: Guide for writing effective code comments that explain WHY, not WHAT. Use this skill when writing, reviewing, or improving code comments in any programming language. Triggers when users ask about commenting code, request comment improvements, or when code needs documentation. Covers Python (PEP 8), JavaScript/TypeScript (JSDoc/TSDoc), Java (Javadoc), Go, and Rust documentation standards.
---

# Code Comments

Guide for writing effective code comments based on industry best practices.

## Golden Rule

**"Code tells you HOW, Comments tell you WHY"**

- Explain WHY decisions were made
- Document business logic and constraints
- Clarify non-obvious performance optimizations
- Note known limitations or workarounds

**DO NOT:**
- Restate what the code obviously does
- Explain HOW the code works (code should be self-documenting)
- Add comments that duplicate variable/function names

```python
# BAD: States the obvious
# Increment counter by 1
counter += 1

# GOOD: Explains why
# Skip the first record as it contains column headers, not data
counter += 1
```

## Decision Tree: Should I Add This Comment?

```
START: I want to add a comment
    |
    v
[Does the code CLEARLY show WHAT it does?]
    |
    +-- NO --> Refactor code first (better names, extract functions)
    |          Return to START
    |
    +-- YES
        |
        v
    [Does the code CLEARLY show WHY?]
        |
        +-- YES --> No comment needed
        |
        +-- NO
            |
            v
        [Is this a public API, complex algorithm, or business rule?]
            |
            +-- YES --> ADD COMMENT (explain why/context)
            |
            +-- NO --> Consider if comment truly adds value
                       If unsure, skip comment
```

## Self-Documenting Code First

**Priority Order:**
1. Write clear, descriptive variable/function names
2. Refactor complex code into well-named functions
3. Add comments only where intent isn't clear from code structure
4. Use standardized documentation formats for public APIs

**Principle:** The best comment is a good method or class name. If you need extensive comments to explain code, refactor the code instead.

## When to Comment

### ALWAYS Comment

1. **Public APIs and Interfaces**
   - Function purpose, parameters, return values
   - Expected behavior and side effects
   - Exception conditions

2. **Complex Business Logic**
   - Non-obvious domain rules
   - Regulatory/compliance requirements
   - Calculation formulas with sources

3. **Performance Optimizations**
   - Why non-standard approach chosen
   - Trade-offs made
   - Benchmark references

4. **Workarounds and Hacks**
   - Why workaround necessary
   - Issue tracker reference
   - Conditions for removal

5. **Non-Obvious Dependencies**
   - External system requirements
   - Implicit ordering constraints
   - State assumptions

### NEVER Comment

1. **Obvious Code**
   ```python
   # BAD: Set name to John
   name = "John"
   ```

2. **Code That Should Be Refactored**
   - Long comments explaining complex logic = refactor into well-named function

3. **Version Control Information**
   - No "Modified by: John Doe, 2024-03-15"
   - Use git for history

4. **Commented-Out Code**
   - Delete it (use version control for history)
   - Exception: Temporarily during active debugging (max 24 hours)

## Section Headers

Use sparingly. Excessive decoration wastes space.

**APPROVED (3 lines max):**
```python
# ============================================================================
# Module: AI Use Cases Schema
# Purpose: Enriching skills with AI-powered learning workflows
# ============================================================================
```

**AVOID (excessive):**
```python
# ********************************************************************************
# **                           USER AUTHENTICATION                              **
# ********************************************************************************
```

**Organizational headers within files:**
```python
# === Public API ===

# === Internal Implementation ===

# === Helper Functions ===
```

**Anti-Pattern:** Multiple section headers = file should be split into modules.

## Special Cases

### Regex and Complex Patterns

```python
# Match ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS[.fraction][timezone]
# Example: 2024-03-15T14:30:00.000Z
iso_pattern = r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$'
```

### Magic Numbers

```python
# HTTP timeout: Industry standard 30s for third-party API calls
TIMEOUT_SECONDS = 30

# Max retries: Based on exponential backoff reaching 5 minutes total
MAX_RETRIES = 5
```

### Algorithm Complexity

```python
def find_optimal_path(graph: Graph) -> Path:
    """
    Find shortest path using Dijkstra's algorithm.

    Time Complexity: O((V + E) log V) with binary heap
    Space Complexity: O(V) for priority queue

    Chosen over A* because heuristic unavailable for our use case.
    See: Cormen et al., "Introduction to Algorithms", 3rd ed., Ch. 24
    """
```

## Anti-Patterns to Avoid

### 1. Rotting Comments (Most Dangerous)

Comments that become outdated as code changes.

```python
# BAD: Comment says Bronze/Silver/Gold but code supports 5 tiers now
# Calculate discount based on user tier (Bronze/Silver/Gold)
discount = get_discount(user.membership_level)
```

**Prevention:** Keep comments high-level, review during code reviews, delete rather than update if code is self-explanatory.

### 2. End-of-Scope Comments

```python
# BAD: Indicates function is too long/complex
if user.is_active:
    for order in user.orders:
        # ... 50 lines of code ...
    # end for each order
# end if user is active
```

**Solution:** Refactor into smaller functions.

### 3. Section Dividers as Band-Aid

```python
# BAD: Violates Single Responsibility Principle
class UserManager:
    # === Validation Methods ===
    # === Database Methods ===
    # === Email Methods ===
```

**Solution:** Split into `UserValidator`, `UserRepository`, `UserNotifier` classes.

### 4. Emotional/Complaint Comments

```python
# BAD
# This is stupid but management wants it this way
# TODO: Fix this horrible hack when we have time (we never will)
```

**Solution:** Use professional language, reference issue tracker.

See [anti-patterns.md](references/anti-patterns.md) for more detailed examples.

## Language Standards

Use standardized documentation formats:

| Language   | Standard Format | Tool |
|------------|----------------|------|
| Python     | PEP 8, Docstrings | Sphinx, pdoc |
| JavaScript | JSDoc | JSDoc |
| TypeScript | TSDoc | TypeDoc |
| Java       | Javadoc | Javadoc |
| Go         | Go Doc Comments | godoc |
| Rust       | Rust Doc Comments | rustdoc |

See [language-examples.md](references/language-examples.md) for complete examples in each language.

## Quick Reference

### Python (PEP 8)

```python
def calculate_duration(skills_gap: list[str], weekly_hours: int) -> dict:
    """
    Calculate estimated completion time for learning path.

    Args:
        skills_gap: List of skill identifiers requiring development
        weekly_hours: Time commitment in hours per week

    Returns:
        Dictionary with 'weeks' and 'total_hours' keys

    Note:
        Assumes 80% retention rate. Based on Bloom's taxonomy levels.
    """
```

### TypeScript (TSDoc)

```typescript
/**
 * Validates workflow step completion criteria
 *
 * @param workflowId - Unique identifier for the workflow
 * @param stepName - Name of the step to validate
 * @returns Promise resolving to validation result
 *
 * @remarks
 * Uses state machine validation to ensure prerequisites completed.
 *
 * @throws {WorkflowNotFoundError} If workflowId doesn't exist
 */
async function validateStepCompletion(
  workflowId: string,
  stepName: string
): Promise<ValidationResult>
```

## Code Review Checklist

When reviewing code comments, verify:

- [ ] No commented-out code (except active debugging)
- [ ] Comments explain WHY not WHAT
- [ ] No outdated author/date information
- [ ] Section headers justified (not masking SRP violations)
- [ ] Language-specific doc format followed
- [ ] Public APIs fully documented
- [ ] No redundant/obvious comments
