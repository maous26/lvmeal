/**
 * LYM AI Prompt System - Centralized Prompt Engineering
 *
 * Architecture de prompts optimisée pour RAG + DSPy:
 * 1. System Prompts: Définissent le persona et les règles globales
 * 2. Task Prompts: Instructions spécifiques par fonctionnalité
 * 3. RAG Context Templates: Format d'injection des sources
 * 4. Output Schemas: Formats JSON stricts pour parsing fiable
 *
 * Best Practices appliquées:
 * - Chain-of-Thought (CoT) pour raisonnement complexe
 * - Few-shot examples pour cohérence
 * - Structured outputs avec JSON schemas
 * - Citations obligatoires depuis RAG
 * - Fallback gracieux si RAG indisponible
 */

// ============= CORE PERSONA =============

/**
 * LymIA Core Identity - Used in all prompts
 */
export const LYMIA_PERSONA = {
  name: 'LymIA',
  role: 'Coach nutrition et bien-être personnalisé',
  tone: 'Bienveillant, expert, encourageant, jamais culpabilisant',
  language: 'Français courant (pas soutenu), tutoiement',
  expertise: [
    'Nutrition basée sur les recommandations ANSES/EFSA',
    'Bien-être et gestion du stress (MBSR, cohérence cardiaque)',
    'Comportement alimentaire et psychologie',
    'Sport et récupération',
  ],
} as const

/**
 * System prompt de base pour toutes les interactions LymIA
 */
export const LYMIA_SYSTEM_PROMPT = `Tu es ${LYMIA_PERSONA.name}, ${LYMIA_PERSONA.role}.

IDENTITÉ:
- Ton: ${LYMIA_PERSONA.tone}
- Style: ${LYMIA_PERSONA.language}
- Tu DOIS toujours citer tes sources quand tu donnes des conseils nutritionnels

EXPERTISE:
${LYMIA_PERSONA.expertise.map(e => `- ${e}`).join('\n')}

RÈGLES ABSOLUES:
1. JAMAIS de conseil médical - renvoyer vers un professionnel de santé
2. TOUJOURS personnaliser selon le profil utilisateur
3. CITER les sources scientifiques (ANSES, EFSA, OMS, INSERM)
4. ENCOURAGER sans culpabiliser
5. Réponses CONCISES (max 3-4 phrases sauf si demandé autrement)
6. Format Markdown pour la lisibilité`

// ============= RAG CONTEXT TEMPLATES =============

/**
 * Template pour injecter le contexte RAG dans les prompts
 */
export const RAG_CONTEXT_TEMPLATE = (sources: Array<{ content: string; source: string; relevance?: number }>) => {
  if (!sources || sources.length === 0) {
    return `[Aucune source RAG disponible - utiliser les connaissances de base ANSES]`
  }

  return `SOURCES SCIENTIFIQUES (à citer obligatoirement):
${sources.map((s, i) => `[${i + 1}] (${s.source.toUpperCase()}) ${s.content}`).join('\n\n')}

INSTRUCTION: Tu DOIS baser ta réponse sur ces sources et les citer avec [numéro].`
}

/**
 * Template pour le contexte utilisateur
 */
export const USER_CONTEXT_TEMPLATE = (profile: {
  age?: number
  gender?: string
  weight?: number
  height?: number
  goal?: string
  activityLevel?: string
  dietType?: string
  allergies?: string[]
  metabolismProfile?: string
}) => `PROFIL UTILISATEUR:
- Âge: ${profile.age || 'non renseigné'} ans
- Sexe: ${profile.gender === 'female' ? 'Femme' : profile.gender === 'male' ? 'Homme' : 'non renseigné'}
- Poids: ${profile.weight || 'non renseigné'} kg
- Taille: ${profile.height || 'non renseigné'} cm
- Objectif: ${formatGoal(profile.goal)}
- Activité: ${formatActivityLevel(profile.activityLevel)}
- Régime: ${profile.dietType || 'omnivore'}
${profile.allergies?.length ? `- Allergies/Intolérances: ${profile.allergies.join(', ')}` : ''}
${profile.metabolismProfile === 'adaptive' ? '- ⚠️ Métabolisme adaptatif (historique de régimes)' : ''}`

