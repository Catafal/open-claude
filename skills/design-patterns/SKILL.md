---
name: design-patterns
description: Master guide for software design patterns. Routes to specialized skills based on what you're building. Use when asking about design patterns, architecture decisions, or pattern selection. Triggers on design pattern, Factory, Strategy, Observer, Repository, Service Layer, Circuit Breaker, React hooks, multi-agent. Routes to gof-patterns, ai-agent-patterns, backend-patterns, backend-resilience-patterns, frontend-patterns.
---

# Design Patterns - Master Guide

This skill routes to specialized pattern skills based on what you're building.

## Quick Pattern Finder

**What are you building?**

| Building... | Go To Skill | Key Patterns |
|-------------|-------------|--------------|
| AI/ML agent system | `ai-agent-patterns` | Multi-Agent, Router, Reflection, Tool Calling |
| Backend API (core) | `backend-patterns` | Repository, Service Layer, Dependency Injection |
| Backend API (production) | `backend-resilience-patterns` | Circuit Breaker, Retry, CQRS, Rate Limiting |
| React/TypeScript app | `frontend-patterns` | Container/Presenter, Custom Hooks, State Management |
| Object creation logic | `gof-patterns` | Factory, Builder, Singleton |
| Flexible behaviors | `gof-patterns` | Strategy, Decorator, Observer, Command |

---

## Pattern Selection Flowchart

```
┌─────────────────────────────────────┐
│ What do you need to build?          │
└──────────┬──────────────────────────┘
           │
     ┌─────┴─────┬─────────┬──────────┐
     │           │         │          │
  AI Agent   Backend   Frontend   OOP Design
     │           │         │          │
     ▼           ▼         ▼          ▼
  ┌──────┐   ┌──────┐  ┌──────┐   ┌──────┐
  │ ai-  │   │back- │  │front │   │ gof- │
  │agent │   │end-* │  │end-  │   │patt- │
  │patt..│   │patt..│  │patt..│   │erns  │
  └──────┘   └──────┘  └──────┘   └──────┘
```

---

## Domain Skills

### 1. `gof-patterns`
**Classic Gang of Four patterns**

- **Creational**: Factory, Builder, Singleton
- **Structural**: Adapter, Decorator, Facade
- **Behavioral**: Strategy, Observer, Command, Template Method

Use when: Designing object creation, structure, or behavior relationships.

### 2. `ai-agent-patterns`
**LangChain and multi-agent systems**

- **Architectures**: Parallel, Sequential, Loop, Router, Aggregator
- **Coordination**: Tool Calling, Handoffs
- **Agentic Patterns**: Reflection, Planning, Tool Use, Multi-Agent

Use when: Building AI/LLM-powered agent systems.

### 3. `backend-patterns`
**Core backend patterns for APIs**

- Repository Pattern (data access abstraction)
- Service Layer (business logic orchestration)
- Dependency Injection (loose coupling, testability)
- FastAPI project structure

Use when: Building REST APIs with clean architecture.

### 4. `backend-resilience-patterns`
**Production-ready backend patterns**

- **Resilience**: Circuit Breaker, Retry, Timeout, Bulkhead, Fallback
- **Async**: Background jobs (Celery, ARQ), Task queues
- **Caching**: Cache-Aside, Write-Through, Distributed caching
- **Events**: Domain Events, CQRS, Event Sourcing, Saga
- **Production**: Rate limiting, Health checks, Feature flags

Use when: Making backend systems fault-tolerant and production-ready.

### 5. `frontend-patterns`
**React 19 and TypeScript patterns**

- **Component**: Container/Presenter, Compound Components, HOC
- **Hooks**: Custom hooks, useEffect patterns, useReducer
- **State**: Context API, Zustand, React Query patterns
- **TypeScript**: Generics, Discriminated unions, Type guards

Use when: Building React applications with TypeScript.

---

## Cross-Domain Pattern Map

