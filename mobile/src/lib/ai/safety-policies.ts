/**
 * Safety Policies for LymIA
 *
 * Defines health safety guardrails and citation validation.
 * These policies are injected into prompts and used for post-processing.
 *
 * Key concerns:
 * 1. Health safety (TCA, pregnancy, medical conditions)
 * 2. Citation validation (prevent hallucinated sources)
 * 3. Scope boundaries (redirect out-of-scope queries)
 */

// ============= HEALTH SAFETY FLAGS =============

/**
 * Keywords that trigger health safety warnings
 * When detected, LymIA must redirect to a healthcare professional
 */
export const HEALTH_RED_FLAGS = {
  // Eating Disorders (TCA)
  eatingDisorders: [
    'anorexie', 'anorexique', 'boulimie', 'boulimique',
    'hyperphagie', 'vomissement', 'purge', 'laxatif',
    'restriction extrême', 'jeuner', 'jeûne prolongé',
    'obsession nourriture', 'peur de manger', 'peur de grossir',
    'calories obsession', 'binge', 'crises alimentaires',
  ],

  // Medical Conditions
  medicalConditions: [
    'diabète', 'diabétique', 'insuline', 'glycémie',
    'maladie rénale', 'insuffisance rénale', 'dialyse',
    'maladie cardiaque', 'infarctus', 'avc',
    'cancer', 'chimiothérapie', 'radiothérapie',
    'maladie auto-immune', 'crohn', 'rectocolite',
    'hypothyroïdie', 'hyperthyroïdie',
    'syndrome métabolique',
  ],

  // Pregnancy & Breastfeeding
  pregnancy: [
    'enceinte', 'grossesse', 'trimestre',
    'allaitement', 'allaitante', 'allaiter',
    'bébé', 'nourrisson', 'post-partum',
  ],

  // Medications
  medications: [
    'médicament', 'traitement médical', 'ordonnance',
    'antidépresseur', 'anxiolytique', 'corticoïdes',
    'chimiothérapie', 'immunosuppresseur',
    'anticoagulant', 'metformine',
  ],

  // Mental Health Concerns
  mentalHealth: [
    'dépression', 'dépressif', 'anxiété sévère',
    'trouble obsessionnel', 'toc alimentaire',
    'automutilation', 'suicidaire', 'pensées noires',
  ],

  // Extreme Behaviors
  extremeBehaviors: [
    'jeûne 7 jours', 'jeûne semaine', 'ne rien manger',
    '500 calories', '800 calories', 'régime extreme',
    'perte rapide', 'perdre 10kg en 1 mois',
    'coupe-faim', 'brûleur de graisse',
  ],
}

/**
 * Check if text contains health red flags
 */
export function detectHealthRedFlags(text: string): {
  hasRedFlags: boolean
  categories: string[]
  flags: string[]
} {
  const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const detectedCategories: string[] = []
  const detectedFlags: string[] = []

  for (const [category, keywords] of Object.entries(HEALTH_RED_FLAGS)) {
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (normalizedText.includes(normalizedKeyword)) {
        if (!detectedCategories.includes(category)) {
          detectedCategories.push(category)
        }
        detectedFlags.push(keyword)
      }
    }
  }

  return {
    hasRedFlags: detectedCategories.length > 0,
    categories: detectedCategories,
    flags: detectedFlags,
  }
}

/**
 * Generate safety redirect message based on detected flags
 */
