/**
 * LymIA Brain - Central RAG Intelligence Service
 *
 * This is the HEART of the app. All intelligent decisions go through here:
 * - Calorie calculations (personalized, not just formulas)
 * - Meal/recipe selection (context-aware)
 * - Coaching advice (knowledge-base powered)
 * - Program adaptations (responsive to progress)
 *
 * Uses:
 * - Supabase pgvector for semantic search
 * - OpenAI embeddings for context matching
 * - GPT-4o for intelligent responses
 */

import OpenAI from 'openai'
import { queryKnowledgeBase, isSupabaseConfigured, type KnowledgeBaseEntry } from './supabase-client'
import { buildPhasePromptModifier, getPhaseContext, PhaseMessages } from './phase-context'
import { aiRateLimiter, type AIRequestType } from './ai-rate-limiter'
import type {
  UserProfile,
  NutritionInfo,
  MealType,
  CookingPreferences,
  LifestyleHabits,
  MetabolismFactors
} from '../types'

// ============= CONFIGURATION =============

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
})

// ============= TYPES =============

export interface UserContext {
  profile: UserProfile
  todayNutrition: NutritionInfo
  weeklyAverage: NutritionInfo
  currentStreak: number
  lastMeals: string[]
  wellnessData: {
    sleepHours?: number
    stressLevel?: number
    energyLevel?: number
    hydrationLiters?: number
  }
  programProgress?: {
    type: 'metabolic_boost' | 'sport_initiation'
    phase: number
    weekInPhase: number
    completionRate: number
  }
}

export interface RAGDecision {
  decision: string
  reasoning: string
  confidence: number
  sources: Array<{
    content: string
    source: string
    relevance: number
  }>
  metadata?: Record<string, unknown>
}

export interface CalorieRecommendation extends RAGDecision {
  calories: number
  proteins: number
  carbs: number
  fats: number
  adjustmentReason?: string
}

export interface MealRecommendation extends RAGDecision {
  suggestions: Array<{
    name: string
    calories: number
    proteins: number
    carbs: number
    fats: number
    prepTime: number
    reason: string
  }>
  mealType: MealType
}

export interface CoachingAdvice extends RAGDecision {
  message: string
  priority: 'high' | 'medium' | 'low'
  category: 'nutrition' | 'wellness' | 'sport' | 'motivation' | 'alert'
  actionItems?: string[]
}

export interface ProgramAdaptation extends RAGDecision {
  shouldProgress: boolean
  adjustments: Array<{
    target: string
    oldValue: number
    newValue: number
    reason: string
  }>
  nextPhaseReady: boolean
}

// ============= KNOWLEDGE BASE QUERIES =============

/**
 * Query knowledge base with semantic search
 */
async function queryKB(
  query: string,
  categories: string[] = ['nutrition', 'metabolism', 'wellness', 'sport', 'guidelines']
): Promise<KnowledgeBaseEntry[]> {
  if (!isSupabaseConfigured()) {
    console.warn('LymIA Brain: Supabase not configured, using AI-only mode')
    return []
  }

  const results = await Promise.all(
    categories.map(cat => queryKnowledgeBase(query, { category: cat as KnowledgeBaseEntry['category'], limit: 3 }))
  )

  const entries: KnowledgeBaseEntry[] = []
  for (const result of results) {
    if (result?.entries) {
      entries.push(...result.entries)
    }
  }

  return entries
}

/**
 * Build context string from knowledge base entries
 */
function buildKBContext(entries: KnowledgeBaseEntry[]): string {
  if (entries.length === 0) return ''

  return entries.map(e =>
    `[${e.source}] ${e.content}`
  ).join('\n\n')
}

/**
 * Execute OpenAI call with rate limiting and model selection
 */
async function executeAICall(
  requestType: AIRequestType,
  messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>,
  options: {
    temperature?: number
    responseFormat?: { type: 'json_object' | 'text' }
    context?: Record<string, unknown>
  } = {}
): Promise<{ content: string; model: string; fromCache: boolean } | null> {
  const { temperature = 0.7, responseFormat, context = {} } = options

  // Check rate limit and get model to use
  const rateCheck = aiRateLimiter.checkRateLimit(requestType, context)

  // Return cached response if available
  if (rateCheck.cached) {
    return { content: rateCheck.cached, model: 'cache', fromCache: true }
  }

  // Check if request is allowed
  if (!rateCheck.allowed) {
    console.warn(`AI Rate limit: ${rateCheck.reason}`)
    return null
  }

  try {
    const response = await openai.chat.completions.create({
      model: rateCheck.model,
      messages,
      temperature,
      ...(responseFormat && { response_format: responseFormat }),
    })

    const content = response.choices[0].message.content || ''

    // Consume credits after successful call
    aiRateLimiter.consumeCredits(requestType)

    // Cache the response if applicable
    if (Object.keys(context).length > 0) {
      aiRateLimiter.cacheResponse(requestType, context, content)
    }

    return { content, model: rateCheck.model, fromCache: false }
  } catch (error) {
    console.error(`AI call error (${requestType}):`, error)
    throw error
  }
}

// ============= CORE BRAIN FUNCTIONS =============

/**
 * Calculate personalized calorie and macro needs
 * Uses RAG to adapt to user's metabolism, history, and goals
 */
