# Domain-Driven Design Patterns - Detailed Reference

DDD tactical patterns for complex domain modeling.

---

## Core Concepts

### Entities

**Definition**: Objects with unique identity that persists over time

```python
from dataclasses import dataclass
from uuid import uuid4

@dataclass
class Skill:
    """Entity: Skill with unique identity"""
    id: str
    name: str
    category: str
    description: str

    @classmethod
    def create(cls, name: str, category: str, description: str):
        """Factory method for creating new skills"""
        return cls(
            id=str(uuid4()),
            name=name,
            category=category,
            description=description
        )

    def update_description(self, new_description: str):
        """Domain behavior on entity"""
        if not new_description.strip():
            raise ValueError("Description cannot be empty")
        self.description = new_description
```

---

### Value Objects

**Definition**: Objects defined by their attributes, immutable

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class ProficiencyLevel:
    """Value Object: Proficiency level"""
    level: str  # "beginner", "intermediate", "advanced", "expert"
    score: int  # 0-100

    def __post_init__(self):
        if self.score < 0 or self.score > 100:
            raise ValueError("Score must be 0-100")

        valid_levels = ["beginner", "intermediate", "advanced", "expert"]
        if self.level not in valid_levels:
            raise ValueError(f"Level must be one of: {valid_levels}")

    def is_expert(self) -> bool:
        return self.level == "expert"

    def can_teach(self) -> bool:
        return self.score >= 80


@dataclass(frozen=True)
class TimeHorizon:
    """Value Object: Learning time horizon"""
    months: int

    def __post_init__(self):
        if self.months < 1 or self.months > 60:
            raise ValueError("Time horizon must be 1-60 months")

    @classmethod
    def short_term(cls):
        return cls(months=3)

    @classmethod
    def medium_term(cls):
        return cls(months=6)

    @classmethod
    def long_term(cls):
        return cls(months=12)

    def label(self) -> str:
        if self.months <= 3:
            return "short-term"
        elif self.months <= 6:
            return "medium-term"
        else:
            return "long-term"
```

---

### Aggregates

**Definition**: Cluster of entities treated as a unit with a root entity

```python
from typing import List
from uuid import uuid4

class CareerPlan:
    """Aggregate root: Career plan containing skill gaps"""

    def __init__(self, user_id: str, target_role: str):
        self.id = str(uuid4())
        self.user_id = user_id
        self.target_role = target_role
        self._skill_gaps: List[SkillGap] = []
        self._learning_modules: List[LearningModule] = []

    def add_skill_gap(self, skill: Skill, required_level: ProficiencyLevel):
        """Add skill gap to plan - business rule enforcement"""
        # Check for duplicates
        if any(gap.skill.id == skill.id for gap in self._skill_gaps):
            raise ValueError(f"Skill {skill.name} already in plan")

        gap = SkillGap(skill, required_level)
        self._skill_gaps.append(gap)

    def get_skill_gaps(self) -> List:
        """Return copy to protect internal state"""
        return self._skill_gaps.copy()

    def is_complete(self) -> bool:
        """Check if all gaps have been addressed"""
        return all(gap.is_closed for gap in self._skill_gaps)

    def calculate_estimated_hours(self) -> int:
        """Domain logic: estimate total learning hours"""
        return sum(
            module.estimated_hours
            for module in self._learning_modules
        )


class SkillGap:
    """Entity within aggregate: specific skill gap"""

    def __init__(self, skill: Skill, required_level: ProficiencyLevel):
        self.id = str(uuid4())
        self.skill = skill
        self.required_level = required_level
        self.current_level: ProficiencyLevel = None
        self.is_closed = False

    def update_progress(self, new_level: ProficiencyLevel):
        """Update current level and check if gap is closed"""
        self.current_level = new_level
        if new_level.score >= self.required_level.score:
            self.is_closed = True
```

---

### Domain Services

**Definition**: Operations that don't belong to a specific entity

```python
class SkillMatchingService:
    """Domain service: matching skills to job requirements"""

    def calculate_match_score(
        self,
        user_skills: List[Skill],
        job_requirements: List[Skill]
    ) -> float:
        """Calculate how well user skills match job requirements"""
        if not job_requirements:
            return 0.0

        matched = sum(
            1 for req in job_requirements
            if any(s.name.lower() == req.name.lower() for s in user_skills)
        )
        return matched / len(job_requirements)

    def identify_gaps(
        self,
        user_skills: List[Skill],
        job_requirements: List[Skill]
    ) -> List[Skill]:
        """Identify missing skills for job"""
        user_skill_names = {s.name.lower() for s in user_skills}
        return [
            req for req in job_requirements
            if req.name.lower() not in user_skill_names
        ]
```

---

## Bounded Contexts

### Context Map for Skillia

```
┌─────────────────────┐     ┌─────────────────────┐
│  Skills Assessment  │────▶│   Career Planning   │
│      Context        │     │      Context        │
│                     │     │                     │
│  • CV Parsing       │     │  • Gap Analysis     │
│  • Skill Extraction │     │  • Path Generation  │
│  • Proficiency Eval │     │  • Timeline         │
└─────────────────────┘     └─────────────────────┘
          │                           │
          │                           │
          ▼                           ▼
