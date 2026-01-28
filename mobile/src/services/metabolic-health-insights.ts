/**
 * Metabolic Health Insights Service
 *
 * Exploite les données santé (HealthKit/Health Connect) pour enrichir
 * le programme Boost Métabolique avec des insights personnalisés.
 *
 * Croisements de données:
 * - Sommeil × Activité → Récupération et capacité d'effort
 * - Poids × Activité → Efficacité du programme
 * - Pas × Sommeil → Corrélation énergie/repos
 */

import { PHASE_CONFIGS, type MetabolicPhase, type DailyLog, type WeekSummary } from '../stores/metabolic-boost-store'

export interface HealthMetrics {
  steps: number
  sleepHours: number
  sleepQuality?: 1 | 2 | 3 | 4 | 5
  weight?: number
  previousWeight?: number
  activeCalories?: number
  restingHeartRate?: number
}

export interface PhaseHealthInsight {
  type: 'warning' | 'success' | 'suggestion' | 'adaptation'
  title: string
  message: string
  action?: string
  priority: 'low' | 'medium' | 'high'
  dataSource: string[]
}

export interface RecoveryScore {
  score: number // 0-100
  components: {
    sleep: number
    restDay: boolean
    trend: 'improving' | 'stable' | 'declining'
  }
  recommendation: string
}

export interface ProgressionReadiness {
  ready: boolean
  confidence: number // 0-1
  factors: {
    name: string
    status: 'met' | 'partial' | 'not_met'
    detail: string
  }[]
  suggestion: string
}

/**
 * Calcule un score de récupération basé sur les données santé
 */
