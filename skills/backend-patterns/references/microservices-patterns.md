# Microservices Patterns - Detailed Reference

Patterns for building and coordinating microservices.

---

## API Gateway Pattern

**Purpose**: Single entry point that aggregates multiple microservices

```python
import asyncio
from typing import Dict, Any

class APIGateway:
    """Gateway aggregating multiple microservices"""

    def __init__(self):
        self.skills_service = SkillsServiceClient()
        self.career_service = CareerServiceClient()
        self.learning_service = LearningServiceClient()

    async def get_user_dashboard(self, user_id: str) -> Dict[str, Any]:
        """Aggregate data from multiple services in parallel"""
        skills, career_plan, courses = await asyncio.gather(
            self.skills_service.get_user_skills(user_id),
            self.career_service.get_career_plan(user_id),
            self.learning_service.get_enrolled_courses(user_id)
        )

        return {
            "user_id": user_id,
            "skills": skills,
            "career_plan": career_plan,
            "enrolled_courses": courses,
            "summary": self._generate_summary(skills, career_plan)
        }

    def _generate_summary(self, skills, career_plan) -> Dict[str, Any]:
        """Aggregate business logic at gateway level"""
        return {
            "total_skills": len(skills),
            "gaps_remaining": len(career_plan.get("gaps", [])),
            "completion_percentage": career_plan.get("progress", 0)
        }
```

---

## Service Independence

**Principle**: Each microservice has its own database and communicates via APIs

```python
# Skills Service (independent)
class SkillsService:
    """Self-contained skills microservice"""

    def __init__(self):
        self.db = get_skills_database()  # Own database

    def assess_skills(self, cv_data: dict) -> dict:
        """Skills assessment logic only"""
        extracted = self._extract_skills(cv_data)
        scores = self._calculate_proficiency(extracted)

        # Store in own database
        self.db.save_assessment(extracted, scores)

        return {"skills": extracted, "scores": scores}

    def get_user_skills(self, user_id: str) -> list:
        """Retrieve user's assessed skills"""
        return self.db.get_skills_by_user(user_id)


# Career Service (independent, calls Skills via API)
class CareerService:
    """Self-contained career planning microservice"""

    def __init__(self):
        self.db = get_career_database()  # Own database
        self.skills_client = SkillsServiceClient()  # API client

    def generate_plan(self, user_id: str, target_role: str) -> dict:
        """Career planning logic"""
        # Call skills service via API (not direct DB access)
        skills = self.skills_client.get_user_skills(user_id)

        # Career planning logic with own data
        requirements = self.db.get_role_requirements(target_role)
        gaps = self._identify_gaps(skills, requirements)
        plan = self._create_learning_path(gaps)

        self.db.save_plan(user_id, plan)
        return plan
```

---

## Service Client Pattern

```python
import httpx
from typing import Dict, Any, Optional

class ServiceClient:
    """Base client for calling other microservices"""

    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url
        self.timeout = timeout

    async def get(self, path: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}{path}")
            response.raise_for_status()
            return response.json()

    async def post(self, path: str, data: dict) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}{path}", json=data)
            response.raise_for_status()
            return response.json()


class SkillsServiceClient(ServiceClient):
    """Client for Skills microservice"""

    def __init__(self):
        super().__init__(base_url="http://skills-service:8001")

    async def get_user_skills(self, user_id: str) -> list:
        return await self.get(f"/users/{user_id}/skills")

    async def assess_cv(self, user_id: str, cv_data: dict) -> dict:
        return await self.post(f"/users/{user_id}/assess", cv_data)


class CareerServiceClient(ServiceClient):
    """Client for Career microservice"""

    def __init__(self):
        super().__init__(base_url="http://career-service:8002")

    async def get_career_plan(self, user_id: str) -> dict:
        return await self.get(f"/users/{user_id}/career-plan")

    async def create_plan(self, user_id: str, config: dict) -> dict:
        return await self.post(f"/users/{user_id}/career-plan", config)
```

---

## Event-Driven Communication