┌─────────────────────────────────────────────────┐
│             Learning Management Context          │
│                                                  │
│  • Course Recommendations  • Progress Tracking   │
│  • Resource Matching       • Achievement Awards  │
└─────────────────────────────────────────────────┘
```

### Context Integration

```python
# Anti-Corruption Layer between contexts
class CareerPlanningAdapter:
    """Translate between Skills Assessment and Career Planning contexts"""

    def __init__(self, skills_service: SkillsAssessmentService):
        self.skills_service = skills_service

    def get_user_skill_profile(self, user_id: str) -> SkillProfile:
        """Convert assessment result to career planning domain model"""
        assessment = self.skills_service.get_assessment(user_id)

        # Translate to career planning's model
        return SkillProfile(
            user_id=user_id,
            skills=[
                CareerSkill(
                    name=s["skill_name"],
                    level=self._map_proficiency(s["proficiency"]),
                    years=s.get("years_experience", 0)
                )
                for s in assessment["skills"]
            ]
        )

    def _map_proficiency(self, assessment_level: str) -> ProficiencyLevel:
        """Map assessment context levels to career planning levels"""
        mapping = {
            "novice": ProficiencyLevel("beginner", 20),
            "competent": ProficiencyLevel("intermediate", 50),
            "proficient": ProficiencyLevel("advanced", 75),
            "expert": ProficiencyLevel("expert", 95)
        }
        return mapping.get(assessment_level, ProficiencyLevel("beginner", 0))
```

---

## Domain Events

```python
from dataclasses import dataclass
from datetime import datetime
from typing import List

@dataclass
class DomainEvent:
    """Base class for domain events"""
    occurred_at: datetime
    aggregate_id: str


@dataclass
class SkillGapIdentified(DomainEvent):
    """Event: skill gap was identified for user"""
    user_id: str
    skill_name: str
    required_level: str
    current_level: str


@dataclass
class CareerPlanCreated(DomainEvent):
    """Event: career plan was created"""
    plan_id: str
    user_id: str
    target_role: str
    skill_gaps: List[str]


class EventPublisher:
    """Simple event publisher"""

    def __init__(self):
        self._handlers = {}

    def subscribe(self, event_type: type, handler: callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    def publish(self, event: DomainEvent):
        handlers = self._handlers.get(type(event), [])
        for handler in handlers:
            handler(event)


# Usage
publisher = EventPublisher()
publisher.subscribe(
    SkillGapIdentified,
    lambda e: send_notification(e.user_id, f"Gap found: {e.skill_name}")
)
```

---

## Repositories in DDD

```python
from abc import ABC, abstractmethod
from typing import Optional

class CareerPlanRepository(ABC):
    """Repository for CareerPlan aggregate"""

    @abstractmethod
    def save(self, plan: CareerPlan) -> None:
        """Persist entire aggregate"""
        pass

    @abstractmethod
    def get(self, plan_id: str) -> Optional[CareerPlan]:
        """Retrieve aggregate by ID"""
        pass

    @abstractmethod
    def find_by_user(self, user_id: str) -> List[CareerPlan]:
        """Find all plans for user"""
        pass


class SupabaseCareerPlanRepository(CareerPlanRepository):
    """Supabase implementation"""

    def __init__(self, client):
        self.client = client

    def save(self, plan: CareerPlan) -> None:
        """Save aggregate with all child entities"""
        # Save root
        plan_data = {
            "id": plan.id,
            "user_id": plan.user_id,
            "target_role": plan.target_role
        }
        self.client.table("career_plans").upsert(plan_data).execute()

        # Save child entities
        for gap in plan._skill_gaps:
            gap_data = {
                "id": gap.id,
                "plan_id": plan.id,
                "skill_id": gap.skill.id,
                "required_level": gap.required_level.level,
                "is_closed": gap.is_closed
            }
            self.client.table("skill_gaps").upsert(gap_data).execute()

    def get(self, plan_id: str) -> Optional[CareerPlan]:
        """Reconstruct aggregate from storage"""
        result = self.client.table("career_plans").select("*").eq(
            "id", plan_id
        ).execute()

        if not result.data:
            return None

        data = result.data[0]
        plan = CareerPlan(data["user_id"], data["target_role"])
        plan.id = data["id"]

        # Load child entities
        gaps_result = self.client.table("skill_gaps").select("*").eq(
            "plan_id", plan_id
        ).execute()

        for gap_data in gaps_result.data:
            # Reconstruct SkillGap entities
            pass

        return plan
```

---

## Pattern Selection Guide

| Need | Pattern |
|------|---------|
| Object with identity | Entity |
| Immutable attribute group | Value Object |
| Cluster of related entities | Aggregate |
| Cross-entity operations | Domain Service |
| Module boundaries | Bounded Context |
| State change notifications | Domain Events |
| Data access for aggregates | Repository |
