---
name: developer-growth-analysis
description: Analyzes your recent Claude Code chat history to identify coding patterns, development gaps, and areas for improvement, curates relevant learning resources from HackerNews, and delivers a personalized growth report (via email, file, or terminal). Use when you want feedback on your development patterns, to identify technical gaps, discover learning resources, or track improvement areas. Triggers on phrases like "analyze my growth", "review my coding patterns", "developer feedback", "what should I learn", "improvement areas".
---

# Developer Growth Analysis

Analyze your recent coding work to identify patterns, gaps, and personalized learning opportunities.

## Overview

This skill provides personalized feedback on your recent coding work by:
1. Reading your Claude Code chat history from the past 24-48 hours
2. Identifying development patterns, challenges, and improvement areas
3. Generating a structured growth report
4. Curating relevant HackerNews learning resources
5. Delivering the report (email, saved file, or terminal display)

## When to Use

- Want to understand your development patterns from recent work
- Need to identify specific technical gaps or recurring challenges
- Looking for learning resources tailored to your actual work
- Want structured feedback without waiting for code reviews

---

## Workflow

### Step 1: Read Chat History

Read the chat history file at `~/.claude/projects/*/history.jsonl`.

**File Format:** JSONL where each line contains:
- `display`: The user's message/request
- `project`: Project being worked on
- `timestamp`: Unix timestamp in milliseconds
- `pastedContents`: Any code or content pasted

**Filter:** Only include entries from the past 24-48 hours based on current timestamp.

```python
# Example: Calculate 48-hour cutoff
import time
cutoff_ms = (time.time() - 48 * 3600) * 1000
# Filter: entry['timestamp'] > cutoff_ms
```

### Step 2: Analyze Work Patterns

Extract and categorize the following from filtered chats:

**Projects/Domains:**
- Backend, frontend, DevOps, data, mobile, etc.
- Note which domains appear most frequently

**Technologies:**
- Languages: Python, TypeScript, JavaScript, Go, etc.
- Frameworks: React, FastAPI, Django, Express, etc.
- Tools: Docker, Git, databases, APIs, etc.

**Problem Types:**
- Performance optimization
- Debugging and error fixing
- Feature implementation
- Refactoring and cleanup
- Setup and configuration
- Architecture decisions

**Challenges Encountered:**
- Repeated questions about similar topics
- Problems requiring multiple attempts to solve
- Questions indicating knowledge gaps
- Complex decisions requiring guidance

**Approach Patterns:**
- Methodical: step-by-step, planned approach
- Exploratory: trying different solutions
- Experimental: testing hypotheses

### Step 3: Identify Improvement Areas

Based on the analysis, identify 3-5 specific areas for improvement.

**Requirements for each area:**
- **Specific**: Not vague like "improve coding skills"
- **Evidence-based**: Grounded in actual chat history
- **Actionable**: Practical improvements possible
- **Prioritized**: Most impactful first

**Good Examples:**
- "Advanced TypeScript patterns (generics, utility types) - struggled with type safety in [project]"
- "Error handling patterns - multiple bugs related to missing null checks"
- "Async/await patterns - race conditions and timing issues observed"
- "Database query optimization - same query rewritten multiple times"
- "Git workflow - merge conflicts and branch management challenges"

**Bad Examples:**
- "Get better at coding" (too vague)
- "Learn more frameworks" (not evidence-based)
- "Write better tests" (not specific enough)

### Step 4: Generate Report

Create the report with this structure:

```markdown
# Your Developer Growth Report

**Report Period**: [Start Date] - [End Date]
**Last Updated**: [Current Date and Time]

## Work Summary

[2-3 paragraphs summarizing:
- What projects you worked on
- Technologies and tools used
- Types of problems solved
- Overall focus areas]

## Improvement Areas (Prioritized)

### 1. [Area Name]

**Why This Matters**: [Explanation of why this skill is important for your work]

**What I Observed**: [Specific evidence from chat history - quote or describe actual interactions]

**Recommendation**: [Concrete steps to improve in this area]

**Time to Skill Up**: [Brief estimate: 2-4 hours, 5-8 hours, 10+ hours]

---

### 2. [Next Area]
[Same structure...]

---

### 3. [Next Area]
[Same structure...]

## Strengths Observed

- [Strength 1 - things you're doing well]
- [Strength 2 - continue doing these]
- [Strength 3 - build on these]

## Action Items

Priority order:
1. [Most important action from top improvement area]
2. [Action from second area]
3. [Action from third area]
4. [Optional: longer-term action item]

## Curated Learning Resources

[Populated in next step]
```

