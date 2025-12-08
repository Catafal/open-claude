---
name: 12-factor-app
description: The 12-Factor App methodology for building cloud-native, scalable applications. Use when deploying to cloud platforms, containerizing applications, or designing for horizontal scaling. Triggers on 12-factor, cloud-native, environment variables, config management, stateless processes, port binding, backing services, build release run, dev prod parity, logs as streams, horizontal scaling, Heroku, Kubernetes deployment, Docker best practices.
---

# 12-Factor App Methodology

The **12-Factor App** is a methodology for building modern, cloud-native applications that are portable, scalable, and maintainable. Originally created by Heroku, these principles have become the foundation for cloud deployment best practices.

---

## Quick Reference

| Factor | Principle | Key Implementation |
|--------|-----------|-------------------|
| **I. Codebase** | One repo, many deploys | Git per app |
| **II. Dependencies** | Explicit declaration | requirements.txt, package.json |
| **III. Config** | Store in environment | Environment variables |
| **IV. Backing Services** | Treat as attached resources | Connection URLs |
| **V. Build, Release, Run** | Strict separation | CI/CD pipelines |
| **VI. Processes** | Stateless, share-nothing | Redis for sessions |
| **VII. Port Binding** | Export via port | Embedded web server |
| **VIII. Concurrency** | Scale via process model | Horizontal scaling |
| **IX. Disposability** | Fast startup, graceful shutdown | SIGTERM handling |
| **X. Dev/Prod Parity** | Keep environments similar | Docker |
| **XI. Logs** | Treat as event streams | stdout/stderr |
| **XII. Admin** | One-off processes | Database migrations |

---

## The 12 Factors

### I. Codebase

**One codebase tracked in revision control, many deploys.**

```
Codebase (main branch)
       ↓
    [Build]
       ↓
┌──────┴──────┬──────────┬──────────────┐
dev       staging   production      demo
```

**Rules:**
- One Git repository per deployable application
- Same codebase deploys to all environments
- No environment-specific branches (use config instead)
- Version tags for releases

---

### II. Dependencies

**Explicitly declare and isolate dependencies.**

```python
# requirements.txt - Pin exact versions
fastapi==0.104.1
pydantic==2.5.0
sqlalchemy==2.0.23

# Or use poetry.lock for reproducible builds
```

```bash
# Isolation with virtual environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Rules:**
- All dependencies in manifest file
- Lock files committed to version control
- No implicit system dependencies
- Containerize system tools if needed

---

### III. Config

**Store config in the environment.**

```python
# ✅ CORRECT - Central config file accessing environment
# backend/config/config.py
import os

DATABASE_URL = os.environ.get("DATABASE_URL")
API_KEY = os.environ.get("API_KEY")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

# Usage
from backend.config.config import DATABASE_URL, API_KEY

# ❌ WRONG - Direct environment access or hardcoded values
import os
db_url = os.getenv("DATABASE_URL")  # Scattered access
API_KEY = "sk_live_abc123xyz789"    # Hardcoded secret!
```

**What belongs in config:**
- Database connection strings
- API credentials and secrets
- Service endpoints
- Per-deployment values (domains, ports)

**What does NOT belong:**
- Internal application settings
- Route mappings
- Constants that don't change between deploys

---

### IV. Backing Services

**Treat backing services as attached resources.**

Databases, caches, message queues, and other services should be swappable via configuration.

```python
# Same code works with any database
DATABASE_URL = os.environ.get('DATABASE_URL')

# Development: postgresql://localhost/dev_db
# Staging:     postgresql://staging-db.heroku.com/staging_db
# Production:  postgresql://aws-rds.amazon.com/prod_db
```

| Service | Development | Production |
|---------|-------------|------------|
| Database | Local PostgreSQL | AWS RDS |
| Cache | Local Redis | ElastiCache |
| Storage | Local filesystem | S3 bucket |
| Email | Mailtrap | SendGrid |

---

### V. Build, Release, Run

**Strictly separate build and run stages.**

```
[Build Stage]
Source + Dependencies → Artifact
- Compile code
- Install dependencies
- Run tests
- Create Docker image

[Release Stage]
Artifact + Config → Release
- Tag with version (v1.2.3)
- Inject environment config
- Store in registry

[Run Stage]
Release → Running Processes
- Deploy to environment
- Start application
- Monitor health
```

```yaml
# GitHub Actions example
jobs:
  build:
    - run: docker build -t myapp:${GITHUB_SHA} .
    - run: docker push myapp:${GITHUB_SHA}

  release:
    - run: docker tag myapp:${GITHUB_SHA} myapp:v1.2.3

  deploy:
    - run: kubectl set image deployment/myapp myapp=myapp:v1.2.3
```

---

### VI. Processes

**Execute the app as one or more stateless processes.**

```python
# ❌ WRONG - Storing state in memory
user_sessions = {}

@app.post("/login")
def login(user_id: str):
    user_sessions[user_id] = {"logged_in": True}

# ✅ CORRECT - Store in backing service
@app.post("/login")
def login(user_id: str):
    redis.setex(f"session:{user_id}", 3600, "logged_in")
