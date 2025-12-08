---
name: ai-agent-patterns
description: Design patterns for AI agents and multi-agent systems using LangChain and LangGraph. Use when building LLM-powered agents, multi-agent workflows, or AI orchestration. CRITICAL - Always use structured outputs for LLM calls. Triggers on multi-agent, LangChain, LangGraph, agent architecture, Tool Calling, Handoffs, Reflection pattern, planning pattern, agent supervisor, parallel agents, structured output, Pydantic output.
---

# AI Agent Design Patterns

Patterns for building LangChain agents and multi-agent systems.

## Overview

**CRITICAL: Always Use Structured Outputs**

> **Rule**: Every LLM call in an agent should use structured outputs unless there's a specific reason not to. This is non-negotiable for production systems.

**5 Core Architecture Patterns**:

| Pattern | When to Use | Key Benefit |
|---------|-------------|-------------|
| **Parallel** | Independent tasks | Fast execution |
| **Sequential** | Ordered dependencies | Clear flow |
| **Loop** | Iterative refinement | Quality assurance |
| **Router** | Task routing | Specialization |
| **Aggregator** | Result synthesis | Multiple perspectives |

**2 Coordination Patterns**:

| Pattern | Control | Use When |
|---------|---------|----------|
| **Tool Calling** | Centralized | Controller manages agents |
| **Handoffs** | Decentralized | Agents transfer to specialists |

**1 Foundational Pattern (Required)**:

| Pattern | Priority | Reason |
|---------|----------|--------|
| **Structured Output** | ALWAYS | Guarantees parseable, typed responses |

---

## Structured Output Pattern (Foundational)

**Definition**: Force LLM to return responses conforming to a predefined schema

> **ALWAYS consider structured outputs first.** Only use unstructured text when you specifically need free-form prose (e.g., final user-facing explanations).

### Why Structured Outputs Are Critical

| Problem Without | Solution With Structured |
|-----------------|--------------------------|
| Parsing failures | Schema-validated JSON |
| Type mismatches | Pydantic type enforcement |
| Missing fields | Required field validation |
| Inconsistent formats | Guaranteed structure |
| Runtime errors | Compile-time type safety |
| Agent chain breaks | Reliable data flow |

### LangChain Implementation

```python
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI

# Define output schema - ALWAYS do this
class SkillAssessment(BaseModel):
    """Structured output for skill assessment."""
    skill_name: str = Field(description="Name of the skill assessed")
    proficiency_level: int = Field(ge=1, le=5, description="Level 1-5")
    evidence: list[str] = Field(description="Supporting evidence from CV")
    improvement_areas: list[str] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0)

# Bind schema to model
llm = ChatOpenAI(model="gpt-4o", temperature=0)
structured_llm = llm.with_structured_output(SkillAssessment)

# Invoke - response is guaranteed to match schema
result: SkillAssessment = structured_llm.invoke(
    "Assess Python skills from this CV: ..."
)

# Safe to access - no parsing needed
print(f"Level: {result.proficiency_level}")
print(f"Confidence: {result.confidence_score}")
```

### Multi-Field Agent Response

```python
from pydantic import BaseModel, Field
from typing import Literal

class AgentResponse(BaseModel):
    """Standard structured response for all agents."""
    status: Literal["success", "needs_more_info", "error"]
    reasoning: str = Field(description="Agent's reasoning process")
    result: dict = Field(description="The actual output data")
    next_action: str | None = Field(default=None)
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)

class RouterDecision(BaseModel):
    """Structured output for router agents."""
    selected_agent: Literal["skills", "career", "learning", "none"]
    reason: str = Field(description="Why this agent was selected")
    extracted_intent: str = Field(description="User's parsed intent")
    priority: Literal["low", "medium", "high"] = "medium"
```

### When to Use Structured vs Unstructured

| Use Structured Output | Use Unstructured Text |
|-----------------------|----------------------|
| Agent-to-agent communication | Final user-facing summary |
| Data extraction | Creative writing tasks |
| Classification/routing | Open-ended explanations |
| Any data you'll process programmatically | Chat responses |
| Multi-step workflows | When schema is truly unknown |
| Tool parameter generation | |
| Database insertions | |

