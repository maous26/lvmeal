import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Types
interface SimpleProduct {
  id: string
  name: string
  brand?: string
  imageUrl?: string | null
  nutrition: { calories: number; proteins: number; carbs: number; fats: number }
  servingSize: number
  source: 'openfoodfacts'
}

interface RecipeSuggestion {
  id: string
  title: string
  description: string
  imageUrl: string | null
  prepTime: number
  cookTime: number | null
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  nutrition: { calories: number; proteins: number; carbs: number; fats: number }
  ingredients: { name: string; amount: number | string; unit: string }[]
  instructions: string[]
  tags: string[]
  source: string
  rating: number
  ratingCount: number
}

// "Plats plaisir" (treat recipes) - shown when user has positive caloric balance
const plaisirRecipes: RecipeSuggestion[] = [
  {
    id: 'plaisir-1',
    title: 'Fondant au Chocolat',
    description: 'Gâteau au chocolat fondant au cœur coulant, un vrai délice',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400',
    prepTime: 20,
    cookTime: 12,
    servings: 4,
    difficulty: 'medium',
    nutrition: { calories: 380, proteins: 6, carbs: 42, fats: 22 },
    ingredients: [
      { name: 'Chocolat noir', amount: 200, unit: 'g' },
      { name: 'Beurre', amount: 100, unit: 'g' },
      { name: 'Œufs', amount: 4, unit: 'pièces' },
    ],
    instructions: ['Fondre chocolat et beurre', 'Mélanger avec les œufs battus', 'Cuire 12 min à 180°C'],
    tags: ['Dessert', 'Gourmand', 'Chocolat'],
    source: 'local',
    rating: 4.9,
    ratingCount: 312,
  },
  {
    id: 'plaisir-2',
    title: 'Tiramisu Classique',
    description: 'Le célèbre dessert italien au mascarpone et café',
    imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
    prepTime: 30,
    cookTime: 0,
    servings: 6,
    difficulty: 'medium',
    nutrition: { calories: 420, proteins: 8, carbs: 38, fats: 26 },
    ingredients: [
      { name: 'Mascarpone', amount: 500, unit: 'g' },
      { name: 'Café expresso', amount: 300, unit: 'ml' },
      { name: 'Biscuits cuillère', amount: 200, unit: 'g' },
    ],
    instructions: ['Préparer la crème mascarpone', 'Tremper les biscuits', 'Monter en couches'],
    tags: ['Dessert', 'Italien', 'Sans cuisson'],
    source: 'local',
    rating: 4.8,
    ratingCount: 267,
  },
  {
    id: 'plaisir-3',
    title: 'Crème Brûlée',
    description: 'Crème onctueuse à la vanille avec croûte de caramel craquante',
    imageUrl: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=400',
    prepTime: 15,
    cookTime: 45,
    servings: 4,
    difficulty: 'medium',
    nutrition: { calories: 350, proteins: 5, carbs: 30, fats: 24 },
    ingredients: [
      { name: 'Crème fraîche', amount: 500, unit: 'ml' },
      { name: 'Jaunes d\'œufs', amount: 6, unit: 'pièces' },
      { name: 'Sucre', amount: 100, unit: 'g' },
    ],
    instructions: ['Chauffer la crème avec la vanille', 'Mélanger aux jaunes sucrés', 'Cuire au bain-marie'],
    tags: ['Dessert', 'Français', 'Classique'],
    source: 'local',
    rating: 4.7,
    ratingCount: 189,
  },
  {
    id: 'plaisir-4',
    title: 'Tarte aux Pommes Caramélisées',
    description: 'Tarte rustique aux pommes fondantes et caramel au beurre salé',
    imageUrl: 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=400',
    prepTime: 30,
    cookTime: 40,
    servings: 8,
    difficulty: 'medium',
    nutrition: { calories: 320, proteins: 4, carbs: 45, fats: 14 },
    ingredients: [
      { name: 'Pommes', amount: 6, unit: 'pièces' },
      { name: 'Pâte feuilletée', amount: 1, unit: 'rouleau' },
      { name: 'Beurre salé', amount: 50, unit: 'g' },
    ],
    instructions: ['Étaler la pâte', 'Disposer les pommes', 'Caraméliser et cuire'],
    tags: ['Dessert', 'Tarte', 'Automne'],
    source: 'local',
    rating: 4.6,
    ratingCount: 156,
  },
  {
    id: 'plaisir-5',
    title: 'Burger Gourmet Maison',
    description: 'Burger généreux avec steak haché frais, bacon croustillant et cheddar',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
    prepTime: 20,
    cookTime: 15,
    servings: 4,
    difficulty: 'easy',
    nutrition: { calories: 680, proteins: 38, carbs: 42, fats: 40 },
    ingredients: [
      { name: 'Steak haché', amount: 600, unit: 'g' },
      { name: 'Bacon', amount: 8, unit: 'tranches' },
      { name: 'Cheddar', amount: 150, unit: 'g' },
    ],
    instructions: ['Former les steaks', 'Griller avec le bacon', 'Assembler le burger'],
    tags: ['Plat', 'Gourmand', 'Américain'],
    source: 'local',
    rating: 4.8,
    ratingCount: 245,
  },
  {
    id: 'plaisir-6',
    title: 'Pizza Quatre Fromages',
    description: 'Pizza crémeuse aux quatre fromages : mozzarella, gorgonzola, parmesan et chèvre',
    imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
    prepTime: 25,
    cookTime: 15,
    servings: 4,
    difficulty: 'medium',
    nutrition: { calories: 520, proteins: 22, carbs: 48, fats: 28 },
    ingredients: [
      { name: 'Pâte à pizza', amount: 1, unit: 'pièce' },
      { name: 'Mozzarella', amount: 150, unit: 'g' },
      { name: 'Gorgonzola', amount: 80, unit: 'g' },
    ],
    instructions: ['Étaler la pâte', 'Répartir les fromages', 'Cuire à four très chaud'],
    tags: ['Plat', 'Italien', 'Fromage'],
    source: 'local',
    rating: 4.7,
    ratingCount: 198,
  },
]

