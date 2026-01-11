#!/usr/bin/env npx ts-node
/**
 * Pre-Enrichment Script for Production Database
 *
 * Fetches recipes from Gustar API, enriches them with OpenAI (French translation + full details),
 * and saves to a JSON file that can be bundled with the app.
 *
 * Usage:
 *   npm run enrich-recipes
 *
 * Output:
 *   src/data/enriched-recipes.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ESM compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

// Configuration
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''
const RAPIDAPI_KEY: string = process.env.RAPIDAPI_KEY || process.env.EXPO_PUBLIC_RAPIDAPI_KEY || ''
const RAPIDAPI_HOST = 'gustar-io-deutsche-rezepte.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}`

// Maximum NEW recipes to enrich per run (to control costs and time)
const MAX_NEW_RECIPES = 100

// Output file path
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'enriched-recipes.json')

// ============= HEALTH VALIDATION CRITERIA (OMS/ANSES) =============

// Maximum values per serving
const MAX_SUGAR_SAVORY = 10 // g - OMS: <10% of daily calories
const MAX_SUGAR_DESSERT = 20 // g - for allowed desserts
const MAX_SODIUM_PER_SERVING = 500 // mg - OMS: <2000mg/day
const MAX_SATURATED_FAT = 8 // g - ANSES: <10% of daily calories
const MAX_FAT_PERCENTAGE = 40 // % of calories from fat

// Calorie limits by meal type (based on 2000kcal/day target)
const CALORIE_LIMITS = {
  breakfast: { min: 250, max: 500 },
  lunch: { min: 400, max: 700 },
  snack: { min: 100, max: 250 },
  dinner: { min: 350, max: 600 },
}

// Macronutrient ratio guidelines (% of calories)
const MACRO_RATIOS = {
  proteins: { min: 15, max: 35 }, // ANSES recommendation
  carbs: { min: 40, max: 55 },    // ANSES recommendation
  fats: { min: 25, max: 40 },     // ANSES recommendation
}

// Ingredients to avoid (indicate unhealthy)
const UNHEALTHY_INDICATORS = [
  // High sugar
  'zucker', 'sirup', 'karamell', 'glasur', 'zuckerguss', 'kandis',
  // High sodium
  'brühwürfel', 'fertigsauce', 'instant',
  // Ultra-processed
  'fertiggericht', 'tiefkühl', 'pulver', 'geschmacksverstärker',
  // Fried
  'frittiert', 'paniert', 'gebacken',
]

// Healthy indicators (bonus)
const HEALTHY_INDICATORS = [
  'salat', 'gemüse', 'grill', 'gedämpft', 'vapeur', 'vollkorn',
  'quinoa', 'linsen', 'bohnen', 'fisch', 'hähnchen', 'pute',
]

// Categories to exclude from daily meals
const EXCLUDED_CATEGORIES = [
  'kuchen', 'torte', 'dessert', 'nachtisch', 'süßspeise',
  'pizza', 'burger', 'pommes', 'fritten', 'lasagne',
  'fondue', 'raclette', 'carbonara',
]

/**
 * Pre-filter recipe before enrichment (based on title and ingredients)
 * NOW: Always returns pass=true, but provides healthPenalty for scoring
 * No recipes are rejected - they are all classified by health quality
 */
function shouldEnrichRecipe(recipe: GustarRecipe): { pass: boolean; healthPenalty: number; flags: string[] } {
  const title = recipe.title.toLowerCase()
  const ingredients = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ')
  const combined = `${title} ${ingredients}`

  let healthPenalty = 0
  const flags: string[] = []

  // 1. Check excluded categories (heavy penalty but don't reject)
  for (const category of EXCLUDED_CATEGORIES) {
    if (title.includes(category)) {
      healthPenalty += 20
      flags.push(`category:${category}`)
    }
  }

  // 2. Check unhealthy indicators (penalty per indicator)
  const unhealthyCount = UNHEALTHY_INDICATORS.filter(ind => combined.includes(ind)).length
  if (unhealthyCount > 0) {
    healthPenalty += unhealthyCount * 8
    flags.push(`unhealthy_indicators:${unhealthyCount}`)
  }

  // 3. Check nutrition if available
  if (recipe.nutrition) {
    const { calories, fats } = recipe.nutrition

    // High calorie penalty
    if (calories > 800) {
      healthPenalty += 15
      flags.push(`high_calories:${calories}`)
    } else if (calories > 600) {
      healthPenalty += 5
    }

    // High fat percentage penalty
    if (calories > 0 && fats) {
      const fatPercentage = (fats * 9 / calories) * 100
      if (fatPercentage > 50) {
        healthPenalty += 15
        flags.push(`high_fat:${Math.round(fatPercentage)}%`)
      } else if (fatPercentage > 40) {
        healthPenalty += 5
      }
    }
  }

  // 4. Healthy indicators bonus (reduces penalty)
  const healthyCount = HEALTHY_INDICATORS.filter(ind => combined.includes(ind)).length
  if (healthyCount > 0) {
    healthPenalty -= healthyCount * 5
    flags.push(`healthy_indicators:${healthyCount}`)
  }

  // Ensure penalty doesn't go negative
  healthPenalty = Math.max(0, healthPenalty)

  // Always pass - we classify, don't reject
  return { pass: true, healthPenalty, flags }
}

