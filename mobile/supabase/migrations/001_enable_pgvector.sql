-- Migration 001: Enable pgvector extension
-- Enables vector similarity search for RAG (Retrieval-Augmented Generation)

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
