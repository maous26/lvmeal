/**
 * Unit Weights Service
 *
 * Provides accurate weight per unit for common foods.
 *
 * Problem: OFF and CIQUAL provide nutrition per 100g and "serving size"
 * which is often the reference portion (e.g., 30g for nuts), NOT the
 * weight of a single unit.
 *
 * Example: 10 almonds = 12g (not 100g or 30g)
 *
 * This service provides weight per unit for foods commonly counted
 * by pieces rather than weighed.
 */

import type { FoodItem } from '../types'

// =============================================================================
// TYPES
// =============================================================================

export interface UnitWeightRule {
  /** Unique identifier */
  id: string
  /** Display name in French */
  name: string
  /** Keywords to detect this food (lowercase, no accents) */
  keywords: string[]
  /** Weight per single unit in grams */
  weightPerUnit: number
  /** Display label for one unit */
  unitLabel: string
  /** Plural label */
  unitLabelPlural: string
}

export interface UnitWeightResult {
  /** Whether unit weight is available for this food */
  hasUnitWeight: boolean
  /** The matching rule if found */
  rule?: UnitWeightRule
  /** Weight per unit in grams */
  weightPerUnit?: number
}

// =============================================================================
// UNIT WEIGHT DATABASE
// =============================================================================

/**
 * Unit weights for common foods counted by pieces
 *
 * Sources:
 * - CIQUAL (average weights)
 * - USDA Food Database
 * - Common culinary references
 */