/**
 * Calculate health score (0-100) for prioritizing recipes
 */
function getHealthScore(recipe: GustarRecipe): number {
  let score = 70 // Base score
  const title = recipe.title.toLowerCase()
  const ingredients = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ')
  const combined = `${title} ${ingredients}`

  // Healthy indicators bonus
  const healthyCount = HEALTHY_INDICATORS.filter(ind => combined.includes(ind)).length
  score += healthyCount * 5

  // Unhealthy indicators penalty
  const unhealthyCount = UNHEALTHY_INDICATORS.filter(ind => combined.includes(ind)).length
  score -= unhealthyCount * 10

  // Nutrition-based scoring if available
  if (recipe.nutrition) {
    const { calories, proteins, fats, carbs } = recipe.nutrition

    // Good protein ratio
    if (calories > 0 && proteins) {
      const proteinPercentage = (proteins * 4 / calories) * 100
      if (proteinPercentage >= 20) score += 10
      if (proteinPercentage >= 30) score += 5
    }

    // Reasonable fat ratio
    if (calories > 0 && fats) {
      const fatPercentage = (fats * 9 / calories) * 100
      if (fatPercentage <= 35) score += 10
      if (fatPercentage > 45) score -= 15
    }
  }

  return Math.max(0, Math.min(100, score))
}

// Load existing recipes to avoid duplicates
interface ExistingData {
  version: string
  generatedAt: string
  totalRecipes: number
  recipes: EnrichedRecipe[]
}

function loadExistingRecipes(): EnrichedRecipe[] {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const content = fs.readFileSync(OUTPUT_FILE, 'utf-8')
      const data: ExistingData = JSON.parse(content)
      console.log(`📦 Loaded ${data.recipes.length} existing recipes from database`)
      return data.recipes || []
    }
  } catch (error) {
    console.log('⚠️  Could not load existing recipes, starting fresh')
  }
  return []
}