// Fallback recipes categorized by meal type
const fallbackRecipesByMealType: Record<string, RecipeSuggestion[]> = {
  breakfast: [
    {
      id: 'breakfast-1',
      title: 'Porridge aux Fruits Rouges',
      description: 'Porridge onctueux aux flocons d\'avoine, lait et fruits rouges frais',
      imageUrl: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400',
      prepTime: 10,
      cookTime: 5,
      servings: 1,
      difficulty: 'easy',
      nutrition: { calories: 320, proteins: 10, carbs: 55, fats: 8 },
      ingredients: [
        { name: 'Flocons d\'avoine', amount: 50, unit: 'g' },
        { name: 'Lait', amount: 200, unit: 'ml' },
        { name: 'Fruits rouges', amount: 100, unit: 'g' },
      ],
      instructions: ['Chauffer le lait', 'Ajouter les flocons', 'Garnir de fruits'],
      tags: ['Petit-déjeuner', 'Healthy', 'Express'],
      source: 'local',
      rating: 4.7,
      ratingCount: 89,
    },
    {
      id: 'breakfast-2',
      title: 'Omelette aux Champignons',
      description: 'Omelette moelleuse aux champignons frais et fines herbes',
      imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400',
      prepTime: 10,
      cookTime: 5,
      servings: 1,
      difficulty: 'easy',
      nutrition: { calories: 280, proteins: 18, carbs: 4, fats: 22 },
      ingredients: [
        { name: 'Œufs', amount: 3, unit: 'pièces' },
        { name: 'Champignons', amount: 100, unit: 'g' },
        { name: 'Ciboulette', amount: 10, unit: 'g' },
      ],
      instructions: ['Faire sauter les champignons', 'Battre les œufs', 'Cuire l\'omelette'],
      tags: ['Petit-déjeuner', 'Keto', 'Protéiné'],
      source: 'local',
      rating: 4.4,
      ratingCount: 67,
    },
    {
      id: 'breakfast-3',
      title: 'Smoothie Bowl Tropical',
      description: 'Bowl de smoothie à la mangue et banane avec granola',
      imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400',
      prepTime: 10,
      cookTime: 0,
      servings: 1,
      difficulty: 'easy',
      nutrition: { calories: 380, proteins: 8, carbs: 65, fats: 10 },
      ingredients: [
        { name: 'Mangue', amount: 150, unit: 'g' },
        { name: 'Banane', amount: 1, unit: 'pièce' },
        { name: 'Granola', amount: 30, unit: 'g' },
      ],
      instructions: ['Mixer les fruits', 'Verser dans un bol', 'Garnir de granola'],
      tags: ['Petit-déjeuner', 'Végétarien', 'Sans cuisson'],
      source: 'local',
      rating: 4.8,
      ratingCount: 112,
    },
  ],
  lunch: [
    {
      id: 'lunch-1',
      title: 'Buddha Bowl Quinoa',
      description: 'Un bol équilibré et coloré avec quinoa, légumes rôtis et avocat',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
      prepTime: 25,
      cookTime: 15,
      servings: 2,
      difficulty: 'easy',
      nutrition: { calories: 450, proteins: 18, carbs: 52, fats: 20 },
      ingredients: [
        { name: 'Quinoa', amount: 150, unit: 'g' },
        { name: 'Avocat', amount: 1, unit: 'pièce' },
        { name: 'Pois chiches', amount: 200, unit: 'g' },
      ],
      instructions: ['Cuire le quinoa', 'Rôtir les légumes', 'Assembler le bowl'],
      tags: ['Déjeuner', 'Healthy', 'Végétarien'],
      source: 'local',
      rating: 4.8,
      ratingCount: 125,
    },
    {
      id: 'lunch-2',
      title: 'Salade César au Poulet',
      description: 'La classique salade César avec poulet grillé et croûtons maison',
      imageUrl: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400',
      prepTime: 15,
      cookTime: 10,
      servings: 2,
      difficulty: 'easy',
      nutrition: { calories: 380, proteins: 32, carbs: 18, fats: 22 },
      ingredients: [
        { name: 'Laitue romaine', amount: 200, unit: 'g' },
        { name: 'Poulet', amount: 250, unit: 'g' },
        { name: 'Parmesan', amount: 50, unit: 'g' },
      ],
      instructions: ['Griller le poulet', 'Préparer la sauce', 'Assembler la salade'],
      tags: ['Déjeuner', 'Protéiné', 'Low-carb'],
      source: 'local',
      rating: 4.5,
      ratingCount: 156,
    },
    {
      id: 'lunch-3',
      title: 'Wrap Poulet Avocat',
      description: 'Wrap frais au poulet grillé, avocat et crudités',
      imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400',
      prepTime: 15,
      cookTime: 10,
      servings: 2,
      difficulty: 'easy',
      nutrition: { calories: 420, proteins: 28, carbs: 35, fats: 18 },
      ingredients: [
        { name: 'Tortilla', amount: 2, unit: 'pièces' },
        { name: 'Poulet', amount: 200, unit: 'g' },
        { name: 'Avocat', amount: 1, unit: 'pièce' },
      ],
      instructions: ['Griller le poulet', 'Préparer les légumes', 'Rouler le wrap'],
      tags: ['Déjeuner', 'À emporter', 'Express'],
      source: 'local',
      rating: 4.6,
      ratingCount: 98,
    },
  ],
  snack: [
    {
      id: 'snack-1',
      title: 'Energy Balls Chocolat',
      description: 'Boules énergétiques aux dattes, cacao et amandes sans cuisson',
      imageUrl: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400',
      prepTime: 15,
      cookTime: 0,
      servings: 12,
      difficulty: 'easy',
      nutrition: { calories: 95, proteins: 3, carbs: 12, fats: 5 },
      ingredients: [
        { name: 'Dattes', amount: 150, unit: 'g' },
        { name: 'Amandes', amount: 100, unit: 'g' },
        { name: 'Cacao', amount: 20, unit: 'g' },
      ],
      instructions: ['Mixer les ingrédients', 'Former des boules', 'Réfrigérer 30 min'],
      tags: ['Goûter', 'Sans cuisson', 'Végétalien'],
      source: 'local',
      rating: 4.9,
      ratingCount: 203,
    },
    {
      id: 'snack-2',
      title: 'Yaourt Grec aux Fruits',
      description: 'Yaourt grec onctueux avec miel et fruits de saison',
      imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
      prepTime: 5,
      cookTime: 0,
      servings: 1,
      difficulty: 'easy',
      nutrition: { calories: 180, proteins: 15, carbs: 22, fats: 4 },
      ingredients: [
        { name: 'Yaourt grec', amount: 150, unit: 'g' },
        { name: 'Miel', amount: 15, unit: 'g' },
        { name: 'Fruits frais', amount: 80, unit: 'g' },
      ],
      instructions: ['Verser le yaourt', 'Ajouter le miel', 'Garnir de fruits'],
      tags: ['Goûter', 'Express', 'Protéiné'],
      source: 'local',
      rating: 4.5,
      ratingCount: 87,
    },
    {
      id: 'snack-3',
      title: 'Banana Bread Healthy',
      description: 'Cake à la banane moelleux, version allégée aux flocons d\'avoine',
      imageUrl: 'https://images.unsplash.com/photo-1605702015480-3b3904c45a68?w=400',
      prepTime: 15,
      cookTime: 45,
      servings: 8,
      difficulty: 'easy',
      nutrition: { calories: 165, proteins: 5, carbs: 28, fats: 4 },
      ingredients: [
        { name: 'Bananes mûres', amount: 3, unit: 'pièces' },
        { name: 'Flocons d\'avoine', amount: 200, unit: 'g' },
        { name: 'Œufs', amount: 2, unit: 'pièces' },
      ],
      instructions: ['Écraser les bananes', 'Mélanger les ingrédients', 'Cuire au four'],
      tags: ['Goûter', 'Healthy', 'Fait maison'],
      source: 'local',
      rating: 4.7,
      ratingCount: 145,
    },
    {
      id: 'snack-4',
      title: 'Muffins aux Myrtilles',
      description: 'Petits muffins moelleux aux myrtilles fraîches',
      imageUrl: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400',
      prepTime: 15,
      cookTime: 25,
      servings: 12,
      difficulty: 'easy',
      nutrition: { calories: 145, proteins: 3, carbs: 22, fats: 5 },
      ingredients: [
        { name: 'Farine', amount: 250, unit: 'g' },
        { name: 'Myrtilles', amount: 150, unit: 'g' },
        { name: 'Sucre', amount: 80, unit: 'g' },
      ],
      instructions: ['Préparer la pâte', 'Ajouter les myrtilles', 'Cuire au four'],
      tags: ['Goûter', 'Pâtisserie', 'Fait maison'],
      source: 'local',
      rating: 4.6,
      ratingCount: 112,
    },
    {
      id: 'snack-5',
      title: 'Smoothie Banane Beurre de Cacahuète',
      description: 'Smoothie onctueux et protéiné, parfait pour le goûter',
      imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400',
      prepTime: 5,
      cookTime: 0,
      servings: 1,
      difficulty: 'easy',
      nutrition: { calories: 320, proteins: 12, carbs: 38, fats: 14 },
      ingredients: [
        { name: 'Banane', amount: 1, unit: 'pièce' },
        { name: 'Beurre de cacahuète', amount: 30, unit: 'g' },
        { name: 'Lait', amount: 250, unit: 'ml' },
      ],
      instructions: ['Mettre tous les ingrédients dans le blender', 'Mixer jusqu\'à obtenir une texture lisse'],
      tags: ['Goûter', 'Express', 'Protéiné'],
      source: 'local',
      rating: 4.8,
      ratingCount: 178,
    },
    {
      id: 'snack-6',
      title: 'Crêpes Légères',
      description: 'Crêpes fines et légères à garnir selon vos envies',
      imageUrl: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=400',
      prepTime: 10,
      cookTime: 15,
      servings: 8,
      difficulty: 'easy',
      nutrition: { calories: 85, proteins: 3, carbs: 14, fats: 2 },
      ingredients: [
        { name: 'Farine', amount: 250, unit: 'g' },
        { name: 'Œufs', amount: 3, unit: 'pièces' },
        { name: 'Lait', amount: 500, unit: 'ml' },
      ],
      instructions: ['Préparer la pâte', 'Laisser reposer', 'Cuire les crêpes'],
      tags: ['Goûter', 'Classique', 'Polyvalent'],
      source: 'local',
      rating: 4.7,
      ratingCount: 234,
    },
  ],
  dinner: [
    {
      id: 'dinner-1',
      title: 'Saumon Teriyaki',
      description: 'Filet de saumon glacé au teriyaki avec riz et légumes sautés',
      imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
      prepTime: 20,
      cookTime: 15,
      servings: 2,
      difficulty: 'medium',
      nutrition: { calories: 520, proteins: 35, carbs: 45, fats: 22 },
      ingredients: [
        { name: 'Saumon', amount: 300, unit: 'g' },
        { name: 'Sauce teriyaki', amount: 60, unit: 'ml' },
        { name: 'Riz basmati', amount: 200, unit: 'g' },
      ],
      instructions: ['Mariner le saumon', 'Cuire le riz', 'Griller le saumon'],
      tags: ['Dîner', 'Protéiné', 'Asiatique'],
      source: 'local',
      rating: 4.6,
      ratingCount: 89,
    },
    {
      id: 'dinner-2',
      title: 'Curry de Légumes',
      description: 'Curry onctueux aux légumes de saison et lait de coco',
      imageUrl: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400',
      prepTime: 20,
      cookTime: 25,
      servings: 4,
      difficulty: 'easy',
      nutrition: { calories: 320, proteins: 8, carbs: 35, fats: 18 },
      ingredients: [
        { name: 'Légumes mélangés', amount: 500, unit: 'g' },
        { name: 'Lait de coco', amount: 400, unit: 'ml' },
        { name: 'Pâte de curry', amount: 30, unit: 'g' },
      ],
      instructions: ['Faire revenir les légumes', 'Ajouter le curry', 'Mijoter avec le lait de coco'],
      tags: ['Dîner', 'Végétarien', 'Épicé'],
      source: 'local',
      rating: 4.7,
      ratingCount: 98,
    },
    {
      id: 'dinner-3',
      title: 'Poke Bowl Thon',
      description: 'Bowl hawaïen au thon cru mariné, riz et légumes croquants',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=400',
      prepTime: 20,
      cookTime: 15,
      servings: 2,
      difficulty: 'medium',
      nutrition: { calories: 480, proteins: 28, carbs: 55, fats: 16 },
      ingredients: [
        { name: 'Thon frais', amount: 250, unit: 'g' },
        { name: 'Riz à sushi', amount: 200, unit: 'g' },
        { name: 'Edamame', amount: 100, unit: 'g' },
      ],
      instructions: ['Mariner le thon', 'Cuire le riz', 'Dresser le bowl'],
      tags: ['Dîner', 'Healthy', 'Asiatique'],
      source: 'local',
      rating: 4.9,
      ratingCount: 142,
    },
  ],
}

