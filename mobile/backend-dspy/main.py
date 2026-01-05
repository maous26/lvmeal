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

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
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


@app.get("/", response_class=HTMLResponse)
async def root():
    """
    Root endpoint - handles both API info and Supabase auth redirects.
    Supabase redirects with fragment (#access_token=...) which JavaScript handles.
    """
    return """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LYM</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }
        .icon.success { background: #10B981; }
        .icon.info { background: #667eea; }
        .icon svg {
            width: 40px;
            height: 40px;
            stroke: white;
            fill: none;
        }
        h1 {
            color: #1F2937;
            font-size: 24px;
            margin-bottom: 12px;
        }
        p {
            color: #6B7280;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
        }
        .note {
            margin-top: 20px;
            font-size: 14px;
            color: #9CA3AF;
        }
        .api-info { display: none; }
        .auth-success { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <!-- API Info (shown when no auth fragment) -->
        <div class="api-info" id="apiInfo">
            <div class="icon info">
                <svg viewBox="0 0 24 24" stroke-width="2">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <h1>LYM API</h1>
            <p>Service backend pour l'application LYM.</p>
            <a href="/docs" class="btn">Documentation API</a>
        </div>

        <!-- Auth Success (shown when auth fragment detected) -->
        <div class="auth-success" id="authSuccess">
            <div class="icon success">
                <svg viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <h1>Email vérifié !</h1>
            <p>Ton compte LYM est maintenant activé. Tu peux retourner dans l'application pour te connecter.</p>
            <a href="#" class="btn" id="openAppBtn">Ouvrir LYM</a>
            <p class="note">Si le bouton ne fonctionne pas, ouvre l'app LYM manuellement.</p>
        </div>
    </div>

    <script>
        // Check if we have auth tokens in the URL fragment
        var hash = window.location.hash;
        if (hash && (hash.includes('access_token') || hash.includes('type=signup') || hash.includes('type=recovery'))) {
            // Show auth success view
            document.getElementById('authSuccess').style.display = 'block';
            document.getElementById('apiInfo').style.display = 'none';

            // Build deep link with the fragment params
            var params = hash.substring(1); // Remove the #
            var deepLink = 'lym://auth/callback?' + params;

            // Update button href
            document.getElementById('openAppBtn').href = deepLink;

            // Try to open app automatically after delay
            setTimeout(function() {
                window.location.href = deepLink;
            }, 1500);
        } else {
            // Show API info
            document.getElementById('apiInfo').style.display = 'block';
            document.getElementById('authSuccess').style.display = 'none';
        }
    </script>
</body>
</html>"""


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    """Privacy policy page for Google Play Store"""
    return """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Politique de Confidentialité - LYM</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        h1 { color: #0077B6; }
        h2 { color: #0096C7; margin-top: 30px; }
        .last-updated { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>Politique de Confidentialité</h1>
    <p class="last-updated">Dernière mise à jour : 4 janvier 2025</p>
    <p>LYM ("nous", "notre", "l'application") s'engage à protéger votre vie privée. Cette politique explique comment nous collectons, utilisons et protégeons vos données.</p>
    <h2>1. Données collectées</h2>
    <p>L'application peut collecter les types de données suivants :</p>
    <ul>
        <li><strong>Informations de profil</strong> : âge, sexe, poids, taille, niveau d'activité (stockées localement sur votre appareil)</li>
        <li><strong>Données nutritionnelles</strong> : repas enregistrés, objectifs caloriques (stockées localement)</li>
        <li><strong>Photos</strong> : uniquement lorsque vous utilisez la fonction de scan d'aliments (traitées pour analyse, non conservées)</li>
        <li><strong>Compte Google</strong> : si vous choisissez la synchronisation cloud, votre email est utilisé pour l'authentification</li>
    </ul>
    <h2>2. Utilisation de la caméra</h2>
    <p>L'application utilise l'accès à la caméra pour :</p>
    <ul>
        <li>Scanner les codes-barres des produits alimentaires</li>
        <li>Photographier vos repas pour analyse nutritionnelle automatique</li>
    </ul>
    <p>Les photos sont traitées pour extraire les informations nutritionnelles et ne sont pas stockées sur nos serveurs.</p>
    <h2>3. Stockage des données</h2>
    <p>Par défaut, toutes vos données sont stockées <strong>localement sur votre appareil</strong>. Si vous activez la synchronisation cloud :</p>
    <ul>
        <li>Vos données sont chiffrées et stockées de manière sécurisée</li>
        <li>Vous pouvez supprimer vos données à tout moment depuis l'application</li>
    </ul>
    <h2>4. Partage des données</h2>
    <p>Nous ne vendons ni ne partageons vos données personnelles avec des tiers, sauf :</p>
    <ul>
        <li>Pour fournir les fonctionnalités de l'application (ex: API d'analyse nutritionnelle)</li>
        <li>Si requis par la loi</li>
    </ul>
    <h2>5. Services tiers</h2>
    <p>L'application peut utiliser des services tiers pour :</p>
    <ul>
        <li><strong>Authentification</strong> : Google Sign-In</li>
        <li><strong>Analyse nutritionnelle</strong> : OpenAI API (les données sont anonymisées)</li>
        <li><strong>Base de données alimentaires</strong> : Open Food Facts</li>
    </ul>
    <h2>6. Vos droits</h2>
    <p>Vous avez le droit de :</p>
    <ul>
        <li>Accéder à vos données personnelles</li>
        <li>Rectifier vos données</li>
        <li>Supprimer vos données (effacer toutes les données depuis les paramètres)</li>
        <li>Retirer votre consentement à tout moment</li>
    </ul>
    <h2>7. Sécurité</h2>
    <p>Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données contre tout accès non autorisé.</p>
    <h2>8. Contact</h2>
    <p>Pour toute question concernant cette politique de confidentialité, contactez-nous à :</p>
    <p><strong>Email</strong> : contact@lym-app.com</p>
    <h2>9. Modifications</h2>
    <p>Nous nous réservons le droit de modifier cette politique. Les utilisateurs seront informés de tout changement significatif.</p>
</body>
</html>"""


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