// Meal type categories with German search terms (expanded for 200k+ recipes)
const MEAL_TYPE_SEARCHES: Record<string, string[]> = {
  // Petit-dejeuner / Breakfast
  breakfast: [
    // Classiques
    'frühstück',      // breakfast
    'müsli',          // muesli
    'haferflocken',   // oatmeal
    'pfannkuchen',    // pancakes
    'smoothie',       // smoothie
    'joghurt',        // yogurt
    'eier frühstück', // eggs breakfast
    'toast',          // toast
    'porridge',       // porridge
    'omelett',        // omelet
    // Nouveaux termes
    'waffeln',        // waffles
    'crêpes',         // crepes
    'granola',        // granola
    'bircher',        // bircher muesli
    'rührei',         // scrambled eggs
    'spiegelei',      // fried eggs
    'pochierte eier', // poached eggs
    'eggs benedict',  // eggs benedict
    'french toast',   // french toast
    'açai bowl',      // acai bowl
    'chia pudding',   // chia pudding
    'overnight oats', // overnight oats
    'bagel',          // bagel
    'croissant',      // croissant
    'brötchen',       // bread rolls
    'avocado toast',  // avocado toast
    'shakshuka',      // shakshuka
    'quark',          // quark
    'hüttenkäse',     // cottage cheese
    'obstsalat',      // fruit salad
    'bananenbrot',    // banana bread
    'muffins gesund', // healthy muffins
    'protein frühstück', // protein breakfast
    'low carb frühstück', // low carb breakfast
    'veganes frühstück',  // vegan breakfast
  ],
  // Dejeuner / Lunch
  lunch: [
    // Classiques
    'salat',          // salad
    'sandwich',       // sandwich
    'wrap',           // wrap
    'bowl',           // bowl
    'quiche',         // quiche
    'suppe mittag',   // lunch soup
    'pasta salat',    // pasta salad
    'baguette',       // baguette
    'falafel',        // falafel
    'buddha bowl',    // buddha bowl
    // Nouveaux termes
    'couscous salat', // couscous salad
    'quinoa salat',   // quinoa salad
    'linsen salat',   // lentil salad
    'kichererbsen',   // chickpeas
    'taboulé',        // tabbouleh
    'poke bowl',      // poke bowl
    'burrito bowl',   // burrito bowl
    'grain bowl',     // grain bowl
    'mediterran',     // mediterranean
    'griechisch salat', // greek salad
    'caesar salat',   // caesar salad
    'nizza salat',    // nicoise salad
    'thunfisch salat', // tuna salad
    'hähnchen salat', // chicken salad
    'gazpacho',       // gazpacho
    'minestrone',     // minestrone
    'tomatensuppe',   // tomato soup
    'gemüsesuppe',    // vegetable soup
    'linsensuppe',    // lentil soup
    'erbsensuppe',    // pea soup
    'brokkoli suppe', // broccoli soup
    'karotten suppe', // carrot soup
    'kürbissuppe',    // pumpkin soup
    'flammkuchen',    // tarte flambée
    'bruschetta',     // bruschetta
    'focaccia',       // focaccia
    'panini',         // panini
    'ciabatta',       // ciabatta
    'pita',           // pita
    'tortilla',       // tortilla
    'taco',           // taco
    'quesadilla',     // quesadilla
    'empanada',       // empanada
    'spring rolls',   // spring rolls
    'sommerrollen',   // summer rolls
    'sushi',          // sushi
    'onigiri',        // onigiri
    'bento',          // bento
    'mezze',          // mezze
    'antipasti',      // antipasti
    'tapas',          // tapas
    'vegetarisch mittag', // vegetarian lunch
    'vegan mittag',   // vegan lunch
    'schnell mittag', // quick lunch
    'meal prep',      // meal prep
    'to go',          // to go
  ],
  // Collation / Snack
  snack: [
    // Classiques
    'snack',          // snack
    'nüsse',          // nuts
    'energy balls',   // energy balls
    'riegel',         // bars
    'smoothie bowl',  // smoothie bowl
    'hummus',         // hummus
    'chips',          // chips (healthy)
    'müsliriegel',    // granola bar
    'obst snack',     // fruit snack
    'nachtisch',      // dessert/snack
    // Nouveaux termes
    'protein riegel', // protein bars
    'energy bites',   // energy bites
    'bliss balls',    // bliss balls
    'dattel kugeln',  // date balls
    'haferkekse',     // oat cookies
    'protein kugeln', // protein balls
    'mandeln',        // almonds
    'cashew',         // cashews
    'walnüsse',       // walnuts
    'studentenfutter', // trail mix
    'trockenfrüchte', // dried fruits
    'edamame',        // edamame
    'gemüse sticks',  // veggie sticks
    'guacamole',      // guacamole
    'tzatziki',       // tzatziki
    'baba ganoush',   // baba ganoush
    'cracker',        // crackers
    'reiswaffeln',    // rice cakes
    'popcorn',        // popcorn
    'apfelchips',     // apple chips
    'gemüsechips',    // veggie chips
    'kale chips',     // kale chips
    'grünkohl chips', // kale chips german
    'rohkost',        // raw food
    'nicecream',      // nice cream
    'frozen joghurt', // frozen yogurt
    'eis gesund',     // healthy ice cream
    'sorbet',         // sorbet
    'obstspiesse',    // fruit skewers
    'beeren',         // berries
    'smoothie',       // smoothie
    'lassi',          // lassi
    'matcha',         // matcha
    'golden milk',    // golden milk
    'protein shake',  // protein shake
    'leichte snacks', // light snacks
    'gesunde snacks', // healthy snacks
    'kalorienarm',    // low calorie
  ],
  // Diner / Dinner
  dinner: [
    // Classiques
    'huhn',           // chicken
    'lachs',          // salmon
    'rindfleisch',    // beef
    'fisch',          // fish
    'tofu',           // tofu
    'curry',          // curry
    'pasta',          // pasta
    'risotto',        // risotto
    'eintopf',        // stew
    'braten',         // roast
    'auflauf',        // casserole
    'grill',          // grill
    'suppe abend',    // dinner soup
    'schnitzel',      // schnitzel
    'wok',            // wok/stir-fry
    // Volaille
    'hähnchenbrust',  // chicken breast
    'hähnchenfilet',  // chicken fillet
    'putenbrust',     // turkey breast
    'hähnchen ofen',  // oven chicken
    'hähnchen pfanne', // pan chicken
    'chicken teriyaki', // chicken teriyaki
    // Poissons et fruits de mer
    'lachsfilet',     // salmon fillet
    'forelle',        // trout
    'kabeljau',       // cod
    'seelachs',       // pollock
    'thunfischsteak', // tuna steak
    'dorade',         // sea bream
    'zander',         // pike-perch
    'garnelen',       // shrimp
    'scampi',         // scampi
    'muscheln',       // mussels
    'calamari',       // calamari
    'fischfilet',     // fish fillet
    // Viandes
    'schweinefilet',  // pork fillet
    'kalbfleisch',    // veal
    'lamm',           // lamb
    'rindersteak',    // beef steak
    'hackfleisch',    // ground meat
    'frikadellen',    // meatballs
    'fleischbällchen', // meatballs
    'gyros',          // gyros
    'köfte',          // kofte
    // Végétarien/Vegan
    'tempeh',         // tempeh
    'seitan',         // seitan
    'linsen',         // lentils
    'bohnen',         // beans
    'kichererbsen curry', // chickpea curry
    'gemüsecurry',    // vegetable curry
    'vegetarisch',    // vegetarian
    'vegan abendessen', // vegan dinner
    'pflanzlich',     // plant-based
    // Pâtes et riz
    'spaghetti',      // spaghetti
    'penne',          // penne
    'tagliatelle',    // tagliatelle
    'lasagne',        // lasagna
    'gnocchi',        // gnocchi
    'nudeln',         // noodles
    'reis',           // rice
    'gebratener reis', // fried rice
    'paella',         // paella
    // Cuisine asiatique
    'thai curry',     // thai curry
    'pad thai',       // pad thai
    'ramen',          // ramen
    'pho',            // pho
    'bibimbap',       // bibimbap
    'fried rice',     // fried rice
    'kung pao',       // kung pao
    'sweet sour',     // sweet and sour
    'teriyaki',       // teriyaki
    'miso',           // miso
    'dim sum',        // dim sum
    'dumplings',      // dumplings
    'gyoza',          // gyoza
    // Cuisine méditerranéenne
    'moussaka',       // moussaka
    'souvlaki',       // souvlaki
    'kofta',          // kofta
    'tajine',         // tajine
    'couscous',       // couscous
    'falafel teller', // falafel plate
    'shakshuka dinner', // shakshuka dinner
    // Cuisine indienne
    'tikka masala',   // tikka masala
    'butter chicken', // butter chicken
    'dal',            // dal
    'korma',          // korma
    'vindaloo',       // vindaloo
    'biryani',        // biryani
    'naan',           // naan
    'samosa',         // samosa
    // Cuisine mexicaine
    'burrito',        // burrito
    'enchiladas',     // enchiladas
    'fajitas',        // fajitas
    'chili con carne', // chili con carne
    'nachos',         // nachos
    // Légumes principaux
    'zucchini',       // zucchini
    'aubergine',      // eggplant
    'paprika',        // bell pepper
    'pilze',          // mushrooms
    'champignons',    // mushrooms
    'blumenkohl',     // cauliflower
    'brokkoli',       // broccoli
    'spinat',         // spinach
    'kartoffel',      // potato
    'süßkartoffel',   // sweet potato
    'kürbis',         // pumpkin
    'ratatouille',    // ratatouille
    // Méthodes de cuisson
    'ofengericht',    // oven dish
    'pfannengericht', // pan dish
    'one pot',        // one pot
    'one pan',        // one pan
    'slow cooker',    // slow cooker
    'instant pot',    // instant pot
    'gedämpft',       // steamed
    'gebacken',       // baked
    'gegrillt',       // grilled
    // Diététique
    'low carb',       // low carb
    'high protein',   // high protein
    'kalorienarm',    // low calorie
    'leicht',         // light
    'fitness',        // fitness
    'clean eating',   // clean eating
    'vollkorn',       // whole grain
    'glutenfrei',     // gluten free
    'laktosefrei',    // lactose free
  ],
}

