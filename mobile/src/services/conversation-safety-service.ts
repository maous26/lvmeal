/**
 * Conversation Safety Service - Policy Guard (Recommendation #3)
 *
 * Protects against:
 * - Dangerous medical advice
 * - Eating disorder triggers
 * - Inappropriate recommendations for special populations
 * - LLM hallucinations on health topics
 *
 * "Le LLM ne décide pas. Il rédige et clarifie."
 */

import {
  SafetyFlag,
  SafetyCheckResult,
  ConversationContextFull,
  ConversationResponse,
} from '../types/conversation'

// ============================================================================
// SAFETY PATTERNS
// ============================================================================

/**
 * Patterns that indicate potential eating disorders
 */
const TCA_PATTERNS = [
  /je (me fais|vais me faire) vomir/i,
  /purger?/i,
  /laxatif/i,
  /je (mange|ai mangé) (rien|pas|0)/i,
  /je (jeûne|fais un jeûne) depuis (plus de )?\d+ jours?/i,
  /500 (cal|kcal|calories)( max| par jour)?/i,
  /moins de 800 (cal|kcal)/i,
  /je me (déteste|hais) quand je mange/i,
  /binge|boulimie|anorexie/i,
  /je (dois|veux) perdre \d+ kg (en|cette) semaine/i,
]

/**
 * Patterns requesting medical advice
 */
const MEDICAL_PATTERNS = [
  /mon (médecin|docteur|diabét)/i,
  /mes (médicaments?|traitements?)/i,
  /insuline/i,
  /glycémie/i,
  /tension artérielle/i,
  /cholestérol/i,
  /allergie.{0,20}(grave|sévère|anaphylact)/i,
  /enceinte|grossesse/i,
  /allaite|allaitement/i,
]

/**
 * Patterns indicating user might be a minor
 */
const MINOR_PATTERNS = [
  /j'?ai (\d|1[0-7]) ans/i,
  /je suis (au collège|au lycée|en (6|5|4|3|2|1|terminale))/i,
  /mes parents/i,
]

/**
 * Patterns indicating extreme restriction
 */
const EXTREME_RESTRICTION_PATTERNS = [
  /je (ne mange|mange) (que|plus que) (des |de la )?(pommes?|salade|soupe)/i,
  /régime (militaire|cambridge|hollywood)/i,
  /detox (7|14|21|30) jours/i,
  /coupe(-| )faim/i,
]

/**
 * Self-harm signals
 */
const SELF_HARM_PATTERNS = [
  /je (veux|voudrais) (mourir|disparaître|en finir)/i,
  /je (me fais|me suis fait) du mal/i,
  /suicide|suicidaire/i,
  /plus envie de vivre/i,
]

// ============================================================================
// SAFETY SERVICE
// ============================================================================

class ConversationSafetyService {
  /**
   * Check input message for safety concerns
   */
  checkInput(message: string, context: ConversationContextFull): SafetyCheckResult {
    const flags: SafetyFlag[] = []

    // Check all pattern categories
    if (this.matchesPatterns(message, TCA_PATTERNS)) {
      flags.push('POTENTIAL_TCA')
    }

    if (this.matchesPatterns(message, MEDICAL_PATTERNS)) {
      flags.push('MEDICAL_ADVICE_REQUEST')
    }

    if (this.matchesPatterns(message, MINOR_PATTERNS)) {
      flags.push('MINOR_USER')
    }

    if (this.matchesPatterns(message, EXTREME_RESTRICTION_PATTERNS)) {
      flags.push('EXTREME_RESTRICTION')
    }

    if (this.matchesPatterns(message, SELF_HARM_PATTERNS)) {
      flags.push('SELF_HARM_SIGNAL')
    }

    // Check for pregnancy mention
    if (/enceinte|grossesse|bébé à venir/i.test(message)) {
      flags.push('PREGNANCY_MENTION')
    }

    // Check for diabetes
    if (/diabèt|diabétique|glycémie/i.test(message)) {
      flags.push('DIABETES_MENTION')
    }

    // Check for allergies
    if (/allergi(e|que)|intoléran/i.test(message)) {
      flags.push('ALLERGY_MENTION')
    }

    // Determine action based on flags
    return this.determineAction(flags)
  }