export const UNIT_WEIGHT_RULES: UnitWeightRule[] = [
  // ===================
  // NUTS & DRIED FRUITS
  // ===================
  {
    id: 'amande',
    name: 'Amande',
    keywords: ['amande', 'amandes', 'almond', 'almonds'],
    weightPerUnit: 1.2,
    unitLabel: 'amande',
    unitLabelPlural: 'amandes',
  },
  {
    id: 'noix',
    name: 'Noix',
    keywords: ['noix', 'walnut', 'walnuts'],
    weightPerUnit: 5, // Whole walnut with shell removed
    unitLabel: 'noix',
    unitLabelPlural: 'noix',
  },
  {
    id: 'noix_cajou',
    name: 'Noix de cajou',
    keywords: ['cajou', 'cashew', 'cashews'],
    weightPerUnit: 1.5,
    unitLabel: 'noix de cajou',
    unitLabelPlural: 'noix de cajou',
  },
  {
    id: 'noisette',
    name: 'Noisette',
    keywords: ['noisette', 'noisettes', 'hazelnut', 'hazelnuts'],
    weightPerUnit: 1.5,
    unitLabel: 'noisette',
    unitLabelPlural: 'noisettes',
  },
  {
    id: 'pistache',
    name: 'Pistache',
    keywords: ['pistache', 'pistaches', 'pistachio', 'pistachios'],
    weightPerUnit: 0.6, // Shelled
    unitLabel: 'pistache',
    unitLabelPlural: 'pistaches',
  },
  {
    id: 'noix_pecan',
    name: 'Noix de pécan',
    keywords: ['pecan', 'pecans', 'noix de pecan'],
    weightPerUnit: 4,
    unitLabel: 'noix de pécan',
    unitLabelPlural: 'noix de pécan',
  },
  {
    id: 'noix_macadamia',
    name: 'Noix de macadamia',
    keywords: ['macadamia'],
    weightPerUnit: 2.5,
    unitLabel: 'noix de macadamia',
    unitLabelPlural: 'noix de macadamia',
  },
  {
    id: 'noix_bresil',
    name: 'Noix du Brésil',
    keywords: ['bresil', 'brazil'],
    weightPerUnit: 5,
    unitLabel: 'noix du Brésil',
    unitLabelPlural: 'noix du Brésil',
  },
  {
    id: 'cacahuete',
    name: 'Cacahuète',
    keywords: ['cacahuete', 'cacahuetes', 'arachide', 'peanut', 'peanuts'],
    weightPerUnit: 0.8,
    unitLabel: 'cacahuète',
    unitLabelPlural: 'cacahuètes',
  },
  {
    id: 'datte',
    name: 'Datte',
    keywords: ['datte', 'dattes', 'date', 'dates', 'medjool', 'deglet'],
    weightPerUnit: 8, // Medjool is ~24g, Deglet Noor is ~8g
    unitLabel: 'datte',
    unitLabelPlural: 'dattes',
  },
  {
    id: 'pruneau',
    name: 'Pruneau',
    keywords: ['pruneau', 'pruneaux', 'prune'],
    weightPerUnit: 10,
    unitLabel: 'pruneau',
    unitLabelPlural: 'pruneaux',
  },
  {
    id: 'abricot_sec',
    name: 'Abricot sec',
    keywords: ['abricot sec', 'abricots secs', 'dried apricot'],
    weightPerUnit: 8,
    unitLabel: 'abricot sec',
    unitLabelPlural: 'abricots secs',
  },
  {
    id: 'figue_seche',
    name: 'Figue sèche',
    keywords: ['figue seche', 'figues seches', 'dried fig'],
    weightPerUnit: 20,
    unitLabel: 'figue sèche',
    unitLabelPlural: 'figues sèches',
  },

  // ===================
  // OLIVES
  // ===================
  {
    id: 'olive_verte',
    name: 'Olive verte',
    keywords: ['olive verte', 'olives vertes', 'green olive'],
    weightPerUnit: 4,
    unitLabel: 'olive',
    unitLabelPlural: 'olives',
  },
  {
    id: 'olive_noire',
    name: 'Olive noire',
    keywords: ['olive noire', 'olives noires', 'black olive'],
    weightPerUnit: 3,
    unitLabel: 'olive',
    unitLabelPlural: 'olives',
  },
  {
    id: 'olive',
    name: 'Olive',
    keywords: ['olive', 'olives'],
    weightPerUnit: 3.5,
    unitLabel: 'olive',
    unitLabelPlural: 'olives',
  },

  // ===================
  // EGGS
  // ===================
  {
    id: 'oeuf',
    name: 'Œuf',
    keywords: ['oeuf', 'oeufs', 'egg', 'eggs'],
    weightPerUnit: 60, // Medium egg with shell ~60g, without shell ~50g
    unitLabel: 'œuf',
    unitLabelPlural: 'œufs',
  },
  {
    id: 'oeuf_caille',
    name: 'Œuf de caille',
    keywords: ['caille', 'quail'],
    weightPerUnit: 10,
    unitLabel: 'œuf de caille',
    unitLabelPlural: 'œufs de caille',
  },

  // ===================
  // FRUITS
  // ===================
  {
    id: 'pomme',
    name: 'Pomme',
    keywords: ['pomme', 'apple'],
    weightPerUnit: 180,
    unitLabel: 'pomme',
    unitLabelPlural: 'pommes',
  },
  {
    id: 'banane',
    name: 'Banane',
    keywords: ['banane', 'banana'],
    weightPerUnit: 120, // Without peel
    unitLabel: 'banane',
    unitLabelPlural: 'bananes',
  },
  {
    id: 'orange',
    name: 'Orange',
    keywords: ['orange'],
    weightPerUnit: 150,
    unitLabel: 'orange',
    unitLabelPlural: 'oranges',
  },
  {
    id: 'clementine',
    name: 'Clémentine',
    keywords: ['clementine', 'mandarine', 'tangerine'],
    weightPerUnit: 60,
    unitLabel: 'clémentine',
    unitLabelPlural: 'clémentines',
  },
  {
    id: 'kiwi',
    name: 'Kiwi',
    keywords: ['kiwi'],
    weightPerUnit: 75,
    unitLabel: 'kiwi',
    unitLabelPlural: 'kiwis',
  },
  {
    id: 'abricot',
    name: 'Abricot',
    keywords: ['abricot', 'apricot'],
    weightPerUnit: 45,
    unitLabel: 'abricot',
    unitLabelPlural: 'abricots',
  },
  {
    id: 'peche',
    name: 'Pêche',
    keywords: ['peche', 'peach'],
    weightPerUnit: 150,
    unitLabel: 'pêche',
    unitLabelPlural: 'pêches',
  },
  {
    id: 'nectarine',
    name: 'Nectarine',
    keywords: ['nectarine'],
    weightPerUnit: 140,
    unitLabel: 'nectarine',
    unitLabelPlural: 'nectarines',
  },
  {
    id: 'prune',
    name: 'Prune',
    keywords: ['prune', 'plum'],
    weightPerUnit: 60,
    unitLabel: 'prune',
    unitLabelPlural: 'prunes',
  },
  {
    id: 'fraise',
    name: 'Fraise',
    keywords: ['fraise', 'strawberry'],
    weightPerUnit: 12,
    unitLabel: 'fraise',
    unitLabelPlural: 'fraises',
  },
  {
    id: 'framboise',
    name: 'Framboise',
    keywords: ['framboise', 'raspberry'],
    weightPerUnit: 4,
    unitLabel: 'framboise',
    unitLabelPlural: 'framboises',
  },
  {
    id: 'cerise',
    name: 'Cerise',
    keywords: ['cerise', 'cherry'],
    weightPerUnit: 8,
    unitLabel: 'cerise',
    unitLabelPlural: 'cerises',
  },
  {
    id: 'raisin',
    name: 'Grain de raisin',
    keywords: ['raisin', 'grape'],
    weightPerUnit: 5,
    unitLabel: 'grain',
    unitLabelPlural: 'grains',
  },
  {
    id: 'litchi',
    name: 'Litchi',
    keywords: ['litchi', 'lychee'],
    weightPerUnit: 15,
    unitLabel: 'litchi',
    unitLabelPlural: 'litchis',
  },

  // ===================
  // VEGETABLES
  // ===================
  {
    id: 'tomate',
    name: 'Tomate',
    keywords: ['tomate', 'tomato'],
    weightPerUnit: 100,
    unitLabel: 'tomate',
    unitLabelPlural: 'tomates',
  },
  {
    id: 'tomate_cerise',
    name: 'Tomate cerise',
    keywords: ['tomate cerise', 'cherry tomato'],
    weightPerUnit: 15,
    unitLabel: 'tomate cerise',
    unitLabelPlural: 'tomates cerise',
  },
  {
    id: 'carotte',
    name: 'Carotte',
    keywords: ['carotte', 'carrot'],
    weightPerUnit: 80,
    unitLabel: 'carotte',
    unitLabelPlural: 'carottes',
  },
  {
    id: 'concombre',
    name: 'Concombre',
    keywords: ['concombre', 'cucumber'],
    weightPerUnit: 300,
    unitLabel: 'concombre',
    unitLabelPlural: 'concombres',
  },
  {
    id: 'courgette',
    name: 'Courgette',
    keywords: ['courgette', 'zucchini'],
    weightPerUnit: 200,
    unitLabel: 'courgette',
    unitLabelPlural: 'courgettes',
  },
  {
    id: 'poivron',
    name: 'Poivron',
    keywords: ['poivron', 'pepper', 'bell pepper'],
    weightPerUnit: 150,
    unitLabel: 'poivron',
    unitLabelPlural: 'poivrons',
  },
  {
    id: 'oignon',
    name: 'Oignon',
    keywords: ['oignon', 'onion'],
    weightPerUnit: 100,
    unitLabel: 'oignon',
    unitLabelPlural: 'oignons',
  },
  {
    id: 'ail',
    name: 'Gousse d\'ail',
    keywords: ['ail', 'gousse', 'garlic'],
    weightPerUnit: 4,
    unitLabel: 'gousse',
    unitLabelPlural: 'gousses',
  },
  {
    id: 'champignon',
    name: 'Champignon',
    keywords: ['champignon', 'mushroom'],
    weightPerUnit: 15,
    unitLabel: 'champignon',
    unitLabelPlural: 'champignons',
  },
  {
    id: 'avocat',
    name: 'Avocat',
    keywords: ['avocat', 'avocado'],
    weightPerUnit: 150, // Without pit and skin
    unitLabel: 'avocat',
    unitLabelPlural: 'avocats',
  },
  {
    id: 'radis',
    name: 'Radis',
    keywords: ['radis', 'radish'],
    weightPerUnit: 10,
    unitLabel: 'radis',
    unitLabelPlural: 'radis',
  },

  // ===================
  // BREAD & BAKERY
  // ===================
  {
    id: 'tranche_pain',
    name: 'Tranche de pain',
    keywords: ['tranche pain', 'slice bread'],
    weightPerUnit: 30,
    unitLabel: 'tranche',
    unitLabelPlural: 'tranches',
  },
  {
    id: 'croissant',
    name: 'Croissant',
    keywords: ['croissant'],
    weightPerUnit: 45,
    unitLabel: 'croissant',
    unitLabelPlural: 'croissants',
  },
  {
    id: 'pain_chocolat',
    name: 'Pain au chocolat',
    keywords: ['pain chocolat', 'chocolatine'],
    weightPerUnit: 65,
    unitLabel: 'pain au chocolat',
    unitLabelPlural: 'pains au chocolat',
  },
  {
    id: 'baguette',
    name: 'Baguette',
    keywords: ['baguette'],
    weightPerUnit: 250,
    unitLabel: 'baguette',
    unitLabelPlural: 'baguettes',
  },

  // ===================
  // DAIRY & CHEESE
  // ===================
  {
    id: 'yaourt',
    name: 'Yaourt',
    keywords: ['yaourt', 'yogurt', 'yogourt'],
    weightPerUnit: 125,
    unitLabel: 'pot',
    unitLabelPlural: 'pots',
  },
  {
    id: 'fromage_portion',
    name: 'Portion de fromage',
    keywords: ['babybel', 'kiri', 'vache qui rit', 'laughing cow'],
    weightPerUnit: 20,
    unitLabel: 'portion',
    unitLabelPlural: 'portions',
  },

  // ===================
  // SWEETS & SNACKS
  // ===================
  {
    id: 'carre_chocolat',
    name: 'Carré de chocolat',
    keywords: ['carre chocolat', 'square chocolate'],
    weightPerUnit: 5,
    unitLabel: 'carré',
    unitLabelPlural: 'carrés',
  },
  {
    id: 'biscuit',
    name: 'Biscuit',
    keywords: ['biscuit', 'cookie', 'galette'],
    weightPerUnit: 10,
    unitLabel: 'biscuit',
    unitLabelPlural: 'biscuits',
  },
  {
    id: 'bonbon',
    name: 'Bonbon',
    keywords: ['bonbon', 'candy'],
    weightPerUnit: 5,
    unitLabel: 'bonbon',
    unitLabelPlural: 'bonbons',
  },

  // ===================
  // MEAT & FISH
  // ===================
  {
    id: 'tranche_jambon',
    name: 'Tranche de jambon',
    keywords: ['tranche jambon', 'slice ham', 'jambon blanc'],
    weightPerUnit: 30,
    unitLabel: 'tranche',
    unitLabelPlural: 'tranches',
  },
  {
    id: 'saucisse',
    name: 'Saucisse',
    keywords: ['saucisse', 'sausage', 'chipolata', 'merguez'],
    weightPerUnit: 50,
    unitLabel: 'saucisse',
    unitLabelPlural: 'saucisses',
  },
  {
    id: 'knacki',
    name: 'Knacki',
    keywords: ['knacki', 'knack', 'strasbourg', 'francfort'],
    weightPerUnit: 35,
    unitLabel: 'knacki',
    unitLabelPlural: 'knackis',
  },
  {
    id: 'surimi',
    name: 'Bâtonnet de surimi',
    keywords: ['surimi', 'batonnet'],
    weightPerUnit: 15,
    unitLabel: 'bâtonnet',
    unitLabelPlural: 'bâtonnets',
  },
  {
    id: 'crevette',
    name: 'Crevette',
    keywords: ['crevette', 'shrimp', 'prawn'],
    weightPerUnit: 10,
    unitLabel: 'crevette',
    unitLabelPlural: 'crevettes',
  },
]

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Normalize text for matching (lowercase, no accents)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Detect if a food has a known unit weight
 */
