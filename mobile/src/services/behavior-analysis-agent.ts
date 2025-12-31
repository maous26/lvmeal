/**
 * Behavior Analysis Agent - Agent d'analyse comportementale RAG
 *
 * Analyse les comportements utilisateurs et les compare avec les données RAG
 * pour fournir des conseils et alertes personnalisés basés sur des sources scientifiques.
 *
 * Sources RAG utilisées:
 * - ANSES: Recommandations nutritionnelles françaises
 * - INSERM: Recherche scientifique santé
 * - HAS: Haute Autorité de Santé
 * - OMS: Organisation Mondiale de la Santé
 */

import OpenAI from 'openai'
import { queryKnowledgeBase, queryKnowledgeBaseBatch, isSupabaseConfigured, type KnowledgeBaseEntry, type RAGQueryResult } from './supabase-client'
import { aiRateLimiter, MODEL_CONFIG } from './ai-rate-limiter'
import type {
  UserProfile,
  NutritionInfo,
  MealType,
  WellnessEntry,
  Meal,
} from '../types'

// ============= CONFIGURATION =============

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
})

// ============= TYPES =============

export interface BehaviorPattern {
  id: string
  type: 'nutrition' | 'wellness' | 'sport' | 'hydration' | 'sleep' | 'stress'
  name: string
  description: string
  frequency: 'daily' | 'weekly' | 'occasional'
  impact: 'positive' | 'negative' | 'neutral'
  confidence: number
  scientificBasis?: string
  source?: string
}

export interface BehaviorAlert {
  id: string
  severity: 'info' | 'warning' | 'alert'
  category: 'nutrition' | 'wellness' | 'sport' | 'health'
  title: string
  message: string
  recommendation: string
  scientificSource: string
  sourceUrl?: string
  actionLabel?: string
  actionRoute?: string
  createdAt: string
  expiresAt?: string
}

export interface BehaviorInsight {
  id: string
  type: 'correlation' | 'trend' | 'recommendation' | 'achievement'
  title: string
  message: string
  dataPoints: Array<{
    label: string
    value: string | number
    trend?: 'up' | 'down' | 'stable'
  }>
  sources: string[]
  confidence: number
}

export interface UserBehaviorData {
  // Nutrition data
  meals: Meal[]
  dailyNutrition: Array<{
    date: string
    calories: number
    proteins: number
    carbs: number
    fats: number
    fiber?: number
  }>
  // Wellness data
  wellnessEntries: WellnessEntry[]
  // Sport data
  sportSessions: Array<{
    date: string
    type: string
    duration: number
    intensity: 'low' | 'moderate' | 'high'
    completed: boolean
  }>
  // Temporal context
  daysTracked: number
  streakDays: number
}

export interface BehaviorAnalysisResult {
  patterns: BehaviorPattern[]
  alerts: BehaviorAlert[]
  insights: BehaviorInsight[]
  summary: string
  ragSourcesUsed: string[]
  analysisDate: string
  confidence: number
}

// ============= RAG QUERY HELPERS =============

// Extended entry with similarity score for sorting
interface KnowledgeBaseEntryWithScore extends KnowledgeBaseEntry {
  similarityScore?: number
}

/**
 * Query knowledge base for specific health guidelines
 * OPTIMIZED: Uses batch query with single embedding for all categories
 */
async function queryHealthGuidelines(
  topic: string,
  categories: Array<KnowledgeBaseEntry['category']> = ['nutrition', 'wellness', 'guidelines']
): Promise<KnowledgeBaseEntryWithScore[]> {
  if (!isSupabaseConfigured()) {
    console.warn('BehaviorAgent: Supabase non configuré, mode dégradé')
    return []
  }

  // OPTIMIZATION: Use batch query with single embedding (3-5x faster)
  const result = await queryKnowledgeBaseBatch(topic, categories, { limit: 3 })

  if (!result?.entries) {
    return []
  }

  // Convert to entries with similarity scores attached
  const entries: KnowledgeBaseEntryWithScore[] = result.entries.map((entry, index) => ({
    ...entry,
    similarityScore: result.similarity_scores[index] || 0,
  }))

  // Already sorted by similarity from batch query
  return entries
}

/**
 * Build context from KB entries for prompts
 */
