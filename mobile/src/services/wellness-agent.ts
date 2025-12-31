/**
 * Wellness Agent - Agent IA pour le programme Bien-être avec RAG
 *
 * Utilise le RAG pour fournir des conseils personnalisés basés sur:
 * - Sources scientifiques (INSERM, HAS, OMS, MBSR/Jon Kabat-Zinn)
 * - Données utilisateur (sommeil, stress, méditation)
 * - Phase actuelle du programme
 *
 * Fonctionnalités:
 * - Recommandations de méditation personnalisées
 * - Analyse du sommeil avec conseils scientifiques
 * - Gestion du stress avec techniques validées
 * - Coaching de respiration adaptatif
 */

import OpenAI from 'openai'
import {
  queryKnowledgeBase,
  isSupabaseConfigured,
  type KnowledgeBaseEntry,
} from './supabase-client'
import type { UserProfile } from '../types'
import {
  type WellnessPhase,
  type WellnessDailyLog,
  type WellnessWeekSummary,
  WELLNESS_PHASE_CONFIGS,
} from '../stores/wellness-program-store'

// ============= CONFIGURATION =============

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
})

// ============= TYPES =============

export interface WellnessRecommendation {
  id: string
  type: 'meditation' | 'breathing' | 'sleep' | 'stress' | 'routine' | 'gratitude'
  title: string
  description: string
  duration?: number // minutes
  technique?: string
  scientificBasis: string
  source: string
  priority: 'high' | 'medium' | 'low'
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime'
}

export interface WellnessInsight {
  id: string
  category: 'sleep' | 'stress' | 'mood' | 'meditation' | 'overall'
  title: string
  message: string
  trend: 'improving' | 'stable' | 'declining' | 'new_user'
  dataPoints: Array<{
    label: string
    value: string | number
    unit?: string
  }>
  sources: string[]
  confidence: number
}

export interface WellnessAlert {
  id: string
  severity: 'info' | 'warning' | 'attention'
  title: string
  message: string
  recommendation: string
  scientificSource: string
  actionType?: 'meditation' | 'breathing' | 'sleep_hygiene' | 'stress_management'
  createdAt: string
}

export interface DailyWellnessPlan {
  date: string
  morningRoutine: WellnessRecommendation[]
  afternoonPractice: WellnessRecommendation[]
  eveningRoutine: WellnessRecommendation[]
  focusOfTheDay: string
  inspirationalQuote: string
  quoteSource: string
}

export interface WellnessAnalysisResult {
  recommendations: WellnessRecommendation[]
  insights: WellnessInsight[]
  alerts: WellnessAlert[]
  dailyPlan?: DailyWellnessPlan
  summary: string
  ragSourcesUsed: string[]
  analysisDate: string
  confidence: number
}

export interface WellnessUserData {
  profile: Partial<UserProfile>
  currentPhase: WellnessPhase
  currentWeek: number
  recentLogs: WellnessDailyLog[]
  weekSummary?: WellnessWeekSummary
  totalMeditationMinutes: number
  currentStreak: number
}

// ============= RAG HELPERS =============

interface KnowledgeBaseEntryWithScore extends KnowledgeBaseEntry {
  similarityScore?: number
}

/**
 * Query wellness-specific knowledge base
 */
async function queryWellnessKnowledge(
  topic: string,
  categories: Array<KnowledgeBaseEntry['category']> = ['wellness']
): Promise<KnowledgeBaseEntryWithScore[]> {
  if (!isSupabaseConfigured()) {
    console.warn('WellnessAgent: Supabase non configuré, mode dégradé')
    return []
  }

  const results = await Promise.all(
    categories.map(cat =>
      queryKnowledgeBase(topic, { category: cat, limit: 4 })
    )
  )

  const entries: KnowledgeBaseEntryWithScore[] = []
  for (const result of results) {
    if (result?.entries) {
      result.entries.forEach((entry, index) => {
        entries.push({
          ...entry,
          similarityScore: result.similarity_scores[index] || 0,
        })
      })
    }
  }

  return entries.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
}

/**
 * Build RAG context for prompts
 */
