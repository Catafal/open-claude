# Prompt Base & Prompting Agent - Implementation Plan

## Problem Statement
User needs a system to:
1. Store and quickly access pre-made prompts ("ASAP prompts")
2. Improve/optimize prompts for better model performance

## First Principles Analysis

### Fundamental Truths
1. A prompt is structured text with patterns (role, task, constraints, examples)
2. Good prompts share common traits: clarity, specificity, structure
3. Speed is critical - selection must be <1 second
4. Prompts evolve - need versioning and improvement tracking
5. Different use cases need different prompts (coding, writing, analysis)

### Hidden Constraints (from codebase analysis)
1. Supabase already integrated → reuse pattern
2. Electron-store for local caching → fast offline access
3. Ollama already set up → use for improvement agent
4. UI patterns defined → follow existing settings structure
5. Main chat has input box → integration point for insertion

---

## Architecture

### Component 1: Prompt Base (Storage Layer)

**Supabase Table: `prompts`**
```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'coding', 'writing', 'analysis', 'research', 'creative', 'custom'
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- [{name: 'language', default: 'Python'}]
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES prompts(id), -- for version tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompts_user ON prompts(user_id);
CREATE INDEX idx_prompts_category ON prompts(category);
CREATE INDEX idx_prompts_favorite ON prompts(is_favorite);
```

**Local Cache (electron-store)**
```typescript
interface LocalPromptCache {
  prompts: Prompt[];
  lastSync: number;
}
```

### Component 2: Prompt Selector (UI)

**Quick Access Command Palette**
- Trigger: `Cmd+Shift+P` (or custom keybind)
- Features:
  - Fuzzy search by name/tags
  - Category filter tabs
  - Favorites at top
  - Recent prompts
  - Preview on hover
  - Variable fill-in modal

**Integration Points**
1. Main chat: Insert prompt at cursor
2. Settings: Full CRUD management
3. Spotlight: Use prompts for quick queries

### Component 3: Prompt Improver Agent

**Using Ollama (like existing RAG agent)**
```typescript
interface PromptAnalysis {
  clarity_score: number;      // 0-100
  specificity_score: number;  // 0-100
  structure_score: number;    // 0-100
  issues: string[];           // identified problems
  suggestions: string[];      // improvement recommendations
  improved_version: string;   // the enhanced prompt
}
```

**Improvement Dimensions**
1. **Clarity** - Remove ambiguity, simplify language
2. **Specificity** - Add constraints, define scope
3. **Structure** - Add sections (Role, Task, Format, Examples)
4. **Examples** - Add few-shot patterns if missing
5. **Constraints** - Add output format, length limits

---

## Implementation Tasks

### Phase 1: Data Layer
- [ ] Create Supabase table schema (`prompts`)
- [ ] Create `/src/prompts/types.ts` - TypeScript interfaces
- [ ] Create `/src/prompts/supabase.ts` - CRUD operations
- [ ] Create `/src/prompts/cache.ts` - Local caching with electron-store
- [ ] Add IPC handlers in `main.ts`

### Phase 2: Prompt Selector UI
- [ ] Create `/static/prompts.html` - Prompt command palette
- [ ] Create `/static/styles/prompts.css` - Styling
- [ ] Create `/src/renderer/prompts.ts` - UI logic
- [ ] Add keybind registration for quick access
- [ ] Integrate with main chat for insertion

### Phase 3: Settings Integration
- [ ] Add "Prompts" section to settings.html
- [ ] Create prompt editor (add/edit/delete)
- [ ] Category management
- [ ] Import/export functionality
- [ ] Sync status indicator

### Phase 4: Prompt Improver Agent
- [ ] Create `/src/prompts/improver.ts` - Improvement agent
- [ ] Define improvement system prompt
- [ ] Add analysis scoring logic
- [ ] Integrate into prompt editor UI
- [ ] Add "Improve" button with preview

---

## File Structure
```
/src/prompts/
  ├── index.ts          # Re-exports
  ├── types.ts          # Interfaces
  ├── supabase.ts       # Cloud CRUD
  ├── cache.ts          # Local cache
  └── improver.ts       # Improvement agent

/static/
  ├── prompts.html      # Command palette
  └── styles/
      └── prompts.css   # Styling

/src/renderer/
  └── prompts.ts        # UI logic
```

---

## User Flow

### Quick Select Flow
```
1. User presses Cmd+Shift+P
2. Command palette opens
3. User types to search or clicks category
4. User selects prompt
5. If variables: fill-in modal appears
6. Prompt inserted into chat input
```

### Improve Flow
```
1. User writes/pastes prompt in editor
2. User clicks "Analyze & Improve"
3. Agent analyzes prompt (shows scores)
4. Suggestions displayed
5. User clicks "Apply Improvements"
6. Improved prompt replaces original
```

---

## Default Prompt Categories
1. **Coding** - Code generation, debugging, review
2. **Writing** - Content creation, editing
3. **Analysis** - Data analysis, research synthesis
4. **Research** - Information gathering, summarization
5. **Creative** - Brainstorming, ideation
6. **System** - Role definitions, personas
7. **Custom** - User-defined

---

## Starter Prompts (Seed Data)
```typescript
const STARTER_PROMPTS = [
  {
    name: "Code Review Expert",
    category: "coding",
    content: "You are a senior code reviewer. Analyze the following code for:\n1. Bugs and edge cases\n2. Performance issues\n3. Security vulnerabilities\n4. Code style and best practices\n\nProvide specific line-by-line feedback.",
    tags: ["review", "quality", "security"]
  },
  {
    name: "Debug Assistant",
    category: "coding",
    content: "Help me debug this issue. I'll provide:\n- The error message\n- Relevant code\n- What I've tried\n\nThink step by step. Identify the root cause before suggesting fixes.",
    tags: ["debug", "troubleshoot"]
  },
  // ... more starter prompts
];
```

---

## Technical Notes

### Why Command Palette (not dropdown)?
- Faster keyboard access
- Scales to many prompts
- Familiar pattern (VS Code, Raycast)
- Fuzzy search is powerful

### Why Ollama for Improver?
- Already integrated in RAG system
- Runs locally (privacy)
- Fast enough for analysis
- Structured JSON output support

### Caching Strategy
- Fetch from Supabase on app start
- Cache in electron-store
- Sync on changes (debounced)
- Offline-first: use cache if no connection

---

## Success Metrics
1. **Selection time** < 2 seconds from trigger to insert
2. **Improvement accuracy** - user accepts >70% of suggestions
3. **Usage frequency** - prompts used >5x/day average

---

## Status
- [ ] Plan reviewed by user
- [ ] Phase 1 implementation
- [ ] Phase 2 implementation
- [ ] Phase 3 implementation
- [ ] Phase 4 implementation