export async function calculatePersonalizedNeeds(
  context: UserContext
): Promise<CalorieRecommendation> {
  const { profile, weeklyAverage, wellnessData, programProgress } = context

  // Query knowledge base for relevant nutrition science
  const kbEntries = await queryKB(
    `besoins caloriques ${profile.goal} ${profile.metabolismProfile || 'standard'} activite ${profile.activityLevel}`,
    ['nutrition', 'metabolism', 'guidelines']
  )

  const kbContext = buildKBContext(kbEntries)

  // Build prompt with all context
  const prompt = `Tu es LymIA, expert en nutrition personnalisee. Calcule les besoins nutritionnels optimaux.

PROFIL UTILISATEUR:
- Age: ${profile.age} ans
- Sexe: ${profile.gender}
- Poids: ${profile.weight} kg
- Taille: ${profile.height} cm
- Niveau d'activite: ${profile.activityLevel}
- Objectif: ${profile.goal}
- Regime: ${profile.dietType || 'omnivore'}
${profile.metabolismProfile === 'adaptive' ? '- ATTENTION: Metabolisme adaptatif detecte (historique de regimes)' : ''}
${profile.metabolismFactors?.restrictiveDietsHistory ? '- Historique de regimes restrictifs' : ''}

DONNEES RECENTES:
- Moyenne hebdomadaire: ${weeklyAverage.calories} kcal/jour
- Sommeil: ${wellnessData.sleepHours || 'non renseigne'} h
- Stress: ${wellnessData.stressLevel || 'non renseigne'}/10
- Energie: ${wellnessData.energyLevel || 'non renseigne'}/5
${programProgress ? `- Programme en cours: ${programProgress.type} Phase ${programProgress.phase} (${Math.round(programProgress.completionRate * 100)}% complete)` : ''}

CONNAISSANCES SCIENTIFIQUES:
${kbContext || 'Base de connaissances non disponible - utiliser les formules standard'}

INSTRUCTIONS:
1. Calcule le MB avec Harris-Benedict ou Mifflin-St Jeor
2. Applique le multiplicateur d'activite
3. ADAPTE selon:
   - Si metabolisme adaptatif: deficit MAX 100-200 kcal, proteines hautes
   - Si stress eleve: eviter deficit agressif
   - Si manque de sommeil: augmenter proteines
   - Si en programme de relance: suivre les recommandations de phase
4. Donne les macros en g (proteines, glucides, lipides)

Reponds en JSON:
{
  "calories": number,
  "proteins": number,
  "carbs": number,
  "fats": number,
  "reasoning": "explication en 2-3 phrases",
  "adjustmentReason": "si ajustement par rapport aux formules standard, expliquer pourquoi"
}`

  try {
    const aiResponse = await executeAICall(
      'coach_insight',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3,
        responseFormat: { type: 'json_object' },
        context: { goal: profile.goal, weight: profile.weight, activityLevel: profile.activityLevel },
      }
    )

    if (!aiResponse) {
      throw new Error('Rate limit atteint')
    }

    const result = JSON.parse(aiResponse.content || '{}')

    return {
      calories: result.calories || 2000,
      proteins: result.proteins || 100,
      carbs: result.carbs || 250,
      fats: result.fats || 67,
      decision: `${result.calories} kcal/jour`,
      reasoning: result.reasoning || 'Calcul base sur les formules standard',
      adjustmentReason: result.adjustmentReason,
      confidence: kbEntries.length > 0 ? 0.9 : 0.75,
      sources: kbEntries.map(e => ({
        content: e.content.slice(0, 100),
        source: e.source,
        relevance: 0.8,
      })),
    }
  } catch (error) {
    console.error('LymIA Brain calorie calculation error:', error)

    // Fallback to basic Harris-Benedict
    const bmr = profile.gender === 'female'
      ? 447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age)
      : 88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age)

    const multipliers: Record<string, number> = {
      sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9
    }
    const tdee = bmr * (multipliers[profile.activityLevel] || 1.55)

    let calories = tdee
    if (profile.goal === 'weight_loss') calories -= 400
    if (profile.goal === 'muscle_gain') calories += 300

    const proteins = Math.round(profile.weight * 1.8)
    const fats = Math.round((calories * 0.25) / 9)
    const carbs = Math.round((calories - proteins * 4 - fats * 9) / 4)

    return {
      calories: Math.round(calories),
      proteins,
      carbs,
      fats,
      decision: `${Math.round(calories)} kcal/jour (fallback)`,
      reasoning: 'Calcul via formule Harris-Benedict (mode hors-ligne)',
      confidence: 0.6,
      sources: [],
    }
  }
}

/**
 * Get intelligent meal recommendations based on context
 */