  /**
   * Validate response before sending to user
   */
  validateResponse(response: ConversationResponse, context: ConversationContextFull): ConversationResponse {
    let validatedResponse = { ...response }

    // Add disclaimer for nutrition advice
    if (this.containsNutritionAdvice(response.message.text)) {
      validatedResponse = {
        ...validatedResponse,
        disclaimer: this.getStandardDisclaimer(context),
      }
    }

    // Check for potentially harmful content in response
    const responseFlags = this.checkResponseContent(response.message.text)
    if (responseFlags.length > 0) {
      // Rewrite response to be safer
      validatedResponse = this.safeRewriteResponse(validatedResponse, responseFlags)
    }

    return validatedResponse
  }

  /**
   * Get appropriate redirect message for safety concerns
   */
  getRedirectMessage(flags: SafetyFlag[]): string {
    if (flags.includes('SELF_HARM_SIGNAL')) {
      return `Je sens que tu traverses un moment vraiment difficile. Ce que tu ressens est important, et tu mérites d'être écouté(e) par quelqu'un qui peut vraiment t'aider.

📞 **SOS Amitié** : 09 72 39 40 50 (24h/24)
📞 **Fil Santé Jeunes** : 0 800 235 236 (gratuit)

Je suis là pour t'accompagner dans ton alimentation, mais pour ce que tu vis, parler à un professionnel serait vraiment précieux. 💙`
    }

    if (flags.includes('POTENTIAL_TCA')) {
      return `Je remarque que ton rapport à l'alimentation te préoccupe beaucoup. C'est courageux d'en parler.

LYM peut t'aider à mieux manger au quotidien, mais si tu ressens un mal-être profond lié à la nourriture, un accompagnement spécialisé pourrait vraiment t'aider.

📞 **Anorexie Boulimie Info Écoute** : 0 810 037 037
🌐 **ffab.fr** - Fédération Française Anorexie Boulimie

En attendant, je reste disponible pour t'accompagner avec bienveillance. 💚`
    }

    if (flags.includes('MEDICAL_ADVICE_REQUEST') || flags.includes('DIABETES_MENTION')) {
      return `Ta santé est importante et mérite un suivi médical adapté. Je ne suis pas en mesure de te donner des conseils médicaux - c'est le rôle de ton médecin ou d'un diététicien-nutritionniste.

Je peux t'aider à :
• Suivre ton alimentation au quotidien
• Te proposer des idées de repas équilibrés
• T'accompagner dans tes objectifs bien-être

Mais pour tout ce qui touche à ta condition médicale, parles-en à ton professionnel de santé. 🩺`
    }

    if (flags.includes('PREGNANCY_MENTION')) {
      return `Félicitations si tu attends un bébé ! 🎉

L'alimentation pendant la grossesse est très spécifique et je préfère te rediriger vers ton médecin ou ta sage-femme pour des conseils adaptés à ta situation.

Je peux continuer à t'aider pour des questions générales sur l'alimentation, mais les recommandations pendant la grossesse doivent venir d'un professionnel de santé.`
    }

    if (flags.includes('EXTREME_RESTRICTION')) {
      return `Je comprends ton envie d'atteindre tes objectifs rapidement, mais les régimes très restrictifs peuvent être dangereux pour ta santé et souvent contre-productifs sur le long terme.

LYM t'accompagne vers une alimentation équilibrée et durable. On y va progressivement, mais on y va ensemble. 💪

Tu veux qu'on regarde comment atteindre tes objectifs de façon saine ?`
    }

    if (flags.includes('MINOR_USER')) {
      return `L'alimentation des adolescents a des besoins spécifiques liés à la croissance. Je peux t'aider avec des conseils généraux, mais pour des objectifs de perte de poids, il vaut mieux en parler avec tes parents et un médecin.

En attendant, je peux t'aider à :
• Mieux comprendre l'équilibre alimentaire
• Te donner des idées de repas sains
• Répondre à tes questions sur la nutrition`
    }

    // Default
    return `Je préfère te rediriger vers un professionnel de santé pour cette question. Je peux t'aider sur d'autres aspects de ton alimentation. 😊`
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text))
  }

  private determineAction(flags: SafetyFlag[]): SafetyCheckResult {
    // Critical flags - refuse and redirect
    const criticalFlags: SafetyFlag[] = ['SELF_HARM_SIGNAL', 'POTENTIAL_TCA']
    if (flags.some(f => criticalFlags.includes(f))) {
      return {
        isAllowed: false,
        flags,
        action: 'refuse_redirect',
        redirectMessage: this.getRedirectMessage(flags),
      }
    }

    // Medical flags - allow with strong disclaimer
    const medicalFlags: SafetyFlag[] = ['MEDICAL_ADVICE_REQUEST', 'DIABETES_MENTION', 'PREGNANCY_MENTION']
    if (flags.some(f => medicalFlags.includes(f))) {
      return {
        isAllowed: false,
        flags,
        action: 'refuse_redirect',
        redirectMessage: this.getRedirectMessage(flags),
      }
    }

    // Warning flags - allow with disclaimer
    const warningFlags: SafetyFlag[] = ['EXTREME_RESTRICTION', 'MINOR_USER', 'ALLERGY_MENTION']
    if (flags.some(f => warningFlags.includes(f))) {
      return {
        isAllowed: true,
        flags,
        action: 'safe_rewrite',
        disclaimer: this.getDisclaimerForFlags(flags),
      }
    }

    // No flags - allow
    return {
      isAllowed: true,
      flags: [],
      action: 'allow',
    }
  }

  private getDisclaimerForFlags(flags: SafetyFlag[]): string {
    if (flags.includes('ALLERGY_MENTION')) {
      return '⚠️ Vérifie toujours les ingrédients pour tes allergies.'
    }

    if (flags.includes('MINOR_USER')) {
      return '💡 Les conseils sont généraux. Parle à un adulte pour des objectifs spécifiques.'
    }

    return ''
  }

  private containsNutritionAdvice(text: string): boolean {
    const advicePatterns = [
      /tu (devrais|pourrais|peux) (manger|consommer|prendre)/i,
      /je te (conseille|recommande|suggère)/i,
      /il (faut|faudrait) que tu/i,
      /évite|privilégie|préfère/i,
    ]
    return advicePatterns.some(p => p.test(text))
  }

  private checkResponseContent(text: string): SafetyFlag[] {
    const flags: SafetyFlag[] = []

    // Check if response contains potentially dangerous advice
    const dangerousPatterns = [
      /moins de 1[02]00 (cal|kcal)/i,
      /jeûne prolongé/i,
      /régime (très )?(strict|sévère)/i,
    ]

    if (dangerousPatterns.some(p => p.test(text))) {
      flags.push('EXTREME_RESTRICTION')
    }

    return flags
  }

  /**
   * Check if text contains moralizing/judgmental language that should be avoided
   * SAFETY UX: Never guilt-trip, never moralize
   */
  containsMoralizingLanguage(text: string): boolean {
    const moralizingPatterns = [
      /tu (as|aurais) (trop|pas assez)/i,
      /c'est (mal|pas bien|mauvais) de/i,
      /tu (devrais|aurais dû) (pas|éviter)/i,
      /tu n'aurais pas dû/i,
      /c'est (de )?ta faute/i,
      /tu (as|t'es) fait (du mal|une erreur)/i,
      /honte|culpabilité/i,
      /tu (triches|craques)/i,
      /fais un effort/i,
      /tu manques de (volonté|discipline)/i,
      /c'est pas sérieux/i,
    ]
    return moralizingPatterns.some(p => p.test(text))
  }

  /**
   * Rewrite moralizing text to be more empathetic
   * SAFETY UX: Transform judgmental phrases into supportive ones
   */
  rewriteMoralizingText(text: string): string {
    const replacements: [RegExp, string][] = [
      [/tu as trop mangé/gi, "c'était un repas copieux"],
      [/tu n'aurais pas dû manger ça/gi, "ce repas était plus calorique que prévu"],
      [/tu as craqué/gi, "tu t'es fait plaisir"],
      [/tu as fait une erreur/gi, "c'est une occasion d'apprendre"],
      [/tu (devrais|aurais dû) pas/gi, "la prochaine fois, tu pourrais"],
      [/c'est (mal|pas bien)/gi, "ce n'est pas idéal mais"],
      [/fais un effort/gi, "tu peux essayer"],
      [/tu manques de volonté/gi, "c'est un défi"],
    ]

    let result = text
    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement)
    }
    return result
  }

  private safeRewriteResponse(response: ConversationResponse, flags: SafetyFlag[]): ConversationResponse {
    let messageText = response.message.text

    // SAFETY UX: Check and rewrite moralizing language
    if (this.containsMoralizingLanguage(messageText)) {
      messageText = this.rewriteMoralizingText(messageText)
    }

    // Add disclaimer for flagged content
    return {
      ...response,
      message: {
        ...response.message,
        text: messageText,
      },
      disclaimer: `⚠️ Ces conseils sont généraux. Consulte un professionnel de santé pour un accompagnement personnalisé.`,
    }
  }

  private getStandardDisclaimer(context: ConversationContextFull): string {
    // Only show disclaimer occasionally to avoid fatigue
    if (Math.random() > 0.3) return ''

    return '💡 Ces conseils sont personnalisés selon tes données, mais ne remplacent pas l\'avis d\'un professionnel de santé.'
  }
}

  // ============================================================================
  // LOG ANONYMIZATION (for analytics/debugging)
  // ============================================================================

  /**
   * Anonymize message content for logging/analytics
   * Removes PII while preserving intent detection capability
   */
  anonymizeForLog(message: string): string {
    let anonymized = message

    // Remove names (common French first names pattern)
    anonymized = anonymized.replace(
      /\b(je m'appelle |moi c'est |c'est )?[A-Z][a-zéèêëàâäùûüôöîïç]+\b/g,
      '[PRENOM]'
    )

    // Remove phone numbers
    anonymized = anonymized.replace(
      /(\+33|0)\s*[1-9](\s*\d{2}){4}/g,
      '[TEL]'
    )

    // Remove emails
    anonymized = anonymized.replace(
      /[\w.-]+@[\w.-]+\.\w+/g,
      '[EMAIL]'
    )

    // Remove specific weights/measurements
    anonymized = anonymized.replace(
      /\b\d{2,3}\s*(kg|kilos?|livres?)\b/gi,
      '[POIDS]'
    )

    // Remove ages
    anonymized = anonymized.replace(
      /\b(j'ai |je fais )\d{1,3}\s*(ans?|kg)\b/gi,
      '[INFO_PERSO]'
    )

    // Remove addresses
    anonymized = anonymized.replace(
      /\d+\s+(rue|avenue|boulevard|allée|place)\s+[A-Za-zéèêëàâäùûüôöîïç\s]+/gi,
      '[ADRESSE]'
    )

    return anonymized
  }

  /**
   * Create anonymized analytics event for conversation
   */
  createAnonymizedEvent(
    eventType: 'message_sent' | 'intent_detected' | 'action_taken' | 'safety_flag',
    data: {
      intent?: string
      confidence?: number
      safetyFlags?: SafetyFlag[]
      actionType?: string
      processingTimeMs?: number
    }
  ): Record<string, unknown> {
    return {
      event: `conversation_${eventType}`,
      timestamp: new Date().toISOString(),
      // Only include non-PII data
      intent: data.intent,
      confidence: data.confidence ? Math.round(data.confidence * 100) / 100 : undefined,
      safetyFlags: data.safetyFlags,
      actionType: data.actionType,
      processingTimeMs: data.processingTimeMs,
      // Session info (no user ID)
      sessionId: this.getSessionId(),
    }
  }

  private sessionId: string | null = null

  private getSessionId(): string {
    if (!this.sessionId) {
      // Generate anonymous session ID (not linked to user)
      this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
    return this.sessionId
  }

  /**
   * Reset session (call on app restart or logout)
   */
  resetSession(): void {
    this.sessionId = null
  }
}

// Export singleton
export const conversationSafetyService = new ConversationSafetyService()
