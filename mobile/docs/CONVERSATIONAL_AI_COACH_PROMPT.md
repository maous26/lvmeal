# Prompt pour Claude AI - Coach IA Conversationnel LYM

## Contexte du Projet

Tu vas travailler sur **LYM**, une application mobile de suivi nutritionnel et bien-être. LYM n'est pas un simple tracker de calories - c'est un **système nerveux intelligent** qui pense, corrèle et anticipe les besoins de l'utilisateur.

### Ce qui existe déjà (Système Décisionnel)

L'application dispose d'un **moteur décisionnel complet** :

1. **Caloric Bank** (`caloric-bank-store.ts`) - Gestion des calories avec système de "plaisir" hebdomadaire
2. **Wellness Store** (`wellness-store.ts`) - Suivi humeur, sommeil, stress, énergie, hydratation
3. **Gamification** (`gamification-store.ts`) - Streaks, XP, niveaux, achievements
4. **Challenges** (`weekly-challenges-service.ts`) - Défis hebdomadaires personnalisés
5. **Coach Proactif** (`coach-proactive-service.ts`) - Notifications contextuelles intelligentes
6. **Message Center** (`message-center.ts`) - Système de notifications priorisées
7. **Correlation Engine** - Détection de patterns (stress-eating, impact sommeil, etc.)

### Ce qu'on ajoute (Couche Conversationnelle)

La couche conversationnelle **ne remplace pas** le système existant. Elle le **complète** en exposant son intelligence via une interface de dialogue. Elle sert aussi de **fondation** pour le nouveau système conversationnel.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COUCHE CONVERSATIONNELLE (NOUVEAU)               │
│  Intent Detection → Signal Generation → Decision Bridge → Response  │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼ (orchestre et expose)
┌─────────────────────────────────────────────────────────────────────┐
│                    MOTEUR DÉCISIONNEL LYM (EXISTANT)                │
│  Caloric Bank │ Wellness │ Gamification │ Coach │ Correlations      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Implémentée

### Services Conversationnels (7 fichiers dans `src/services/`)

| Fichier | Responsabilité |
|---------|----------------|
| `conversation-intent-service.ts` | Détection d'intention par règles (25+ intents) |
| `conversation-safety-service.ts` | Garde-fou santé (TCA, conseils médicaux, etc.) |
| `conversation-signal-service.ts` | Transformation intent → signaux actionnables |
| `conversation-decision-service.ts` | Pont signaux → requêtes agents |
| `conversation-action-service.ts` | Whitelist d'actions + validation |
| `conversation-response-service.ts` | Génération de réponses (templates variés) |
| `conversation-context-service.ts` | Agrégation contexte (full + compact pour LLM) |

### Pipeline de Traitement

```
Message utilisateur
    │
    ▼
┌──────────────────┐
│  Safety Check    │ → Refuse/Redirect si danger (TCA, medical, etc.)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Intent Detection │ → Top-3 intents + entités + sentiment + urgence
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Signal Generation│ → Signaux actionnables (NUTRITIONAL_NEED, EMOTIONAL_STATE, etc.)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Decision Bridge  │ → Requêtes vers agents (meal_plan, coach, gamification, etc.)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Response Gen     │ → Message + Diagnosis + Actions + Quick Replies
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Action Validation│ → Whitelist stricte (10 actions autorisées)
└──────────────────┘
```

---

## Types et Structures Clés

### Intents (25 types)

```typescript
type UserIntent =
  // Besoins physiologiques
  | 'HUNGER' | 'CRAVING' | 'FATIGUE' | 'LOW_ENERGY' | 'THIRST'
  // États émotionnels
  | 'STRESS' | 'ANXIETY' | 'FRUSTRATION' | 'CELEBRATION' | 'SADNESS'
  // Information
  | 'PROGRESS_CHECK' | 'EXPLAIN_DECISION' | 'NUTRITION_QUESTION'
  // Actions
  | 'MEAL_SUGGESTION' | 'PLAN_MODIFICATION' | 'CHALLENGE_START' | 'PHASE_QUESTION' | 'LOG_MEAL'
  // Désengagement
  | 'OVERWHELM' | 'DOUBT' | 'PLATEAU'
  // Meta
  | 'GREETING' | 'FEEDBACK' | 'HELP' | 'UNKNOWN'
```

### Signaux (9 types)