export async function getMealRecommendations(
  context: UserContext,
  mealType: MealType,
  targetCalories: number
): Promise<MealRecommendation> {
  const { profile, lastMeals, wellnessData } = context

  // Query knowledge base for meal ideas
  const mealTypeTerms: Record<MealType, string> = {
    breakfast: 'petit dejeuner proteines energie matin',
    lunch: 'dejeuner equilibre midi repas complet',
    snack: 'collation saine encas',
    dinner: 'diner leger soir digestion',
  }

  const kbEntries = await queryKB(
    `${mealTypeTerms[mealType]} ${profile.dietType || ''} ${profile.goal}`,
    ['nutrition', 'guidelines']
  )

  const kbContext = buildKBContext(kbEntries)

  const prompt = `Tu es LymIA, coach nutrition. Suggere 3 repas adaptes au contexte.

TYPE DE REPAS: ${mealType}
BUDGET CALORIQUE: ${targetCalories} kcal (±50)

PROFIL:
- Regime: ${profile.dietType || 'omnivore'}
- Allergies: ${profile.allergies?.join(', ') || 'aucune'}
- Religion: ${profile.religiousDiet || 'aucune restriction'}
- Objectif: ${profile.goal}
- Niveau cuisine: ${profile.cookingPreferences?.level || 'intermediaire'}
- Temps disponible: ${profile.cookingPreferences?.weekdayTime || 30} min

REPAS RECENTS (a eviter):
${lastMeals.slice(0, 5).join(', ') || 'aucun'}

CONTEXTE BIEN-ETRE:
- Energie: ${wellnessData.energyLevel || 3}/5
- Stress: ${wellnessData.stressLevel || 5}/10

CONNAISSANCES:
${kbContext}

INSTRUCTIONS:
- Suggere 3 options variees
- Respecte STRICTEMENT les allergies et restrictions
- Adapte au niveau d'energie (si fatigué, repas energisants)
- Si stress eleve, evite les sucres rapides

Reponds en JSON:
{
  "suggestions": [
    {
      "name": "Nom du plat",
      "calories": number,
      "proteins": number,
      "carbs": number,
      "fats": number,
      "prepTime": number,
      "reason": "Pourquoi ce plat est adapte (1 phrase)"
    }
  ],
  "reasoning": "Logique globale de selection"
}`

  try {
    const aiResult = await executeAICall(
      'meal_plan',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
        context: { mealType, goal: profile.goal, hour: new Date().getHours() },
      }
    )

    if (!aiResult) {
      return {
        mealType,
        suggestions: [],
        decision: 'Credits IA insuffisants',
        reasoning: 'Essaie plus tard ou passe au niveau superieur',
        confidence: 0,
        sources: [],
      }
    }

    const result = JSON.parse(aiResult.content || '{}')

    return {
      mealType,
      suggestions: result.suggestions || [],
      decision: `${result.suggestions?.length || 0} suggestions pour ${mealType}`,
      reasoning: result.reasoning || '',
      confidence: 0.85,
      sources: kbEntries.map(e => ({
        content: e.content.slice(0, 100),
        source: e.source,
        relevance: 0.8,
      })),
    }
  } catch (error) {
    console.error('LymIA Brain meal recommendation error:', error)
    return {
      mealType,
      suggestions: [],
      decision: 'Erreur de generation',
      reasoning: 'Service temporairement indisponible',
      confidence: 0,
      sources: [],
    }
  }
}

/**
 * Get personalized coaching advice
 * Adapts messaging based on MetabolicBoost phase if enrolled
 */
export async function getCoachingAdvice(
  context: UserContext,
  topic?: string
): Promise<CoachingAdvice[]> {
  const { profile, todayNutrition, wellnessData, currentStreak, programProgress } = context

  // Query relevant knowledge
  const queryTerms = topic || `conseil ${profile.goal} ${profile.metabolismProfile || ''}`
  const kbEntries = await queryKB(queryTerms, ['nutrition', 'wellness', 'metabolism', 'sport'])

  const kbContext = buildKBContext(kbEntries)

  // Calculate ratios for alerts
  const calorieRatio = profile.nutritionalNeeds
    ? todayNutrition.calories / profile.nutritionalNeeds.calories
    : 0
  const proteinRatio = profile.nutritionalNeeds
    ? todayNutrition.proteins / profile.nutritionalNeeds.proteins
    : 0

  // Build phase-specific context if user is in a program
  let phaseModifier = ''
  if (programProgress?.type === 'metabolic_boost') {
    const phaseMap: Record<number, 'discovery' | 'walking' | 'resistance' | 'full_program'> = {
      1: 'discovery',
      2: 'walking',
      3: 'resistance',
      4: 'full_program',
    }
    const phase = phaseMap[programProgress.phase] || 'discovery'
    phaseModifier = buildPhasePromptModifier(phase, programProgress.weekInPhase)
  }

  const prompt = `Tu es LymIA, coach bien-etre bienveillant. Donne des conseils personnalises.

SITUATION ACTUELLE:
- Heure: ${new Date().getHours()}h
- Calories consommees: ${todayNutrition.calories} (${Math.round(calorieRatio * 100)}% de l'objectif)
- Proteines: ${todayNutrition.proteins}g (${Math.round(proteinRatio * 100)}% de l'objectif)
- Streak: ${currentStreak} jours

PROFIL:
- Objectif: ${profile.goal}
- Metabolisme: ${profile.metabolismProfile || 'standard'}
${programProgress ? `- Programme: ${programProgress.type} Phase ${programProgress.phase}` : ''}

BIEN-ETRE:
- Sommeil: ${wellnessData.sleepHours || '?'}h
- Stress: ${wellnessData.stressLevel || '?'}/10
- Energie: ${wellnessData.energyLevel || '?'}/5
- Hydratation: ${wellnessData.hydrationLiters || '?'}L

CONNAISSANCES SCIENTIFIQUES:
${kbContext}
${phaseModifier}

INSTRUCTIONS:
1. Identifie 1-3 conseils PRIORITAIRES bases sur la situation
2. Pour chaque conseil, indique:
   - priority: high (alerte), medium (conseil), low (tip)
   - category: nutrition, wellness, sport, motivation, ou alert
3. Cite les sources scientifiques quand pertinent
4. Sois bienveillant, jamais culpabilisant
5. Si streak > 7 jours, felicite!
${programProgress?.type === 'metabolic_boost' && programProgress.phase === 1 ? '\n6. RAPPEL: Phase 1 = AUCUNE restriction calorique. Ne JAMAIS alerter sur un surplus calorique.' : ''}

Reponds en JSON:
{
  "advices": [
    {
      "message": "Message coach (2-3 phrases max)",
      "priority": "high|medium|low",
      "category": "nutrition|wellness|sport|motivation|alert",
      "actionItems": ["action concrete 1", "action 2"],
      "source": "Source scientifique si applicable"
    }
  ]
}`

  try {
    const aiResult = await executeAICall(
      'coach_insight',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.6,
        responseFormat: { type: 'json_object' },
        context: { topic, goal: profile.goal, streak: currentStreak },
      }
    )

    if (!aiResult) {
      return []
    }

    const result = JSON.parse(aiResult.content || '{}')

    return (result.advices || []).map((advice: {
      message: string
      priority: 'high' | 'medium' | 'low'
      category: 'nutrition' | 'wellness' | 'sport' | 'motivation' | 'alert'
      actionItems?: string[]
      source?: string
    }) => ({
      message: advice.message,
      priority: advice.priority,
      category: advice.category,
      actionItems: advice.actionItems,
      decision: advice.message.slice(0, 50),
      reasoning: advice.source || 'Conseil personnalise LymIA',
      confidence: 0.85,
      sources: kbEntries.slice(0, 2).map(e => ({
        content: e.content.slice(0, 100),
        source: e.source,
        relevance: 0.8,
      })),
    }))
  } catch (error) {
    console.error('LymIA Brain coaching error:', error)
    return []
  }
}

