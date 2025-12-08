# Frontend Anti-Patterns

Common mistakes in React and TypeScript applications.

---

## Creating New Objects in Render

**Description**: Creating new objects/arrays on every render causes unnecessary child re-renders.

**Problems**:
- React.memo becomes ineffective
- Wasted renders
- Poor performance with large lists

```typescript
// ANTI-PATTERN
export const SkillsList = () => {
  const [filter, setFilter] = useState("");

  return (
    <SkillCard
      // New object every render!
      style={{ color: "blue", padding: 10 }}
      // New array every render!
      categories={["tech", "soft"]}
      // New function every render!
      onClick={() => console.log("clicked")}
    />
  );
};

// CORRECT
const cardStyle = { color: "blue", padding: 10 };
const defaultCategories = ["tech", "soft"];

export const SkillsList = () => {
  const [filter, setFilter] = useState("");

  const handleClick = useCallback(() => {
    console.log("clicked");
  }, []);

  return (
    <SkillCard
      style={cardStyle}
      categories={defaultCategories}
      onClick={handleClick}
    />
  );
};
```

---

## Overusing useEffect

**Description**: Using useEffect for derived state or synchronous computations.

**Problems**:
- Extra render cycles
- Complex dependency management
- Race conditions

```typescript
// ANTI-PATTERN - Derived state in useEffect
export const SkillsStats = ({ skills }: { skills: Skill[] }) => {
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);

  // BAD: Unnecessary effect for derived state
  useEffect(() => {
    const filtered = skills.filter((s) => s.active);
    setFilteredSkills(filtered);
    setTotal(filtered.length);
  }, [skills]);

  return <div>{total} active skills</div>;
};

// CORRECT - Use useMemo
export const SkillsStats = ({ skills }: { skills: Skill[] }) => {
  const filteredSkills = useMemo(
    () => skills.filter((s) => s.active),
    [skills]
  );

  const total = filteredSkills.length;

  return <div>{total} active skills</div>;
};
```

---

## Missing Dependency Array Items

**Description**: Omitting dependencies from useEffect/useCallback/useMemo.

**Problems**:
- Stale closures
- Bugs that are hard to track
- Inconsistent behavior

```typescript
// ANTI-PATTERN - Missing dependency
export const SkillSearch = ({ onSearch }: { onSearch: (term: string) => void }) => {
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(term); // onSearch not in deps!
    }, 300);
    return () => clearTimeout(timer);
  }, [term]); // Missing onSearch

  return <input value={term} onChange={(e) => setTerm(e.target.value)} />;
};

// CORRECT
export const SkillSearch = ({ onSearch }: { onSearch: (term: string) => void }) => {
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(term);
    }, 300);
    return () => clearTimeout(timer);
  }, [term, onSearch]); // All dependencies included

  return <input value={term} onChange={(e) => setTerm(e.target.value)} />;
};
```

---

## Prop Drilling

**Description**: Passing props through many component layers.

**Problems**:
- Hard to maintain
- Components tightly coupled
- Difficult refactoring

```typescript
// ANTI-PATTERN
export const App = () => {
  const [user, setUser] = useState<User | null>(null);

  return (
    <Layout user={user}>
      <Sidebar user={user}>
        <Navigation user={user}>
          <UserMenu user={user} onLogout={() => setUser(null)} />
        </Navigation>
      </Sidebar>
    </Layout>
  );
};

// CORRECT - Use Context
const UserContext = createContext<{
  user: User | null;
  logout: () => void;
} | null>(null);

export const App = () => {
  const [user, setUser] = useState<User | null>(null);

  return (
    <UserContext.Provider value={{ user, logout: () => setUser(null) }}>
      <Layout>
        <Sidebar>
          <Navigation>
            <UserMenu />
          </Navigation>
        </Sidebar>
      </Layout>
    </UserContext.Provider>
  );
};

export const UserMenu = () => {
  const { user, logout } = useContext(UserContext)!;
  return <button onClick={logout}>{user?.name}</button>;
};
```

---

## Mutating State Directly

**Description**: Modifying state objects/arrays directly instead of creating new ones.

**Problems**:
- React doesn't detect changes
- UI doesn't update
- Unpredictable behavior

```typescript
// ANTI-PATTERN
export const SkillsEditor = () => {
  const [skills, setSkills] = useState<Skill[]>([]);

  const updateSkill = (id: string, name: string) => {
    const skill = skills.find((s) => s.id === id);
    skill!.name = name; // Direct mutation!
    setSkills(skills); // Same reference, no re-render!
  };

  const addSkill = (skill: Skill) => {
    skills.push(skill); // Direct mutation!
    setSkills(skills);
  };

  return null;
};

// CORRECT
export const SkillsEditor = () => {
  const [skills, setSkills] = useState<Skill[]>([]);

  const updateSkill = (id: string, name: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  };

  const addSkill = (skill: Skill) => {
    setSkills((prev) => [...prev, skill]);
  };

  return null;
};
```

---

## Index as Key

**Description**: Using array index as key in lists that can reorder.

**Problems**:
- Wrong elements updated on reorder
- State attached to wrong items
- Animation glitches

