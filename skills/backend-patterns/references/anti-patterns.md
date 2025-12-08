# Backend Anti-Patterns

Common mistakes when building backend applications.

---

## Anemic Domain Model

**Description**: Domain objects with no behavior, just data holders

**Symptoms**:
- All logic in services, domain objects are just data classes
- Services grow to hundreds of methods
- Duplication of business rules across services

```python
# ANTI-PATTERN - Anemic domain model
@dataclass
class Skill:
    id: str
    name: str
    proficiency: int
    # No behavior, just data

class SkillService:
    def update_proficiency(self, skill: Skill, hours_practiced: int):
        # All logic in service
        if hours_practiced > 10:
            skill.proficiency += 5
        elif hours_practiced > 5:
            skill.proficiency += 2
        # ... more rules

# CORRECT - Rich domain model
@dataclass
class Skill:
    id: str
    name: str
    proficiency: int

    def practice(self, hours: int):
        """Domain behavior on entity"""
        if hours > 10:
            self.proficiency = min(100, self.proficiency + 5)
        elif hours > 5:
            self.proficiency = min(100, self.proficiency + 2)

    def is_proficient(self) -> bool:
        return self.proficiency >= 70
```

---

## Fat Controller

**Description**: API routes contain business logic

**Problems**:
- Hard to test
- Logic duplication
- No reusability

```python
# ANTI-PATTERN - Fat controller
@router.post("/users/{user_id}/skills")
async def create_skill(user_id: str, skill: SkillCreate, db = Depends(get_db)):
    # Business logic in controller!
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404)

    existing = db.query(Skill).filter(Skill.name == skill.name).first()
    if existing:
        raise HTTPException(400, "Skill exists")

    new_skill = Skill(**skill.dict(), user_id=user_id)
    db.add(new_skill)
    db.commit()
    return new_skill

# CORRECT - Thin controller with service
@router.post("/users/{user_id}/skills")
async def create_skill(
    user_id: str,
    skill: SkillCreate,
    service: SkillService = Depends(get_skill_service)
):
    return service.create_skill(user_id, skill)
```

---

## Service Locator

**Description**: Services look up dependencies globally instead of injection

**Problems**:
- Hidden dependencies
- Hard to test
- Tight coupling

```python
# ANTI-PATTERN - Service locator
class CareerService:
    def generate_plan(self, user_id: str):
        # Hidden dependency - hard to test!
        skill_repo = ServiceLocator.get("SkillRepository")
        user_repo = ServiceLocator.get("UserRepository")
        # ...

# CORRECT - Dependency injection
class CareerService:
    def __init__(self, skill_repo: SkillRepository, user_repo: UserRepository):
        self.skill_repo = skill_repo
        self.user_repo = user_repo

    def generate_plan(self, user_id: str):
        # Clear dependencies, easy to test
        user = self.user_repo.get(user_id)
        skills = self.skill_repo.find_by_user(user_id)
        # ...
```

---

## Transaction Script Anti-Pattern

**Description**: Each operation is a script with no structure

```python
# ANTI-PATTERN - Transaction script
def assess_skills_and_create_plan(user_id: str, cv_data: dict, target_role: str):
    # Everything in one function!
    db = get_database()

    # Parse CV
    skills = []
    for section in cv_data["sections"]:
        if "skill" in section:
            skills.append(extract_skill(section))

    # Save skills
    for skill in skills:
        db.execute("INSERT INTO skills ...")

    # Get requirements
    requirements = db.execute("SELECT * FROM requirements WHERE role = ?", target_role)

    # Calculate gaps
    gaps = []
    for req in requirements:
        if req not in skills:
            gaps.append(req)

    # Create plan
    db.execute("INSERT INTO plans ...")

    return {"skills": skills, "gaps": gaps}

# CORRECT - Layered architecture
class WorkflowService:
    def __init__(self, skill_service, career_service):
        self.skill_service = skill_service
        self.career_service = career_service

    def assess_and_plan(self, user_id: str, cv_data: dict, target_role: str):
        skills = self.skill_service.assess_from_cv(user_id, cv_data)
        plan = self.career_service.create_plan(user_id, target_role)
        return {"skills": skills, "plan": plan}
```