### Anti-Pattern: Unstructured Agent Chains

```python
# BAD - Parsing will fail eventually
def bad_agent(query: str) -> str:
    response = llm.invoke(f"Analyze: {query}")
    # Hope it returns something parseable...
    try:
        data = json.loads(response)  # Will fail randomly
    except:
        # Now what?
        pass

# GOOD - Always get valid data
def good_agent(query: str) -> AnalysisResult:
    structured_llm = llm.with_structured_output(AnalysisResult)
    return structured_llm.invoke(f"Analyze: {query}")  # Type-safe
```

### Nested Structures for Complex Outputs

```python
from pydantic import BaseModel, Field

class CourseRecommendation(BaseModel):
    title: str
    provider: str
    url: str
    estimated_hours: int
    relevance_score: float

class SkillGap(BaseModel):
    skill_name: str
    current_level: int
    target_level: int
    priority: Literal["critical", "important", "nice_to_have"]
    recommended_courses: list[CourseRecommendation]

class CareerPlanOutput(BaseModel):
    """Complex nested structured output."""
    summary: str
    target_role: str
    timeline_months: int
    skill_gaps: list[SkillGap]
    total_learning_hours: int
    confidence_score: float

# LLM will populate entire nested structure
career_llm = llm.with_structured_output(CareerPlanOutput)
plan: CareerPlanOutput = career_llm.invoke(user_profile)
```

### Checklist: Before Every LLM Call

1. **Can this be structured?** → If yes, define a Pydantic model
2. **Will I process this programmatically?** → If yes, MUST be structured
3. **Does this feed another agent?** → If yes, MUST be structured
4. **Is this user-facing prose only?** → Only then use unstructured

---

## Multi-Agent Architectures

### Parallel Architecture

**Definition**: Multiple agents work on different subtasks simultaneously

```python
import asyncio

async def assess_skills_parallel(user_cv: str):
    tasks = [
        technical_agent.assess(user_cv),
        soft_skills_agent.assess(user_cv),
        domain_expertise_agent.assess(user_cv)
    ]
    results = await asyncio.gather(*tasks)
    return aggregate_results(results)
```

**Use When**: Tasks are independent, speed is critical
**Avoid When**: Tasks have dependencies

---

### Sequential Architecture

**Definition**: Agents execute in order, each building on previous results

```python
def generate_career_path(user_data: dict):
    # Step 1: Extract user info
    extracted_info = info_extractor_agent.process(user_data)

    # Step 2: Assess current skills
    skill_assessment = skills_agent.assess(extracted_info)

    # Step 3: Identify gaps
    skill_gaps = gap_analysis_agent.analyze(skill_assessment)

    # Step 4: Generate recommendations
    career_plan = career_path_agent.generate(skill_gaps)

    return career_plan
```

**Use When**: Output of one agent feeds into the next
**Avoid When**: Tasks can run in parallel

---

### Loop Architecture

**Definition**: Agent repeats task until completion criteria met

```python
def refine_learning_plan(initial_plan, max_iterations: int = 3):
    current_plan = initial_plan

    for iteration in range(max_iterations):
        # Evaluate quality
        quality_score = evaluator_agent.assess(current_plan)

        if quality_score > 0.9:
            break

        # Identify improvements
        feedback = critic_agent.critique(current_plan)

        # Refine plan
        current_plan = refiner_agent.improve(current_plan, feedback)

    return current_plan
```

**Use When**: Quality threshold must be met
**Avoid When**: Speed is priority

---

### Router Architecture

**Definition**: Single agent directs tasks to specialized agents

```python
class SkillAssessmentRouter:
    def __init__(self):
        self.agents = {
            "technical": TechnicalSkillsAgent(),
            "soft": SoftSkillsAgent(),
            "language": LanguageSkillsAgent()
        }

    def route_assessment(self, skill_type: str, data: dict):
        agent = self.agents.get(skill_type)
        if not agent:
            raise ValueError(f"Unknown skill type: {skill_type}")
        return agent.assess(data)
```

**Use When**: Clear routing rules exist
**Avoid When**: Routing logic is complex

---

### Aggregator Architecture

**Definition**: Collects and combines results from multiple agents

