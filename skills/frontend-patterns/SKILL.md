---
name: frontend-patterns
description: React 19 and TypeScript patterns for building modern frontend applications. Use when building components, managing state, or optimizing performance. Triggers on React patterns, hooks, useState, useReducer, Context API, compound components, React.memo, useMemo, useCallback, error boundaries, TypeScript React, component architecture, state management.
---

# Frontend Design Patterns

Patterns for building modern React applications with TypeScript.

## Overview

**Core Pattern Categories**:

| Category | Key Patterns |
|----------|--------------|
| **Component Architecture** | Container/Presenter, Compound Components |
| **Hooks** | Custom Hooks, Composition, useReducer |
| **State Management** | Context API, Atomic State, Store Pattern |
| **TypeScript** | Discriminated Unions, Generic Components |
| **Performance** | React.memo, useMemo, useCallback, Lazy Loading |
| **Error Handling** | Error Boundaries, Async Errors |

---

## Component Architecture Patterns

### Container/Presentational Pattern

**Purpose**: Separate data logic from UI rendering

```typescript
// Presentational Component (UI only)
interface SkillCardProps {
  skill: { name: string; category: string; proficiency: number };
  onSelect: (skillId: string) => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({ skill, onSelect }) => (
  <div className="skill-card">
    <h3>{skill.name}</h3>
    <span className="category">{skill.category}</span>
    <button onClick={() => onSelect(skill.name)}>Select</button>
  </div>
);

// Container Component (handles logic)
export const SkillCardContainer: React.FC<{ skillId: string }> = ({ skillId }) => {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSkill(skillId).then(setSkill).finally(() => setLoading(false));
  }, [skillId]);

  const handleSelect = (skillId: string) => {
    addToSelectedSkills(skillId);
    trackSkillSelection(skillId);
  };

  if (loading) return <Skeleton />;
  if (!skill) return <ErrorState />;

  return <SkillCard skill={skill} onSelect={handleSelect} />;
};
```

---

### Compound Components Pattern

**Purpose**: Parent manages state, children work together

```typescript
const SkillSelectionContext = createContext<{
  selectedSkills: Set<string>;
  toggleSkill: (id: string) => void;
  isSelected: (id: string) => boolean;
} | null>(null);

// Parent component
export const SkillSelection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      next.has(skillId) ? next.delete(skillId) : next.add(skillId);
      return next;
    });
  };

  return (
    <SkillSelectionContext.Provider value={{
      selectedSkills,
      toggleSkill,
      isSelected: (id) => selectedSkills.has(id)
    }}>
      {children}
    </SkillSelectionContext.Provider>
  );
};

// Child component
const SkillItem: React.FC<{ skillId: string; name: string }> = ({ skillId, name }) => {
  const ctx = useContext(SkillSelectionContext);
  if (!ctx) throw new Error("SkillItem must be within SkillSelection");

  return (
    <button
      className={ctx.isSelected(skillId) ? 'selected' : ''}
      onClick={() => ctx.toggleSkill(skillId)}
    >
      {name}
    </button>
  );
};

// Usage
<SkillSelection>
  <SkillItem skillId="python" name="Python" />
  <SkillItem skillId="javascript" name="JavaScript" />
</SkillSelection>
```

---

## React Hooks Patterns

### Custom Hooks for Reusable Logic

```typescript
// Form management hook
export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
}: {
  initialValues: T;
  validate?: (values: T) => Record<string, string>;
  onSubmit: (values: T) => void | Promise<void>;
}) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (name: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [name]: e.target.value }));
    if (errors[name as string]) {
      setErrors((prev) => { const next = {...prev}; delete next[name as string]; return next; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }
    setIsSubmitting(true);
    try { await onSubmit(values); } finally { setIsSubmitting(false); }
  };

  return { values, errors, isSubmitting, handleChange, handleSubmit };
}
```

### Hooks Composition

```typescript
// Compose multiple low-level hooks
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Higher-level hook combining both
export function useSkillsSearch() {
  const [searchTerm, setSearchTerm] = useLocalStorage("skillsSearch", "");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data: results, loading } = useApi<Skill[]>({
    url: `/api/skills/search?q=${debouncedSearch}`,
    enabled: debouncedSearch.length > 0,
  });

  return { searchTerm, setSearchTerm, results, loading };
}
```

### useReducer for Complex State