---

## Repository Leak

**Description**: Returning ORM objects directly from repositories

**Problems**:
- Tight coupling to ORM
- Lazy loading issues
- Hard to change storage

```python
# ANTI-PATTERN - Leaking ORM objects
class SkillRepository:
    def get(self, id: str) -> SkillModel:  # Returns ORM model!
        return self.session.query(SkillModel).filter_by(id=id).first()

# In service - coupled to SQLAlchemy
skill = repo.get("123")
print(skill.user.name)  # Lazy load - may fail outside session!

# CORRECT - Return domain objects or dicts
class SkillRepository:
    def get(self, id: str) -> Optional[Skill]:
        model = self.session.query(SkillModel).filter_by(id=id).first()
        if not model:
            return None
        return Skill(
            id=model.id,
            name=model.name,
            category=model.category
        )
```

---

## Shared Database

**Description**: Multiple services access the same database tables directly

**Problems**:
- Coupling between services
- Hard to change schema
- Data consistency issues

```python
# ANTI-PATTERN - Shared database access
class SkillsService:
    def get_skills(self, user_id):
        return db.query("SELECT * FROM skills WHERE user_id = ?", user_id)

class CareerService:
    def get_user_skills(self, user_id):
        # Another service directly accessing skills table!
        return db.query("SELECT * FROM skills WHERE user_id = ?", user_id)

# CORRECT - Service owns its data
class CareerService:
    def __init__(self, skills_client: SkillsServiceClient):
        self.skills_client = skills_client

    def get_user_skills(self, user_id):
        # Call skills service via API
        return self.skills_client.get_user_skills(user_id)
```

---

## Missing Timeouts

**Description**: External calls without timeout configuration

**Problems**:
- Thread/connection exhaustion
- Cascading failures
- Poor user experience

```python
# ANTI-PATTERN - No timeout
class SkillsClient:
    def get_skills(self, user_id):
        return requests.get(f"{self.url}/skills/{user_id}")  # May hang forever!

# CORRECT - With timeout
class SkillsClient:
    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    def get_skills(self, user_id):
        try:
            response = requests.get(
                f"{self.url}/skills/{user_id}",
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.Timeout:
            logger.warning(f"Skills service timeout for user {user_id}")
            return self._get_cached_skills(user_id)
```

---

## N+1 Query Problem

**Description**: Executing one query per item instead of batch query

```python
# ANTI-PATTERN - N+1 queries
def get_user_skills_with_courses(user_id: str):
    skills = db.query("SELECT * FROM skills WHERE user_id = ?", user_id)
    for skill in skills:
        # One query per skill!
        skill.courses = db.query(
            "SELECT * FROM courses WHERE skill_id = ?", skill.id
        )
    return skills

# CORRECT - Eager loading or batch query
def get_user_skills_with_courses(user_id: str):
    # Option 1: JOIN query
    return db.query("""
        SELECT s.*, c.*
        FROM skills s
        LEFT JOIN courses c ON c.skill_id = s.id
        WHERE s.user_id = ?
    """, user_id)

    # Option 2: Batch query
    skills = db.query("SELECT * FROM skills WHERE user_id = ?", user_id)
    skill_ids = [s.id for s in skills]
    courses = db.query(
        "SELECT * FROM courses WHERE skill_id IN (?)",
        skill_ids
    )
    # Map courses to skills
```

---

## Detection Checklist

| Smell | Likely Problem |
|-------|----------------|
| Domain objects with only getters/setters | Anemic Domain Model |
| Routes > 30 lines with business logic | Fat Controller |
| `ServiceLocator.get()` calls | Service Locator |
| Single function > 100 lines | Transaction Script |
| Returning ORM models from repository | Repository Leak |
| Multiple services querying same table | Shared Database |
| HTTP calls without timeout | Missing Timeouts |
| Loop with DB query inside | N+1 Query Problem |

---

## Quick Detection Rules

- **Anemic Domain**: Search for `dataclass` with no methods
- **Fat Controller**: Routes with `db.query()` calls
- **Missing Timeout**: `requests.get(` without `timeout=`
- **N+1 Query**: Loop containing `.query()` call
- **Shared DB**: Same table name in multiple service files
