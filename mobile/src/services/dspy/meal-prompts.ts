/**
 * DSPy-Optimized Meal Prompts
 *
 * Prompts optimisés par DSPy pour la génération de repas selon la préférence source.
 * Chaque préférence (fresh, recipes, quick, balanced) a des prompts adaptés.
 */

import { dspyClient } from './client'
import type { DSPyUserContext, DSPyPassage } from './types'
import type { MealSourcePreference } from '../../types'

// ============= TYPES =============

export interface OptimizedPromptResult {
  systemPrompt: string
  userPrompt: string
  sourceGuidelines: string
  confidence: number
  cached: boolean
}

export interface MealGenerationContext {
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  targetCalories: number
  userGoal: 'weight_loss' | 'maintain' | 'maintenance' | 'muscle_gain' | 'health' | 'energy'
  dietType?: string
  allergies?: string[]
  existingMeals?: string[]
  sourcePreference: MealSourcePreference
}

// ============= PROMPTS PAR SOURCE =============

/**
 * Prompts de base par préférence de source
 * Ces prompts sont optimisés pour chaque type de source de données
 */
const SOURCE_BASE_PROMPTS: Record<MealSourcePreference, {
  systemPrompt: string
  sourceGuidelines: string
  examples: string[]
}> = {
  fresh: {
    systemPrompt: `Tu es un nutritionniste expert spécialisé dans les produits frais et naturels.
Tu privilégies les aliments non transformés : fruits, légumes, viandes, poissons, oeufs.
Tes recommandations sont basées sur les données CIQUAL (ANSES) pour une précision nutritionnelle maximale.

PRINCIPES CLÉS:
- Ingrédients bruts et naturels uniquement
- Cuisson simple préservant les nutriments
- Données nutritionnelles officielles ANSES
- Saisonnalité des produits quand possible`,
    sourceGuidelines: `SOURCE PRIORITAIRE: CIQUAL (données officielles françaises)
- Utiliser les références CIQUAL pour les valeurs nutritionnelles
- Privilégier les aliments avec code CIQUAL vérifié
- Portions basées sur les standards ANSES`,
    examples: [
      'Filet de saumon grillé avec haricots verts vapeur',
      'Salade de quinoa aux légumes frais',
      'Omelette aux champignons et épinards',
      'Poulet rôti avec patates douces',
    ],
  },

  recipes: {
    systemPrompt: `Tu es un chef cuisinier français passionné par les recettes maison équilibrées.
Tu crées des plats savoureux avec des instructions claires et des ingrédients accessibles.
Tes recettes sont inspirées de la base Gustar avec des adaptations nutritionnelles.

PRINCIPES CLÉS:
- Recettes complètes avec étapes détaillées
- Équilibre entre plaisir gustatif et nutrition
- Temps de préparation réaliste (< 45 min)
- Ingrédients trouvables en supermarché français`,
    sourceGuidelines: `SOURCE PRIORITAIRE: Recettes Gustar enrichies
- Recettes avec instructions complètes
- Photos et descriptions appétissantes
- Valeurs nutritionnelles calculées par portion
- Adaptations possibles selon les allergies`,
    examples: [
      'Risotto aux champignons et parmesan',
      'Poulet basquaise aux poivrons',
      'Gratin de courgettes léger',
      'Bowl Buddha aux légumes rôtis',
    ],
  },

  quick: {
    systemPrompt: `Tu es un expert en alimentation pratique pour les personnes actives.
Tu recommandes des solutions rapides mais nutritives, incluant des produits du commerce sains.
Tu utilises Open Food Facts pour identifier les meilleurs produits (Nutriscore A/B).

PRINCIPES CLÉS:
- Préparation en moins de 15 minutes
- Produits avec bon Nutriscore (A ou B)
- Solutions pour emporter (lunch box)
- Assemblages simples et équilibrés`,
    sourceGuidelines: `SOURCE PRIORITAIRE: Open Food Facts
- Privilégier Nutriscore A et B
- Vérifier la liste d'ingrédients courte
- Portions individuelles pratiques
- Marques disponibles en France`,
    examples: [
      'Salade composée + yaourt grec + fruits',
      'Wrap complet du commerce + crudités',
      'Soupe en brique bio + pain complet',
      'Barre céréales + banane + amandes',
    ],
  },

  balanced: {
    systemPrompt: `Tu es un conseiller nutritionnel polyvalent qui combine le meilleur de chaque source.
Tu adaptes tes recommandations selon le contexte : produits frais quand possible, recettes pour les repas
principaux, solutions pratiques pour les journées chargées.

PRINCIPES CLÉS:
- Flexibilité selon le moment de la journée
- Mix intelligent des sources de données
- Priorité à la qualité nutritionnelle globale
- Variété pour éviter la monotonie`,
    sourceGuidelines: `SOURCES MIXTES:
- Petit-déjeuner: Produits frais CIQUAL (fruits, yaourt, oeufs)
- Déjeuner: Recettes Gustar équilibrées
- Collation: Produits pratiques OFF (Nutriscore A/B)
- Dîner: Recettes légères ou produits frais`,
    examples: [
      'Matin: Yaourt grec + fruits frais + granola maison',
      'Midi: Poulet grillé légumes de saison (Gustar)',
      'Goûter: Barre céréales bio (OFF Nutriscore A)',
      'Soir: Soupe maison aux légumes frais',
    ],
  },
}