```

**Rules:**
- No in-memory session storage
- No local file storage for user data
- Process can be killed and restarted without data loss
- Use Redis, Memcached, or database for shared state

---

### VII. Port Binding

**Export services via port binding.**

```python
# Application is self-contained with embedded server
import uvicorn
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "healthy"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

**Rules:**
- Application includes web server (not Apache/Nginx module)
- Port configurable via environment variable
- No dependency on external web server

---

### VIII. Concurrency

**Scale out via the process model.**

```
# Procfile - Define process types
web: uvicorn main:app --host 0.0.0.0 --port $PORT
worker: celery -A tasks worker --loglevel=info
scheduler: celery -A tasks beat --loglevel=info
```

```yaml
# Kubernetes - Scale each process type independently
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3  # Scale web processes

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 5  # Scale workers independently
```

---

### IX. Disposability

**Maximize robustness with fast startup and graceful shutdown.**

```python
import signal
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await database.connect()
    yield
    # Shutdown - graceful cleanup
    await database.disconnect()

app = FastAPI(lifespan=lifespan)

# Handle SIGTERM for graceful shutdown
def handle_shutdown(signum, frame):
    print("Received shutdown signal, finishing current requests...")
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_shutdown)
```

**Targets:**
- Web processes: < 5 seconds startup
- Worker processes: < 30 seconds startup
- Graceful shutdown: Complete in-flight requests

---

### X. Dev/Prod Parity

**Keep development, staging, and production as similar as possible.**

```yaml
# docker-compose.yml - Mirrors production services
version: '3.8'
services:
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15  # Same version as production

  redis:
    image: redis:7-alpine  # Same version as production
```

**Gaps to eliminate:**

| Gap | Traditional | 12-Factor |
|-----|-------------|-----------|
| Time | Weeks between deploys | Hours between deploys |
| Personnel | Devs write, ops deploy | Developers deploy |
| Tools | SQLite dev, PostgreSQL prod | PostgreSQL everywhere |

---

### XI. Logs

**Treat logs as event streams.**

```python
import logging
import sys

# ✅ CORRECT - Log to stdout
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s'
)

logger = logging.getLogger(__name__)
logger.info("User logged in", extra={"user_id": 123})

# ❌ WRONG - Writing to files
logging.basicConfig(filename='/var/log/myapp.log')
```

**Log pipeline:**
```
[App] → stdout/stderr
    ↓
[Container Runtime] → Captures output
    ↓
[Log Router] → Fluentd/Logstash
    ↓
[Storage] → Elasticsearch/Datadog
    ↓
[Dashboards] → Kibana/Grafana
```

---

### XII. Admin Processes

**Run admin/management tasks as one-off processes.**

```bash
# Run migrations with same codebase and config
kubectl run migrate --image=myapp:v1.2.3 --rm -it -- \
    alembic upgrade head

# Open REPL for debugging
kubectl run console --image=myapp:v1.2.3 --rm -it -- \
    python

# Run data import script
docker run --rm myapp:latest python scripts/import_data.py
```

**Rules:**
- Admin scripts in same repository as application
- Use same configuration (environment variables)
- Ship with application (in same container/release)
- No SSH access required

---

## 15-Factor Extensions (Modern Additions)

### XIII. API First

**Design APIs before implementation.**

- Use OpenAPI/Swagger specification
- Define contracts before coding
- Version APIs explicitly

### XIV. Telemetry

**Monitoring, metrics, and health checks are first-class concerns.**

```python
from prometheus_client import Counter, generate_latest

request_count = Counter('http_requests_total', 'Total HTTP requests')

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/health/ready")
def readiness_check():
    # Check backing services
    try:
        db.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "not ready"})

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### XV. Authentication & Authorization

**Security built-in, not bolted on.**

- JWT token-based authentication
- Role-based access control (RBAC)
- Secrets in secret managers (not env vars for production)
- Workload identity in cloud environments

---

## Implementation Priority

### Phase 1: Foundation (Critical)
- [ ] Factor III: Config in environment variables
- [ ] Factor II: Dependencies explicit and isolated
- [ ] Factor I: Single codebase per app

### Phase 2: Service Architecture
- [ ] Factor IV: Backing services as URLs
- [ ] Factor V: Build/Release/Run separation

### Phase 3: Scalability
- [ ] Factor VI: Stateless processes
- [ ] Factor VII: Port binding
- [ ] Factor VIII: Horizontal scaling
- [ ] Factor IX: Fast startup/graceful shutdown

### Phase 4: Operations
- [ ] Factor X: Dev/prod parity
- [ ] Factor XI: Logs to stdout
- [ ] Factor XII: Admin as one-off processes

---

## See Also

### In This Skill
- [Build, Release, Run & Deployment](references/build-release-run.md) - CI/CD, Docker, Kubernetes
- [Scalability & Operations](references/scalability-ops.md) - Processes, Concurrency, Logs
- [15-Factor Extensions](references/15-factor-extensions.md) - API First, Telemetry, Auth
- [Anti-Patterns](references/anti-patterns.md) - Common violations

### Related Skills
- **backend-resilience-patterns** - Circuit Breaker, Retry, Fallback
- **backend-patterns** - Repository, Service Layer, DDD