/**
 * Evaluate program progress and suggest adaptations
 */
export async function evaluateProgramProgress(
  context: UserContext,
  programType: 'metabolic_boost' | 'sport_initiation'
): Promise<ProgramAdaptation> {
  const { profile, wellnessData, programProgress } = context

  if (!programProgress) {
    return {
      shouldProgress: false,
      adjustments: [],
      nextPhaseReady: false,
      decision: 'Pas de programme actif',
      reasoning: '',
      confidence: 0,
      sources: [],
    }
  }

  // Query knowledge base for program guidelines
  const kbEntries = await queryKB(
    `${programType} phase ${programProgress.phase} progression adaptation`,
    ['metabolism', 'sport']
  )

  const kbContext = buildKBContext(kbEntries)

  const prompt = `Tu es LymIA, coach specialise en programmes de remise en forme.

PROGRAMME: ${programType}
PHASE ACTUELLE: ${programProgress.phase}
SEMAINE: ${programProgress.weekInPhase}
TAUX COMPLETION: ${Math.round(programProgress.completionRate * 100)}%

DONNEES BIEN-ETRE:
- Energie moyenne: ${wellnessData.energyLevel || 3}/5
- Stress: ${wellnessData.stressLevel || 5}/10
- Sommeil: ${wellnessData.sleepHours || 7}h

PROFIL:
- Metabolisme: ${profile.metabolismProfile || 'standard'}

CONNAISSANCES DU PROGRAMME:
${kbContext}

INSTRUCTIONS:
1. Evalue si l'utilisateur est pret a progresser
2. Suggere des ajustements si necessaire
3. Criteres de progression:
   - Minimum de semaines dans la phase
   - Taux de completion >= 70%
   - Energie >= 2.5/5 (ne pas progresser si fatigue)

Reponds en JSON:
{
  "shouldProgress": boolean,
  "nextPhaseReady": boolean,
  "adjustments": [
    {
      "target": "nom de la metrique",
      "oldValue": number,
      "newValue": number,
      "reason": "pourquoi cet ajustement"
    }
  ],
  "reasoning": "Explication de l'evaluation"
}`

  try {
    const aiResult = await executeAICall(
      'wellness_advice',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.4,
        responseFormat: { type: 'json_object' },
        context: { programType, phase: programProgress.phase },
      }
    )

    if (!aiResult) {
      return {
        shouldProgress: false,
        adjustments: [],
        nextPhaseReady: false,
        decision: 'Credits IA insuffisants',
        reasoning: 'Essaie plus tard',
        confidence: 0,
        sources: [],
      }
    }

    const result = JSON.parse(aiResult.content || '{}')

    return {
      shouldProgress: result.shouldProgress || false,
      nextPhaseReady: result.nextPhaseReady || false,
      adjustments: result.adjustments || [],
      decision: result.nextPhaseReady ? 'Pret pour la phase suivante' : 'Continuer la phase actuelle',
      reasoning: result.reasoning || '',
      confidence: 0.85,
      sources: kbEntries.map(e => ({
        content: e.content.slice(0, 100),
        source: e.source,
        relevance: 0.8,
      })),
    }
  } catch (error) {
    console.error('LymIA Brain program evaluation error:', error)
    return {
      shouldProgress: false,
      adjustments: [],
      nextPhaseReady: false,
      decision: 'Erreur evaluation',
      reasoning: 'Service temporairement indisponible',
      confidence: 0,
      sources: [],
    }
  }
}

// ============= HISTORY & RESULTS ANALYSIS =============

export interface HistoryData {
  meals: Array<{
    date: string
    name: string
    mealType: MealType
    nutrition: { calories: number; proteins: number; carbs: number; fats: number }
  }>
  dailyTotals: Array<{
    date: string
    calories: number
    proteins: number
    carbs: number
    fats: number
  }>
  wellness: Array<{
    date: string
    sleepHours?: number
    stressLevel?: number
    energyLevel?: number
    hydrationLiters?: number
    weight?: number
  }>
}

export interface HistoryAnalysis extends RAGDecision {
  patterns: Array<{
    type: 'positive' | 'negative' | 'neutral'
    description: string
    frequency: string
    impact: string
  }>
  recommendations: string[]
  alerts: Array<{
    severity: 'low' | 'medium' | 'high'
    message: string
    action: string
  }>
  summary: string
}

export interface ResultsAnalysis extends RAGDecision {
  progressSummary: {
    period: string
    caloriesTrend: 'deficit' | 'surplus' | 'maintenance' | 'irregular'
    proteinAdherence: number // 0-100%
    consistencyScore: number // 0-100%
    weightChange?: number // kg
  }
  achievements: string[]
  areasToImprove: Array<{
    area: string
    currentValue: string
    targetValue: string
    suggestion: string
  }>
  nextSteps: string[]
  motivationalMessage: string
}

/**
 * Analyze user history (meals, wellness) using RAG knowledge
 */
