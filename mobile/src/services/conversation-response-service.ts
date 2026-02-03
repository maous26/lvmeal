/**
 * Conversation Response Generator Service (Recommendation #7)
 *
 * Key principles:
 * - Multiple templates per intent to avoid repetition
 * - Slot-based personalization (ton, emoji, phrasing)
 * - "Le LLM ne décide pas. Il rédige et clarifie."
 * - Diagnosis shown via "Pourquoi?" toggle (Recommendation #5)
 */

import {
  UserIntent,
  IntentDetectionResult,
  ConversationResponse,
  ConversationAction,
  ConversationContextFull,
  ResponseTone,
  DiagnosisFactor,
  QuickReply,
  PlanStep,
} from '../types/conversation'
import { conversationActionService } from './conversation-action-service'
import { conversationSafetyService } from './conversation-safety-service'

// ============================================================================
// RESPONSE TEMPLATES (Multiple per intent - Recommendation #7)
// ============================================================================

interface ResponseTemplate {
  text: string
  tone: ResponseTone
  emoji?: string
  slots: string[]  // Variables to replace: {calories}, {name}, {hours}, etc.
}

interface IntentTemplates {
  templates: ResponseTemplate[]
  quickReplies: QuickReply[]
  diagnosisGenerator?: (context: ConversationContextFull) => DiagnosisFactor[]
}