```typescript
type SignalType =
  | 'NUTRITIONAL_NEED'    // Faim, soif, besoin énergétique
  | 'EMOTIONAL_STATE'     // Stress, anxiété, frustration
  | 'MOTIVATION_LEVEL'    // Doute, plateau, démotivation
  | 'KNOWLEDGE_GAP'       // Questions, demandes d'explication
  | 'DECISION_POINT'      // Choix à faire (repas, objectifs)
  | 'HABIT_DEVIATION'     // Pattern détecté (stress-eating, etc.)
  | 'GOAL_ALIGNMENT'      // Streak à risque, objectif menacé
  | 'CELEBRATION_MOMENT'  // Succès, achievement
  | 'SUPPORT_NEEDED'      // Besoin d'empathie et soutien
```

### Actions Whitelistées (10 types)

```typescript
type ActionType =
  | 'SUGGEST_MEAL'        // Suggestion de repas
  | 'LOG_MEAL_QUICK'      // Log rapide
  | 'ADJUST_CALORIES'     // Ajuster objectif (Premium, confirmation)
  | 'START_CHALLENGE'     // Démarrer défi (Premium, confirmation)
  | 'NAVIGATE_TO'         // Navigation dans l'app
  | 'SHOW_INSIGHT'        // Afficher insight
  | 'SCHEDULE_REMINDER'   // Programmer rappel (Premium, max 5/jour)
  | 'START_BREATHING'     // Exercice respiration
  | 'SHOW_PROGRESS'       // Afficher progression
  | 'CONTACT_SUPPORT'     // Contacter support
```

### Contexte (Full vs Compact)

**Full Context** (stocké localement) :
- Nutrition complète (calories, macros, repas, tendance)
- Wellness complet (humeur, sommeil, stress, énergie, hydratation)
- Corrélations détectées
- Programme en cours
- Gamification
- Historique conversation complet
- Infos temporelles

**Compact Context** (envoyé au LLM si nécessaire) :
```typescript
interface ConversationContextCompact {
  n: { cal: number; lastMeal: string; trend: 'D'|'B'|'S' }  // Nutrition
  w: { mood: string|null; energy: number|null; sleep: number|null }  // Wellness
  c: { stressEat: boolean; sleepImpact: boolean }  // Corrélations
  h: CompactTurn[]  // 3 derniers messages
  mem?: string  // Résumé mémoire
  t: { tod: 'M'|'D'|'A'|'E'|'N'; we: boolean }  // Temporel
}
```

---

## Principes de Design

### 1. Non-Culpabilisant
Le coach ne juge JAMAIS. Pas de "tu as trop mangé", mais "je comprends, c'était une journée difficile".

### 2. Safety First
Les signaux de danger (TCA, restriction extrême, conseils médicaux) sont détectés et redirigés vers des professionnels.

### 3. Transparence ("Pourquoi?")
L'utilisateur peut toujours voir POURQUOI le coach lui dit quelque chose via le toggle "Pourquoi?".

### 4. Actions Contrôlées
Le LLM ne peut PAS inventer d'actions. Seules les 10 actions whitelistées sont possibles.

### 5. Coût Optimisé
- 70% des requêtes : règles pures (coût $0)
- 25% : hybride règles + contexte (coût ~$0.001)
- 5% : LLM pour cas complexes Premium (coût ~$0.02)

### 6. Free vs Premium
| Feature | Free | Premium |
|---------|------|---------|
| Messages/jour | 10 | Illimité |
| Mode guidé (boutons) | ✅ | ✅ |
| Mode conversation libre | ❌ | ✅ |
| Diagnostic "Pourquoi?" | ❌ | ✅ |
| Plan court terme | ❌ | ✅ |
| Actions avancées | ❌ | ✅ |
| Appels LLM/jour | 1 | 20 |

---

## Ce qui reste à implémenter

### Priorité Haute

1. **Orchestrateur d'Agents Complet**
   - Actuellement : actions basiques
   - Manque : orchestration réelle avec `meal_plan_agent`, `wellness_program`, etc.
   - Fichier : `src/services/agent-orchestrator.ts` (à créer)

2. **Intégration LLM Réelle**
   - Actuellement : placeholder "// LLM would be called here"
   - Manque : appel API Claude pour cas complexes
   - Fichier : `conversation-intent-service.ts` (à compléter)

3. **Short Term Plan Generator**
   - Actuellement : structure définie, pas de logique
   - Manque : génération de plans "Maintenant → +30min → Aujourd'hui"
   - Fichier : `conversation-response-service.ts` (à compléter)

### Priorité Moyenne

4. **Correlation Engine Integration**
   - Actuellement : retourne arrays vides
   - Manque : connexion au service de corrélation existant
   - Fichier : `conversation-context-service.ts` (à connecter)