export async function analyzeUserHistory(
  context: UserContext,
  history: HistoryData,
  focusArea?: 'nutrition' | 'wellness' | 'habits' | 'all'
): Promise<HistoryAnalysis> {
  const focus = focusArea || 'all'

  // Query knowledge base for relevant guidelines
  const kbEntries = await queryKB(
    `analyse habitudes alimentaires ${context.profile.goal} patterns nutrition comportement`,
    ['nutrition', 'wellness', 'guidelines', 'metabolism']
  )
  const kbContext = buildKBContext(kbEntries)

  // Calculate statistics from history
  const avgCalories = history.dailyTotals.length > 0
    ? Math.round(history.dailyTotals.reduce((sum, d) => sum + d.calories, 0) / history.dailyTotals.length)
    : 0
  const avgProteins = history.dailyTotals.length > 0
    ? Math.round(history.dailyTotals.reduce((sum, d) => sum + d.proteins, 0) / history.dailyTotals.length)
    : 0

  const avgSleep = history.wellness.filter(w => w.sleepHours).length > 0
    ? (history.wellness.reduce((sum, w) => sum + (w.sleepHours || 0), 0) / history.wellness.filter(w => w.sleepHours).length).toFixed(1)
    : 'N/A'
  const avgStress = history.wellness.filter(w => w.stressLevel).length > 0
    ? (history.wellness.reduce((sum, w) => sum + (w.stressLevel || 0), 0) / history.wellness.filter(w => w.stressLevel).length).toFixed(1)
    : 'N/A'

  // Get meal frequency by type
  const mealTypeCounts: Record<string, number> = {}
  history.meals.forEach(m => {
    mealTypeCounts[m.mealType] = (mealTypeCounts[m.mealType] || 0) + 1
  })

  // Recent meals for pattern detection
  const recentMeals = history.meals.slice(-20).map(m => m.name).join(', ')

  const prompt = `Tu es LymIA, expert en analyse nutritionnelle. Analyse l'historique de l'utilisateur.

PROFIL:
- Objectif: ${context.profile.goal}
- Poids: ${context.profile.weight} kg
- Besoins caloriques: ${context.profile.nutritionalNeeds?.calories || 'non defini'} kcal

DONNEES HISTORIQUES (${history.dailyTotals.length} jours):
- Calories moyenne: ${avgCalories} kcal/jour
- Proteines moyenne: ${avgProteins}g/jour
- Sommeil moyen: ${avgSleep}h
- Stress moyen: ${avgStress}/10
- Repas enregistres: ${history.meals.length}
- Distribution repas: ${JSON.stringify(mealTypeCounts)}

REPAS RECENTS:
${recentMeals || 'Aucun repas enregistre'}

CONNAISSANCES SCIENTIFIQUES:
${kbContext}

FOCUS D'ANALYSE: ${focus}

INSTRUCTIONS:
1. Identifie les PATTERNS (positifs et negatifs) dans les habitudes
2. Compare avec les recommandations scientifiques
3. Detecte les alertes potentielles (carences, exces, irregularites)
4. Propose des recommandations CONCRETES et PERSONNALISEES
5. Sois bienveillant mais honnete

Reponds en JSON:
{
  "patterns": [
    {
      "type": "positive|negative|neutral",
      "description": "Description du pattern",
      "frequency": "quotidien|souvent|parfois",
      "impact": "Impact sur les objectifs"
    }
  ],
  "recommendations": ["Recommandation 1", "Recommandation 2"],
  "alerts": [
    {
      "severity": "low|medium|high",
      "message": "Description de l'alerte",
      "action": "Action a prendre"
    }
  ],
  "summary": "Resume en 2-3 phrases de l'analyse"
}`

  try {
    const aiResult = await executeAICall(
      'behavior_analysis',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.4,
        responseFormat: { type: 'json_object' },
        context: { focus, daysAnalyzed: history.dailyTotals.length },
      }
    )

    if (!aiResult) {
      return {
        patterns: [],
        recommendations: ['Credits IA insuffisants pour l\'analyse comportementale'],
        alerts: [],
        summary: 'Passe au niveau superieur pour cette fonctionnalite',
        decision: 'Credits insuffisants',
        reasoning: 'Requiert plus de credits',
        confidence: 0,
        sources: [],
      }
    }

    const result = JSON.parse(aiResult.content || '{}')

    return {
      patterns: result.patterns || [],
      recommendations: result.recommendations || [],
      alerts: result.alerts || [],
      summary: result.summary || 'Analyse non disponible',
      decision: `Analyse de ${history.dailyTotals.length} jours`,
      reasoning: result.summary,
      confidence: kbEntries.length > 0 ? 0.85 : 0.7,
      sources: kbEntries.map(e => ({
        content: e.content.slice(0, 100),
        source: e.source,
        relevance: 0.8,
      })),
    }
  } catch (error) {
    console.error('LymIA history analysis error:', error)
    return {
      patterns: [],
      recommendations: ['Continuer a enregistrer tes repas pour une meilleure analyse'],
      alerts: [],
      summary: 'Analyse temporairement indisponible',
      decision: 'Erreur',
      reasoning: 'Service indisponible',
      confidence: 0,
      sources: [],
    }
  }
}

/**
 * Analyze user results and progress using RAG knowledge
 */