/**
 * Template pour les données wellness
 */
export const WELLNESS_CONTEXT_TEMPLATE = (data: {
  sleepHours?: number
  sleepQuality?: number
  stressLevel?: number
  energyLevel?: number
  hydration?: number
}) => {
  const items: string[] = []

  if (data.sleepHours !== undefined) {
    const sleepStatus = data.sleepHours < 6 ? '⚠️ insuffisant' : data.sleepHours >= 7 ? '✓ bon' : 'moyen'
    items.push(`- Sommeil: ${data.sleepHours}h (${sleepStatus})`)
  }
  if (data.sleepQuality !== undefined) {
    items.push(`- Qualité sommeil: ${data.sleepQuality}/5`)
  }
  if (data.stressLevel !== undefined) {
    const stressStatus = data.stressLevel >= 4 ? '⚠️ élevé' : data.stressLevel <= 2 ? '✓ faible' : 'modéré'
    items.push(`- Stress: ${data.stressLevel}/5 (${stressStatus})`)
  }
  if (data.energyLevel !== undefined) {
    items.push(`- Énergie: ${data.energyLevel}/5`)
  }
  if (data.hydration !== undefined) {
    items.push(`- Hydratation: ${data.hydration}L`)
  }

  return items.length > 0 ? `DONNÉES BIEN-ÊTRE:\n${items.join('\n')}` : ''
}

// ============= TASK-SPECIFIC PROMPTS =============

/**
 * Calcul des besoins nutritionnels personnalisés
 */
export const NUTRITION_CALCULATION_PROMPT = {
  system: LYMIA_SYSTEM_PROMPT,

  task: (context: {
    profile: Parameters<typeof USER_CONTEXT_TEMPLATE>[0]
    wellness?: Parameters<typeof WELLNESS_CONTEXT_TEMPLATE>[0]
    weeklyAverage?: { calories: number; proteins: number; carbs: number; fats: number }
    ragSources?: Array<{ content: string; source: string }>
  }) => `${USER_CONTEXT_TEMPLATE(context.profile)}

${context.wellness ? WELLNESS_CONTEXT_TEMPLATE(context.wellness) : ''}

${context.weeklyAverage ? `CONSOMMATION MOYENNE (7 derniers jours):
- Calories: ${context.weeklyAverage.calories} kcal/jour
- Protéines: ${context.weeklyAverage.proteins}g
- Glucides: ${context.weeklyAverage.carbs}g
- Lipides: ${context.weeklyAverage.fats}g` : ''}

${RAG_CONTEXT_TEMPLATE(context.ragSources || [])}

RÉFÉRENCES ANSES (si pas de sources RAG):
- Protéines: 0.83g/kg min, 1.2-2.0g/kg si sportif/perte poids
- Glucides: 40-55% AET
- Lipides: 35-40% AET
- Fibres: 30g/jour

TÂCHE: Calcule les besoins nutritionnels optimaux.

RAISONNEMENT (Chain-of-Thought):
1. Calcul MB (Mifflin-St Jeor): 10×poids + 6.25×taille - 5×âge + (5 si H, -161 si F)
2. TDEE = MB × multiplicateur activité
3. Ajustement selon objectif (-400 perte, +300 muscle)
4. Répartition macros selon objectif et sources RAG

Réponds en JSON:`,

  outputSchema: {
    calories: 'number - Calories quotidiennes recommandées',
    proteins: 'number - Protéines en grammes',
    carbs: 'number - Glucides en grammes',
    fats: 'number - Lipides en grammes',
    proteinRatio: 'number - % des AET',
    carbsRatio: 'number - % des AET',
    fatsRatio: 'number - % des AET',
    reasoning: 'string - Explication en 2-3 phrases avec citations [n]',
    adjustments: 'string[] - Liste des ajustements appliqués',
    confidence: 'number - 0-1, plus élevé si basé sur RAG',
  },
}

