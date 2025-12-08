# 15-Factor Extensions - Modern Cloud-Native Additions

API First, Telemetry, and Authentication patterns extending the original 12 factors.

---

## Factor XIII: API First

**Design APIs before implementation.**

### OpenAPI Specification

```yaml
# openapi.yaml
openapi: 3.1.0
info:
  title: Order Management API
  version: 1.0.0
  description: API for managing customer orders

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

paths:
  /orders:
    get:
      summary: List orders
      operationId: listOrders
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, processing, completed, cancelled]
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: List of orders
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Order'

    post:
      summary: Create order
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrder'
      responses:
        '201':
          description: Order created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '400':
          $ref: '#/components/responses/BadRequest'

components:
  schemas:
    Order:
      type: object
      required:
        - id
        - status
        - items
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          enum: [pending, processing, completed, cancelled]
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
        total:
          type: number
          format: decimal
        createdAt:
          type: string
          format: date-time

    CreateOrder:
      type: object
      required:
        - items
      properties:
        items:
          type: array
          items:
            type: object
            properties:
              productId:
                type: string
              quantity:
                type: integer
                minimum: 1

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
              details:
                type: array
                items:
                  type: string
```

### API Versioning

```python
from fastapi import FastAPI, APIRouter

# Version via URL path
app = FastAPI()

v1_router = APIRouter(prefix="/v1")
v2_router = APIRouter(prefix="/v2")


@v1_router.get("/users/{user_id}")
async def get_user_v1(user_id: str):
    """V1: Returns basic user info."""
    return {"id": user_id, "name": "John"}


@v2_router.get("/users/{user_id}")
async def get_user_v2(user_id: str):
    """V2: Returns extended user info."""
    return {
        "id": user_id,
        "name": "John",
        "email": "john@example.com",
        "preferences": {}
    }


app.include_router(v1_router)
app.include_router(v2_router)


# Version via header
@app.get("/users/{user_id}")
async def get_user(user_id: str, api_version: str = Header("2024-01-01")):
    """Version via header for backward compatibility."""
    if api_version < "2024-06-01":
        return get_user_v1(user_id)
    return get_user_v2(user_id)
```

---

## Factor XIV: Telemetry

**Monitoring, metrics, and health checks are first-class concerns.**

### Health Check Endpoints

```python
from fastapi import FastAPI, Response
from fastapi.responses import JSONResponse
import asyncio


app = FastAPI()


@app.get("/health")
async def health():
    """Basic health check - is the app running?"""
    return {"status": "healthy", "version": "1.2.3"}


@app.get("/health/live")
async def liveness():
    """Liveness probe - is the app alive?
    Kubernetes restarts pod if this fails.
    """
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness():
    """Readiness probe - is the app ready to serve traffic?
    Kubernetes removes from load balancer if this fails.
    """
    checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "external_api": await check_external_api()
    }

    all_healthy = all(c["healthy"] for c in checks.values())

    if all_healthy:
        return {"status": "ready", "checks": checks}
    else:
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "checks": checks}
        )


async def check_database() -> dict:
    try:
        await db.execute("SELECT 1")
        return {"healthy": True, "latency_ms": 5}
    except Exception as e:
        return {"healthy": False, "error": str(e)}


async def check_redis() -> dict:
    try:
        await redis.ping()
        return {"healthy": True}
    except Exception as e:
        return {"healthy": False, "error": str(e)}


async def check_external_api() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("https://api.stripe.com/health")
            return {"healthy": response.status_code == 200}
    except Exception as e:
        return {"healthy": False, "error": str(e)}
```

### Prometheus Metrics

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import Request, Response
import time


# Define metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

ACTIVE_REQUESTS = Gauge(
    'http_requests_active',
    'Number of active HTTP requests'
)