export async function analyzeResults(
  context: UserContext,
  history: HistoryData,
  period: 'week' | 'month' | 'all' = 'week'
): Promise<ResultsAnalysis> {
  // Query knowledge base for progress evaluation
  const kbEntries = await queryKB(
    `progression perte poids resultats evaluation metabolisme adaptation`,
    ['nutrition', 'metabolism', 'wellness', 'guidelines']
  )
  const kbContext = buildKBContext(kbEntries)

  // Filter data by period
  const now = new Date()
  const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365
  const cutoffDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const periodData = history.dailyTotals.filter(d => d.date >= cutoffDate)
  const periodWellness = history.wellness.filter(w => w.date >= cutoffDate)

  // Calculate trends
  const avgCalories = periodData.length > 0
    ? Math.round(periodData.reduce((sum, d) => sum + d.calories, 0) / periodData.length)
    : 0
  const targetCalories = context.profile.nutritionalNeeds?.calories || 2000

  let caloriesTrend: 'deficit' | 'surplus' | 'maintenance' | 'irregular' = 'maintenance'
  if (avgCalories < targetCalories * 0.9) caloriesTrend = 'deficit'
  else if (avgCalories > targetCalories * 1.1) caloriesTrend = 'surplus'

  // Check consistency (how many days logged vs period)
  const consistencyScore = Math.round((periodData.length / periodDays) * 100)

  // Protein adherence
  const avgProteins = periodData.length > 0
    ? periodData.reduce((sum, d) => sum + d.proteins, 0) / periodData.length
    : 0
  const targetProteins = context.profile.nutritionalNeeds?.proteins || 100
  const proteinAdherence = Math.min(100, Math.round((avgProteins / targetProteins) * 100))

  // Weight change
  const weightsInPeriod = periodWellness.filter(w => w.weight).sort((a, b) => a.date.localeCompare(b.date))
  let weightChange: number | undefined
  if (weightsInPeriod.length >= 2) {
    const firstWeight = weightsInPeriod[0].weight!
    const lastWeight = weightsInPeriod[weightsInPeriod.length - 1].weight!
    weightChange = Math.round((lastWeight - firstWeight) * 10) / 10
  }

  const prompt = `Tu es LymIA, coach nutrition. Analyse les resultats et la progression.

PROFIL:
- Objectif: ${context.profile.goal}
- Poids actuel: ${context.profile.weight} kg
- Objectif calorique: ${targetCalories} kcal
- Objectif proteines: ${targetProteins}g

RESULTATS (${period === 'week' ? 'semaine' : period === 'month' ? 'mois' : 'total'}):
- Jours enregistres: ${periodData.length}/${periodDays}
- Calories moyenne: ${avgCalories} kcal/jour (objectif: ${targetCalories})
- Proteines moyenne: ${Math.round(avgProteins)}g/jour (objectif: ${targetProteins})
- Tendance calories: ${caloriesTrend}
- Consistance: ${consistencyScore}%
- Adherence proteines: ${proteinAdherence}%
${weightChange !== undefined ? `- Evolution poids: ${weightChange > 0 ? '+' : ''}${weightChange} kg` : ''}

CONNAISSANCES SCIENTIFIQUES:
${kbContext}

INSTRUCTIONS:
1. Evalue la progression par rapport a l'objectif
2. Identifie les reussites a celebrer
3. Pointe les axes d'amelioration avec des suggestions concretes
4. Propose les prochaines etapes
5. Termine par un message motivant personnalise

Reponds en JSON:
{
  "achievements": ["Reussite 1", "Reussite 2"],
  "areasToImprove": [
    {
      "area": "Domaine",
      "currentValue": "Valeur actuelle",
      "targetValue": "Objectif",
      "suggestion": "Comment ameliorer"
    }
  ],
  "nextSteps": ["Etape 1", "Etape 2", "Etape 3"],
  "motivationalMessage": "Message personnalise et encourageant"
}`

  try {
    const aiResult = await executeAICall(
      'coach_insight',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.5,
        responseFormat: { type: 'json_object' },
        context: { period, goal: context.profile.goal },
      }
    )

    if (!aiResult) {
      return {
        progressSummary: {
          period: period === 'week' ? '7 jours' : period === 'month' ? '30 jours' : 'Total',
          caloriesTrend,
          proteinAdherence,
          consistencyScore,
          weightChange,
        },
        achievements: [],
        areasToImprove: [],
        nextSteps: ['Continue a enregistrer tes donnees'],
        motivationalMessage: 'Credits IA insuffisants',
        decision: 'Credits insuffisants',
        reasoning: 'Essaie plus tard',
        confidence: 0,
        sources: [],
      }
    }

    const result = JSON.parse(aiResult.content || '{}')

    return {
      progressSummary: {
        period: period === 'week' ? '7 jours' : period === 'month' ? '30 jours' : 'Total',
        caloriesTrend,
        proteinAdherence,
        consistencyScore,
        weightChange,
      },
      achievements: result.achievements || [],
      areasToImprove: result.areasToImprove || [],
      nextSteps: result.nextSteps || [],
      motivationalMessage: result.motivationalMessage || 'Continue comme ca !',
      decision: `Analyse ${period}`,
      reasoning: `Consistance: ${consistencyScore}%, Proteines: ${proteinAdherence}%`,
      confidence: periodData.length >= 3 ? 0.85 : 0.6,
      sources: kbEntries.map(e => ({
        content: e.content.slice(0, 100),
        source: e.source,
        relevance: 0.8,
      })),
    }
  } catch (error) {
    console.error('LymIA results analysis error:', error)
    return {
      progressSummary: {
        period: period === 'week' ? '7 jours' : period === 'month' ? '30 jours' : 'Total',
        caloriesTrend: 'irregular',
        proteinAdherence: 0,
        consistencyScore: 0,
        weightChange: undefined,
      },
      achievements: [],
      areasToImprove: [],
      nextSteps: ['Continue a enregistrer tes donnees'],
      motivationalMessage: 'Chaque jour est une nouvelle opportunite !',
      decision: 'Erreur',
      reasoning: 'Service indisponible',
      confidence: 0,
      sources: [],
    }
  }
}

/**
 * Answer any nutrition/wellness question using RAG
 */