export function detectUnitWeight(food: FoodItem): UnitWeightResult {
  const normalizedName = normalizeText(food.name)

  // Check each rule
  for (const rule of UNIT_WEIGHT_RULES) {
    const matchesKeyword = rule.keywords.some(kw => normalizedName.includes(kw))

    if (matchesKeyword) {
      return {
        hasUnitWeight: true,
        rule,
        weightPerUnit: rule.weightPerUnit,
      }
    }
  }

  return {
    hasUnitWeight: false,
  }
}

/**
 * Get unit weight for a food by name
 */
export function getUnitWeightByName(name: string): number | null {
  const normalizedName = normalizeText(name)

  for (const rule of UNIT_WEIGHT_RULES) {
    const matchesKeyword = rule.keywords.some(kw => normalizedName.includes(kw))
    if (matchesKeyword) {
      return rule.weightPerUnit
    }
  }

  return null
}

/**
 * Calculate total weight from unit count
 */
export function calculateWeightFromUnits(
  food: FoodItem,
  unitCount: number
): { weightGrams: number; usedRule: boolean; rule?: UnitWeightRule } {
  const result = detectUnitWeight(food)

  if (result.hasUnitWeight && result.weightPerUnit) {
    return {
      weightGrams: Math.round(unitCount * result.weightPerUnit * 10) / 10,
      usedRule: true,
      rule: result.rule,
    }
  }

  // Fallback to servingSize if no rule found
  const fallbackWeight = food.servingSize || 100
  return {
    weightGrams: unitCount * fallbackWeight,
    usedRule: false,
  }
}

/**
 * Get display info for unit input
 */
export function getUnitDisplayInfo(food: FoodItem): {
  hasUnitWeight: boolean
  unitLabel: string
  unitLabelPlural: string
  weightPerUnit: number
  example: string
} {
  const result = detectUnitWeight(food)

  if (result.hasUnitWeight && result.rule) {
    return {
      hasUnitWeight: true,
      unitLabel: result.rule.unitLabel,
      unitLabelPlural: result.rule.unitLabelPlural,
      weightPerUnit: result.rule.weightPerUnit,
      example: `1 ${result.rule.unitLabel} = ${result.rule.weightPerUnit}g`,
    }
  }

  return {
    hasUnitWeight: false,
    unitLabel: 'unité',
    unitLabelPlural: 'unités',
    weightPerUnit: food.servingSize || 100,
    example: '',
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  detectUnitWeight,
  getUnitWeightByName,
  calculateWeightFromUnits,
  getUnitDisplayInfo,
  UNIT_WEIGHT_RULES,
}