```typescript
type Action =
  | { type: "TOGGLE_SKILL"; skillId: string }
  | { type: "SELECT_ALL" }
  | { type: "CLEAR_ALL" }
  | { type: "SET_FILTER"; filter: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "TOGGLE_SKILL": {
      const next = new Set(state.selectedIds);
      next.has(action.skillId) ? next.delete(action.skillId) : next.add(action.skillId);
      return { ...state, selectedIds: next };
    }
    case "SELECT_ALL":
      return { ...state, selectedIds: new Set(state.skills.map(s => s.id)) };
    case "CLEAR_ALL":
      return { ...state, selectedIds: new Set() };
    case "SET_FILTER":
      return { ...state, filter: action.filter };
    default:
      return state;
  }
}

export function useSkillSelection(skills: Skill[]) {
  const [state, dispatch] = useReducer(reducer, {
    skills,
    selectedIds: new Set<string>(),
    filter: "",
  });

  return {
    toggleSkill: (id: string) => dispatch({ type: "TOGGLE_SKILL", skillId: id }),
    selectAll: () => dispatch({ type: "SELECT_ALL" }),
    clearAll: () => dispatch({ type: "CLEAR_ALL" }),
    setFilter: (filter: string) => dispatch({ type: "SET_FILTER", filter }),
    ...state,
  };
}
```

---

## State Management Patterns

### Context API Pattern

```typescript
interface UserContextValue {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (credentials: Credentials) => {
    const response = await api.login(credentials);
    setUser(response.user);
    localStorage.setItem("token", response.token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook with validation
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
```

---

## TypeScript Patterns

### Discriminated Unions for State

```typescript
type ApiState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

export const SkillsList = () => {
  const { state } = useApiState<Skill[]>(() => api.getSkills());

  switch (state.status) {
    case "idle":
      return <button onClick={fetch}>Load Skills</button>;
    case "loading":
      return <Spinner />;
    case "success":
      return <ul>{state.data.map(s => <li key={s.id}>{s.name}</li>)}</ul>;
    case "error":
      return <ErrorState error={state.error} />;
  }
};
```

### Generic Component Props

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export function List<T>({ items, renderItem, keyExtractor, emptyMessage = "No items" }: ListProps<T>) {
  if (items.length === 0) return <div className="empty">{emptyMessage}</div>;

  return <ul>{items.map(item => <li key={keyExtractor(item)}>{renderItem(item)}</li>)}</ul>;
}

// Type-safe usage
<List
  items={skills}
  keyExtractor={(skill) => skill.id}
  renderItem={(skill) => <div>{skill.name}</div>}
/>
```

---

## Performance Optimization

### React.memo and useCallback

```typescript
// Memoize component
export const SkillCard = React.memo<SkillCardProps>(({ skill, onSelect }) => (
  <div className="skill-card">
    <h3>{skill.name}</h3>
    <button onClick={() => onSelect(skill.id)}>Select</button>
  </div>
));

// Stable callback reference
export const SkillsList = () => {
  const [skills] = useState<Skill[]>([]);

  // Stable reference prevents SkillCard re-renders
  const handleSelect = useCallback((skillId: string) => {
    console.log("Selected:", skillId);
  }, []);

  return (
    <div>
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} onSelect={handleSelect} />
      ))}
    </div>
  );
};
```

### useMemo for Expensive Calculations

```typescript
export const SkillsStatistics = ({ skills }: { skills: Skill[] }) => {
  const statistics = useMemo(() => {
    const byCategory = skills.reduce((acc, skill) => {
      acc[skill.category] = (acc[skill.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgProficiency = skills.reduce((sum, s) => sum + s.proficiency, 0) / skills.length;

    return { total: skills.length, byCategory, avgProficiency };
  }, [skills]); // Only recompute when skills change

  return <div>Total: {statistics.total}, Avg: {statistics.avgProficiency.toFixed(1)}%</div>;
};
```

### Lazy Loading

```typescript
const CareerPlanPage = lazy(() => import("./pages/CareerPlanPage"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));

export const App = () => (
  <Router>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/plan" element={<CareerPlanPage />} />
      </Routes>
    </Suspense>
  </Router>
);
```

---

## Error Handling

### Error Boundaries

```typescript
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## Quick Reference

| Need | Pattern |
|------|---------|
| Separate logic from UI | Container/Presenter |
| Coordinated components | Compound Components |
| Reusable logic | Custom Hooks |
| Complex state updates | useReducer |
| Global state | Context API |
| Type-safe state | Discriminated Unions |
| Prevent re-renders | React.memo + useCallback |
| Cache computations | useMemo |
| Code splitting | React.lazy + Suspense |
| Catch errors | Error Boundaries |

---

## See Also

### In This Skill
- [hooks-patterns.md](references/hooks-patterns.md) - Advanced custom hooks
- [state-patterns.md](references/state-patterns.md) - State management details
- [performance-patterns.md](references/performance-patterns.md) - Optimization techniques
- [anti-patterns.md](references/anti-patterns.md) - Common frontend mistakes

### Related Skills
- **gof-patterns**: Strategy for component selection
- **backend-patterns**: API integration patterns