export async function askLymIA(
  question: string,
  context: UserContext
): Promise<{ answer: string; sources: string[] }> {
  const kbEntries = await queryKB(question)
  const kbContext = buildKBContext(kbEntries)

  const prompt = `Tu es LymIA, assistant nutrition et bien-etre. Reponds a cette question:

QUESTION: ${question}

CONTEXTE UTILISATEUR:
- Objectif: ${context.profile.goal}
- Regime: ${context.profile.dietType || 'omnivore'}
- Allergies: ${context.profile.allergies?.join(', ') || 'aucune'}

CONNAISSANCES:
${kbContext || 'Aucune connaissance specifique trouvee dans la base.'}

INSTRUCTIONS:
- Reponds de maniere concise (2-4 phrases max)
- Cite les sources si pertinent (ANSES, INSERM, etc.)
- Si tu n'es pas sur, dis-le
- Sois bienveillant et encourageant`

  try {
    const aiResult = await executeAICall(
      'chat',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.5,
        context: { question: question.slice(0, 50) },
      }
    )

    if (!aiResult) {
      return {
        answer: 'Credits IA insuffisants. Essaie plus tard.',
        sources: [],
      }
    }

    return {
      answer: aiResult.content || 'Je ne peux pas repondre pour le moment.',
      sources: kbEntries.map(e => e.source),
    }
  } catch (error) {
    console.error('LymIA Brain ask error:', error)
    return {
      answer: 'Desole, je ne peux pas repondre pour le moment. Reessaie plus tard.',
      sources: [],
    }
  }
}

// ============= CONNECTED INSIGHTS =============

/**
 * Connected Insight - Messages that link features together
 * This is KEY to avoid the app feeling "loaded" with disconnected features
 */
export interface ConnectedInsight {
  id: string
  message: string
  linkedFeatures: Array<'nutrition' | 'sport' | 'sleep' | 'stress' | 'hydration' | 'weight'>
  actionLabel?: string
  actionRoute?: string
  priority: 'high' | 'medium' | 'low'
  icon: 'link' | 'alert' | 'tip' | 'celebration'
}

/**
 * Generate connected insights that explain relationships between features
 * This makes the app feel cohesive - the coach explains WHY things are connected
 * Adapts to MetabolicBoost phase when applicable
 */
export async function generateConnectedInsights(
  context: UserContext
): Promise<ConnectedInsight[]> {
  const { profile, todayNutrition, wellnessData, programProgress } = context

  // Query knowledge base for cross-domain relationships
  const kbEntries = await queryKB(
    `lien sommeil nutrition performance sport stress cortisol metabolisme recuperation`,
    ['nutrition', 'wellness', 'sport', 'metabolism']
  )
  const kbContext = buildKBContext(kbEntries)

  // Calculate ratios
  const calorieRatio = profile.nutritionalNeeds
    ? todayNutrition.calories / profile.nutritionalNeeds.calories
    : 0
  const proteinRatio = profile.nutritionalNeeds
    ? todayNutrition.proteins / profile.nutritionalNeeds.proteins
    : 0

  // Build phase-specific context if user is in MetabolicBoost program
  let phaseModifier = ''
  let phaseSpecificInstructions = ''
  if (programProgress?.type === 'metabolic_boost') {
    const phaseMap: Record<number, 'discovery' | 'walking' | 'resistance' | 'full_program'> = {
      1: 'discovery',
      2: 'walking',
      3: 'resistance',
      4: 'full_program',
    }
    const phase = phaseMap[programProgress.phase] || 'discovery'
    phaseModifier = buildPhasePromptModifier(phase, programProgress.weekInPhase)

    if (programProgress.phase === 1) {
      phaseSpecificInstructions = `
IMPORTANT - PHASE 1 METABOLIQUE:
- NE JAMAIS mentionner de deficit calorique
- NE JAMAIS culpabiliser sur les calories
- Focus sur: sommeil, hydratation, habitudes, marche
- Si surplus calorique: "C'est normal en phase stabilisation"`
    }
  }

  const prompt = `Tu es LymIA, le coach central de l'app. Ta mission ESSENTIELLE est de CONNECTER les différentes dimensions de la santé pour que l'utilisateur comprenne que tout est lié.

CONTEXTE ACTUEL:
- Heure: ${new Date().getHours()}h
- Calories: ${todayNutrition.calories} (${Math.round(calorieRatio * 100)}% objectif)
- Protéines: ${todayNutrition.proteins}g (${Math.round(proteinRatio * 100)}% objectif)
- Sommeil: ${wellnessData.sleepHours || '?'}h
- Stress: ${wellnessData.stressLevel || '?'}/10
- Énergie: ${wellnessData.energyLevel || '?'}/5
- Hydratation: ${wellnessData.hydrationLiters || '?'}L
${programProgress ? `- Programme actif: ${programProgress.type}` : ''}

PROFIL:
- Objectif: ${profile.goal}

CONNAISSANCES SCIENTIFIQUES:
${kbContext}
${phaseModifier}
${phaseSpecificInstructions}

MISSION CRUCIALE:
Tu dois générer 2-3 messages qui CONNECTENT explicitement les features entre elles.
Exemples de connexions à faire:
- "Ton sommeil de 5h va impacter ta faim aujourd'hui → je te propose des repas plus rassasiants"
- "Ton stress élevé + déficit calorique = risque de craquage → on ajuste tes repas"
- "Excellente nuit ! Parfait pour ta séance sport → voici un petit-déj adapté"
- "Tu n'as pas bu assez → ça peut expliquer ta fatigue → hydrate-toi avant le sport"

FORMAT OBLIGATOIRE - Messages courts et connecteurs:
- Commence par constater un FAIT (donnée)
- Utilise "→" ou "donc" pour CONNECTER à une autre dimension
- Termine par une ACTION ou PROPOSITION

Réponds en JSON:
{
  "insights": [
    {
      "message": "Message court connectant 2-3 dimensions (max 100 caractères)",
      "linkedFeatures": ["feature1", "feature2"],
      "actionLabel": "Bouton action (optionnel)",
      "actionRoute": "route navigation (optionnel)",
      "priority": "high|medium|low",
      "icon": "link|alert|tip|celebration"
    }
  ]
}`

  try {
    const aiResult = await executeAICall(
      'coach_insight',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
        context: { goal: profile.goal, hasWellnessData: !!wellnessData.sleepHours },
      }
    )

    if (!aiResult) {
      return generateStaticConnectedInsights(context)
    }

    const result = JSON.parse(aiResult.content || '{}')

    return (result.insights || []).map((insight: {
      message: string
      linkedFeatures: string[]
      actionLabel?: string
      actionRoute?: string
      priority: 'high' | 'medium' | 'low'
      icon: 'link' | 'alert' | 'tip' | 'celebration'
    }, index: number) => ({
      id: `insight_${Date.now()}_${index}`,
      message: insight.message,
      linkedFeatures: insight.linkedFeatures as ConnectedInsight['linkedFeatures'],
      actionLabel: insight.actionLabel,
      actionRoute: insight.actionRoute,
      priority: insight.priority || 'medium',
      icon: insight.icon || 'link',
    }))
  } catch (error) {
    console.error('LymIA connected insights error:', error)
    // Fallback with static connected insights based on data
    return generateStaticConnectedInsights(context)
  }
}