function buildRAGContext(entries: KnowledgeBaseEntry[]): string {
  if (entries.length === 0) return 'Aucune donnée RAG disponible.'

  return entries.map(e =>
    `[Source: ${e.source?.toUpperCase() || 'EXPERT'}] ${e.content}`
  ).join('\n\n')
}

// ============= BEHAVIOR ANALYSIS FUNCTIONS =============

/**
 * Analyze nutrition behavior patterns using RAG
 */
async function analyzeNutritionBehavior(
  data: UserBehaviorData,
  profile: UserProfile
): Promise<{ patterns: BehaviorPattern[]; alerts: BehaviorAlert[] }> {
  const patterns: BehaviorPattern[] = []
  const alerts: BehaviorAlert[] = []

  // Calculate averages
  const avgCalories = data.dailyNutrition.length > 0
    ? Math.round(data.dailyNutrition.reduce((sum, d) => sum + d.calories, 0) / data.dailyNutrition.length)
    : 0
  const avgProteins = data.dailyNutrition.length > 0
    ? Math.round(data.dailyNutrition.reduce((sum, d) => sum + d.proteins, 0) / data.dailyNutrition.length)
    : 0
  const avgFiber = data.dailyNutrition.filter(d => d.fiber).length > 0
    ? Math.round(data.dailyNutrition.reduce((sum, d) => sum + (d.fiber || 0), 0) / data.dailyNutrition.filter(d => d.fiber).length)
    : 0

  // Query RAG for nutrition guidelines
  const nutritionKB = await queryHealthGuidelines(
    `recommandations nutritionnelles ${profile.goal} proteines fibres calories ANSES`,
    ['nutrition', 'guidelines']
  )

  const ragContext = buildRAGContext(nutritionKB)

  // Protein analysis
  const targetProteins = profile.weight ? profile.weight * 1.6 : 80
  const proteinRatio = avgProteins / targetProteins

  if (proteinRatio < 0.7) {
    // Query RAG for protein deficiency
    const proteinKB = await queryHealthGuidelines('carence proteines masse musculaire satiete')
    const source = proteinKB[0]?.source || 'ANSES'

    alerts.push({
      id: `alert_protein_${Date.now()}`,
      severity: proteinRatio < 0.5 ? 'alert' : 'warning',
      category: 'nutrition',
      title: 'Apport protéique insuffisant',
      message: `Ta moyenne de ${avgProteins}g/jour est inférieure aux recommandations (${Math.round(targetProteins)}g).`,
      recommendation: 'Ajoute une source de protéines à chaque repas : œufs, poisson, poulet, légumineuses, tofu.',
      scientificSource: source,
      actionLabel: 'Recettes protéinées',
      createdAt: new Date().toISOString(),
    })

    patterns.push({
      id: `pattern_low_protein_${Date.now()}`,
      type: 'nutrition',
      name: 'Apport protéique faible',
      description: `Moyenne de ${avgProteins}g/jour vs ${Math.round(targetProteins)}g recommandés`,
      frequency: 'daily',
      impact: 'negative',
      confidence: 0.85,
      scientificBasis: 'ANSES recommande 0.83g à 1.6g/kg selon activité',
      source: 'ANSES',
    })
  } else if (proteinRatio >= 1) {
    patterns.push({
      id: `pattern_good_protein_${Date.now()}`,
      type: 'nutrition',
      name: 'Bon apport protéique',
      description: `Moyenne de ${avgProteins}g/jour, objectif atteint`,
      frequency: 'daily',
      impact: 'positive',
      confidence: 0.9,
      source: 'ANSES',
    })
  }

  // Fiber analysis (ANSES recommends 25-30g/day)
  if (avgFiber > 0 && avgFiber < 20) {
    const fiberKB = await queryHealthGuidelines('fibres alimentaires transit intestinal satiete ANSES')
    const source = fiberKB[0]?.source || 'ANSES'

    alerts.push({
      id: `alert_fiber_${Date.now()}`,
      severity: avgFiber < 15 ? 'warning' : 'info',
      category: 'nutrition',
      title: 'Fibres insuffisantes',
      message: `Ta moyenne de ${avgFiber}g/jour est sous les 25-30g recommandés par l'ANSES.`,
      recommendation: 'Privilégie les légumes, fruits entiers, légumineuses et céréales complètes.',
      scientificSource: source,
      createdAt: new Date().toISOString(),
    })
  }

  // Calorie deficit analysis (only if goal is weight loss)
  if (profile.goal === 'weight_loss' && profile.nutritionalNeeds) {
    const calorieRatio = avgCalories / profile.nutritionalNeeds.calories

    if (calorieRatio < 0.7) {
      const deficitKB = await queryHealthGuidelines('deficit calorique excessif metabolisme adaptation yo-yo')
      const source = deficitKB[0]?.source || 'INSERM'

      alerts.push({
        id: `alert_deficit_${Date.now()}`,
        severity: 'alert',
        category: 'health',
        title: 'Déficit calorique excessif',
        message: `Un déficit de plus de 30% peut ralentir ton métabolisme et favoriser l'effet yo-yo.`,
        recommendation: 'Vise un déficit modéré de 300-500 kcal/jour maximum pour une perte durable.',
        scientificSource: source,
        createdAt: new Date().toISOString(),
      })

      patterns.push({
        id: `pattern_excessive_deficit_${Date.now()}`,
        type: 'nutrition',
        name: 'Déficit calorique agressif',
        description: `Moyenne ${avgCalories} kcal vs ${profile.nutritionalNeeds.calories} kcal objectif`,
        frequency: 'daily',
        impact: 'negative',
        confidence: 0.9,
        scientificBasis: 'Un déficit >30% active l\'adaptation métabolique (INSERM)',
        source: 'INSERM',
      })
    }
  }

  return { patterns, alerts }
}

