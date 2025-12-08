---
name: backend-patterns
description: Backend design patterns for FastAPI and Python applications. Use when building APIs, services, or data access layers. Triggers on Repository pattern, Service Layer, Dependency Injection, FastAPI structure, layered architecture, DDD, Domain-Driven Design, microservices, Unit of Work, testing patterns, API Gateway.
---

# Backend Design Patterns

Patterns for building clean, testable Python backend applications with FastAPI.

## Overview

**Core Patterns**:

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| **Repository** | Abstract data access | Multiple data sources, testing |
| **Service Layer** | Orchestrate business logic | Complex use cases |
| **Dependency Injection** | Manage dependencies | FastAPI apps |
| **Layered Architecture** | Separation of concerns | Most applications |
| **Unit of Work** | Transaction management | Multi-repository ops |

---

## Repository Pattern

**Purpose**: Abstraction layer over data storage - "pretend all data is in memory"

### Abstract Interface

```python
from abc import ABC, abstractmethod
from typing import List, Optional

class AbstractRepository(ABC):
    """Base repository defining data access contract"""

    @abstractmethod
    def add(self, entity):
        raise NotImplementedError

    @abstractmethod
    def get(self, id: str):
        raise NotImplementedError

    @abstractmethod
    def list(self) -> List:
        raise NotImplementedError

    @abstractmethod
    def update(self, entity):
        raise NotImplementedError

    @abstractmethod
    def delete(self, id: str):
        raise NotImplementedError
```

### SQLAlchemy Implementation

```python
from sqlalchemy.orm import Session

class SqlAlchemyRepository(AbstractRepository):
    def __init__(self, session: Session, model_class):
        self.session = session
        self.model_class = model_class

    def add(self, entity):
        self.session.add(entity)
        # Don't commit here - let caller control transaction

    def get(self, id: str):
        return self.session.query(self.model_class).filter_by(id=id).first()

    def list(self) -> List:
        return self.session.query(self.model_class).all()

    def update(self, entity):
        pass  # SQLAlchemy tracks changes automatically

    def delete(self, id: str):
        entity = self.get(id)
        if entity:
            self.session.delete(entity)
```

### Supabase Implementation

```python
from supabase import Client

class SupabaseRepository(AbstractRepository):
    def __init__(self, client: Client, table_name: str):
        self.client = client
        self.table = table_name

    def add(self, entity: dict) -> dict:
        response = self.client.table(self.table).insert(entity).execute()
        return response.data[0] if response.data else None

    def get(self, id: str) -> dict:
        response = self.client.table(self.table).select("*").eq("id", id).execute()
        return response.data[0] if response.data else None

    def list(self) -> List[dict]:
        response = self.client.table(self.table).select("*").execute()
        return response.data or []

    def update(self, id: str, updates: dict) -> dict:
        response = self.client.table(self.table).update(updates).eq("id", id).execute()
        return response.data[0] if response.data else None

    def delete(self, id: str) -> bool:
        response = self.client.table(self.table).delete().eq("id", id).execute()
        return len(response.data) > 0
```

### Fake Repository for Testing

```python
class FakeRepository(AbstractRepository):
    """In-memory repository for testing"""

    def __init__(self, initial_data: List = None):
        self._data = {item.id: item for item in (initial_data or [])}

    def add(self, entity):
        self._data[entity.id] = entity

    def get(self, id: str):
        return self._data.get(id)

    def list(self) -> List:
        return list(self._data.values())

    def update(self, entity):
        if entity.id in self._data:
            self._data[entity.id] = entity

    def delete(self, id: str):
        if id in self._data:
            del self._data[id]
```

**When to Use**:
- ✅ Multiple data sources (SQL, NoSQL, APIs)
- ✅ Need to test without database
- ✅ Domain logic complex enough to warrant isolation
- ❌ Simple CRUD application
- ❌ Single data source unlikely to change

---

## Service Layer Pattern

**Purpose**: Orchestration layer between API and domain model

### Basic Implementation

```python
from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class AssessmentResult:
    user_id: str
    assessed_skills: List[Dict[str, Any]]
    proficiency_scores: Dict[str, float]
    recommendations: List[str]


class SkillAssessmentService:
    """Service for assessing user skills"""

    def __init__(self, skill_repo: AbstractRepository, user_repo: AbstractRepository):
        self.skill_repo = skill_repo
        self.user_repo = user_repo

    def assess_user_skills(
        self,
        user_id: str,
        cv_data: Dict[str, Any]
    ) -> AssessmentResult:
        """
        Assess user skills from CV data

        Steps:
        1. Fetch user from repository
        2. Validate user exists
        3. Extract skills from CV
        4. Calculate proficiency scores
        5. Generate recommendations
        6. Persist assessment results
        """
        # 1. Fetch user
        user = self.user_repo.get(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        # 2. Extract skills (domain logic)
        extracted_skills = self._extract_skills_from_cv(cv_data)

        # 3. Calculate proficiency
        proficiency_scores = self._calculate_proficiency(extracted_skills)

        # 4. Generate recommendations
        recommendations = self._generate_recommendations(
            user_id, extracted_skills, proficiency_scores
        )

        # 5. Persist results
        assessment = {
            "user_id": user_id,
            "skills": extracted_skills,
            "proficiency": proficiency_scores
        }
        self.skill_repo.add(assessment)

        return AssessmentResult(
            user_id=user_id,
            assessed_skills=extracted_skills,
            proficiency_scores=proficiency_scores,
            recommendations=recommendations
        )
```

### Service Layer with Unit of Work

