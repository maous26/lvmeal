# Architecture du Coach IA Conversationnel LYM

## Vision Stratégique

**LYM n'est pas un chatbot nutritionnel. C'est un système nerveux intelligent qui dialogue.**

La différence fondamentale : un chatbot répond à des questions. LYM *pense*, *corrèle*, *anticipe*, et maintenant *dialogue* avec son utilisateur pour exposer ce raisonnement et permettre une co-construction des décisions.

---

## 1. Architecture de Connexion au Système Existant

### 1.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COUCHE CONVERSATIONNELLE                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Intent    │  │  Dialogue   │  │  Response   │                 │
│  │  Detector   │──│   Manager   │──│  Generator  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│         │               │                │                          │
│         └───────────────┼────────────────┘                          │
│                         │                                           │
│                         ▼                                           │
│              ┌─────────────────────┐                                │
│              │   ACTION EXECUTOR   │                                │
│              │  (Bridge to System) │                                │
│              └─────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MOTEUR DÉCISIONNEL LYM                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     CONTEXT AGGREGATOR                        │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │  │
│  │  │ Caloric │ │ Wellness│ │ Gamifi- │ │  User   │            │  │
│  │  │  Bank   │ │  Store  │ │ cation  │ │  Store  │            │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │  │
│  │       └───────────┴───────────┴───────────┘                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    AGENTS & TRIGGERS                          │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │  │
│  │  │   Coach     │ │   Meal      │ │  Wellness   │            │  │
│  │  │  Proactive  │ │   Plan      │ │  Program    │            │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │  │
│  │  │  Challenge  │ │ Correlation │ │ Notification│            │  │
│  │  │   Service   │ │   Engine    │ │   Service   │            │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Context Aggregator Service

Le cœur de la connexion est un service qui agrège l'état complet de l'utilisateur en temps réel.

```typescript
// src/services/conversation-context-service.ts

interface ConversationContext {
  // État nutritionnel
  nutrition: {
    caloriesConsumed: number
    caloriesRemaining: number
    macroBalance: { proteins: number; carbs: number; fats: number }
    lastMealTime: string | null
    todayMeals: MealEntry[]
    weeklyTrend: 'deficit' | 'balanced' | 'surplus'
  }

  // État bien-être
  wellness: {
    currentMood: MoodType | null
    sleepLastNight: { hours: number; quality: string } | null
    stressLevel: number | null
    energyLevel: number | null
    hydration: number
  }

  // Corrélations détectées
  correlations: {
    sleepNutrition: CorrelationInsight[]
    stressEating: CorrelationInsight[]
    energyPatterns: CorrelationInsight[]
  }

  // Programme en cours
  program: {
    currentPhase: WellnessPhase | null
    dayInPhase: number
    phaseProgress: number
    upcomingMilestone: string | null
  }

  // Gamification
  gamification: {
    currentStreak: number
    level: number
    xp: number
    activeChallenge: Challenge | null
    recentAchievements: Achievement[]
  }

  // Historique conversationnel
  conversationHistory: ConversationTurn[]

  // Signaux temporels
  temporal: {
    timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
    dayOfWeek: number
    isWeekend: boolean
    hoursSinceLastMeal: number
    hoursSinceWakeup: number | null
  }
}
```

### 1.3 Connexion aux Agents Existants

La couche conversationnelle ne réinvente pas les agents. Elle les **orchestre**.

```typescript
// src/services/agent-orchestrator.ts

class AgentOrchestrator {
  constructor(
    private coachProactive: typeof coachProactiveService,
    private mealPlanAgent: typeof mealPlanAgent,
    private wellnessProgram: typeof wellnessProgramStore,
    private challenges: typeof weeklyChallengesService,
    private correlationEngine: typeof correlationService
  ) {}

  /**
   * Exécute une action déterminée par le dialogue
   */
  async executeAction(action: ConversationAction): Promise<ActionResult> {
    switch (action.type) {
      case 'SUGGEST_MEAL':
        return this.mealPlanAgent.generateMealSuggestion(action.params)

      case 'ADJUST_CALORIES':
        return this.adjustDailyTarget(action.params)

      case 'START_CHALLENGE':
        return this.challenges.startChallenge(action.params.challengeId)

      case 'ADVANCE_PHASE':
        return this.wellnessProgram.advanceToNextPhase()

      case 'SCHEDULE_REMINDER':
        return this.schedulePersonalizedReminder(action.params)

      case 'LOG_MEAL_QUICK':
        return this.quickLogMeal(action.params)

      case 'TRIGGER_INSIGHT':
        return this.coachProactive.generateInsight(action.params.category)

      // ... autres actions
    }
  }
}
```

---

## 2. Détection des Intentions Utilisateur

### 2.1 Taxonomie des Intentions

