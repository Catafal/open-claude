# LangGraph Workflow Patterns - Detailed Reference

Advanced patterns for building LangGraph-based agent workflows.

---

## Agent Supervisor Pattern

**Architecture**: Supervisor routes tasks, agents have private context

```python
from langgraph.prebuilt import create_react_agent
from langgraph.graph import StateGraph, MessagesState, END
from typing import Literal

# Define specialized agents
skills_agent = create_react_agent(
    model,
    tools=[skills_tool],
    system_prompt="You assess user skills."
)

career_agent = create_react_agent(
    model,
    tools=[career_tool],
    system_prompt="You plan career paths."
)

learning_agent = create_react_agent(
    model,
    tools=[course_tool],
    system_prompt="You recommend learning resources."
)

# Supervisor decides routing
def supervisor_router(state: MessagesState) -> Literal["skills", "career", "learning", "FINISH"]:
    """Route based on current state and task needs"""
    last_message = state["messages"][-1]

    # LLM-based routing decision
    routing_prompt = f"""
    Based on the conversation, which agent should handle next?
    Options: skills, career, learning, FINISH

    Last message: {last_message.content}
    """
    decision = model.invoke(routing_prompt)
    return decision.content.strip().lower()

# Build supervision workflow
workflow = StateGraph(MessagesState)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("skills", skills_agent)
workflow.add_node("career", career_agent)
workflow.add_node("learning", learning_agent)

workflow.add_conditional_edges(
    "supervisor",
    supervisor_router,
    {
        "skills": "skills",
        "career": "career",
        "learning": "learning",
        "FINISH": END
    }
)

# All agents report back to supervisor
for agent in ["skills", "career", "learning"]:
    workflow.add_edge(agent, "supervisor")

workflow.set_entry_point("supervisor")
graph = workflow.compile()
```

---

## Hierarchical Teams

**Multi-level supervision for complex workflows**

```python
from langgraph.graph import StateGraph, MessagesState

class TeamState(MessagesState):
    team_results: dict = {}
    current_team: str = ""

# Team 1: Research Team
research_supervisor = create_team_supervisor(
    agents=["web_researcher", "document_analyzer"],
    name="Research Team"
)

# Team 2: Analysis Team
analysis_supervisor = create_team_supervisor(
    agents=["data_analyst", "pattern_finder"],
    name="Analysis Team"
)

# Top-level coordinator
def top_coordinator(state: TeamState):
    """Coordinates between team supervisors"""
    if needs_research(state):
        return "research_team"
    elif needs_analysis(state):
        return "analysis_team"
    else:
        return "synthesize"

workflow = StateGraph(TeamState)
workflow.add_node("coordinator", top_coordinator_node)
workflow.add_node("research_team", research_supervisor)
workflow.add_node("analysis_team", analysis_supervisor)
workflow.add_node("synthesize", synthesize_results)

workflow.add_conditional_edges("coordinator", top_coordinator)
workflow.add_edge("research_team", "coordinator")
workflow.add_edge("analysis_team", "coordinator")
workflow.add_edge("synthesize", END)

workflow.set_entry_point("coordinator")
```

---

## Shared State Pattern

**Agents share common state for coordination**

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph
from operator import add

class SharedState(TypedDict):
    messages: Annotated[list, add]  # Append-only message history
    user_profile: dict              # Shared user data
    skills_assessed: list           # Accumulated skills
    recommendations: list           # Accumulated recommendations
    current_step: str               # Workflow progress

def skills_agent(state: SharedState) -> SharedState:
    """Assess skills and update shared state"""
    skills = assess_skills(state["user_profile"])
    return {
        "skills_assessed": skills,
        "current_step": "skills_complete"
    }

def career_agent(state: SharedState) -> SharedState:
    """Use skills from shared state to recommend careers"""
    careers = recommend_careers(
        state["user_profile"],
        state["skills_assessed"]  # Access shared state
    )
    return {
        "recommendations": careers,
        "current_step": "career_complete"
    }

workflow = StateGraph(SharedState)
workflow.add_node("skills", skills_agent)
workflow.add_node("career", career_agent)
workflow.add_edge("skills", "career")
workflow.add_edge("career", END)
workflow.set_entry_point("skills")
```

---

## Checkpointing and Persistence

**Save and restore workflow state**

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver

# In-memory checkpointing (development)
memory_checkpointer = MemorySaver()

# SQLite checkpointing (production)
sqlite_checkpointer = SqliteSaver.from_conn_string("workflow.db")

# Compile with checkpointing
graph = workflow.compile(checkpointer=sqlite_checkpointer)

# Run with thread ID for persistence
config = {"configurable": {"thread_id": "user-123-workflow-456"}}

# First run
result1 = graph.invoke(initial_state, config)

# Later: Resume from checkpoint
result2 = graph.invoke({"messages": [new_message]}, config)

# Get checkpoint history
for checkpoint in graph.get_state_history(config):
    print(f"Step: {checkpoint.metadata.get('step')}")
    print(f"State: {checkpoint.values}")
```