// Search terms for Gustar API by meal type and goal
interface SearchTermsConfig {
  base: string[]
  healthy: string[] // For weight loss / healthy eating
  protein: string[] // For muscle gain
  vegetarian: string[]
  vegan: string[]
}

const searchTermsByMealType: Record<string, SearchTermsConfig> = {
  breakfast: {
    base: ['frühstück', 'pancakes', 'müsli', 'omelette', 'smoothie'],
    healthy: ['haferflocken', 'joghurt', 'obst', 'quark', 'vollkorn'],
    protein: ['ei', 'quark', 'protein', 'rührei', 'skyr'],
    vegetarian: ['vegetarisch frühstück', 'müsli', 'joghurt', 'obst'],
    vegan: ['vegan frühstück', 'haferflocken', 'obst', 'smoothie bowl'],
  },
  lunch: {
    base: ['salat', 'bowl', 'sandwich', 'wrap', 'suppe'],
    healthy: ['salat', 'gemüse', 'leicht', 'kalorienarm', 'suppe'],
    protein: ['hähnchen', 'lachs', 'thunfisch', 'rindfleisch', 'protein bowl'],
    vegetarian: ['vegetarisch', 'gemüse', 'linsen', 'bohnen'],
    vegan: ['vegan', 'tofu', 'kichererbsen', 'linsen'],
  },
  snack: {
    base: ['snack', 'smoothie', 'obst', 'nüsse'],
    healthy: ['obst', 'gemüse sticks', 'nüsse', 'joghurt', 'quark'],
    protein: ['protein riegel', 'quark', 'ei', 'nüsse'],
    vegetarian: ['obst', 'nüsse', 'joghurt'],
    vegan: ['obst', 'nüsse', 'smoothie', 'energy balls'],
  },
  dinner: {
    base: ['abendessen', 'fleisch', 'fisch', 'pasta', 'reis'],
    healthy: ['gemüse', 'fisch', 'hähnchen', 'salat', 'suppe'],
    protein: ['hähnchen', 'lachs', 'rindfleisch', 'thunfisch', 'garnelen'],
    vegetarian: ['vegetarisch', 'pasta', 'risotto', 'gemüse'],
    vegan: ['vegan', 'curry', 'linsen', 'gemüse', 'tofu'],
  },
}

