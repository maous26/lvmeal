/**
 * Diversity Calculator - LYM Health Module
 *
 * Calculates food diversity over 7 days by food groups.
 * Returns qualitative levels (low/medium/good), never scores.
 *
 * Groups tracked:
 * - fruits, vegetables, proteins, legumes
 * - whole_grains, dairy, nuts_seeds, fish
 */

import type { Meal, MealItem, FoodItem } from '../../../types'
import type { FoodGroup, DiversityResult, DiversityLevel } from '../types'

// =============================================================================
// FOOD GROUP MAPPING
// =============================================================================

/**
 * Keywords to detect food groups from food names/categories
 * This is a heuristic approach - can be improved with proper tagging
 */
const FOOD_GROUP_KEYWORDS: Record<FoodGroup, string[]> = {
  fruits: [
    'pomme', 'banane', 'orange', 'fraise', 'framboise', 'myrtille', 'raisin',
    'poire', 'peche', 'abricot', 'mangue', 'ananas', 'kiwi', 'melon', 'pasteque',
    'cerise', 'prune', 'citron', 'pamplemousse', 'fruit', 'compote', 'jus de fruit',
    'apple', 'banana', 'orange', 'strawberry', 'grape', 'berry', 'fruit',
  ],
  vegetables: [
    'carotte', 'tomate', 'salade', 'laitue', 'epinard', 'brocoli', 'chou',
    'courgette', 'aubergine', 'poivron', 'haricot vert', 'petit pois',
    'concombre', 'radis', 'betterave', 'navet', 'poireau', 'oignon',
    'champignon', 'legume', 'soupe de legumes',
    'carrot', 'tomato', 'lettuce', 'spinach', 'broccoli', 'vegetable', 'veggie',
  ],
  proteins: [
    'poulet', 'boeuf', 'porc', 'agneau', 'veau', 'dinde', 'canard',
    'oeuf', 'jambon', 'bacon', 'saucisse', 'steak', 'escalope',
    'viande', 'blanc de poulet', 'filet',
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'egg', 'meat', 'protein',
  ],
  legumes: [
    'lentille', 'pois chiche', 'haricot rouge', 'haricot blanc', 'haricot noir',
    'feve', 'soja', 'tofu', 'tempeh', 'edamame', 'legumineuse',
    'lentil', 'chickpea', 'bean', 'legume', 'tofu',
  ],
  whole_grains: [
    'quinoa', 'boulgour', 'avoine', 'flocons d\'avoine', 'riz complet',
    'riz brun', 'pain complet', 'pates completes', 'cereale complete',
    'sarrasin', 'epeautre', 'millet', 'orge',
    'oats', 'whole grain', 'whole wheat', 'brown rice', 'quinoa',
  ],
  dairy: [
    'lait', 'yaourt', 'yogourt', 'fromage', 'creme', 'beurre',
    'mozzarella', 'parmesan', 'emmental', 'camembert', 'brie',
    'fromage blanc', 'petit suisse', 'faisselle', 'kefir',
    'milk', 'yogurt', 'cheese', 'cream', 'dairy',
  ],
  nuts_seeds: [
    'amande', 'noix', 'noisette', 'cajou', 'pistache', 'cacahuete',
    'arachide', 'noix de pecan', 'noix du bresil', 'noix de macadamia',
    'graine de tournesol', 'graine de courge', 'graine de chia',
    'graine de lin', 'sesame', 'oleagineux',
    'almond', 'walnut', 'hazelnut', 'cashew', 'pistachio', 'peanut',
    'nut', 'seed', 'chia', 'flax',
  ],
  fish: [
    'saumon', 'thon', 'cabillaud', 'merlu', 'sole', 'bar', 'loup',
    'sardine', 'maquereau', 'hareng', 'truite', 'dorade',
    'crevette', 'moule', 'huitre', 'crabe', 'homard', 'langoustine',
    'poisson', 'fruit de mer', 'fruits de mer',
    'salmon', 'tuna', 'cod', 'fish', 'seafood', 'shrimp', 'prawn',
  ],
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Detect food group from food item name and category
 */
export function detectFoodGroup(food: FoodItem): FoodGroup | undefined {
  const searchText = `${food.name} ${food.category || ''} ${food.brand || ''}`.toLowerCase()

  for (const [group, keywords] of Object.entries(FOOD_GROUP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return group as FoodGroup
      }
    }
  }

  return undefined
}

