# Scalability & Operations - Detailed Reference

Stateless processes, concurrency, disposability, and logging patterns.

---

## Factor VI: Stateless Processes

### Problem: Stateful Processes

```python
# ❌ ANTI-PATTERN: In-memory session storage
class SessionManager:
    def __init__(self):
        self.sessions = {}  # Lost on restart, not shared across instances

    def create_session(self, user_id: str) -> str:
        session_id = str(uuid4())
        self.sessions[session_id] = {
            "user_id": user_id,
            "created_at": datetime.now(),
            "cart": []
        }
        return session_id

    def get_session(self, session_id: str) -> dict | None:
        return self.sessions.get(session_id)

# Problems:
# 1. Session lost when process restarts
# 2. Different instances have different sessions
# 3. Can't scale horizontally
```

### Solution: External Session Storage

```python
import redis
import json
from datetime import datetime, timedelta


class RedisSessionManager:
    """Stateless session management using Redis."""

    def __init__(self, redis_url: str, ttl_seconds: int = 3600):
        self.redis = redis.from_url(redis_url)
        self.ttl = ttl_seconds

    def create_session(self, user_id: str) -> str:
        session_id = str(uuid4())
        session_data = {
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "cart": []
        }
        self.redis.setex(
            f"session:{session_id}",
            self.ttl,
            json.dumps(session_data)
        )
        return session_id

    def get_session(self, session_id: str) -> dict | None:
        data = self.redis.get(f"session:{session_id}")
        return json.loads(data) if data else None

    def update_session(self, session_id: str, data: dict) -> None:
        self.redis.setex(
            f"session:{session_id}",
            self.ttl,
            json.dumps(data)
        )

    def delete_session(self, session_id: str) -> None:
        self.redis.delete(f"session:{session_id}")
```

### File Storage Pattern

```python
# ❌ ANTI-PATTERN: Local file storage
def save_user_upload(user_id: str, file: bytes) -> str:
    path = f"/var/uploads/{user_id}/{uuid4()}.jpg"
    with open(path, 'wb') as f:
        f.write(file)
    return path  # Path won't work on other instances!


# ✅ CORRECT: Object storage (S3, GCS, etc.)
import boto3


class S3FileStorage:
    def __init__(self, bucket: str):
        self.s3 = boto3.client('s3')
        self.bucket = bucket

    def save_upload(self, user_id: str, file: bytes, content_type: str) -> str:
        key = f"uploads/{user_id}/{uuid4()}"
        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file,
            ContentType=content_type
        )
        return f"s3://{self.bucket}/{key}"

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=expires_in
        )
```

---

## Factor VIII: Concurrency

### Process Types

```
# Procfile - Define different process types
web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4
worker: celery -A tasks worker --loglevel=info --concurrency=4
scheduler: celery -A tasks beat --loglevel=info
websocket: python websocket_server.py
```

### Horizontal Scaling

```yaml
# Kubernetes: Scale each process type independently

# Web servers - handle HTTP traffic
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 5  # Scale based on traffic
  template:
    spec:
      containers:
        - name: web
          command: ["uvicorn", "main:app", "--host", "0.0.0.0"]

---
# Workers - handle background jobs
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 10  # Scale based on queue depth
  template:
    spec:
      containers:
        - name: worker
          command: ["celery", "-A", "tasks", "worker"]

---
# Scheduler - single instance
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scheduler
spec:
  replicas: 1  # Only one scheduler needed
  template:
    spec:
      containers:
        - name: scheduler
          command: ["celery", "-A", "tasks", "beat"]
```

### Worker Implementation

```python
from celery import Celery
import os

app = Celery(
    'tasks',
    broker=os.environ.get('REDIS_URL'),
    backend=os.environ.get('REDIS_URL')
)

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_acks_late=True,  # For crash recovery
    worker_prefetch_multiplier=1,  # Fair distribution
)


@app.task(bind=True, max_retries=3)
def process_order(self, order_id: str):
    """Background task for order processing."""
    try:
        order = get_order(order_id)
        process_payment(order)
        send_confirmation_email(order)
        update_inventory(order)
    except Exception as exc:
        self.retry(exc=exc, countdown=60)


@app.task
def send_email(to: str, subject: str, body: str):
    """Email sending task."""
    smtp_client.send(to=to, subject=subject, body=body)
```

---

## Factor IX: Disposability

### Fast Startup

```python
# ❌ SLOW STARTUP - Load everything at initialization
class SlowApp:
    def __init__(self):
        # These block startup
        self.ml_model = load_large_model('model.pkl')  # 30s
        self.cache = precompute_all_data()  # 60s
        self.analytics = fetch_historical_data()  # 20s

# Total startup: ~110 seconds!


# ✅ FAST STARTUP - Lazy loading
class FastApp:
    def __init__(self):
        self._ml_model = None
        self._cache = {}
        self.db = connect_database()  # Quick connection only

    @property
    def ml_model(self):
        """Lazy load ML model on first use."""
        if self._ml_model is None:
            self._ml_model = load_large_model('model.pkl')
        return self._ml_model

    def get_cached_data(self, key: str):
        """Load cache entries on demand."""
        if key not in self._cache:
            self._cache[key] = fetch_data(key)
        return self._cache[key]

# Startup: < 1 second
```

### Graceful Shutdown