// Get dynamic search terms based on user profile
function getSearchTermsForProfile(
  mealType: string,
  goal?: string,
  dietType?: string
): string[] {
  const config = searchTermsByMealType[mealType] || searchTermsByMealType.dinner
  let terms = [...config.base]

  // Add goal-specific terms
  if (goal === 'weight_loss') {
    terms = [...terms, ...config.healthy]
  } else if (goal === 'muscle_gain') {
    terms = [...terms, ...config.protein]
  }

  // Add diet-specific terms
  if (dietType === 'vegetarian') {
    terms = [...terms, ...config.vegetarian]
  } else if (dietType === 'vegan') {
    terms = [...terms, ...config.vegan]
  }

  // Remove duplicates and return
  return [...new Set(terms)]
}

// Translate recipes from German to French using OpenAI
async function translateRecipesToFrench(recipes: RecipeSuggestion[]): Promise<RecipeSuggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || recipes.length === 0) {
    return recipes
  }

  try {
    const openai = new OpenAI({ apiKey })

    const recipesInfo = recipes.map((r, i) => {
      const ingredientsList = r.ingredients
        .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`)
        .join(', ')

      return `[Recette ${i + 1}]
ID: ${r.id}
Titre: ${r.title}
Ingrédients: ${ingredientsList}`
    }).join('\n\n')

    const prompt = `Tu es un expert en traduction culinaire. Traduis ces ${recipes.length} recettes allemandes en français.

${recipesInfo}

Réponds UNIQUEMENT avec un JSON valide (sans markdown) contenant un tableau:
[
  {
    "id": "id_de_la_recette",
    "titleFr": "Titre traduit en français (naturel et appétissant)",
    "descriptionFr": "Description courte et appétissante en français (1-2 phrases)"
  }
]

Important: Réponds UNIQUEMENT avec le JSON, rien d'autre.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const translations = JSON.parse(cleanJson) as { id: string; titleFr: string; descriptionFr: string }[]

    // Merge translations with original recipes
    return recipes.map(recipe => {
      const translation = translations.find(t => t.id === recipe.id)
      if (translation) {
        return {
          ...recipe,
          title: translation.titleFr,
          description: translation.descriptionFr,
        }
      }
      return recipe
    })
  } catch (error) {
    console.error('Translation error:', error)
    return recipes // Return untranslated if translation fails
  }
}

// Healthy snack terms for Open Food Facts search
const healthySnackTerms = [
  'yaourt nature',
  'fruits secs',
  'amandes',
  'noix',
  'compote sans sucre',
  'fromage blanc',
  'skyr',
  'pomme',
  'banane',
  'carotte',
]

// Fetch simple healthy products from Open Food Facts for snacks
async function fetchHealthyProducts(
  limit: number,
  goal?: string
): Promise<SimpleProduct[]> {
  try {
    // Select appropriate search term based on goal
    let searchTerms = healthySnackTerms
    if (goal === 'muscle_gain') {
      searchTerms = ['skyr', 'fromage blanc', 'yaourt protéiné', 'amandes', 'noix']
    } else if (goal === 'weight_loss') {
      searchTerms = ['compote sans sucre', 'yaourt 0%', 'pomme', 'carotte', 'concombre']
    }

    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]

    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(randomTerm)}&search_simple=1&action=process&json=1&page_size=${limit}&lc=fr&countries_tags=france`,
      {
        headers: {
          'User-Agent': 'LYM-NutritionApp/1.0',
        },
        next: { revalidate: 3600 },
      }
    )

    if (!response.ok) {
      console.error('Open Food Facts API error:', response.status)
      return []
    }

    const data = await response.json()
    const products = data.products || []

    return products
      .filter((p: Record<string, unknown>) => {
        const name = p.product_name_fr || p.product_name
        const hasNutrition = p.nutriments && (p.nutriments as Record<string, number>)['energy-kcal_100g']
        return name && hasNutrition
      })
      .slice(0, limit)
      .map((p: Record<string, unknown>): SimpleProduct => {
        const nutriments = p.nutriments as Record<string, number>
        return {
          id: `off-${p.code}`,
          name: String(p.product_name_fr || p.product_name),
          brand: p.brands ? String(p.brands) : undefined,
          imageUrl: p.image_url ? String(p.image_url) : null,
          nutrition: {
            calories: Math.round(nutriments['energy-kcal_100g'] || 0),
            proteins: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
            carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
            fats: Math.round((nutriments.fat_100g || 0) * 10) / 10,
          },
          servingSize: p.serving_size ? parseFloat(String(p.serving_size)) || 100 : 100,
          source: 'openfoodfacts',
        }
      })
  } catch (error) {
    console.error('Error fetching from Open Food Facts:', error)
    return []
  }
}

// Convert simple product to recipe format for display
function productToRecipe(product: SimpleProduct): RecipeSuggestion {
  return {
    id: product.id,
    title: product.name + (product.brand ? ` (${product.brand})` : ''),
    description: `Produit simple et rapide à consommer`,
    imageUrl: product.imageUrl ?? null,
    prepTime: 0,
    cookTime: null,
    servings: 1,
    difficulty: 'easy',
    nutrition: product.nutrition,
    ingredients: [{ name: product.name, amount: product.servingSize, unit: 'g' }],
    instructions: ['Prêt à consommer'],
    tags: ['Snack', 'Rapide', 'Simple'],
    source: 'openfoodfacts',
    rating: 4.0,
    ratingCount: 0,
  }
}

// Fetch recipes from Gustar API with profile-based search terms
async function fetchFromGustar(
  mealType: string,
  limit: number,
  goal?: string,
  dietType?: string
): Promise<RecipeSuggestion[]> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.warn('RAPIDAPI_KEY not configured, skipping Gustar fetch')
    return []
  }

  // Get personalized search terms based on user profile
  const searchTerms = getSearchTermsForProfile(mealType, goal, dietType)
  const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]

  console.log(`Searching Gustar for "${randomTerm}" (meal: ${mealType}, goal: ${goal}, diet: ${dietType})`)

  try {
    const response = await fetch(
      `https://gustar-io-deutsche-rezepte.p.rapidapi.com/search_api?text=${encodeURIComponent(randomTerm)}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'gustar-io-deutsche-rezepte.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
        // Cache for 1 hour
        next: { revalidate: 3600 },
      }
    )

    if (!response.ok) {
      console.error('Gustar API error:', response.status)
      return []
    }

    const data = await response.json()
    const results = Array.isArray(data) ? data : data?.results || []

    // Transform Gustar recipes to our format
    return results.slice(0, limit).map((recipe: Record<string, unknown>, index: number) => {
      const totalTimeMinutes = recipe.totalTime ? Math.round(Number(recipe.totalTime) / 60) : 30

      // Parse ingredients
      let ingredients: { name: string; amount: number | string; unit: string }[] = []
      if (Array.isArray(recipe.ingredients)) {
        ingredients = recipe.ingredients.map((ing: unknown) => {
          if (typeof ing === 'string') {
            return { name: ing, amount: 1, unit: '' }
          }
          const i = ing as Record<string, unknown>
          const amount = i.amount || i.quantity || 1
          return {
            name: String(i.name || i.ingredient || ''),
            amount: typeof amount === 'number' || typeof amount === 'string' ? amount : 1,
            unit: String(i.unit || ''),
          }
        })
      }

      // Parse instructions
      let instructions: string[] = []
      const rawInstructions = recipe.instructions || recipe.steps
      if (typeof rawInstructions === 'string') {
        instructions = [rawInstructions]
      } else if (Array.isArray(rawInstructions)) {
        instructions = rawInstructions.map((step: unknown) => {
          if (typeof step === 'string') return step
          const s = step as Record<string, unknown>
          return String(s.text || s.description || step)
        })
      }

      return {
        id: `gustar-${recipe.id || recipe._id || index}`,
        title: String(recipe.title || recipe.name || 'Recette'),
        description: String(recipe.description || ''),
        imageUrl: Array.isArray(recipe.image_urls) ? recipe.image_urls[0] : (recipe.image as string) || null,
        prepTime: totalTimeMinutes,
        cookTime: recipe.cookTime ? Number(recipe.cookTime) : null,
        servings: Number(recipe.servings || recipe.portions || 4),
        difficulty: 'medium' as const,
        nutrition: {
          calories: Number((recipe.nutrition as Record<string, number>)?.calories || (recipe.nutrition as Record<string, number>)?.kcal || 300),
          proteins: Number((recipe.nutrition as Record<string, number>)?.proteins || (recipe.nutrition as Record<string, number>)?.protein || 15),
          carbs: Number((recipe.nutrition as Record<string, number>)?.carbs || (recipe.nutrition as Record<string, number>)?.carbohydrates || 40),
          fats: Number((recipe.nutrition as Record<string, number>)?.fats || (recipe.nutrition as Record<string, number>)?.fat || 12),
        },
        ingredients,
        instructions,
        tags: [mealType === 'snack' ? 'Goûter' : mealType === 'breakfast' ? 'Petit-déjeuner' : mealType === 'lunch' ? 'Déjeuner' : 'Dîner'],
        source: 'gustar',
        rating: 4.5,
        ratingCount: 0,
      }
    })
  } catch (error) {
    console.error('Error fetching from Gustar:', error)
    return []
  }
}

