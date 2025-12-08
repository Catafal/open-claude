# Agentic AI Patterns - Detailed Reference

Core patterns for building intelligent, autonomous AI agents.

---

## Reflection Pattern

**Definition**: AI evaluates and refines its own outputs through self-critique

### Basic Reflection

```python
class ReflectionAgent:
    def __init__(self, generator_llm, critic_llm):
        self.generator = generator_llm
        self.critic = critic_llm

    def generate_with_reflection(self, prompt: str, max_iterations: int = 3):
        current_output = self.generator.generate(prompt)

        for i in range(max_iterations):
            # Self-critique
            critique = self.critic.evaluate(current_output, prompt)

            if critique["quality_score"] > 0.9:
                break

            # Refine based on critique
            refinement_prompt = f"""
            Original task: {prompt}
            Current output: {current_output}
            Issues identified: {critique["issues"]}

            Improve the output addressing these issues.
            """
            current_output = self.generator.generate(refinement_prompt)

        return current_output
```

### Multi-Aspect Reflection

```python
class MultiAspectReflector:
    """Evaluates output across multiple quality dimensions"""

    def __init__(self, llm):
        self.llm = llm
        self.aspects = [
            "accuracy",
            "completeness",
            "clarity",
            "relevance"
        ]

    def reflect(self, output: str, original_task: str) -> dict:
        evaluations = {}

        for aspect in self.aspects:
            prompt = f"""
            Evaluate this output for {aspect}:
            Task: {original_task}
            Output: {output}

            Score (0-1) and explain issues:
            """
            result = self.llm.generate(prompt)
            evaluations[aspect] = parse_evaluation(result)

        # Aggregate scores
        avg_score = sum(e["score"] for e in evaluations.values()) / len(self.aspects)

        return {
            "overall_score": avg_score,
            "aspect_scores": evaluations,
            "needs_improvement": avg_score < 0.8
        }
```

### Reflexion (Learning from Mistakes)

```python
class ReflexionAgent:
    """Learns from failures across attempts"""

    def __init__(self, llm):
        self.llm = llm
        self.memory = []  # Stores past reflections

    def solve_with_reflexion(self, task: str, max_attempts: int = 3):
        for attempt in range(max_attempts):
            # Generate solution considering past failures
            context = self._build_context()
            solution = self.llm.generate(f"{context}\n\nTask: {task}")

            # Evaluate solution
            result = self._evaluate(solution, task)

            if result["success"]:
                return solution

            # Reflect on failure
            reflection = self._reflect(task, solution, result["error"])
            self.memory.append({
                "attempt": attempt,
                "solution": solution,
                "error": result["error"],
                "reflection": reflection
            })

        return self._best_attempt()

    def _reflect(self, task: str, solution: str, error: str) -> str:
        prompt = f"""
        Task: {task}
        My solution: {solution}
        Error: {error}

        What went wrong? What should I do differently next time?
        """
        return self.llm.generate(prompt)

    def _build_context(self) -> str:
        if not self.memory:
            return ""
        return f"Previous attempts and learnings:\n{self.memory}"
```

---

## Tool Use Pattern

**Definition**: AI interacts with external resources to extend capabilities

### Basic Tool Integration

```python
from langchain.agents import Tool, initialize_agent
from langchain.chat_models import ChatOpenAI

# Define tools
tools = [
    Tool(
        name="SearchCourses",
        func=search_courses_api,
        description="Search for online courses by topic. Input: course topic string"
    ),
    Tool(
        name="CheckPrerequisites",
        func=check_prerequisites,
        description="Verify if user meets course prerequisites. Input: course_id, user_skills"
    ),
    Tool(
        name="CalculateDuration",
        func=calculate_learning_time,
        description="Estimate time to complete learning path. Input: list of course IDs"
    ),
    Tool(
        name="GetUserProfile",
        func=get_user_profile,
        description="Retrieve user's current skills and preferences. Input: user_id"
    )
]

# Create agent with tools
agent = initialize_agent(
    tools=tools,
    llm=ChatOpenAI(temperature=0),
    agent="zero-shot-react-description",
    verbose=True
)

# Agent decides which tools to use
result = agent.run("Find Python courses for beginners and estimate completion time")
```

### Structured Tool Definitions

```python
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

class CourseSearchInput(BaseModel):
    topic: str = Field(description="The course topic to search for")
    level: str = Field(description="Difficulty level: beginner, intermediate, advanced")
    max_duration: int = Field(description="Maximum course duration in hours", default=40)

def search_courses_structured(topic: str, level: str, max_duration: int) -> list:
    """Search for courses matching criteria"""
    return course_api.search(
        topic=topic,
        level=level,
        max_hours=max_duration
    )

search_tool = StructuredTool.from_function(
    func=search_courses_structured,
    name="SearchCoursesAdvanced",
    description="Search for courses with specific criteria",
    args_schema=CourseSearchInput
)
```

### Tool with Error Handling

```python
class RobustTool:
    """Tool wrapper with retry and fallback logic"""

    def __init__(self, primary_func, fallback_func=None, max_retries=3):
        self.primary = primary_func
        self.fallback = fallback_func
        self.max_retries = max_retries

    def execute(self, *args, **kwargs):
        for attempt in range(self.max_retries):
            try:
                result = self.primary(*args, **kwargs)
                if result:
                    return result
            except Exception as e:
                if attempt == self.max_retries - 1:
                    if self.fallback:
                        return self.fallback(*args, **kwargs)
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff

        return None
```

---

## Planning Pattern

### ReAct (Reasoning and Acting)

**Interleaved thinking and action**