export function calculateRecoveryScore(
  todayMetrics: HealthMetrics,
  recentLogs: DailyLog[],
  phase: MetabolicPhase
): RecoveryScore {
  const config = PHASE_CONFIGS[phase]
  let score = 50 // Base score

  // Facteur sommeil (±30 points)
  const sleepRatio = todayMetrics.sleepHours / config.dailyTargets.sleepHours
  if (sleepRatio >= 1) {
    score += 30
  } else if (sleepRatio >= 0.85) {
    score += 15
  } else if (sleepRatio < 0.7) {
    score -= 20
  }

  // Qualité sommeil (±10 points)
  if (todayMetrics.sleepQuality) {
    score += (todayMetrics.sleepQuality - 3) * 5 // -10 to +10
  }

  // Tendance sur 3 jours
  const recentSleep = recentLogs.slice(-3).map(l => l.sleepHours || 0)
  const sleepTrend = recentSleep.length >= 2
    ? recentSleep[recentSleep.length - 1]! - recentSleep[0]!
    : 0

  // Jour de repos (vérifie si pas de séance de force hier)
  const yesterday = recentLogs[recentLogs.length - 1]
  const isRestDay = !yesterday?.strengthSession

  // Bonus jour de repos après effort
  if (isRestDay && recentLogs.slice(-2).some(l => l.strengthSession)) {
    score += 10
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  // Déterminer la tendance
  let trend: 'improving' | 'stable' | 'declining' = 'stable'
  if (sleepTrend > 0.5) trend = 'improving'
  else if (sleepTrend < -0.5) trend = 'declining'

  // Recommandation basée sur le score
  let recommendation = ''
  if (score >= 80) {
    recommendation = 'Excellente récupération ! Tu peux pousser un peu plus aujourd\'hui.'
  } else if (score >= 60) {
    recommendation = 'Bonne récupération. Continue normalement.'
  } else if (score >= 40) {
    recommendation = 'Récupération moyenne. Écoute ton corps et adapte l\'intensité.'
  } else {
    recommendation = 'Récupération insuffisante. Privilégie le repos ou une activité légère.'
  }

  return {
    score,
    components: {
      sleep: sleepRatio * 100,
      restDay: isRestDay,
      trend,
    },
    recommendation,
  }
}

/**
 * Génère des insights spécifiques à la phase basés sur les données santé
 */
export function generatePhaseInsights(
  phase: MetabolicPhase,
  weekInPhase: number,
  todayMetrics: HealthMetrics,
  weekSummary: WeekSummary | null,
  recentLogs: DailyLog[]
): PhaseHealthInsight[] {
  const insights: PhaseHealthInsight[] = []
  const config = PHASE_CONFIGS[phase]

  // === PHASE 1: DISCOVERY ===
  if (phase === 'discovery') {
    // Insight: Sommeil insuffisant
    if (todayMetrics.sleepHours < 6) {
      insights.push({
        type: 'warning',
        title: 'Sommeil à surveiller',
        message: `${todayMetrics.sleepHours}h de sommeil cette nuit. En phase Découverte, le sommeil est prioritaire pour stabiliser ton métabolisme.`,
        action: 'Essaie de te coucher 30 min plus tôt ce soir',
        priority: 'high',
        dataSource: ['sleep'],
      })
    }

    // Insight: Bonne régularité des pas
    if (weekSummary && weekSummary.avgSteps >= config.dailyTargets.steps) {
      insights.push({
        type: 'success',
        title: 'Activité régulière',
        message: `Moyenne de ${weekSummary.avgSteps} pas/jour cette semaine. Tu as bien intégré la marche quotidienne.`,
        priority: 'low',
        dataSource: ['steps'],
      })
    }

    // Insight: Variabilité du poids normale
    if (todayMetrics.weight && todayMetrics.previousWeight) {
      const diff = Math.abs(todayMetrics.weight - todayMetrics.previousWeight)
      if (diff > 1) {
        insights.push({
          type: 'suggestion',
          title: 'Fluctuation normale',
          message: `Variation de ${diff.toFixed(1)}kg - c'est normal ! Le poids fluctue selon l'hydratation et les repas. Ne t'inquiète pas.`,
          priority: 'low',
          dataSource: ['weight'],
        })
      }
    }
  }

  // === PHASE 2: WALKING ===
  if (phase === 'walking') {
    // Insight: Corrélation sommeil/activité
    const recentSleepAvg = recentLogs.slice(-5).reduce((sum, l) => sum + (l.sleepHours || 0), 0) / Math.max(1, recentLogs.slice(-5).length)
    const recentStepsAvg = recentLogs.slice(-5).reduce((sum, l) => sum + (l.steps || 0), 0) / Math.max(1, recentLogs.slice(-5).length)

    if (recentSleepAvg < 6.5 && recentStepsAvg < config.dailyTargets.steps * 0.8) {
      insights.push({
        type: 'adaptation',
        title: 'Fatigue détectée',
        message: `Ton sommeil (${recentSleepAvg.toFixed(1)}h/nuit) impacte ton activité (${Math.round(recentStepsAvg)} pas/jour). C'est normal - priorité au repos.`,
        action: 'Réduis tes objectifs de pas de 20% cette semaine',
        priority: 'medium',
        dataSource: ['sleep', 'steps'],
      })
    }

    // Insight: Progression des pas
    if (weekSummary && weekSummary.avgSteps >= config.dailyTargets.steps * 1.3) {
      insights.push({
        type: 'success',
        title: 'Surperformance activité',
        message: `${Math.round(weekSummary.avgSteps)} pas/jour en moyenne, +30% au-dessus de l'objectif ! Tu es peut-être prêt pour la phase suivante.`,
        priority: 'medium',
        dataSource: ['steps'],
      })
    }

    // Insight: Tendance poids
    if (todayMetrics.weight && todayMetrics.previousWeight && weekInPhase >= 2) {
      const weeklyChange = todayMetrics.weight - todayMetrics.previousWeight
      if (weeklyChange > 0.5) {
        insights.push({
          type: 'suggestion',
          title: 'Poids en légère hausse',
          message: `+${weeklyChange.toFixed(1)}kg cette semaine. Si ton énergie est bonne, c'est normal pendant la relance métabolique.`,
          action: 'Vérifie ton hydratation et tes apports en sel',
          priority: 'low',
          dataSource: ['weight'],
        })
      }
    }
  }

  // === PHASE 3: RESISTANCE ===
  if (phase === 'resistance') {
    // Insight: Récupération post-entraînement
    const recoveryScore = calculateRecoveryScore(todayMetrics, recentLogs, phase)

    if (recoveryScore.score < 50) {
      insights.push({
        type: 'warning',
        title: 'Récupération insuffisante',
        message: `Score de récupération: ${recoveryScore.score}/100. ${recoveryScore.recommendation}`,
        action: 'Privilégie une séance de mobilité ou repos complet',
        priority: 'high',
        dataSource: ['sleep', 'activity'],
      })
    }

    // Insight: Fréquence d'entraînement
    const strengthSessionsThisWeek = recentLogs.slice(-7).filter(l => l.strengthSession).length
    if (strengthSessionsThisWeek < 2 && weekInPhase >= 2) {
      insights.push({
        type: 'suggestion',
        title: 'Renforcement à intensifier',
        message: `${strengthSessionsThisWeek} séance(s) de renforcement cette semaine. L'objectif est 2-3 séances.`,
        action: 'Planifie ta prochaine séance de renforcement',
        priority: 'medium',
        dataSource: ['exercise'],
      })
    }

    // Insight: Poids stable = muscle potentiel
    if (todayMetrics.weight && todayMetrics.previousWeight) {
      const change = todayMetrics.weight - todayMetrics.previousWeight
      if (Math.abs(change) < 0.3 && strengthSessionsThisWeek >= 2) {
        insights.push({
          type: 'success',
          title: 'Recomposition en cours',
          message: `Poids stable (${todayMetrics.weight}kg) + entraînement régulier = possible recomposition corporelle. Tu gagnes du muscle !`,
          priority: 'low',
          dataSource: ['weight', 'exercise'],
        })
      }
    }

    // Insight: Qualité de sommeil pour récupération musculaire
    if (todayMetrics.sleepHours < 7) {
      insights.push({
        type: 'adaptation',
        title: 'Sommeil critique en phase Résistance',
        message: `${todayMetrics.sleepHours}h de sommeil. La construction musculaire nécessite 7-8h minimum pour la récupération et la synthèse protéique.`,
        action: 'Vise 7h30 minimum cette nuit',
        priority: 'high',
        dataSource: ['sleep'],
      })
    }
  }

  // === PHASE 4: FULL PROGRAM ===
  if (phase === 'full_program') {
    // Insight: Maintien des habitudes
    if (weekSummary) {
      const habitScore = (
        (weekSummary.avgSteps >= config.dailyTargets.steps ? 25 : 0) +
        (weekSummary.avgSleep >= config.dailyTargets.sleepHours ? 25 : 0) +
        (weekSummary.strengthSessionsCompleted >= 3 ? 25 : 0) +
        (weekSummary.completionRate >= 80 ? 25 : 0)
      )

      if (habitScore >= 75) {
        insights.push({
          type: 'success',
          title: 'Habitudes solides',
          message: `Score d'habitude: ${habitScore}/100. Tu maintiens excellemment tes acquis !`,
          priority: 'low',
          dataSource: ['steps', 'sleep', 'exercise'],
        })
      } else if (habitScore < 50) {
        insights.push({
          type: 'warning',
          title: 'Habitudes en baisse',
          message: `Score d'habitude: ${habitScore}/100. Certaines habitudes se relâchent - c'est le moment de recadrer.`,
          action: 'Choisis UNE habitude à renforcer cette semaine',
          priority: 'medium',
          dataSource: ['steps', 'sleep', 'exercise'],
        })
      }
    }

    // Insight: Pattern weekend warrior
    const weekdayLogs = recentLogs.filter(l => {
      const day = new Date(l.date).getDay()
      return day >= 1 && day <= 5
    })
    const weekendLogs = recentLogs.filter(l => {
      const day = new Date(l.date).getDay()
      return day === 0 || day === 6
    })

    if (weekdayLogs.length >= 3 && weekendLogs.length >= 2) {
      const weekdaySteps = weekdayLogs.reduce((sum, l) => sum + (l.steps || 0), 0) / weekdayLogs.length
      const weekendSteps = weekendLogs.reduce((sum, l) => sum + (l.steps || 0), 0) / weekendLogs.length

      if (weekendSteps > weekdaySteps * 1.5) {
        insights.push({
          type: 'suggestion',
          title: 'Pattern "Weekend Warrior"',
          message: `Tu fais ${Math.round(weekendSteps)} pas le weekend vs ${Math.round(weekdaySteps)} en semaine. Essaie de mieux répartir l'activité.`,
          action: 'Ajoute 10 min de marche à ta pause déjeuner',
          priority: 'low',
          dataSource: ['steps'],
        })
      }
    }
  }

  return insights
}

/**
 * Évalue si l'utilisateur est prêt à passer à la phase suivante
 * basé sur les données santé
 */
export function evaluateProgressionReadiness(
  phase: MetabolicPhase,
  weekInPhase: number,
  recentLogs: DailyLog[],
  weightHistory: { date: string; weight: number }[]
): ProgressionReadiness {
  const config = PHASE_CONFIGS[phase]
  const factors: ProgressionReadiness['factors'] = []

  // Facteur 1: Durée minimale
  const minWeeksMet = weekInPhase >= config.durationWeeks
  factors.push({
    name: 'Durée de phase',
    status: minWeeksMet ? 'met' : 'not_met',
    detail: minWeeksMet
      ? `${weekInPhase} semaines complétées (min: ${config.durationWeeks})`
      : `Semaine ${weekInPhase}/${config.durationWeeks}`,
  })

  // Facteur 2: Régularité du suivi
  const logsLastWeek = recentLogs.slice(-7)
  const trackingRate = logsLastWeek.length / 7
  factors.push({
    name: 'Régularité du suivi',
    status: trackingRate >= 0.7 ? 'met' : trackingRate >= 0.5 ? 'partial' : 'not_met',
    detail: `${logsLastWeek.length}/7 jours trackés (${Math.round(trackingRate * 100)}%)`,
  })

  // Facteur 3: Objectif de pas
  const avgSteps = logsLastWeek.reduce((sum, l) => sum + (l.steps || 0), 0) / Math.max(1, logsLastWeek.length)
  const stepsRatio = avgSteps / config.dailyTargets.steps
  factors.push({
    name: 'Objectif de pas',
    status: stepsRatio >= 1 ? 'met' : stepsRatio >= 0.8 ? 'partial' : 'not_met',
    detail: `${Math.round(avgSteps)} pas/jour (objectif: ${config.dailyTargets.steps})`,
  })

  // Facteur 4: Sommeil
  const avgSleep = logsLastWeek.reduce((sum, l) => sum + (l.sleepHours || 0), 0) / Math.max(1, logsLastWeek.length)
  const sleepRatio = avgSleep / config.dailyTargets.sleepHours
  factors.push({
    name: 'Sommeil',
    status: sleepRatio >= 1 ? 'met' : sleepRatio >= 0.85 ? 'partial' : 'not_met',
    detail: `${avgSleep.toFixed(1)}h/nuit (objectif: ${config.dailyTargets.sleepHours}h)`,
  })

  // Facteur 5: Énergie moyenne
  const avgEnergy = logsLastWeek.reduce((sum, l) => sum + (l.energyLevel || 3), 0) / Math.max(1, logsLastWeek.length)
  factors.push({
    name: 'Niveau d\'énergie',
    status: avgEnergy >= 3.5 ? 'met' : avgEnergy >= 2.5 ? 'partial' : 'not_met',
    detail: `${avgEnergy.toFixed(1)}/5 en moyenne`,
  })

  // Facteur 6 (Phase Resistance): Séances de renforcement
  if (phase === 'resistance') {
    const strengthSessions = logsLastWeek.filter(l => l.strengthSession).length
    factors.push({
      name: 'Séances de renforcement',
      status: strengthSessions >= 3 ? 'met' : strengthSessions >= 2 ? 'partial' : 'not_met',
      detail: `${strengthSessions} séances cette semaine (objectif: ${config.weeklyTargets.strengthSessions})`,
    })
  }

  // Facteur 7: Tendance du poids (si disponible et phase > 1)
  if (weightHistory.length >= 2 && phase !== 'discovery') {
    const recentWeights = weightHistory.slice(-7)
    if (recentWeights.length >= 2) {
      const firstWeight = recentWeights[0]!.weight
      const lastWeight = recentWeights[recentWeights.length - 1]!.weight
      const weeklyChange = lastWeight - firstWeight

      // En phase resistance, on veut stabilité ou légère hausse (muscle)
      const isGoodTrend = phase === 'resistance'
        ? weeklyChange >= -0.5 && weeklyChange <= 1
        : weeklyChange <= 0.5

      factors.push({
        name: 'Tendance poids',
        status: isGoodTrend ? 'met' : 'partial',
        detail: `${weeklyChange > 0 ? '+' : ''}${weeklyChange.toFixed(1)}kg cette semaine`,
      })
    }
  }

  // Calculer le score global
  const metCount = factors.filter(f => f.status === 'met').length
  const partialCount = factors.filter(f => f.status === 'partial').length
  const totalFactors = factors.length

  const confidence = (metCount + partialCount * 0.5) / totalFactors
  const ready = minWeeksMet && confidence >= 0.7

  // Générer la suggestion
  let suggestion = ''
  if (ready) {
    suggestion = 'Tu es prêt(e) à passer à la phase suivante ! Continue sur cette lancée.'
  } else if (confidence >= 0.5) {
    const unmetFactors = factors.filter(f => f.status === 'not_met')
    suggestion = `Presque ! Travaille sur: ${unmetFactors.map(f => f.name.toLowerCase()).join(', ')}.`
  } else {
    suggestion = 'Continue à consolider tes habitudes actuelles avant de progresser.'
  }

  return {
    ready,
    confidence,
    factors,
    suggestion,
  }
}

/**
 * Génère des ajustements d'objectifs basés sur les données santé
 */
export function generateDynamicTargets(
  phase: MetabolicPhase,
  todayMetrics: HealthMetrics,
  recentLogs: DailyLog[]
): {
  steps: { target: number; adjusted: number; reason?: string }
  sleep: { target: number; recommendation: string }
  intensity: 'low' | 'normal' | 'high'
} {
  const config = PHASE_CONFIGS[phase]
  const recoveryScore = calculateRecoveryScore(todayMetrics, recentLogs, phase)

  // Ajustement des pas basé sur la récupération
  let stepsAdjustment = 1.0
  let stepsReason: string | undefined

  if (recoveryScore.score < 40) {
    stepsAdjustment = 0.7
    stepsReason = 'Récupération faible - objectif réduit de 30%'
  } else if (recoveryScore.score < 60) {
    stepsAdjustment = 0.85
    stepsReason = 'Récupération moyenne - objectif réduit de 15%'
  } else if (recoveryScore.score > 85 && recoveryScore.components.trend === 'improving') {
    stepsAdjustment = 1.15
    stepsReason = 'Excellente récupération - objectif augmenté de 15%'
  }

  // Recommandation sommeil
  let sleepRecommendation = `Objectif: ${config.dailyTargets.sleepHours}h`
  if (todayMetrics.sleepHours < config.dailyTargets.sleepHours - 1) {
    sleepRecommendation = `Tu as dormi ${todayMetrics.sleepHours}h. Essaie de te coucher 30 min plus tôt ce soir.`
  } else if (todayMetrics.sleepQuality && todayMetrics.sleepQuality <= 2) {
    sleepRecommendation = 'Qualité de sommeil faible. Évite les écrans 1h avant le coucher.'
  }

  // Intensité recommandée
  let intensity: 'low' | 'normal' | 'high' = 'normal'
  if (recoveryScore.score < 50) {
    intensity = 'low'
  } else if (recoveryScore.score >= 80 && recentLogs.slice(-2).every(l => !l.strengthSession)) {
    intensity = 'high'
  }

  return {
    steps: {
      target: config.dailyTargets.steps,
      adjusted: Math.round(config.dailyTargets.steps * stepsAdjustment),
      reason: stepsReason,
    },
    sleep: {
      target: config.dailyTargets.sleepHours,
      recommendation: sleepRecommendation,
    },
    intensity,
  }
}

export default {
  calculateRecoveryScore,
  generatePhaseInsights,
  evaluateProgressionReadiness,
  generateDynamicTargets,
}