/**
 * Recommandations de repas intelligentes
 */
export const MEAL_RECOMMENDATION_PROMPT = {
  system: LYMIA_SYSTEM_PROMPT,

  task: (context: {
    mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
    targetCalories: number
    targetMacros: { proteins: number; carbs: number; fats: number }
    profile: Parameters<typeof USER_CONTEXT_TEMPLATE>[0]
    recentMeals?: string[]
    ragSources?: Array<{ content: string; source: string }>
    timeAvailable?: number
  }) => {
    const mealTypeNames = {
      breakfast: 'Petit-déjeuner',
      lunch: 'Déjeuner',
      snack: 'Collation',
      dinner: 'Dîner',
    }

    const mealGuidelines = {
      breakfast: 'Énergie pour la journée. Protéines + glucides complexes. Éviter sucres rapides.',
      lunch: 'Repas principal équilibré. Portion généreuse protéines + légumes + féculents.',
      snack: 'Léger (100-200 kcal). Protéines + fibres. Éviter ultra-transformé.',
      dinner: 'Plus léger. Légumes + protéines légères. Éviter féculents lourds.',
    }

    return `${USER_CONTEXT_TEMPLATE(context.profile)}

REPAS À PLANIFIER: ${mealTypeNames[context.mealType]}
- Objectif calorique: ${context.targetCalories} kcal
- Macros cibles: P:${context.targetMacros.proteins}g / G:${context.targetMacros.carbs}g / L:${context.targetMacros.fats}g
${context.timeAvailable ? `- Temps disponible: ${context.timeAvailable} min` : ''}

GUIDE ${mealTypeNames[context.mealType].toUpperCase()}:
${mealGuidelines[context.mealType]}

${context.recentMeals?.length ? `REPAS RÉCENTS (éviter répétition):
${context.recentMeals.slice(0, 5).map(m => `- ${m}`).join('\n')}` : ''}

${RAG_CONTEXT_TEMPLATE(context.ragSources || [])}

TÂCHE: Suggère 3 options de repas variées et équilibrées.

Réponds en JSON:`
  },

  outputSchema: {
    suggestions: [{
      name: 'string - Nom appétissant du plat',
      description: 'string - Description courte (1 phrase)',
      calories: 'number',
      proteins: 'number',
      carbs: 'number',
      fats: 'number',
      prepTime: 'number - Minutes de préparation',
      ingredients: 'string[] - Liste simplifiée',
      reason: 'string - Pourquoi ce plat est adapté',
    }],
    reasoning: 'string - Logique de sélection',
  },
}

/**
 * Conseil coaching personnalisé
 */
export const COACHING_ADVICE_PROMPT = {
  system: LYMIA_SYSTEM_PROMPT,

  task: (context: {
    situation: 'morning' | 'meal_logged' | 'goal_reached' | 'struggling' | 'end_of_day' | 'weekly_review'
    profile: Parameters<typeof USER_CONTEXT_TEMPLATE>[0]
    nutrition?: { consumed: number; target: number; remaining: number }
    wellness?: Parameters<typeof WELLNESS_CONTEXT_TEMPLATE>[0]
    streak?: number
    ragSources?: Array<{ content: string; source: string }>
  }) => {
    const situationContext = {
      morning: 'Début de journée - motivation et planification',
      meal_logged: 'Repas enregistré - feedback et encouragement',
      goal_reached: 'Objectif atteint - célébration',
      struggling: 'Difficulté détectée - soutien bienveillant',
      end_of_day: 'Fin de journée - bilan et récupération',
      weekly_review: 'Bilan hebdomadaire - analyse et ajustements',
    }

    return `${USER_CONTEXT_TEMPLATE(context.profile)}

SITUATION: ${situationContext[context.situation]}

${context.nutrition ? `NUTRITION AUJOURD'HUI:
- Consommé: ${context.nutrition.consumed} kcal
- Objectif: ${context.nutrition.target} kcal
- Restant: ${context.nutrition.remaining} kcal (${Math.round((context.nutrition.consumed / context.nutrition.target) * 100)}%)` : ''}

${context.wellness ? WELLNESS_CONTEXT_TEMPLATE(context.wellness) : ''}

${context.streak ? `🔥 Série actuelle: ${context.streak} jours` : ''}

${RAG_CONTEXT_TEMPLATE(context.ragSources || [])}

TÂCHE: Donne un conseil personnalisé adapté à la situation.

RÈGLES:
- MAX 3 phrases
- Ton encourageant, jamais culpabilisant
- Action concrète si pertinent
- Citer source si conseil nutritionnel/santé

Réponds en JSON:`
  },

  outputSchema: {
    message: 'string - Message principal (2-3 phrases max)',
    emoji: 'string - Emoji pertinent',
    actionSuggestion: 'string | null - Action concrète optionnelle',
    source: 'string | null - Source si conseil basé sur RAG',
    priority: '"high" | "medium" | "low"',
  },
}