```typescript
// src/types/conversation-intents.ts

type UserIntent =
  // Besoins physiologiques
  | 'HUNGER'              // "J'ai faim", "Qu'est-ce que je mange ?"
  | 'CRAVING'             // "J'ai envie de sucré"
  | 'FATIGUE'             // "Je suis crevé"
  | 'LOW_ENERGY'          // "Pas la forme"

  // États émotionnels
  | 'STRESS'              // "Journée difficile"
  | 'ANXIETY'             // "Je stresse pour..."
  | 'FRUSTRATION'         // "Ça ne marche pas"
  | 'CELEBRATION'         // "J'ai réussi !"

  // Demandes d'information
  | 'PROGRESS_CHECK'      // "Où j'en suis ?"
  | 'EXPLAIN_DECISION'    // "Pourquoi tu me dis ça ?"
  | 'NUTRITION_QUESTION'  // "C'est bon les noix ?"

  // Demandes d'action
  | 'MEAL_SUGGESTION'     // "Propose-moi un truc"
  | 'PLAN_MODIFICATION'   // "Ajuste mes objectifs"
  | 'CHALLENGE_START'     // "Je veux un défi"
  | 'PHASE_QUESTION'      // "C'est quoi la prochaine phase ?"

  // Signaux de désengagement
  | 'OVERWHELM'           // "C'est trop compliqué"
  | 'DOUBT'               // "Est-ce que ça sert à quelque chose ?"
  | 'PLATEAU'             // "Je stagne"

  // Meta-conversation
  | 'GREETING'            // "Salut"
  | 'FEEDBACK'            // "J'aime bien / pas"
  | 'HELP'                // "Comment ça marche ?"
```

### 2.2 Intent Detection Engine

```typescript
// src/services/intent-detection-service.ts

interface IntentDetectionResult {
  primaryIntent: UserIntent
  confidence: number
  secondaryIntents: { intent: UserIntent; confidence: number }[]
  entities: ExtractedEntity[]
  sentiment: 'positive' | 'neutral' | 'negative'
  urgency: 'low' | 'medium' | 'high'
}

class IntentDetectionService {
  /**
   * Détection hybride : règles + ML léger + contexte
   */
  async detectIntent(
    message: string,
    context: ConversationContext
  ): Promise<IntentDetectionResult> {
    // 1. Extraction d'entités et pré-traitement
    const entities = this.extractEntities(message)
    const sentiment = this.analyzeSentiment(message)

    // 2. Détection par règles (rapide, gratuit)
    const ruleBasedIntent = this.detectByRules(message, entities)

    // 3. Si confiance faible, utiliser le contexte
    if (ruleBasedIntent.confidence < 0.7) {
      return this.enhanceWithContext(ruleBasedIntent, context)
    }

    // 4. Pour les cas ambigus Premium, appel LLM
    if (ruleBasedIntent.confidence < 0.5 && context.isPremium) {
      return this.detectWithLLM(message, context)
    }

    return ruleBasedIntent
  }

  /**
   * Règles de détection (coût: 0)
   */
  private detectByRules(message: string, entities: ExtractedEntity[]): IntentDetectionResult {
    const normalized = message.toLowerCase().trim()

    // Patterns de faim
    if (/faim|manger|mange|qu.?est.ce que je (mange|prends)|repas/i.test(normalized)) {
      return { primaryIntent: 'HUNGER', confidence: 0.9, ... }
    }

    // Patterns de fatigue
    if (/fatigu|crev|épuis|dormi|sommeil|pas la forme|nuit/i.test(normalized)) {
      return { primaryIntent: 'FATIGUE', confidence: 0.85, ... }
    }

    // Patterns de stress
    if (/stress|anxie|tendu|difficile|dur|compliqué|pression/i.test(normalized)) {
      return { primaryIntent: 'STRESS', confidence: 0.85, ... }
    }

    // Patterns de progression
    if (/où j.?en suis|progrès|avance|résultat|ça marche/i.test(normalized)) {
      return { primaryIntent: 'PROGRESS_CHECK', confidence: 0.9, ... }
    }

    // Patterns de demande d'explication
    if (/pourquoi|comment ça|explique|comprends pas/i.test(normalized)) {
      return { primaryIntent: 'EXPLAIN_DECISION', confidence: 0.85, ... }
    }

    // ... autres règles
  }

  /**
   * Enrichissement par contexte
   */
  private enhanceWithContext(
    detection: IntentDetectionResult,
    context: ConversationContext
  ): IntentDetectionResult {
    // Si l'utilisateur dit "pas la forme" et n'a pas mangé depuis 5h
    if (detection.primaryIntent === 'FATIGUE' && context.temporal.hoursSinceLastMeal > 4) {
      detection.secondaryIntents.push({ intent: 'HUNGER', confidence: 0.7 })
    }

    // Si stress détecté et pattern de stress-eating connu
    if (detection.primaryIntent === 'STRESS' && context.correlations.stressEating.length > 0) {
      detection.secondaryIntents.push({ intent: 'CRAVING', confidence: 0.6 })
    }

    // Si plateau et l'utilisateur demande des progrès
    if (detection.primaryIntent === 'PROGRESS_CHECK' &&
        context.nutrition.weeklyTrend === 'balanced' &&
        context.program.dayInPhase > 7) {
      detection.secondaryIntents.push({ intent: 'PLATEAU', confidence: 0.5 })
    }

    return detection
  }
}
```

### 2.3 Entity Extraction

