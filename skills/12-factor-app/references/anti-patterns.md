# 12-Factor App Anti-Patterns

Common violations of 12-Factor principles and how to fix them.

---

## Hardcoded Credentials

**Violation:** Factor III (Config)

```python
# ❌ WRONG - Credentials in code
class DatabaseConnection:
    def __init__(self):
        self.url = "postgresql://admin:password123@prod-db.example.com/myapp"
        self.api_key = "sk_live_abc123xyz789"


# ✅ CORRECT - Config from environment
from backend.config.config import DATABASE_URL, API_KEY


class DatabaseConnection:
    def __init__(self):
        self.url = DATABASE_URL
        self.api_key = API_KEY
```

**Detection:**
- Use GitGuardian or git-secrets to scan commits
- Review for string literals containing passwords, keys, tokens
- Check for URLs with credentials embedded

**Prevention:**
- Use `.env.example` templates without real values
- Implement pre-commit hooks to scan for secrets
- Use secret managers in production

---

## Stateful Sessions / Sticky Sessions

**Violation:** Factor VI (Processes)

```python
# ❌ WRONG - In-memory session storage
class App:
    def __init__(self):
        self.sessions = {}  # Lost on restart!

    def login(self, user_id: str) -> str:
        session_id = str(uuid4())
        self.sessions[session_id] = {
            "user_id": user_id,
            "cart": [],
            "preferences": {}
        }
        return session_id

    def get_session(self, session_id: str):
        return self.sessions.get(session_id)  # Won't work across instances!


# ✅ CORRECT - External session storage
import redis


class SessionStore:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    def create_session(self, user_id: str) -> str:
        session_id = str(uuid4())
        session_data = json.dumps({
            "user_id": user_id,
            "cart": [],
            "preferences": {}
        })
        self.redis.setex(f"session:{session_id}", 3600, session_data)
        return session_id

    def get_session(self, session_id: str) -> dict | None:
        data = self.redis.get(f"session:{session_id}")
        return json.loads(data) if data else None
```

**Impact:**
- Can't scale horizontally
- Sessions lost during deployments
- Sticky sessions required (reduces flexibility)

---

## Building in Production

**Violation:** Factor V (Build, Release, Run)

```bash
# ❌ WRONG - Build in production
ssh prod-server
git pull origin main
pip install -r requirements.txt
systemctl restart app

# Problems:
# - Different builds in different environments
# - Build failures happen in production
# - No rollback capability
# - Security risk (build tools in production)
```

```bash
# ✅ CORRECT - Build once, deploy everywhere
# Build in CI
docker build -t myapp:v1.2.3 .
docker push registry.example.com/myapp:v1.2.3

# Deploy pre-built artifact
kubectl set image deployment/myapp myapp=registry.example.com/myapp:v1.2.3

# Rollback if needed
kubectl rollout undo deployment/myapp
```

---

## Different Dev/Prod Stacks

**Violation:** Factor X (Dev/Prod Parity)

```yaml
# ❌ WRONG - Different services in dev vs prod
# Development
DATABASE: SQLite
CACHE: dict in memory
STORAGE: local filesystem

# Production
DATABASE: PostgreSQL
CACHE: Redis
STORAGE: S3
```

```yaml
# ✅ CORRECT - Same services everywhere
# docker-compose.yml (development)
services:
  db:
    image: postgres:15  # Same as production
  redis:
    image: redis:7      # Same as production
  minio:
    image: minio/minio  # S3-compatible for local dev
```

**Impact:**
- "Works on my machine" bugs
- Integration issues discovered late
- Different behavior between environments

---

## Writing Logs to Files

**Violation:** Factor XI (Logs)

```python
# ❌ WRONG - Logging to files
import logging

logging.basicConfig(
    filename='/var/log/myapp/app.log',
    filemode='a',
    level=logging.INFO
)

# Problems:
# - Disk fills up
# - Log rotation complexity
# - Can't aggregate logs across instances
# - Logs lost when container dies
```

```python
# ✅ CORRECT - Logging to stdout
import logging
import sys

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s'
)

# Log aggregation happens externally:
# Container → Fluentd → Elasticsearch → Kibana
```

---

## Multiple Apps in One Repository

**Violation:** Factor I (Codebase)

```
# ❌ WRONG - Monorepo with independent apps
monorepo/
├── user-service/        # Independent deployment
├── order-service/       # Independent deployment
├── payment-service/     # Independent deployment
├── notification-service/ # Independent deployment
└── admin-dashboard/     # Independent deployment

# Problems:
# - All services rebuilt on any change
# - Complex CI/CD pipelines
# - Version management confusion
# - Deployment coupling
```

```
# ✅ CORRECT - Separate repos for independent services
user-service/        # Own repo, own deployments
order-service/       # Own repo, own deployments
payment-service/     # Own repo, own deployments

# Note: Monorepo is OK for tightly-coupled libraries/packages
# that always deploy together
```

