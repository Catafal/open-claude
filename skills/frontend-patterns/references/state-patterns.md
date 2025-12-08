# State Management Patterns - Detailed Reference

Patterns for managing state in React applications.

---

## Context API with Selectors

Optimize Context to prevent unnecessary re-renders:

```typescript
// Split context into separate providers for state and actions
interface UserState {
  user: User | null;
  isLoading: boolean;
}

interface UserActions {
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const UserStateContext = createContext<UserState | null>(null);
const UserActionsContext = createContext<UserActions | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Actions are stable (useCallback)
  const actions = useMemo<UserActions>(() => ({
    login: async (credentials) => {
      setIsLoading(true);
      try {
        const response = await api.login(credentials);
        setUser(response.user);
      } finally {
        setIsLoading(false);
      }
    },
    logout: () => {
      setUser(null);
      localStorage.removeItem("token");
    },
    updateProfile: async (data) => {
      const updated = await api.updateProfile(data);
      setUser(updated);
    },
  }), []);

  const state = useMemo(() => ({ user, isLoading }), [user, isLoading]);

  return (
    <UserActionsContext.Provider value={actions}>
      <UserStateContext.Provider value={state}>
        {children}
      </UserStateContext.Provider>
    </UserActionsContext.Provider>
  );
};

// Separate hooks for state and actions
export function useUserState() {
  const context = useContext(UserStateContext);
  if (!context) throw new Error("useUserState must be used within UserProvider");
  return context;
}

export function useUserActions() {
  const context = useContext(UserActionsContext);
  if (!context) throw new Error("useUserActions must be used within UserProvider");
  return context;
}

// Components can subscribe to just what they need
export const LogoutButton = () => {
  const { logout } = useUserActions(); // Won't re-render on user changes
  return <button onClick={logout}>Logout</button>;
};

export const UserName = () => {
  const { user } = useUserState(); // Only re-renders when user changes
  return <span>{user?.name}</span>;
};
```

---

## Atomic State Pattern

Break state into independent atoms:

```typescript
// Atom factory
function createAtom<T>(initialValue: T) {
  let value = initialValue;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set: (newValue: T | ((prev: T) => T)) => {
      const nextValue = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(value)
        : newValue;
      if (nextValue !== value) {
        value = nextValue;
        listeners.forEach((listener) => listener());
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Create atoms
export const selectedSkillsAtom = createAtom<Set<string>>(new Set());
export const filterAtom = createAtom<string>("");
export const sortByAtom = createAtom<"name" | "category">("name");

// Hook to use atom
function useAtom<T>(atom: ReturnType<typeof createAtom<T>>) {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    return atom.subscribe(forceUpdate);
  }, [atom]);

  return [atom.get(), atom.set] as const;
}

// Derived atoms
function createDerivedAtom<T, R>(
  sourceAtom: ReturnType<typeof createAtom<T>>,
  selector: (value: T) => R
) {
  return {
    get: () => selector(sourceAtom.get()),
    subscribe: sourceAtom.subscribe,
  };
}

// Derived: count of selected skills
export const selectedCountAtom = createDerivedAtom(
  selectedSkillsAtom,
  (set) => set.size
);

// Usage
export const SelectedCount = () => {
  const count = useAtom(selectedCountAtom)[0];
  return <span>{count} selected</span>;
};
```

---

## Zustand-Style Store

Simple, scalable state management:

```typescript
type Listener<T> = (state: T, prevState: T) => void;

function createStore<T extends object>(
  initializer: (set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void) => T
) {
  let state: T;
  const listeners = new Set<Listener<T>>();

  const set = (partial: Partial<T> | ((state: T) => Partial<T>)) => {
    const nextPartial = typeof partial === "function" ? partial(state) : partial;
    const nextState = { ...state, ...nextPartial };
    const prevState = state;
    state = nextState;
    listeners.forEach((listener) => listener(state, prevState));
  };

  state = initializer(set);

  return {
    getState: () => state,
    subscribe: (listener: Listener<T>) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Selector-based subscription
    useStore: <R>(selector: (state: T) => R): R => {
      const [, forceUpdate] = useReducer((x) => x + 1, 0);
      const selectorRef = useRef(selector);
      const selectedRef = useRef(selector(state));

      useEffect(() => {
        selectorRef.current = selector;
      });

      useEffect(() => {
        const listener: Listener<T> = (newState) => {
          const newSelected = selectorRef.current(newState);
          if (newSelected !== selectedRef.current) {
            selectedRef.current = newSelected;
            forceUpdate();
          }
        };
        return listeners.subscribe(listener);
      }, []);

      return selector(state);
    },
  };
}

// Create store with actions
interface SkillsState {
  skills: Skill[];
  selectedIds: Set<string>;
  filter: string;
  setSkills: (skills: Skill[]) => void;
  toggleSkill: (id: string) => void;
  setFilter: (filter: string) => void;
}

export const skillsStore = createStore<SkillsState>((set) => ({
  skills: [],
  selectedIds: new Set(),
  filter: "",

  setSkills: (skills) => set({ skills }),

  toggleSkill: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { selectedIds: next };
  }),

  setFilter: (filter) => set({ filter }),
}));

// Usage with selectors
export const SkillsList = () => {
  const skills = skillsStore.useStore((s) => s.skills);
  const toggleSkill = skillsStore.useStore((s) => s.toggleSkill);

  return (
    <ul>
      {skills.map((skill) => (
        <li key={skill.id} onClick={() => toggleSkill(skill.id)}>
          {skill.name}
        </li>
      ))}
    </ul>
  );
};
```

---

## useReducer for Complex State

Centralized state logic with actions:

