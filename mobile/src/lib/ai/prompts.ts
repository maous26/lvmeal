/**
 * AI Prompts for meal planning and food analysis
 * Ported from web app for mobile use
 */

// Main system prompt for meal planning
export const MEAL_PLANNER_SYSTEM_PROMPT = `Tu es un nutritionniste et chef cuisinier francais expert.
Tu crees des recettes simples, equilibrees et delicieuses adaptees au quotidien.

REGLES FONDAMENTALES:
1. Recettes realisables en 30 minutes maximum
2. Ingredients disponibles en supermarche francais
3. Respect strict des contraintes nutritionnelles
4. Variete et equilibre sur la semaine
5. Adaptation aux preferences et allergies
6. Recettes du quotidien, pas de gastronomie complexe`

// Guidelines for everyday recipes
export const SIMPLE_RECIPE_GUIDELINES = `GUIDE RECETTES QUOTIDIENNES:
- Privilegier les cuissons simples: poele, four, vapeur
- Maximum 8 ingredients par recette
- Eviter les ingredients exotiques ou difficiles a trouver
- Privilegier les produits de saison
- Temps de preparation realiste (inclure le temps de lavage, decoupe, etc.)`

// Meal type specific guidelines
export const MEAL_TYPE_GUIDELINES: Record<string, string> = {
  breakfast: `PETIT-DEJEUNER:
- Apport energetique pour bien demarrer la journee
- Privilegier les proteines et glucides complexes
- Options: oeufs, yaourt, pain complet, fruits frais, flocons d'avoine
- Eviter les sucres rapides excessifs`,

  lunch: `DEJEUNER:
- Repas principal de la journee
- Equilibre proteines/legumes/feculents
- Portion genereuse pour tenir l'apres-midi
- Options: viande/poisson + legumes + feculents`,

  snack: `COLLATION:
- Legere mais nutritive (100-200 kcal)
- Privilegier proteines et fibres
- Options: fruits, noix, yaourt, fromage blanc
- Eviter les produits ultra-transformes`,

  dinner: `DINER:
- Plus leger que le dejeuner
- Privilegier legumes et proteines legeres
- Eviter les feculents lourds le soir
- Options: soupe, salade composee, poisson, legumes`,

  cheat_meal: `REPAS PLAISIR (CHEAT MEAL):
- Un moment de pure gourmandise
- Pas de culpabilite, c'est prevu!
- Favorise l'adherence sur le long terme
- Options: burger, pizza, pates cremeuses, dessert genereux`,
}

// Food analysis prompt for photo recognition
export const FOOD_ANALYSIS_PROMPT = `Analyse cette image de nourriture et identifie tous les aliments visibles.

Pour chaque aliment, estime:
1. Le nom en francais
2. Le poids approximatif en grammes
3. Les valeurs nutritionnelles pour ce poids (calories, proteines, glucides, lipides, fibres)
4. Un score de confiance entre 0 et 1

Reponds UNIQUEMENT en JSON avec ce format exact:
{
  "foods": [
    {
      "name": "nom de l'aliment",
      "estimatedWeight": 150,
      "confidence": 0.85,
      "nutrition": {
        "calories": 250,
        "proteins": 12,
        "carbs": 30,
        "fats": 8,
        "fiber": 3
      }
    }
  ],
  "description": "Description courte du repas"
}

Si tu ne vois pas de nourriture, reponds avec un tableau vide et une description expliquant pourquoi.`

// Voice/text food description prompt
export const FOOD_DESCRIPTION_PROMPT = (description: string) => `L'utilisateur decrit son repas: "${description}"

Identifie tous les aliments mentionnes et estime leurs valeurs nutritionnelles.

Pour chaque aliment:
1. Le nom en francais
2. Le poids approximatif en grammes (estime selon les portions typiques)
3. Les valeurs nutritionnelles pour ce poids
4. Un score de confiance entre 0 et 1

Reponds UNIQUEMENT en JSON:
{
  "foods": [
    {
      "name": "nom de l'aliment",
      "estimatedWeight": 150,
      "confidence": 0.85,
      "nutrition": {
        "calories": 250,
        "proteins": 12,
        "carbs": 30,
        "fats": 8,
        "fiber": 3
      }
    }
  ],
  "description": "Resume du repas analyse"
}`

// Recipe generation prompt
export const RECIPE_GENERATION_PROMPT = (params: {
  mealType: string
  description?: string
  maxCalories?: number
  dietType?: string
  restrictions?: string[]
}) => {
  const { mealType, description, maxCalories, dietType, restrictions } = params

  let prompt = `Genere une recette pour un ${mealType} francais.`

  if (description) {
    prompt += `\n\nL'utilisateur souhaite: ${description}`
  }

  if (maxCalories) {
    prompt += `\n\nLe repas ne doit pas depasser ${maxCalories} calories.`
  }

  if (dietType) {
    prompt += `\n\nRegime alimentaire: ${dietType}`
  }

  if (restrictions && restrictions.length > 0) {
    prompt += `\n\nRestrictions: ${restrictions.join(', ')}`
  }

  prompt += `\n\nReponds UNIQUEMENT en JSON avec ce format:
{
  "title": "Nom de la recette",
  "description": "Description courte et appetissante",
  "ingredients": [
    { "name": "ingredient", "amount": "quantite", "calories": 50 }
  ],
  "instructions": ["etape 1", "etape 2"],
  "nutrition": {
    "calories": 450,
    "proteins": 25,
    "carbs": 40,
    "fats": 15
  },
  "prepTime": 30,
  "servings": 2
}`

  return prompt
}

// Translation prompt for German recipes
export const RECIPE_TRANSLATION_PROMPT = (recipe: {
  title: string
  description?: string
  ingredients: { name: string; amount: number; unit: string }[]
  instructions: string[]
}) => `Traduis cette recette allemande en francais et enrichis les informations nutritionnelles.

Recette originale:
- Titre: ${recipe.title}
- Description: ${recipe.description || 'Non fournie'}
- Ingredients: ${JSON.stringify(recipe.ingredients)}
- Instructions: ${JSON.stringify(recipe.instructions)}

Reponds UNIQUEMENT en JSON:
{
  "titleFr": "titre en francais",
  "descriptionFr": "description appetissante en francais",
  "ingredientsFr": [
    { "name": "ingredient traduit", "amount": 150, "unit": "g", "calories": 50 }
  ],
  "instructionsFr": ["etape 1 en francais", "etape 2 en francais"],
  "nutrition": {
    "calories": 450,
    "proteins": 25,
    "carbs": 40,
    "fats": 15,
    "fiber": 5
  }
}`

// Quick recipe prompts for common requests
export const QUICK_RECIPE_PROMPTS: Record<string, string> = {
  fast_healthy: 'Une recette rapide et saine, prete en 15 minutes maximum',
  high_protein: 'Une recette riche en proteines pour la recuperation musculaire',
  vegetarian: 'Une recette vegetarienne gourmande et rassasiante',
  low_carb: 'Une recette pauvre en glucides, style cetogene',
  comfort_food: 'Un plat reconfortant mais equilibre',
  mediterranean: 'Une recette mediterraneenne avec huile d\'olive et legumes frais',
}