### Step 5: Search Learning Resources

Use WebSearch to find HackerNews articles for each improvement area.

**Search Strategy:**

For each improvement area, run 1-2 searches:

```
# Primary search - site-specific
"[Technology/Pattern] best practices" site:news.ycombinator.com

# Backup search - broader
[Technology] tutorial advanced techniques HackerNews
```

**Example Searches:**
- "TypeScript generics best practices" site:news.ycombinator.com
- "async await patterns JavaScript" HackerNews
- "database query optimization PostgreSQL" programming tutorial

**Select Resources:**
- Prioritize posts with high engagement (comments indicate quality)
- Choose 2-3 most relevant articles per improvement area
- Include publication date when available
- Write a brief description of why each is relevant

**Add to Report:**

```markdown
## Curated Learning Resources

### For: [Improvement Area 1]

1. **[Article Title]** - [Date if available]
   [1-2 sentence description of what it covers and why it's relevant]
   [Link]

2. **[Article Title]** - [Date if available]
   [Description]
   [Link]

### For: [Improvement Area 2]
[Same format...]
```

### Step 6: Deliver Report

Deliver the report using the best available method. Always display a summary in terminal, then use additional delivery based on user preference and available tools.

#### Delivery Priority

```
1. Check user preference (if specified)
2. Check Gmail MCP availability
3. Fall back to file + terminal display
```

#### Option A: Email via Google Workspace MCP (if available)

**Check for MCP tools:**
- Look for `gmail_send` or `gmail_create_draft` tool
- If available, Google Workspace MCP is configured

**Send email:**
- Use `gmail_send` tool with recipient, subject, and body
- Or use `gmail_create_draft` to review before sending

**Email Format:**
```
To: your-email@gmail.com (or authenticated account)
Subject: Developer Growth Report - [Date Range]

[Complete report - HTML formatted for readability]
```

#### Option B: Save to File (always works)

Save report to a dedicated directory for future reference:

```bash
# Create directory if needed
mkdir -p ~/.claude/growth-reports

# Save with date-stamped filename
~/.claude/growth-reports/YYYY-MM-DD-growth-report.md
```

**Benefits:**
- Always works, no MCP required
- Searchable history of past reports
- Can open in any markdown viewer
- Version control friendly

#### Option C: Terminal Display (always works)

Display the complete report directly in the conversation.

**When to use:**
- Quick review without saving
- Gmail MCP not available and user doesn't want file
- User explicitly requests terminal output

#### Delivery Flow

```
1. ALWAYS: Display brief summary in terminal
   - Report period
   - Top 3 improvement areas (titles only)
   - "Full report delivered via [method]"

2. ASK user preference (if not specified):
   "How would you like the full report?"
   - Email (requires Gmail MCP)
   - Save to file (~/.claude/growth-reports/)
   - Display here in terminal

3. DELIVER using chosen method

4. CONFIRM delivery:
   - Email: "Report sent to [email]"
   - File: "Report saved to [path]"
   - Terminal: [display full report]
```

#### If Google Workspace MCP Not Configured

When user requests email but MCP isn't available:

```
Google Workspace MCP not detected. To enable email delivery:

1. Create OAuth credentials at https://console.cloud.google.com/
2. Set environment variables (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET)
3. Run: claude mcp add google-workspace --transport stdio --scope user -- uvx workspace-mcp --tools gmail --single-user

Alternative delivery options:
- Save to file: ~/.claude/growth-reports/
- Display in terminal
```

---

## Example Usage

### Triggering the Skill

**Basic (asks for delivery preference):**
```
Analyze my developer growth from my recent chats
```

**With delivery preference:**
```
Analyze my coding patterns and email me the report
```

```
Review my work from the last 2 days, save to file
```

```
What should I improve? Just show me here in terminal
```

**Specific time range:**
```
Analyze my growth from today only
```

### Example Output (Abbreviated)

