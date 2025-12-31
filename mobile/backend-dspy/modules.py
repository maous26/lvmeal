"""
DSPy Modules for LYM RAG System

These modules optimize the RAG pipeline:
1. QueryRewriter - Transform user questions into optimal search queries
2. EvidenceSelector - Rerank and select most relevant passages
3. GroundedAnswer - Generate answers with mandatory citations
4. AnswerVerifier - Validate that answers are grounded in evidence
"""

import dspy
from typing import List, Optional
from pydantic import BaseModel, Field


# ============= PYDANTIC MODELS =============

class UserContext(BaseModel):
    """User context for personalization"""
    goal: str = Field(description="User goal: weight_loss, maintain, muscle_gain")
    age: Optional[int] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    sleep_hours: Optional[float] = None
    stress_level: Optional[int] = None
    calories_today: Optional[int] = None
    target_calories: Optional[int] = None
    recent_patterns: Optional[List[str]] = None


class RewrittenQuery(BaseModel):
    """Output of QueryRewriter"""
    search_queries: List[str] = Field(description="1-3 optimized search queries")
    category_filter: str = Field(description="Category: nutrition|wellness|metabolism|sport|health")
    source_priority: List[str] = Field(description="Preferred sources: anses|ciqual|inserm|has|pubmed")


class SelectedEvidence(BaseModel):
    """Output of EvidenceSelector"""
    selected_ids: List[str] = Field(description="IDs of selected passages")
    relevance_scores: List[float] = Field(description="Relevance score 0-1 for each")
    rationale: str = Field(description="Why these passages were selected")


class GroundedResponse(BaseModel):
    """Output of GroundedAnswer"""
    answer: str = Field(description="Answer with [source_id] citations inline")
    citations_used: List[str] = Field(description="List of passage IDs actually cited")
    confidence: float = Field(description="Confidence score 0-1")


class VerificationResult(BaseModel):
    """Output of AnswerVerifier"""
    is_grounded: bool = Field(description="True if all claims are supported")
    unsupported_claims: List[str] = Field(description="Claims without evidence")
    suggested_disclaimer: Optional[str] = Field(description="Disclaimer to add if not fully grounded")


# ============= DSPY SIGNATURES =============

class QueryRewriterSignature(dspy.Signature):
    """Rewrite user question for optimal RAG retrieval in French nutrition/wellness context."""

    user_question: str = dspy.InputField(desc="The user's original question in French")
    user_context: str = dspy.InputField(desc="JSON string of user profile, goals, recent data")

    search_queries: str = dspy.OutputField(desc="JSON array of 1-3 optimized French search queries")
    category_filter: str = dspy.OutputField(desc="Category: nutrition|wellness|metabolism|sport|health")
    source_priority: str = dspy.OutputField(desc="Comma-separated preferred sources: anses,ciqual,inserm,has,pubmed")


class EvidenceSelectorSignature(dspy.Signature):
    """Select the most relevant passages for answering a nutrition/wellness question."""

    question: str = dspy.InputField(desc="The user's question")
    passages: str = dspy.InputField(desc="JSON array of passages with id, content, source, similarity")
    user_context: str = dspy.InputField(desc="JSON string of user context for relevance")

    selected_ids: str = dspy.OutputField(desc="JSON array of selected passage IDs (3-5 max)")
    relevance_rationale: str = dspy.OutputField(desc="Why each passage was selected")


class GroundedAnswerSignature(dspy.Signature):
    """Generate an answer grounded in the provided evidence. Every factual claim MUST have [source_id] citation."""

    question: str = dspy.InputField(desc="The user's question in French")
    evidence: str = dspy.InputField(desc="JSON array of passages with id, content, source")
    user_context: str = dspy.InputField(desc="JSON string of user profile for personalization")

    answer: str = dspy.OutputField(desc="French answer with [source_id] citations inline for EVERY fact")
    citations: str = dspy.OutputField(desc="JSON array of passage IDs actually used in answer")
    confidence: str = dspy.OutputField(desc="Confidence score 0.0-1.0")


class AnswerVerifierSignature(dspy.Signature):
    """Verify that the answer is fully supported by the provided evidence."""

    answer: str = dspy.InputField(desc="The generated answer to verify")
    evidence: str = dspy.InputField(desc="JSON array of passages that were provided")

    is_grounded: str = dspy.OutputField(desc="true or false")
    unsupported_claims: str = dspy.OutputField(desc="JSON array of claims without evidence support")
    disclaimer: str = dspy.OutputField(desc="Disclaimer to add if not fully grounded, or empty string")


# ============= DSPY MODULES =============

