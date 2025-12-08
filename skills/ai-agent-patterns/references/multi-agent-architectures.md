# Multi-Agent Architectures - Detailed Reference

Extended patterns for multi-agent system design.

---

## Parallel Architecture - Advanced

### With Error Handling

```python
import asyncio
from typing import List, Dict, Any

async def parallel_with_fallback(tasks: List[callable]) -> List[Any]:
    """Execute tasks in parallel with error handling"""
    results = []

    async def safe_execute(task):
        try:
            return await task()
        except Exception as e:
            return {"error": str(e), "task": task.__name__}

    results = await asyncio.gather(*[safe_execute(t) for t in tasks])

    # Separate successes and failures
    successes = [r for r in results if "error" not in r]
    failures = [r for r in results if "error" in r]

    if failures:
        print(f"Warning: {len(failures)} tasks failed")

    return successes
```

### With Rate Limiting

```python
import asyncio
from asyncio import Semaphore

class RateLimitedParallel:
    def __init__(self, max_concurrent: int = 3):
        self.semaphore = Semaphore(max_concurrent)

    async def execute(self, tasks: List[callable]):
        async def limited_task(task):
            async with self.semaphore:
                return await task()

        return await asyncio.gather(*[limited_task(t) for t in tasks])
```

---

## Sequential Architecture - Advanced

### With Checkpointing

```python
class CheckpointedSequence:
    def __init__(self, steps: List[callable]):
        self.steps = steps
        self.checkpoints = {}

    def execute(self, initial_data: dict):
        current_data = initial_data

        for i, step in enumerate(self.steps):
            step_name = step.__name__

            # Check for existing checkpoint
            if step_name in self.checkpoints:
                print(f"Restoring from checkpoint: {step_name}")
                current_data = self.checkpoints[step_name]
                continue

            # Execute step
            try:
                current_data = step(current_data)
                self.checkpoints[step_name] = current_data
            except Exception as e:
                print(f"Failed at step {step_name}: {e}")
                raise

        return current_data
```

---

## Router Architecture - Advanced

### Dynamic Router with LLM

```python
from langchain.chat_models import ChatOpenAI

class LLMRouter:
    def __init__(self, agents: Dict[str, callable]):
        self.agents = agents
        self.llm = ChatOpenAI(temperature=0)

    def route(self, query: str):
        # Use LLM to determine routing
        routing_prompt = f"""
        Given the query: {query}

        Available agents:
        {self._describe_agents()}

        Which agent should handle this? Reply with just the agent name.
        """

        response = self.llm.predict(routing_prompt)
        agent_name = response.strip().lower()

        if agent_name not in self.agents:
            raise ValueError(f"Unknown agent: {agent_name}")

        return self.agents[agent_name](query)

    def _describe_agents(self):
        descriptions = []
        for name, agent in self.agents.items():
            desc = getattr(agent, 'description', 'No description')
            descriptions.append(f"- {name}: {desc}")
        return "\n".join(descriptions)
```

---

## Aggregator Architecture - Advanced

### Weighted Voting

```python
from collections import Counter

class WeightedAggregator:
    def __init__(self, agents_with_weights: Dict[str, tuple]):
        # {agent_name: (agent, weight)}
        self.agents = agents_with_weights

    def aggregate(self, query: str):
        votes = []

        for name, (agent, weight) in self.agents.items():
            result = agent.process(query)
            votes.extend([result] * weight)

        # Most common result wins
        vote_counts = Counter(votes)
        return vote_counts.most_common(1)[0][0]
```

### Consensus Building

```python
class ConsensusAggregator:
    def __init__(self, agents: List[callable], threshold: float = 0.7):
        self.agents = agents
        self.threshold = threshold

    def aggregate(self, query: str):
        results = [agent.process(query) for agent in self.agents]

        # Check for consensus
        result_counts = Counter(results)
        most_common, count = result_counts.most_common(1)[0]

        consensus_ratio = count / len(self.agents)

        if consensus_ratio >= self.threshold:
            return most_common
        else:
            # No consensus - use synthesis
            return self._synthesize(results)

    def _synthesize(self, results: List[Any]):
        # Use LLM to synthesize conflicting results
        pass
```

---

## Hybrid Architectures

### Sequential + Parallel

```python
class HybridArchitecture:
    def __init__(self):
        self.phase1_agents = [AgentA(), AgentB()]  # Parallel
        self.phase2_agent = AgentC()  # Sequential
        self.phase3_agents = [AgentD(), AgentE()]  # Parallel

    async def execute(self, data: dict):
        # Phase 1: Parallel data gathering
        phase1_results = await asyncio.gather(*[
            a.process(data) for a in self.phase1_agents
        ])

        # Phase 2: Sequential synthesis
        combined = self.phase2_agent.synthesize(phase1_results)

        # Phase 3: Parallel execution
        final_results = await asyncio.gather(*[
            a.process(combined) for a in self.phase3_agents
        ])

        return final_results
```

---

## Pattern Selection Guide

| Scenario | Recommended Pattern |
|----------|---------------------|
| Independent data sources | Parallel |
| Data transformation pipeline | Sequential |
| Quality must meet threshold | Loop |
| Multiple specialist domains | Router |
| Need multiple perspectives | Aggregator |
| Complex multi-step workflow | Hybrid |
