# AI Agent Anti-Patterns

Common mistakes when building AI agent systems.

---

## God Agent

**Description**: One agent tries to handle everything

**Symptoms**:
- Agent has too many tools
- Context window constantly exceeded
- Poor performance across all tasks

```python
# ANTI-PATTERN
god_agent = Agent(
    tools=[tool1, tool2, tool3, ..., tool50],
    system_prompt="You can do everything!"
)

# CORRECT - Specialized agents
skills_agent = Agent(
    tools=[assess_skills, validate_skills],
    system_prompt="You assess user skills."
)

career_agent = Agent(
    tools=[research_jobs, plan_career],
    system_prompt="You plan career paths."
)
```

---

## Context Overflow

**Description**: Passing too much context to agents

**Problems**:
- Token limits exceeded
- Important information lost
- Increased costs

```python
# ANTI-PATTERN
result = agent.run(
    prompt="Analyze this",
    context=entire_database_dump  # Too much!
)

# CORRECT - Only relevant context
relevant_data = extract_relevant_context(query)
result = agent.run(
    prompt="Analyze this",
    context=relevant_data
)
```

---

## No Error Handling

**Description**: Agents fail silently or crash

```python
# ANTI-PATTERN
def process(query):
    result = agent.run(query)  # What if it fails?
    return result

# CORRECT
def process(query):
    try:
        result = agent.run(query)
        return result
    except AgentError as e:
        logger.error(f"Agent failed: {e}")
        return fallback_response(query)
    except RateLimitError:
        time.sleep(60)
        return process(query)  # Retry
```

---

## Over-Engineering

**Description**: Using multi-agent when single agent suffices

**Signs**:
- Simple task with complex agent architecture
- More coordination overhead than actual work
- Token costs 10x what simple prompt would cost

```python
# ANTI-PATTERN for simple task
class GreetingSystem:
    def __init__(self):
        self.analyzer = SentimentAgent()
        self.greeter = GreetingAgent()
        self.personalizer = PersonalizationAgent()

    def greet(self, user):
        sentiment = self.analyzer.analyze(user)
        greeting = self.greeter.generate(sentiment)
        return self.personalizer.customize(greeting, user)

# CORRECT - Simple prompt
def greet(user):
    return llm.complete(f"Generate a friendly greeting for {user.name}")
```

---

## Infinite Loops

**Description**: Loop architecture without proper termination

```python
# ANTI-PATTERN
def refine(content):
    while True:  # Never ends!
        content = improve(content)
        if is_perfect(content):  # is_perfect never returns True
            break
    return content

# CORRECT
def refine(content, max_iterations=3, quality_threshold=0.9):
    for i in range(max_iterations):
        score = evaluate(content)
        if score >= quality_threshold:
            break
        content = improve(content)
    return content
```

---

## Poor Tool Naming

**Description**: Ambiguous tool names confuse routing

```python
# ANTI-PATTERN
Tool(name="process", func=..., description="...")
Tool(name="handle", func=..., description="...")
Tool(name="do_thing", func=..., description="...")

# CORRECT
Tool(
    name="assess_technical_skills",
    func=assess_technical_skills,
    description="Evaluates programming and technical competencies from CV"
)
Tool(
    name="search_online_courses",
    func=search_courses,
    description="Searches for online courses matching specific skills"
)
```

---

## Missing Fallbacks

**Description**: No backup when primary agent fails

```python
# ANTI-PATTERN
def get_recommendation(user):
    return ai_agent.recommend(user)  # What if API is down?

# CORRECT
def get_recommendation(user):
    try:
        return ai_agent.recommend(user)
    except ExternalAPIError:
        return cached_recommendations.get_similar(user)
    except Exception:
        return default_recommendations
```

---

## Detection Checklist

| Smell | Likely Problem |
|-------|----------------|
| Agent has 10+ tools | God Agent |
| Context > 50% of token limit | Context Overflow |
| No try/catch around agent calls | No Error Handling |
| Simple task, complex architecture | Over-Engineering |
| Loop without max iterations | Infinite Loops |
| Tool names like "process", "handle" | Poor Tool Naming |
| No fallback for API failures | Missing Fallbacks |

---

## Best Practices Summary

1. **Keep agents focused** - One responsibility per agent
2. **Minimize context** - Only include what's needed
3. **Handle errors gracefully** - Retry, fallback, log
4. **Start simple** - Add complexity only when needed
5. **Set iteration limits** - Prevent infinite loops
6. **Name tools clearly** - Be specific and descriptive
7. **Always have fallbacks** - Graceful degradation