/**
 * Analyse comportementale avec RAG
 */
export const BEHAVIOR_ANALYSIS_PROMPT = {
  system: `${LYMIA_SYSTEM_PROMPT}

EXPERTISE ADDITIONNELLE:
- Analyse de patterns comportementaux
- Corrélations nutrition/sommeil/stress/énergie
- Détection de signaux d'alerte précoces
- Recommandations basées sur l'historique`,

  task: (context: {
    profile: Parameters<typeof USER_CONTEXT_TEMPLATE>[0]
    weeklyData: {
      nutrition: Array<{ date: string; calories: number; proteins: number }>
      wellness: Array<{ date: string; sleep?: number; stress?: number; energy?: number }>
    }
    patterns?: string[]
    ragSources?: Array<{ content: string; source: string }>
  }) => `${USER_CONTEXT_TEMPLATE(context.profile)}

DONNÉES 7 DERNIERS JOURS:

Nutrition:
${context.weeklyData.nutrition.map(d => `- ${d.date}: ${d.calories} kcal, ${d.proteins}g protéines`).join('\n')}

Bien-être:
${context.weeklyData.wellness.map(d => `- ${d.date}: sommeil ${d.sleep || '?'}h, stress ${d.stress || '?'}/5, énergie ${d.energy || '?'}/5`).join('\n')}

${context.patterns?.length ? `PATTERNS DÉJÀ DÉTECTÉS:
${context.patterns.map(p => `- ${p}`).join('\n')}` : ''}

${RAG_CONTEXT_TEMPLATE(context.ragSources || [])}

TÂCHE: Analyse les corrélations et détecte les patterns comportementaux.

RAISONNEMENT:
1. Identifier les jours avec bon/mauvais sommeil
2. Corréler avec nutrition et énergie
3. Détecter les patterns récurrents
4. Proposer des ajustements basés sur les sources

Réponds en JSON:`,

  outputSchema: {
    correlations: [{
      type: 'string - Ex: "sleep_nutrition", "stress_eating"',
      description: 'string - Description de la corrélation',
      strength: 'number - Force 0-1',
      evidence: 'string - Données qui supportent',
    }],
    alerts: [{
      severity: '"info" | "warning" | "attention"',
      message: 'string',
      recommendation: 'string',
      source: 'string | null',
    }],
    insights: [{
      category: '"nutrition" | "sleep" | "stress" | "energy" | "habit"',
      title: 'string',
      message: 'string',
      actionable: 'boolean',
    }],
    summary: 'string - Résumé en 2-3 phrases',
  },
}

/**
 * Réponse aux questions utilisateur (Chat)
 */
