---
name: meridian-lead-research
description: Identifies high-quality B2B leads for Skillia's AI-powered skills assessment platform. Use when finding companies for sales outreach, building prospect lists, or qualifying L&D department targets. Triggers on find leads, prospect companies, sales research, L&D buyers, HR leads, target accounts, ideal customer profile, pipeline building, lead qualification, company research for sales, find companies for Skillia.
---

# Meridian Lead Research

Research and qualify B2B leads for Skillia's AI-powered skills assessment and personalized learning platform.

## Product Context

**Skillia** is a smart, always-on career mentor + learning guide that:
- Analyzes employee skills through CV analysis and assessments
- Generates personalized learning paths for AI-readiness
- Helps companies upskill their workforce for an AI-heavy future

**Pricing**: €15-25/employee/month (B2B SaaS)
**Entry Point**: Paid pilots €3,000-5,000 for 3 months (50-100 users)

---

## Target Market

### Company Size
- **Sweet spot**: 300-2,000 employees
- Large enough for L&D budget, small enough for agile decisions

### Industries (All Active)
1. **Tech/Software** - AI adoption pressure, developer upskilling
2. **Healthcare/Biotech** - Workforce transformation, compliance training
3. **Manufacturing/Industry 4.0** - Automation skills gaps, reskilling
4. **Professional Services** - Continuous learning, AI tools adoption

### Geography
- **Primary**: Spain (Barcelona-based)
- **Expansion**: EU (France, Germany, Portugal)

### Key Buyers
- VP/Director of Learning & Development
- Chief People Officer / CHRO
- VP HR / Talent Development
- Director of Training

---

## Workflow

### Step 1: Context Gathering

Before searching, confirm with user:
- Specific industry focus for this search?
- Geographic constraints?
- Any specific companies to include/exclude?
- How many leads needed?

### Step 2: Search Strategy

Use WebSearch to find companies matching ICP. Search patterns:

```
# Industry + L&D signals
"[industry] companies" + "learning and development" + Spain
"[industry]" + "upskilling" + "workforce transformation"

# Job posting signals
site:linkedin.com "[company]" + "L&D Manager" OR "Learning Director"

# News signals
"[company]" + "digital transformation" + "training" + 2024

# Competitor users (displacement opportunities)
"[company]" + "LinkedIn Learning" OR "Coursera for Business"
```

### Step 3: ICP Scoring

Score each company 1-10 based on:

| Factor | Weight | What to Look For |
|--------|--------|------------------|
| Company Size | 25% | 300-2,000 employees = 10, outside range = lower |
| Industry Fit | 25% | Tech/Healthcare/Manufacturing/Services = 10 |
| Buying Signals | 30% | Job postings, news, digital transformation |
| Accessibility | 20% | Spain = 10, EU = 7, LinkedIn presence |

See [icp-framework.md](references/icp-framework.md) for detailed criteria.

### Step 4: Signal Detection

Look for active buying signals:

**Strong Signals (Score boost +2)**:
- Recent job posting for L&D/Training roles
- News about workforce transformation
- Announced AI adoption initiatives
- Recent funding round

**Moderate Signals (Score boost +1)**:
- Growing headcount (>20% YoY)
- New office/facility announcements
- Industry awards or recognition
- Active on LinkedIn about learning

**Negative Signals (Score penalty -2)**:
- Recent layoffs
- Financial difficulties
- Just purchased competitor solution
- < 200 employees

### Step 5: Lead Enrichment

For each qualified lead, gather:

1. **Company Info**
   - Full name, website, HQ location
   - Employee count (LinkedIn/Glassdoor)
   - Industry classification
   - Recent news (last 6 months)

2. **Decision Maker**
   - Name and title (VP L&D, CHRO, etc.)
   - LinkedIn profile URL
   - Recent posts/activity (conversation starters)

3. **Tech Stack**
   - Current LMS (if discoverable)
   - HR systems mentioned in job posts
   - Training partners mentioned

4. **Outreach Angle**
   - Specific pain point for this company
   - Relevant industry trends
   - Personalization hook

See [qualification-criteria.md](references/qualification-criteria.md) for scoring details.

### Step 6: Prioritize and Output

Rank leads by total score. Format output as:

```markdown
# Lead Research Results - [Date]

## Summary
- Total leads found: X
- High priority (8-10): X
- Medium priority (5-7): X
- Average fit score: X.X

---

## Lead 1: [Company Name]

**Website**: [URL]
**Priority Score**: X/10
**Industry**: [Industry]
**Size**: ~X employees
**Location**: [City, Country]

### Why They're a Fit
- [Specific reason 1 - with evidence]
- [Specific reason 2 - with evidence]
- [Specific reason 3 - with evidence]

### Target Decision Maker
**Name**: [Full Name]
**Title**: [Title]
**LinkedIn**: [URL]
**Recent Activity**: [Something they posted/shared - use as opener]

### Outreach Strategy
**Pain Point to Address**: [Specific to this company]
**Value Proposition**: [Tailored message]
**Pilot Pitch**: [Why 3-month pilot makes sense for them]

### Conversation Starters
1. [Specific opener based on their recent news/posts]
2. [Industry-relevant question or insight]
3. [Reference to similar company success]

---

[Repeat for each lead]
```

See [outreach-templates.md](references/outreach-templates.md) for messaging templates.

---

## Quick Reference: Industry Pain Points

| Industry | Top Pain Point | Skillia Value Prop |
|----------|---------------|-------------------|
| Tech/Software | AI disrupting skills, retention | Future-proof workforce for AI era |
| Healthcare | Compliance + digital transition | Compliant upskilling at scale |
| Manufacturing | Automation anxiety, reskilling | Reskilling for automation era |
| Professional Services | Training vs billable hours | Learning without billable sacrifice |

---

## Example Usage

**User**: "Find 10 tech companies in Spain for Skillia outreach"

**Expected Response**:
1. Confirm scope (Spain only? Company size range?)
2. Search for Spanish tech companies 300-2,000 employees
3. Look for L&D signals and buying intent
4. Score and rank by ICP fit
5. Enrich with decision maker info
6. Output formatted lead list

---

## Reference Files

- **[icp-framework.md](references/icp-framework.md)** - Detailed ICP criteria, size tiers, industry specifics
- **[qualification-criteria.md](references/qualification-criteria.md)** - Scoring rubric, disqualifiers, tier examples
- **[outreach-templates.md](references/outreach-templates.md)** - Messaging by industry, pilot pitch, sequences

---

## Tips for Best Results

1. **Be specific** - "Tech companies in Barcelona 500-1000 employees" > "Find leads"
2. **Prioritize signals** - Recent L&D job postings are strongest indicator
3. **Quality over quantity** - 10 well-researched leads > 50 shallow ones
4. **Personalization matters** - Each lead should have unique outreach angle
5. **Follow the pilot path** - Position for €3-5K pilot, not full deployment