---

## Human-in-the-Loop

**Pause workflow for human approval**

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class ApprovalState(TypedDict):
    messages: list
    pending_action: dict
    approved: bool

def propose_action(state: ApprovalState) -> ApprovalState:
    """Generate action that needs approval"""
    action = generate_proposed_action(state)
    return {"pending_action": action, "approved": False}

def execute_action(state: ApprovalState) -> ApprovalState:
    """Execute after approval"""
    if state["approved"]:
        result = execute(state["pending_action"])
        return {"messages": [result]}
    return {"messages": ["Action rejected"]}

def approval_router(state: ApprovalState):
    if state["approved"]:
        return "execute"
    return "wait_for_approval"

workflow = StateGraph(ApprovalState)
workflow.add_node("propose", propose_action)
workflow.add_node("execute", execute_action)

# Interrupt before execution
workflow.add_conditional_edges(
    "propose",
    approval_router,
    {"execute": "execute", "wait_for_approval": END}
)

graph = workflow.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["execute"]  # Pause here for human input
)

# Run until interrupt
result = graph.invoke(initial_state, config)

# Human approves...
graph.update_state(config, {"approved": True})

# Resume execution
final_result = graph.invoke(None, config)
```

---

## Parallel Branches

**Execute multiple branches concurrently**

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
from operator import add

class ParallelState(TypedDict):
    input: str
    branch_a_result: str
    branch_b_result: str
    branch_c_result: str
    final_result: str

def branch_a(state: ParallelState) -> dict:
    result = process_branch_a(state["input"])
    return {"branch_a_result": result}

def branch_b(state: ParallelState) -> dict:
    result = process_branch_b(state["input"])
    return {"branch_b_result": result}

def branch_c(state: ParallelState) -> dict:
    result = process_branch_c(state["input"])
    return {"branch_c_result": result}

def merge_results(state: ParallelState) -> dict:
    combined = combine(
        state["branch_a_result"],
        state["branch_b_result"],
        state["branch_c_result"]
    )
    return {"final_result": combined}

workflow = StateGraph(ParallelState)
workflow.add_node("branch_a", branch_a)
workflow.add_node("branch_b", branch_b)
workflow.add_node("branch_c", branch_c)
workflow.add_node("merge", merge_results)

# Fan-out: Start -> All branches (parallel)
workflow.add_edge("__start__", "branch_a")
workflow.add_edge("__start__", "branch_b")
workflow.add_edge("__start__", "branch_c")

# Fan-in: All branches -> Merge
workflow.add_edge("branch_a", "merge")
workflow.add_edge("branch_b", "merge")
workflow.add_edge("branch_c", "merge")

workflow.add_edge("merge", END)
```

---

## Error Recovery Pattern

**Handle failures gracefully in workflows**

```python
from langgraph.graph import StateGraph, END

class RecoverableState(TypedDict):
    messages: list
    retry_count: int
    max_retries: int
    last_error: str

def risky_operation(state: RecoverableState) -> dict:
    try:
        result = perform_operation(state)
        return {"messages": [result], "retry_count": 0}
    except Exception as e:
        return {
            "last_error": str(e),
            "retry_count": state["retry_count"] + 1
        }

def should_retry(state: RecoverableState):
    if state.get("last_error"):
        if state["retry_count"] < state["max_retries"]:
            return "retry"
        return "fallback"
    return "success"

def fallback_operation(state: RecoverableState) -> dict:
    """Use fallback when retries exhausted"""
    result = get_cached_or_default_result()
    return {"messages": [result]}

workflow = StateGraph(RecoverableState)
workflow.add_node("operation", risky_operation)
workflow.add_node("fallback", fallback_operation)

workflow.add_conditional_edges(
    "operation",
    should_retry,
    {
        "retry": "operation",
        "fallback": "fallback",
        "success": END
    }
)
workflow.add_edge("fallback", END)
workflow.set_entry_point("operation")
```

---

## Pattern Selection Guide

| Need | Pattern |
|------|---------|
| Route tasks to specialists | Agent Supervisor |
| Multiple teams with coordination | Hierarchical Teams |
| Agents need common context | Shared State |
| Resume interrupted workflows | Checkpointing |
| Human approval required | Human-in-the-Loop |
| Independent parallel processing | Parallel Branches |
| Handle transient failures | Error Recovery |
