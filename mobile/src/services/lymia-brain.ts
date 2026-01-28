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
import {
  isDSPyEnabled,
  hookRewriteQuery,
  hookSelectEvidence,
  runEnhancedRAG,
  formatCitationsForDisplay,
  extractSourcesFromCitations,
  kbEntriesToPassages,
} from './dspy'
import {
  PromptSystem,
  LYMIA_SYSTEM_PROMPT,
  RAG_CONTEXT_TEMPLATE,
  USER_CONTEXT_TEMPLATE,
  WELLNESS_CONTEXT_TEMPLATE,
  FASTING_CONTEXT_TEMPLATE,
  buildPrompt,
  parseAIResponse,
} from '../lib/ai/prompt-system'
import type {
  UserProfile,
  NutritionInfo,
  MealType,
  CookingPreferences,
  LifestyleHabits,
  MetabolismFactors,
  NutritionalNeeds
} from '../types'
import {
  calculateBMR,
  calculateTDEE,
  calculateNutritionalNeeds as calculateNutritionBase,
  ACTIVITY_MULTIPLIERS
} from './nutrition-calculator'

// ============= CONFIGURATION =============

// Lazy initialization of OpenAI client to avoid loading at startup
let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
    })
  }
  return _openai
}

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
  fastingContext?: {
    schedule: string
    isInEatingWindow: boolean
    eatingWindowStart?: number
    eatingWindowEnd?: number
    hoursUntilEatingWindow?: number
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

// ============= FASTING HELPERS =============

/**
 * Check if user is currently in their eating window
 */
export function isInEatingWindow(eatingWindowStart?: number, eatingWindowEnd?: number): boolean {
  if (eatingWindowStart === undefined || eatingWindowEnd === undefined) {
    return true // No fasting configured = always eating window
  }
  const currentHour = new Date().getHours()
  return currentHour >= eatingWindowStart && currentHour < eatingWindowEnd
}

/**
 * Get hours until eating window opens
 */
export function getHoursUntilEatingWindow(eatingWindowStart?: number): number | undefined {
  if (eatingWindowStart === undefined) return undefined
  const currentHour = new Date().getHours()
  if (currentHour >= eatingWindowStart) return 0
  return eatingWindowStart - currentHour
}

/**
 * Build fasting context from user profile
 */
export function buildFastingContext(profile: UserProfile): UserContext['fastingContext'] | undefined {
  const fasting = profile.lifestyleHabits?.fasting
  if (!fasting || fasting.schedule === 'none') return undefined

  return {
    schedule: fasting.schedule,
    isInEatingWindow: isInEatingWindow(fasting.eatingWindowStart, fasting.eatingWindowEnd),
    eatingWindowStart: fasting.eatingWindowStart,
    eatingWindowEnd: fasting.eatingWindowEnd,
    hoursUntilEatingWindow: getHoursUntilEatingWindow(fasting.eatingWindowStart),
  }
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
    const response = await getOpenAI().chat.completions.create({
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
 *
 * IMPORTANT: Uses the centralized nutrition-calculator service (Mifflin-St Jeor + ISSN/ANSES).
 * This function adds real-time wellness adjustments on top of the base calculations.
 *
 * Sources prioritaires: ANSES, EFSA, OMS pour les recommandations macros
 */
export async function calculatePersonalizedNeeds(
  context: UserContext
): Promise<CalorieRecommendation> {
  const { profile, wellnessData } = context

  // ==========================================================================
  // STEP 1: Use centralized nutrition calculator for base values
  // ==========================================================================

  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender)
  const tdee = calculateTDEE(bmr, profile.activityLevel)

  // Get base nutritional needs from centralized service
  const baseNeeds = calculateNutritionBase(profile, {
    sleepHours: wellnessData.sleepHours,
    stressLevel: wellnessData.stressLevel,
  })

  if (!baseNeeds) {
    // Fallback if profile is incomplete
    return {
      calories: Math.round(tdee),
      proteins: Math.round(profile.weight * 1.6),
      carbs: 200,
      fats: Math.round(profile.weight * 0.9),
      decision: 'Données incomplètes',
      reasoning: 'Profil incomplet - calcul basique appliqué',
      confidence: 0.5,
      sources: [],
    }
  }

  // ==========================================================================
  // STEP 2: Real-time wellness adjustments (on top of base calculations)
  // ==========================================================================

  let adjustedCalories = baseNeeds.calories
  let adjustedProteins = baseNeeds.proteins
  const adjustmentReasons: string[] = (baseNeeds as { _adjustmentReasons?: string[] })._adjustmentReasons || []

  // Today's stress level (from wellness check-in, scale 1-10)
  const baselineStress = profile.lifestyleHabits?.stressLevelDaily
  if (wellnessData.stressLevel && wellnessData.stressLevel >= 7) {
    if (baselineStress !== 'high' && baselineStress !== 'very_high') {
      adjustedProteins = Math.round(adjustedProteins * 1.05)
      adjustmentReasons.push('Stress élevé aujourd\'hui: protéines +5%')
    }
  }

  // Today's sleep (from wellness check-in)
  const baselineSleepHours = profile.lifestyleHabits?.averageSleepHours
  if (wellnessData.sleepHours && wellnessData.sleepHours < 6) {
    if (!baselineSleepHours || baselineSleepHours >= 6) {
      adjustedProteins = Math.round(adjustedProteins * 1.05)
      adjustmentReasons.push('Nuit courte: protéines +5%')
    }
  }

  // Recalculate carbs if proteins were adjusted
  const adjustedProteinCalories = adjustedProteins * 4
  const fatCalories = baseNeeds.fats * 9
  const remainingCalories = adjustedCalories - adjustedProteinCalories - fatCalories
  const adjustedCarbs = Math.max(80, Math.round(remainingCalories / 4))

  console.log('[LymIABrain] Personalized needs calculated:', {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: adjustedCalories,
    proteins: adjustedProteins,
    carbs: adjustedCarbs,
    fats: baseNeeds.fats,
    adjustments: adjustmentReasons,
  })

  const activityMultiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel] || 1.55

  return {
    calories: adjustedCalories,
    proteins: adjustedProteins,
    carbs: adjustedCarbs,
    fats: baseNeeds.fats,
    decision: `${adjustedCalories} kcal/jour`,
    reasoning: `Calcul Mifflin-St Jeor (BMR: ${Math.round(bmr)} kcal) × NAP ${activityMultiplier} = TDEE ${Math.round(tdee)} kcal. ` +
      (profile.goal === 'weight_loss' ? 'Déficit pour perte progressive. ' : '') +
      (profile.goal === 'muscle_gain' ? 'Surplus pour prise de masse. ' : '') +
      `Macros calculés selon ISSN/ANSES.`,
    adjustmentReason: adjustmentReasons.length > 0 ? adjustmentReasons.join('. ') : undefined,
    confidence: 0.95,
    sources: [{ content: 'ISSN Position Stand 2017 + ANSES 2021 + Mifflin-St Jeor', source: 'issn', relevance: 1.0 }],
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
  const { profile, lastMeals, wellnessData, fastingContext } = context

  // Check if user is in fasting period - if so, suggest fasting-friendly options
  const inFastingPeriod = fastingContext && !fastingContext.isInEatingWindow

  // Query knowledge base for meal ideas
  const mealTypeTerms: Record<MealType, string> = {
    breakfast: 'petit dejeuner proteines energie matin',
    lunch: 'dejeuner equilibre midi repas complet',
    snack: 'collation saine encas',
    dinner: 'diner leger soir digestion',
  }

  const kbEntries = await queryKB(
    `${mealTypeTerms[mealType]} ${profile.dietType || ''} ${profile.goal}${inFastingPeriod ? ' jeune intermittent' : ''}`,
    ['nutrition', 'guidelines']
  )

  const kbContext = buildKBContext(kbEntries)

  // Build fasting context for prompt
  const fastingPromptContext = FASTING_CONTEXT_TEMPLATE(fastingContext)

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
${fastingPromptContext}

CONNAISSANCES:
${kbContext}

INSTRUCTIONS:
- Suggere 3 options variees
- Respecte STRICTEMENT les allergies et restrictions
- Adapte au niveau d'energie (si fatigué, repas energisants)
- Si stress eleve, evite les sucres rapides
${inFastingPeriod ? `- IMPORTANT: L'utilisateur est en période de JEÛNE. Suggère des boissons sans calories (eau, thé, café noir) ou indique qu'il vaut mieux attendre la fenêtre alimentaire (${fastingContext?.eatingWindowStart}h-${fastingContext?.eatingWindowEnd}h)` : ''}

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
  const { profile, todayNutrition, wellnessData, currentStreak, programProgress, fastingContext } = context

  // Query relevant knowledge - include fasting if applicable
  const fastingTerm = fastingContext?.schedule && fastingContext.schedule !== 'none' ? ' jeune intermittent' : ''
  const queryTerms = topic || `conseil ${profile.goal} ${profile.metabolismProfile || ''}${fastingTerm}`
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
${FASTING_CONTEXT_TEMPLATE(fastingContext)}

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
 * Enhanced with DSPy when available for better retrieval and grounded answers
 */
export async function askLymIA(
  question: string,
  context: UserContext
): Promise<{
  answer: string
  sources: string[]
  confidence?: number
  isGrounded?: boolean
  enhanced?: boolean
}> {
  // Check if DSPy is available for enhanced RAG
  const dspyEnabled = await isDSPyEnabled()

  // Detect supplement-related questions for food-first approach
  const supplementKeywords = ['vitamine', 'vitamin', 'fer', 'magnésium', 'magnesium', 'zinc', 'omega', 'oméga', 'complément', 'supplement', 'carence', 'b12', 'vitamine d', 'calcium', 'protéine en poudre', 'whey', 'créatine']
  const isSupplementQuestion = supplementKeywords.some(kw => question.toLowerCase().includes(kw))

  // Detect movement-related questions
  const movementKeywords = ['marche', 'sport', 'exercice', 'activité', 'bouger', 'musculation', 'course', 'vélo']
  const isMovementQuestion = movementKeywords.some(kw => question.toLowerCase().includes(kw))

  // Step 1: Query rewriting (DSPy-enhanced if available)
  let searchQueries = [question]

  // Add specific KB queries for supplements or movement
  if (isSupplementQuestion) {
    searchQueries.push('complements alimentaires ANSES food first sources alimentaires')
  }
  if (isMovementQuestion) {
    searchQueries.push('mouvement marche glycemie appetit satiete activite physique')
  }

  if (dspyEnabled) {
    const rewriteResult = await hookRewriteQuery(question, context.profile, {
      sleepHours: context.wellnessData.sleepHours,
      stressLevel: context.wellnessData.stressLevel,
    })
    if (rewriteResult.enhanced) {
      searchQueries = [...rewriteResult.queries, ...searchQueries.slice(1)]
      console.log('[LymIA] DSPy rewritten queries:', searchQueries)
    }
  }

  // Step 2: Retrieve from KB using rewritten queries
  const allEntries: KnowledgeBaseEntry[] = []
  for (const query of searchQueries.slice(0, 4)) {
    const entries = await queryKB(query)
    allEntries.push(...entries)
  }

  // Deduplicate by ID
  const uniqueEntries = Array.from(
    new Map(allEntries.map(e => [e.id, e])).values()
  )

  // Step 3: Try full DSPy pipeline for grounded answer
  if (dspyEnabled && uniqueEntries.length > 0) {
    const dspyResult = await runEnhancedRAG(
      question,
      uniqueEntries,
      context.profile,
      {
        sleepHours: context.wellnessData.sleepHours,
        stressLevel: context.wellnessData.stressLevel,
      },
      false // Don't skip verification
    )

    if (dspyResult) {
      // Format citations for display
      const formattedAnswer = formatCitationsForDisplay(dspyResult.answer, uniqueEntries)
      const sources = extractSourcesFromCitations(dspyResult.citations, uniqueEntries)

      console.log('[LymIA] DSPy grounded answer generated:', {
        confidence: dspyResult.confidence,
        isGrounded: dspyResult.is_grounded,
        citations: dspyResult.citations.length,
      })

      // Add disclaimer if not fully grounded
      let finalAnswer = formattedAnswer
      if (dspyResult.is_grounded === false && dspyResult.disclaimer) {
        finalAnswer = `${formattedAnswer}\n\n⚠️ ${dspyResult.disclaimer}`
      }

      return {
        answer: finalAnswer,
        sources: sources.length > 0 ? sources : uniqueEntries.map(e => e.source),
        confidence: dspyResult.confidence,
        isGrounded: dspyResult.is_grounded,
        enhanced: true,
      }
    }
  }

  // Fallback: Standard RAG without DSPy
  const kbContext = buildKBContext(uniqueEntries)

  // Build context-specific instructions
  let specialInstructions = ''
  if (isSupplementQuestion) {
    specialInstructions = `
RÈGLES SUPPLÉMENTS (OBLIGATOIRE):
- Approche "food first" : cite TOUJOURS les sources alimentaires en premier
- JAMAIS de dosages ni de recommandations de compléments spécifiques
- Si carence suspectée → "Un bilan sanguin avec ton médecin permettra de confirmer"
- Exceptions légitimes à mentionner : vitamine D en hiver, B12 pour végétaliens, acide folique grossesse
- Termine par "Ces informations ne remplacent pas un avis médical"`
  }
  if (isMovementQuestion) {
    specialInstructions = `
RÈGLES MOUVEMENT:
- Le mouvement est un SOUTIEN à la nutrition (pas pour "brûler des calories")
- Angle : meilleure digestion, régulation de l'appétit, qualité du sommeil
- Recommandations OMS : 150 min/semaine d'activité modérée (~20 min/jour)
- NE JAMAIS culpabiliser sur le manque d'exercice`
  }

  const prompt = `Tu es LymIA, assistant nutrition et bien-etre. Reponds a cette question:

QUESTION: ${question}

CONTEXTE UTILISATEUR:
- Objectif: ${context.profile.goal}
- Regime: ${context.profile.dietType || 'omnivore'}
- Allergies: ${context.profile.allergies?.join(', ') || 'aucune'}

CONNAISSANCES:
${kbContext || 'Aucune connaissance specifique trouvee dans la base.'}
${specialInstructions}

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
        enhanced: false,
      }
    }

    return {
      answer: aiResult.content || 'Je ne peux pas repondre pour le moment.',
      sources: uniqueEntries.map(e => e.source),
      enhanced: false,
    }
  } catch (error) {
    console.error('LymIA Brain ask error:', error)
    return {
      answer: 'Desole, je ne peux pas repondre pour le moment. Reessaie plus tard.',
      sources: [],
      enhanced: false,
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
  linkedFeatures: Array<'nutrition' | 'sport' | 'sleep' | 'stress' | 'hydration' | 'weight' | 'fasting'>
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
  const { profile, todayNutrition, wellnessData, programProgress, fastingContext } = context

  // IMPORTANT: No insights for users who haven't logged meals today
  // This prevents anxious messages for new users or users just starting their day
  // Aligns with LYM philosophy: "Sans jugement. Jamais."
  const hasLoggedMealsToday = todayNutrition.calories > 0
  if (!hasLoggedMealsToday) {
    return [] // No coach insights until user has data
  }

  // Query knowledge base for cross-domain relationships - include fasting if applicable
  const fastingTerm = fastingContext?.schedule && fastingContext.schedule !== 'none' ? ' jeune intermittent fenetre alimentaire' : ''

  // Enhanced query: include movement and supplements knowledge
  const currentHour = new Date().getHours()
  const isPostMealTime = (currentHour >= 12 && currentHour <= 14) || (currentHour >= 19 && currentHour <= 21)
  const movementTerm = isPostMealTime ? ' marche digestive glycemie mouvement' : ' activite physique appetit'

  const kbEntries = await queryKB(
    `lien sommeil nutrition performance stress cortisol metabolisme recuperation${fastingTerm}${movementTerm}`,
    ['nutrition', 'wellness', 'metabolism']
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
${FASTING_CONTEXT_TEMPLATE(fastingContext)}

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
- "Hydratation faible aujourd'hui → ça peut expliquer ta fatigue → un verre d'eau avant le sport ?"
${isPostMealTime ? `- "Après le repas → 15 min de marche réduit ton pic glycémique de 30%"
- "Digestion en cours → une petite marche aide à stabiliser ta glycémie"` : ''}
${fastingContext?.schedule && fastingContext.schedule !== 'none' ? `- "Fenêtre de jeûne en cours → parfait pour ta concentration, bois du thé/café noir"
- "Plus que ${fastingContext.hoursUntilEatingWindow || 2}h avant ta fenêtre alimentaire → prépare un repas protéiné"` : ''}

RÈGLE MOUVEMENT:
- Tu peux mentionner la marche et le mouvement comme SOUTIEN à la nutrition (pas comme "brûler des calories")
- Angle: "mouvement = meilleure digestion, moins de fringales" (PAS "sport pour maigrir")

RÈGLE SUPPLÉMENTS (si question vitamines/fer/magnésium détectée):
- TOUJOURS approche "food first" : "On trouve la vitamine D dans les poissons gras..."
- JAMAIS de dosages ni de recommandations de compléments
- Si carence suspectée → "Un bilan sanguin avec ton médecin permettra de voir"

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
 *
 * IMPORTANT: For new users (no meals logged today), we show welcoming messages
 * instead of alerts. This aligns with LYM philosophy: "Sans jugement. Jamais."
 */
function generateStaticConnectedInsights(context: UserContext): ConnectedInsight[] {
  const insights: ConnectedInsight[] = []
  const { wellnessData, todayNutrition, profile, fastingContext } = context

  // Check if user has logged any meals today - if not, show welcoming message only
  const hasLoggedMealsToday = todayNutrition.calories > 0

  // For new users or users who haven't logged meals yet: NO messages at all
  // The CoachInsights widget should not appear - let user discover the app peacefully
  if (!hasLoggedMealsToday) {
    return [] // Return empty - no insights for users without data today
  }

  // Fasting → Nutrition connection (high priority during fasting)
  if (fastingContext?.schedule && fastingContext.schedule !== 'none' && !fastingContext.isInEatingWindow) {
    insights.push({
      id: `static_fasting_${Date.now()}`,
      message: `Période de jeûne → ${fastingContext.hoursUntilEatingWindow}h avant ta fenêtre alimentaire, bois du thé/café`,
      linkedFeatures: ['fasting', 'nutrition'],
      actionLabel: 'Ajouter eau',
      priority: 'high',
      icon: 'tip',
    })
  } else if (fastingContext?.schedule && fastingContext.schedule !== 'none' && fastingContext.isInEatingWindow) {
    insights.push({
      id: `static_fasting_eating_${Date.now()}`,
      message: `Fenêtre alimentaire ouverte → concentre tes protéines sur ce repas`,
      linkedFeatures: ['fasting', 'nutrition'],
      priority: 'medium',
      icon: 'tip',
    })
  }

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

  // Good sleep → Celebrate good energy
  if (wellnessData.sleepHours !== undefined && wellnessData.sleepHours >= 7 && wellnessData.energyLevel !== undefined && wellnessData.energyLevel >= 4) {
    insights.push({
      id: `static_sleep_energy_${Date.now()}`,
      message: `Bonne nuit + énergie → journée idéale pour atteindre tes objectifs !`,
      linkedFeatures: ['sleep', 'nutrition'],
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

  // Post-meal movement insight (12h-14h or 19h-21h)
  const hour = new Date().getHours()
  const isPostMealWindow = (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21)

  if (isPostMealWindow && todayNutrition.calories > 200) {
    // User has eaten and it's post-meal time → suggest digestive walk
    insights.push({
      id: `static_movement_digestion_${Date.now()}`,
      message: `Après manger → 15 min de marche réduit le pic glycémique de 30%`,
      linkedFeatures: ['nutrition', 'sport'],
      priority: 'medium',
      icon: 'tip',
    })
  }

  // Default insight based on time of day if no other insights
  if (insights.length === 0) {
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

// ============= PERSONALIZED MESSAGE GENERATION =============

/**
 * Message types for proactive notifications
 */
export type ProactiveMessageType =
  | 'macro_alert'
  | 'encouragement'
  | 'evening_summary'
  | 'fasting_tip'
  | 'goal_reminder'

export interface PersonalizedMessageContext {
  profile: UserProfile
  todayNutrition: NutritionInfo
  targetNutrition: NutritionInfo
  streak: number
  todayMealsCount: number
  wellnessData?: {
    sleepHours?: number
    stressLevel?: number
    energyLevel?: number
  }
  fastingContext?: {
    schedule: string
    isInEatingWindow: boolean
    eatingWindowStart?: number
    eatingWindowEnd?: number
  }
  specificContext?: Record<string, unknown>
}

export interface PersonalizedMessage {
  title: string
  body: string
  emoji: string
  isAIGenerated: boolean
  confidence: number
}

/**
 * Generate a truly personalized message using AI
 * NO templates - every message is unique and contextual
 */
export async function generatePersonalizedMessage(
  messageType: ProactiveMessageType,
  context: PersonalizedMessageContext
): Promise<PersonalizedMessage | null> {
  const { profile, todayNutrition, targetNutrition, streak, todayMealsCount, wellnessData, fastingContext, specificContext } = context

  // Calculate percentages
  const caloriePercent = targetNutrition.calories > 0
    ? Math.round((todayNutrition.calories / targetNutrition.calories) * 100)
    : 0
  const proteinPercent = targetNutrition.proteins > 0
    ? Math.round((todayNutrition.proteins / targetNutrition.proteins) * 100)
    : 0

  const currentHour = new Date().getHours()
  const firstName = profile.firstName || 'toi'

  // Build context-specific prompt based on message type
  let typeSpecificPrompt = ''
  let defaultEmoji = ''

  switch (messageType) {
    case 'macro_alert':
      const alertType = specificContext?.alertType as string
      typeSpecificPrompt = `
TYPE: Alerte nutrition douce
SITUATION: ${alertType === 'low_protein' ? `Protéines basses (${todayNutrition.proteins}g sur ${targetNutrition.proteins}g objectif)` :
               alertType === 'low_calories' ? `Calories basses (${todayNutrition.calories} kcal sur ${targetNutrition.calories} kcal objectif)` :
               alertType === 'high_carbs' ? `Beaucoup de glucides aujourd'hui (${todayNutrition.carbs}g)` :
               'Déséquilibre macro détecté'}
OBJECTIF DU MESSAGE: Suggérer gentiment un ajustement pour le prochain repas, sans culpabiliser
TON: Bienveillant, comme un ami qui conseille`
      defaultEmoji = '🍽️'
      break

    case 'encouragement':
      const milestoneType = specificContext?.milestoneType as string
      const days = specificContext?.days as number
      typeSpecificPrompt = `
TYPE: Célébration / Encouragement
SITUATION: ${milestoneType === 'streak' ? `Série de ${days} jours consécutifs` :
               milestoneType === 'level' ? `Passage au niveau ${specificContext?.level}` :
               'Progression remarquable'}
OBJECTIF DU MESSAGE: Célébrer la réussite et motiver à continuer
TON: Enthousiaste mais sincère, pas exagéré`
      defaultEmoji = '🎉'
      break

    case 'evening_summary':
      typeSpecificPrompt = `
TYPE: Bilan de fin de journée
SITUATION:
- ${todayMealsCount} repas trackés
- ${caloriePercent}% de l'objectif calorique atteint (${todayNutrition.calories}/${targetNutrition.calories} kcal)
- ${proteinPercent}% de l'objectif protéines (${todayNutrition.proteins}/${targetNutrition.proteins}g)
- Série actuelle: ${streak} jours
${wellnessData?.sleepHours ? `- Sommeil nuit dernière: ${wellnessData.sleepHours}h` : ''}
${wellnessData?.stressLevel ? `- Niveau de stress: ${wellnessData.stressLevel}/10` : ''}
OBJECTIF DU MESSAGE: Récapituler la journée positivement, identifier les points forts, donner envie de continuer demain
TON: Chaleureux, comme un coach qui fait le point en fin de séance`
      defaultEmoji = caloriePercent >= 85 && caloriePercent <= 115 ? '🎉' : caloriePercent < 70 ? '💪' : '📊'
      break

    case 'fasting_tip':
      const tipType = specificContext?.tipType as string
      typeSpecificPrompt = `
TYPE: Conseil jeûne intermittent
SITUATION: ${tipType === 'fasting_period' ? `En période de jeûne (fenêtre alimentaire: ${fastingContext?.eatingWindowStart}h-${fastingContext?.eatingWindowEnd}h)` :
               tipType === 'eating_window_start' ? `Début de la fenêtre alimentaire (${fastingContext?.eatingWindowStart}h)` :
               tipType === 'eating_window_end' ? `Fin de fenêtre alimentaire proche (${fastingContext?.eatingWindowEnd}h)` :
               'Pratique du jeûne intermittent'}
OBJECTIF DU MESSAGE: Accompagner l'utilisateur dans sa pratique du jeûne avec un conseil adapté au moment
TON: Supportif et informatif`
      defaultEmoji = '🧘'
      break

    case 'goal_reminder':
      typeSpecificPrompt = `
TYPE: Rappel d'objectif motivant
SITUATION:
- Objectif: ${profile.goal === 'weight_loss' ? 'Perte de poids' : profile.goal === 'muscle_gain' ? 'Prise de muscle' : 'Maintien'}
- Progression calories: ${caloriePercent}%
- Progression protéines: ${proteinPercent}%
OBJECTIF DU MESSAGE: Rappeler gentiment l'objectif et motiver pour la suite de la journée
TON: Encourageant sans pression`
      defaultEmoji = '🎯'
      break
  }

  const prompt = `Tu es LymIA, coach nutrition bienveillant de l'app LYM. Génère un message de notification personnalisé.

UTILISATEUR:
- Prénom: ${firstName}
- Objectif: ${profile.goal}
- Streak: ${streak} jours

${typeSpecificPrompt}

RÈGLES CRITIQUES:
1. Tutoie TOUJOURS l'utilisateur
2. Message COURT: titre (5 mots max) + corps (2 phrases max)
3. JAMAIS de culpabilisation - toujours positif ou neutre
4. Personnalise avec les données réelles (chiffres, prénom si naturel)
5. Sois authentique, pas robotique
6. Évite les clichés et phrases bateau

Réponds en JSON:
{
  "title": "Titre court et accrocheur",
  "body": "Message personnalisé avec les données de l'utilisateur",
  "emoji": "Un emoji adapté"
}`

  try {
    const aiResult = await executeAICall(
      'coach_insight',
      [
        { role: 'system', content: LYMIA_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      {
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
        context: { messageType, hour: currentHour },
      }
    )

    if (!aiResult) {
      console.log('[LymIA] AI not available for personalized message')
      return null
    }

    const result = JSON.parse(aiResult.content || '{}')

    return {
      title: result.title || 'LymIA',
      body: result.body || '',
      emoji: result.emoji || defaultEmoji,
      isAIGenerated: true,
      confidence: 0.9,
    }
  } catch (error) {
    console.error('[LymIA] Error generating personalized message:', error)
    return null
  }
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

  // Personalized Messages (NO templates - pure AI)
  generatePersonalizedMessage,
}

export default LymIABrain