class QueryRewriter(dspy.Module):
    """
    Transforms naive user questions into optimized retrieval queries.

    Example:
    - Input: "Pourquoi j'ai faim le soir?"
    - Context: {goal: weight_loss, sleep: 5h, stress: 8/10}
    - Output queries:
      1. "faim nocturne cortisol stress"
      2. "manque sommeil ghréline leptine"
      3. "envies sucrées soir déficit calorique"
    """

    def __init__(self):
        super().__init__()
        self.rewrite = dspy.ChainOfThought(QueryRewriterSignature)

    def forward(self, user_question: str, user_context: str) -> RewrittenQuery:
        result = self.rewrite(
            user_question=user_question,
            user_context=user_context
        )

        import json
        try:
            queries = json.loads(result.search_queries)
        except:
            queries = [result.search_queries]

        sources = [s.strip() for s in result.source_priority.split(',')]

        return RewrittenQuery(
            search_queries=queries,
            category_filter=result.category_filter,
            source_priority=sources
        )


class EvidenceSelector(dspy.Module):
    """
    Reranks retrieved passages to select the most relevant ones.
    Uses Chain-of-Thought for explainable selection.
    """

    def __init__(self):
        super().__init__()
        self.select = dspy.ChainOfThought(EvidenceSelectorSignature)

    def forward(self, question: str, passages: str, user_context: str) -> SelectedEvidence:
        result = self.select(
            question=question,
            passages=passages,
            user_context=user_context
        )

        import json
        try:
            ids = json.loads(result.selected_ids)
        except:
            ids = []

        # Generate relevance scores based on selection order
        scores = [1.0 - (i * 0.1) for i in range(len(ids))]

        return SelectedEvidence(
            selected_ids=ids,
            relevance_scores=scores,
            rationale=result.relevance_rationale
        )


class GroundedAnswerGenerator(dspy.Module):
    """
    Generates answers that MUST cite evidence for every factual claim.
    """

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(GroundedAnswerSignature)

    def forward(self, question: str, evidence: str, user_context: str) -> GroundedResponse:
        result = self.generate(
            question=question,
            evidence=evidence,
            user_context=user_context
        )

        import json
        try:
            citations = json.loads(result.citations)
        except:
            citations = []

        try:
            confidence = float(result.confidence)
        except:
            confidence = 0.7

        return GroundedResponse(
            answer=result.answer,
            citations_used=citations,
            confidence=confidence
        )


class AnswerVerifier(dspy.Module):
    """
    Validates that generated answers are truly grounded in evidence.
    """

    def __init__(self):
        super().__init__()
        self.verify = dspy.ChainOfThought(AnswerVerifierSignature)

    def forward(self, answer: str, evidence: str) -> VerificationResult:
        result = self.verify(
            answer=answer,
            evidence=evidence
        )

        import json
        is_grounded = result.is_grounded.lower() == 'true'

        try:
            unsupported = json.loads(result.unsupported_claims)
        except:
            unsupported = []

        disclaimer = result.disclaimer if result.disclaimer and result.disclaimer.strip() else None

        return VerificationResult(
            is_grounded=is_grounded,
            unsupported_claims=unsupported,
            suggested_disclaimer=disclaimer
        )


# ============= FULL RAG PIPELINE =============

class LYMRAGPipeline(dspy.Module):
    """
    Complete RAG pipeline combining all modules.

    Flow:
    1. QueryRewriter -> Optimized queries
    2. [External] Supabase retrieval
    3. EvidenceSelector -> Top passages
    4. GroundedAnswerGenerator -> Cited answer
    5. AnswerVerifier -> Validation
    """

    def __init__(self):
        super().__init__()
        self.query_rewriter = QueryRewriter()
        self.evidence_selector = EvidenceSelector()
        self.answer_generator = GroundedAnswerGenerator()
        self.verifier = AnswerVerifier()

    def rewrite_query(self, question: str, context: str) -> RewrittenQuery:
        return self.query_rewriter(question, context)

    def select_evidence(self, question: str, passages: str, context: str) -> SelectedEvidence:
        return self.evidence_selector(question, passages, context)

    def generate_answer(self, question: str, evidence: str, context: str) -> GroundedResponse:
        return self.answer_generator(question, evidence, context)

    def verify_answer(self, answer: str, evidence: str) -> VerificationResult:
        return self.verifier(answer, evidence)


# ============= INITIALIZATION =============

def create_pipeline(model: str = "gpt-4o-mini") -> LYMRAGPipeline:
    """
    Create and configure the RAG pipeline with specified model.

    Args:
        model: OpenAI model to use (gpt-4o-mini for cost efficiency)
    """
    import os

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")

    # Configure DSPy with OpenAI using LM class (DSPy 2.4+)
    # Format: 'openai/model-name' with api_key parameter
    lm = dspy.LM(
        f"openai/{model}",
        api_key=api_key,
        temperature=0.7,
        max_tokens=1000
    )
    dspy.configure(lm=lm)

    return LYMRAGPipeline()