```typescript
// State type
interface SkillsState {
  skills: Skill[];
  selectedIds: Set<string>;
  filter: string;
  sortBy: "name" | "category";
  isLoading: boolean;
  error: Error | null;
}

// Action types
type SkillsAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; skills: Skill[] }
  | { type: "FETCH_ERROR"; error: Error }
  | { type: "TOGGLE_SKILL"; id: string }
  | { type: "SELECT_ALL" }
  | { type: "CLEAR_ALL" }
  | { type: "SET_FILTER"; filter: string }
  | { type: "SET_SORT"; sortBy: "name" | "category" };

// Reducer
function skillsReducer(state: SkillsState, action: SkillsAction): SkillsState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };

    case "FETCH_SUCCESS":
      return { ...state, isLoading: false, skills: action.skills };

    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: action.error };

    case "TOGGLE_SKILL": {
      const next = new Set(state.selectedIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, selectedIds: next };
    }

    case "SELECT_ALL":
      return { ...state, selectedIds: new Set(state.skills.map((s) => s.id)) };

    case "CLEAR_ALL":
      return { ...state, selectedIds: new Set() };

    case "SET_FILTER":
      return { ...state, filter: action.filter };

    case "SET_SORT":
      return { ...state, sortBy: action.sortBy };

    default:
      return state;
  }
}

// Initial state
const initialState: SkillsState = {
  skills: [],
  selectedIds: new Set(),
  filter: "",
  sortBy: "name",
  isLoading: false,
  error: null,
};

// Custom hook wrapping useReducer
export function useSkillsManager() {
  const [state, dispatch] = useReducer(skillsReducer, initialState);

  // Async action creators
  const fetchSkills = async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const skills = await api.getSkills();
      dispatch({ type: "FETCH_SUCCESS", skills });
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", error: error as Error });
    }
  };

  // Derived state
  const filteredSkills = useMemo(() => {
    let result = state.skills.filter((s) =>
      s.name.toLowerCase().includes(state.filter.toLowerCase())
    );

    result.sort((a, b) => {
      if (state.sortBy === "name") return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    });

    return result;
  }, [state.skills, state.filter, state.sortBy]);

  return {
    ...state,
    filteredSkills,
    fetchSkills,
    toggleSkill: (id: string) => dispatch({ type: "TOGGLE_SKILL", id }),
    selectAll: () => dispatch({ type: "SELECT_ALL" }),
    clearAll: () => dispatch({ type: "CLEAR_ALL" }),
    setFilter: (filter: string) => dispatch({ type: "SET_FILTER", filter }),
    setSortBy: (sortBy: "name" | "category") => dispatch({ type: "SET_SORT", sortBy }),
  };
}
```

---

## State Machine Pattern

Explicit state transitions:

```typescript
type SkillsFlowState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "selecting"; skills: Skill[] }
  | { status: "confirming"; selected: Skill[] }
  | { status: "complete"; result: AssessmentResult }
  | { status: "error"; error: Error };

type SkillsFlowEvent =
  | { type: "LOAD" }
  | { type: "LOAD_SUCCESS"; skills: Skill[] }
  | { type: "LOAD_ERROR"; error: Error }
  | { type: "SELECT"; skill: Skill }
  | { type: "CONFIRM" }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCESS"; result: AssessmentResult }
  | { type: "RESET" };

function skillsFlowMachine(
  state: SkillsFlowState,
  event: SkillsFlowEvent
): SkillsFlowState {
  switch (state.status) {
    case "idle":
      if (event.type === "LOAD") return { status: "loading" };
      return state;

    case "loading":
      if (event.type === "LOAD_SUCCESS") {
        return { status: "selecting", skills: event.skills };
      }
      if (event.type === "LOAD_ERROR") {
        return { status: "error", error: event.error };
      }
      return state;

    case "selecting":
      if (event.type === "CONFIRM") {
        const selected = state.skills.filter((s) => s.selected);
        return { status: "confirming", selected };
      }
      return state;

    case "confirming":
      if (event.type === "SUBMIT_SUCCESS") {
        return { status: "complete", result: event.result };
      }
      return state;

    case "error":
      if (event.type === "RESET") return { status: "idle" };
      return state;

    default:
      return state;
  }
}

// Hook using state machine
export function useSkillsFlow() {
  const [state, dispatch] = useReducer(skillsFlowMachine, { status: "idle" });

  const load = async () => {
    dispatch({ type: "LOAD" });
    try {
      const skills = await api.getSkills();
      dispatch({ type: "LOAD_SUCCESS", skills });
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", error: error as Error });
    }
  };

  return {
    state,
    load,
    confirm: () => dispatch({ type: "CONFIRM" }),
    reset: () => dispatch({ type: "RESET" }),
  };
}
```

---

## State Synchronization

Sync state between components without prop drilling:

```typescript
// Event emitter for cross-component communication
type EventCallback<T> = (data: T) => void;

class EventBus<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<EventCallback<any>>>();

  on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

// Typed events
interface SkillEvents {
  skillSelected: { skillId: string };
  filterChanged: { filter: string };
  selectionCleared: void;
}

export const skillEvents = new EventBus<SkillEvents>();

// Hook to subscribe to events
export function useSkillEvent<K extends keyof SkillEvents>(
  event: K,
  callback: EventCallback<SkillEvents[K]>
) {
  useEffect(() => {
    return skillEvents.on(event, callback);
  }, [event, callback]);
}
```

---

## When to Use Each Pattern

| Scenario | Recommended Pattern |
|----------|---------------------|
| Simple component state | `useState` |
| Complex related state | `useReducer` |
| Global app state | Context API |
| High-frequency updates | Atomic state |
| Large state trees | Zustand-style store |
| Strict state transitions | State machine |
| Cross-component sync | Event bus |