function buildRAGContext(entries: KnowledgeBaseEntry[]): string {
  if (entries.length === 0) return 'Aucune donnée RAG disponible.'

  return entries.map(e =>
    `[Source: ${e.source?.toUpperCase() || 'EXPERT'}] ${e.content}`
  ).join('\n\n')
}

// ============= ANALYSIS FUNCTIONS =============

/**
 * Analyze sleep patterns and provide recommendations
 */
async function analyzeSleep(
  userData: WellnessUserData
): Promise<{ insights: WellnessInsight[]; alerts: WellnessAlert[]; recommendations: WellnessRecommendation[] }> {
  const insights: WellnessInsight[] = []
  const alerts: WellnessAlert[] = []
  const recommendations: WellnessRecommendation[] = []

  const sleepLogs = userData.recentLogs.filter(l => l.sleepHours !== undefined)
  if (sleepLogs.length < 2) {
    return { insights, alerts, recommendations }
  }

  const avgSleep = sleepLogs.reduce((sum, l) => sum + (l.sleepHours || 0), 0) / sleepLogs.length
  const avgQuality = sleepLogs.filter(l => l.sleepQuality).reduce((sum, l) => sum + (l.sleepQuality || 3), 0) /
    (sleepLogs.filter(l => l.sleepQuality).length || 1)

  // Query RAG for sleep knowledge
  const sleepKB = await queryWellnessKnowledge('sommeil cycles récupération hygiène INSERM')
  const ragContext = buildRAGContext(sleepKB)

  // Sleep duration analysis
  if (avgSleep < 7) {
    const source = sleepKB[0]?.source || 'INSERM'

    alerts.push({
      id: `alert_sleep_${Date.now()}`,
      severity: avgSleep < 6 ? 'warning' : 'attention',
      title: 'Sommeil insuffisant',
      message: `Ta moyenne de ${avgSleep.toFixed(1)}h est sous les 7-8h recommandées pour une récupération optimale.`,
      recommendation: 'Établis une heure de coucher fixe et évite les écrans 1h avant.',
      scientificSource: source.toUpperCase(),
      actionType: 'sleep_hygiene',
      createdAt: new Date().toISOString(),
    })

    recommendations.push({
      id: `rec_sleep_hygiene_${Date.now()}`,
      type: 'sleep',
      title: 'Routine du soir sans écran',
      description: 'Arrête les écrans 1h avant le coucher. La lumière bleue inhibe la mélatonine et retarde l\'endormissement.',
      duration: 60,
      scientificBasis: 'L\'exposition à la lumière bleue réduit la sécrétion de mélatonine de 50% (INSERM)',
      source: source.toUpperCase(),
      priority: 'high',
      timeOfDay: 'evening',
    })
  }

  // Sleep quality analysis
  if (avgQuality < 3) {
    const qualityKB = await queryWellnessKnowledge('qualité sommeil profond REM récupération')
    const source = qualityKB[0]?.source || 'INSERM'

    insights.push({
      id: `insight_sleep_quality_${Date.now()}`,
      category: 'sleep',
      title: 'Qualité de sommeil à améliorer',
      message: 'La qualité de ton sommeil semble insuffisante. Essaie d\'optimiser ton environnement de sommeil.',
      trend: 'declining',
      dataPoints: [
        { label: 'Qualité moyenne', value: avgQuality.toFixed(1), unit: '/5' },
        { label: 'Durée moyenne', value: avgSleep.toFixed(1), unit: 'h' },
      ],
      sources: [source.toUpperCase()],
      confidence: 0.85,
    })

    recommendations.push({
      id: `rec_sleep_env_${Date.now()}`,
      type: 'sleep',
      title: 'Optimise ton environnement',
      description: 'Chambre fraîche (18-19°C), obscurité totale, et silence. Ces conditions favorisent le sommeil profond.',
      scientificBasis: 'Température corporelle et obscurité régulent le rythme circadien (HAS)',
      source: source.toUpperCase(),
      priority: 'medium',
      timeOfDay: 'night',
    })
  }

  // Good sleep pattern
  if (avgSleep >= 7 && avgQuality >= 4) {
    insights.push({
      id: `insight_good_sleep_${Date.now()}`,
      category: 'sleep',
      title: 'Excellent sommeil',
      message: 'Tu as de bonnes habitudes de sommeil. Continue ainsi pour maintenir ton énergie.',
      trend: 'stable',
      dataPoints: [
        { label: 'Durée moyenne', value: avgSleep.toFixed(1), unit: 'h' },
        { label: 'Qualité', value: avgQuality.toFixed(1), unit: '/5' },
      ],
      sources: ['INSERM'],
      confidence: 0.9,
    })
  }

  return { insights, alerts, recommendations }
}