```python
class RecommendationAggregator:
    def __init__(self):
        self.expert_agents = [
            IndustryExpertAgent(),
            AcademicAdvisorAgent(),
            CareerCounselorAgent()
        ]

    def get_recommendations(self, user_profile: dict) -> list:
        all_recommendations = []

        for agent in self.expert_agents:
            recs = agent.recommend(user_profile)
            all_recommendations.extend(recs)

        return self._merge_and_rank(all_recommendations)
```

**Use When**: Multiple perspectives needed
**Avoid When**: Single source is sufficient

---

## LangChain Coordination Patterns

### Tool Calling Pattern (Centralized)

**Definition**: Controller agent invokes other agents as tools

```
          ┌─────────────────┐
          │ Controller Agent│
          └────────┬────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
    ┌───▼───┐  ┌──▼───┐  ┌──▼───┐
    │Agent A│  │Agent B│  │Agent C│
    └───────┘  └──────┘  └──────┘
```

```python
from langchain.agents import Tool, AgentExecutor
from langchain.chat_models import ChatOpenAI

# Define agent tools
skills_tool = Tool(
    name="assess_skills",
    func=skills_assessment_agent.run,
    description="Assesses user's current skill levels"
)

gap_tool = Tool(
    name="identify_gaps",
    func=gap_analysis_agent.run,
    description="Identifies skill gaps for career goals"
)

# Controller agent with tools
controller = AgentExecutor.from_agent_and_tools(
    agent=ChatOpenAI(temperature=0),
    tools=[skills_tool, gap_tool],
    verbose=True
)

result = controller.run("Analyze skills for data scientist role")
```

**Use When**: Clear task decomposition, need centralized logging
**Avoid When**: Dynamic agent switching needed

---

### Handoffs Pattern (Decentralized)

**Definition**: Agents transfer control directly to each other

```
┌───────┐     ┌───────┐     ┌───────┐
│Agent A│────▶│Agent B│────▶│Agent C│
└───────┘     └───────┘     └───────┘
```

```python
from langgraph.prebuilt import create_react_agent
from langgraph.graph import StateGraph, MessagesState

# Define agents with handoff capability
skills_agent = create_react_agent(
    model,
    tools=[handoff_to_career_agent],
    system_prompt="You assess skills. Handoff to career agent when done."
)

career_agent = create_react_agent(
    model,
    tools=[handoff_to_learning_agent],
    system_prompt="You plan careers. Handoff to learning agent for courses."
)

# Build workflow with handoffs
workflow = StateGraph(MessagesState)
workflow.add_node("skills", skills_agent)
workflow.add_node("career", career_agent)
workflow.add_edge("skills", "career")
workflow.set_entry_point("skills")

graph = workflow.compile()
```

**Use When**: Specialist takeover needed, multi-domain conversations
**Avoid When**: Simple task orchestration

---

## Agentic AI Design Patterns

### Reflection Pattern

**Definition**: AI evaluates and refines its own outputs

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

**Use When**: High quality output required
**Avoid When**: Speed is priority

---

### Tool Use Pattern

**Definition**: AI interacts with external resources

```python
from langchain.agents import initialize_agent, Tool

tools = [
    Tool(
        name="SearchCourses",
        func=search_courses_api,
        description="Search for online courses by topic"
    ),
    Tool(
        name="CheckPrerequisites",
        func=check_prerequisites,
        description="Verify if user meets course prerequisites"
    ),
    Tool(
        name="CalculateDuration",
        func=calculate_learning_time,
        description="Estimate time to complete learning path"
    )
]

agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent="zero-shot-react-description",
    verbose=True
)

result = agent.run("Find Python courses for beginners")
```

**Use When**: Need external APIs, databases, web searches
**Avoid When**: All information available in context

---

### Planning Pattern

**ReAct (Reasoning and Acting)**:
```python
def react_agent(query: str):
    """
    Thought: Reason about what to do
    Action: Execute an action
    Observation: Observe result
    Repeat until complete
    """
    state = {"query": query, "complete": False}

    while not state["complete"]:
        thought = llm.generate(f"Thought: What should I do? {state}")
        action = parse_action(thought)
        result = execute_action(action)
        state["observations"].append(result)
        state["complete"] = is_task_complete(state)

    return state["final_answer"]
```

