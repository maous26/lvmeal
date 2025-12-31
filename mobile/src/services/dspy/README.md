# DSPy Integration Plan for LYM RAG System

## Overview

DSPy (Declarative Self-improving Python) is a framework for optimizing LLM prompts programmatically. This document outlines how to integrate DSPy into the existing LYM RAG architecture **without breaking anything**.

## Current Architecture Analysis

### What We Have
- **Retriever**: Supabase pgvector with `text-embedding-3-small`
- **top-k**: 5 (default)
- **Reranker**: None (just cosine similarity sorting)
- **Orchestrator**: Custom Super Agent + LymIA Brain
- **Citations**: Partial (sometimes present, sometimes empty)

### Pain Points DSPy Will Fix
1. **Naive queries** - Raw user questions sent to embeddings
2. **No reranking** - Top-5 by cosine = potentially irrelevant passages
3. **Hallucinations** - AI generates without grounding verification
4. **Inconsistent citations** - Not systematically enforced

## Proposed DSPy Modules

### 1. QueryRewriter
**Purpose**: Transform user question + context into optimal retrieval queries

```python
class QueryRewriter(dspy.Signature):
    """Rewrite user question for optimal RAG retrieval."""

    user_question = dspy.InputField(desc="The user's original question")
    user_context = dspy.InputField(desc="User profile, goals, recent meals, wellness data")

    search_queries = dspy.OutputField(desc="List of 1-3 optimized search queries")
    category_filter = dspy.OutputField(desc="Category to filter: nutrition|wellness|metabolism|sport|health")
    source_priority = dspy.OutputField(desc="Preferred sources: anses|ciqual|inserm|has|pubmed")
```

**Example**:
- Input: "Pourquoi j'ai faim le soir?"
- Context: `{goal: weight_loss, sleep: 5h, stress: 8/10}`
- Output queries:
  1. "faim nocturne cortisol stress"
  2. "manque sommeil ghréline leptine"
  3. "envies sucrées soir déficit calorique"
- Category: `wellness`
- Source priority: `inserm, anses`

### 2. EvidenceSelector (Reranker)
**Purpose**: Select truly relevant passages from retrieval results

```python
class EvidenceSelector(dspy.Signature):
    """Select the most relevant passages for answering the question."""

    question = dspy.InputField(desc="The user's question")
    passages = dspy.InputField(desc="Retrieved passages from knowledge base")

    selected_passages = dspy.OutputField(desc="Top 3-5 most relevant passages with IDs")
    relevance_rationale = dspy.OutputField(desc="Why each passage was selected")
```

**Key**: Uses Chain-of-Thought to explain selection, making it auditable.

### 3. GroundedAnswer
**Purpose**: Generate answer that MUST cite passages

```python
class GroundedAnswer(dspy.Signature):
    """Generate an answer grounded in the provided evidence."""

    question = dspy.InputField(desc="The user's question")
    evidence = dspy.InputField(desc="Selected passages with their IDs")
    user_context = dspy.InputField(desc="User profile for personalization")

    answer = dspy.OutputField(desc="The answer, with [source_id] citations inline")
    citations = dspy.OutputField(desc="List of passage IDs actually used")
    confidence = dspy.OutputField(desc="0-1 confidence score")
```

**Constraint**: Every factual claim must have `[source_id]` citation.

### 4. AnswerVerifier (Optional but recommended)
**Purpose**: Validate that answer is truly grounded

```python
class AnswerVerifier(dspy.Signature):
    """Verify that the answer is fully supported by evidence."""

    answer = dspy.InputField(desc="The generated answer")
    evidence = dspy.InputField(desc="The passages that were provided")

    is_grounded = dspy.OutputField(desc="Boolean: true if all claims are supported")
    unsupported_claims = dspy.OutputField(desc="List of claims without evidence support")
    suggested_disclaimer = dspy.OutputField(desc="Disclaimer to add if not fully grounded")
```

## Integration Points

### Where to Hook DSPy

```
lymia-brain.ts
│
├── queryKB() ← HOOK DSPy QueryRewriter BEFORE this
│
├── buildKBContext() ← HOOK DSPy EvidenceSelector AFTER retrieval
│
├── openai.chat.completions.create() ← REPLACE with DSPy GroundedAnswer
│
└── return response ← HOOK DSPy AnswerVerifier BEFORE return
```

### File Changes Required

1. **New file**: `mobile/src/services/dspy/dspy-modules.ts`
   - TypeScript wrappers calling Python DSPy backend

2. **New file**: `backend/dspy/modules.py`
   - Actual DSPy module definitions

3. **Modify**: `mobile/src/services/lymia-brain.ts`
   - Add DSPy hooks at key points

4. **Modify**: `mobile/src/services/supabase-client.ts`
   - Increase top-k from 5 to 10 (reranking will filter)

## Backend Architecture

Since DSPy is Python-only, we need a Python backend:

```
┌─────────────────────────────────────────────┐
│           React Native App                   │
│                                              │
│  lymia-brain.ts                             │
│       │                                      │
│       ▼ HTTP/REST                           │
└───────┼─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│         Python DSPy Backend                  │
│         (FastAPI / Supabase Function)        │
│                                              │
│  /rewrite-query                             │
│  /select-evidence                           │
│  /generate-answer                           │
│  /verify-answer                             │
└─────────────────────────────────────────────┘
```

### Option A: Supabase Edge Function (Deno + Python)
- Pro: Already have Supabase
- Con: Deno, not native Python (need wrapper)

### Option B: Railway/Render Python Service
- Pro: Native Python, easy DSPy setup
- Con: Additional service to maintain

### Option C: Modal.com Serverless
- Pro: Zero infra, pay per call, native Python
- Con: Cold starts

**Recommendation**: Start with Railway (simple Python FastAPI), migrate to Modal if costs become issue.

## Dataset for Optimization

DSPy needs examples to optimize prompts. Create dataset from:

1. **Coach chat logs** (if you have them)
2. **Manual examples** (50-100 is enough)
3. **Synthetic generation** from existing KB

### Dataset Schema

```json
{
  "id": "example_001",
  "question": "Pourquoi j'ai des fringales le soir?",
  "user_context": {
    "goal": "weight_loss",
    "sleep_hours": 5,
    "stress_level": 8,
    "calories_today": 1200,
    "target_calories": 1800
  },
  "expected_queries": [
    "fringales soir cortisol",
    "manque sommeil faim hormone",
    "déficit calorique envies"
  ],
  "relevant_passages": ["kb_123", "kb_456", "kb_789"],
  "expected_answer": "Les fringales du soir peuvent avoir plusieurs causes...",
  "expected_citations": ["kb_123", "kb_456"]
}
```

## Metrics for Optimization

DSPy optimizes based on metrics. Define:

1. **Retrieval Quality**
   - Recall@5: Are relevant passages in top 5?
   - MRR: Is the best passage ranked first?

2. **Answer Quality**
   - Citation coverage: % of claims with citations
   - Factual accuracy: Manual validation on sample
   - User satisfaction: Thumbs up/down feedback

3. **Format Compliance**
   - JSON validity for structured outputs
   - Citation format correctness

## Implementation Phases

### Phase 1: Backend Setup (1-2 days)
- [ ] Create Python FastAPI backend
- [ ] Install DSPy + dependencies
- [ ] Define basic modules (no optimization yet)
- [ ] Deploy to Railway

### Phase 2: Integration (2-3 days)
- [ ] Add HTTP client to lymia-brain.ts
- [ ] Hook QueryRewriter before retrieval
- [ ] Hook EvidenceSelector after retrieval
- [ ] Hook GroundedAnswer for generation

### Phase 3: Dataset Creation (1-2 days)
- [ ] Extract 50 examples from logs/manual
- [ ] Format as DSPy dataset
- [ ] Split train/val/test

### Phase 4: Optimization (1-2 days)
- [ ] Run DSPy compile with MIPRO or BootstrapFewShot
- [ ] Evaluate on test set
- [ ] Deploy optimized prompts

### Phase 5: Verification Module (optional)
- [ ] Add AnswerVerifier
- [ ] Connect to uncertainty display in UI

## Cost Analysis

### Current (without DSPy)
- 1 embedding call per query
- 1 GPT-4o call for answer
- **Total**: ~$0.01-0.02 per query

### With DSPy
- 1 embedding call per query (same)
- 1 rewrite call (gpt-4o-mini): +$0.001
- 1 rerank call (gpt-4o-mini): +$0.002
- 1 answer call (gpt-4o): same
- 1 verify call (gpt-4o-mini): +$0.001
- **Total**: ~$0.015-0.025 per query (+25-50%)

### Optimization Opportunity
- Use gpt-4o-mini for rewrite/rerank/verify
- Only gpt-4o for final answer
- Cache rewritten queries (many repeats)

## Files to Create

```
mobile/src/services/dspy/
├── README.md (this file)
├── types.ts              # TypeScript types for DSPy responses
├── client.ts             # HTTP client to call DSPy backend
└── integration.ts        # Hooks into lymia-brain.ts

backend/dspy/
├── requirements.txt      # dspy-ai, fastapi, uvicorn
├── main.py              # FastAPI endpoints
├── modules.py           # DSPy module definitions
├── metrics.py           # Custom metrics for optimization
└── dataset/
    └── examples.json    # Training examples
```

## Next Steps

1. **Confirm architecture** - Review this plan
2. **Create Python backend** - FastAPI + DSPy
3. **Start with QueryRewriter only** - Smallest integration
4. **Measure improvement** - A/B test with/without
5. **Expand gradually** - Add other modules

## References

- [DSPy Documentation](https://dspy-docs.vercel.app/)
- [DSPy GitHub](https://github.com/stanfordnlp/dspy)
- [RAG Best Practices](https://www.anthropic.com/research/rag-best-practices)