export const CHAT_RESPONSE_PROMPT = {
  system: `${LYMIA_SYSTEM_PROMPT}

MODE CONVERSATION:
- Réponds de manière naturelle et concise
- Si la question est hors sujet (nutrition/bien-être), redirige poliment
- Pour les questions médicales, renvoie vers un professionnel
- Utilise les sources RAG pour les faits, ton expertise pour le contexte`,

  task: (context: {
    question: string
    profile: Parameters<typeof USER_CONTEXT_TEMPLATE>[0]
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    ragSources?: Array<{ content: string; source: string }>
  }) => `${USER_CONTEXT_TEMPLATE(context.profile)}

${context.conversationHistory?.length ? `HISTORIQUE CONVERSATION:
${context.conversationHistory.slice(-4).map(m => `${m.role === 'user' ? 'Utilisateur' : 'LymIA'}: ${m.content}`).join('\n')}` : ''}

${RAG_CONTEXT_TEMPLATE(context.ragSources || [])}

QUESTION UTILISATEUR: "${context.question}"

TÂCHE: Réponds de manière personnalisée et utile.

RÈGLES:
- Si question nutrition/santé: utiliser sources RAG et citer
- Si question personnelle sur l'app: répondre selon le contexte
- Si hors sujet: rediriger poliment vers nutrition/bien-être
- MAX 4 phrases sauf si explication détaillée demandée`,

  outputSchema: {
    answer: 'string - Réponse principale',
    sources: 'string[] | null - Sources citées',
    followUp: 'string | null - Question de suivi suggérée',
    category: '"nutrition" | "wellness" | "motivation" | "app" | "other"',
  },
}

/**
 * Analyse d'image alimentaire
 */
export const FOOD_ANALYSIS_PROMPT = {
  system: `Tu es un expert en analyse nutritionnelle visuelle.
Tu identifies les aliments avec précision et estimes leurs valeurs nutritionnelles.
Tu utilises la base de données CIQUAL (ANSES) pour les valeurs nutritionnelles.`,

  task: `Analyse cette image de nourriture.

TÂCHE:
1. Identifie TOUS les aliments visibles
2. Estime les portions en grammes
3. Calcule les valeurs nutritionnelles (base CIQUAL)
4. Donne un titre appétissant au plat

RÈGLES:
- Titre court et appétissant (2-5 mots)
- Confiance 0-1 pour chaque aliment
- Si doute sur un aliment, indiquer l'alternative possible
- Si pas de nourriture visible, expliquer pourquoi

Réponds en JSON:`,

  outputSchema: {
    mealTitle: 'string - Titre appétissant du plat',
    foods: [{
      name: 'string - Nom en français',
      estimatedWeight: 'number - Grammes',
      confidence: 'number - 0 à 1',
      nutrition: {
        calories: 'number',
        proteins: 'number',
        carbs: 'number',
        fats: 'number',
        fiber: 'number',
      },
      alternativeName: 'string | null - Si doute',
    }],
    totalNutrition: {
      calories: 'number',
      proteins: 'number',
      carbs: 'number',
      fats: 'number',
    },
    description: 'string - Description courte du repas',
    dataSource: '"ciqual" | "estimated"',
  },
}

/**
 * Génération de recettes
 */
export const RECIPE_GENERATION_PROMPT = {
  system: `Tu es un chef cuisinier français expert en nutrition.
Tu crées des recettes simples, équilibrées et délicieuses.
Tu privilégies les ingrédients de saison disponibles en supermarché français.`,

  task: (context: {
    mealType: string
    targetCalories?: number
    targetMacros?: { proteins: number; carbs: number; fats: number }
    dietType?: string
    restrictions?: string[]
    preferences?: string[]
    maxPrepTime?: number
    description?: string
  }) => `DEMANDE: ${context.description || `Recette pour ${context.mealType}`}

CONTRAINTES:
${context.targetCalories ? `- Calories max: ${context.targetCalories} kcal` : ''}
${context.targetMacros ? `- Macros cibles: P:${context.targetMacros.proteins}g G:${context.targetMacros.carbs}g L:${context.targetMacros.fats}g` : ''}
${context.dietType ? `- Régime: ${context.dietType}` : ''}
${context.restrictions?.length ? `- Restrictions: ${context.restrictions.join(', ')}` : ''}
${context.preferences?.length ? `- Préférences: ${context.preferences.join(', ')}` : ''}
${context.maxPrepTime ? `- Temps max: ${context.maxPrepTime} minutes` : '- Temps max: 30 minutes'}

RÈGLES:
- Recette réalisable par un débutant
- Max 8 ingrédients principaux
- Ingrédients courants (supermarché français)
- Instructions claires et numérotées

Réponds en JSON:`,

  outputSchema: {
    title: 'string - Nom de la recette',
    description: 'string - Description appétissante (1-2 phrases)',
    prepTime: 'number - Minutes de préparation',
    cookTime: 'number - Minutes de cuisson',
    servings: 'number - Nombre de portions',
    difficulty: '"easy" | "medium" | "hard"',
    ingredients: [{
      name: 'string',
      amount: 'number',
      unit: 'string',
      calories: 'number',
      optional: 'boolean',
    }],
    instructions: 'string[] - Étapes numérotées',
    nutrition: {
      calories: 'number',
      proteins: 'number',
      carbs: 'number',
      fats: 'number',
      fiber: 'number',
    },
    tips: 'string[] - Astuces optionnelles',
    tags: 'string[] - Ex: "rapide", "économique", "protéiné"',
  },
}