```python
def react_agent(query: str, tools: list, max_steps: int = 10):
    """
    ReAct loop:
    Thought: Reason about what to do
    Action: Execute an action
    Observation: Observe result
    Repeat until complete
    """
    observations = []

    for step in range(max_steps):
        # Thought: What should I do?
        thought_prompt = f"""
        Query: {query}
        Previous observations: {observations}

        Think step by step about what to do next.
        If you have enough information, say "FINAL ANSWER: [answer]"
        Otherwise, choose a tool and explain why.
        """
        thought = llm.generate(thought_prompt)

        # Check for final answer
        if "FINAL ANSWER:" in thought:
            return extract_final_answer(thought)

        # Action: Parse and execute tool call
        action = parse_action(thought)
        tool = find_tool(tools, action["tool_name"])

        # Observation: Get result
        try:
            result = tool.execute(action["input"])
            observations.append({
                "step": step,
                "thought": thought,
                "action": action,
                "result": result
            })
        except Exception as e:
            observations.append({
                "step": step,
                "thought": thought,
                "action": action,
                "error": str(e)
            })

    return synthesize_from_observations(observations)
```

### ReWOO (Reasoning WithOut Observation)

**Plan first, then execute all at once**

```python
def rewoo_agent(query: str, tools: list):
    """
    ReWOO approach:
    1. Planning phase: Generate complete plan upfront
    2. Execution phase: Execute all steps
    3. Synthesis phase: Combine results
    """
    # Phase 1: Planning
    plan_prompt = f"""
    Task: {query}

    Available tools: {[t.name for t in tools]}

    Create a step-by-step plan. Use variables like #E1, #E2 for intermediate results.
    Format each step as:
    Step N: [tool_name](input) -> #EN

    Example:
    Step 1: SearchCourses("Python basics") -> #E1
    Step 2: GetDuration(#E1) -> #E2
    """
    plan = llm.generate(plan_prompt)
    steps = parse_plan(plan)

    # Phase 2: Execution
    variables = {}
    for step in steps:
        # Substitute variables in inputs
        resolved_input = substitute_variables(step["input"], variables)

        # Execute tool
        tool = find_tool(tools, step["tool"])
        result = tool.execute(resolved_input)

        # Store result
        variables[step["output_var"]] = result

    # Phase 3: Synthesis
    synthesis_prompt = f"""
    Original query: {query}
    Collected information: {variables}

    Synthesize a comprehensive answer.
    """
    return llm.generate(synthesis_prompt)
```

### Plan-and-Solve

**Explicit decomposition before solving**

```python
class PlanAndSolveAgent:
    """Decompose complex tasks into manageable subtasks"""

    def __init__(self, llm):
        self.llm = llm

    def solve(self, complex_task: str):
        # Step 1: Decompose
        plan = self._decompose(complex_task)

        # Step 2: Solve each subtask
        results = []
        for subtask in plan["subtasks"]:
            result = self._solve_subtask(subtask, results)
            results.append(result)

        # Step 3: Integrate results
        return self._integrate(complex_task, results)

    def _decompose(self, task: str) -> dict:
        prompt = f"""
        Complex task: {task}

        Break this down into smaller, manageable subtasks.
        Order them by dependency (independent tasks first).

        Return as JSON:
        {{"subtasks": ["subtask1", "subtask2", ...]}}
        """
        return json.loads(self.llm.generate(prompt))

    def _solve_subtask(self, subtask: str, previous_results: list) -> str:
        context = f"Previous results: {previous_results}" if previous_results else ""
        prompt = f"""
        {context}
        Subtask: {subtask}

        Solve this subtask.
        """
        return self.llm.generate(prompt)

    def _integrate(self, original_task: str, results: list) -> str:
        prompt = f"""
        Original task: {original_task}
        Subtask results: {results}

        Integrate these results into a final, cohesive answer.
        """
        return self.llm.generate(prompt)
```

---

## Pattern Combinations

### Reflection + Planning

```python
class ReflectivePlanner:
    """Combines planning with reflection for high-quality outputs"""

    def execute(self, task: str):
        # Plan
        plan = self._create_plan(task)

        # Execute with reflection at each step
        for step in plan:
            result = self._execute_step(step)

            # Reflect on step quality
            quality = self._reflect_on_step(step, result)

            if quality["needs_revision"]:
                result = self._revise_step(step, result, quality["feedback"])

        # Final reflection on overall result
        return self._final_reflection(task, results)
```

### Tool Use + Reflection

```python
class ReflectiveToolUser:
    """Reflects on tool usage and results"""

    def use_tool_with_reflection(self, task: str, tools: list):
        # Choose tool
        tool_choice = self._select_tool(task, tools)

        # Execute
        result = tool_choice["tool"].execute(tool_choice["input"])

        # Reflect on result quality
        reflection = self._reflect_on_result(task, result)

        if reflection["needs_retry"]:
            # Try different tool or approach
            return self._retry_with_alternative(task, tools, reflection)

        return result
```

---

## Pattern Selection Guide

| Need | Pattern | Key Benefit |
|------|---------|-------------|
| Improve output quality | Reflection | Self-correction |
| Learn from failures | Reflexion | Accumulate knowledge |
| Access external data | Tool Use | Extended capabilities |
| Step-by-step reasoning | ReAct | Transparent decisions |
| Efficient multi-step | ReWOO | Reduced token usage |
| Complex task breakdown | Plan-and-Solve | Manageable subtasks |

---

## Best Practices

1. **Reflection**
   - Set quality thresholds to avoid infinite loops
   - Use different models for generation vs critique
   - Limit iterations (typically 2-3 max)

2. **Tool Use**
   - Provide clear, unambiguous tool descriptions
   - Include input/output examples in descriptions
   - Handle tool failures gracefully

3. **Planning**
   - Validate plan feasibility before execution
   - Allow plan revision during execution
   - Keep subtasks atomic and testable
