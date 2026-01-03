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
// Uses CIQUAL database reference for nutritional values
export const FOOD_ANALYSIS_PROMPT = `Analyse cette image de nourriture et identifie tous les aliments visibles.

IMPORTANT: Tu dois fournir:
1. Un TITRE de plat global (ex: "Poulet roti aux legumes", "Salade nicoise", "Pates carbonara")
2. La liste des ingredients identifies avec leurs valeurs nutritionnelles PRECISES basees sur la base CIQUAL

POIDS DE REFERENCE POUR ALIMENTS COMPTABLES (SOURCE: CIQUAL/OFF):
FRUITS A COQUE:
- 1 amande = 1.2g (634 kcal/100g) | 1 noix = 5g (654 kcal/100g) | 1 noisette = 1.5g (628 kcal/100g)
- 1 pistache = 0.6g (562 kcal/100g) | 1 cacahuete = 0.8g (567 kcal/100g) | 1 noix de cajou = 1.5g (553 kcal/100g)

FRUITS & LEGUMES:
- 1 olive verte = 4g (145 kcal/100g) | 1 olive noire = 3g (115 kcal/100g)
- 1 tomate cerise = 15g (18 kcal/100g) | 1 fraise = 12g (32 kcal/100g) | 1 cerise = 8g (63 kcal/100g)
- 1 avocat (chair) = 150g (160 kcal/100g) | 1 banane (sans peau) = 120g (89 kcal/100g)

PROTEINES:
- 1 oeuf = 50g (140 kcal/100g) | 1 crevette = 10g (99 kcal/100g) | 1 tranche jambon = 30g (107 kcal/100g)

PAIN & VIENNOISERIES:
- 1 croissant = 45g (406 kcal/100g) | 1 pain chocolat = 65g (414 kcal/100g) | 1 tranche pain = 30g (265 kcal/100g)

PRODUITS LAITIERS:
- 1 yaourt = 125g (60 kcal/100g) | 1 yaourt grec = 150g (97 kcal/100g)

Si tu vois des aliments comptables (amandes, olives, tomates cerise, etc.):
1. COMPTE le nombre visible
2. MULTIPLIE par le poids unitaire
3. CALCULE les calories: (poids_total / 100) x kcal_100g

Pour chaque aliment, fournis:
- Le nom en francais
- Le poids en grammes (compte x poids_unitaire si applicable)
- Les valeurs nutritionnelles pour ce poids
- Un score de confiance entre 0 et 1

Reponds UNIQUEMENT en JSON avec ce format exact:
{
  "mealTitle": "Titre appetissant du plat",
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

REGLES pour le titre:
- Court et appetissant (2-5 mots)
- En francais
- Exemples: "Steak frites", "Bowl poke saumon", "Poignee d'amandes"

REGLE CRITIQUE pour les calculs:
- Exemple: 10 amandes = 10 x 1.2g = 12g → (12/100) x 634 = 76 kcal

Si tu ne vois pas de nourriture, reponds avec un tableau vide.`

// Reference weights for foods counted by units (knowledge base)
export const UNIT_WEIGHTS_REFERENCE = `
POIDS DE REFERENCE PAR UNITE (utilise ces valeurs exactes):

FRUITS A COQUE & OLEAGINEUX:
- 1 amande = 1.2g (kcal/100g: 634)
- 1 noix = 5g (kcal/100g: 654)
- 1 noix de cajou = 1.5g (kcal/100g: 553)
- 1 noisette = 1.5g (kcal/100g: 628)
- 1 pistache = 0.6g (kcal/100g: 562)
- 1 noix de pecan = 4g (kcal/100g: 691)
- 1 noix de macadamia = 2.5g (kcal/100g: 718)
- 1 noix du Bresil = 5g (kcal/100g: 656)
- 1 cacahuete = 0.8g (kcal/100g: 567)

FRUITS SECS:
- 1 datte Deglet = 8g (kcal/100g: 282)
- 1 datte Medjool = 24g (kcal/100g: 277)
- 1 pruneau = 10g (kcal/100g: 240)
- 1 abricot sec = 8g (kcal/100g: 241)
- 1 figue seche = 20g (kcal/100g: 249)

OLIVES:
- 1 olive verte = 4g (kcal/100g: 145)
- 1 olive noire = 3g (kcal/100g: 115)

OEUFS:
- 1 oeuf moyen = 50g sans coquille (kcal/100g: 140)
- 1 oeuf de caille = 10g (kcal/100g: 158)

FRUITS FRAIS:
- 1 pomme moyenne = 180g (kcal/100g: 52)
- 1 banane moyenne = 120g sans peau (kcal/100g: 89)
- 1 orange moyenne = 150g (kcal/100g: 47)
- 1 clementine = 60g (kcal/100g: 47)
- 1 kiwi = 75g (kcal/100g: 61)
- 1 fraise = 12g (kcal/100g: 32)
- 1 cerise = 8g (kcal/100g: 63)
- 1 grain de raisin = 5g (kcal/100g: 67)

LEGUMES:
- 1 tomate moyenne = 100g (kcal/100g: 18)
- 1 tomate cerise = 15g (kcal/100g: 18)
- 1 carotte moyenne = 80g (kcal/100g: 41)
- 1 avocat = 150g chair (kcal/100g: 160)
- 1 gousse d'ail = 4g (kcal/100g: 149)
- 1 champignon = 15g (kcal/100g: 22)

PAIN & VIENNOISERIES:
- 1 tranche de pain = 30g (kcal/100g: 265)
- 1 croissant = 45g (kcal/100g: 406)
- 1 pain au chocolat = 65g (kcal/100g: 414)

AUTRES:
- 1 yaourt nature = 125g (kcal/100g: 60)
- 1 tranche de jambon = 30g (kcal/100g: 107)
- 1 saucisse/chipolata = 50g (kcal/100g: 268)
- 1 crevette moyenne = 10g (kcal/100g: 99)
`

// Voice/text food description prompt
// Now accepts optional RAG context from CIQUAL/OFF databases
export const FOOD_DESCRIPTION_PROMPT = (description: string, ragContext?: string) => `L'utilisateur decrit son repas: "${description}"

Identifie tous les aliments mentionnes et calcule leurs valeurs nutritionnelles.

${ragContext || UNIT_WEIGHTS_REFERENCE}

REGLES CRITIQUES:
1. Si l'utilisateur mentionne un NOMBRE d'unites (ex: "10 amandes"), tu DOIS utiliser les poids de reference ci-dessus
2. Calcule le poids: poids_total = nombre x poids_unitaire
   Exemple: "10 amandes" = 10 x 1.2g = 12g
3. Calcule les calories: calories = (poids_total / 100) x kcal_par_100g
   Exemple: 12g d'amandes = (12/100) x 634 = 76 kcal
4. Applique la meme logique pour proteines, glucides, lipides

Pour chaque aliment retourne:
- name: nom en francais
- estimatedWeight: poids en grammes (calcule avec les references)
- confidence: score entre 0 et 1
- nutrition: valeurs pour le poids calcule

Reponds UNIQUEMENT en JSON:
{
  "foods": [
    {
      "name": "Amandes",
      "estimatedWeight": 12,
      "confidence": 0.95,
      "nutrition": {
        "calories": 76,
        "proteins": 2.5,
        "carbs": 2.6,
        "fats": 6.2,
        "fiber": 1.5
      }
    }
  ],
  "description": "Resume du repas"
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
