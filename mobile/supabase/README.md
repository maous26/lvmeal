# Supabase - LymIA RAG Backend

Backend Supabase pour le système RAG (Retrieval-Augmented Generation) de LymIA.

## Architecture

```
supabase/
├── config.toml              # Configuration Supabase
├── migrations/
│   ├── 001_enable_pgvector.sql    # Active pgvector
│   ├── 002_knowledge_base.sql     # Table des connaissances
│   └── 003_chat_history.sql       # Historique des conversations
├── functions/
│   └── rag-query/           # Edge Function pour les requêtes RAG
├── scripts/
│   └── ingest-embeddings.ts # Script d'ingestion des embeddings
└── seed.sql                 # Données initiales (connaissances expert)
```

## Installation

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Noter l'URL et les clés API

### 2. Configurer les variables d'environnement

Dans le fichier `.env` du projet mobile:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

### 3. Installer Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# npm
npm install -g supabase
```

### 4. Lier le projet

```bash
supabase login
supabase link --project-ref your-project-ref
```

### 5. Exécuter les migrations

```bash
supabase db push
```

### 6. Insérer les données initiales

```bash
# Via le Dashboard Supabase SQL Editor
# Copier-coller le contenu de seed.sql

# Ou via CLI
supabase db reset --db-url postgres://...
```

### 7. Générer les embeddings

```bash
cd mobile
npx ts-node supabase/scripts/ingest-embeddings.ts
```

### 8. Déployer l'Edge Function

```bash
supabase functions deploy rag-query
```

## Tables

### knowledge_base

Stocke les documents de connaissances avec leurs embeddings vectoriels.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Identifiant unique |
| content | TEXT | Contenu du document |
| embedding | VECTOR(1536) | Embedding OpenAI |
| category | TEXT | nutrition, metabolism, wellness, sport, health, guidelines, recipes |
| source | TEXT | anses, inserm, has, pubmed, expert, gustar, off |
| source_url | TEXT | URL source |
| metadata | JSONB | Métadonnées additionnelles |

### chat_history

Historique des conversations avec LymIA.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Identifiant unique |
| user_id | TEXT | ID utilisateur |
| conversation_id | UUID | Groupement de conversation |
| role | TEXT | user, assistant, system |
| content | TEXT | Contenu du message |
| context_used | JSONB | Contexte RAG utilisé |
| sources_cited | TEXT[] | Sources citées |

## Edge Function: rag-query

Endpoint pour les requêtes RAG.

### Request

```typescript
POST /functions/v1/rag-query

{
  "query": "Comment augmenter mon métabolisme?",
  "userId": "user-123",
  "conversationId": "conv-456", // optionnel
  "userContext": {
    "profile": { "age": 35, "weight": 75, "goal": "weight_loss" },
    "nutritionToday": { "calories": 1200, "targetCalories": 1800 },
    "wellness": { "sleepHours": 6, "stressLevel": 7 }
  },
  "options": {
    "category": "metabolism", // optionnel
    "maxResults": 5,
    "threshold": 0.7
  }
}
```

### Response

```typescript
{
  "answer": "Pour augmenter ton métabolisme...",
  "sources": [
    {
      "content": "La musculation augmente...",
      "source": "expert",
      "similarity": 0.89
    }
  ],
  "conversationId": "conv-456",
  "tokensUsed": 523
}
```

## Catégories de connaissances

| Catégorie | Description |
|-----------|-------------|
| nutrition | Alimentation, macros, calories |
| metabolism | Métabolisme, relance métabolique |
| wellness | Sommeil, stress, énergie |
| sport | Activité physique, programmes |
| health | Santé générale |
| guidelines | Recommandations officielles (PNNS) |
| recipes | Recettes et préparations |

## Sources fiables

| Source | Description |
|--------|-------------|
| anses | ANSES / CIQUAL - Nutrition officielle |
| inserm | INSERM - Recherche médicale |
| has | HAS - Recommandations santé |
| pubmed | PubMed - Études scientifiques |
| expert | Base expert custom |
| gustar | Gustar.io - Recettes enrichies |
| off | Open Food Facts |

## Coûts estimés (1000 utilisateurs/mois)

| Service | Coût |
|---------|------|
| Supabase Pro | 25€ |
| OpenAI GPT-4o-mini | ~200€ |
| OpenAI Embeddings | ~50€ |
| Stockage vectors | ~50€ |
| **Total** | **~325€/mois** |