// Get all search terms flattened
const ALL_SEARCH_TERMS = Object.values(MEAL_TYPE_SEARCHES).flat()

// Map to track which meal type each recipe belongs to
const recipeToMealType = new Map<string, string>()

// Types
interface GustarIngredient {
  name: string
  amount: number
  unit: string
}

interface GustarRecipe {
  id: string
  title: string
  description?: string
  image?: string
  prepTime?: number
  cookTime?: number
  servings?: number
  difficulty?: string
  ingredients: GustarIngredient[]
  instructions: string[]
  nutrition?: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  sourceUrl?: string
}

interface EnrichedRecipe {
  id: string
  // French content
  titleFr: string
  descriptionFr: string
  ingredientsFr: Array<{ name: string; amount: number; unit: string }>
  instructionsFr: string[]
  // Nutrition per serving (extended with health data)
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    sugar?: number
    fiber?: number
    saturatedFat?: number
    sodium?: number
  }
  // Health assessment
  healthScore: number // 0-100
  healthNotes?: string
  // Metadata
  imageUrl?: string
  prepTime: number
  cookTime?: number
  totalTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  source: string
  sourceUrl?: string
  // Original data (for reference)
  originalTitle: string
  // Timestamps
  enrichedAt: string
}

/**
 * Post-validation: calculate health penalty based on enriched nutrition data
 * NOW: Never rejects - always returns valid=true with a penalty score
 * Penalty is used to adjust the final healthScore
 */