---

## Ignoring Lock Files

**Violation:** Factor II (Dependencies)

```bash
# ❌ WRONG - Lock files in .gitignore
# .gitignore
package-lock.json
poetry.lock
Pipfile.lock
yarn.lock

# Result: Different dependency versions in different environments
```

```bash
# ✅ CORRECT - Lock files committed
git add package-lock.json poetry.lock
git commit -m "Update dependencies"

# CI installs from lock file
pip install -r requirements.txt --no-deps
npm ci  # Uses lock file exactly
```

**Impact:**
- Non-reproducible builds
- "It worked yesterday" issues
- Security vulnerabilities from floating versions

---

## Long Startup Times

**Violation:** Factor IX (Disposability)

```python
# ❌ WRONG - Heavy initialization at startup
class App:
    def __init__(self):
        # All of this blocks startup
        self.ml_model = load_model('huge_model.pkl')  # 30 seconds
        self.cache = precompute_analytics()  # 60 seconds
        self.connections = create_connection_pool(1000)  # 10 seconds

# Total startup: ~100 seconds
# - Slow deployments
# - Health checks fail
# - Autoscaling doesn't work
```

```python
# ✅ CORRECT - Lazy initialization
class App:
    def __init__(self):
        self._ml_model = None
        self._cache = {}
        self.db = connect_database()  # Quick connection only

    @property
    def ml_model(self):
        """Load model on first use."""
        if self._ml_model is None:
            self._ml_model = load_model('huge_model.pkl')
        return self._ml_model

# Startup: < 5 seconds
# Model loads when first request needs it
```

---

## Environment-Specific Branches

**Violation:** Factor I (Codebase)

```bash
# ❌ WRONG - Branches per environment
git checkout dev-environment
git checkout staging-environment
git checkout production-environment

# Problems:
# - Merge conflicts
# - Code drift between environments
# - Testing doesn't match production
# - Complex merge workflows
```

```bash
# ✅ CORRECT - Same code, different config
# One branch (main)
# Environment differences via config only:
# - development: .env.development
# - staging: Kubernetes ConfigMap (staging)
# - production: Kubernetes ConfigMap (production)
```

---

## Manual Configuration Changes

**Violation:** Factor III (Config), Factor V (Build, Release, Run)

```bash
# ❌ WRONG - SSH and manual edits
ssh prod-server
sudo nano /etc/myapp/config.yml
sudo systemctl restart myapp

# Problems:
# - No audit trail
# - Configuration drift
# - Not reproducible
# - Easy to make mistakes
```

```bash
# ✅ CORRECT - Infrastructure as Code
# Update config in repository
git commit -m "Update production config"
git push

# CI/CD applies changes
kubectl apply -f k8s/configmap.yaml

# Or use GitOps (ArgoCD)
# Changes automatically synced from Git
```

---

## No Health Checks

**Violation:** Factor XIV (Telemetry - 15-Factor)

```python
# ❌ WRONG - No health endpoints
# Kubernetes doesn't know if app is healthy
# Load balancer sends traffic to broken instances
# No visibility into application state
```

```python
# ✅ CORRECT - Comprehensive health checks
@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/health/live")
async def liveness():
    """App process is running."""
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness():
    """App can serve traffic."""
    try:
        await db.execute("SELECT 1")
        await redis.ping()
        return {"status": "ready"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "error": str(e)}
        )
```

---

## Detection Checklist

| Code Smell | 12-Factor Violation |
|------------|---------------------|
| Credentials in source code | Factor III (Config) |
| `sessions = {}` in application | Factor VI (Processes) |
| `git pull` on production server | Factor V (Build, Release, Run) |
| SQLite in dev, PostgreSQL in prod | Factor X (Dev/Prod Parity) |
| `logging.basicConfig(filename=...)` | Factor XI (Logs) |
| Multiple apps in one repo | Factor I (Codebase) |
| Lock files in .gitignore | Factor II (Dependencies) |
| Heavy startup initialization | Factor IX (Disposability) |
| Environment-specific branches | Factor I (Codebase) |
| SSH to change config | Factor III, V |
| No `/health` endpoint | Factor XIV (Telemetry) |

---

## Quick Fixes

1. **Hardcoded credentials** → Move to environment variables via config file
2. **In-memory sessions** → Use Redis or database-backed sessions
3. **Build in production** → Set up CI/CD pipeline with pre-built artifacts
4. **Dev/prod differences** → Use Docker to match production locally
5. **File logging** → Log to stdout, use log aggregation
6. **Multiple apps per repo** → Split into separate repositories
7. **Missing lock files** → Commit lock files, use `npm ci` / `pip install --no-deps`
8. **Slow startup** → Lazy load heavy resources
9. **Environment branches** → Use feature branches, config per environment
10. **Manual config** → Infrastructure as Code (Terraform, Kubernetes manifests)
11. **No health checks** → Add `/health`, `/health/live`, `/health/ready`