5. **Rich UI Cards**
   - Actuellement : structure définie
   - Manque : `meal_preview`, `correlation_insight`, `progress_chart` cards
   - Fichier : `ConversationUI.tsx` (à enrichir)

6. **Conversation Memory**
   - Actuellement : historique basique
   - Manque : résumé intelligent pour conversations longues
   - Fichier : `conversation-context-service.ts` (à implémenter)

### Priorité Basse

7. **Voice Input**
   - Feature flag existe
   - Manque : intégration speech-to-text

8. **Export Conversation**
   - Premium feature
   - À implémenter

---

## Exemple de Flow Complet

### Input : "J'ai faim et je suis crevé"

**1. Safety Check** → ✅ Allowed

**2. Intent Detection**
```json
{
  "topIntents": [
    { "intent": "HUNGER", "confidence": 0.92 },
    { "intent": "FATIGUE", "confidence": 0.88 },
    { "intent": "LOW_ENERGY", "confidence": 0.65 }
  ],
  "sentiment": "negative",
  "urgency": "medium"
}
```

**3. Signal Generation**
```json
[
  {
    "type": "NUTRITIONAL_NEED",
    "intensity": 0.7,
    "priority": "high",
    "relatedData": {
      "caloriesRemaining": 800,
      "hoursSinceLastMeal": 5,
      "suggestedMealType": "lunch"
    },
    "suggestedAgents": ["meal_plan_agent"]
  }
]
```

**4. Decision Requests**
```json
[
  {
    "agent": "meal_plan_agent",
    "action": "generate_suggestion",
    "params": {
      "mealType": "lunch",
      "caloriesBudget": 800,
      "tags": ["energy", "substantial"]
    }
  }
]
```

**5. Response**
```json
{
  "message": {
    "text": "Je comprends, 5h sans manger ça tire ! Tu as encore 800 kcal disponibles. Je te propose quelque chose qui va te redonner de l'énergie.",
    "tone": "empathetic",
    "emoji": "💪"
  },
  "diagnosis": {
    "summary": "Fatigue probablement liée au jeûne prolongé",
    "factors": [
      { "label": "Heures depuis dernier repas", "value": "5h", "impact": "high" },
      { "label": "Calories restantes", "value": "800", "impact": "medium" }
    ]
  },
  "actions": [
    { "type": "SUGGEST_MEAL", "label": "Voir la suggestion" },
    { "type": "LOG_MEAL_QUICK", "label": "J'ai déjà mangé" }
  ],
  "ui": {
    "quickReplies": [
      { "label": "Parfait", "intent": "LOG_MEAL" },
      { "label": "Autre chose", "action": "SUGGEST_MEAL" }
    ]
  }
}
```

---

## Instructions pour le Développeur

### Pour ajouter un nouvel Intent

1. Ajouter le type dans `src/types/conversation.ts`
2. Ajouter les patterns de détection dans `conversation-intent-service.ts`
3. Ajouter le mapping signal dans `conversation-signal-service.ts`
4. Ajouter les templates de réponse dans `conversation-response-service.ts`

### Pour ajouter une nouvelle Action

1. Ajouter le type dans `src/types/conversation.ts` (whitelist)
2. Définir les permissions (tier, risk, confirmation)
3. Ajouter la validation dans `conversation-action-service.ts`
4. Implémenter l'exécution dans l'UI

### Pour modifier le comportement Free/Premium

Modifier `CONVERSATION_TIERS` dans `src/types/conversation.ts`

---

## Fichiers Clés

```
src/
├── types/
│   └── conversation.ts              # Types centraux
├── services/
│   ├── conversation-intent-service.ts
│   ├── conversation-safety-service.ts
│   ├── conversation-signal-service.ts
│   ├── conversation-decision-service.ts
│   ├── conversation-action-service.ts
│   ├── conversation-response-service.ts
│   └── conversation-context-service.ts
├── stores/
│   └── conversation-store.ts        # État Zustand
└── components/
    └── conversation/
        ├── ConversationUI.tsx       # Composants UI
        └── ConversationScreen.tsx   # Écran principal
```

---

## Résumé

Le coach conversationnel LYM est un **pont intelligent** entre l'utilisateur et le moteur décisionnel existant. Il :

1. **Comprend** les besoins via la détection d'intention
2. **Protège** via les safety guards
3. **Traduit** en signaux actionnables
4. **Orchestre** les agents existants
5. **Répond** de manière personnalisée et non-culpabilisante
6. **Explique** son raisonnement sur demande

L'objectif : transformer un tracker passif en un **coach conversationnel empathique** qui dialogue, comprend, et agit avec l'utilisateur.