export function generateSafetyRedirect(categories: string[]): string {
  const messages: Record<string, string> = {
    eatingDisorders: 'Je détecte que tu traverses peut-être une période difficile avec ton alimentation. Ce sujet dépasse mes compétences de coach nutrition. Je t\'encourage à en parler avec un professionnel de santé spécialisé (médecin, psychologue, diététicien formé aux TCA).',
    medicalConditions: 'Ta situation de santé nécessite un suivi médical personnalisé. Je ne peux pas te conseiller sans que ton médecin valide les recommandations. Consulte ton médecin traitant ou un diététicien-nutritionniste.',
    pregnancy: 'Pendant la grossesse ou l\'allaitement, les besoins nutritionnels sont très spécifiques. Je te recommande de consulter une sage-femme, ton médecin ou un diététicien spécialisé en périnatalité.',
    medications: 'Certains médicaments interagissent avec l\'alimentation. Parle de tes objectifs nutritionnels à ton médecin ou pharmacien pour des conseils adaptés.',
    mentalHealth: 'Ce que tu décris semble dépasser le cadre de la nutrition. Ta santé mentale est importante. N\'hésite pas à consulter un professionnel de santé (médecin, psychologue). Tu peux aussi appeler le 3114 (numéro national de prévention du suicide) si tu as des pensées difficiles.',
    extremeBehaviors: 'Les approches extrêmes sont contre-productives et potentiellement dangereuses. Je te conseille des changements progressifs et durables. Consulte un professionnel si tu ressens le besoin de perdre beaucoup de poids rapidement.',
  }

  const relevantMessages = categories.map(cat => messages[cat]).filter(Boolean)

  if (relevantMessages.length === 0) {
    return 'Cette question dépasse mon domaine d\'expertise. Je te recommande de consulter un professionnel de santé.'
  }

  return relevantMessages[0] // Return most relevant message
}

// ============= SAFETY POLICY PROMPT =============

/**
 * Safety policy to inject in system prompts
 * This is the "Policy prompt" layer above all tasks
 */
export const SAFETY_POLICY_PROMPT = `
POLITIQUE DE SÉCURITÉ SANTÉ (PRIORITÉ ABSOLUE):

1. DRAPEAUX ROUGES - Si l'utilisateur mentionne:
   - Troubles alimentaires (anorexie, boulimie, hyperphagie, purge)
   - Grossesse ou allaitement
   - Pathologies (diabète, maladies rénales/cardiaques, cancer)
   - Médicaments spécifiques
   - Détresse psychologique
   → STOP: Ne pas donner de conseils nutritionnels
   → REDIRIGER vers un professionnel de santé de manière bienveillante
   → FOURNIR le numéro 3114 si détresse mentale mentionnée

2. LIMITES STRICTES:
   - JAMAIS de diagnostic médical
   - JAMAIS de conseils si pathologie non stabilisée
   - JAMAIS encourager un déficit > 500 kcal/jour
   - JAMAIS suggérer un régime < 1200 kcal (femmes) ou < 1500 kcal (hommes)
   - JAMAIS promettre de résultats (perte de poids, gain musculaire)

3. FORMULATIONS OBLIGATOIRES:
   - "Les recommandations ANSES/EFSA indiquent..." (pas "tu dois")
   - "D'après les études..." (pas "c'est prouvé que")
   - "Consulte un professionnel si..." (systématique sur sujets sensibles)

4. SCOPE AUTORISÉ:
   ✓ Nutrition générale (adultes en bonne santé)
   ✓ Bien-être (sommeil, stress, hydratation)
   ✓ Sport et récupération (amateur)
   ✓ Comportement alimentaire (sans pathologie)
   ✗ Prescriptions médicales
   ✗ Compléments alimentaires thérapeutiques
   ✗ Régimes pour pathologies
`

// ============= CITATION VALIDATION =============

/**
 * Interface for RAG source tracking
 */
export interface RAGSource {
  id: string
  content: string
  source: 'anses' | 'ciqual' | 'inserm' | 'has' | 'pubmed' | 'expert' | 'oms'
  url?: string
}

/**
 * Citation in AI response
 */
export interface Citation {
  sourceId: string
  sourceType: string
  quote?: string
}

/**
 * Validate that citations in AI response match provided sources
 */