// Nutrition thresholds for healthy eating
const NUTRITION_LIMITS = {
  // Per serving limits
  sugar: {
    max_standard: 25, // 25g max sugar per serving for standard users
    max_weight_loss: 15, // 15g for weight loss
    max_adaptive: 20, // 20g for adaptive metabolism
  },
  saturatedFat: {
    max_standard: 10, // 10g max saturated fat
    max_weight_loss: 7,
    max_adaptive: 8,
  },
  calories: {
    max_breakfast: 500,
    max_lunch: 650,
    max_dinner: 700,
    max_snack: 250,
    // For weight loss, reduce by 20%
    weight_loss_multiplier: 0.8,
  },
  // Minimum protein per serving (important for all, especially adaptive)
  protein: {
    min_standard: 10,
    min_weight_loss: 15,
    min_muscle_gain: 20,
    min_adaptive: 15,
  },
}

// Check if a recipe is healthy enough based on user profile
function isRecipeHealthy(
  recipe: RecipeSuggestion,
  goal: string,
  mealType: string,
  isAdaptive: boolean
): { isHealthy: boolean; reason?: string } {
  const { nutrition } = recipe

  // Get appropriate limits based on goal
  const sugarLimit = goal === 'weight_loss'
    ? NUTRITION_LIMITS.sugar.max_weight_loss
    : isAdaptive
      ? NUTRITION_LIMITS.sugar.max_adaptive
      : NUTRITION_LIMITS.sugar.max_standard

  const fatLimit = goal === 'weight_loss'
    ? NUTRITION_LIMITS.saturatedFat.max_weight_loss
    : isAdaptive
      ? NUTRITION_LIMITS.saturatedFat.max_adaptive
      : NUTRITION_LIMITS.saturatedFat.max_standard

  // Check calorie limits based on meal type
  const baseCalorieLimit = mealType === 'breakfast'
    ? NUTRITION_LIMITS.calories.max_breakfast
    : mealType === 'lunch'
      ? NUTRITION_LIMITS.calories.max_lunch
      : mealType === 'snack'
        ? NUTRITION_LIMITS.calories.max_snack
        : NUTRITION_LIMITS.calories.max_dinner

  const calorieLimit = goal === 'weight_loss'
    ? baseCalorieLimit * NUTRITION_LIMITS.calories.weight_loss_multiplier
    : baseCalorieLimit

  // Get minimum protein requirement
  const proteinMin = goal === 'muscle_gain'
    ? NUTRITION_LIMITS.protein.min_muscle_gain
    : goal === 'weight_loss'
      ? NUTRITION_LIMITS.protein.min_weight_loss
      : isAdaptive
        ? NUTRITION_LIMITS.protein.min_adaptive
        : NUTRITION_LIMITS.protein.min_standard

  // Validation checks (skip for plaisir recipes)
  if (recipe.tags.includes('Gourmand') || recipe.tags.includes('Dessert')) {
    return { isHealthy: true } // Plaisir recipes are allowed when user has balance
  }

  if (nutrition.calories > calorieLimit) {
    return { isHealthy: false, reason: `Calories too high (${nutrition.calories} > ${calorieLimit})` }
  }

  // For main meals (not snacks), check protein
  if (mealType !== 'snack' && nutrition.proteins < proteinMin) {
    return { isHealthy: false, reason: `Protein too low (${nutrition.proteins} < ${proteinMin})` }
  }

  return { isHealthy: true }
}