function validateEnrichedRecipe(
  enriched: Record<string, unknown>,
  mealType: string
): { valid: boolean; penalty: number; warnings: string[] } {
  const nutrition = enriched.nutrition as Record<string, number> | undefined
  if (!nutrition) {
    // Missing nutrition is a penalty but not a rejection
    return { valid: true, penalty: 30, warnings: ['missing nutrition data'] }
  }

  let penalty = 0
  const warnings: string[] = []

  const { calories, fats, sugar, saturatedFat, sodium } = nutrition
  const calorieLimit = CALORIE_LIMITS[mealType as keyof typeof CALORIE_LIMITS] || CALORIE_LIMITS.lunch

  // Check calories
  if (calories > calorieLimit.max * 1.5) {
    penalty += 20
    warnings.push(`very high calories: ${calories}`)
  } else if (calories > calorieLimit.max * 1.1) {
    penalty += 10
    warnings.push(`high calories: ${calories}`)
  }

  // Check fat percentage
  if (calories > 0 && fats) {
    const fatPercentage = (fats * 9 / calories) * 100
    if (fatPercentage > 50) {
      penalty += 15
      warnings.push(`very high fat: ${Math.round(fatPercentage)}%`)
    } else if (fatPercentage > MAX_FAT_PERCENTAGE + 5) {
      penalty += 8
      warnings.push(`high fat: ${Math.round(fatPercentage)}%`)
    }
  }

  // Check sugar (if available)
  if (sugar !== undefined) {
    if (sugar > MAX_SUGAR_DESSERT * 1.5) {
      penalty += 15
      warnings.push(`very high sugar: ${sugar}g`)
    } else if (sugar > MAX_SUGAR_DESSERT) {
      penalty += 8
      warnings.push(`high sugar: ${sugar}g`)
    }
  }

  // Check saturated fat (if available)
  if (saturatedFat !== undefined) {
    if (saturatedFat > MAX_SATURATED_FAT * 2) {
      penalty += 15
      warnings.push(`very high saturated fat: ${saturatedFat}g`)
    } else if (saturatedFat > MAX_SATURATED_FAT * 1.5) {
      penalty += 8
      warnings.push(`high saturated fat: ${saturatedFat}g`)
    }
  }

  // Check sodium (if available)
  if (sodium !== undefined && sodium > MAX_SODIUM_PER_SERVING * 1.5) {
    penalty += 10
    warnings.push(`high sodium: ${sodium}mg`)
  }

  // Always valid - we classify, don't reject
  return { valid: true, penalty, warnings }
}