export function validateCitations(
  responseText: string,
  providedSources: RAGSource[]
): {
  isValid: boolean
  validCitations: number[]
  invalidCitations: number[]
  missingCitations: boolean
  warnings: string[]
} {
  const warnings: string[] = []
  const validCitations: number[] = []
  const invalidCitations: number[] = []

  // Extract citation numbers from response [1], [2], etc.
  const citationPattern = /\[(\d+)\]/g
  const matches = responseText.matchAll(citationPattern)
  const usedCitations = new Set<number>()

  for (const match of matches) {
    const citationNum = parseInt(match[1], 10)
    usedCitations.add(citationNum)

    // Check if citation corresponds to a provided source
    if (citationNum >= 1 && citationNum <= providedSources.length) {
      validCitations.push(citationNum)
    } else {
      invalidCitations.push(citationNum)
      warnings.push(`Citation [${citationNum}] doesn't match any provided source`)
    }
  }

  // Check if any nutritional/health claim lacks citation
  const healthClaimPatterns = [
    /recommand[ée]s?/i,
    /les études (montrent|indiquent)/i,
    /scientifiquement prouvé/i,
    /l'ANSES (recommande|conseille)/i,
    /selon l'OMS/i,
    /d'après l'INSERM/i,
    /\d+g?.*(par jour|quotidien)/i, // "30g par jour" type claims
  ]

  const hasMissingCitations = healthClaimPatterns.some(pattern => {
    const matches = responseText.match(pattern)
    if (matches) {
      // Check if there's a citation nearby
      const matchIndex = responseText.indexOf(matches[0])
      const nearbyText = responseText.slice(Math.max(0, matchIndex - 50), matchIndex + matches[0].length + 20)
      return !nearbyText.includes('[')
    }
    return false
  })

  if (hasMissingCitations) {
    warnings.push('Health/nutrition claim detected without citation')
  }

  return {
    isValid: invalidCitations.length === 0 && !hasMissingCitations,
    validCitations: [...new Set(validCitations)],
    invalidCitations: [...new Set(invalidCitations)],
    missingCitations: hasMissingCitations,
    warnings,
  }
}

/**
 * Format sources for injection into prompts with trackable IDs
 */
export function formatSourcesForPrompt(sources: RAGSource[]): string {
  if (sources.length === 0) {
    return '[Aucune source RAG - utiliser connaissances de base ANSES avec mention explicite]'
  }

  return `SOURCES SCIENTIFIQUES VÉRIFIÉES (IDs à citer obligatoirement):
${sources.map((s, i) => `[${i + 1}] (ID: ${s.id}) (${s.source.toUpperCase()}) ${s.content}`).join('\n\n')}

RÈGLES DE CITATION:
- Tu DOIS utiliser [numéro] pour citer ces sources
- CHAQUE affirmation nutritionnelle/santé DOIT avoir une citation
- Tu NE PEUX PAS inventer de sources ou citations
- Si tu n'as pas de source pour une affirmation, écris "selon les recommandations générales" (sans numéro)`
}

// ============= RESPONSE POST-PROCESSOR =============

/**
 * Post-process AI response for safety and citation validation
 */
export function postProcessResponse(
  response: string,
  userInput: string,
  providedSources: RAGSource[]
): {
  safeResponse: string
  wasModified: boolean
  safetyIntervention: boolean
  citationWarnings: string[]
  confidence: 'high' | 'medium' | 'low'
} {
  let safeResponse = response
  let wasModified = false
  let safetyIntervention = false

  // 1. Check for health red flags in user input
  const redFlagCheck = detectHealthRedFlags(userInput)
  if (redFlagCheck.hasRedFlags) {
    safetyIntervention = true
    const safetyMessage = generateSafetyRedirect(redFlagCheck.categories)

    // Prepend safety message to response
    safeResponse = `⚠️ **Note importante**\n\n${safetyMessage}\n\n---\n\n${response}`
    wasModified = true
  }

  // 2. Validate citations
  const citationCheck = validateCitations(response, providedSources)

  // 3. Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'high'

  if (providedSources.length === 0) {
    confidence = 'medium'
  }

  if (!citationCheck.isValid) {
    confidence = 'low'
  }

  if (safetyIntervention) {
    confidence = 'low'
  }

  return {
    safeResponse,
    wasModified,
    safetyIntervention,
    citationWarnings: citationCheck.warnings,
    confidence,
  }
}

// ============= EXPORTS =============

export const SafetyPolicies = {
  HEALTH_RED_FLAGS,
  SAFETY_POLICY_PROMPT,
  detectHealthRedFlags,
  generateSafetyRedirect,
  validateCitations,
  formatSourcesForPrompt,
  postProcessResponse,
}

export default SafetyPolicies