// Score a recipe based on how well it matches user profile and needs
function scoreRecipe(
  recipe: RecipeSuggestion,
  context: {
    goal: string
    dietType: string
    isAdaptive: boolean
    mealType: string
    remainingCalories: number
    remainingProteins: number
    allergies: string[]
    likedFoods: string[]
    dislikedFoods: string[]
    stressLevel: number
    sleepHours: number
    energyLevel: number
  }
): number {
  let score = 50 // Base score

  const { nutrition, tags, ingredients, title } = recipe
  const ingredientNames = ingredients.map(i => i.name.toLowerCase())
  const titleLower = title.toLowerCase()
  const allTags = tags.map(t => t.toLowerCase())

  // === EXCLUSION CHECKS (return -1 to exclude) ===

  // Check allergies - MUST exclude
  for (const allergy of context.allergies) {
    const allergyLower = allergy.toLowerCase()
    if (ingredientNames.some(i => i.includes(allergyLower)) || titleLower.includes(allergyLower)) {
      return -1 // Exclude this recipe
    }
  }

  // Check disliked foods - MUST exclude
  for (const dislike of context.dislikedFoods) {
    const dislikeLower = dislike.toLowerCase()
    if (ingredientNames.some(i => i.includes(dislikeLower)) || titleLower.includes(dislikeLower)) {
      return -1 // Exclude this recipe
    }
  }

  // Check diet type compatibility
  if (context.dietType) {
    const dt = context.dietType.toLowerCase()

    // Vegetarian check
    if (dt === 'vegetarian' || dt === 'vegan') {
      const meatTerms = ['poulet', 'boeuf', 'porc', 'viande', 'lard', 'bacon', 'saucisse', 'jambon', 'canard', 'agneau', 'veau', 'dinde', 'chicken', 'beef', 'pork', 'meat']
      const fishTerms = ['poisson', 'saumon', 'thon', 'crevette', 'fruits de mer', 'fish', 'salmon', 'tuna', 'shrimp']

      if (ingredientNames.some(i => meatTerms.some(m => i.includes(m))) || titleLower.match(/poulet|boeuf|viande|porc/)) {
        return -1
      }
      if (dt === 'vegan') {
        const animalTerms = ['oeuf', 'lait', 'fromage', 'beurre', 'crème', 'yaourt', 'miel', 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey']
        if (ingredientNames.some(i => [...fishTerms, ...animalTerms].some(a => i.includes(a)))) {
          return -1
        }
      }
    }

    // Halal check
    if (dt === 'halal') {
      const haramTerms = ['porc', 'lard', 'bacon', 'jambon', 'saucisse de porc', 'gélatine', 'pork', 'ham', 'gelatin']
      if (ingredientNames.some(i => haramTerms.some(h => i.includes(h))) || titleLower.includes('porc')) {
        return -1
      }
    }

    // Casher check
    if (dt === 'casher') {
      const treifTerms = ['porc', 'lard', 'bacon', 'jambon', 'crevette', 'crabe', 'fruits de mer', 'pork', 'shellfish']
      if (ingredientNames.some(i => treifTerms.some(t => i.includes(t)))) {
        return -1
      }
      // No mixing meat and dairy
      const hasMeat = ingredientNames.some(i => ['viande', 'poulet', 'boeuf', 'agneau'].some(m => i.includes(m)))
      const hasDairy = ingredientNames.some(i => ['lait', 'fromage', 'crème', 'beurre'].some(d => i.includes(d)))
      if (hasMeat && hasDairy) {
        return -1
      }
    }
  }

  // === SCORING (higher is better) ===

  // Liked foods bonus
  for (const like of context.likedFoods) {
    const likeLower = like.toLowerCase()
    if (ingredientNames.some(i => i.includes(likeLower)) || titleLower.includes(likeLower)) {
      score += 15
    }
  }

  // Goal-based scoring
  if (context.goal === 'weight_loss') {
    // Prefer lower calorie, higher protein recipes
    if (nutrition.calories < 400) score += 20
    else if (nutrition.calories < 500) score += 10
    else if (nutrition.calories > 600) score -= 15

    if (nutrition.proteins > 25) score += 15
    else if (nutrition.proteins > 20) score += 10

    // Penalize high-fat recipes
    if (nutrition.fats > 30) score -= 10
  } else if (context.goal === 'muscle_gain') {
    // Prefer high protein recipes
    if (nutrition.proteins > 35) score += 25
    else if (nutrition.proteins > 25) score += 15
    else if (nutrition.proteins < 15) score -= 10

    // Adequate calories needed
    if (nutrition.calories > 500 && nutrition.calories < 800) score += 10
  }

  // Adaptive metabolism scoring
  if (context.isAdaptive) {
    // Prioritize protein even more
    if (nutrition.proteins > 20) score += 10

    // Prefer balanced meals, not too restrictive
    if (nutrition.calories >= 350 && nutrition.calories <= 550) score += 10

    // If stressed, suggest comfort foods that are still healthy
    if (context.stressLevel >= 4) {
      if (allTags.some(t => t.includes('réconfort') || t.includes('comfort'))) score += 10
    }

    // If tired/low energy, suggest energizing meals
    if (context.energyLevel <= 2 || context.sleepHours < 6) {
      if (allTags.some(t => t.includes('énergie') || t.includes('energy') || t.includes('boost'))) score += 10
      // Complex carbs for energy
      if (nutrition.carbs > 30 && nutrition.carbs < 60) score += 5
    }
  }

  // Remaining macros fit
  if (context.remainingCalories > 0) {
    // Recipe should fit in remaining calories
    if (nutrition.calories <= context.remainingCalories) {
      score += 10
    } else if (nutrition.calories > context.remainingCalories + 200) {
      score -= 20 // Too many calories for remaining budget
    }
  }

  if (context.remainingProteins > 0) {
    // Bonus for helping reach protein goal
    const proteinContribution = nutrition.proteins / context.remainingProteins
    if (proteinContribution >= 0.3 && proteinContribution <= 0.6) {
      score += 15 // Good protein contribution
    }
  }

  // Meal type appropriateness
  if (context.mealType === 'breakfast') {
    if (allTags.some(t => t.includes('petit-déjeuner') || t.includes('breakfast'))) score += 10
    if (nutrition.calories > 500) score -= 10
  } else if (context.mealType === 'snack') {
    if (allTags.some(t => t.includes('goûter') || t.includes('snack') || t.includes('collation'))) score += 10
    if (nutrition.calories > 300) score -= 15
    if (nutrition.calories <= 200) score += 10
  }

  // Recipe quality indicators
  if (recipe.rating >= 4.5) score += 10
  else if (recipe.rating >= 4.0) score += 5

  // Prefer easier recipes for weekdays
  const isWeekend = [0, 6].includes(new Date().getDay())
  if (!isWeekend && recipe.difficulty === 'easy') score += 5
  if (!isWeekend && recipe.difficulty === 'hard') score -= 5

  return Math.max(0, Math.min(100, score))
}

// Get personalized recipe suggestions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Basic params
  const limit = parseInt(searchParams.get('limit') || '6')
  const mealType = searchParams.get('mealType') // breakfast, lunch, dinner, snack
  const caloricBalance = parseInt(searchParams.get('caloricBalance') || '0')
  const currentDay = parseInt(searchParams.get('currentDay') || '0') // 0-indexed day of the week (0=day1, 6=day7)

  // User profile params
  const userGoal = searchParams.get('goal') || '' // weight_loss, muscle_gain, maintenance
  const dietType = searchParams.get('dietType') || '' // vegetarian, vegan, halal, casher, etc.
  const metabolismProfile = searchParams.get('metabolismProfile') || 'standard' // standard, adaptive
  const allergies = searchParams.get('allergies')?.split(',').filter(Boolean) || []
  const likedFoods = searchParams.get('likedFoods')?.split(',').filter(Boolean) || []
  const dislikedFoods = searchParams.get('dislikedFoods')?.split(',').filter(Boolean) || []
  const activityLevel = searchParams.get('activityLevel') || 'moderate'
  const gender = searchParams.get('gender') || ''
  const age = parseInt(searchParams.get('age') || '0')
  const weight = parseFloat(searchParams.get('weight') || '0')

  // Target params
  const calorieTarget = parseInt(searchParams.get('calorieTarget') || '2100')
  const proteinTarget = parseInt(searchParams.get('proteinTarget') || '120')

  // Today's consumption (to suggest complementary meals)
  const consumedCalories = parseInt(searchParams.get('consumedCalories') || '0')
  const consumedProteins = parseInt(searchParams.get('consumedProteins') || '0')
  const consumedCarbs = parseInt(searchParams.get('consumedCarbs') || '0')
  const consumedFats = parseInt(searchParams.get('consumedFats') || '0')

  // Wellness params (for adaptive profiles)
  const stressLevel = parseInt(searchParams.get('stressLevel') || '0')
  const sleepHours = parseFloat(searchParams.get('sleepHours') || '0')
  const energyLevel = parseInt(searchParams.get('energyLevel') || '0')
  const wellnessScore = parseInt(searchParams.get('wellnessScore') || '0')

  // Calculate remaining macros for the day
  const remainingCalories = Math.max(0, calorieTarget - consumedCalories)
  const remainingProteins = Math.max(0, proteinTarget - consumedProteins)

  // Get current hour to determine meal type suggestion
  const hour = new Date().getHours()
  let suggestedMealType = mealType
  if (!suggestedMealType) {
    if (hour >= 6 && hour < 10) suggestedMealType = 'breakfast'
    else if (hour >= 11 && hour < 14) suggestedMealType = 'lunch'
    else if (hour >= 18 && hour < 22) suggestedMealType = 'dinner'
    else suggestedMealType = 'snack'
  }

  // "Plats plaisir" rules:
  // 1. Only available from day 5 to day 7 (index 4, 5, or 6) of the user's 7-day period
  //    (The 7-day period starts from when user resets their caloric bank, not calendar week)
  // 2. Total caloric balance must be positive and <= 3500 kcal
  // 3. Only for snack or dinner meals
  const isPlaisirDay = currentDay >= 4 // Day 5 (index 4), Day 6 (index 5), or Day 7 (index 6)
  const hasValidBalance = caloricBalance > 0 && caloricBalance <= 3500
  const canHavePlaisir = isPlaisirDay && hasValidBalance
  const showPlaisirRecipes = canHavePlaisir && (suggestedMealType === 'snack' || suggestedMealType === 'dinner')
  const isAdaptive = metabolismProfile === 'adaptive'

  let recipes: RecipeSuggestion[] = []
  let personalized = false

  // 1. Try to fetch from database first
  try {
    const { prisma } = await import('@/lib/prisma')
    const { authOptions } = await import('@/lib/auth')
    const { getServerSession } = await import('next-auth')

    const session = await getServerSession(authOptions)

    // Get user profile for personalization
    let userProfile: {
      goal: string | null
      dietType: string | null
      allergies: string[]
      dailyCalories: number | null
    } | null = null
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          profile: {
            select: {
              goal: true,
              dietType: true,
              allergies: true,
              dailyCalories: true,
            },
          },
        },
      })
      userProfile = user?.profile ?? null
      personalized = !!userProfile
    }

    // Build query based on user profile
    const where: Record<string, unknown> = {}

    // Calculate max prep time based on day (default values since cookingTime fields not in schema)
    const isWeekend = [0, 6].includes(new Date().getDay())
    const maxPrepTime = isWeekend ? 60 : 30

    if (maxPrepTime <= 30) {
      where.totalTime = { lte: maxPrepTime }
    }

    // Get top-rated recipes matching criteria
    const dbRecipes = await prisma.recipe.findMany({
      where,
      orderBy: [
        { rating: 'desc' },
        { ratingCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit * 2,
    })

    // Transform database recipes
    recipes = dbRecipes.map((recipe) => {
      return {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description || '',
        imageUrl: recipe.imageUrl,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty as 'easy' | 'medium' | 'hard',
        nutrition: {
          calories: recipe.caloriesPerServing,
          proteins: recipe.proteinsPerServing,
          carbs: recipe.carbsPerServing,
          fats: recipe.fatsPerServing,
        },
        ingredients: [], // Will be loaded separately if needed
        instructions: recipe.instructions || [],
        tags: recipe.tags || [],
        allergens: recipe.allergens || [],
        source: recipe.source,
        rating: recipe.rating,
        ratingCount: recipe.ratingCount,
      }
    })

    // Filter by allergies
    if (userProfile?.allergies && userProfile.allergies.length > 0) {
      const avoid = userProfile.allergies.map((a: string) => a.toLowerCase())

      recipes = recipes.filter((recipe) => {
        // Check allergens field on recipe
        const recipeAllergens = recipe.allergens.map((a: string) => a.toLowerCase())
        return !avoid.some((a) => recipeAllergens.includes(a))
      })
    }
  } catch (error) {
    console.warn('Database unavailable:', error)
  }

  // 2. If not enough recipes from DB, fetch from Gustar API with profile-based terms and translate
  if (recipes.length < limit) {
    let gustarRecipes = await fetchFromGustar(
      suggestedMealType,
      limit - recipes.length,
      userGoal,
      dietType
    )

    // Translate Gustar recipes to French
    if (gustarRecipes.length > 0) {
      gustarRecipes = await translateRecipesToFrench(gustarRecipes)
    }

    recipes = [...recipes, ...gustarRecipes]
  }

  // 3. For snacks, also fetch simple healthy products from Open Food Facts
  if (suggestedMealType === 'snack' && recipes.length < limit) {
    const productsNeeded = Math.min(2, limit - recipes.length) // Add up to 2 simple products
    const healthyProducts = await fetchHealthyProducts(productsNeeded, userGoal)

    if (healthyProducts.length > 0) {
      const productRecipes = healthyProducts.map(productToRecipe)
      recipes = [...recipes, ...productRecipes]
    }
  }

  // 4. If still not enough, use categorized fallback recipes (already in French)
  // Filter by user profile if available
  if (recipes.length < limit) {
    let fallbackForMealType = fallbackRecipesByMealType[suggestedMealType] || fallbackRecipesByMealType.dinner

    // Filter fallback recipes based on user profile
    if (userGoal === 'weight_loss') {
      // Prioritize low-calorie recipes (< 400 kcal)
      fallbackForMealType = [...fallbackForMealType].sort((a, b) => a.nutrition.calories - b.nutrition.calories)
    } else if (userGoal === 'muscle_gain') {
      // Prioritize high-protein recipes
      fallbackForMealType = [...fallbackForMealType].sort((a, b) => b.nutrition.proteins - a.nutrition.proteins)
    }

    // Filter by diet type
    if (dietType === 'vegetarian' || dietType === 'vegan') {
      fallbackForMealType = fallbackForMealType.filter(r =>
        r.tags.some(t => t.toLowerCase().includes('végétarien') || t.toLowerCase().includes('végétalien'))
      )
    }

    const needed = limit - recipes.length
    recipes = [...recipes, ...fallbackForMealType.slice(0, needed)]
  }

  // 5. Apply comprehensive scoring and filtering based on ALL user criteria
  const scoringContext = {
    goal: userGoal,
    dietType,
    isAdaptive,
    mealType: suggestedMealType,
    remainingCalories,
    remainingProteins,
    allergies,
    likedFoods,
    dislikedFoods,
    stressLevel,
    sleepHours,
    energyLevel,
  }

  // Score and filter all recipes
  const scoredRecipes = recipes
    .map(recipe => ({
      recipe,
      score: scoreRecipe(recipe, scoringContext),
    }))
    .filter(({ score }) => score >= 0) // Remove excluded recipes (score = -1)
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .map(({ recipe }) => recipe)

  recipes = scoredRecipes

  // 6. If user has positive caloric balance on day 5-7, add 1-2 "plats plaisir" to suggestions
  // Replace last 1-2 healthy recipes with treat recipes
  if (showPlaisirRecipes && recipes.length >= 2) {
    // Filter plaisir recipes by diet type too
    let eligiblePlaisir = plaisirRecipes

    // For halal/casher, filter out pork-based plaisir
    if (dietType === 'halal' || dietType === 'casher') {
      eligiblePlaisir = eligiblePlaisir.filter(r => {
        const ingredients = r.ingredients.map(i => i.name.toLowerCase())
        return !ingredients.some(i => i.includes('porc') || i.includes('lard') || i.includes('bacon'))
      })
    }

    // For vegetarian/vegan, filter plaisir recipes
    if (dietType === 'vegetarian' || dietType === 'vegan') {
      eligiblePlaisir = eligiblePlaisir.filter(r => {
        const title = r.title.toLowerCase()
        const ingredients = r.ingredients.map(i => i.name.toLowerCase())
        const hasMeat = ingredients.some(i => ['viande', 'poulet', 'boeuf', 'porc', 'bacon'].some(m => i.includes(m)))
        return !hasMeat && !title.includes('burger') // Exclude meat burgers
      })
    }

    // Shuffle and pick based on caloric balance
    const shuffledPlaisir = [...eligiblePlaisir].sort(() => Math.random() - 0.5)
    const plaisirCount = caloricBalance >= 400 ? 2 : 1
    const selectedPlaisir = shuffledPlaisir.slice(0, Math.min(plaisirCount, shuffledPlaisir.length))

    if (selectedPlaisir.length > 0) {
      // Replace last recipe(s) with plaisir recipes
      recipes = [...recipes.slice(0, limit - selectedPlaisir.length), ...selectedPlaisir]
    }
  }

  // Determine personalization level based on available data
  const hasProfileData = !!userGoal || !!dietType || allergies.length > 0 || likedFoods.length > 0
  const hasNutritionData = consumedCalories > 0
  const hasWellnessData = stressLevel > 0 || sleepHours > 0 || energyLevel > 0

  const personalizationLevel = hasProfileData && hasNutritionData && hasWellnessData
    ? 'full' // All data available
    : hasProfileData && (hasNutritionData || hasWellnessData)
      ? 'high' // Profile + some tracking data
      : hasProfileData
        ? 'medium' // Only profile data
        : 'basic' // No personalization data

  return NextResponse.json({
    recipes: recipes.slice(0, limit),
    suggestedMealType,
    personalized: personalizationLevel !== 'basic',
    personalizationLevel,
    canHavePlaisir,
    caloricBalance,
    // Additional context for the client
    context: {
      remainingCalories,
      remainingProteins,
      isAdaptive,
      dietType: dietType || null,
      goal: userGoal || null,
    },
  })
}