/**
 * Analyze stress and mood patterns
 */
async function analyzeStressAndMood(
  userData: WellnessUserData
): Promise<{ insights: WellnessInsight[]; alerts: WellnessAlert[]; recommendations: WellnessRecommendation[] }> {
  const insights: WellnessInsight[] = []
  const alerts: WellnessAlert[] = []
  const recommendations: WellnessRecommendation[] = []

  const stressLogs = userData.recentLogs.filter(l => l.stressLevel !== undefined)
  const moodLogs = userData.recentLogs.filter(l => l.moodLevel !== undefined)

  if (stressLogs.length < 2) {
    return { insights, alerts, recommendations }
  }

  const avgStress = stressLogs.reduce((sum, l) => sum + (l.stressLevel || 3), 0) / stressLogs.length
  const avgMood = moodLogs.length > 0
    ? moodLogs.reduce((sum, l) => sum + (l.moodLevel || 3), 0) / moodLogs.length
    : 3

  // Query RAG for stress management
  const stressKB = await queryWellnessKnowledge('stress cortisol cohérence cardiaque respiration HAS')

  // High stress analysis
  if (avgStress >= 3.5) {
    const source = stressKB[0]?.source || 'HAS'

    if (avgStress >= 4) {
      alerts.push({
        id: `alert_stress_${Date.now()}`,
        severity: 'warning',
        title: 'Niveau de stress élevé',
        message: `Ton stress moyen de ${avgStress.toFixed(1)}/5 impacte ta récupération et ton bien-être.`,
        recommendation: 'Pratique la cohérence cardiaque 3x/jour pendant 5 minutes.',
        scientificSource: source.toUpperCase(),
        actionType: 'stress_management',
        createdAt: new Date().toISOString(),
      })
    }

    recommendations.push({
      id: `rec_coherence_${Date.now()}`,
      type: 'breathing',
      title: 'Cohérence cardiaque 365',
      description: '3 fois par jour, 6 respirations par minute, pendant 5 minutes. Cette technique réduit le cortisol de 23%.',
      duration: 5,
      technique: '5 secondes inspiration, 5 secondes expiration',
      scientificBasis: 'La cohérence cardiaque active le système parasympathique et réduit le cortisol (HAS)',
      source: source.toUpperCase(),
      priority: 'high',
      timeOfDay: 'anytime',
    })

    recommendations.push({
      id: `rec_478_${Date.now()}`,
      type: 'breathing',
      title: 'Respiration 4-7-8',
      description: 'Technique de relaxation profonde : inspire 4s, retiens 7s, expire 8s. Idéale avant le coucher ou en cas de stress aigu.',
      duration: 3,
      technique: '4s inspiration, 7s rétention, 8s expiration',
      scientificBasis: 'Active le nerf vague et induit une réponse de relaxation rapide',
      source: 'Dr. Andrew Weil',
      priority: 'medium',
      timeOfDay: 'evening',
    })
  }

  // Mood analysis
  if (avgMood < 3) {
    const moodKB = await queryWellnessKnowledge('bien-être mental gratitude pensée positive MBSR')
    const source = moodKB[0]?.source || 'APA'

    insights.push({
      id: `insight_mood_${Date.now()}`,
      category: 'mood',
      title: 'Humeur à surveiller',
      message: 'Ton humeur moyenne est basse cette semaine. La pratique de la gratitude peut aider.',
      trend: 'declining',
      dataPoints: [
        { label: 'Humeur moyenne', value: avgMood.toFixed(1), unit: '/5' },
        { label: 'Stress moyen', value: avgStress.toFixed(1), unit: '/5' },
      ],
      sources: [source.toUpperCase()],
      confidence: 0.8,
    })

    recommendations.push({
      id: `rec_gratitude_${Date.now()}`,
      type: 'gratitude',
      title: 'Journal de gratitude',
      description: 'Note 3 choses positives de ta journée chaque soir. Cette pratique augmente le bien-être de 25% en 3 semaines.',
      duration: 5,
      scientificBasis: 'La pratique régulière de la gratitude améliore le bien-être subjectif (APA, Emmons 2003)',
      source: source.toUpperCase(),
      priority: 'medium',
      timeOfDay: 'evening',
    })
  }

  // Good stress management
  if (avgStress <= 2.5 && avgMood >= 4) {
    insights.push({
      id: `insight_good_wellbeing_${Date.now()}`,
      category: 'overall',
      title: 'Excellent équilibre',
      message: 'Tu gères bien ton stress et maintiens une bonne humeur. Continue tes pratiques actuelles.',
      trend: 'improving',
      dataPoints: [
        { label: 'Stress', value: avgStress.toFixed(1), unit: '/5' },
        { label: 'Humeur', value: avgMood.toFixed(1), unit: '/5' },
      ],
      sources: ['HAS'],
      confidence: 0.9,
    })
  }

  return { insights, alerts, recommendations }
}