DB_CONNECTIONS = Gauge(
    'database_connections_active',
    'Number of active database connections'
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Collect metrics for each request."""
    ACTIVE_REQUESTS.inc()
    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time
    endpoint = request.url.path
    method = request.method
    status = response.status_code

    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()
    REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)
    ACTIVE_REQUESTS.dec()

    return response


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(generate_latest(), media_type="text/plain")
```

### Distributed Tracing

```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


# Configure tracing
def configure_tracing():
    provider = TracerProvider()
    processor = BatchSpanProcessor(OTLPSpanExporter())
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)


tracer = trace.get_tracer(__name__)


# Instrument FastAPI
FastAPIInstrumentor.instrument_app(app)


# Manual span creation
@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    with tracer.start_as_current_span("get_order") as span:
        span.set_attribute("order.id", order_id)

        with tracer.start_as_current_span("fetch_from_database"):
            order = await db.get_order(order_id)

        with tracer.start_as_current_span("enrich_order_data"):
            order.customer = await customer_service.get(order.customer_id)

        span.set_attribute("order.total", order.total)
        return order
```

---

## Factor XV: Authentication & Authorization

**Security built-in, not bolted on.**

### JWT Authentication

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime, timedelta
from typing import Optional


security = HTTPBearer()

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def create_access_token(user_id: str, roles: list[str]) -> str:
    """Create JWT access token."""
    payload = {
        "sub": user_id,
        "roles": roles,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Verify JWT token and return payload."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


@app.get("/protected")
async def protected_route(user: dict = Depends(verify_token)):
    return {"message": f"Hello, user {user['sub']}"}
```

### Role-Based Access Control (RBAC)

```python
from enum import Enum
from functools import wraps


class Role(str, Enum):
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"


def require_roles(*required_roles: Role):
    """Dependency to require specific roles."""
    def role_checker(user: dict = Depends(verify_token)):
        user_roles = user.get("roles", [])
        if not any(role.value in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return user
    return role_checker


@app.get("/admin/users")
async def list_users(admin: dict = Depends(require_roles(Role.ADMIN))):
    """Admin only endpoint."""
    return await user_service.list_all()


@app.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    user: dict = Depends(require_roles(Role.ADMIN, Role.MODERATOR))
):
    """Admin or moderator can delete posts."""
    return await post_service.delete(post_id)
```

### Secret Management

```python
# ❌ WRONG: Secrets in environment variables (acceptable for dev only)
DATABASE_PASSWORD = os.environ.get("DATABASE_PASSWORD")


# ✅ CORRECT: Use secret managers in production

# AWS Secrets Manager
import boto3


class SecretsManager:
    def __init__(self):
        self.client = boto3.client('secretsmanager')
        self._cache = {}

    def get_secret(self, secret_name: str) -> dict:
        """Get secret with caching."""
        if secret_name not in self._cache:
            response = self.client.get_secret_value(SecretId=secret_name)
            self._cache[secret_name] = json.loads(response['SecretString'])
        return self._cache[secret_name]


# Kubernetes Secrets (mounted as files)
def get_secret_from_file(secret_name: str) -> str:
    """Read secret mounted from Kubernetes."""
    secret_path = f"/var/secrets/{secret_name}"
    with open(secret_path, 'r') as f:
        return f.read().strip()


# HashiCorp Vault
import hvac


class VaultClient:
    def __init__(self, vault_addr: str, token: str):
        self.client = hvac.Client(url=vault_addr, token=token)

    def get_secret(self, path: str) -> dict:
        secret = self.client.secrets.kv.v2.read_secret_version(path=path)
        return secret['data']['data']
```

### Workload Identity (Cloud)

```python
# AWS: Use IAM roles attached to ECS tasks or EKS pods
# No credentials in code - SDK automatically uses IAM role

import boto3

# Just use the client - IAM role provides credentials
s3 = boto3.client('s3')
s3.upload_file('file.txt', 'my-bucket', 'file.txt')


# GCP: Use Workload Identity for GKE
from google.cloud import storage

# Automatically uses service account bound to pod
client = storage.Client()
bucket = client.bucket('my-bucket')
blob = bucket.blob('file.txt')
blob.upload_from_filename('file.txt')
```

---

## Compliance Checklist

### API First
- [ ] OpenAPI/Swagger specification documented
- [ ] API versioning strategy implemented
- [ ] Contract testing in place
- [ ] Breaking changes communicated via version increments

### Telemetry
- [ ] `/health` endpoint for basic health check
- [ ] `/health/live` liveness probe
- [ ] `/health/ready` readiness probe
- [ ] Metrics endpoint (Prometheus format)
- [ ] Distributed tracing implemented
- [ ] Dashboards for key metrics
- [ ] Alerting rules configured

### Authentication & Authorization
- [ ] Authentication required for protected endpoints
- [ ] Role-based access control (RBAC)
- [ ] Secrets in secret manager (not env vars in production)
- [ ] Workload identity in cloud environments
- [ ] Security headers configured (CORS, CSP, HSTS)