Patterns that appear across multiple domains:

| Pattern | GoF | Backend | Frontend | AI Agents |
|---------|-----|---------|----------|-----------|
| **Strategy** | Core definition | DI, Policies | Hooks | Router architecture |
| **Observer** | Core definition | Event-driven | State management | Event bus |
| **Factory** | Core definition | Repository | Component factory | Agent factory |
| **Decorator** | Core definition | Middleware | HOCs | Agent wrappers |
| **Facade** | Core definition | Service Layer | Context providers | Orchestrator |
| **Command** | Core definition | CQRS commands | Actions | Agent commands |
| **State** | Core definition | Workflow state | useReducer | Agent state |

---

## Quick Decision Trees

### Choose Backend Pattern

```
Need data access abstraction? → Repository Pattern (backend-patterns)
Need business logic layer? → Service Layer (backend-patterns)
Need loose coupling? → Dependency Injection (backend-patterns)
Need fault tolerance? → Circuit Breaker/Retry (backend-resilience-patterns)
Need read/write separation? → CQRS (backend-resilience-patterns)
Need distributed transactions? → Saga Pattern (backend-resilience-patterns)
```

### Choose Frontend Pattern

```
Need reusable logic? → Custom Hook (frontend-patterns)
Need shared state? → Context API or Zustand (frontend-patterns)
Need to prevent re-renders? → React.memo + useCallback (frontend-patterns)
Need complex state logic? → useReducer (frontend-patterns)
Need coordinated components? → Compound Components (frontend-patterns)
```

### Choose AI Agent Pattern

```
Tasks independent? → Parallel Architecture (ai-agent-patterns)
Tasks sequential? → Sequential Architecture (ai-agent-patterns)
Need quality refinement? → Reflection Pattern (ai-agent-patterns)
Need external data? → Tool Use Pattern (ai-agent-patterns)
Complex multi-step? → Plan-and-Execute (ai-agent-patterns)
Multiple domains? → Multi-Agent Supervisor (ai-agent-patterns)
```

---

## When to Use Design Patterns

### Use Patterns When

- **Solving common problems** - Pattern provides proven solution
- **Team communication** - Need shared vocabulary
- **Code is growing complex** - Patterns provide structure
- **Preparing for change** - Patterns enable flexibility

### Be Cautious When

- **Over-engineering** - Simple problem doesn't need complex pattern
- **Prototype/POC** - Speed matters more than structure
- **Performance critical** - Some patterns add overhead
- **Team unfamiliarity** - Introduce patterns gradually

### Avoid Patterns When

- **Simple CRUD operations** - Direct implementation is clearer
- **One-time scripts** - Pattern overhead not justified
- **Learning exercise** - Focus on fundamentals first

---

## Pattern-to-Skill Quick Lookup

| Pattern | Skill |
|---------|-------|
| Factory, Builder, Singleton | `gof-patterns` |
| Adapter, Decorator, Facade | `gof-patterns` |
| Strategy, Observer, Command | `gof-patterns` |
| Repository, Service Layer | `backend-patterns` |
| Dependency Injection | `backend-patterns` |
| Circuit Breaker, Retry | `backend-resilience-patterns` |
| CQRS, Event Sourcing, Saga | `backend-resilience-patterns` |
| Rate Limiting, Health Checks | `backend-resilience-patterns` |
| Container/Presenter | `frontend-patterns` |
| Custom Hooks, useReducer | `frontend-patterns` |
| Context API, Zustand | `frontend-patterns` |
| Multi-Agent, Tool Calling | `ai-agent-patterns` |
| Reflection, Planning | `ai-agent-patterns` |
| LangGraph workflows | `ai-agent-patterns` |

---

## References

See [decision-tree.md](references/decision-tree.md) for detailed pattern selection flowcharts.

See [quick-lookup.md](references/quick-lookup.md) for alphabetical pattern lookup.