```typescript
interface ExtractedEntity {
  type: 'food' | 'time' | 'quantity' | 'emotion' | 'goal' | 'duration'
  value: string
  normalized: any
  position: [number, number]
}

// Exemples d'extraction
// "J'ai mangé une pizza à midi"
// → [{ type: 'food', value: 'pizza' }, { type: 'time', value: 'midi', normalized: 12 }]

// "Je veux perdre 5 kilos"
// → [{ type: 'goal', value: 'perdre', normalized: 'weight_loss' }, { type: 'quantity', value: '5 kilos' }]
```

---

## 3. Transformation des Messages en Signaux

### 3.1 Signal Generation Pipeline

```typescript
// src/services/signal-generation-service.ts

interface UserSignal {
  type: SignalType
  intensity: number        // 0-1
  source: 'explicit' | 'inferred' | 'contextual'
  confidence: number
  actionable: boolean
  relatedData: any
}

type SignalType =
  | 'NUTRITIONAL_NEED'
  | 'EMOTIONAL_STATE'
  | 'MOTIVATION_LEVEL'
  | 'KNOWLEDGE_GAP'
  | 'DECISION_POINT'
  | 'HABIT_DEVIATION'
  | 'GOAL_ALIGNMENT'

class SignalGenerationService {
  /**
   * Transforme une intention détectée en signaux exploitables
   */
  generateSignals(
    intent: IntentDetectionResult,
    context: ConversationContext
  ): UserSignal[] {
    const signals: UserSignal[] = []

    switch (intent.primaryIntent) {
      case 'HUNGER':
        signals.push({
          type: 'NUTRITIONAL_NEED',
          intensity: this.calculateHungerIntensity(context),
          source: 'explicit',
          confidence: intent.confidence,
          actionable: true,
          relatedData: {
            caloriesRemaining: context.nutrition.caloriesRemaining,
            lastMealTime: context.nutrition.lastMealTime,
            suggestedMealType: this.determineMealType(context)
          }
        })
        break

      case 'STRESS':
        signals.push({
          type: 'EMOTIONAL_STATE',
          intensity: 0.7, // Stress élevé
          source: 'explicit',
          confidence: intent.confidence,
          actionable: true,
          relatedData: {
            stressEatingRisk: context.correlations.stressEating.length > 0,
            suggestedActions: ['breathing_exercise', 'healthy_comfort_food', 'postpone_decision']
          }
        })

        // Signal secondaire si risque de stress-eating
        if (context.correlations.stressEating.length > 0) {
          signals.push({
            type: 'HABIT_DEVIATION',
            intensity: 0.6,
            source: 'inferred',
            confidence: 0.7,
            actionable: true,
            relatedData: {
              pattern: 'stress_eating',
              historicalOccurrences: context.correlations.stressEating
            }
          })
        }
        break

      case 'PLATEAU':
        signals.push({
          type: 'MOTIVATION_LEVEL',
          intensity: 0.4, // Motivation en baisse
          source: 'inferred',
          confidence: 0.75,
          actionable: true,
          relatedData: {
            daysSinceProgress: this.calculateDaysSinceProgress(context),
            possibleCauses: this.analyzePlateauCauses(context),
            suggestedAdjustments: this.generatePlateauStrategy(context)
          }
        })
        break

      // ... autres cas
    }

    return signals
  }
}
```

### 3.2 Signal → Decision Engine Bridge

```typescript
// src/services/decision-bridge-service.ts

class DecisionBridgeService {
  /**
   * Traduit les signaux en requêtes pour le moteur décisionnel
   */
  async processSignals(signals: UserSignal[]): Promise<DecisionRequest[]> {
    const requests: DecisionRequest[] = []

    for (const signal of signals) {
      if (!signal.actionable) continue

      switch (signal.type) {
        case 'NUTRITIONAL_NEED':
          requests.push({
            agent: 'meal_plan_agent',
            action: 'generate_suggestion',
            params: {
              mealType: signal.relatedData.suggestedMealType,
              caloriesBudget: signal.relatedData.caloriesRemaining,
              constraints: await this.getUserConstraints()
            },
            priority: signal.intensity > 0.7 ? 'high' : 'medium'
          })
          break

        case 'EMOTIONAL_STATE':
          if (signal.relatedData.stressEatingRisk) {
            requests.push({
              agent: 'coach_proactive',
              action: 'generate_support_message',
              params: {
                context: 'stress_management',
                includeActions: true
              },
              priority: 'high'
            })
          }
          break

        case 'MOTIVATION_LEVEL':
          if (signal.intensity < 0.5) {
            requests.push({
              agent: 'gamification_store',
              action: 'suggest_challenge',
              params: {
                difficulty: 'easy',
                category: 'quick_win'
              },
              priority: 'medium'
            })
          }
          break
      }
    }

    return requests
  }
}
```

---

## 4. Structure des Réponses IA

### 4.1 Response Schema