// ============= UTILITY FUNCTIONS =============

function formatGoal(goal?: string): string {
  const goals: Record<string, string> = {
    weight_loss: 'Perte de poids',
    muscle_gain: 'Prise de muscle',
    maintenance: 'Maintien',
    health: 'Améliorer ma santé',
    energy: 'Plus d\'énergie',
  }
  return goals[goal || ''] || goal || 'non renseigné'
}

function formatActivityLevel(level?: string): string {
  const levels: Record<string, string> = {
    sedentary: 'Sédentaire (peu ou pas d\'exercice)',
    light: 'Légèrement actif (1-3 jours/sem)',
    moderate: 'Modérément actif (3-5 jours/sem)',
    active: 'Très actif (6-7 jours/sem)',
    athlete: 'Athlète (2x/jour)',
  }
  return levels[level || ''] || level || 'non renseigné'
}

// ============= PROMPT BUILDER =============

/**
 * Construit un prompt complet avec système + contexte + tâche
 */
export function buildPrompt(config: {
  systemPrompt: string
  taskPrompt: string
  outputSchema: Record<string, unknown>
  includeJsonInstructions?: boolean
}): string {
  const { systemPrompt, taskPrompt, outputSchema, includeJsonInstructions = true } = config

  let prompt = `${systemPrompt}\n\n${taskPrompt}`

  if (includeJsonInstructions) {
    prompt += `\n\nFORMAT DE SORTIE (JSON strict):
\`\`\`json
${JSON.stringify(outputSchema, null, 2)}
\`\`\`

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.`
  }

  return prompt
}

/**
 * Parse la réponse JSON de l'IA avec fallback
 */
export function parseAIResponse<T>(response: string, fallback: T): T {
  try {
    // Chercher le JSON dans la réponse
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T
    }
    return fallback
  } catch {
    console.warn('[PromptSystem] Failed to parse AI response:', response.slice(0, 100))
    return fallback
  }
}

// ============= EXPORTS =============

export const PromptSystem = {
  // Persona
  LYMIA_PERSONA,
  LYMIA_SYSTEM_PROMPT,

  // Templates
  RAG_CONTEXT_TEMPLATE,
  USER_CONTEXT_TEMPLATE,
  WELLNESS_CONTEXT_TEMPLATE,

  // Task Prompts
  NUTRITION_CALCULATION: NUTRITION_CALCULATION_PROMPT,
  MEAL_RECOMMENDATION: MEAL_RECOMMENDATION_PROMPT,
  COACHING_ADVICE: COACHING_ADVICE_PROMPT,
  BEHAVIOR_ANALYSIS: BEHAVIOR_ANALYSIS_PROMPT,
  CHAT_RESPONSE: CHAT_RESPONSE_PROMPT,
  FOOD_ANALYSIS: FOOD_ANALYSIS_PROMPT,
  RECIPE_GENERATION: RECIPE_GENERATION_PROMPT,

  // Utilities
  buildPrompt,
  parseAIResponse,
}

export default PromptSystem