// Helper: Fetch from Gustar API
async function fetchGustarRecipes(query: string, limit: number = 5): Promise<GustarRecipe[]> {
  const url = `${BASE_URL}/search_api?text=${encodeURIComponent(query)}&limit=${limit}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': RAPIDAPI_KEY,
      },
    })

    if (!response.ok) {
      console.warn(`Gustar API error for "${query}": ${response.status}`)
      return []
    }

    const data = await response.json()
    const recipes = Array.isArray(data) ? data : []

    return recipes.map((item: Record<string, unknown>) => {
      const imageUrls = item.image_urls as string[] | undefined
      const totalTimeSeconds = item.totalTime as number | undefined

      return {
        id: String(item.id || item._id || item.source || Math.random().toString(36).slice(2)),
        title: String(item.title || item.name || 'Untitled'),
        description: item.keywords as string | undefined,
        image: imageUrls?.[0],
        prepTime: totalTimeSeconds ? Math.round(totalTimeSeconds / 60) : undefined,
        servings: item.portions as number | undefined,
        difficulty: item.difficulty as string | undefined,
        ingredients: transformIngredients(item.ingredients),
        instructions: transformInstructions(item.instructions || item.steps),
        nutrition: item.nutrition ? {
          calories: Number((item.nutrition as Record<string, unknown>).calories || 0),
          proteins: Number((item.nutrition as Record<string, unknown>).proteins || 0),
          carbs: Number((item.nutrition as Record<string, unknown>).carbs || 0),
          fats: Number((item.nutrition as Record<string, unknown>).fats || 0),
        } : undefined,
        sourceUrl: item.source as string | undefined,
      }
    })
  } catch (error) {
    console.error(`Error fetching recipes for "${query}":`, error)
    return []
  }
}

function transformIngredients(ingredients: unknown): GustarIngredient[] {
  if (!Array.isArray(ingredients)) return []
  return ingredients.map((ing: unknown) => {
    if (typeof ing === 'string') {
      return { name: ing, amount: 1, unit: '' }
    }
    const i = ing as Record<string, unknown>
    return {
      name: String(i.name || i.ingredient || ''),
      amount: Number(i.amount || i.quantity || 1),
      unit: String(i.unit || ''),
    }
  })
}

function transformInstructions(instructions: unknown): string[] {
  if (!instructions) return []
  if (typeof instructions === 'string') return [instructions]
  if (Array.isArray(instructions)) {
    return instructions.map((step: unknown) =>
      typeof step === 'string' ? step : String((step as Record<string, unknown>).text || step)
    )
  }
  return []
}

// Helper: Enrich recipe with OpenAI
async function enrichRecipeWithAI(recipe: GustarRecipe, mealType: string): Promise<EnrichedRecipe | null> {
  if (!OPENAI_API_KEY) {
    console.error('No OpenAI API key provided')
    return null
  }

  const ingredientsList = recipe.ingredients
    .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`.trim())
    .join('\n')

  const instructionsList = recipe.instructions.length > 0
    ? recipe.instructions.join('\n')
    : 'Aucune instruction fournie'

  const needsNutrition = !recipe.nutrition || recipe.nutrition.calories === 0

  // Get calorie limits for this meal type
  const calorieLimit = CALORIE_LIMITS[mealType as keyof typeof CALORIE_LIMITS] || CALORIE_LIMITS.lunch

  const prompt = `Tu es un chef cuisinier et nutritionniste français expert, spécialisé dans l'alimentation saine et équilibrée.

## RECETTE À ENRICHIR
**Titre:** ${recipe.title}
**Type de repas:** ${mealType} (${mealType === 'breakfast' ? 'petit-déjeuner' : mealType === 'lunch' ? 'déjeuner' : mealType === 'snack' ? 'collation' : 'dîner'})
**Description:** ${recipe.description || 'Aucune description'}
**Portions:** ${recipe.servings || 2}
**Ingrédients:**
${ingredientsList || 'Non spécifiés'}
**Instructions:**
${instructionsList}
${recipe.nutrition ? `**Nutrition source:** ${JSON.stringify(recipe.nutrition)}` : ''}

## RÈGLES NUTRITIONNELLES STRICTES (OMS/ANSES)
- Calories: ${calorieLimit.min}-${calorieLimit.max} kcal par portion pour un ${mealType}
- Sucre: <${MAX_SUGAR_SAVORY}g par portion (plat salé) ou <${MAX_SUGAR_DESSERT}g (sucré)
- Sodium: <${MAX_SODIUM_PER_SERVING}mg par portion
- Graisses saturées: <${MAX_SATURATED_FAT}g par portion
- Ratio lipides: <${MAX_FAT_PERCENTAGE}% des calories
- Protéines: 15-35% des calories
- Glucides: 40-55% des calories

## FORMAT DE RÉPONSE (JSON UNIQUEMENT)
{
  "titleFr": "Titre appétissant en français",
  "descriptionFr": "Description de 2-3 phrases donnant envie",
  "ingredientsFr": [
    { "name": "ingrédient en français", "amount": nombre, "unit": "g/ml/c. à soupe/etc." }
  ],
  "instructionsFr": [
    "Étape 1: ...",
    "Étape 2: ..."
  ],
  "nutrition": {
    "calories": nombre_entier,
    "proteins": nombre_grammes,
    "carbs": nombre_grammes,
    "fats": nombre_grammes,
    "sugar": nombre_grammes,
    "fiber": nombre_grammes,
    "saturatedFat": nombre_grammes,
    "sodium": nombre_mg
  },
  "difficulty": "easy|medium|hard",
  "prepTime": nombre_minutes,
  "healthScore": nombre_0_100,
  "healthNotes": "note sur la qualité nutritionnelle"
}

## INSTRUCTIONS
1. Traduis TOUS les ingrédients en français avec unités métriques précises
2. ${recipe.instructions.length > 0 ? 'Traduis et améliore les instructions' : 'Génère 5-8 étapes détaillées'}
3. CALCULE les macros PRÉCISÉMENT basé sur les ingrédients réels (utilise une base de données nutritionnelle mentale)
4. Si la recette dépasse les limites, ADAPTE les portions ou suggère des substitutions
5. healthScore: 80+ = très sain, 60-79 = correct, <60 = à éviter
6. healthNotes: explique brièvement la qualité nutritionnelle

RÉPONDS UNIQUEMENT AVEC LE JSON, RIEN D'AUTRE.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error(`OpenAI error for "${recipe.title}":`, error)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error(`No response for "${recipe.title}"`)
      return null
    }

    // Parse JSON response
    const cleanJson = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const enriched = JSON.parse(cleanJson)

    // Post-validation: calculate health penalty (no longer rejects)
    const validation = validateEnrichedRecipe(enriched, mealType)

    const prepTime = enriched.prepTime || recipe.prepTime || 20
    const cookTime = recipe.cookTime || Math.round(prepTime * 0.5)

    // Calculate final health score with penalties applied
    const baseHealthScore = enriched.healthScore || getHealthScore(recipe)
    const healthScore = Math.max(0, Math.min(100, baseHealthScore - validation.penalty))

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.log(`    ⚠️  Health warnings for "${recipe.title}": ${validation.warnings.join(', ')} (score: ${healthScore})`)
    }

    return {
      id: recipe.id,
      titleFr: enriched.titleFr,
      descriptionFr: enriched.descriptionFr,
      ingredientsFr: enriched.ingredientsFr || [],
      instructionsFr: enriched.instructionsFr || [],
      nutrition: {
        calories: enriched.nutrition.calories,
        proteins: enriched.nutrition.proteins,
        carbs: enriched.nutrition.carbs,
        fats: enriched.nutrition.fats,
        sugar: enriched.nutrition.sugar,
        fiber: enriched.nutrition.fiber,
        saturatedFat: enriched.nutrition.saturatedFat,
        sodium: enriched.nutrition.sodium,
      },
      healthScore,
      healthNotes: enriched.healthNotes,
      imageUrl: recipe.image,
      prepTime,
      cookTime,
      totalTime: prepTime + cookTime,
      servings: recipe.servings || 2,
      difficulty: enriched.difficulty || 'medium',
      mealType: mealType as 'breakfast' | 'lunch' | 'snack' | 'dinner',
      source: 'Gustar.io',
      sourceUrl: recipe.sourceUrl,
      originalTitle: recipe.title,
      enrichedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Error enriching "${recipe.title}":`, error)
    return null
  }
}