```markdown
# Your Developer Growth Report

**Report Period**: November 28-30, 2024
**Last Updated**: November 30, 2024, 3:45 PM

## Work Summary

Over the past two days, you focused primarily on backend development
with Python and FastAPI. Your work involved API design, database
integration with Supabase, and document processing pipelines...

## Improvement Areas (Prioritized)

### 1. Advanced Python Async Patterns

**Why This Matters**: Your backend heavily uses async operations,
and proper async patterns prevent performance bottlenecks and
race conditions.

**What I Observed**: In your document processing work, you had to
debug several issues related to concurrent database writes and
had questions about asyncio.gather vs sequential awaits.

**Recommendation**: Study Python's asyncio module in depth,
particularly task groups, semaphores for rate limiting, and
exception handling in concurrent code.

**Time to Skill Up**: 5-8 hours

---

### 2. Error Handling Strategies

**Why This Matters**: Robust error handling prevents cascading
failures and makes debugging easier.

**What I Observed**: Several bug fixes involved adding missing
try/except blocks and handling edge cases that weren't
initially considered.

**Recommendation**: Implement a consistent error handling
strategy across your codebase. Consider using custom exception
hierarchies and centralized error logging.

**Time to Skill Up**: 3-4 hours

## Strengths Observed

- Strong API design instincts - clean endpoint structures
- Good documentation practices - clear commit messages
- Effective debugging approach - systematic problem isolation

## Action Items

1. Review asyncio documentation and practice with task groups
2. Create error handling utilities for your project
3. Set up structured logging for better debugging

## Curated Learning Resources

### For: Advanced Python Async Patterns

1. **Understanding Python Asyncio: A Practical Guide** - Oct 2024
   Comprehensive walkthrough of asyncio patterns including
   task management, cancellation, and error handling.
   https://news.ycombinator.com/...

2. **Real-World Async Python: Lessons from Production** - Sep 2024
   Experience report on async patterns in production systems.
   https://news.ycombinator.com/...

### For: Error Handling Strategies

1. **Error Handling in Python: Beyond Try/Except** - Nov 2024
   Advanced error handling patterns including result types
   and functional error handling.
   https://news.ycombinator.com/...
```

---

## Tips and Best Practices

- **Run weekly**: Best results come from analyzing a week's worth of work
- **Focus on one area**: Pick the top improvement area and focus on it before moving to the next
- **Use the resources**: The curated articles are specifically chosen for your actual work patterns
- **Track progress**: Run the analysis again in a week to see how patterns change
- **Share with mentors**: The report provides concrete talking points for mentorship discussions

## Delivery Setup (Optional)

### Default: No Setup Required

The skill works out of the box with:
- **Terminal display**: Always available
- **File saving**: Always available (`~/.claude/growth-reports/`)

### Optional: Email via Google Workspace MCP (Recommended)

For email delivery, install [Google Workspace MCP](https://github.com/taylorwilsdon/google_workspace_mcp):

**Step 1: Create Google Cloud OAuth credentials**
1. Go to https://console.cloud.google.com/
2. Create project → Enable Gmail API
3. Create OAuth credentials (Desktop app)
4. Save Client ID and Client Secret

**Step 2: Set environment variables**
```bash
echo 'export GOOGLE_OAUTH_CLIENT_ID="your-client-id"' >> ~/.zshrc
echo 'export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"' >> ~/.zshrc
source ~/.zshrc
```

**Step 3: Add MCP to Claude Code**
```bash
claude mcp add google-workspace --transport stdio --scope user -- uvx workspace-mcp --tools gmail --single-user
```

**Step 4: Verify**
```
/mcp
```
Should show `google-workspace` as connected.

**Why Google Workspace MCP?**
- Production-ready OAuth 2.0 authentication
- Works without browser dependency
- Supports Gmail, Drive, Calendar, Docs, Sheets
- Created by Head of Corporate Engineering at Yelp
- 3.8k weekly downloads, most adopted solution

**Bonus: Add more Google services**
```bash
# Enable APIs in Google Cloud Console, then:
claude mcp remove google-workspace
claude mcp add google-workspace --transport stdio --scope user -- uvx workspace-mcp --tools gmail drive calendar docs --single-user
```

### Alternative: Browser-Based Gmail MCP

For simpler setup (no OAuth), consider [cafferychen777/gmail-mcp](https://github.com/cafferychen777/gmail-mcp):
- Uses Chrome extension + existing browser session
- No API keys required
- Requires Chrome with Gmail tabs open
