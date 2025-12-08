# Pattern Selection Decision Trees

Complete flowcharts for selecting the right design pattern based on your problem.

---

## Master Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│                    What are you building?                    │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   ┌───────────┐      ┌───────────┐       ┌───────────┐
   │ AI/LLM    │      │  Backend  │       │ Frontend  │
   │ System    │      │   API     │       │   App     │
   └─────┬─────┘      └─────┬─────┘       └─────┬─────┘
         │                  │                   │
         ▼                  ▼                   ▼
   ai-agent-        backend-patterns     frontend-patterns
   patterns         backend-resilience-
                    patterns
```

---

## AI Agent Pattern Selection

```
Building an AI/LLM system?
         │
         ▼
┌────────────────────────────────────────────┐
│ How many specialized tasks are there?       │
└─────┬──────────────────────────────────────┘
      │
      ├── One task, high quality needed
      │       └── Reflection Pattern
      │
      ├── Multiple independent tasks
      │       └── Parallel Architecture
      │
      ├── Tasks depend on each other
      │       └── Sequential Architecture
      │
      ├── Same task needs iteration
      │       └── Loop Architecture
      │
      ├── Tasks need routing to specialists
      │       └── Router Architecture
      │
      └── Multiple tasks, one final output
              └── Aggregator Architecture

┌────────────────────────────────────────────┐
│ How should agents communicate?              │
└─────┬──────────────────────────────────────┘
      │
      ├── Central controller manages all
      │       └── Tool Calling Pattern
      │
      └── Agents hand off to each other
              └── Handoffs Pattern

┌────────────────────────────────────────────┐
│ Do agents need external resources?          │
└─────┬──────────────────────────────────────┘
      │
      ├── Yes, need APIs/databases
      │       └── Tool Use Pattern
      │
      └── Need complex multi-step planning
              └── Plan-and-Execute Pattern
```

---

## Backend Pattern Selection

```
Building a backend API?
         │
         ▼
┌────────────────────────────────────────────┐
│ What's your main concern?                   │
└─────┬──────────────────────────────────────┘
      │
      ├── Data access abstraction
      │       │
      │       └── Need to switch databases?
      │               ├── Yes → Repository Pattern
      │               └── Need business rules? → Service Layer
      │
      ├── Testability and loose coupling
      │       │
      │       └── Dependencies hard to mock?
      │               └── Dependency Injection
      │
      ├── Fault tolerance
      │       │
      │       ├── External service failures → Circuit Breaker
      │       ├── Transient failures → Retry with Backoff
      │       ├── Slow services → Timeout Pattern
      │       └── Resource isolation → Bulkhead Pattern
      │
      ├── Performance
      │       │
      │       ├── Slow reads → Caching (Cache-Aside)
      │       ├── Long operations → Background Jobs
      │       └── Heavy writes → Write-Through Cache
      │
      ├── Complex data flow
      │       │
      │       ├── Read/write separation → CQRS
      │       ├── Event history needed → Event Sourcing
      │       └── Distributed transactions → Saga Pattern
      │
      └── Production readiness
              │
              ├── Prevent abuse → Rate Limiting
              ├── System health → Health Checks
              ├── Safe retries → Idempotency
              └── Gradual rollout → Feature Flags
```

---

## Frontend Pattern Selection

```
Building a React/TypeScript app?
         │
         ▼
┌────────────────────────────────────────────┐
│ What's your main concern?                   │
└─────┬──────────────────────────────────────┘
      │
      ├── Component organization
      │       │
      │       ├── Separate logic from UI → Container/Presenter
      │       ├── Coordinated child components → Compound Components
      │       ├── Component enhancement → HOC
      │       └── Flexible rendering → Render Props
      │
      ├── Reusable logic
      │       │
      │       ├── Stateful logic → Custom Hooks
      │       ├── Data fetching → React Query / SWR
      │       └── Form handling → useForm hook
      │
      ├── State management
      │       │
      │       ├── Simple shared state → Context API
      │       ├── Complex state logic → useReducer
      │       ├── Global state → Zustand / Redux
      │       └── Server state → React Query
      │
      ├── Performance
      │       │
      │       ├── Prevent re-renders → React.memo
      │       ├── Expensive calculations → useMemo
      │       ├── Stable callbacks → useCallback
      │       └── Large lists → Virtual scrolling
      │
      └── TypeScript
              │
              ├── Flexible components → Generic Components
              ├── Union types → Discriminated Unions
              └── Type narrowing → Type Guards
```

---

## Gang of Four Pattern Selection

```
Need a classic design pattern?
         │
         ▼
┌────────────────────────────────────────────┐
│ What's your concern?                        │
└─────┬──────────────────────────────────────┘
      │
      ├── Object Creation
      │       │
      │       ├── Hide creation complexity → Factory
      │       ├── Step-by-step construction → Builder
      │       ├── Clone existing object → Prototype
      │       └── Single instance → Singleton
      │
      ├── Object Structure
      │       │
      │       ├── Interface incompatibility → Adapter
      │       ├── Add responsibilities → Decorator
      │       ├── Simplify complex system → Facade
      │       ├── Tree structures → Composite
      │       └── Separate abstraction from impl → Bridge
      │
      └── Object Behavior
              │
              ├── Algorithm variations → Strategy
              ├── Event notifications → Observer
              ├── Undo/redo operations → Command
              ├── Request chain → Chain of Responsibility
              ├── Algorithm skeleton → Template Method
              ├── State-based behavior → State
              └── Traverse collection → Iterator
```

---

## Quick Decision Matrix

| If you need... | Use this pattern | Skill |
|----------------|------------------|-------|
| Object creation abstraction | Factory | gof-patterns |
| Complex object construction | Builder | gof-patterns |
| Add behavior dynamically | Decorator | gof-patterns |
| Algorithm switching | Strategy | gof-patterns |
| Event notification | Observer | gof-patterns |
| Data access abstraction | Repository | backend-patterns |
| Business logic layer | Service Layer | backend-patterns |
| Testable dependencies | Dependency Injection | backend-patterns |
| Fault tolerance | Circuit Breaker | backend-resilience-patterns |
| Read/write optimization | CQRS | backend-resilience-patterns |
| Distributed transactions | Saga | backend-resilience-patterns |
| Logic/UI separation | Container/Presenter | frontend-patterns |
| Reusable stateful logic | Custom Hooks | frontend-patterns |
| Global state | Zustand/Context | frontend-patterns |
| Multi-agent orchestration | Router/Supervisor | ai-agent-patterns |
| Quality improvement | Reflection | ai-agent-patterns |
| External tool access | Tool Use | ai-agent-patterns |
