"""
DSPy Backend API for LYM RAG System

FastAPI server exposing DSPy modules as REST endpoints.
Designed to be called from the React Native app via lymia-brain.ts
"""

import os
import json
import logging
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import diskcache

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============= CACHE SETUP =============

CACHE_DIR = os.getenv("CACHE_DIR", "/tmp/lym_dspy_cache")
cache = diskcache.Cache(CACHE_DIR)
CACHE_TTL = 3600  # 1 hour


def get_cache_key(endpoint: str, data: dict) -> str:
    """Generate cache key from endpoint and request data"""
    import hashlib
    data_str = json.dumps(data, sort_keys=True)
    return f"{endpoint}:{hashlib.md5(data_str.encode()).hexdigest()}"


# ============= REQUEST/RESPONSE MODELS =============

class UserContextRequest(BaseModel):
    goal: str = Field(default="maintain", description="User goal")
    age: Optional[int] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    sleep_hours: Optional[float] = None
    stress_level: Optional[int] = None
    calories_today: Optional[int] = None
    target_calories: Optional[int] = None
    recent_patterns: Optional[List[str]] = None


class RewriteQueryRequest(BaseModel):
    question: str = Field(..., description="User's question in French")
    user_context: UserContextRequest = Field(default_factory=UserContextRequest)


class RewriteQueryResponse(BaseModel):
    search_queries: List[str]
    category_filter: str
    source_priority: List[str]
    cached: bool = False


class Passage(BaseModel):
    id: str
    content: str
    source: str
    similarity: float = 0.0


class SelectEvidenceRequest(BaseModel):
    question: str
    passages: List[Passage]
    user_context: UserContextRequest = Field(default_factory=UserContextRequest)


class SelectEvidenceResponse(BaseModel):
    selected_ids: List[str]
    relevance_scores: List[float]
    rationale: str
    cached: bool = False


class GenerateAnswerRequest(BaseModel):
    question: str
    evidence: List[Passage]
    user_context: UserContextRequest = Field(default_factory=UserContextRequest)


class GenerateAnswerResponse(BaseModel):
    answer: str
    citations_used: List[str]
    confidence: float
    cached: bool = False


class VerifyAnswerRequest(BaseModel):
    answer: str
    evidence: List[Passage]


class VerifyAnswerResponse(BaseModel):
    is_grounded: bool
    unsupported_claims: List[str]
    suggested_disclaimer: Optional[str]
    cached: bool = False


class FullPipelineRequest(BaseModel):
    """Request for full RAG pipeline (rewrite + select + generate + verify)"""
    question: str
    passages: List[Passage]
    user_context: UserContextRequest = Field(default_factory=UserContextRequest)
    skip_verification: bool = False


class FullPipelineResponse(BaseModel):
    """Response from full RAG pipeline"""
    # Query rewriting
    rewritten_queries: List[str]
    category: str
    source_priority: List[str]

    # Evidence selection
    selected_passage_ids: List[str]
    selection_rationale: str

    # Answer generation
    answer: str
    citations: List[str]
    confidence: float

    # Verification (optional)
    is_grounded: Optional[bool] = None
    unsupported_claims: Optional[List[str]] = None
    disclaimer: Optional[str] = None

    # Meta
    cached: bool = False


# ============= PIPELINE INITIALIZATION =============

# Global pipeline instance - initialized lazily
_pipeline = None
_pipeline_error = None


def get_pipeline():
    """Get or create the DSPy pipeline (lazy initialization)"""
    global _pipeline, _pipeline_error

    if _pipeline_error:
        raise HTTPException(status_code=503, detail=f"Pipeline initialization failed: {_pipeline_error}")

    if _pipeline is None:
        try:
            logger.info("[DSPy] Lazy loading pipeline...")
            from modules import create_pipeline
            model = os.getenv("DSPY_MODEL", "gpt-4o-mini")
            _pipeline = create_pipeline(model=model)
            logger.info(f"[DSPy] Pipeline ready with model: {model}")
        except Exception as e:
            _pipeline_error = str(e)
            logger.error(f"[DSPy] Pipeline initialization failed: {e}")
            raise HTTPException(status_code=503, detail=f"Pipeline initialization failed: {e}")

    return _pipeline


# ============= APP SETUP =============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("[DSPy] Starting LYM DSPy RAG API...")

    # Check if OPENAI_API_KEY is set
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("[DSPy] OPENAI_API_KEY not set! Pipeline will fail on first request.")
    else:
        logger.info("[DSPy] OPENAI_API_KEY configured")

    yield

    # Cleanup
    cache.close()
    logger.info("[DSPy] Shutdown complete")