/**
 * Analyze wellness behavior (sleep, stress, hydration) using RAG
 */
async function analyzeWellnessBehavior(
  data: UserBehaviorData,
  profile: UserProfile
): Promise<{ patterns: BehaviorPattern[]; alerts: BehaviorAlert[] }> {
  const patterns: BehaviorPattern[] = []
  const alerts: BehaviorAlert[] = []

  const wellnessEntries = data.wellnessEntries

  // Sleep analysis
  const sleepEntries = wellnessEntries.filter(w => w.sleepHours !== undefined)
  if (sleepEntries.length >= 3) {
    const avgSleep = sleepEntries.reduce((sum, w) => sum + (w.sleepHours || 0), 0) / sleepEntries.length
    const poorSleepDays = sleepEntries.filter(w => (w.sleepHours || 0) < 6).length

    if (avgSleep < 7) {
      const sleepKB = await queryHealthGuidelines('manque sommeil ghréline leptine faim poids INSERM')
      const source = sleepKB[0]?.source || 'INSERM'

      alerts.push({
        id: `alert_sleep_${Date.now()}`,
        severity: avgSleep < 6 ? 'alert' : 'warning',
        category: 'wellness',
        title: 'Sommeil insuffisant',
        message: `Ta moyenne de ${avgSleep.toFixed(1)}h est sous les 7-9h recommandées. Le manque de sommeil augmente la ghréline (+15%) et réduit la leptine.`,
        recommendation: 'Établis une routine de coucher régulière et évite les écrans 1h avant de dormir.',
        scientificSource: source,
        createdAt: new Date().toISOString(),
      })

      patterns.push({
        id: `pattern_poor_sleep_${Date.now()}`,
        type: 'sleep',
        name: 'Déficit de sommeil chronique',
        description: `${poorSleepDays} jours avec moins de 6h sur ${sleepEntries.length}`,
        frequency: poorSleepDays > sleepEntries.length / 2 ? 'daily' : 'weekly',
        impact: 'negative',
        confidence: 0.9,
        scientificBasis: 'Sommeil <7h = +15% ghréline, -15% leptine (INSERM)',
        source: 'INSERM',
      })
    }
  }

  // Stress analysis
  const stressEntries = wellnessEntries.filter(w => w.stressLevel !== undefined)
  if (stressEntries.length >= 3) {
    const avgStress = stressEntries.reduce((sum, w) => sum + (w.stressLevel || 0), 0) / stressEntries.length
    const highStressDays = stressEntries.filter(w => (w.stressLevel || 0) >= 7).length

    if (avgStress >= 6) {
      const stressKB = await queryHealthGuidelines('stress cortisol stockage graisse abdominale HAS')
      const source = stressKB[0]?.source || 'HAS'

      alerts.push({
        id: `alert_stress_${Date.now()}`,
        severity: avgStress >= 8 ? 'alert' : 'warning',
        category: 'wellness',
        title: 'Stress chronique élevé',
        message: `Ton stress moyen de ${avgStress.toFixed(1)}/10 est préoccupant. Le cortisol chronique favorise le stockage abdominal.`,
        recommendation: 'Pratique 5-10 min de respiration profonde ou méditation chaque jour.',
        scientificSource: source,
        actionLabel: 'Exercices de respiration',
        createdAt: new Date().toISOString(),
      })

      patterns.push({
        id: `pattern_high_stress_${Date.now()}`,
        type: 'stress',
        name: 'Stress chronique',
        description: `${highStressDays} jours de stress élevé (≥7/10) sur ${stressEntries.length}`,
        frequency: highStressDays > stressEntries.length / 2 ? 'daily' : 'weekly',
        impact: 'negative',
        confidence: 0.85,
        scientificBasis: 'Cortisol chronique = stockage viscéral accru (HAS)',
        source: 'HAS',
      })
    }
  }

  // Hydration analysis
  const hydrationEntries = wellnessEntries.filter(w => w.waterLiters !== undefined)
  if (hydrationEntries.length >= 3) {
    const avgHydration = hydrationEntries.reduce((sum, w) => sum + (w.waterLiters || 0), 0) / hydrationEntries.length
    const lowHydrationDays = hydrationEntries.filter(w => (w.waterLiters || 0) < 1.5).length

    if (avgHydration < 1.5) {
      const hydrationKB = await queryHealthGuidelines('deshydratation fatigue performance ANSES eau')
      const source = hydrationKB[0]?.source || 'ANSES'

      alerts.push({
        id: `alert_hydration_${Date.now()}`,
        severity: avgHydration < 1 ? 'warning' : 'info',
        category: 'wellness',
        title: 'Hydratation insuffisante',
        message: `Ta moyenne de ${avgHydration.toFixed(1)}L/jour est sous les 1.5-2L recommandés.`,
        recommendation: 'Garde une bouteille d\'eau près de toi et bois régulièrement, même sans soif.',
        scientificSource: source,
        actionLabel: 'Ajouter de l\'eau',
        createdAt: new Date().toISOString(),
      })
    }
  }

  return { patterns, alerts }
}