```python
class UnitOfWork:
    """Manages database transactions"""

    def __init__(self, session_factory):
        self.session_factory = session_factory

    def __enter__(self):
        self.session = self.session_factory()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.rollback()
        self.session.close()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()


# Usage with automatic transaction management
def create_plan_endpoint(user_id: str, data: dict):
    with UnitOfWork(session_factory) as uow:
        service = CareerPlanService()
        plan = service.generate_career_plan(
            user_id=user_id,
            target_role=data["target_role"],
            uow=uow
        )
        uow.commit()
        return plan
```

---

## Dependency Injection

### FastAPI Dependency Injection

```python
# api/dependencies.py
from fastapi import Depends
from supabase import Client
from config.database import get_supabase_client

def get_skill_repository(
    client: Client = Depends(get_supabase_client)
) -> SkillRepository:
    return SkillRepository(client)

def get_skill_service(
    repo: SkillRepository = Depends(get_skill_repository)
) -> SkillService:
    return SkillService(repo)


# Usage in routes
@router.get("/skills")
async def list_skills(
    service: SkillService = Depends(get_skill_service)
):
    return service.list_all_skills()
```

### Configuration

```python
# config/settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    openrouter_api_key: str

    class Config:
        env_file = ".env"

settings = Settings()


# config/database.py
from supabase import create_client, Client

_client = None

def get_supabase_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
    return _client
```

### Testing with Dependency Overrides

```python
# tests/test_skills.py
from fastapi.testclient import TestClient

fake_repo = FakeSkillRepository(initial_data=[
    {"id": "python", "name": "Python", "category": "technical"}
])

# Override dependency
app.dependency_overrides[get_skill_repository] = lambda: fake_repo

client = TestClient(app)
response = client.get("/skills/python")
assert response.status_code == 200
```

---

## Layered Architecture

### Three-Tier Architecture

```
┌────────────────────┐
│   Presentation     │  FastAPI routes, request/response
│   Layer (API)      │  validation, serialization
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│   Business Logic   │  Services, use cases,
│   Layer (Service)  │  business rules, orchestration
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│   Data Access      │  Repositories, database,
│   Layer (Repo)     │  external APIs
└────────────────────┘
```

### Layer Responsibilities

**Presentation Layer (API)**:
- HTTP handling (FastAPI routes)
- Request validation (Pydantic)
- Response serialization
- Authentication/Authorization
- **Should NOT**: Contain business logic, access database directly

**Business Logic Layer (Service)**:
- Use case orchestration
- Business rule validation
- Domain logic execution
- Transaction management
- **Should NOT**: Know about HTTP, access database directly

**Data Access Layer (Repository)**:
- Database operations (CRUD)
- Query optimization
- Data mapping
- **Should NOT**: Contain business logic, know about HTTP

---

## FastAPI Project Structure

```
src/
├── api/
│   ├── dependencies.py      # Dependency injection
│   └── routes/
│       ├── users.py         # User endpoints
│       ├── skills.py        # Skills endpoints
│       └── workflows.py     # Workflow endpoints
├── domain/
│   ├── models.py            # Domain entities
│   ├── exceptions.py        # Custom exceptions
│   └── value_objects.py     # Value objects
├── repositories/
│   ├── base.py              # Abstract repository
│   ├── user_repository.py
│   └── skill_repository.py
├── services/
│   ├── skill_service.py
│   └── career_service.py
├── schemas/
│   ├── user.py              # Pydantic models
│   └── skill.py
├── config/
│   ├── settings.py          # Environment config
│   └── database.py          # Database setup
└── main.py                  # FastAPI app entry
```

---

## Testing Patterns

### Test Pyramid

```
       ▲
      ╱ ╲       E2E Tests (Few)
     ╱   ╲      - Full system, HTTP → DB
    ╱     ╲
   ╱───────╲
  ╱         ╲   Integration Tests (Some)
 ╱           ╲  - Service + Repository with DB
╱─────────────╲
──────────────── Unit Tests (Many)
                - Service logic with mocks/fakes
```

### Unit Tests with Fake Repository

```python
def test_create_skill():
    # Arrange
    repo = FakeSkillRepository()
    service = SkillService(repo)
    skill_data = SkillCreate(name="Python", category="technical")

    # Act
    result = service.create_skill(skill_data)

    # Assert
    assert result.name == "Python"
    assert repo.count() == 1

def test_duplicate_skill_raises_error():
    repo = FakeSkillRepository(initial_data=[
        {"id": "1", "name": "Python", "category": "technical"}
    ])
    service = SkillService(repo)

    with pytest.raises(ValueError, match="Skill already exists"):
        service.create_skill(SkillCreate(name="Python", category="technical"))
```

---

## Quick Reference

| Need | Pattern |
|------|---------|
| Abstract data access | Repository |
| Business logic orchestration | Service Layer |
| Transaction management | Unit of Work |
| Dependency management | Dependency Injection |
| Clear separation | Layered Architecture |
| Complex domain | Domain-Driven Design |
| Independent services | Microservices |

---

## See Also

### In This Skill
- [ddd-patterns.md](references/ddd-patterns.md) - Domain-Driven Design patterns
- [microservices-patterns.md](references/microservices-patterns.md) - API Gateway, service independence
- [testing-patterns.md](references/testing-patterns.md) - Detailed testing strategies
- [anti-patterns.md](references/anti-patterns.md) - Common backend mistakes

### Related Skills
- **backend-resilience-patterns**: Circuit Breaker, Retry, Saga
- **gof-patterns**: Strategy for service selection, Factory for repositories
