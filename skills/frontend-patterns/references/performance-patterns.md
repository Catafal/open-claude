# Performance Optimization Patterns - Detailed Reference

Techniques for optimizing React application performance.

---

## React.memo Deep Dive

Memoize components to prevent unnecessary re-renders:

```typescript
interface SkillCardProps {
  skill: Skill;
  onSelect: (skillId: string) => void;
  isSelected?: boolean;
}

// Basic memoization
export const SkillCard = React.memo<SkillCardProps>(({ skill, onSelect, isSelected }) => {
  console.log("SkillCard render:", skill.name);

  return (
    <div className={`skill-card ${isSelected ? 'selected' : ''}`}>
      <h3>{skill.name}</h3>
      <span>{skill.category}</span>
      <button onClick={() => onSelect(skill.id)}>Select</button>
    </div>
  );
});

// With custom comparison
export const SkillCardOptimized = React.memo<SkillCardProps>(
  ({ skill, onSelect, isSelected }) => (
    <div className={`skill-card ${isSelected ? 'selected' : ''}`}>
      <h3>{skill.name}</h3>
      <button onClick={() => onSelect(skill.id)}>Select</button>
    </div>
  ),
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return (
      prevProps.skill.id === nextProps.skill.id &&
      prevProps.skill.name === nextProps.skill.name &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.onSelect === nextProps.onSelect
    );
  }
);
```

**When to use React.memo:**
- Component renders often with same props
- Component is expensive to render
- Parent re-renders frequently
- Component is in a list

---

## useCallback Patterns

Create stable function references:

```typescript
export const SkillsManager = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // STABLE: Empty deps - function never changes
  const handleDelete = useCallback((skillId: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
  }, []);

  // STABLE: Uses functional update, no external deps
  const toggleSelection = useCallback((skillId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(skillId) ? next.delete(skillId) : next.add(skillId);
      return next;
    });
  }, []);

  // DEPENDS on selectedIds - but uses stable ref pattern
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const isSelected = useCallback((skillId: string) => {
    return selectedIdsRef.current.has(skillId);
  }, []);

  // Event handler with parameters
  const handleSkillAction = useCallback((skillId: string, action: "edit" | "delete") => {
    if (action === "delete") {
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    }
  }, []);

  return (
    <div>
      {skills.map((skill) => (
        <SkillCard
          key={skill.id}
          skill={skill}
          onDelete={handleDelete}
          onToggle={toggleSelection}
          isSelected={isSelected(skill.id)}
        />
      ))}
    </div>
  );
};
```

---

## useMemo Patterns

Cache expensive computations:

```typescript
export const SkillsAnalytics = ({ skills, filter }: { skills: Skill[]; filter: string }) => {
  // Filter skills (recompute when skills or filter change)
  const filteredSkills = useMemo(() => {
    console.log("Filtering skills...");
    return skills.filter((s) =>
      s.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [skills, filter]);

  // Statistics (recompute when filteredSkills change)
  const statistics = useMemo(() => {
    console.log("Computing statistics...");

    const byCategory = filteredSkills.reduce((acc, skill) => {
      acc[skill.category] = (acc[skill.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgProficiency =
      filteredSkills.reduce((sum, s) => sum + s.proficiency, 0) /
      (filteredSkills.length || 1);

    const topSkills = [...filteredSkills]
      .sort((a, b) => b.proficiency - a.proficiency)
      .slice(0, 5);

    return { byCategory, avgProficiency, topSkills, total: filteredSkills.length };
  }, [filteredSkills]);

  // Memoize child props
  const chartData = useMemo(
    () => Object.entries(statistics.byCategory).map(([name, value]) => ({ name, value })),
    [statistics.byCategory]
  );

  return (
    <div>
      <p>Total: {statistics.total}</p>
      <p>Average: {statistics.avgProficiency.toFixed(1)}%</p>
      <Chart data={chartData} />
    </div>
  );
};
```

---

## Lazy Loading Components

Code splitting for better initial load:

```typescript
// Route-based code splitting
const CareerPlanPage = lazy(() => import("./pages/CareerPlanPage"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const SkillsSelectionPage = lazy(() => import("./pages/SkillsSelectionPage"));

// Named exports require wrapper
const SkillsChart = lazy(() =>
  import("./components/Charts").then((module) => ({
    default: module.SkillsChart,
  }))
);

// With loading boundary
export const App = () => (
  <Router>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/skills" element={<SkillsSelectionPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/plan" element={<CareerPlanPage />} />
      </Routes>
    </Suspense>
  </Router>
);

// Conditional lazy loading
export const SkillsPage = () => {
  const [showChart, setShowChart] = useState(false);

  // Only load chart when needed
  const AdvancedChart = useMemo(
    () => lazy(() => import("./AdvancedChart")),
    []
  );

  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>

      {showChart && (
        <Suspense fallback={<ChartSkeleton />}>
          <AdvancedChart />
        </Suspense>
      )}
    </div>
  );
};
```

---

## Virtual List for Large Data

Only render visible items:

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function VirtualList<T>({ items, itemHeight, renderItem }: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5, // Extra items to render above/below
  });

  return (
    <div
      ref={parentRef}
      style={{ height: "100%", overflow: "auto" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Usage
export const SkillsList = ({ skills }: { skills: Skill[] }) => (
  <VirtualList
    items={skills}
    itemHeight={60}
    renderItem={(skill) => <SkillCard skill={skill} />}
  />
);
```

---

## Debouncing and Throttling

Control update frequency:

```typescript
// Debounced search input
export const SkillsSearch = () => {
  const [inputValue, setInputValue] = useState("");
  const debouncedValue = useDebounce(inputValue, 300);

  const { data: results, loading } = useApi<Skill[]>({
    url: `/api/skills/search?q=${debouncedValue}`,
    enabled: debouncedValue.length > 2,
  });

  return (
    <div>
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Search skills..."
      />
      {loading && <Spinner />}
      {results?.map((skill) => (
        <SkillCard key={skill.id} skill={skill} />
      ))}
    </div>
  );
};

// Throttle hook for scroll/resize
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();

    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}
```

---

## Image Optimization

Lazy load and optimize images:

```typescript
// Intersection Observer for lazy images
export const LazyImage = ({
  src,
  alt,
  placeholder,
}: {
  src: string;
  alt: string;
  placeholder?: string;
}) => {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" } // Load 100px before visible
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="lazy-image-container">
      {!loaded && placeholder && (
        <img src={placeholder} alt="" className="placeholder" />
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={loaded ? "loaded" : "loading"}
        />
      )}
    </div>
  );
};

// Responsive images
export const ResponsiveImage = ({ src, alt }: { src: string; alt: string }) => (
  <picture>
    <source
      media="(max-width: 768px)"
      srcSet={`${src}?w=400 1x, ${src}?w=800 2x`}
    />
    <source
      media="(min-width: 769px)"
      srcSet={`${src}?w=800 1x, ${src}?w=1600 2x`}
    />
    <img src={src} alt={alt} loading="lazy" />
  </picture>
);
```

---

## State Updates Batching

Group state updates efficiently:

```typescript
// React 18 auto-batches, but for complex scenarios:
export const BatchedUpdates = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // All these updates are batched in React 18
  const handleFetch = async () => {
    setLoading(true);

    const data = await fetchData();

    // These are batched into single render
    setItems(data.items);
    setTotal(data.total);
    setLoading(false);
  };

  // For pre-React 18 or external events
  const handleExternalEvent = () => {
    // Use flushSync sparingly for immediate updates
    import("react-dom").then(({ flushSync }) => {
      flushSync(() => {
        setLoading(true);
      });
      // Loading spinner visible immediately
    });
  };

  return null;
};
```

---

## Performance Checklist

| Issue | Solution |
|-------|----------|
| Slow list rendering | Virtual list |
| Large bundle size | Code splitting + lazy loading |
| Frequent re-renders | React.memo + useCallback |
| Expensive calculations | useMemo |
| Slow input response | Debouncing |
| Large images | Lazy loading + responsive |
| Memory leaks | Cleanup in useEffect |

---

## Profiling Tips

```typescript
// React DevTools Profiler
// 1. Open React DevTools
// 2. Go to Profiler tab
// 3. Click Record
// 4. Interact with app
// 5. Stop recording
// 6. Analyze flame graph

// why-did-you-render for debugging
if (process.env.NODE_ENV === "development") {
  const whyDidYouRender = require("@welldone-software/why-did-you-render");
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}

// Mark component for tracking
SkillCard.whyDidYouRender = true;
```