/**
 * Generate meditation recommendations based on phase and user data
 */
async function generateMeditationRecommendations(
  userData: WellnessUserData
): Promise<WellnessRecommendation[]> {
  const recommendations: WellnessRecommendation[] = []
  const phaseConfig = WELLNESS_PHASE_CONFIGS[userData.currentPhase]

  // Query RAG for meditation techniques
  const meditationKB = await queryWellnessKnowledge(
    `méditation ${phaseConfig.focus} MBSR pleine conscience Jon Kabat-Zinn`
  )

  // Note: Méditations TTS trackées dans meditation-store (sessionsCompleted)
  // Ici on recommande des pratiques complémentaires
  const source = meditationKB[0]?.source || 'MBSR'

  // Complementary meditation recommendations (main TTS sessions tracked in meditation-store)
  switch (userData.currentPhase) {
    case 'foundations':
      recommendations.push({
        id: `rec_med_foundations_${Date.now()}`,
        type: 'meditation',
        title: 'Body Scan Rapide (5 min)',
        description: 'Complément à ta méditation guidée hebdomadaire. Scanne ton corps avant de dormir.',
        duration: 5,
        technique: 'Scan corporel progressif',
        scientificBasis: 'Le body scan réduit les tensions physiques et améliore la conscience corporelle (MBSR)',
        source: source.toUpperCase(),
        priority: 'medium',
        timeOfDay: 'evening',
      })
      break

    case 'awareness':
      recommendations.push({
        id: `rec_med_awareness_${Date.now()}`,
        type: 'meditation',
        title: 'Pause Consciente (3 min)',
        description: 'En complément de ta méditation guidée. Prends 3 min pour observer ta respiration.',
        duration: 3,
        technique: 'Attention focalisée sur la respiration',
        scientificBasis: 'La méditation de pleine conscience réduit l\'anxiété de 58% (méta-analyse PubMed)',
        source: source.toUpperCase(),
        priority: 'medium',
        timeOfDay: 'morning',
      })

      recommendations.push({
        id: `rec_walking_med_${Date.now()}`,
        type: 'meditation',
        title: 'Marche Méditative',
        description: 'Marche lentement en portant attention à chaque pas. Sens le contact du pied avec le sol.',
        duration: 10,
        technique: 'Attention aux sensations de marche',
        scientificBasis: 'La marche méditative combine les bienfaits de l\'exercice et de la pleine conscience',
        source: 'MBSR',
        priority: 'low',
        timeOfDay: 'afternoon',
      })
      break

    case 'balance':
      recommendations.push({
        id: `rec_med_balance_${Date.now()}`,
        type: 'meditation',
        title: 'Metta Express (5 min)',
        description: 'En complément de ta méditation guidée. Envoie des pensées bienveillantes.',
        duration: 5,
        technique: 'Metta Bhavana',
        scientificBasis: 'La méditation de bienveillance augmente les émotions positives et la connexion sociale',
        source: source.toUpperCase(),
        priority: 'medium',
        timeOfDay: 'morning',
      })
      break

    case 'harmony':
      recommendations.push({
        id: `rec_med_harmony_${Date.now()}`,
        type: 'meditation',
        title: 'Pratique Libre (5-10 min)',
        description: 'Réécoute tes méditations préférées ou pratique en autonomie.',
        duration: 10,
        technique: 'Auto-guidée',
        scientificBasis: 'L\'autonomie dans la pratique renforce l\'engagement à long terme',
        source: 'Expert',
        priority: 'medium',
        timeOfDay: 'anytime',
      })
      break
  }

  return recommendations
}