// ============= PROMPTS PAR TYPE DE REPAS =============

/**
 * Ratios caloriques par type de repas (basés sur les besoins journaliers)
 * Ces ratios sont utilisés pour calculer dynamiquement les ranges
 */
const MEAL_CALORIE_RATIOS: Record<string, {
  ratio: number      // % du total journalier
  tolerance: number  // ± tolerance en %
}> = {
  breakfast: { ratio: 0.25, tolerance: 0.15 }, // 25% ± 15% = 21-29% des calories
  lunch:     { ratio: 0.35, tolerance: 0.10 }, // 35% ± 10% = 31-39% des calories
  snack:     { ratio: 0.10, tolerance: 0.05 }, // 10% ± 5% = 9-11% des calories
  dinner:    { ratio: 0.30, tolerance: 0.10 }, // 30% ± 10% = 27-33% des calories
}

/**
 * Calcule la plage calorique acceptable pour un type de repas
 * basée sur les besoins journaliers de l'utilisateur
 */
export function calculateMealCalorieRange(
  mealType: string,
  dailyCalories: number
): { min: number; max: number; target: number } {
  const ratioConfig = MEAL_CALORIE_RATIOS[mealType] || { ratio: 0.25, tolerance: 0.15 }
  const target = Math.round(dailyCalories * ratioConfig.ratio)
  const tolerance = Math.round(dailyCalories * ratioConfig.tolerance)

  return {
    min: target - tolerance,
    max: target + tolerance,
    target,
  }
}

const MEAL_TYPE_PROMPTS: Record<string, {
  constraints: string
  macroFocus: string
  calorieRatioHint: string // Description du ratio pour le prompt
}> = {
  breakfast: {
    constraints: `PETIT-DÉJEUNER FRANÇAIS:
- Traditionnellement sucré (pas d'oeufs/bacon sauf demande explicite)
- Apport en glucides complexes pour l'énergie matinale
- Options: tartines, céréales, yaourt, fruits, viennoiseries (modérément)`,
    macroFocus: 'Glucides complexes + fibres, protéines modérées',
    calorieRatioHint: '~25% des calories journalières',
  },

  lunch: {
    constraints: `DÉJEUNER PRINCIPAL:
- Repas le plus consistant de la journée
- Équilibre protéines/féculents/légumes
- Assez copieux pour tenir l'après-midi`,
    macroFocus: 'Protéines + glucides + légumes, équilibré',
    calorieRatioHint: '~35% des calories journalières',
  },

  snack: {
    constraints: `COLLATION/GOÛTER:
- Portion légère
- Éviter les pics glycémiques
- Satiété jusqu'au dîner`,
    macroFocus: 'Protéines + fibres pour satiété',
    calorieRatioHint: '~10% des calories journalières',
  },

  dinner: {
    constraints: `DÎNER LÉGER:
- Plus léger que le déjeuner
- Éviter les féculents lourds
- Favoriser légumes et protéines maigres`,
    macroFocus: 'Protéines maigres + légumes, peu de glucides',
    calorieRatioHint: '~30% des calories journalières',
  },
}