const RESPONSE_TEMPLATES: Partial<Record<UserIntent, IntentTemplates>> = {
  // ========== HUNGER ==========
  HUNGER: {
    templates: [
      {
        text: "{hours}h sans manger, je comprends que tu aies faim ! Tu as encore {calories} kcal pour aujourd'hui. Voici ce que je te propose.",
        tone: 'empathetic',
        emoji: '🍽️',
        slots: ['hours', 'calories'],
      },
      {
        text: "C'est l'heure de recharger les batteries ! Avec {calories} kcal restantes, j'ai quelques idées pour toi.",
        tone: 'encouraging',
        emoji: '💪',
        slots: ['calories'],
      },
      {
        text: "Ton estomac appelle ? Voyons ce qu'on peut faire avec tes {calories} kcal disponibles.",
        tone: 'casual',
        emoji: '😋',
        slots: ['calories'],
      },
      {
        text: "Je te prépare quelque chose de bon ! Tu as {calories} kcal, on va trouver le repas parfait.",
        tone: 'encouraging',
        emoji: '👨‍🍳',
        slots: ['calories'],
      },
    ],
    quickReplies: [
      { label: "Quelque chose de rapide", intent: 'MEAL_SUGGESTION' },
      { label: "Un vrai repas", intent: 'MEAL_SUGGESTION' },
      { label: "J'ai déjà mangé", intent: 'LOG_MEAL' },
    ],
    diagnosisGenerator: (ctx) => [
      { label: 'Heures depuis dernier repas', value: `${ctx.temporal.hoursSinceLastMeal}h`, impact: ctx.temporal.hoursSinceLastMeal > 5 ? 'high' : 'medium' },
      { label: 'Calories restantes', value: `${ctx.nutrition.caloriesRemaining} kcal`, impact: 'medium' },
      { label: 'Moment de la journée', value: ctx.temporal.timeOfDay, impact: 'low' },
    ],
  },

  // ========== CRAVING ==========
  CRAVING: {
    templates: [
      {
        text: "Une envie de {craving} ? Je te comprends. Plutôt que de résister, voyons comment la satisfaire intelligemment.",
        tone: 'empathetic',
        emoji: '🍫',
        slots: ['craving'],
      },
      {
        text: "Les envies font partie de la vie ! Voici quelques options pour ta dose de {craving} sans culpabilité.",
        tone: 'supportive',
        emoji: '😌',
        slots: ['craving'],
      },
      {
        text: "Envie de {craving} ? Ça tombe bien, j'ai des alternatives qui vont te plaire.",
        tone: 'casual',
        emoji: '✨',
        slots: ['craving'],
      },
    ],
    quickReplies: [
      { label: "Une alternative saine", intent: 'MEAL_SUGGESTION' },
      { label: "Je me fais plaisir", intent: 'LOG_MEAL' },
      { label: "Ça va passer", intent: 'GREETING' },
    ],
    diagnosisGenerator: (ctx) => {
      const factors: DiagnosisFactor[] = [
        { label: 'Type d\'envie', value: 'Sucré/Salé', impact: 'medium' },
      ]
      if (ctx.correlations.stressEating.length > 0) {
        factors.push({ label: 'Pattern stress-eating', value: 'Détecté', impact: 'high' })
      }
      if (ctx.temporal.hoursSinceLastMeal > 3) {
        factors.push({ label: 'Faim physique possible', value: 'Oui', impact: 'medium' })
      }
      return factors
    },
  },

  // ========== FATIGUE ==========
  FATIGUE: {
    templates: [
      {
        text: "La fatigue, ça arrive. {sleepComment} Voyons comment te redonner de l'énergie.",
        tone: 'empathetic',
        emoji: '😴',
        slots: ['sleepComment'],
      },
      {
        text: "Pas facile quand on est fatigué. {suggestion}",
        tone: 'supportive',
        emoji: '💙',
        slots: ['suggestion'],
      },
      {
        text: "Je vois que t'es pas au top aujourd'hui. On va y aller doucement et trouver ce qui peut t'aider.",
        tone: 'empathetic',
        emoji: '🤗',
        slots: [],
      },
    ],
    quickReplies: [
      { label: "Un snack énergisant", intent: 'MEAL_SUGGESTION' },
      { label: "Conseils pour mieux dormir", intent: 'HELP' },
      { label: "C'est passager", intent: 'GREETING' },
    ],
    diagnosisGenerator: (ctx) => {
      const factors: DiagnosisFactor[] = []
      if (ctx.wellness.sleepLastNight) {
        factors.push({
          label: 'Sommeil cette nuit',
          value: `${ctx.wellness.sleepLastNight.hours}h (${ctx.wellness.sleepLastNight.quality})`,
          impact: ctx.wellness.sleepLastNight.hours < 6 ? 'high' : 'medium',
        })
      }
      if (ctx.temporal.hoursSinceLastMeal > 4) {
        factors.push({ label: 'Heures sans manger', value: `${ctx.temporal.hoursSinceLastMeal}h`, impact: 'medium' })
      }
      factors.push({ label: 'Hydratation', value: `${ctx.wellness.hydration} verres`, impact: ctx.wellness.hydration < 4 ? 'medium' : 'low' })
      return factors
    },
  },

  // ========== STRESS ==========
  STRESS: {
    templates: [
      {
        text: "Je sens que c'est une journée difficile. Respire, je suis là. {stressComment}",
        tone: 'empathetic',
        emoji: '🫂',
        slots: ['stressComment'],
      },
      {
        text: "Le stress fait partie de la vie, mais on peut l'apprivoiser. Qu'est-ce qui t'aiderait le plus là maintenant ?",
        tone: 'supportive',
        emoji: '💚',
        slots: [],
      },
      {
        text: "Journée tendue ? Prends un moment. {suggestion}",
        tone: 'empathetic',
        emoji: '🌿',
        slots: ['suggestion'],
      },
    ],
    quickReplies: [
      { label: "Exercice de respiration", action: 'START_BREATHING' },
      { label: "Un réconfort healthy", intent: 'CRAVING' },
      { label: "Juste parler", intent: 'HELP' },
    ],
    diagnosisGenerator: (ctx) => {
      const factors: DiagnosisFactor[] = [
        { label: 'Niveau de stress perçu', value: 'Élevé', impact: 'high' },
      ]
      if (ctx.correlations.stressEating.length > 0) {
        factors.push({ label: 'Risque stress-eating', value: `${ctx.correlations.stressEating.length} épisodes récents`, impact: 'high' })
      }
      if (ctx.wellness.sleepLastNight && ctx.wellness.sleepLastNight.hours < 6) {
        factors.push({ label: 'Sommeil insuffisant', value: 'Facteur aggravant', impact: 'medium' })
      }
      return factors
    },
  },

  // ========== PROGRESS_CHECK ==========
  PROGRESS_CHECK: {
    templates: [
      {
        text: "Voyons où tu en es ! {progressSummary}",
        tone: 'informative',
        emoji: '📊',
        slots: ['progressSummary'],
      },
      {
        text: "Ton point du jour : {progressSummary}",
        tone: 'encouraging',
        emoji: '✨',
        slots: ['progressSummary'],
      },
      {
        text: "Bilan en cours... {progressSummary}",
        tone: 'informative',
        emoji: '📈',
        slots: ['progressSummary'],
      },
    ],
    quickReplies: [
      { label: "Voir le détail", action: 'SHOW_PROGRESS' },
      { label: "Ajuster mes objectifs", intent: 'PLAN_MODIFICATION' },
      { label: "C'est bon, merci", intent: 'GREETING' },
    ],
    diagnosisGenerator: (ctx) => [
      { label: 'Streak actuel', value: `${ctx.gamification.currentStreak} jours`, impact: ctx.gamification.currentStreak > 7 ? 'high' : 'medium' },
      { label: 'Tendance nutritionnelle', value: ctx.nutrition.weeklyTrend, impact: 'medium' },
      { label: 'Phase du programme', value: ctx.program.currentPhase || 'Libre', impact: 'low' },
    ],
  },

  // ========== CELEBRATION ==========
  CELEBRATION: {
    templates: [
      {
        text: "Bravo ! 🎉 C'est super, tu peux être fier(e) de toi ! {celebrationDetail}",
        tone: 'celebratory',
        emoji: '🎉',
        slots: ['celebrationDetail'],
      },
      {
        text: "Yes ! Les efforts paient, et ça se voit ! Continue comme ça 💪",
        tone: 'celebratory',
        emoji: '🏆',
        slots: [],
      },
      {
        text: "J'adore cette énergie ! Tu gères ! 🌟",
        tone: 'celebratory',
        emoji: '⭐',
        slots: [],
      },
    ],
    quickReplies: [
      { label: "Voir mes achievements", action: 'NAVIGATE_TO', params: { screen: 'Achievements' } },
      { label: "Un nouveau défi", intent: 'CHALLENGE_START' },
      { label: "Merci !", intent: 'GREETING' },
    ],
  },

  // ========== DOUBT ==========
  DOUBT: {
    templates: [
      {
        text: "Je comprends le doute, c'est normal. Mais regarde : {evidenceOfProgress}. Ça compte !",
        tone: 'supportive',
        emoji: '💙',
        slots: ['evidenceOfProgress'],
      },
      {
        text: "Les résultats prennent du temps, et tu fais déjà beaucoup. {encouragement}",
        tone: 'empathetic',
        emoji: '🌱',
        slots: ['encouragement'],
      },
      {
        text: "C'est humain de douter. Mais chaque petit pas compte, même quand on ne le voit pas tout de suite.",
        tone: 'empathetic',
        emoji: '💚',
        slots: [],
      },
    ],
    quickReplies: [
      { label: "Voir mes progrès", action: 'SHOW_PROGRESS' },
      { label: "Parler à quelqu'un", action: 'CONTACT_SUPPORT' },
      { label: "Je continue", intent: 'GREETING' },
    ],
  },

  // ========== PLATEAU ==========
  PLATEAU: {
    templates: [
      {
        text: "Les plateaux sont frustrants, je sais. Mais c'est souvent le signe que ton corps s'adapte. {plateauAdvice}",
        tone: 'supportive',
        emoji: '📊',
        slots: ['plateauAdvice'],
      },
      {
        text: "Stagnation en vue ? C'est le moment de secouer les choses ! Voici quelques pistes.",
        tone: 'encouraging',
        emoji: '🔄',
        slots: [],
      },
    ],
    quickReplies: [
      { label: "Ajuster ma stratégie", intent: 'PLAN_MODIFICATION' },
      { label: "Lancer un défi", intent: 'CHALLENGE_START' },
      { label: "Rester patient", intent: 'GREETING' },
    ],
    diagnosisGenerator: (ctx) => [
      { label: 'Jours sans changement notable', value: `~${Math.floor(ctx.program.dayInPhase / 2)} jours`, impact: 'medium' },
      { label: 'Tendance calorique', value: ctx.nutrition.weeklyTrend, impact: 'medium' },
      { label: 'Variabilité des repas', value: 'À analyser', impact: 'low' },
    ],
  },

  // ========== GREETING ==========
  GREETING: {
    templates: [
      {
        text: "Salut {name} ! Comment je peux t'aider aujourd'hui ?",
        tone: 'casual',
        emoji: '👋',
        slots: ['name'],
      },
      {
        text: "Hey ! Content de te voir. Qu'est-ce qui t'amène ?",
        tone: 'casual',
        emoji: '😊',
        slots: [],
      },
      {
        text: "Coucou ! Prêt(e) pour une nouvelle journée ? Je suis là si tu as besoin.",
        tone: 'encouraging',
        emoji: '🌟',
        slots: [],
      },
    ],
    quickReplies: [
      { label: "J'ai faim", intent: 'HUNGER' },
      { label: "Où j'en suis ?", intent: 'PROGRESS_CHECK' },
      { label: "Journée difficile", intent: 'STRESS' },
    ],
  },

  // ========== HELP ==========
  HELP: {
    templates: [
      {
        text: "Je suis là pour t'accompagner ! Je peux t'aider avec tes repas, suivre tes progrès, te motiver... Qu'est-ce qui t'intéresse ?",
        tone: 'informative',
        emoji: '💡',
        slots: [],
      },
      {
        text: "Pas de souci, je t'explique ! {helpContent}",
        tone: 'informative',
        emoji: '📚',
        slots: ['helpContent'],
      },
    ],
    quickReplies: [
      { label: "Suggestions repas", intent: 'MEAL_SUGGESTION' },
      { label: "Suivi progrès", intent: 'PROGRESS_CHECK' },
      { label: "Les défis", intent: 'CHALLENGE_START' },
    ],
  },

  // ========== UNKNOWN ==========
  UNKNOWN: {
    templates: [
      {
        text: "Je ne suis pas sûr de bien comprendre. Tu peux me reformuler ou choisir une option ci-dessous ?",
        tone: 'casual',
        emoji: '🤔',
        slots: [],
      },
      {
        text: "Hmm, j'ai un doute sur ce que tu veux dire. Essaie peut-être avec d'autres mots ?",
        tone: 'casual',
        emoji: '💭',
        slots: [],
      },
    ],
    quickReplies: [
      { label: "J'ai faim", intent: 'HUNGER' },
      { label: "Comment ça va", intent: 'PROGRESS_CHECK' },
      { label: "Aide", intent: 'HELP' },
    ],
  },
}

