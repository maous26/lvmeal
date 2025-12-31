"""
Simple FastAPI server for health checks.
Used to verify Railway deployment works.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="LYM DSPy RAG API",
    description="DSPy-powered RAG pipeline for nutrition/wellness coaching",
    version="1.0.0",
)

# CORS for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    api_key = os.getenv("OPENAI_API_KEY")
    return {
        "status": "healthy",
        "pipeline_ready": False,
        "openai_configured": bool(api_key),
        "message": "Simple mode - DSPy disabled"
    }


@app.get("/")
async def root():
    return {"message": "LYM DSPy API - Simple Mode"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