// Main function
async function main() {
  console.log('=== Recipe Pre-Enrichment Script (Accumulative Mode) ===\n')

  if (!OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is required')
    console.log('Usage: OPENAI_API_KEY=sk-xxx npx ts-node scripts/enrich-recipes.ts')
    process.exit(1)
  }

  // Load existing recipes first
  const existingRecipes = loadExistingRecipes()
  const existingIds = new Set(existingRecipes.map(r => r.id))
  const existingTitles = new Set(existingRecipes.map(r => r.originalTitle.toLowerCase()))

  console.log(`\n📊 Current database stats:`)
  const existingPerType: Record<string, number> = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 }
  for (const r of existingRecipes) {
    existingPerType[r.mealType]++
  }
  console.log(`  🌅 Breakfast: ${existingPerType.breakfast}`)
  console.log(`  ☀️  Lunch:     ${existingPerType.lunch}`)
  console.log(`  🍎 Snack:     ${existingPerType.snack}`)
  console.log(`  🌙 Dinner:    ${existingPerType.dinner}`)
  console.log(`  📦 TOTAL:     ${existingRecipes.length}\n`)

  console.log('Step 1: Fetching NEW recipes from Gustar API...\n')

  const newRecipes: GustarRecipe[] = []
  const seenIds = new Set<string>()

  // Track NEW recipes per meal type for balanced distribution
  const newRecipesPerMealType: Record<string, number> = {
    breakfast: 0,
    lunch: 0,
    snack: 0,
    dinner: 0,
  }

  // Target NEW recipes per meal type (balanced distribution)
  const targetPerMealType = Math.ceil(MAX_NEW_RECIPES / 4)

  // Fetch recipes for each meal type
  for (const [mealType, searchTerms] of Object.entries(MEAL_TYPE_SEARCHES)) {
    console.log(`\n📋 ${mealType.toUpperCase()} recipes:`)

    for (const term of searchTerms) {
      // Skip if we already have enough NEW recipes for this meal type
      if (newRecipesPerMealType[mealType] >= targetPerMealType) {
        break
      }

      console.log(`  Searching: "${term}"...`)
      // Fetch more recipes to find new ones (increase limit)
      const recipes = await fetchGustarRecipes(term, 20)

      let newFound = 0
      let withWarnings = 0
      // Add unique recipes only (not in existing DB and not already seen)
      // Note: We no longer skip recipes - all are classified by health quality
      for (const recipe of recipes) {
        const isDuplicate = seenIds.has(recipe.id) ||
                           existingIds.has(recipe.id) ||
                           existingTitles.has(recipe.title.toLowerCase())

        if (isDuplicate) continue

        // Pre-check health criteria (for logging only - no longer rejects)
        const healthCheck = shouldEnrichRecipe(recipe)
        if (healthCheck.healthPenalty > 0) {
          withWarnings++
        }

        if (newRecipesPerMealType[mealType] < targetPerMealType) {
          seenIds.add(recipe.id)
          newRecipes.push(recipe)
          recipeToMealType.set(recipe.id, mealType)
          newRecipesPerMealType[mealType]++
          newFound++
        }
      }

      console.log(`    Found ${recipes.length} total, ${newFound} NEW${withWarnings > 0 ? ` (${withWarnings} with health warnings)` : ''} (${mealType}: ${newRecipesPerMealType[mealType]}/${targetPerMealType})`)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // Summary of fetched recipes
  console.log(`\n=== Fetch Summary ===`)
  console.log(`  NEW Breakfast: ${newRecipesPerMealType.breakfast} recipes`)
  console.log(`  NEW Lunch:     ${newRecipesPerMealType.lunch} recipes`)
  console.log(`  NEW Snack:     ${newRecipesPerMealType.snack} recipes`)
  console.log(`  NEW Dinner:    ${newRecipesPerMealType.dinner} recipes`)
  console.log(`  TOTAL NEW:     ${newRecipes.length} unique recipes\n`)

  // Sort by health score (prioritize healthiest recipes)
  newRecipes.sort((a, b) => getHealthScore(b) - getHealthScore(a))

  // Limit to MAX_NEW_RECIPES
  const recipesToEnrich = newRecipes.slice(0, MAX_NEW_RECIPES)
  console.log(`New recipes to enrich: ${recipesToEnrich.length} (sorted by health score)\n`)

  // Show health score distribution
  if (recipesToEnrich.length > 0) {
    const scores = recipesToEnrich.map(r => getHealthScore(r))
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    console.log(`  📊 Health scores: avg=${avgScore}, min=${minScore}, max=${maxScore}\n`)
  }

  if (recipesToEnrich.length === 0) {
    console.log('✅ No new recipes to enrich - database is up to date!')
    console.log(`   Total recipes in database: ${existingRecipes.length}`)
    process.exit(0)
  }

  console.log('Step 2: Enriching recipes with OpenAI...\n')

  const enrichedRecipes: EnrichedRecipe[] = []
  const batchSize = 3

  for (let i = 0; i < recipesToEnrich.length; i += batchSize) {
    const batch = recipesToEnrich.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(recipesToEnrich.length / batchSize)

    console.log(`  Batch ${batchNum}/${totalBatches}: Enriching ${batch.length} recipes...`)

    const results = await Promise.all(
      batch.map(recipe => {
        const mealType = recipeToMealType.get(recipe.id) || 'dinner'
        return enrichRecipeWithAI(recipe, mealType)
      })
    )

    for (const result of results) {
      if (result) {
        enrichedRecipes.push(result)
        console.log(`    ✓ [${result.mealType}] ${result.titleFr}`)
      } else {
        console.log(`    ✗ Failed`)
      }
    }

    // Delay between batches to avoid rate limiting
    if (i + batchSize < recipesToEnrich.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\nEnriched ${enrichedRecipes.length}/${newRecipes.length} NEW recipes\n`)

  if (enrichedRecipes.length === 0) {
    console.error('No recipes were enriched. Check your OpenAI key.')
    process.exit(1)
  }

  // Step 3: Merge and save to JSON file
  console.log('Step 3: Merging with existing recipes and saving...\n')

  // Create directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Merge existing + new recipes
  const allRecipes = [...existingRecipes, ...enrichedRecipes]

  const output = {
    version: '1.1.0',
    generatedAt: new Date().toISOString(),
    totalRecipes: allRecipes.length,
    recipes: allRecipes,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`✅ Database updated!`)
  console.log(`   Previous: ${existingRecipes.length} recipes`)
  console.log(`   Added:    ${enrichedRecipes.length} NEW recipes`)
  console.log(`   Total:    ${allRecipes.length} recipes\n`)

  // Count total recipes per meal type (existing + new)
  const totalPerMealType: Record<string, number> = {
    breakfast: 0,
    lunch: 0,
    snack: 0,
    dinner: 0,
  }
  for (const recipe of allRecipes) {
    totalPerMealType[recipe.mealType]++
  }

  // Count newly enriched per meal type
  const newPerMealType: Record<string, number> = {
    breakfast: 0,
    lunch: 0,
    snack: 0,
    dinner: 0,
  }
  for (const recipe of enrichedRecipes) {
    newPerMealType[recipe.mealType]++
  }

  // Calculate health statistics
  const allHealthScores = allRecipes.map(r => r.healthScore || 70)
  const avgHealthScore = Math.round(allHealthScores.reduce((a, b) => a + b, 0) / allHealthScores.length)
  const healthyCount = allHealthScores.filter(s => s >= 70).length
  const veryHealthyCount = allHealthScores.filter(s => s >= 85).length

  // Print summary
  console.log('=== Summary ===')
  console.log(`  Previous recipes: ${existingRecipes.length}`)
  console.log(`  New recipes:      ${enrichedRecipes.length}`)
  console.log(`  TOTAL DATABASE:   ${allRecipes.length}`)
  console.log(`  Success rate:     ${Math.round((enrichedRecipes.length / newRecipes.length) * 100)}%`)
  console.log('\n  📊 Total by meal type:')
  console.log(`    🌅 Breakfast: ${totalPerMealType.breakfast} (+${newPerMealType.breakfast} new)`)
  console.log(`    ☀️  Lunch:     ${totalPerMealType.lunch} (+${newPerMealType.lunch} new)`)
  console.log(`    🍎 Snack:     ${totalPerMealType.snack} (+${newPerMealType.snack} new)`)
  console.log(`    🌙 Dinner:    ${totalPerMealType.dinner} (+${newPerMealType.dinner} new)`)
  console.log('\n  🏥 Health Statistics:')
  console.log(`    Average health score: ${avgHealthScore}/100`)
  console.log(`    Healthy recipes (≥70): ${healthyCount} (${Math.round(healthyCount / allRecipes.length * 100)}%)`)
  console.log(`    Very healthy (≥85):    ${veryHealthyCount} (${Math.round(veryHealthyCount / allRecipes.length * 100)}%)`)

  // Sample recipe from each meal type (show healthiest)
  console.log('\n=== Sample Recipes by Meal Type (Healthiest) ===')
  for (const mealType of ['breakfast', 'lunch', 'snack', 'dinner']) {
    // Get healthiest new recipe for this meal type
    const sample = enrichedRecipes
      .filter(r => r.mealType === mealType)
      .sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0))[0]
    if (sample) {
      const emoji = { breakfast: '🌅', lunch: '☀️', snack: '🍎', dinner: '🌙' }[mealType]
      const n = sample.nutrition
      console.log(`\n  ${emoji} ${mealType.toUpperCase()}: ${sample.titleFr}`)
      console.log(`     ${n.calories} kcal | P:${n.proteins}g C:${n.carbs}g F:${n.fats}g`)
      if (n.sugar !== undefined || n.fiber !== undefined) {
        console.log(`     Sugar:${n.sugar || '?'}g | Fiber:${n.fiber || '?'}g | SatFat:${n.saturatedFat || '?'}g`)
      }
      console.log(`     Health score: ${sample.healthScore}/100 ${sample.healthScore >= 80 ? '✅' : sample.healthScore >= 60 ? '⚠️' : '❌'}`)
      if (sample.healthNotes) {
        console.log(`     💡 ${sample.healthNotes}`)
      }
    }
  }
}

main().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
