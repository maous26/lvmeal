-- Migration 002: Knowledge Base table for RAG
-- Stores embedded documents from French/European health sources

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  content TEXT NOT NULL,
  content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED,

  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding VECTOR(1536),

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'nutrition',      -- Alimentation, macros, calories
    'metabolism',     -- Metabolisme, relance metabolique
    'wellness',       -- Sommeil, stress, energie
    'sport',          -- Activite physique, programmes
    'health',         -- Sante generale
    'guidelines',     -- Recommandations officielles
    'recipes'         -- Recettes et preparations
  )),

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN (
    'anses',          -- ANSES / CIQUAL
    'inserm',         -- INSERM
    'has',            -- Haute Autorite de Sante
    'pubmed',         -- PubMed (etudes FR)
    'expert',         -- Base expert custom (relance metabolique)
    'gustar',         -- Gustar.io recipes
    'off'             -- Open Food Facts
  )),
  source_url TEXT,
  source_title TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en')),

  -- Quality & relevance
  quality_score FLOAT DEFAULT 1.0 CHECK (quality_score >= 0 AND quality_score <= 1),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search (IVFFlat for performance)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
  ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category
  ON knowledge_base (category);

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source
  ON knowledge_base (source);

-- Index for full-text search on content
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_trgm
  ON knowledge_base
  USING gin (content gin_trgm_ops);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category_source
  ON knowledge_base (category, source);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to search knowledge base by vector similarity
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_category TEXT DEFAULT NULL,
  filter_source TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  source TEXT,
  source_url TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    kb.category,
    kb.source,
    kb.source_url,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE
    (filter_category IS NULL OR kb.category = filter_category)
    AND (filter_source IS NULL OR kb.source = filter_source)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RLS (Row Level Security) - Enable for production
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to all authenticated users
CREATE POLICY "Allow read access to knowledge_base"
  ON knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow insert/update only to service role
CREATE POLICY "Allow service role to manage knowledge_base"
  ON knowledge_base
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
