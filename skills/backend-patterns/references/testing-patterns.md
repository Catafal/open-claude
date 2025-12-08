# Testing Patterns - Detailed Reference

Comprehensive testing strategies for backend applications.

---

## Test Pyramid

```
       ▲
      ╱ ╲       E2E Tests (Few)
     ╱   ╲      - Full system: HTTP → Service → DB
    ╱     ╲     - Slow, expensive, catch integration issues
   ╱───────╲
  ╱         ╲   Integration Tests (Some)
 ╱           ╲  - Service + Repository with real DB
╱─────────────╲ - Medium speed, verify component integration
────────────────
                Unit Tests (Many)
                - Service logic with mocks/fakes
                - Fast, isolated, test business logic
```

---

## Unit Tests

### Testing Service Layer with Fakes

```python
import pytest
from services.skill_service import SkillService
from schemas.skill import SkillCreate

class FakeSkillRepository:
    """In-memory repository for testing"""

    def __init__(self, initial_data=None):
        self._data = {item["id"]: item for item in (initial_data or [])}
        self._next_id = len(self._data) + 1

    def add(self, entity):
        entity["id"] = str(self._next_id)
        self._data[entity["id"]] = entity
        self._next_id += 1
        return entity

    def get(self, id: str):
        return self._data.get(id)

    def find_by_name(self, name: str):
        for item in self._data.values():
            if item["name"] == name:
                return item
        return None

    def count(self):
        return len(self._data)


class TestSkillService:
    """Unit tests for SkillService"""

    def test_create_skill_success(self):
        # Arrange
        repo = FakeSkillRepository()
        service = SkillService(repo)
        skill_data = SkillCreate(name="Python", category="technical")

        # Act
        result = service.create_skill(skill_data)

        # Assert
        assert result["name"] == "Python"
        assert result["category"] == "technical"
        assert repo.count() == 1

    def test_create_duplicate_skill_raises_error(self):
        # Arrange
        repo = FakeSkillRepository(initial_data=[
            {"id": "1", "name": "Python", "category": "technical"}
        ])
        service = SkillService(repo)
        skill_data = SkillCreate(name="Python", category="technical")

        # Act & Assert
        with pytest.raises(ValueError, match="Skill already exists"):
            service.create_skill(skill_data)

    def test_get_nonexistent_skill_returns_none(self):
        # Arrange
        repo = FakeSkillRepository()
        service = SkillService(repo)

        # Act
        result = service.get_skill("nonexistent")

        # Assert
        assert result is None
```

---

### Testing with Mocks

```python
from unittest.mock import Mock, patch, AsyncMock
import pytest

class TestCareerService:
    """Unit tests using mocks for external dependencies"""

    def test_generate_plan_calls_skill_service(self):
        # Arrange
        mock_skill_client = Mock()
        mock_skill_client.get_user_skills.return_value = [
            {"name": "Python", "proficiency": 80}
        ]

        mock_repo = Mock()
        mock_repo.get_role_requirements.return_value = [
            {"name": "Python", "required_level": 70},
            {"name": "SQL", "required_level": 60}
        ]

        service = CareerService(
            skill_client=mock_skill_client,
            repo=mock_repo
        )

        # Act
        plan = service.generate_plan("user123", "Data Analyst")

        # Assert
        mock_skill_client.get_user_skills.assert_called_once_with("user123")
        mock_repo.get_role_requirements.assert_called_once_with("Data Analyst")
        assert "SQL" in [gap["name"] for gap in plan["gaps"]]

    @pytest.mark.asyncio
    async def test_async_service_call(self):
        # Arrange
        mock_client = AsyncMock()
        mock_client.fetch_courses.return_value = [
            {"title": "Python Basics", "duration": 10}
        ]

        service = LearningService(client=mock_client)

        # Act
        courses = await service.find_courses("Python")

        # Assert
        mock_client.fetch_courses.assert_awaited_once()
        assert len(courses) == 1


class TestWithPatching:
    """Tests using patch for external calls"""

    @patch("services.career_service.SkillsServiceClient")
    def test_with_patched_client(self, MockClient):
        # Configure mock
        mock_instance = MockClient.return_value
        mock_instance.get_user_skills.return_value = []

        service = CareerService()
        plan = service.generate_plan("user123", "Developer")

        mock_instance.get_user_skills.assert_called_once()
```

---

## Integration Tests

### Testing with Real Database

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from repositories.skill_repository import SkillRepository
from services.skill_service import SkillService