app = FastAPI(
    title="LYM DSPy RAG API",
    description="DSPy-powered RAG pipeline for nutrition/wellness coaching",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= ENDPOINTS =============

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    global _pipeline, _pipeline_error

    api_key = os.getenv("OPENAI_API_KEY")

    return {
        "status": "healthy",
        "pipeline_ready": _pipeline is not None,
        "pipeline_error": _pipeline_error,
        "openai_configured": bool(api_key),
        "cache_size": len(cache),
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "LYM DSPy RAG API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/rewrite-query", response_model=RewriteQueryResponse)
async def rewrite_query(request: RewriteQueryRequest):
    """
    Rewrite user question into optimized search queries.
    """
    # Check cache
    cache_key = get_cache_key("rewrite", request.model_dump())
    cached_result = cache.get(cache_key)
    if cached_result:
        return RewriteQueryResponse(**cached_result, cached=True)

    try:
        pipe = get_pipeline()
        context_json = request.user_context.model_dump_json()
        result = pipe.rewrite_query(request.question, context_json)

        response_data = {
            "search_queries": result.search_queries,
            "category_filter": result.category_filter,
            "source_priority": result.source_priority,
        }

        cache.set(cache_key, response_data, expire=CACHE_TTL)
        return RewriteQueryResponse(**response_data, cached=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DSPy] Query rewriting failed: {e}")
        raise HTTPException(status_code=500, detail=f"Query rewriting failed: {str(e)}")


@app.post("/select-evidence", response_model=SelectEvidenceResponse)
async def select_evidence(request: SelectEvidenceRequest):
    """
    Select and rerank the most relevant passages.
    """
    # Check cache
    cache_key = get_cache_key("select", request.model_dump())
    cached_result = cache.get(cache_key)
    if cached_result:
        return SelectEvidenceResponse(**cached_result, cached=True)

    try:
        pipe = get_pipeline()
        passages_json = json.dumps([p.model_dump() for p in request.passages])
        context_json = request.user_context.model_dump_json()

        result = pipe.select_evidence(request.question, passages_json, context_json)

        response_data = {
            "selected_ids": result.selected_ids,
            "relevance_scores": result.relevance_scores,
            "rationale": result.rationale,
        }

        cache.set(cache_key, response_data, expire=CACHE_TTL)
        return SelectEvidenceResponse(**response_data, cached=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DSPy] Evidence selection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Evidence selection failed: {str(e)}")


@app.post("/generate-answer", response_model=GenerateAnswerResponse)
async def generate_answer(request: GenerateAnswerRequest):
    """
    Generate a grounded answer with mandatory citations.
    """
    # Check cache
    cache_key = get_cache_key("generate", request.model_dump())
    cached_result = cache.get(cache_key)
    if cached_result:
        return GenerateAnswerResponse(**cached_result, cached=True)

    try:
        pipe = get_pipeline()
        evidence_json = json.dumps([p.model_dump() for p in request.evidence])
        context_json = request.user_context.model_dump_json()

        result = pipe.generate_answer(request.question, evidence_json, context_json)

        response_data = {
            "answer": result.answer,
            "citations_used": result.citations_used,
            "confidence": result.confidence,
        }

        cache.set(cache_key, response_data, expire=CACHE_TTL)
        return GenerateAnswerResponse(**response_data, cached=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DSPy] Answer generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Answer generation failed: {str(e)}")


@app.post("/verify-answer", response_model=VerifyAnswerResponse)
async def verify_answer(request: VerifyAnswerRequest):
    """
    Verify that an answer is fully grounded in evidence.
    """
    # Check cache
    cache_key = get_cache_key("verify", request.model_dump())
    cached_result = cache.get(cache_key)
    if cached_result:
        return VerifyAnswerResponse(**cached_result, cached=True)

    try:
        pipe = get_pipeline()
        evidence_json = json.dumps([p.model_dump() for p in request.evidence])

        result = pipe.verify_answer(request.answer, evidence_json)

        response_data = {
            "is_grounded": result.is_grounded,
            "unsupported_claims": result.unsupported_claims,
            "suggested_disclaimer": result.suggested_disclaimer,
        }

        cache.set(cache_key, response_data, expire=CACHE_TTL)
        return VerifyAnswerResponse(**response_data, cached=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DSPy] Answer verification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Answer verification failed: {str(e)}")


@app.post("/pipeline", response_model=FullPipelineResponse)
async def full_pipeline(request: FullPipelineRequest):
    """
    Execute the full RAG pipeline in one call.
    """
    # Check cache
    cache_key = get_cache_key("pipeline", request.model_dump())
    cached_result = cache.get(cache_key)
    if cached_result:
        return FullPipelineResponse(**cached_result, cached=True)

    try:
        pipe = get_pipeline()
        context_json = request.user_context.model_dump_json()
        passages_json = json.dumps([p.model_dump() for p in request.passages])

        # Step 1: Rewrite query
        rewrite_result = pipe.rewrite_query(request.question, context_json)

        # Step 2: Select evidence
        select_result = pipe.select_evidence(request.question, passages_json, context_json)

        # Filter passages to selected ones
        selected_passages = [
            p for p in request.passages
            if p.id in select_result.selected_ids
        ]
        selected_json = json.dumps([p.model_dump() for p in selected_passages])

        # Step 3: Generate answer
        answer_result = pipe.generate_answer(request.question, selected_json, context_json)

        # Step 4: Verify (optional)
        verification = None
        if not request.skip_verification:
            verification = pipe.verify_answer(answer_result.answer, selected_json)

        response_data = {
            "rewritten_queries": rewrite_result.search_queries,
            "category": rewrite_result.category_filter,
            "source_priority": rewrite_result.source_priority,
            "selected_passage_ids": select_result.selected_ids,
            "selection_rationale": select_result.rationale,
            "answer": answer_result.answer,
            "citations": answer_result.citations_used,
            "confidence": answer_result.confidence,
        }

        if verification:
            response_data.update({
                "is_grounded": verification.is_grounded,
                "unsupported_claims": verification.unsupported_claims,
                "disclaimer": verification.suggested_disclaimer,
            })

        cache.set(cache_key, response_data, expire=CACHE_TTL)
        return FullPipelineResponse(**response_data, cached=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DSPy] Pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


@app.delete("/cache")
async def clear_cache():
    """Clear the response cache"""
    cache.clear()
    return {"status": "cache cleared"}


# ============= RUN =============

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
