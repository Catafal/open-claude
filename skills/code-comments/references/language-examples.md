# Language-Specific Comment Examples

Complete examples of documentation comments in each supported language.

## Python (PEP 8 / Docstrings)

### Module Docstring

```python
"""
AI Use Cases Generator

Generates personalized AI-powered learning workflows based on user skills
and career objectives. Integrates with LLM providers for content generation.

Copyright (c) 2025 Skillia. Licensed under MIT.
"""
```

### Class Docstring

```python
class SkillsProcessor:
    """
    Processes and categorizes user skills.

    Attributes:
        skill_taxonomy: Reference taxonomy for categorization
        threshold: Minimum confidence score for categorization (default 0.8)
    """
```

### Function Docstring

```python
def calculate_learning_path_duration(
    skills_gap: list[str],
    weekly_hours: int,
    proficiency_target: str
) -> dict[str, int]:
    """
    Calculate estimated completion time for personalized learning path.

    Args:
        skills_gap: List of skill identifiers requiring development
        weekly_hours: Time commitment in hours per week
        proficiency_target: Target level ('beginner'|'intermediate'|'advanced')

    Returns:
        Dictionary with 'weeks' and 'total_hours' keys

    Raises:
        ValueError: If proficiency_target not in allowed values

    Note:
        Calculation assumes 80% retention rate and includes buffer time
        for skill integration exercises. Based on Bloom's taxonomy levels.
    """
    # Industry avg: 10 hours per skill level increment
    base_hours_per_skill = 10

    # Proficiency multipliers derived from educational research
    multipliers = {"beginner": 1.0, "intermediate": 2.5, "advanced": 5.0}

    total_hours = len(skills_gap) * base_hours_per_skill * multipliers[proficiency_target]
    weeks = math.ceil(total_hours / weekly_hours)

    return {"weeks": weeks, "total_hours": total_hours}
```

## TypeScript (TSDoc)

### Module Comment

```typescript
/**
 * Workflow state machine manager
 * @module workflow-manager
 */
```

### Function with Full Documentation

```typescript
/**
 * Validates workflow step completion criteria
 *
 * @param workflowId - Unique identifier for the workflow
 * @param stepName - Name of the step to validate
 * @returns Promise resolving to validation result with error details
 *
 * @remarks
 * Uses state machine validation to ensure prerequisite steps completed.
 * Prevents race conditions in concurrent workflow execution.
 *
 * @throws {WorkflowNotFoundError} If workflowId doesn't exist
 * @throws {InvalidStepError} If stepName not in workflow definition
 *
 * @example
 * ```ts
 * const result = await validateStepCompletion('wf-123', 'skills-assessment');
 * if (result.valid) {
 *   await proceedToNextStep(workflowId);
 * }
 * ```
 */
async function validateStepCompletion(
  workflowId: string,
  stepName: string
): Promise<ValidationResult> {
  // Implementation
}
```

### Interface Documentation

```typescript
/**
 * Configuration options for the workflow engine
 */
interface WorkflowConfig {
  /** Maximum number of concurrent workflows per user */
  maxConcurrent: number;

  /** Timeout in milliseconds for each step (default: 30000) */
  stepTimeout?: number;

  /** Enable detailed logging for debugging */
  debug?: boolean;
}
```

## JavaScript (JSDoc)

```javascript
/**
 * Validates workflow transition
 * @param {string} fromState - Current state
 * @param {string} toState - Proposed next state
 * @returns {boolean} True if transition is valid
 * @throws {InvalidTransitionError} If transition violates state machine rules
 */
function validateTransition(fromState, toState) {
  // Implementation
}

/**
 * User profile data
 * @typedef {Object} UserProfile
 * @property {string} id - Unique user identifier
 * @property {string} email - User email address
 * @property {string[]} skills - List of user skills
 * @property {Date} createdAt - Account creation timestamp
 */
```

## Java (Javadoc)

### Class Documentation

```java
/**
 * Repository for managing user skill data.
 *
 * <p>Provides CRUD operations with automatic caching and
 * invalidation based on update timestamps.</p>
 *
 * @author Skillia Team
 * @version 1.0
 * @since 2025-01-01
 */
public class SkillRepository {

    /**
     * Retrieves skills for specified user.
     *
     * @param userId Unique user identifier
     * @return List of skills, empty if user has none
     * @throws UserNotFoundException if userId doesn't exist
     * @throws DatabaseConnectionException if connection to DB fails
     */
    public List<Skill> getSkillsForUser(String userId) {
        // Implementation
    }

    /**
     * Updates user skills with new values.
     *
     * <p>This method performs an upsert operation - existing skills
     * are updated, new skills are inserted.</p>
     *
     * @param userId Unique user identifier
     * @param skills List of skills to update
     * @return Number of skills modified
     * @see #getSkillsForUser(String)
     */
    public int updateSkills(String userId, List<Skill> skills) {
        // Implementation
    }
}
```

## Go (Go Doc Comments)

```go
// Package skills provides utilities for managing and analyzing user skills.
//
// The package includes functions for skill categorization, gap analysis,
// and learning path generation based on user career objectives.
package skills

// SkillCategory represents a classification of professional skills.
type SkillCategory string

const (
    // HardSkill represents technical or measurable abilities.
    HardSkill SkillCategory = "hard"

    // SoftSkill represents interpersonal or behavioral abilities.
    SoftSkill SkillCategory = "soft"

    // AISkill represents artificial intelligence and ML abilities.
    AISkill SkillCategory = "ai"
)

// AnalyzeGap identifies missing skills needed for a target role.
//
// It compares the user's current skills against requirements for the
// target position and returns a prioritized list of skills to develop.
//
// Parameters:
//   - currentSkills: slice of user's current skill identifiers
//   - targetRole: identifier of the desired position
//
// Returns a GapAnalysis containing prioritized skill recommendations,
// or an error if the target role is not found in the database.
func AnalyzeGap(currentSkills []string, targetRole string) (*GapAnalysis, error) {
    // Implementation
}
```

## Rust (Doc Comments)

```rust
//! # Skills Assessment Module
//!
//! This module provides functionality for assessing and categorizing
//! user skills based on their professional background.
//!
//! ## Example
//!
//! ```rust
//! use skills::SkillAssessor;
//!
//! let assessor = SkillAssessor::new();
//! let result = assessor.assess("python", 3).unwrap();
//! println!("Skill level: {}", result.level);
//! ```

/// Represents a skill assessment result.
///
/// Contains the evaluated skill along with its proficiency level
/// and confidence score from the assessment process.
#[derive(Debug, Clone)]
pub struct AssessmentResult {
    /// The skill identifier that was assessed
    pub skill_id: String,

    /// Proficiency level from 1 (beginner) to 5 (expert)
    pub level: u8,

    /// Confidence score of the assessment (0.0 to 1.0)
    pub confidence: f64,
}

/// Assesses a user's proficiency in a specific skill.
///
/// # Arguments
///
/// * `skill_id` - The unique identifier of the skill to assess
/// * `years_experience` - Number of years of experience with the skill
///
/// # Returns
///
/// Returns `Ok(AssessmentResult)` on success, or an error if the
/// skill_id is not found in the skill database.
///
/// # Errors
///
/// This function will return an error if:
/// * The skill_id does not exist in the database
/// * The years_experience is negative
///
/// # Example
///
/// ```rust
/// let result = assess_skill("rust", 2)?;
/// assert!(result.level >= 1 && result.level <= 5);
/// ```
pub fn assess_skill(skill_id: &str, years_experience: i32) -> Result<AssessmentResult, SkillError> {
    // Implementation
}
```
