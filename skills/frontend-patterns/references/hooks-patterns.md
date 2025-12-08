# Advanced Hooks Patterns - Detailed Reference

Patterns for building reusable React hooks.

---

## Form Management Hook

Complete form hook with validation and submission:

```typescript
interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => Record<string, string>;
  onSubmit: (values: T) => void | Promise<void>;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());

  const handleChange = (name: keyof T) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as string];
        return next;
      });
    }
  };

  const handleBlur = (name: keyof T) => () => {
    setTouched((prev) => new Set(prev).add(name));

    // Validate single field on blur
    if (validate) {
      const allErrors = validate(values);
      if (allErrors[name as string]) {
        setErrors((prev) => ({
          ...prev,
          [name]: allErrors[name as string]
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched(new Set());
  };

  const setFieldValue = (name: keyof T, value: T[keyof T]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    isValid: Object.keys(errors).length === 0,
  };
}
```

---

## Data Fetching Hook

React Query-style hook with caching:

```typescript
interface UseApiOptions<T> {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

// Simple cache
const cache = new Map<string, { data: any; timestamp: number }>();

export function useApi<T>(options: UseApiOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = `${options.method || 'GET'}:${options.url}`;
  const cacheTime = options.cacheTime || 5 * 60 * 1000; // 5 minutes

  const refetch = useCallback(async () => {
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(options.url, {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);

      // Update cache
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options.url, options.method, options.body, cacheKey, cacheTime]);

  useEffect(() => {
    if (options.enabled !== false) {
      refetch();
    }
  }, [refetch, options.enabled]);

  return { data, loading, error, refetch };
}
```

---

## Local Storage Hook

Persist state to localStorage with type safety:

```typescript
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Get from storage or use initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Sync to storage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        setStoredValue(JSON.parse(e.newValue));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key]);

  return [storedValue, setValue] as const;
}
```

---

## Debounce Hook

Delay value updates:

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// With callback variant
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    }) as T,
    [callback, delay]
  );
}
```

---

## Window Event Hook

Subscribe to window events:

```typescript
export function useWindowEvent<K extends keyof WindowEventMap>(
  event: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener = (event: WindowEventMap[K]) => savedHandler.current(event);

    window.addEventListener(event, eventListener, options);
    return () => window.removeEventListener(event, eventListener, options);
  }, [event, options]);
}

// Usage
export const ScrollTracker = () => {
  const [scrollY, setScrollY] = useState(0);

  useWindowEvent("scroll", () => {
    setScrollY(window.scrollY);
  });

  return <div>Scroll position: {scrollY}px</div>;
};
```

---

## Media Query Hook

Responsive design with hooks:

```typescript
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// Preset hooks
export const useIsMobile = () => useMediaQuery("(max-width: 768px)");
export const useIsTablet = () => useMediaQuery("(min-width: 769px) and (max-width: 1024px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1025px)");
export const usePrefersDarkMode = () => useMediaQuery("(prefers-color-scheme: dark)");
```

---

## Previous Value Hook

Track previous state values:

```typescript
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// Usage: Detect changes
export const SkillsCounter = ({ count }: { count: number }) => {
  const prevCount = usePrevious(count);

  const trend = useMemo(() => {
    if (prevCount === undefined) return "neutral";
    return count > prevCount ? "up" : count < prevCount ? "down" : "neutral";
  }, [count, prevCount]);

  return (
    <div>
      Count: {count} ({trend})
    </div>
  );
};
```

---

## Intersection Observer Hook

Detect element visibility:

```typescript
interface UseIntersectionOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useIntersection(
  ref: React.RefObject<Element>,
  options: UseIntersectionOptions = {}
): IntersectionObserverEntry | null {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setEntry(entry),
      options
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options.root, options.rootMargin, options.threshold]);

  return entry;
}

// Usage: Lazy load images
export const LazyImage = ({ src, alt }: { src: string; alt: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const entry = useIntersection(ref, { threshold: 0.1 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (entry?.isIntersecting && !loaded) {
      setLoaded(true);
    }
  }, [entry, loaded]);

  return (
    <div ref={ref}>
      {loaded ? <img src={src} alt={alt} /> : <div className="skeleton" />}
    </div>
  );
};
```

---

## Composed Hook Pattern

Combine hooks for complex features:

```typescript
// High-level hook combining multiple low-level hooks
export function useSkillsSearch() {
  const [searchTerm, setSearchTerm] = useLocalStorage("skillsSearch", "");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data: results, loading, error, refetch } = useApi<Skill[]>({
    url: `/api/skills/search?q=${debouncedSearch}`,
    enabled: debouncedSearch.length > 0,
  });

  // Combine with keyboard shortcut
  useWindowEvent("keydown", (e) => {
    if (e.key === "Escape") {
      setSearchTerm("");
    }
  });

  return {
    searchTerm,
    setSearchTerm,
    results: results ?? [],
    loading,
    error,
    refetch,
    clear: () => setSearchTerm(""),
  };
}
```

---

## Hook Best Practices

| Practice | Example |
|----------|---------|
| Name with `use` prefix | `useForm`, `useApi` |
| Return object for >2 values | `{ data, loading, error }` |
| Return tuple for <3 values | `[value, setValue]` |
| Accept configuration objects | `useForm({ initialValues, validate })` |
| Provide stable references | `useCallback` for returned functions |
| Handle cleanup | Return cleanup function from `useEffect` |