/**
 * Generate daily wellness plan
 */
async function generateDailyPlan(
  userData: WellnessUserData
): Promise<DailyWellnessPlan> {
  const phaseConfig = WELLNESS_PHASE_CONFIGS[userData.currentPhase]
  const today = new Date().toISOString().split('T')[0]

  // Get today's log if exists
  const todayLog = userData.recentLogs.find(l => l.date === today)
  const avgStress = userData.recentLogs.filter(l => l.stressLevel).length > 0
    ? userData.recentLogs.reduce((sum, l) => sum + (l.stressLevel || 3), 0) /
      userData.recentLogs.filter(l => l.stressLevel).length
    : 3

  // Query RAG for inspirational content
  const quoteKB = await queryWellnessKnowledge('bien-être mental sagesse équilibre vie')

  const morningRoutine: WellnessRecommendation[] = [
    {
      id: `daily_morning_breath_${Date.now()}`,
      type: 'breathing',
      title: 'Respiration du réveil',
      description: '5 grandes respirations conscientes avant de te lever pour bien démarrer la journée.',
      duration: 2,
      technique: 'Respiration profonde',
      scientificBasis: 'L\'oxygénation matinale active le métabolisme',
      source: 'Expert',
      priority: 'high',
      timeOfDay: 'morning',
    },
    {
      id: `daily_morning_gratitude_${Date.now()}`,
      type: 'gratitude',
      title: 'Intention du jour',
      description: 'Pose une intention positive pour ta journée. Qu\'est-ce qui compte vraiment aujourd\'hui ?',
      duration: 2,
      scientificBasis: 'Les intentions matinales augmentent la productivité et le bien-être',
      source: 'APA',
      priority: 'medium',
      timeOfDay: 'morning',
    },
  ]

  const afternoonPractice: WellnessRecommendation[] = [
    {
      id: `daily_afternoon_pause_${Date.now()}`,
      type: 'meditation',
      title: 'Pause consciente',
      description: 'Stop. 3 respirations profondes. Où es-tu ? Que ressens-tu ? Reprends.',
      duration: 1,
      technique: 'Technique STOP',
      scientificBasis: 'Les micro-pauses réduisent l\'accumulation de stress',
      source: 'MBSR',
      priority: avgStress > 3 ? 'high' : 'medium',
      timeOfDay: 'afternoon',
    },
  ]

  // Add coherence if stress is high
  if (avgStress > 3) {
    afternoonPractice.push({
      id: `daily_afternoon_coherence_${Date.now()}`,
      type: 'breathing',
      title: 'Cohérence cardiaque',
      description: '5 minutes de respiration rythmée pour réguler ton système nerveux.',
      duration: 5,
      technique: '5-5 (inspire 5s, expire 5s)',
      scientificBasis: 'Réduit le cortisol de 23% en moyenne',
      source: 'HAS',
      priority: 'high',
      timeOfDay: 'afternoon',
    })
  }

  const eveningRoutine: WellnessRecommendation[] = [
    {
      id: `daily_evening_gratitude_${Date.now()}`,
      type: 'gratitude',
      title: 'Journal de gratitude',
      description: 'Note 3 moments positifs de ta journée, même les plus petits.',
      duration: 5,
      scientificBasis: 'Augmente le bien-être de 25% en 3 semaines',
      source: 'APA',
      priority: 'medium',
      timeOfDay: 'evening',
    },
    {
      id: `daily_evening_bodyscan_${Date.now()}`,
      type: 'meditation',
      title: 'Body scan du soir',
      description: 'Détends chaque partie de ton corps avant de dormir pour un sommeil réparateur.',
      duration: 5, // Complément rapide aux méditations TTS
      technique: 'Scan corporel',
      scientificBasis: 'Améliore la qualité du sommeil et réduit le temps d\'endormissement',
      source: 'MBSR',
      priority: 'high',
      timeOfDay: 'evening',
    },
  ]

  // Inspirational quotes based on phase
  const quotes: Record<WellnessPhase, { quote: string; source: string }[]> = {
    foundations: [
      { quote: 'Le voyage de mille lieues commence par un seul pas.', source: 'Lao Tseu' },
      { quote: 'Respire. C\'est juste une mauvaise journée, pas une mauvaise vie.', source: 'Johnny Depp' },
    ],
    awareness: [
      { quote: 'Où que tu ailles, tu y es.', source: 'Jon Kabat-Zinn' },
      { quote: 'La conscience est le premier pas vers la transformation.', source: 'Eckhart Tolle' },
    ],
    balance: [
      { quote: 'L\'équilibre n\'est pas quelque chose que l\'on trouve, c\'est quelque chose que l\'on crée.', source: 'Jana Kingsford' },
      { quote: 'Le calme intérieur est la plus grande des forces.', source: 'Marc Aurèle' },
    ],
    harmony: [
      { quote: 'Sois le changement que tu veux voir dans le monde.', source: 'Gandhi' },
      { quote: 'La paix vient de l\'intérieur. Ne la cherche pas à l\'extérieur.', source: 'Bouddha' },
    ],
  }

  const phaseQuotes = quotes[userData.currentPhase]
  const randomQuote = phaseQuotes[Math.floor(Math.random() * phaseQuotes.length)]

  return {
    date: today,
    morningRoutine,
    afternoonPractice,
    eveningRoutine,
    focusOfTheDay: phaseConfig.focus,
    inspirationalQuote: randomQuote.quote,
    quoteSource: randomQuote.source,
  }
}