```typescript
// ANTI-PATTERN
export const SkillsList = ({ skills }: { skills: Skill[] }) => (
  <ul>
    {skills.map((skill, index) => (
      <SkillItem key={index} skill={skill} /> // BAD: index as key
    ))}
  </ul>
);

// CORRECT
export const SkillsList = ({ skills }: { skills: Skill[] }) => (
  <ul>
    {skills.map((skill) => (
      <SkillItem key={skill.id} skill={skill} /> // GOOD: unique ID
    ))}
  </ul>
);

// If no ID exists, create stable keys
export const SkillsList = ({ skills }: { skills: string[] }) => {
  const itemsWithKeys = useMemo(
    () => skills.map((skill, i) => ({ skill, key: `${skill}-${i}` })),
    [skills]
  );

  return (
    <ul>
      {itemsWithKeys.map(({ skill, key }) => (
        <li key={key}>{skill}</li>
      ))}
    </ul>
  );
};
```

---

## Unnecessary State

**Description**: Storing in state what can be computed from existing state/props.

**Problems**:
- State synchronization bugs
- Extra renders
- More code to maintain

```typescript
// ANTI-PATTERN
export const SkillsCounter = ({ skills }: { skills: Skill[] }) => {
  const [total, setTotal] = useState(skills.length);
  const [active, setActive] = useState(skills.filter((s) => s.active).length);

  // Need to sync whenever skills change
  useEffect(() => {
    setTotal(skills.length);
    setActive(skills.filter((s) => s.active).length);
  }, [skills]);

  return (
    <div>
      {active} of {total} active
    </div>
  );
};

// CORRECT - Derive from props
export const SkillsCounter = ({ skills }: { skills: Skill[] }) => {
  const total = skills.length;
  const active = skills.filter((s) => s.active).length;

  return (
    <div>
      {active} of {total} active
    </div>
  );
};
```

---

## Forgetting Cleanup

**Description**: Not cleaning up subscriptions, timers, or event listeners.

**Problems**:
- Memory leaks
- State updates on unmounted components
- Console warnings

```typescript
// ANTI-PATTERN
export const SkillsPoller = () => {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    // No cleanup!
    const interval = setInterval(async () => {
      const data = await fetchSkills();
      setSkills(data); // May run after unmount
    }, 5000);
  }, []);

  return null;
};

// CORRECT
export const SkillsPoller = () => {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    let mounted = true;

    const interval = setInterval(async () => {
      const data = await fetchSkills();
      if (mounted) {
        setSkills(data);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return null;
};
```

---

## Over-Optimization

**Description**: Using useMemo/useCallback everywhere without need.

**Problems**:
- Code complexity
- Memory overhead
- Harder to read

```typescript
// ANTI-PATTERN - Unnecessary memoization
export const SkillsPage = () => {
  // Overkill for simple values
  const title = useMemo(() => "My Skills", []);
  const styles = useMemo(() => ({ padding: 10 }), []);

  // Unnecessary for cheap operations
  const total = useMemo(() => 2 + 2, []);

  // Not passed to memoized child
  const handleClick = useCallback(() => {
    console.log("clicked");
  }, []);

  return <div onClick={handleClick}>{title}</div>;
};

// CORRECT - Only memoize when needed
export const SkillsPage = () => {
  const title = "My Skills";
  const styles = { padding: 10 };
  const total = 2 + 2;

  const handleClick = () => console.log("clicked");

  return <div onClick={handleClick}>{title}</div>;
};
```

---

## any Type Abuse

**Description**: Using `any` type to bypass TypeScript checks.

**Problems**:
- Lost type safety
- Runtime errors
- Hard to refactor

```typescript
// ANTI-PATTERN
export const SkillCard = ({ skill }: { skill: any }) => {
  return (
    <div>
      <h3>{skill.name}</h3>
      <p>{skill.descripton}</p> {/* Typo not caught */}
    </div>
  );
};

// CORRECT
interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const SkillCard = ({ skill }: { skill: Skill }) => {
  return (
    <div>
      <h3>{skill.name}</h3>
      <p>{skill.description}</p> {/* Typo would be caught */}
    </div>
  );
};
```

---

## Detection Checklist

| Code Smell | Likely Problem |
|------------|----------------|
| Inline objects in JSX | Creating new objects in render |
| useEffect setting derived state | Overusing useEffect |
| ESLint exhaustive-deps warnings | Missing dependencies |
| Props passed through 3+ levels | Prop drilling |
| `skills.push()` or direct assignment | Mutating state |
| `key={index}` in dynamic lists | Index as key |
| `useState` + `useEffect` for derived values | Unnecessary state |
| No return in useEffect | Forgetting cleanup |
| useMemo for constants | Over-optimization |
| `: any` type annotations | any type abuse |

---

## Quick Fixes

1. **Move static objects outside component** - Constants don't need re-creation
2. **Replace derived useEffect with useMemo** - Avoid extra renders
3. **Add missing dependencies** - Use ESLint plugin
4. **Use Context for global state** - Avoid prop drilling
5. **Always create new objects/arrays** - `[...arr]`, `{...obj}`
6. **Use unique IDs as keys** - Not array indexes
7. **Compute, don't store** - Derive values from existing state
8. **Always return cleanup** - Clear timers, unsubscribe
9. **Memoize only expensive operations** - Profile first
10. **Define proper types** - Avoid `any`