```typescript
// src/types/conversation-response.ts

interface ConversationResponse {
  // Message naturel affiché à l'utilisateur
  message: {
    text: string
    tone: 'empathetic' | 'encouraging' | 'informative' | 'celebratory' | 'casual'
    emoji?: string
  }

  // Diagnostic structuré (optionnel, peut être affiché ou masqué)
  diagnosis?: {
    summary: string
    factors: DiagnosisFactor[]
    confidence: number
    dataPoints: string[]  // Sources des données utilisées
  }

  // Plan court terme
  shortTermPlan?: {
    horizon: 'immediate' | 'today' | 'this_week'
    steps: PlanStep[]
    expectedOutcome: string
  }

  // Actions exécutables dans l'app
  actions: ConversationAction[]

  // Éléments UI complémentaires
  ui?: {
    quickReplies?: QuickReply[]
    cards?: InfoCard[]
    charts?: ChartData[]
    navigation?: NavigationSuggestion
  }

  // Métadonnées
  meta: {
    responseId: string
    generatedAt: string
    model: 'rules' | 'hybrid' | 'llm'
    tokensUsed?: number
  }
}

interface ConversationAction {
  type: ActionType
  label: string           // Texte du bouton
  description?: string    // Explication de l'action
  params: Record<string, any>
  requiresConfirmation: boolean
  isPremium: boolean
}

type ActionType =
  | 'SUGGEST_MEAL'
  | 'LOG_MEAL_QUICK'
  | 'ADJUST_CALORIES'
  | 'START_CHALLENGE'
  | 'ADVANCE_PHASE'
  | 'SCHEDULE_REMINDER'
  | 'NAVIGATE_TO'
  | 'SHOW_INSIGHT'
  | 'SHARE_PROGRESS'
  | 'CONTACT_SUPPORT'
```

### 4.2 Response Generator

