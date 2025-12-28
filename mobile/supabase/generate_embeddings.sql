-- Script pour générer les embeddings via Edge Function
-- À exécuter dans le SQL Editor de Supabase

-- D'abord, créons une fonction pour appeler l'API OpenAI
-- Note: Cette approche nécessite une Edge Function

-- OPTION SIMPLE: Désactiver temporairement RLS et utiliser le script Node.js

-- 1. Désactiver RLS temporairement
ALTER TABLE knowledge_base DISABLE ROW LEVEL SECURITY;

-- 2. Vérifier les données
SELECT id, category, source, LEFT(content, 80) as content_preview,
       CASE WHEN embedding IS NULL THEN 'NON' ELSE 'OUI' END as has_embedding
FROM knowledge_base;

-- 3. Après avoir exécuté le script Node.js, réactiver RLS:
-- ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