/**
 * Get dates for the last N days
 */
function getLastNDays(n: number): string[] {
  const dates: string[] = []
  const today = new Date()

  for (let i = 0; i < n; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString().split('T')[0])
  }

  return dates
}

/**
 * Determine diversity level from group count
 */
function getDiversityLevel(presentGroupsCount: number): DiversityLevel {
  // 8 total groups
  // 0-3 = low, 4-5 = medium, 6-8 = good
  if (presentGroupsCount <= 3) return 'low'
  if (presentGroupsCount <= 5) return 'medium'
  return 'good'
}

// =============================================================================
// MAIN CALCULATOR
// =============================================================================

/**
 * Calculate food diversity over the last 7 days
 *
 * @param meals - All meals from the last 7 days (or more, will be filtered)
 * @param dailyData - Optional: daily data record keyed by date (YYYY-MM-DD)
 * @returns DiversityResult with groups present/missing and qualitative level
 */
export function calculateDiversity(
  meals: Meal[],
  dailyData?: Record<string, { meals: Meal[] }>
): DiversityResult {
  const last7Days = getLastNDays(7)
  const allGroups: FoodGroup[] = [
    'fruits', 'vegetables', 'proteins', 'legumes',
    'whole_grains', 'dairy', 'nuts_seeds', 'fish',
  ]

  // Initialize counts
  const groupCounts: Record<FoodGroup, number> = {
    fruits: 0,
    vegetables: 0,
    proteins: 0,
    legumes: 0,
    whole_grains: 0,
    dairy: 0,
    nuts_seeds: 0,
    fish: 0,
  }

  // Collect all meals from last 7 days
  let mealsToAnalyze: Meal[] = []

  if (dailyData) {
    // Use dailyData if provided
    for (const date of last7Days) {
      const dayData = dailyData[date]
      if (dayData?.meals) {
        mealsToAnalyze.push(...dayData.meals)
      }
    }
  } else {
    // Filter meals by date
    mealsToAnalyze = meals.filter(meal => last7Days.includes(meal.date))
  }

  // Count food groups
  for (const meal of mealsToAnalyze) {
    for (const item of meal.items) {
      // Check if item already has foodGroup (extended data)
      // TODO: Add foodGroup to FoodItem type when enriching from OFF
      const itemWithGroup = item.food as FoodItem & { foodGroup?: FoodGroup }

      let group = itemWithGroup.foodGroup
      if (!group) {
        group = detectFoodGroup(item.food)
      }

      if (group) {
        groupCounts[group]++
      }
    }
  }

  // Determine present and missing groups
  const presentGroups = allGroups.filter(g => groupCounts[g] > 0)
  const missingGroups = allGroups.filter(g => groupCounts[g] === 0)
  const level = getDiversityLevel(presentGroups.length)

  return {
    presentGroups,
    missingGroups,
    level,
    groupCounts,
  }
}

/**
 * Get diversity level label in French
 */
export function getDiversityLevelLabel(level: DiversityLevel): string {
  switch (level) {
    case 'low':
      return 'Faible variete'
    case 'medium':
      return 'Variete moyenne'
    case 'good':
      return 'Bonne variete'
  }
}

/**
 * Get a friendly message about diversity
 * No judgment, just information
 */
export function getDiversityMessage(result: DiversityResult): string {
  const { level, missingGroups, presentGroups } = result

  if (level === 'good') {
    return 'Ta semaine est bien variee, bravo !'
  }

  if (level === 'medium') {
    if (missingGroups.length > 0) {
      const missing = missingGroups.slice(0, 2).map(g => {
        switch (g) {
          case 'fruits': return 'fruits'
          case 'vegetables': return 'legumes'
          case 'proteins': return 'proteines'
          case 'legumes': return 'legumineuses'
          case 'whole_grains': return 'cereales completes'
          case 'dairy': return 'produits laitiers'
          case 'nuts_seeds': return 'oleagineux'
          case 'fish': return 'poissons'
        }
      }).join(' et ')
      return `Tu pourrais ajouter un peu de ${missing} cette semaine.`
    }
    return 'Continue comme ca !'
  }

  // Low diversity
  return `Cette semaine, ${presentGroups.length} groupes presents sur 8. C'est un repere, pas un objectif.`
}

export default calculateDiversity
