# Pattern Quick Lookup

Alphabetical listing of all patterns with their corresponding skill.

---

## A

| Pattern | Description | Skill |
|---------|-------------|-------|
| Adapter | Convert interface to another | `gof-patterns` |
| Aggregator | Combine multiple agent outputs | `ai-agent-patterns` |

## B

| Pattern | Description | Skill |
|---------|-------------|-------|
| Bridge | Separate abstraction from implementation | `gof-patterns` |
| Builder | Step-by-step object construction | `gof-patterns` |
| Bulkhead | Isolate resource pools | `backend-resilience-patterns` |

## C

| Pattern | Description | Skill |
|---------|-------------|-------|
| Cache-Aside | Lazy load cache on read | `backend-resilience-patterns` |
| Chain of Responsibility | Pass request along chain | `gof-patterns` |
| Circuit Breaker | Stop calling failing services | `backend-resilience-patterns` |
| Command | Encapsulate request as object | `gof-patterns` |
| Composite | Tree structure of objects | `gof-patterns` |
| Compound Components | Coordinated child components | `frontend-patterns` |
| Container/Presenter | Separate logic from UI | `frontend-patterns` |
| Context API | React shared state | `frontend-patterns` |
| CQRS | Separate read/write models | `backend-resilience-patterns` |
| Custom Hooks | Reusable React logic | `frontend-patterns` |

## D

| Pattern | Description | Skill |
|---------|-------------|-------|
| Decorator | Add responsibilities dynamically | `gof-patterns` |
| Dependency Injection | Inject dependencies | `backend-patterns` |
| Domain Events | Publish domain changes | `backend-resilience-patterns` |

## E

| Pattern | Description | Skill |
|---------|-------------|-------|
| Event Bus | Pub/sub messaging | `backend-resilience-patterns` |
| Event Sourcing | Store events as truth | `backend-resilience-patterns` |

## F

| Pattern | Description | Skill |
|---------|-------------|-------|
| Facade | Simplify complex subsystem | `gof-patterns` |
| Factory | Create objects without specifying class | `gof-patterns` |
| Fallback | Alternative when service fails | `backend-resilience-patterns` |
| Feature Flags | Toggle features dynamically | `backend-resilience-patterns` |
| Flyweight | Share common state | `gof-patterns` |

## G-H

| Pattern | Description | Skill |
|---------|-------------|-------|
| Handoffs | Agent-to-agent transfer | `ai-agent-patterns` |
| Health Checks | Monitor system health | `backend-resilience-patterns` |
| HOC (Higher-Order Component) | Enhance components | `frontend-patterns` |

## I-L

| Pattern | Description | Skill |
|---------|-------------|-------|
| Idempotency | Safe request retries | `backend-resilience-patterns` |
| Iterator | Traverse collection | `gof-patterns` |
| LangGraph Workflows | LangChain graph patterns | `ai-agent-patterns` |
| Loop Architecture | Iterative agent execution | `ai-agent-patterns` |

## M-O

| Pattern | Description | Skill |
|---------|-------------|-------|
| Mediator | Centralize communication | `gof-patterns` |
| Memento | Capture and restore state | `gof-patterns` |
| Middleware | Request/response pipeline | `backend-patterns` |
| Multi-Agent | Multiple specialized agents | `ai-agent-patterns` |
| Observer | Notify on state changes | `gof-patterns` |
| Outbox | Reliable event publishing | `backend-resilience-patterns` |

## P

| Pattern | Description | Skill |
|---------|-------------|-------|
| Parallel Architecture | Independent concurrent agents | `ai-agent-patterns` |
| Plan-and-Execute | Multi-step agent planning | `ai-agent-patterns` |
| Prototype | Clone existing objects | `gof-patterns` |
| Proxy | Control access to object | `gof-patterns` |

## R

| Pattern | Description | Skill |
|---------|-------------|-------|
| Rate Limiting | Limit request frequency | `backend-resilience-patterns` |
| Reflection | Agent self-improvement | `ai-agent-patterns` |
| Render Props | Share code via render prop | `frontend-patterns` |
| Repository | Abstract data access | `backend-patterns` |
| Retry | Retry failed operations | `backend-resilience-patterns` |
| Router Architecture | Route to specialist agents | `ai-agent-patterns` |

## S

| Pattern | Description | Skill |
|---------|-------------|-------|
| Saga | Distributed transactions | `backend-resilience-patterns` |
| Sequential Architecture | Ordered agent execution | `ai-agent-patterns` |
| Service Layer | Business logic orchestration | `backend-patterns` |
| Singleton | Single instance | `gof-patterns` |
| State | State-based behavior | `gof-patterns` |
| State Management | React global state | `frontend-patterns` |
| Strategy | Interchangeable algorithms | `gof-patterns` |
| Supervisor | Agent orchestrator | `ai-agent-patterns` |

## T

| Pattern | Description | Skill |
|---------|-------------|-------|
| Task Queue | Background job processing | `backend-resilience-patterns` |
| Template Method | Algorithm skeleton | `gof-patterns` |
| Timeout | Limit wait time | `backend-resilience-patterns` |
| Tool Calling | Central agent with tools | `ai-agent-patterns` |
| Tool Use | Agent external resources | `ai-agent-patterns` |

## U-Z

| Pattern | Description | Skill |
|---------|-------------|-------|
| useCallback | Memoize callbacks | `frontend-patterns` |
| useMemo | Memoize values | `frontend-patterns` |
| useReducer | Complex state logic | `frontend-patterns` |
| Visitor | Separate algorithm from structure | `gof-patterns` |
| Write-Through Cache | Write to cache and store | `backend-resilience-patterns` |
| Zustand | Lightweight state management | `frontend-patterns` |

---

## By Skill Summary

### `gof-patterns`
Factory, Builder, Singleton, Prototype, Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy, Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor

### `backend-patterns`
Repository, Service Layer, Dependency Injection, Middleware

### `backend-resilience-patterns`
Circuit Breaker, Retry, Timeout, Bulkhead, Fallback, Cache-Aside, Write-Through Cache, Task Queue, Domain Events, Event Bus, CQRS, Event Sourcing, Saga, Outbox, Rate Limiting, Health Checks, Idempotency, Feature Flags

### `frontend-patterns`
Container/Presenter, Compound Components, HOC, Render Props, Custom Hooks, Context API, useReducer, useMemo, useCallback, State Management, Zustand

### `ai-agent-patterns`
Parallel Architecture, Sequential Architecture, Loop Architecture, Router Architecture, Aggregator, Tool Calling, Handoffs, Reflection, Plan-and-Execute, Tool Use, Multi-Agent, Supervisor, LangGraph Workflows