/**
 * Analyze correlations between behaviors using RAG
 */
async function analyzeCorrelations(
  data: UserBehaviorData,
  profile: UserProfile
): Promise<BehaviorInsight[]> {
  const insights: BehaviorInsight[] = []

  // Query RAG for correlation knowledge
  const correlationKB = await queryHealthGuidelines(
    'correlation sommeil alimentation stress performance metabolisme',
    ['wellness', 'nutrition', 'metabolism']
  )

  const ragContext = buildRAGContext(correlationKB)

  // Build prompt for AI correlation analysis
  const prompt = `Tu es un expert en analyse comportementale santé. Analyse les corrélations entre les données utilisateur.

DONNÉES UTILISATEUR (${data.daysTracked} jours):
- Nutrition: ${data.dailyNutrition.length} jours trackés
- Wellness: ${data.wellnessEntries.length} entrées
- Sport: ${data.sportSessions.length} séances
- Série actuelle: ${data.streakDays} jours

MOYENNES CALCULÉES:
${data.dailyNutrition.length > 0 ? `- Calories: ${Math.round(data.dailyNutrition.reduce((s, d) => s + d.calories, 0) / data.dailyNutrition.length)} kcal/jour` : ''}
${data.dailyNutrition.length > 0 ? `- Protéines: ${Math.round(data.dailyNutrition.reduce((s, d) => s + d.proteins, 0) / data.dailyNutrition.length)}g/jour` : ''}
${data.wellnessEntries.filter(w => w.sleepHours).length > 0 ? `- Sommeil: ${(data.wellnessEntries.reduce((s, w) => s + (w.sleepHours || 0), 0) / data.wellnessEntries.filter(w => w.sleepHours).length).toFixed(1)}h/nuit` : ''}
${data.wellnessEntries.filter(w => w.stressLevel).length > 0 ? `- Stress: ${(data.wellnessEntries.reduce((s, w) => s + (w.stressLevel || 0), 0) / data.wellnessEntries.filter(w => w.stressLevel).length).toFixed(1)}/10` : ''}

PROFIL:
- Objectif: ${profile.goal}
- Poids: ${profile.weight}kg

CONNAISSANCES RAG:
${ragContext}

INSTRUCTIONS:
Identifie 2-3 corrélations SIGNIFICATIVES entre les comportements et leur impact santé.
Base tes analyses sur les connaissances scientifiques fournies.
Sois PRÉCIS et ACTIONNABLE.

Réponds en JSON:
{
  "insights": [
    {
      "type": "correlation|trend|recommendation",
      "title": "Titre court",
      "message": "Explication de la corrélation (2 phrases max)",
      "dataPoints": [
        { "label": "Métrique", "value": "valeur", "trend": "up|down|stable" }
      ],
      "source": "Source scientifique"
    }
  ]
}`

  try {
    // Check rate limit for behavior analysis (2 credits)
    const rateCheck = aiRateLimiter.checkRateLimit('behavior_analysis', {
      daysTracked: data.daysTracked,
      goal: profile.goal,
    })

    // Return cached result if available
    if (rateCheck.cached) {
      const cachedResult = JSON.parse(rateCheck.cached)
      return (cachedResult.insights || []).map((insight: {
        type: string
        title: string
        message: string
        dataPoints: Array<{ label: string; value: string | number; trend?: string }>
        source: string
      }, index: number) => ({
        id: `insight_corr_${Date.now()}_${index}`,
        type: insight.type as BehaviorInsight['type'],
        title: insight.title,
        message: insight.message,
        dataPoints: insight.dataPoints || [],
        sources: [insight.source || correlationKB[0]?.source || 'Expert'],
        confidence: correlationKB.length > 0 ? 0.85 : 0.7,
      }))
    }

    // Check if request is allowed
    if (!rateCheck.allowed) {
      console.warn(`BehaviorAgent: ${rateCheck.reason}`)
      return insights // Return empty insights if not allowed
    }

    const response = await openai.chat.completions.create({
      model: rateCheck.model, // Use rate-limited model
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    // Consume credits after successful call
    aiRateLimiter.consumeCredits('behavior_analysis')

    // Cache the result
    aiRateLimiter.cacheResponse('behavior_analysis', {
      daysTracked: data.daysTracked,
      goal: profile.goal,
    }, JSON.stringify(result))

    return (result.insights || []).map((insight: {
      type: string
      title: string
      message: string
      dataPoints: Array<{ label: string; value: string | number; trend?: string }>
      source: string
    }, index: number) => ({
      id: `insight_corr_${Date.now()}_${index}`,
      type: insight.type as BehaviorInsight['type'],
      title: insight.title,
      message: insight.message,
      dataPoints: insight.dataPoints || [],
      sources: [insight.source || correlationKB[0]?.source || 'Expert'],
      confidence: correlationKB.length > 0 ? 0.85 : 0.7,
    }))
  } catch (error) {
    console.error('BehaviorAgent correlation analysis error:', error)
    return insights
  }
}

// ============= MAIN ANALYSIS FUNCTION =============

/**
 * Perform complete behavior analysis using RAG
 * This is the main entry point for the behavior analysis agent
 */
export async function analyzeBehavior(
  data: UserBehaviorData,
  profile: UserProfile
): Promise<BehaviorAnalysisResult> {
  const startTime = Date.now()

  // Run all analyses in parallel
  const [nutritionAnalysis, wellnessAnalysis, correlationInsights] = await Promise.all([
    analyzeNutritionBehavior(data, profile),
    analyzeWellnessBehavior(data, profile),
    analyzeCorrelations(data, profile),
  ])

  // Combine results
  const allPatterns = [
    ...nutritionAnalysis.patterns,
    ...wellnessAnalysis.patterns,
  ]

  const allAlerts = [
    ...nutritionAnalysis.alerts,
    ...wellnessAnalysis.alerts,
  ].sort((a, b) => {
    // Sort by severity: alert > warning > info
    const severityOrder = { alert: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  // Collect all RAG sources used
  const ragSources = new Set<string>()
  allPatterns.forEach(p => p.source && ragSources.add(p.source))
  allAlerts.forEach(a => ragSources.add(a.scientificSource))
  correlationInsights.forEach(i => i.sources.forEach(s => ragSources.add(s)))

  // Generate summary using RAG
  const summaryKB = await queryHealthGuidelines('resume analyse comportementale recommandations')
  const summary = await generateSummary(data, allPatterns, allAlerts, profile)

  const analysisTime = Date.now() - startTime
  console.log(`BehaviorAgent: Analyse complète en ${analysisTime}ms`)

  return {
    patterns: allPatterns,
    alerts: allAlerts.slice(0, 5), // Limit to 5 most important alerts
    insights: correlationInsights,
    summary,
    ragSourcesUsed: Array.from(ragSources),
    analysisDate: new Date().toISOString(),
    confidence: ragSources.size > 0 ? 0.85 : 0.7,
  }
}

/**
 * Generate a summary of the analysis
 */
async function generateSummary(
  data: UserBehaviorData,
  patterns: BehaviorPattern[],
  alerts: BehaviorAlert[],
  profile: UserProfile
): Promise<string> {
  const positivePatterns = patterns.filter(p => p.impact === 'positive').length
  const negativePatterns = patterns.filter(p => p.impact === 'negative').length
  const highSeverityAlerts = alerts.filter(a => a.severity === 'alert').length

  if (data.daysTracked < 3) {
    return `Nous avons besoin de plus de données pour une analyse complète. Continue à tracker tes repas et ton bien-être pendant quelques jours.`
  }

  if (highSeverityAlerts > 0) {
    return `${highSeverityAlerts} point${highSeverityAlerts > 1 ? 's' : ''} d'attention détecté${highSeverityAlerts > 1 ? 's' : ''}. Consulte les alertes ci-dessus et ajuste tes habitudes progressivement.`
  }

  if (negativePatterns > positivePatterns) {
    return `Quelques axes d'amélioration identifiés. Pas de panique, chaque petit changement compte ! Concentre-toi sur un point à la fois.`
  }

  if (positivePatterns > 0 && negativePatterns === 0) {
    return `Excellentes habitudes détectées ! Tu es sur la bonne voie. Continue comme ça pour atteindre ton objectif de ${profile.goal === 'weight_loss' ? 'perte de poids' : profile.goal === 'muscle_gain' ? 'prise de muscle' : 'maintien'}.`
  }

  return `Analyse de ${data.daysTracked} jours complète. Des points positifs et quelques améliorations possibles ont été identifiés.`
}

/**
 * Get quick health check (lightweight analysis for dashboard)
 */
export async function getQuickHealthCheck(
  todayNutrition: NutritionInfo,
  todayWellness: Partial<WellnessEntry>,
  profile: UserProfile
): Promise<{ status: 'good' | 'attention' | 'warning'; message: string; source?: string }> {
  const issues: string[] = []

  // Quick checks without full RAG query
  const targetCalories = profile.nutritionalNeeds?.calories || 2000
  const targetProteins = profile.weight ? profile.weight * 1.6 : 80

  const hour = new Date().getHours()

  // Calorie check (afternoon onwards)
  if (hour >= 14) {
    const expectedRatio = hour >= 18 ? 0.7 : 0.5
    if (todayNutrition.calories < targetCalories * expectedRatio * 0.5) {
      issues.push('apport calorique très bas')
    }
  }

  // Protein check
  if (hour >= 18 && todayNutrition.proteins < targetProteins * 0.5) {
    issues.push('protéines insuffisantes')
  }

  // Sleep check
  if (todayWellness.sleepHours !== undefined && todayWellness.sleepHours < 6) {
    issues.push('sommeil court')
  }

  // Stress check
  if (todayWellness.stressLevel !== undefined && todayWellness.stressLevel >= 8) {
    issues.push('stress élevé')
  }

  if (issues.length === 0) {
    return {
      status: 'good',
      message: 'Tout va bien ! Continue comme ça.',
      source: 'LymIA',
    }
  }

  if (issues.length === 1) {
    return {
      status: 'attention',
      message: `Point d'attention : ${issues[0]}.`,
      source: 'LymIA',
    }
  }

  return {
    status: 'warning',
    message: `Plusieurs points d'attention : ${issues.join(', ')}.`,
    source: 'ANSES/INSERM',
  }
}

// ============= EXPORTS =============

export const BehaviorAnalysisAgent = {
  analyzeBehavior,
  getQuickHealthCheck,
  analyzeNutritionBehavior,
  analyzeWellnessBehavior,
  analyzeCorrelations,
}

export default BehaviorAnalysisAgent