**ReWOO (Reasoning WithOut Observation)**:
```python
def rewoo_agent(query: str):
    # Planning phase: Generate complete plan
    plan = llm.generate(f"""
    Task: {query}
    Create step-by-step plan using variables like #E1, #E2.
    """)

    # Execution phase: Execute all steps
    variables = {}
    for step in plan["steps"]:
        inputs = substitute_variables(step["inputs"], variables)
        result = execute_tool(step["tool"], inputs)
        variables[step["output_var"]] = result

    return llm.generate(f"Synthesize answer from: {variables}")
```

---

## LangGraph Workflows

### Agent Supervisor

**Architecture**: Supervisor routes tasks, agents have private context

```python
from langgraph.prebuilt import create_react_agent
from langgraph.graph import StateGraph, MessagesState, END

# Define specialized agents
skills_agent = create_react_agent(model, [skills_tool])
career_agent = create_react_agent(model, [career_tool])

# Supervisor decides routing
supervisor = create_react_agent(
    model,
    tools=[],
    system_prompt="You manage: skills_agent, career_agent. Delegate appropriately."
)

# Build supervision workflow
workflow = StateGraph(MessagesState)
workflow.add_node("supervisor", supervisor)
workflow.add_node("skills_agent", skills_agent)
workflow.add_node("career_agent", career_agent)

workflow.add_conditional_edges(
    "supervisor",
    lambda state: state["next_agent"],
    {"skills_agent": "skills_agent",
     "career_agent": "career_agent",
     "FINISH": END}
)

for agent in ["skills_agent", "career_agent"]:
    workflow.add_edge(agent, "supervisor")

workflow.set_entry_point("supervisor")
graph = workflow.compile()
```

---

## When to Build Multi-Agent Systems

### Build Multi-Agent When

- **Breadth-First Queries**: Multiple independent directions
- **Context Window Exceeded**: Information too large for single agent
- **Heavy Parallelization**: Independent subtasks can run concurrently
- **High Task Value**: Computational costs justified

### Avoid Multi-Agent For

- **Identical Context with Dependencies**: Single agent more efficient
- **Real-Time Coordination**: Overhead outweighs benefits
- **Most Coding Tasks**: Single agent with good prompting sufficient
- **Low-Value Problems**: Token costs exceed task value

---

## Quick Reference

| Need | Pattern |
|------|---------|
| **Reliable LLM responses** | **Structured Output (ALWAYS)** |
| Parallel execution | Parallel Architecture |
| Sequential steps | Sequential Architecture |
| Quality refinement | Loop + Reflection |
| Task routing | Router Architecture |
| Result synthesis | Aggregator |
| Central control | Tool Calling |
| Dynamic handoffs | Handoffs Pattern |
| External resources | Tool Use |
| Task decomposition | Planning (ReAct/ReWOO) |
| Team coordination | Agent Supervisor |

### Structured Output Decision Tree

```
Making an LLM call?
    │
    ├─▶ Will result be processed by code? ─▶ YES ─▶ USE STRUCTURED OUTPUT
    │
    ├─▶ Does it feed another agent? ─▶ YES ─▶ USE STRUCTURED OUTPUT
    │
    ├─▶ Goes to database/API? ─▶ YES ─▶ USE STRUCTURED OUTPUT
    │
    └─▶ Pure prose for end user? ─▶ YES ─▶ Unstructured OK
```

---

## See Also: Related Patterns

### In `gof-patterns`
- **Strategy Pattern**: Router uses Strategy for agent selection
- **Observer Pattern**: Event bus in agent communication

### In `backend-patterns`
- **Service Layer**: Similar orchestration of components
- **Event-Driven**: Agent events as domain events

---

## References

See [multi-agent-architectures.md](references/multi-agent-architectures.md) for detailed architecture patterns.

See [langgraph-patterns.md](references/langgraph-patterns.md) for LangGraph workflows.

See [agentic-patterns.md](references/agentic-patterns.md) for Reflection, Planning, Tool Use.

See [anti-patterns.md](references/anti-patterns.md) for common AI agent mistakes.