/**
 * Fallback static insights when AI is unavailable
 */
function generateStaticConnectedInsights(context: UserContext): ConnectedInsight[] {
  const insights: ConnectedInsight[] = []
  const { wellnessData, todayNutrition, profile } = context

  // Sleep → Nutrition connection
  if (wellnessData.sleepHours !== undefined && wellnessData.sleepHours < 6) {
    insights.push({
      id: `static_sleep_nutrition_${Date.now()}`,
      message: `${wellnessData.sleepHours}h de sommeil → je privilégie des repas rassasiants aujourd'hui`,
      linkedFeatures: ['sleep', 'nutrition'],
      actionLabel: 'Voir suggestions',
      priority: 'high',
      icon: 'link',
    })
  }

  // Stress → Nutrition connection
  if (wellnessData.stressLevel !== undefined && wellnessData.stressLevel >= 7) {
    insights.push({
      id: `static_stress_nutrition_${Date.now()}`,
      message: `Stress élevé (${wellnessData.stressLevel}/10) → on évite les sucres rapides`,
      linkedFeatures: ['stress', 'nutrition'],
      priority: 'medium',
      icon: 'alert',
    })
  }

  // Hydration → Energy connection
  if (wellnessData.hydrationLiters !== undefined && wellnessData.hydrationLiters < 1) {
    insights.push({
      id: `static_hydration_energy_${Date.now()}`,
      message: `Hydratation faible → peut expliquer ta fatigue, bois avant toute activité`,
      linkedFeatures: ['hydration', 'sport'],
      actionLabel: 'Ajouter eau',
      priority: 'medium',
      icon: 'tip',
    })
  }

  // Good sleep → Sport opportunity
  if (wellnessData.sleepHours !== undefined && wellnessData.sleepHours >= 7 && wellnessData.energyLevel !== undefined && wellnessData.energyLevel >= 4) {
    insights.push({
      id: `static_sleep_sport_${Date.now()}`,
      message: `Bonne nuit + énergie → journée idéale pour une séance sport !`,
      linkedFeatures: ['sleep', 'sport'],
      actionLabel: 'Programme sport',
      actionRoute: 'SportInitiation',
      priority: 'low',
      icon: 'celebration',
    })
  }

  // Protein deficit → Sport impact
  const proteinRatio = profile.nutritionalNeeds
    ? todayNutrition.proteins / profile.nutritionalNeeds.proteins
    : 1
  if (proteinRatio < 0.5 && new Date().getHours() >= 16) {
    insights.push({
      id: `static_protein_sport_${Date.now()}`,
      message: `Protéines basses → récupération musculaire compromise, rattrape ce soir`,
      linkedFeatures: ['nutrition', 'sport'],
      priority: 'medium',
      icon: 'link',
    })
  }

  // Default insight based on time of day if no other insights
  if (insights.length === 0) {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 11) {
      insights.push({
        id: `static_morning_${Date.now()}`,
        message: `Bien commencer → un petit-déj protéiné stabilise ton énergie toute la matinée`,
        linkedFeatures: ['nutrition', 'sport'],
        actionLabel: 'Voir recettes',
        priority: 'low',
        icon: 'tip',
      })
    } else if (hour >= 11 && hour < 14) {
      insights.push({
        id: `static_lunch_${Date.now()}`,
        message: `Déjeuner équilibré → évite le coup de barre de 15h, privilégie les protéines`,
        linkedFeatures: ['nutrition', 'sleep'],
        priority: 'low',
        icon: 'tip',
      })
    } else if (hour >= 14 && hour < 18) {
      insights.push({
        id: `static_afternoon_${Date.now()}`,
        message: `Collation intelligente → un encas protéiné maintient ton énergie jusqu'au dîner`,
        linkedFeatures: ['nutrition', 'sport'],
        priority: 'low',
        icon: 'tip',
      })
    } else {
      insights.push({
        id: `static_evening_${Date.now()}`,
        message: `Dîner léger → facilite la digestion et améliore la qualité de ton sommeil`,
        linkedFeatures: ['nutrition', 'sleep'],
        priority: 'low',
        icon: 'tip',
      })
    }
  }

  return insights.slice(0, 3) // Max 3 insights
}

// ============= EXPORTS =============

export const LymIABrain = {
  // Core functions
  calculatePersonalizedNeeds,
  getMealRecommendations,
  getCoachingAdvice,
  evaluateProgramProgress,
  askLymIA,

  // History & Results Analysis
  analyzeUserHistory,
  analyzeResults,

  // Connected Insights (NEW - Key for cohesive UX)
  generateConnectedInsights,
}

export default LymIABrain