// ============= FONCTIONS PRINCIPALES =============

/**
 * Génère un prompt optimisé pour la génération de repas
 * Utilise DSPy si disponible, sinon fallback sur les prompts statiques
 */
export async function getOptimizedMealPrompt(
  context: MealGenerationContext
): Promise<OptimizedPromptResult> {
  const { mealType, targetCalories, userGoal, dietType, allergies, existingMeals, sourcePreference } = context

  // Get base prompts for the source preference
  const sourcePrompts = SOURCE_BASE_PROMPTS[sourcePreference]
  const mealPrompts = MEAL_TYPE_PROMPTS[mealType]

  // Try to use DSPy for prompt optimization
  const dspyEnabled = await dspyClient.isEnabled()

  if (dspyEnabled) {
    try {
      const optimizedResult = await optimizePromptWithDSPy(context, sourcePrompts, mealPrompts)
      if (optimizedResult) {
        return optimizedResult
      }
    } catch (error) {
      console.warn('[DSPy Prompts] Optimization failed, using fallback:', error)
    }
  }

  // Fallback to static prompts
  return buildStaticPrompt(context, sourcePrompts, mealPrompts)
}

/**
 * Utilise DSPy pour optimiser le prompt en fonction du contexte
 */
async function optimizePromptWithDSPy(
  context: MealGenerationContext,
  sourcePrompts: typeof SOURCE_BASE_PROMPTS['fresh'],
  mealPrompts: typeof MEAL_TYPE_PROMPTS['breakfast']
): Promise<OptimizedPromptResult | null> {
  const { mealType, targetCalories, userGoal, dietType, allergies, existingMeals, sourcePreference } = context

  // Build DSPy user context
  const dspyContext: DSPyUserContext = {
    goal: userGoal,
    target_calories: targetCalories,
    recent_patterns: existingMeals?.slice(-5),
  }

  // Build question for DSPy to optimize
  const question = `Optimise le prompt pour générer un ${mealType} de ${targetCalories} kcal.
Préférence source: ${sourcePreference}
Objectif utilisateur: ${userGoal}
${dietType ? `Régime: ${dietType}` : ''}
${allergies?.length ? `Allergies: ${allergies.join(', ')}` : ''}`

  // Build passages from our knowledge base
  const passages: DSPyPassage[] = [
    {
      id: 'source-guidelines',
      content: sourcePrompts.sourceGuidelines,
      source: 'internal',
      similarity: 1.0,
    },
    {
      id: 'meal-constraints',
      content: mealPrompts.constraints,
      source: 'internal',
      similarity: 1.0,
    },
    {
      id: 'examples',
      content: `Exemples adaptés: ${sourcePrompts.examples.join(', ')}`,
      source: 'internal',
      similarity: 0.9,
    },
  ]

  const result = await dspyClient.runPipeline(question, passages, dspyContext, true)

  if (!result || result.confidence < 0.5) {
    return null
  }

  // Parse DSPy response to extract optimized elements
  const optimizedSystemPrompt = enhanceSystemPrompt(
    sourcePrompts.systemPrompt,
    result.answer,
    context
  )

  const optimizedUserPrompt = buildOptimizedUserPrompt(context, result.selection_rationale)

  return {
    systemPrompt: optimizedSystemPrompt,
    userPrompt: optimizedUserPrompt,
    sourceGuidelines: sourcePrompts.sourceGuidelines,
    confidence: result.confidence,
    cached: result.cached,
  }
}

/**
 * Construit un prompt statique sans DSPy
 */