```typescript
// src/services/response-generator-service.ts

class ResponseGeneratorService {
  /**
   * Génère une réponse complète à partir des signaux et décisions
   */
  async generateResponse(
    intent: IntentDetectionResult,
    signals: UserSignal[],
    decisions: DecisionResult[],
    context: ConversationContext
  ): Promise<ConversationResponse> {

    // Sélectionner le template de base selon l'intention
    const template = this.selectTemplate(intent.primaryIntent)

    // Personnaliser avec le contexte
    const message = await this.personalizeMessage(template, context, signals)

    // Construire le diagnostic si pertinent
    const diagnosis = this.shouldIncludeDiagnosis(intent)
      ? this.buildDiagnosis(signals, context)
      : undefined

    // Construire le plan si actionnable
    const shortTermPlan = decisions.length > 0
      ? this.buildShortTermPlan(decisions, context)
      : undefined

    // Transformer les décisions en actions
    const actions = this.buildActions(decisions, context)

    // Générer les éléments UI
    const ui = this.buildUIElements(intent, actions, context)

    return {
      message,
      diagnosis,
      shortTermPlan,
      actions,
      ui,
      meta: {
        responseId: generateUUID(),
        generatedAt: new Date().toISOString(),
        model: this.determineModel(intent)
      }
    }
  }

  /**
   * Exemple de génération pour HUNGER + FATIGUE
   */
  private generateHungerFatigueResponse(
    context: ConversationContext,
    decisions: DecisionResult[]
  ): ConversationResponse {
    const mealSuggestion = decisions.find(d => d.type === 'meal_suggestion')
    const { caloriesRemaining, lastMealTime } = context.nutrition
    const hoursSinceLastMeal = context.temporal.hoursSinceLastMeal

    return {
      message: {
        text: `Je comprends, ${hoursSinceLastMeal}h sans manger ça tire ! ` +
              `Tu as encore ${caloriesRemaining} kcal disponibles. ` +
              `Je te propose quelque chose qui va te redonner de l'énergie rapidement.`,
        tone: 'empathetic',
        emoji: '💪'
      },

      diagnosis: {
        summary: "Fatigue probablement liée au jeûne prolongé",
        factors: [
          { label: "Heures depuis dernier repas", value: `${hoursSinceLastMeal}h`, impact: 'high' },
          { label: "Glycémie estimée", value: "En baisse", impact: 'medium' },
          { label: "Pattern habituel", value: context.temporal.timeOfDay, impact: 'low' }
        ],
        confidence: 0.85,
        dataPoints: ["Historique repas", "Heure actuelle", "Profil métabolique"]
      },

      shortTermPlan: {
        horizon: 'immediate',
        steps: [
          { action: "Manger un repas équilibré", timing: "Maintenant", priority: 'high' },
          { action: "Boire un verre d'eau", timing: "Avec le repas", priority: 'medium' },
          { action: "Pause de 20min après", timing: "+30min", priority: 'low' }
        ],
        expectedOutcome: "Regain d'énergie dans 30-45 minutes"
      },

      actions: [
        {
          type: 'SUGGEST_MEAL',
          label: "Voir la suggestion",
          description: mealSuggestion?.data.name,
          params: { mealId: mealSuggestion?.data.id },
          requiresConfirmation: false,
          isPremium: false
        },
        {
          type: 'LOG_MEAL_QUICK',
          label: "J'ai déjà mangé",
          params: { openQuickLog: true },
          requiresConfirmation: false,
          isPremium: false
        },
        {
          type: 'NAVIGATE_TO',
          label: "Voir d'autres idées",
          params: { screen: 'MealSuggestions' },
          requiresConfirmation: false,
          isPremium: false
        }
      ],

      ui: {
        quickReplies: [
          { label: "Parfait, je mange ça", action: 'LOG_MEAL', params: { meal: mealSuggestion?.data } },
          { label: "Autre chose", action: 'MORE_OPTIONS' },
          { label: "Je n'ai pas le temps", action: 'QUICK_SNACK_OPTIONS' }
        ],
        cards: mealSuggestion ? [
          {
            type: 'meal_preview',
            data: mealSuggestion.data
          }
        ] : []
      },

      meta: {
        responseId: generateUUID(),
        generatedAt: new Date().toISOString(),
        model: 'hybrid'
      }
    }
  }
}
```

### 4.3 Exemple de Réponse JSON Complète

```json
{
  "message": {
    "text": "Je vois que tu traverses une période stressante. J'ai remarqué que ces derniers temps, le stress te pousse vers le sucré (3 fois cette semaine). Plutôt que de résister, je te propose une alternative qui va satisfaire l'envie tout en t'aidant.",
    "tone": "empathetic",
    "emoji": "🫂"
  },

  "diagnosis": {
    "summary": "Pattern stress-eating détecté",
    "factors": [
      { "label": "Épisodes cette semaine", "value": "3", "impact": "high" },
      { "label": "Corrélation stress-sucre", "value": "87%", "impact": "high" },
      { "label": "Sommeil moyen", "value": "5.5h", "impact": "medium" }
    ],
    "confidence": 0.87,
    "dataPoints": ["Historique humeur", "Logs repas", "Données sommeil"]
  },

  "shortTermPlan": {
    "horizon": "today",
    "steps": [
      { "action": "Respiration 4-7-8", "timing": "Maintenant", "priority": "high" },
      { "action": "Collation protéinée + chocolat noir", "timing": "+5min", "priority": "high" },
      { "action": "Marche de 10min si possible", "timing": "+30min", "priority": "medium" }
    ],
    "expectedOutcome": "Réduction du stress et satisfaction du craving sans culpabilité"
  },

  "actions": [
    {
      "type": "SUGGEST_MEAL",
      "label": "Voir la collation anti-stress",
      "description": "Yaourt grec + chocolat noir + amandes",
      "params": { "mealType": "snack", "tags": ["stress_relief", "protein"] },
      "requiresConfirmation": false,
      "isPremium": false
    },
    {
      "type": "NAVIGATE_TO",
      "label": "Exercice de respiration",
      "description": "Technique 4-7-8, 2 minutes",
      "params": { "screen": "BreathingExercise", "technique": "4-7-8" },
      "requiresConfirmation": false,
      "isPremium": false
    },
    {
      "type": "SCHEDULE_REMINDER",
      "label": "Me rappeler dans 1h",
      "description": "Vérifier comment tu te sens",
      "params": { "delay": 3600, "message": "Comment tu te sens maintenant ?" },
      "requiresConfirmation": true,
      "isPremium": true
    }
  ],

  "ui": {
    "quickReplies": [
      { "label": "Je fais l'exercice", "action": "START_BREATHING" },
      { "label": "Donne-moi la collation", "action": "SHOW_SNACK" },
      { "label": "J'ai juste besoin de parler", "action": "CONTINUE_CHAT" }
    ],
    "cards": [
      {
        "type": "correlation_insight",
        "data": {
          "title": "Ton pattern cette semaine",
          "chart": "stress_eating_correlation",
          "insight": "Le stress déclenche 87% de tes envies de sucré"
        }
      }
    ]
  },

  "meta": {
    "responseId": "conv_abc123",
    "generatedAt": "2024-01-15T14:32:00Z",
    "model": "hybrid"
  }
}
```

---

## 5. Modes de Fonctionnement

### 5.1 Mode Guidé (Boutons d'Intention)

```typescript
// src/components/conversation/GuidedMode.tsx

const INTENT_BUTTONS: IntentButton[] = [
  // Besoins primaires
  {
    category: 'needs',
    buttons: [
      { label: "J'ai faim", icon: '🍽️', intent: 'HUNGER' },
      { label: "Envie de sucré", icon: '🍫', intent: 'CRAVING' },
      { label: "Fatigué(e)", icon: '😴', intent: 'FATIGUE' },
    ]
  },

  // Émotions
  {
    category: 'emotions',
    buttons: [
      { label: "Stressé(e)", icon: '😰', intent: 'STRESS' },
      { label: "Démotivé(e)", icon: '😔', intent: 'DOUBT' },
      { label: "Content(e) !", icon: '🎉', intent: 'CELEBRATION' },
    ]
  },

  // Actions
  {
    category: 'actions',
    buttons: [
      { label: "Où j'en suis ?", icon: '📊', intent: 'PROGRESS_CHECK' },
      { label: "Propose-moi un repas", icon: '👨‍🍳', intent: 'MEAL_SUGGESTION' },
      { label: "Lance-moi un défi", icon: '🎯', intent: 'CHALLENGE_START' },
    ]
  }
]