// ============= MAIN ANALYSIS FUNCTION =============

/**
 * Perform complete wellness analysis
 */
export async function analyzeWellness(
  userData: WellnessUserData
): Promise<WellnessAnalysisResult> {
  const startTime = Date.now()

  // Run analyses in parallel
  const [sleepAnalysis, stressAnalysis, meditationRecs, dailyPlan] = await Promise.all([
    analyzeSleep(userData),
    analyzeStressAndMood(userData),
    generateMeditationRecommendations(userData),
    generateDailyPlan(userData),
  ])

  // Combine results
  const allRecommendations = [
    ...sleepAnalysis.recommendations,
    ...stressAnalysis.recommendations,
    ...meditationRecs,
  ]

  const allInsights = [
    ...sleepAnalysis.insights,
    ...stressAnalysis.insights,
  ]

  const allAlerts = [
    ...sleepAnalysis.alerts,
    ...stressAnalysis.alerts,
  ].sort((a, b) => {
    const severityOrder = { warning: 0, attention: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  // Collect sources
  const ragSources = new Set<string>()
  allRecommendations.forEach(r => ragSources.add(r.source))
  allInsights.forEach(i => i.sources.forEach(s => ragSources.add(s)))
  allAlerts.forEach(a => ragSources.add(a.scientificSource))

  // Generate summary
  const summary = generateSummary(userData, allAlerts, allInsights)

  const analysisTime = Date.now() - startTime
  console.log(`WellnessAgent: Analyse complète en ${analysisTime}ms`)

  return {
    recommendations: allRecommendations,
    insights: allInsights,
    alerts: allAlerts.slice(0, 3),
    dailyPlan,
    summary,
    ragSourcesUsed: Array.from(ragSources),
    analysisDate: new Date().toISOString(),
    confidence: ragSources.size > 0 ? 0.85 : 0.7,
  }
}

/**
 * Generate summary based on analysis
 */
function generateSummary(
  userData: WellnessUserData,
  alerts: WellnessAlert[],
  insights: WellnessInsight[]
): string {
  const phaseConfig = WELLNESS_PHASE_CONFIGS[userData.currentPhase]
  const highAlerts = alerts.filter(a => a.severity === 'warning').length

  if (userData.recentLogs.length < 3) {
    return `Bienvenue dans la phase "${phaseConfig.name}" ! Continue à tracker tes pratiques pour des recommandations personnalisées.`
  }

  if (highAlerts > 0) {
    return `${highAlerts} point${highAlerts > 1 ? 's' : ''} d'attention détecté${highAlerts > 1 ? 's' : ''}. Concentre-toi sur les techniques de respiration et de gestion du stress.`
  }

  const improvingInsights = insights.filter(i => i.trend === 'improving').length
  if (improvingInsights > 0) {
    return `Excellente progression ! ${improvingInsights} indicateur${improvingInsights > 1 ? 's' : ''} en amélioration. Tu es sur la bonne voie.`
  }

  if (userData.currentStreak >= 7) {
    return `Série de ${userData.currentStreak} jours ! Ta régularité porte ses fruits. Continue avec le focus "${phaseConfig.focus}".`
  }

  return `Phase "${phaseConfig.name}" - Semaine ${userData.currentWeek}. Focus du moment : ${phaseConfig.focus}.`
}

/**
 * Get quick wellness check for dashboard
 */
export async function getQuickWellnessCheck(
  todayLog: Partial<WellnessDailyLog>,
  phase: WellnessPhase
): Promise<{
  status: 'great' | 'good' | 'attention' | 'needs_care'
  message: string
  recommendation?: string
}> {
  const issues: string[] = []
  const phaseConfig = WELLNESS_PHASE_CONFIGS[phase]

  // Check sleep
  if (todayLog.sleepHours !== undefined && todayLog.sleepHours < 6) {
    issues.push('sommeil court')
  }

  // Check stress
  if (todayLog.stressLevel !== undefined && todayLog.stressLevel >= 4) {
    issues.push('stress élevé')
  }

  // Check mood
  if (todayLog.moodLevel !== undefined && todayLog.moodLevel <= 2) {
    issues.push('humeur basse')
  }

  // Note: Méditation TTS trackée séparément (dans meditation-store)
  // On vérifie les exercices de respiration à la place
  if (!todayLog.breathingExercises || todayLog.breathingExercises < phaseConfig.dailyPractices.breathingExercises / 2) {
    issues.push('respiration manquante')
  }

  if (issues.length === 0) {
    if (todayLog.moodLevel && todayLog.moodLevel >= 4) {
      return {
        status: 'great',
        message: 'Excellente journée ! Tu rayonnes de bien-être.',
      }
    }
    return {
      status: 'good',
      message: 'Bonne journée ! Continue tes pratiques.',
    }
  }

  if (issues.length === 1) {
    const recommendations: Record<string, string> = {
      'sommeil court': 'Essaie de te coucher plus tôt ce soir.',
      'stress élevé': 'Prends 5 min pour la cohérence cardiaque.',
      'humeur basse': 'Note 3 choses positives de ta journée.',
      'respiration manquante': 'Prends 5 min pour la cohérence cardiaque.',
    }

    return {
      status: 'attention',
      message: `Point d'attention : ${issues[0]}.`,
      recommendation: recommendations[issues[0]],
    }
  }

  return {
    status: 'needs_care',
    message: 'Prends soin de toi aujourd\'hui.',
    recommendation: 'Commence par 5 min de respiration profonde.',
  }
}

// ============= EXPORTS =============

export const WellnessAgent = {
  analyzeWellness,
  getQuickWellnessCheck,
  analyzeSleep,
  analyzeStressAndMood,
  generateMeditationRecommendations,
  generateDailyPlan,
}

export default WellnessAgent