```python
import asyncio
import signal
from contextlib import asynccontextmanager
from fastapi import FastAPI


class GracefulShutdown:
    """Handle graceful shutdown with in-flight request tracking."""

    def __init__(self):
        self.shutdown_event = asyncio.Event()
        self.active_requests = 0
        self.max_wait_seconds = 30

    async def wait_for_shutdown(self):
        """Wait for all requests to complete or timeout."""
        start = asyncio.get_event_loop().time()
        while self.active_requests > 0:
            if asyncio.get_event_loop().time() - start > self.max_wait_seconds:
                print(f"Timeout: {self.active_requests} requests still active")
                break
            await asyncio.sleep(0.1)

    def request_started(self):
        self.active_requests += 1

    def request_finished(self):
        self.active_requests -= 1


shutdown_handler = GracefulShutdown()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await database.connect()
    await cache.connect()

    yield

    # Shutdown - graceful cleanup
    print("Shutting down gracefully...")
    await shutdown_handler.wait_for_shutdown()
    await database.disconnect()
    await cache.disconnect()
    print("Shutdown complete")


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def track_requests(request, call_next):
    shutdown_handler.request_started()
    try:
        response = await call_next(request)
        return response
    finally:
        shutdown_handler.request_finished()
```

### Idempotent Operations

```python
from dataclasses import dataclass
from typing import Optional


@dataclass
class IdempotencyKey:
    key: str
    result: Optional[dict] = None
    created_at: datetime = None


class IdempotentProcessor:
    """Ensure operations can be safely retried."""

    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = 86400  # 24 hours

    async def process_with_idempotency(
        self,
        idempotency_key: str,
        operation: callable,
        *args,
        **kwargs
    ) -> dict:
        # Check if operation was already processed
        existing = self.redis.get(f"idempotency:{idempotency_key}")
        if existing:
            return json.loads(existing)

        # Process operation
        result = await operation(*args, **kwargs)

        # Store result for future requests
        self.redis.setex(
            f"idempotency:{idempotency_key}",
            self.ttl,
            json.dumps(result)
        )

        return result


# Usage
@app.post("/orders")
async def create_order(
    order_data: OrderCreate,
    idempotency_key: str = Header(...)
):
    return await processor.process_with_idempotency(
        idempotency_key,
        order_service.create_order,
        order_data
    )
```

---

## Factor XI: Logs as Event Streams

### Structured Logging

```python
import structlog
import sys


def configure_logging():
    """Configure structured JSON logging to stdout."""
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


# Usage
logger = structlog.get_logger()

logger.info(
    "order_created",
    order_id="ORD-123",
    user_id="USR-456",
    total=99.99,
    items_count=3
)
# Output: {"event": "order_created", "order_id": "ORD-123", ...}

logger.error(
    "payment_failed",
    order_id="ORD-123",
    error_code="CARD_DECLINED",
    exc_info=True
)
```

### Request Context Logging

```python
import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar('request_id', default='')


def get_request_logger():
    """Get logger with request context."""
    return structlog.get_logger().bind(request_id=request_id_var.get())


@app.middleware("http")
async def add_request_id(request, call_next):
    request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
    request_id_var.set(request_id)

    logger = get_request_logger()
    logger.info(
        "request_started",
        method=request.method,
        path=request.url.path
    )

    response = await call_next(request)

    logger.info(
        "request_completed",
        status_code=response.status_code
    )

    response.headers['X-Request-ID'] = request_id
    return response
```

### What to Log

```python
# Log levels and what belongs where

# DEBUG - Development only
logger.debug("cache_lookup", key="user:123", hit=False)

# INFO - Normal operations
logger.info("user_login", user_id="123", method="oauth")
logger.info("order_created", order_id="456", total=99.99)
logger.info("email_sent", recipient="user@example.com", template="welcome")

# WARNING - Unexpected but handled
logger.warning("rate_limit_approached", user_id="123", current=95, limit=100)
logger.warning("retry_attempt", operation="payment", attempt=2, max=3)

# ERROR - Failures
logger.error("payment_failed", order_id="456", reason="insufficient_funds")
logger.error("external_api_error", service="stripe", status=500)

# CRITICAL - System-wide issues
logger.critical("database_connection_lost", reconnect_attempts=5)
```

### What NOT to Log

```python
# ❌ NEVER log these:
logger.info("user_login", password="secret123")  # Passwords
logger.info("payment", card_number="4111111111111111")  # Credit cards
logger.info("user_data", ssn="123-45-6789")  # PII without compliance
logger.debug("api_call", api_key="sk_live_abc123")  # Secrets
```

---

## Compliance Checklist

### Stateless Processes
- [ ] No in-memory session storage
- [ ] No local file storage for user data
- [ ] State stored in external backing services
- [ ] Horizontal scaling works without sticky sessions

### Concurrency
- [ ] Process types defined and documented
- [ ] Each type independently scalable
- [ ] No internal process daemonization
- [ ] Work distribution is fair

### Disposability
- [ ] Application starts in < 10 seconds
- [ ] SIGTERM handled gracefully
- [ ] In-flight requests completed before shutdown
- [ ] Operations are idempotent

### Logging
- [ ] All logs to stdout/stderr
- [ ] Structured logging (JSON)
- [ ] No log files created by application
- [ ] Sensitive data never logged