// ============================================================================
// RESPONSE GENERATOR SERVICE
// ============================================================================

class ConversationResponseService {
  private templateIndex: Map<UserIntent, number> = new Map()

  /**
   * Generate a complete response
   */
  generateResponse(
    intent: IntentDetectionResult,
    context: ConversationContextFull
  ): ConversationResponse {
    const startTime = Date.now()
    const primaryIntent = intent.topIntents[0]?.intent || 'UNKNOWN'

    // 1. Get templates for this intent
    const intentConfig = RESPONSE_TEMPLATES[primaryIntent] || RESPONSE_TEMPLATES.UNKNOWN!

    // 2. Select template (rotate to avoid repetition - Recommendation #7)
    const template = this.selectTemplate(primaryIntent, intentConfig.templates)

    // 3. Fill slots with context data
    const filledText = this.fillSlots(template, context, intent)

    // 4. Build diagnosis if available (for "Pourquoi?" toggle - Recommendation #5)
    const diagnosis = intentConfig.diagnosisGenerator
      ? {
          summary: this.getDiagnosisSummary(primaryIntent, context),
          factors: intentConfig.diagnosisGenerator(context),
          confidence: intent.topIntents[0]?.confidence || 0.5,
          dataPoints: this.getDataPoints(context),
        }
      : undefined

    // 5. Build actions
    const actions = this.buildActionsForIntent(primaryIntent, context, intent)

    // 6. Build quick replies
    const quickReplies = this.personalizeQuickReplies(intentConfig.quickReplies, context)

    // 7. Build short term plan (Premium only)
    const shortTermPlan = context.user.isPremium
      ? this.buildShortTermPlan(primaryIntent, context)
      : undefined

    // 8. Safety validation
    const response: ConversationResponse = {
      message: {
        text: filledText,
        tone: template.tone,
        emoji: template.emoji,
      },
      diagnosis,
      shortTermPlan,
      actions,
      ui: {
        quickReplies,
        showDiagnosisToggle: !!diagnosis && context.user.isPremium,
      },
      meta: {
        responseId: this.generateId(),
        generatedAt: new Date().toISOString(),
        model: 'rules',
        processingTimeMs: Date.now() - startTime,
      },
    }

    // 9. Validate response for safety
    const validatedResponse = conversationSafetyService.validateResponse(response, context)

    return validatedResponse
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private selectTemplate(intent: UserIntent, templates: ResponseTemplate[]): ResponseTemplate {
    // Rotate templates to avoid repetition
    const currentIndex = this.templateIndex.get(intent) || 0
    const template = templates[currentIndex % templates.length]
    this.templateIndex.set(intent, currentIndex + 1)
    return template
  }

  private fillSlots(
    template: ResponseTemplate,
    context: ConversationContextFull,
    intent: IntentDetectionResult
  ): string {
    let text = template.text

    // Fill common slots
    const slots: Record<string, string> = {
      name: context.user.firstName || '',
      calories: String(context.nutrition.caloriesRemaining),
      hours: String(context.temporal.hoursSinceLastMeal),
      craving: this.extractCraving(intent) || 'gourmandise',
    }

    // Context-specific slots
    if (context.wellness.sleepLastNight) {
      const hours = context.wellness.sleepLastNight.hours
      if (hours < 6) {
        slots.sleepComment = `Avec seulement ${hours}h de sommeil, pas étonnant que tu sois fatigué(e).`
      } else {
        slots.sleepComment = "Le sommeil joue beaucoup sur l'énergie."
      }
    } else {
      slots.sleepComment = ''
    }

    // Stress-related slots
    if (context.correlations.stressEating.length > 0) {
      slots.stressComment = "J'ai remarqué que le stress influence parfois tes choix alimentaires. C'est normal, on va gérer ça ensemble."
    } else {
      slots.stressComment = "Prends un moment pour toi."
    }

    // Progress slots
    const streak = context.gamification.currentStreak
    if (streak > 0) {
      slots.progressSummary = `Tu es sur une série de ${streak} jours ! Continue comme ça.`
      slots.evidenceOfProgress = `tu as maintenu ${streak} jours de suite`
    } else {
      slots.progressSummary = "Chaque jour est une nouvelle opportunité."
      slots.evidenceOfProgress = "tu es là, c'est déjà un premier pas"
    }

    // Generic suggestions
    slots.suggestion = this.getContextualSuggestion(context)
    slots.encouragement = this.getEncouragement(context)
    slots.celebrationDetail = ''
    slots.plateauAdvice = "On peut essayer de varier tes repas ou ajuster légèrement tes objectifs."
    slots.helpContent = "Tu peux me demander des suggestions de repas, voir tes progrès, ou juste discuter."

    // Replace all slots
    for (const [key, value] of Object.entries(slots)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }

    // Clean up empty slots and extra spaces
    text = text.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim()

    return text
  }

  private extractCraving(intent: IntentDetectionResult): string | null {
    const foodEntity = intent.entities.find(e => e.type === 'food')
    return foodEntity?.value || null
  }

  private getContextualSuggestion(context: ConversationContextFull): string {
    if (context.temporal.hoursSinceLastMeal > 4) {
      return "Un petit encas protéiné pourrait t'aider."
    }
    if (context.wellness.hydration < 4) {
      return "N'oublie pas de boire un peu d'eau aussi."
    }
    return "Écoute ton corps, il sait ce dont il a besoin."
  }

  private getEncouragement(context: ConversationContextFull): string {
    const streak = context.gamification.currentStreak
    if (streak > 7) return `${streak} jours de suite, c'est impressionnant !`
    if (streak > 0) return `Tu es sur une bonne lancée avec ${streak} jours.`
    return "Chaque jour compte, même les jours difficiles."
  }

  private getDiagnosisSummary(intent: UserIntent, context: ConversationContextFull): string {
    switch (intent) {
      case 'HUNGER':
        return "Analyse basée sur ton historique de repas et tes besoins caloriques"
      case 'FATIGUE':
        return "Facteurs identifiés pouvant influencer ton énergie"
      case 'STRESS':
        return "Éléments contextuels liés à ton stress"
      case 'CRAVING':
        return "Comprendre d'où vient cette envie"
      case 'PROGRESS_CHECK':
        return "Récapitulatif de tes données récentes"
      case 'PLATEAU':
        return "Analyse de ta situation actuelle"
      default:
        return "Analyse contextuelle"
    }
  }

  private getDataPoints(context: ConversationContextFull): string[] {
    const points: string[] = []
    if (context.nutrition.todayMeals.length > 0) points.push('Repas du jour')
    if (context.wellness.sleepLastNight) points.push('Données sommeil')
    if (context.gamification.currentStreak > 0) points.push('Historique streak')
    if (context.correlations.stressEating.length > 0) points.push('Patterns émotionnels')
    return points
  }

  private buildActionsForIntent(
    intent: UserIntent,
    context: ConversationContextFull,
    detection: IntentDetectionResult
  ): ConversationAction[] {
    const proposedActions: Partial<ConversationAction>[] = []

    switch (intent) {
      case 'HUNGER':
      case 'MEAL_SUGGESTION':
        proposedActions.push({
          type: 'SUGGEST_MEAL',
          label: 'Voir une suggestion',
          params: { mealType: this.getMealTypeFromTime(context) },
        })
        proposedActions.push({
          type: 'LOG_MEAL_QUICK',
          label: "J'ai déjà mangé",
          params: { openQuickLog: true },
        })
        break

      case 'STRESS':
      case 'ANXIETY':
        proposedActions.push({
          type: 'START_BREATHING',
          label: 'Exercice de respiration',
          params: { technique: '4-7-8', duration: 120 },
        })
        if (context.correlations.stressEating.length > 0) {
          proposedActions.push({
            type: 'SUGGEST_MEAL',
            label: 'Collation anti-stress',
            params: { tags: ['comfort', 'healthy'] },
          })
        }
        break

      case 'PROGRESS_CHECK':
        proposedActions.push({
          type: 'SHOW_PROGRESS',
          label: 'Voir le détail',
          params: { period: 'week', metric: 'all' },
        })
        break

      case 'CHALLENGE_START':
        proposedActions.push({
          type: 'NAVIGATE_TO',
          label: 'Voir les défis',
          params: { screen: 'Challenges' },
        })
        break

      case 'FATIGUE':
      case 'LOW_ENERGY':
        proposedActions.push({
          type: 'SUGGEST_MEAL',
          label: 'Snack énergisant',
          params: { tags: ['energy', 'quick'] },
        })
        break

      case 'CRAVING':
        proposedActions.push({
          type: 'SUGGEST_MEAL',
          label: 'Alternative saine',
          params: { tags: ['comfort', 'healthy'] },
        })
        proposedActions.push({
          type: 'LOG_MEAL_QUICK',
          label: 'Je me fais plaisir',
          params: { openQuickLog: true },
        })
        break
    }

    // Validate and return
    return conversationActionService.buildValidActions(proposedActions, context)
  }

  private getMealTypeFromTime(context: ConversationContextFull): string {
    switch (context.temporal.timeOfDay) {
      case 'morning': return 'breakfast'
      case 'midday': return 'lunch'
      case 'afternoon': return 'snack'
      case 'evening':
      case 'night': return 'dinner'
      default: return 'snack'
    }
  }

  private personalizeQuickReplies(
    replies: QuickReply[],
    _context: ConversationContextFull
  ): QuickReply[] {
    // Could add context-based personalization here
    return replies.slice(0, 3)
  }

  /**
   * Build short term plan based on intent and context (Premium feature)
   */
  private buildShortTermPlan(
    intent: UserIntent,
    context: ConversationContextFull
  ): ConversationResponse['shortTermPlan'] | undefined {
    // Only generate plans for actionable intents
    const planGenerators: Partial<Record<UserIntent, () => ConversationResponse['shortTermPlan']>> = {
      HUNGER: () => this.buildHungerPlan(context),
      FATIGUE: () => this.buildFatiguePlan(context),
      LOW_ENERGY: () => this.buildFatiguePlan(context),
      STRESS: () => this.buildStressPlan(context),
      ANXIETY: () => this.buildStressPlan(context),
      CRAVING: () => this.buildCravingPlan(context),
      PLATEAU: () => this.buildPlateauPlan(context),
      DOUBT: () => this.buildMotivationPlan(context),
      OVERWHELM: () => this.buildSimplificationPlan(context),
    }

    const generator = planGenerators[intent]
    return generator ? generator() : undefined
  }

  private buildHungerPlan(context: ConversationContextFull): ConversationResponse['shortTermPlan'] {
    const steps: PlanStep[] = []
    const hoursSinceLastMeal = context.temporal.hoursSinceLastMeal

    // Immediate action
    if (hoursSinceLastMeal > 5) {
      steps.push({
        action: 'Manger un repas équilibré',
        timing: 'Maintenant',
        priority: 'high',
      })
    } else {
      steps.push({
        action: 'Collation légère si besoin',
        timing: 'Maintenant',
        priority: 'medium',
      })
    }

    // Hydration check
    if (context.wellness.hydration < 4) {
      steps.push({
        action: 'Boire un verre d\'eau',
        timing: 'Avec le repas',
        priority: 'medium',
      })
    }

    // Short term follow-up
    steps.push({
      action: 'Logger le repas dans l\'app',
      timing: '+15min',
      priority: 'low',
    })

    return {
      horizon: 'immediate',
      steps,
      expectedOutcome: hoursSinceLastMeal > 5
        ? 'Regain d\'énergie dans 30-45 minutes'
        : 'Maintien de ton niveau d\'énergie',
    }
  }

  private buildFatiguePlan(context: ConversationContextFull): ConversationResponse['shortTermPlan'] {
    const steps: PlanStep[] = []
    const causes: string[] = []

    // Identify causes and build plan
    if (context.temporal.hoursSinceLastMeal > 4) {
      steps.push({
        action: 'Manger un encas énergisant',
        timing: 'Maintenant',
        priority: 'high',
      })
      causes.push('jeûne prolongé')
    }

    if (context.wellness.hydration < 4) {
      steps.push({
        action: 'Boire 2 verres d\'eau',
        timing: 'Maintenant',
        priority: 'high',
      })
      causes.push('déshydratation possible')
    }

    if (context.wellness.sleepLastNight && context.wellness.sleepLastNight.hours < 6) {
      steps.push({
        action: 'Micro-sieste de 15-20min si possible',
        timing: '+30min',
        priority: 'medium',
      })
      causes.push('manque de sommeil')
    }

    // Always add movement
    steps.push({
      action: 'Marche légère de 5-10 min',
      timing: '+1h',
      priority: 'low',
    })

    return {
      horizon: 'today',
      steps: steps.slice(0, 4), // Max 4 steps
      expectedOutcome: causes.length > 0
        ? `Amélioration progressive (causes identifiées: ${causes.join(', ')})`
        : 'Regain d\'énergie progressif',
    }
  }

  private buildStressPlan(context: ConversationContextFull): ConversationResponse['shortTermPlan'] {
    const steps: PlanStep[] = [
      {
        action: 'Exercice de respiration 4-7-8',
        timing: 'Maintenant',
        priority: 'high',
      },
    ]

    // Add stress-eating prevention if pattern detected
    if (context.correlations.stressEating.length > 0) {
      steps.push({
        action: 'Si envie de manger: attendre 10min',
        timing: '+5min',
        priority: 'high',
      })
      steps.push({
        action: 'Collation saine si faim réelle',
        timing: '+15min',
        priority: 'medium',
      })
    } else {
      steps.push({
        action: 'Pause de 5 minutes',
        timing: '+5min',
        priority: 'medium',
      })
    }

    steps.push({
      action: 'Marche courte ou étirements',
      timing: '+30min',
      priority: 'low',
    })

    return {
      horizon: 'immediate',
      steps: steps.slice(0, 4),
      expectedOutcome: 'Réduction du stress et clarté mentale',
    }
  }

  private buildCravingPlan(context: ConversationContextFull): ConversationResponse['shortTermPlan'] {
    const steps: PlanStep[] = [
      {
        action: 'Boire un verre d\'eau',
        timing: 'Maintenant',
        priority: 'medium',
      },
      {
        action: 'Attendre 10 minutes',
        timing: '+2min',
        priority: 'high',
      },
    ]

    if (context.temporal.hoursSinceLastMeal > 3) {
      steps.push({
        action: 'Si l\'envie persiste: collation équilibrée',
        timing: '+10min',
        priority: 'medium',
      })
    } else {
      steps.push({
        action: 'Si l\'envie persiste: alternative saine',
        timing: '+10min',
        priority: 'medium',
      })
    }

    steps.push({
      action: 'Noter l\'envie et le contexte',
      timing: '+15min',
      priority: 'low',
    })

    return {
      horizon: 'immediate',
      steps,
      expectedOutcome: 'Gestion de l\'envie sans culpabilité',
    }
  }

  private buildPlateauPlan(context: ConversationContextFull): ConversationResponse['shortTermPlan'] {
    return {
      horizon: 'this_week',
      steps: [
        {
          action: 'Varier les sources de protéines',
          timing: 'Aujourd\'hui',
          priority: 'medium',
        },
        {
          action: 'Ajouter 10min d\'activité par jour',
          timing: 'Cette semaine',
          priority: 'medium',
        },
        {
          action: 'Revoir tes objectifs caloriques',
          timing: 'Dans 3 jours',
          priority: 'low',
        },
        {
          action: 'Mesurer (pas que le poids)',
          timing: 'Fin de semaine',
          priority: 'low',
        },
      ],
      expectedOutcome: 'Relancer la progression naturellement',
    }
  }

  private buildMotivationPlan(_context: ConversationContextFull): ConversationResponse['shortTermPlan'] {
    const streak = _context.gamification.currentStreak
    const steps: PlanStep[] = []

    if (streak > 0) {
      steps.push({
        action: `Célèbre ta série de ${streak} jours`,
        timing: 'Maintenant',
        priority: 'high',
      })
    }

    steps.push({
      action: 'Fixer UN seul objectif simple pour aujourd\'hui',
      timing: 'Maintenant',
      priority: 'high',
    })

    steps.push({
      action: 'Logger 1 repas (même approximatif)',
      timing: 'Aujourd\'hui',
      priority: 'medium',
    })

    steps.push({
      action: 'Relire pourquoi tu as commencé',
      timing: 'Ce soir',
      priority: 'low',
    })

    return {
      horizon: 'today',
      steps: steps.slice(0, 4),
      expectedOutcome: 'Retrouver confiance et motivation',
    }
  }

  private buildSimplificationPlan(_context: ConversationContextFull): ConversationResponse['shortTermPlan'] {
    return {
      horizon: 'today',
      steps: [
        {
          action: 'Oublie les macros, juste les calories',
          timing: 'Maintenant',
          priority: 'high',
        },
        {
          action: 'Logger 1 seul repas aujourd\'hui',
          timing: 'Aujourd\'hui',
          priority: 'high',
        },
        {
          action: 'Boire de l\'eau régulièrement',
          timing: 'Toute la journée',
          priority: 'medium',
        },
        {
          action: 'Demain on en reparle',
          timing: 'Demain',
          priority: 'low',
        },
      ],
      expectedOutcome: 'Reprendre en douceur, sans pression',
    }
  }

  private generateId(): string {
    return `resp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}

// Export singleton
export const conversationResponseService = new ConversationResponseService()