@pytest.fixture
def test_db():
    """Create test database for integration tests"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()


@pytest.fixture
def skill_repo(test_db):
    """Provide repository with test database"""
    return SkillRepository(test_db)


class TestSkillServiceIntegration:
    """Integration tests with real database"""

    def test_full_skill_lifecycle(self, skill_repo, test_db):
        # Arrange
        service = SkillService(skill_repo)

        # Act - Create
        skill = service.create_skill(
            SkillCreate(name="Python", category="technical")
        )
        test_db.commit()

        # Assert - Read
        retrieved = service.get_skill(skill["id"])
        assert retrieved["name"] == "Python"

        # Act - Update
        service.update_skill(skill["id"], {"proficiency": 80})
        test_db.commit()

        # Assert - Updated
        updated = service.get_skill(skill["id"])
        assert updated["proficiency"] == 80

        # Act - Delete
        service.delete_skill(skill["id"])
        test_db.commit()

        # Assert - Deleted
        assert service.get_skill(skill["id"]) is None

    def test_skill_search_with_filters(self, skill_repo, test_db):
        # Arrange
        service = SkillService(skill_repo)
        service.create_skill(SkillCreate(name="Python", category="technical"))
        service.create_skill(SkillCreate(name="SQL", category="technical"))
        service.create_skill(SkillCreate(name="Communication", category="soft"))
        test_db.commit()

        # Act
        technical_skills = service.get_skills_by_category("technical")
        soft_skills = service.get_skills_by_category("soft")

        # Assert
        assert len(technical_skills) == 2
        assert len(soft_skills) == 1
```

---

### Testing with Supabase

```python
import pytest
from supabase import create_client

@pytest.fixture
def supabase_client():
    """Create Supabase client for integration tests"""
    client = create_client(
        supabase_url="http://localhost:54321",  # Local Supabase
        supabase_key="test-key"
    )
    yield client

    # Cleanup after tests
    client.table("skills").delete().neq("id", "").execute()


class TestSupabaseIntegration:
    """Integration tests with Supabase"""

    def test_skill_crud_operations(self, supabase_client):
        repo = SkillSupabaseRepository(supabase_client)

        # Create
        skill = repo.add({
            "name": "Python",
            "category": "technical"
        })
        assert skill["id"] is not None

        # Read
        retrieved = repo.get(skill["id"])
        assert retrieved["name"] == "Python"

        # Update
        updated = repo.update(skill["id"], {"proficiency": 80})
        assert updated["proficiency"] == 80

        # Delete
        result = repo.delete(skill["id"])
        assert result is True
        assert repo.get(skill["id"]) is None
```

---

## E2E Tests

### Testing Full API Endpoints

```python
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    """Create test client for E2E tests"""
    return TestClient(app)


class TestUserJourneyE2E:
    """End-to-end tests for complete user journeys"""

    def test_complete_skill_assessment_journey(self, client):
        # 1. Create user
        response = client.post("/api/v1/users", json={
            "email": "test@example.com",
            "name": "Test User"
        })
        assert response.status_code == 201
        user_id = response.json()["id"]

        # 2. Upload CV
        with open("tests/fixtures/sample_cv.pdf", "rb") as f:
            response = client.post(
                f"/api/v1/users/{user_id}/cv",
                files={"file": ("cv.pdf", f, "application/pdf")}
            )
        assert response.status_code == 200

        # 3. Get skill assessment
        response = client.get(f"/api/v1/users/{user_id}/skills")
        assert response.status_code == 200
        skills = response.json()["skills"]
        assert len(skills) > 0

        # 4. Generate career plan
        response = client.post(
            f"/api/v1/users/{user_id}/career-plan",
            json={
                "target_role": "Data Scientist",
                "time_horizon": "6 months"
            }
        )
        assert response.status_code == 200
        plan = response.json()
        assert "learning_path" in plan
        assert "skill_gaps" in plan

    def test_api_error_handling(self, client):
        # Test 404 for nonexistent resource
        response = client.get("/api/v1/users/nonexistent/skills")
        assert response.status_code == 404

        # Test 400 for invalid input
        response = client.post("/api/v1/users", json={
            "email": "invalid-email"
        })
        assert response.status_code == 422
```

---

## Test Fixtures and Factories

```python
import pytest
from faker import Faker
from dataclasses import dataclass, field
from typing import List

fake = Faker()

@dataclass
class SkillFactory:
    """Factory for creating test skills"""

    @staticmethod
    def create(**kwargs):
        defaults = {
            "name": fake.word(),
            "category": fake.random_element(["technical", "soft", "domain"]),
            "proficiency": fake.random_int(min=0, max=100)
        }
        defaults.update(kwargs)
        return defaults

    @staticmethod
    def create_batch(count: int, **kwargs) -> List[dict]:
        return [SkillFactory.create(**kwargs) for _ in range(count)]


@dataclass
class UserFactory:
    """Factory for creating test users"""

    @staticmethod
    def create(**kwargs):
        defaults = {
            "email": fake.email(),
            "name": fake.name(),
            "created_at": fake.date_time_this_year()
        }
        defaults.update(kwargs)
        return defaults


# Usage in tests
class TestWithFactories:

    def test_bulk_skill_operations(self):
        repo = FakeSkillRepository()
        service = SkillService(repo)

        # Create 10 technical skills
        skills = SkillFactory.create_batch(10, category="technical")

        for skill in skills:
            service.create_skill(SkillCreate(**skill))

        # Assert
        assert repo.count() == 10
```

---

## Async Testing

```python
import pytest
import asyncio

@pytest.fixture
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


class TestAsyncServices:
    """Tests for async service methods"""

    @pytest.mark.asyncio
    async def test_parallel_skill_assessment(self):
        # Arrange
        service = AsyncSkillService()
        users = ["user1", "user2", "user3"]

        # Act - Run assessments in parallel
        results = await asyncio.gather(*[
            service.assess_skills(user_id)
            for user_id in users
        ])

        # Assert
        assert len(results) == 3
        assert all(r["status"] == "completed" for r in results)

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        # Arrange
        service = AsyncSkillService(timeout=0.1)

        # Act & Assert
        with pytest.raises(asyncio.TimeoutError):
            await service.long_running_operation()
```

---

## Pattern Selection Guide

| Test Type | Purpose | Speed | When to Use |
|-----------|---------|-------|-------------|
| **Unit** | Test business logic | Fast | All service methods |
| **Integration** | Test component interaction | Medium | Repository + Service |
| **E2E** | Test full system | Slow | Critical user journeys |
| **Async** | Test concurrent operations | Varies | Async code paths |

---

## Best Practices

1. **Arrange-Act-Assert**: Structure all tests clearly
2. **One assertion per concept**: Focus each test
3. **Use factories**: Generate test data consistently
4. **Isolate tests**: No dependencies between tests
5. **Fast feedback**: Unit tests should run in milliseconds
6. **Real dependencies for integration**: Use actual DB when testing persistence