function GuidedModeInterface() {
  const { sendIntent } = useConversation()

  return (
    <View style={styles.guidedContainer}>
      <Text style={styles.prompt}>Comment je peux t'aider ?</Text>

      {INTENT_BUTTONS.map(category => (
        <View key={category.category} style={styles.buttonRow}>
          {category.buttons.map(button => (
            <TouchableOpacity
              key={button.intent}
              style={styles.intentButton}
              onPress={() => sendIntent(button.intent)}
            >
              <Text style={styles.buttonIcon}>{button.icon}</Text>
              <Text style={styles.buttonLabel}>{button.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  )
}
```

### 5.2 Mode Conversation Libre

```typescript
// src/components/conversation/FreeMode.tsx

function FreeModeInterface() {
  const { messages, sendMessage, isTyping, context } = useConversation()
  const [input, setInput] = useState('')

  // Suggestions contextuelles basées sur l'état
  const suggestions = useMemo(() => {
    const { temporal, nutrition, wellness } = context

    if (temporal.hoursSinceLastMeal > 4) {
      return ["Qu'est-ce que je mange ?", "J'ai pas très faim", "Un truc rapide"]
    }

    if (wellness.stressLevel && wellness.stressLevel > 7) {
      return ["Journée difficile", "J'ai besoin de réconfort", "Comment je gère ça ?"]
    }

    if (temporal.timeOfDay === 'evening') {
      return ["Bilan de la journée", "Comment je me sens", "Demain je veux..."]
    }

    return ["Où j'en suis ?", "Propose-moi quelque chose", "J'ai une question"]
  }, [context])

  return (
    <View style={styles.freeContainer}>
      {/* Messages */}
      <FlatList
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
        inverted
      />

      {/* Indicateur de frappe */}
      {isTyping && <TypingIndicator />}

      {/* Suggestions contextuelles */}
      <ScrollView horizontal style={styles.suggestionsRow}>
        {suggestions.map(suggestion => (
          <Chip
            key={suggestion}
            label={suggestion}
            onPress={() => sendMessage(suggestion)}
          />
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Dis-moi ce qui te passe par la tête..."
          multiline
        />
        <TouchableOpacity onPress={() => sendMessage(input)}>
          <SendIcon />
        </TouchableOpacity>
      </View>
    </View>
  )
}
```

### 5.3 Mode Hybride (Par Défaut)

```typescript
// src/components/conversation/HybridMode.tsx

function HybridModeInterface() {
  const { recentContext, lastInteraction } = useConversation()
  const [mode, setMode] = useState<'guided' | 'free'>('guided')

  // Basculer automatiquement selon le contexte
  useEffect(() => {
    // Si l'utilisateur a déjà tapé du texte libre, rester en mode libre
    if (lastInteraction?.type === 'free_text') {
      setMode('free')
    }

    // Revenir en mode guidé après inactivité
    const timeout = setTimeout(() => setMode('guided'), 30000)
    return () => clearTimeout(timeout)
  }, [lastInteraction])

  return (
    <View>
      {mode === 'guided' ? (
        <GuidedModeInterface onSwitchToFree={() => setMode('free')} />
      ) : (
        <FreeModeInterface onSwitchToGuided={() => setMode('guided')} />
      )}

      {/* Toggle visible */}
      <View style={styles.modeToggle}>
        <TouchableOpacity onPress={() => setMode('guided')}>
          <Text style={mode === 'guided' ? styles.active : styles.inactive}>
            Boutons
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('free')}>
          <Text style={mode === 'free' ? styles.active : styles.inactive}>
            Conversation
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
```

---

## 6. Impact sur la Rétention et la Valeur Perçue

### 6.1 Mécanismes de Rétention

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BOUCLE DE RÉTENTION CONVERSATIONNELLE            │
│                                                                      │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐  │
│   │ Utilisateur│    │  Coach   │    │  Action  │    │ Feedback │  │
│   │  exprime  │───▶│ comprend │───▶│ proposée │───▶│ immédiat │  │
│   │  besoin   │    │    +     │    │    +     │    │    +     │  │
│   │           │    │ explique │    │ exécutée │    │ suivi    │  │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘  │
│        ▲                                                    │       │
│        │                                                    │       │
│        └────────────────────────────────────────────────────┘       │
│                         RENFORCEMENT                                │
└─────────────────────────────────────────────────────────────────────┘
```

#### Leviers de rétention :

1. **Compréhension = Confiance**
   - L'utilisateur voit *pourquoi* le système lui dit quelque chose
   - Il comprend les corrélations entre son comportement et ses résultats
   - La transparence crée un sentiment de partenariat

2. **Dialogue = Engagement**
   - L'utilisateur n'est plus passif (lire des notifications)
   - Il co-construit ses décisions avec le coach
   - Chaque interaction renforce l'habitude

3. **Action immédiate = Satisfaction**
   - Pas de friction entre "j'ai besoin" et "j'ai une solution"
   - Les actions sont exécutées dans l'app, pas juste suggérées
   - Le feedback boucle la boucle

4. **Personnalisation = Unicité**
   - Le coach connaît l'historique, les patterns, les préférences
   - Les réponses sont uniques à chaque utilisateur
   - Impossible de retrouver ça ailleurs

### 6.2 Valeur Perçue Augmentée

```typescript
// Matrice de valeur perçue

const VALUE_MATRIX = {
  // Sans coach conversationnel
  before: {
    understanding: 'LOW',      // "L'app me dit quoi faire mais je sais pas pourquoi"
    control: 'LOW',            // "Je subis les notifications"
    personalization: 'MEDIUM', // "C'est adapté mais générique"
    engagement: 'MEDIUM',      // "J'utilise quand j'y pense"
  },

  // Avec coach conversationnel
  after: {
    understanding: 'HIGH',     // "Je comprends mon corps et mes patterns"
    control: 'HIGH',           // "Je dialogue, je décide, le coach m'aide"
    personalization: 'VERY_HIGH', // "C'est MON coach, il me connaît"
    engagement: 'VERY_HIGH',   // "Je veux lui parler, il m'aide vraiment"
  }
}
```

### 6.3 Métriques d'Impact

```typescript
// Métriques à tracker pour valider l'impact

interface ConversationalCoachMetrics {
  // Engagement
  dailyConversations: number
  avgConversationLength: number
  intentDistribution: Record<UserIntent, number>

  // Rétention
  d1_retention_with_coach: number
  d7_retention_with_coach: number
  d30_retention_with_coach: number

  // Actions
  actionsExecutedFromChat: number
  actionCompletionRate: number

  // Satisfaction
  nps_after_conversation: number
  thumbsUpRate: number

  // Conversion (Free → Premium)
  premiumConversionsFromChat: number
  featureDiscoveryViaChat: number
}
```

---

## 7. Monétisation et Gestion des Coûts

### 7.1 Stratégie Free vs Premium

```typescript
// src/config/conversation-tiers.ts

const CONVERSATION_TIERS = {
  free: {
    // Limites
    dailyMessages: 10,
    llmCallsPerDay: 0,  // Pas de LLM, uniquement règles

    // Fonctionnalités
    features: {
      guidedMode: true,
      freeMode: false,      // Texte libre = Premium
      basicIntents: true,   // Faim, fatigue, progrès
      advancedIntents: false, // Émotions complexes, explications détaillées

      // Réponses
      messageOnly: true,
      diagnosisIncluded: false,  // Premium
      shortTermPlan: false,      // Premium

      // Actions
      basicActions: true,   // Suggestion repas, navigation
      advancedActions: false, // Ajustement objectifs, rappels personnalisés
    }
  },

  premium: {
    // Limites
    dailyMessages: 'unlimited',
    llmCallsPerDay: 20,  // Pour cas complexes/ambigus

    // Fonctionnalités
    features: {
      guidedMode: true,
      freeMode: true,
      basicIntents: true,
      advancedIntents: true,

      messageOnly: true,
      diagnosisIncluded: true,
      shortTermPlan: true,

      basicActions: true,
      advancedActions: true,

      // Exclusivités Premium
      correlationExplanations: true,
      weeklyDigestConversation: true,
      voiceInput: true,
      exportConversation: true,
    }
  }
}
```

### 7.2 Optimisation des Coûts LLM

```typescript
// src/services/cost-optimization-service.ts

class CostOptimizationService {
  /**
   * Décide si un appel LLM est nécessaire
   */
  shouldUseLLM(
    intent: IntentDetectionResult,
    context: ConversationContext,
    userTier: 'free' | 'premium'
  ): boolean {
    // Jamais de LLM pour Free
    if (userTier === 'free') return false

    // Pas de LLM si les règles suffisent
    if (intent.confidence > 0.85) return false

    // LLM uniquement pour cas complexes
    const complexCases = [
      intent.primaryIntent === 'EXPLAIN_DECISION',
      intent.secondaryIntents.length > 2,
      context.conversationHistory.length > 5, // Conversation longue
      intent.sentiment === 'negative' && intent.urgency === 'high'
    ]

    return complexCases.some(Boolean)
  }

  /**
   * Optimise le prompt pour réduire les tokens
   */
  optimizePrompt(
    basePrompt: string,
    context: ConversationContext
  ): string {
    // Résumer le contexte au lieu de tout envoyer
    const compactContext = {
      nutrition: {
        cal: context.nutrition.caloriesRemaining,
        lastMeal: context.temporal.hoursSinceLastMeal + 'h'
      },
      wellness: {
        mood: context.wellness.currentMood,
        stress: context.wellness.stressLevel
      },
      // Seulement les 3 derniers messages
      history: context.conversationHistory.slice(-3)
    }

    return `${basePrompt}\n\nContext: ${JSON.stringify(compactContext)}`
  }

  /**
   * Cache les réponses similaires
   */
  async getCachedResponse(
    intentHash: string
  ): Promise<ConversationResponse | null> {
    // Hash basé sur intent + contexte simplifié
    // Cache de 1h pour les réponses génériques
    return await cache.get(`response:${intentHash}`)
  }
}
```

### 7.3 Architecture de Coûts

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PYRAMIDE DE TRAITEMENT                           │
│                                                                      │
│                         ┌───────────┐                               │
│                         │    LLM    │  ← 5% des requêtes            │
│                         │  (Premium │    Coût: ~$0.02/req           │
│                         │  complex) │                               │
│                         └─────┬─────┘                               │
│                    ┌──────────┴──────────┐                          │
│                    │    Hybrid Engine    │  ← 25% des requêtes      │
│                    │  (Règles + Context  │    Coût: ~$0.001/req     │
│                    │   + Small Model)    │                          │
│                    └──────────┬──────────┘                          │
│          ┌───────────────────┴───────────────────┐                  │
│          │           Rule-Based Engine           │  ← 70% des req   │
│          │  (Patterns, Templates, Lookups)       │    Coût: $0      │
│          └───────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘

Coût moyen par utilisateur Premium actif : ~$0.50/mois
Marge sur abonnement Premium (9.99€) : >90%
```

---

## 8. Différenciation vs Chatbot Classique

### 8.1 Ce que LYM N'EST PAS

| Chatbot Nutritionnel Classique | LYM Conversational Coach |
|-------------------------------|--------------------------|
| Répond à des questions | Anticipe les besoins |
| Base de connaissances statique | Contexte utilisateur en temps réel |
| "Combien de calories dans une pomme ?" | "Tu as faim ? Voici ce qui te correspond maintenant." |
| Conseils génériques | Décisions personnalisées avec explication |
| Pas d'actions, juste de l'info | Exécution directe dans l'app |
| Pas de mémoire | Historique complet + corrélations |
| Réponses identiques | Réponses uniques à chaque utilisateur |

### 8.2 Ce que LYM EST

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   LYM = Système Nerveux Intelligent + Interface Conversationnelle   │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                              │   │
│   │   "Je ne suis pas un chatbot qui répond à tes questions.    │   │
│   │    Je suis le reflet conversationnel d'un système qui       │   │
│   │    pense, corrèle, et agit en permanence pour toi.          │   │
│   │                                                              │   │
│   │    Quand tu me parles, tu ne poses pas une question         │   │
│   │    à une base de données.                                   │   │
│   │                                                              │   │
│   │    Tu dialogues avec un moteur qui connaît :                │   │
│   │    - Tes patterns alimentaires sur 30 jours                 │   │
│   │    - La corrélation entre ton stress et tes envies          │   │
│   │    - L'impact de ton sommeil sur ton métabolisme            │   │
│   │    - Ta phase actuelle dans le programme                    │   │
│   │    - Tes préférences implicites                             │   │
│   │                                                              │   │
│   │    Et qui peut agir :                                       │   │
│   │    - Ajuster tes objectifs                                  │   │
│   │    - Te proposer un repas adapté                            │   │
│   │    - Lancer un défi personnalisé                            │   │
│   │    - Modifier ton programme                                 │   │
│   │    - Te rappeler au bon moment"                             │   │
│   │                                                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Avantage Concurrentiel Défendable

1. **Données propriétaires** : Chaque utilisateur génère des données uniques que seul LYM possède
2. **Corrélations apprises** : Le moteur s'améliore avec chaque interaction
3. **Actions intégrées** : Pas de friction, le chat EST l'app
4. **Effets de réseau** : Plus l'utilisateur l'utilise, plus c'est personnalisé, plus il reste
5. **Coût de switching élevé** : Impossible de "déménager" vers une autre app avec toute cette intelligence

---

## 9. Roadmap d'Implémentation

### Phase 1 : Foundation (2-3 semaines)
- [ ] Context Aggregator Service
- [ ] Intent Detection (règles)
- [ ] Response Generator (templates)
- [ ] Mode Guidé (boutons)
- [ ] Intégration avec MessageCenter existant

### Phase 2 : Intelligence (2-3 semaines)
- [ ] Signal Generation
- [ ] Decision Bridge
- [ ] Agent Orchestrator
- [ ] Actions exécutables
- [ ] Mode Hybride

### Phase 3 : Premium Features (2 semaines)
- [ ] Mode Conversation Libre
- [ ] LLM Integration (cas complexes)
- [ ] Diagnostic détaillé
- [ ] Plans court terme
- [ ] Voice input

### Phase 4 : Optimization (ongoing)
- [ ] Analytics & métriques
- [ ] A/B testing réponses
- [ ] Cache & optimisation coûts
- [ ] Feedback loop pour amélioration

---

## 10. Conclusion

LYM Conversational Coach n'est pas une feature. C'est la manifestation visible de l'intelligence du système.

**Ce que l'utilisateur perçoit** : "Je parle à un coach qui me comprend vraiment."

**Ce qui se passe** : Le moteur décisionnel (agents, corrélations, programmes, gamification) expose son raisonnement et permet une interaction bidirectionnelle.

**Le résultat** :
- Rétention x2 (estimation basée sur l'engagement conversationnel)
- Compréhension utilisateur x3 (NPS)
- Valeur perçue permettant un pricing Premium justifié
- Moat défendable par les données et l'intelligence cumulée

---

*Document de spécification stratégique - LYM Conversational AI Coach*
*Version 1.0 - Janvier 2024*