# ============= AUTH CALLBACK ENDPOINTS =============

@app.get("/auth/callback", response_class=HTMLResponse)
async def auth_callback(request: Request):
    """
    Handle Supabase email verification callback.
    Displays a success page and redirects to the app via deep link.
    """
    # Get query params from Supabase
    params = dict(request.query_params)

    # Build deep link URL with tokens
    deep_link = "lym://auth/callback"
    if params:
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        deep_link = f"{deep_link}?{query_string}"

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email vérifié - LYM</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        .container {{
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }}
        .icon {{
            width: 80px;
            height: 80px;
            background: #10B981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }}
        .icon svg {{
            width: 40px;
            height: 40px;
            color: white;
        }}
        h1 {{
            color: #1F2937;
            font-size: 24px;
            margin-bottom: 12px;
        }}
        p {{
            color: #6B7280;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 24px;
        }}
        .btn {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }}
        .note {{
            margin-top: 20px;
            font-size: 14px;
            color: #9CA3AF;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        </div>
        <h1>Email vérifié !</h1>
        <p>Ton compte LYM est maintenant activé. Tu peux retourner dans l'application pour te connecter.</p>
        <a href="{deep_link}" class="btn">Ouvrir LYM</a>
        <p class="note">Si le bouton ne fonctionne pas, ouvre l'app LYM manuellement.</p>
    </div>
    <script>
        // Try to open the app automatically after a short delay
        setTimeout(function() {{
            window.location.href = "{deep_link}";
        }}, 1500);
    </script>
</body>
</html>"""


@app.get("/auth/reset-password", response_class=HTMLResponse)
async def auth_reset_password(request: Request):
    """
    Handle Supabase password reset callback.
    Displays a page to redirect to the app for password change.
    """
    params = dict(request.query_params)

    # Build deep link URL with tokens
    deep_link = "lym://auth/reset-password"
    if params:
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        deep_link = f"{deep_link}?{query_string}"

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialiser le mot de passe - LYM</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        .container {{
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }}
        .icon {{
            width: 80px;
            height: 80px;
            background: #8B5CF6;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }}
        .icon svg {{
            width: 40px;
            height: 40px;
            color: white;
        }}
        h1 {{
            color: #1F2937;
            font-size: 24px;
            margin-bottom: 12px;
        }}
        p {{
            color: #6B7280;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 24px;
        }}
        .btn {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }}
        .note {{
            margin-top: 20px;
            font-size: 14px;
            color: #9CA3AF;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
            </svg>
        </div>
        <h1>Réinitialiser le mot de passe</h1>
        <p>Clique sur le bouton ci-dessous pour ouvrir l'application et choisir un nouveau mot de passe.</p>
        <a href="{deep_link}" class="btn">Ouvrir LYM</a>
        <p class="note">Si le bouton ne fonctionne pas, ouvre l'app LYM manuellement.</p>
    </div>
    <script>
        // Try to open the app automatically after a short delay
        setTimeout(function() {{
            window.location.href = "{deep_link}";
        }}, 1500);
    </script>
</body>
</html>"""


# ============= RUN =============

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