function buildStaticPrompt(
  context: MealGenerationContext,
  sourcePrompts: typeof SOURCE_BASE_PROMPTS['fresh'],
  mealPrompts: typeof MEAL_TYPE_PROMPTS['breakfast']
): OptimizedPromptResult {
  const { mealType, targetCalories, userGoal, dietType, allergies, existingMeals } = context

  const systemPrompt = `${sourcePrompts.systemPrompt}

${mealPrompts.constraints}

OBJECTIF UTILISATEUR: ${goalToFrench(userGoal)}
${dietType ? `RÉGIME: ${dietType}` : ''}
${allergies?.length ? `ALLERGIES À ÉVITER: ${allergies.join(', ')}` : ''}

${sourcePrompts.sourceGuidelines}`

  const userPrompt = `Génère un ${mealTypeFrench(mealType)} de ${targetCalories} kcal.

Contraintes:
- Calories cibles: ${targetCalories} kcal (±50 kcal)
- Focus macros: ${mealPrompts.macroFocus}
${existingMeals?.length ? `- Éviter (déjà consommés): ${existingMeals.slice(-5).join(', ')}` : ''}

Exemples inspirants: ${sourcePrompts.examples.slice(0, 2).join(', ')}

Réponds en JSON avec: title, description, ingredients, instructions, nutrition, prepTime, servings`

  return {
    systemPrompt,
    userPrompt,
    sourceGuidelines: sourcePrompts.sourceGuidelines,
    confidence: 0.8, // Static prompts have fixed confidence
    cached: false,
  }
}

/**
 * Améliore le prompt système avec les insights DSPy
 */
function enhanceSystemPrompt(
  basePrompt: string,
  dspyAnswer: string,
  context: MealGenerationContext
): string {
  const { userGoal, dietType, allergies } = context

  // Extract key insights from DSPy answer
  const insights = extractDSPyInsights(dspyAnswer)

  return `${basePrompt}

OPTIMISATION DSPy:
${insights}

OBJECTIF: ${goalToFrench(userGoal)}
${dietType ? `RÉGIME: ${dietType}` : ''}
${allergies?.length ? `ÉVITER: ${allergies.join(', ')}` : ''}`
}

/**
 * Construit un prompt utilisateur optimisé
 */
function buildOptimizedUserPrompt(
  context: MealGenerationContext,
  dspyRationale: string
): string {
  const { mealType, targetCalories, existingMeals } = context
  const mealPrompts = MEAL_TYPE_PROMPTS[mealType]

  // Calculer la plage acceptable (±15% de la cible)
  const minCalories = Math.round(targetCalories * 0.85)
  const maxCalories = Math.round(targetCalories * 1.15)

  return `Génère un ${mealTypeFrench(mealType)} optimisé.

CIBLE: ${targetCalories} kcal (${minCalories}-${maxCalories} kcal acceptables)
RATIO: ${mealPrompts.calorieRatioHint}

FOCUS NUTRITIONNEL:
${mealPrompts.macroFocus}

CONTEXTE DSPy:
${dspyRationale}

${existingMeals?.length ? `ÉVITER: ${existingMeals.slice(-5).join(', ')}` : ''}

FORMAT JSON REQUIS:
{
  "title": "Nom appétissant",
  "description": "Description courte",
  "ingredients": [{"name": "...", "amount": "...", "calories": X}],
  "instructions": ["Étape 1", "Étape 2"],
  "nutrition": {"calories": X, "proteins": X, "carbs": X, "fats": X},
  "prepTime": X,
  "servings": 1
}`
}

/**
 * Extrait les insights clés de la réponse DSPy
 */
function extractDSPyInsights(dspyAnswer: string): string {
  // Parse the DSPy answer to extract actionable insights
  const lines = dspyAnswer.split('\n').filter(line => line.trim())

  // Take first 3-4 relevant lines as insights
  const insights = lines.slice(0, 4).map(line => `- ${line.trim()}`).join('\n')

  return insights || '- Utiliser les meilleures pratiques nutritionnelles'
}

// ============= HELPERS =============

function goalToFrench(goal: string): string {
  const map: Record<string, string> = {
    weight_loss: 'Perte de poids',
    maintain: 'Maintien',
    maintenance: 'Maintien',
    muscle_gain: 'Prise de muscle',
    health: 'Améliorer ma santé',
    energy: 'Plus d\'énergie',
  }
  return map[goal] || goal
}

function mealTypeFrench(mealType: string): string {
  const map: Record<string, string> = {
    breakfast: 'petit-déjeuner',
    lunch: 'déjeuner',
    snack: 'collation',
    dinner: 'dîner',
  }
  return map[mealType] || mealType
}

// ============= EXPORTS =============

export {
  SOURCE_BASE_PROMPTS,
  MEAL_TYPE_PROMPTS,
}

export default {
  getOptimizedMealPrompt,
  SOURCE_BASE_PROMPTS,
  MEAL_TYPE_PROMPTS,
}