```python
import json
from abc import ABC, abstractmethod
from typing import Callable, Dict, Any

class MessageBroker(ABC):
    """Abstract message broker interface"""

    @abstractmethod
    def publish(self, topic: str, message: dict) -> None:
        pass

    @abstractmethod
    def subscribe(self, topic: str, handler: Callable) -> None:
        pass


class RedisMessageBroker(MessageBroker):
    """Redis-based message broker"""

    def __init__(self, redis_client):
        self.redis = redis_client

    def publish(self, topic: str, message: dict) -> None:
        self.redis.publish(topic, json.dumps(message))

    def subscribe(self, topic: str, handler: Callable) -> None:
        pubsub = self.redis.pubsub()
        pubsub.subscribe(topic)

        for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                handler(data)


# Event publishing
class SkillsService:
    def __init__(self, broker: MessageBroker):
        self.broker = broker

    def assess_skills(self, user_id: str, cv_data: dict):
        result = self._perform_assessment(cv_data)

        # Publish event for other services
        self.broker.publish("skills.assessed", {
            "user_id": user_id,
            "skills": result["skills"],
            "timestamp": datetime.now().isoformat()
        })

        return result


# Event consumption
class CareerService:
    def __init__(self, broker: MessageBroker):
        self.broker = broker
        # Subscribe to skills events
        self.broker.subscribe("skills.assessed", self._on_skills_assessed)

    def _on_skills_assessed(self, event: dict):
        """React to skills assessment completion"""
        user_id = event["user_id"]
        skills = event["skills"]

        # Automatically update career recommendations
        self._refresh_recommendations(user_id, skills)
```

---

## Service Discovery

```python
from typing import Dict, Optional
import random

class ServiceRegistry:
    """Simple service registry for service discovery"""

    def __init__(self):
        self._services: Dict[str, list] = {}

    def register(self, service_name: str, instance_url: str):
        """Register service instance"""
        if service_name not in self._services:
            self._services[service_name] = []
        self._services[service_name].append(instance_url)

    def deregister(self, service_name: str, instance_url: str):
        """Remove service instance"""
        if service_name in self._services:
            self._services[service_name].remove(instance_url)

    def get_instance(self, service_name: str) -> Optional[str]:
        """Get random instance (simple load balancing)"""
        instances = self._services.get(service_name, [])
        if not instances:
            return None
        return random.choice(instances)


class DiscoveryClient:
    """Client that uses service discovery"""

    def __init__(self, registry: ServiceRegistry):
        self.registry = registry

    async def call_service(self, service_name: str, path: str) -> dict:
        instance = self.registry.get_instance(service_name)
        if not instance:
            raise ServiceNotFoundError(f"No instances for {service_name}")

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{instance}{path}")
            return response.json()
```

---

## Health Checks

```python
from fastapi import FastAPI
from typing import Dict, Any

app = FastAPI()

class HealthChecker:
    """Check service dependencies health"""

    def __init__(self):
        self.checks = {}

    def add_check(self, name: str, check_func):
        self.checks[name] = check_func

    async def run_checks(self) -> Dict[str, Any]:
        results = {}
        all_healthy = True

        for name, check in self.checks.items():
            try:
                await check()
                results[name] = {"status": "healthy"}
            except Exception as e:
                results[name] = {"status": "unhealthy", "error": str(e)}
                all_healthy = False

        return {
            "status": "healthy" if all_healthy else "unhealthy",
            "checks": results
        }


health_checker = HealthChecker()

# Add dependency checks
async def check_database():
    # Verify database connection
    await db.execute("SELECT 1")

async def check_redis():
    # Verify Redis connection
    await redis.ping()

health_checker.add_check("database", check_database)
health_checker.add_check("redis", check_redis)


@app.get("/health")
async def health():
    return await health_checker.run_checks()

@app.get("/health/live")
async def liveness():
    """Kubernetes liveness probe"""
    return {"status": "alive"}

@app.get("/health/ready")
async def readiness():
    """Kubernetes readiness probe"""
    result = await health_checker.run_checks()
    if result["status"] != "healthy":
        raise HTTPException(status_code=503)
    return result
```

---

## Configuration Management

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class ServiceSettings(BaseSettings):
    """Service configuration from environment"""

    # Service identity
    service_name: str = "skills-service"
    service_port: int = 8001

    # Database
    database_url: str

    # Other services
    career_service_url: str
    learning_service_url: str

    # Message broker
    redis_url: str

    # Feature flags
    enable_caching: bool = True
    enable_metrics: bool = True

    class Config:
        env_file = ".env"
        env_prefix = "SKILLS_"  # SKILLS_DATABASE_URL, etc.


@lru_cache
def get_settings() -> ServiceSettings:
    return ServiceSettings()


# Usage
settings = get_settings()
print(f"Running {settings.service_name} on port {settings.service_port}")
```

---

## Pattern Selection Guide

| Need | Pattern |
|------|---------|
| Single entry point | API Gateway |
| Independent databases | Service Independence |
| Inter-service calls | Service Client |
| Async communication | Event-Driven |
| Dynamic routing | Service Discovery |
| Monitoring | Health Checks |
| Environment config | Configuration Management |
