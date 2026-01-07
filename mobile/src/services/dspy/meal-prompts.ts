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
  // Macro targets for this specific meal (calculated from daily targets)
  macroTargets?: {
    proteins: number   // Target proteins for this meal in grams
    carbs: number      // Target carbs for this meal in grams
    fats: number       // Target fats for this meal in grams
  }
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

// ============= GOAL-SPECIFIC MACRO STRATEGIES =============

/**
 * Stratégies de macros selon l'objectif utilisateur
 * Ces priorités guident la sélection des repas pour optimiser les résultats
 *
 * PROMPTS DSPy-OPTIMISÉS:
 * - Chaque objectif a son propre system prompt spécialisé
 * - Les mealGuidelines sont injectées dans le prompt de génération
 * - preferredFoods et avoidFoods guident la sélection RAG
 */
export const GOAL_MACRO_STRATEGIES: Record<string, {
  priority: 'proteins' | 'carbs' | 'fats' | 'balanced'
  proteinMultiplier: number  // g/kg de poids corporel
  carbsStrategy: 'low' | 'moderate' | 'high'
  fatsStrategy: 'low' | 'moderate' | 'high'
  description: string
  systemPrompt: string       // System prompt spécifique à l'objectif
  mealGuidelines: string     // Guidelines pour la génération de repas
  preferredFoods: string[]   // Aliments à privilégier
  avoidFoods: string[]       // Aliments à éviter ou limiter
  mealTypeStrategy: {        // Stratégie par type de repas
    breakfast: string
    lunch: string
    snack: string
    dinner: string
  }
}> = {
  weight_loss: {
    priority: 'proteins',
    proteinMultiplier: 2.0,  // 2g/kg pour préserver la masse musculaire
    carbsStrategy: 'low',     // Glucides plafonnés à 80-150g/jour
    fatsStrategy: 'moderate', // Lipides suffisants pour hormones
    description: 'Perte de poids: Prioriser les protéines pour satiété et masse musculaire',
    systemPrompt: `Tu es un nutritionniste expert en perte de poids durable et santé métabolique.
Ta mission: créer des repas hypocaloriques mais RASSASIANTS, riches en protéines pour préserver la masse musculaire.

PRINCIPES SCIENTIFIQUES PERTE DE POIDS:
1. DÉFICIT CALORIQUE MODÉRÉ: -300 à -500 kcal/jour (pas plus pour éviter l'effet yoyo)
2. PROTÉINES ÉLEVÉES: 2g/kg pour effet thermique + satiété + préservation musculaire
3. FIBRES MAXIMALES: Volume sans calories, régulation glycémique
4. GLUCIDES CONTRÔLÉS: 80-150g/jour, principalement légumes et céréales complètes

OBJECTIFS COMPORTEMENTAUX:
- Chaque repas doit être visuellement appétissant et satisfaisant
- Privilégier les techniques de cuisson sans matière grasse ajoutée
- Proposer des portions volumineuses mais peu caloriques`,
    mealGuidelines: `🎯 STRATÉGIE PERTE DE POIDS:

PROTÉINES (PRIORITÉ ABSOLUE):
• Viser 25-40g de protéines par repas principal
• Sources: poulet, dinde, poisson blanc, oeufs, fromage blanc 0%, tofu
• Commencer chaque repas par la protéine

LÉGUMES (VOLUME & SATIÉTÉ):
• Minimum 200g de légumes par repas principal
• Priorité: légumes verts, courgettes, champignons, tomates
• Crus ou vapeur pour maximiser volume

GLUCIDES (CONTRÔLÉS):
• Féculents UNIQUEMENT au déjeuner si activité physique
• Portion max: 100g cuits (riz, pâtes, quinoa)
• Privilégier légumineuses (protéines + fibres)

À ÉVITER STRICTEMENT:
❌ Sucres ajoutés, sodas, jus de fruits
❌ Féculents raffinés (pain blanc, pâtes blanches)
❌ Sauces industrielles, fritures
❌ Alcool (calories vides + stockage graisse)`,
    preferredFoods: [
      'poulet', 'dinde', 'poisson blanc', 'cabillaud', 'colin', 'thon nature',
      'oeufs', 'fromage blanc 0%', 'skyr', 'yaourt grec 0%',
      'légumes verts', 'courgettes', 'épinards', 'brocoli', 'haricots verts',
      'champignons', 'tomates', 'concombre', 'salade',
      'quinoa', 'lentilles', 'pois chiches'
    ],
    avoidFoods: [
      'pain blanc', 'pâtes blanches', 'riz blanc', 'pommes de terre frites',
      'sucre', 'miel', 'confiture', 'chocolat', 'biscuits', 'viennoiseries',
      'sodas', 'jus de fruits', 'alcool',
      'charcuterie', 'fromages gras', 'crème fraîche',
      'sauces industrielles', 'mayonnaise', 'ketchup'
    ],
    mealTypeStrategy: {
      breakfast: `PETIT-DÉJEUNER HYPERPROTÉINÉ (300-400 kcal):
• Base: fromage blanc 0% ou oeufs (protéines)
• Ajout: fruits rouges (IG bas) + graines (oméga-3)
• Éviter: céréales sucrées, pain blanc, viennoiseries
• Exemple: 200g fromage blanc 0% + 100g framboises + 10g amandes`,
      lunch: `DÉJEUNER ÉQUILIBRÉ (400-500 kcal):
• Protéine maigre: 150g poulet/poisson/tofu
• Légumes: 250g minimum (crus ou vapeur)
• Féculent: 80-100g cuits (optionnel si sédentaire)
• Exemple: Salade poulet grillé + légumes + quinoa`,
      snack: `COLLATION ANTI-FRINGALE (100-150 kcal):
• Option 1: yaourt grec 0% + quelques amandes
• Option 2: légumes crus + houmous maison
• Option 3: oeuf dur + tomate cerise
• Éviter: fruits seuls (pic glycémique)`,
      dinner: `DÎNER LÉGER PROTÉINÉ (350-450 kcal):
• Protéine: poisson ou oeufs (plus léger que viande)
• Légumes: à volonté, cuits vapeur
• PAS de féculents le soir
• Exemple: Papillote de poisson + ratatouille`
    }
  },

  muscle_gain: {
    priority: 'balanced',
    proteinMultiplier: 2.0,  // 2g/kg pour synthèse protéique
    carbsStrategy: 'high',   // Glucides élevés pour énergie et récupération
    fatsStrategy: 'moderate',
    description: 'Prise de muscle: Équilibre protéines-glucides pour anabolisme',
    systemPrompt: `Tu es un nutritionniste sportif spécialisé en prise de masse musculaire propre.
Ta mission: créer des repas anabolisants riches en protéines ET en glucides pour la récupération.

PRINCIPES SCIENTIFIQUES PRISE DE MUSCLE:
1. SURPLUS CALORIQUE CONTRÔLÉ: +200 à +400 kcal/jour (prise de masse sèche)
2. PROTÉINES OPTIMALES: 2g/kg réparties sur 4-5 prises
3. GLUCIDES TIMING: Concentrés autour de l'entraînement
4. REPAS FRÉQUENTS: 4-5 repas pour synthèse protéique continue

OBJECTIFS ANABOLIQUES:
- Chaque repas doit contenir minimum 30g de protéines
- Glucides complexes pour énergie stable et glycogène
- Ne jamais sauter de repas, surtout post-entraînement`,
    mealGuidelines: `💪 STRATÉGIE PRISE DE MUSCLE:

PROTÉINES (SYNTHÈSE MUSCULAIRE):
• 30-45g de protéines par repas principal
• Sources variées: viande, poisson, oeufs, laitages, légumineuses
• Répartir sur 4-5 prises dans la journée

GLUCIDES (ÉNERGIE & RÉCUPÉRATION):
• Glucides complexes à chaque repas
• Post-entraînement: glucides rapides acceptés
• Sources: riz, pâtes, patates douces, avoine, fruits

LIPIDES (HORMONES):
• Ne pas négliger les graisses (testostérone)
• Sources: huile d'olive, avocat, noix, poisson gras
• ~25-30% des calories totales

TIMING NUTRITIONNEL:
⏰ Pré-training (2h avant): glucides complexes + protéines
⏰ Post-training (30min): protéines rapides + glucides
⏰ Avant dormir: caséine ou fromage blanc (protéines lentes)`,
    preferredFoods: [
      'poulet', 'boeuf maigre', 'dinde', 'saumon', 'thon', 'oeufs entiers',
      'fromage blanc', 'skyr', 'whey', 'lait',
      'riz basmati', 'pâtes complètes', 'patate douce', 'avoine', 'quinoa',
      'banane', 'fruits secs', 'miel post-training',
      'avocat', 'huile d\'olive', 'noix', 'amandes',
      'brocoli', 'épinards', 'haricots verts'
    ],
    avoidFoods: [
      'fast-food', 'fritures',
      'sucres raffinés hors post-training',
      'alcool', 'sodas'
    ],
    mealTypeStrategy: {
      breakfast: `PETIT-DÉJEUNER ANABOLIQUE (500-600 kcal):
• Protéines: oeufs entiers (3-4) ou avoine protéinée
• Glucides: flocons d'avoine ou pain complet
• Lipides: beurre de cacahuète ou avocat
• Exemple: Porridge protéiné + oeufs brouillés + banane`,
      lunch: `DÉJEUNER COMPLET (600-700 kcal):
• Protéine: 200g viande ou poisson
• Glucides: 150g riz/pâtes cuits
• Légumes: 200g pour vitamines et fibres
• Exemple: Poulet riz légumes + huile d'olive`,
      snack: `COLLATION PROTÉINÉE (200-300 kcal):
• Pré-training: banane + yaourt grec + miel
• Post-training: shake protéiné + fruit
• Entre repas: fromage blanc + oléagineux
• Objectif: 20-30g protéines`,
      dinner: `DÎNER RECONSTITUANT (500-600 kcal):
• Protéine: poisson gras ou viande rouge 1-2x/sem
• Glucides: patate douce ou légumineuses
• Lipides: poisson gras = oméga-3
• Exemple: Saumon + patate douce + brocoli`
    }
  },

  maintain: {
    priority: 'balanced',
    proteinMultiplier: 1.6,  // 1.6g/kg pour maintien
    carbsStrategy: 'moderate',
    fatsStrategy: 'moderate',
    description: 'Maintien: Répartition équilibrée des macronutriments',
    systemPrompt: `Tu es un nutritionniste équilibré spécialisé dans le maintien d'un poids santé.
Ta mission: créer des repas variés et équilibrés qui maintiennent l'énergie et la santé à long terme.

PRINCIPES DU MAINTIEN:
1. ÉQUILIBRE CALORIQUE: Apports = Dépenses (±100 kcal)
2. RÉPARTITION CLASSIQUE: 30% protéines, 40% glucides, 30% lipides
3. VARIÉTÉ ALIMENTAIRE: Rotation des sources pour tous les nutriments
4. FLEXIBILITÉ: Adaptation selon activité et envies

OBJECTIFS LONG TERME:
- Créer des habitudes durables et plaisantes
- Aucune restriction excessive
- Équilibre entre santé et plaisir`,
    mealGuidelines: `⚖️ STRATÉGIE MAINTIEN:

ÉQUILIBRE MACROS:
• Protéines: 1.6g/kg, sources variées
• Glucides: céréales complètes, fruits, légumineuses
• Lipides: mix saturés/insaturés équilibré

PRINCIPES SIMPLES:
• Règle de l'assiette: 1/4 protéine, 1/4 féculent, 1/2 légumes
• 5 fruits et légumes par jour minimum
• 2 portions de poisson par semaine

FLEXIBILITÉ:
• 80% alimentation saine, 20% plaisir
• Écouter sa faim et sa satiété
• Pas de culpabilité sur les écarts occasionnels`,
    preferredFoods: [
      'tous types de protéines', 'oeufs', 'poisson', 'volaille', 'légumineuses',
      'céréales complètes', 'riz', 'pâtes', 'pain complet',
      'tous les légumes', 'tous les fruits',
      'huile d\'olive', 'huile colza', 'avocat', 'noix',
      'laitages variés'
    ],
    avoidFoods: [
      'excès de sucres ajoutés',
      'excès d\'aliments ultra-transformés',
      'excès d\'alcool'
    ],
    mealTypeStrategy: {
      breakfast: `PETIT-DÉJEUNER ÉQUILIBRÉ (400-450 kcal):
• Options variées: sucré ou salé selon envie
• Protéines: yaourt, oeufs, fromage
• Glucides: pain complet, céréales, fruits
• Exemple: Tartines + oeufs ou Muesli + yaourt + fruits`,
      lunch: `DÉJEUNER STANDARD (500-550 kcal):
• Assiette équilibrée classique
• Protéine + féculent + légumes
• Dessert: fruit ou laitage
• Exemple: Plat complet + fruit`,
      snack: `COLLATION OPTIONNELLE (150-200 kcal):
• Si besoin selon activité
• Fruit + oléagineux
• Ou yaourt + céréales
• Pas obligatoire si pas faim`,
      dinner: `DÎNER MODÉRÉ (450-500 kcal):
• Légèrement plus léger que le déjeuner
• Protéine + légumes + féculent modéré
• Exemple: Poisson + légumes + quinoa`
    }
  },

  maintenance: {
    priority: 'balanced',
    proteinMultiplier: 1.6,
    carbsStrategy: 'moderate',
    fatsStrategy: 'moderate',
    description: 'Maintien: Répartition équilibrée des macronutriments',
    systemPrompt: `Tu es un nutritionniste équilibré spécialisé dans le maintien d'un poids santé.
Ta mission: créer des repas variés et équilibrés qui maintiennent l'énergie et la santé à long terme.

PRINCIPES DU MAINTIEN:
1. ÉQUILIBRE CALORIQUE: Apports = Dépenses (±100 kcal)
2. RÉPARTITION CLASSIQUE: 30% protéines, 40% glucides, 30% lipides
3. VARIÉTÉ ALIMENTAIRE: Rotation des sources pour tous les nutriments
4. FLEXIBILITÉ: Adaptation selon activité et envies`,
    mealGuidelines: `⚖️ STRATÉGIE MAINTIEN:

ÉQUILIBRE MACROS:
• Protéines: 1.6g/kg, sources variées
• Glucides: céréales complètes, fruits, légumineuses
• Lipides: mix saturés/insaturés équilibré

PRINCIPES SIMPLES:
• Règle de l'assiette: 1/4 protéine, 1/4 féculent, 1/2 légumes
• 5 fruits et légumes par jour minimum
• 2 portions de poisson par semaine`,
    preferredFoods: [
      'tous types de protéines', 'oeufs', 'poisson', 'volaille', 'légumineuses',
      'céréales complètes', 'tous les légumes', 'tous les fruits',
      'huile d\'olive', 'laitages variés'
    ],
    avoidFoods: [
      'excès de sucres ajoutés',
      'excès d\'aliments ultra-transformés'
    ],
    mealTypeStrategy: {
      breakfast: `PETIT-DÉJEUNER ÉQUILIBRÉ (400-450 kcal):
• Options variées selon envie
• Protéines + glucides + lipides`,
      lunch: `DÉJEUNER STANDARD (500-550 kcal):
• Assiette équilibrée classique`,
      snack: `COLLATION OPTIONNELLE (150-200 kcal):
• Si besoin selon activité`,
      dinner: `DÎNER MODÉRÉ (450-500 kcal):
• Légèrement plus léger que le déjeuner`
    }
  },

  health: {
    priority: 'balanced',
    proteinMultiplier: 1.4,
    carbsStrategy: 'moderate',
    fatsStrategy: 'moderate',
    description: 'Santé: Focus sur la qualité nutritionnelle et micronutriments',
    systemPrompt: `Tu es un nutritionniste santé spécialisé dans l'alimentation préventive et anti-inflammatoire.
Ta mission: créer des repas riches en micronutriments, antioxydants et acides gras essentiels.

PRINCIPES SANTÉ OPTIMALE:
1. DENSITÉ NUTRITIONNELLE: Maximiser nutriments par calorie
2. ANTI-INFLAMMATOIRE: Oméga-3, polyphénols, fibres
3. DIVERSITÉ: Arc-en-ciel de couleurs = variété de phytonutriments
4. NON-TRANSFORMÉ: Aliments bruts et naturels

OBJECTIFS SANTÉ:
- Prévention des maladies chroniques
- Optimisation de l'énergie et du bien-être
- Santé digestive et microbiote`,
    mealGuidelines: `🌿 STRATÉGIE SANTÉ:

ALIMENTS ANTI-INFLAMMATOIRES:
• Poissons gras: saumon, sardines, maquereau (3x/semaine)
• Légumes crucifères: brocoli, chou, chou-fleur
• Fruits colorés: baies, agrumes, grenade
• Épices: curcuma, gingembre, cannelle

FIBRES & MICROBIOTE:
• 30g+ fibres par jour
• Prébiotiques: ail, oignon, poireau, artichaut
• Probiotiques: yaourt nature, kéfir, choucroute

ANTIOXYDANTS:
• Légumes colorés variés (manger l'arc-en-ciel)
• Fruits entiers (pas en jus)
• Thé vert, cacao pur

À LIMITER:
❌ Aliments ultra-transformés
❌ Sucres ajoutés
❌ Huiles raffinées
❌ Viande rouge (max 2x/semaine)`,
    preferredFoods: [
      'saumon', 'sardines', 'maquereau', 'truite',
      'légumes crucifères', 'brocoli', 'chou kale', 'épinards',
      'baies', 'myrtilles', 'framboises', 'grenade',
      'légumineuses', 'lentilles', 'pois chiches',
      'noix', 'amandes', 'graines de lin', 'graines de chia',
      'avocat', 'huile d\'olive extra vierge',
      'curcuma', 'gingembre', 'ail', 'oignon',
      'yaourt nature', 'kéfir'
    ],
    avoidFoods: [
      'aliments ultra-transformés', 'additifs',
      'sucres ajoutés', 'sirop de glucose',
      'huiles végétales raffinées', 'margarine',
      'charcuterie', 'viande rouge fréquente',
      'alcool régulier'
    ],
    mealTypeStrategy: {
      breakfast: `PETIT-DÉJEUNER ANTIOXYDANT (350-400 kcal):
• Base: yaourt nature ou porridge d'avoine
• Fruits: baies fraîches ou surgelées
• Graines: lin, chia, noix
• Exemple: Bowl açaï ou porridge myrtilles-noix`,
      lunch: `DÉJEUNER MÉDITERRANÉEN (450-500 kcal):
• Protéine: poisson ou légumineuses
• Légumes: variés, colorés, cuits vapeur ou crus
• Céréales: complètes uniquement
• Exemple: Salade composée + sardines + quinoa`,
      snack: `COLLATION SANTÉ (100-150 kcal):
• Fruits frais + oléagineux
• Légumes crus + houmous
• Carré de chocolat noir 85%
• Exemple: Pomme + 5 noix`,
      dinner: `DÎNER LÉGER VÉGÉTAL (350-400 kcal):
• Protéines végétales 2-3x/semaine
• Soupe de légumes maison
• Poisson les autres jours
• Exemple: Soupe lentilles-légumes ou poisson vapeur`
    }
  },

  energy: {
    priority: 'carbs',
    proteinMultiplier: 1.4,
    carbsStrategy: 'high',
    fatsStrategy: 'moderate',
    description: 'Énergie: Glucides complexes pour énergie stable toute la journée',
    systemPrompt: `Tu es un nutritionniste spécialisé dans l'optimisation de l'énergie et la performance cognitive.
Ta mission: créer des repas qui maintiennent une glycémie stable et une énergie constante.

PRINCIPES ÉNERGIE STABLE:
1. INDEX GLYCÉMIQUE: Privilégier IG bas à modéré
2. REPAS RÉGULIERS: Éviter les longues périodes de jeûne
3. GLUCIDES COMPLEXES: Source d'énergie durable
4. HYDRATATION: Essentielle pour l'énergie

OBJECTIFS ÉNERGIE:
- Éviter les coups de fatigue post-repas
- Énergie mentale pour la concentration
- Pas de fringales ni de pics/crashes glycémiques`,
    mealGuidelines: `⚡ STRATÉGIE ÉNERGIE:

GLUCIDES COMPLEXES (CARBURANT):
• Céréales complètes: avoine, quinoa, riz complet
• Légumineuses: énergie progressive
• Patate douce: IG modéré, riche en nutriments
• Fruits entiers (pas en jus): fibres ralentissent absorption

INDEX GLYCÉMIQUE:
• Combiner glucides + protéines/lipides
• Éviter glucides seuls (pic glycémique)
• Privilégier aliments riches en fibres

TIMING ÉNERGÉTIQUE:
⏰ Matin: Petit-déjeuner complet obligatoire
⏰ 10h-16h: Collation si baisse d'énergie
⏰ Soir: Dîner pas trop tardif

HYDRATATION:
💧 2L d'eau minimum par jour
💧 Eau avant chaque repas
💧 Limiter café après 14h`,
    preferredFoods: [
      'avoine', 'quinoa', 'riz complet', 'patate douce', 'pain complet',
      'lentilles', 'pois chiches', 'haricots rouges',
      'banane', 'pomme', 'poire', 'fruits secs',
      'oeufs', 'yaourt', 'fromage blanc',
      'poulet', 'poisson',
      'épinards', 'légumes verts', 'avocat',
      'noix', 'amandes', 'beurre de cacahuète'
    ],
    avoidFoods: [
      'sucres rapides isolés', 'bonbons', 'sodas',
      'céréales sucrées du petit-déjeuner',
      'pain blanc', 'viennoiseries',
      'excès de caféine'
    ],
    mealTypeStrategy: {
      breakfast: `PETIT-DÉJEUNER ÉNERGISANT (450-500 kcal):
• OBLIGATOIRE - Ne jamais sauter!
• Glucides complexes: avoine, pain complet
• Protéines: oeufs, yaourt grec
• Fruits: banane, fruits rouges
• Exemple: Porridge banane-noix + oeuf`,
      lunch: `DÉJEUNER SOUTENU (500-550 kcal):
• Féculents complets généreux
• Protéines pour satiété
• Légumes pour fibres et vitamines
• Exemple: Buddha bowl quinoa-poulet-légumes`,
      snack: `COLLATION ANTI-COUP DE POMPE (150-200 kcal):
• IMPORTANT vers 16h si besoin
• Combo glucides + protéines
• Exemples: banane + amandes, yaourt + muesli
• Éviter: café seul ou sucre seul`,
      dinner: `DÎNER RÉCUPÉRATION (400-450 kcal):
• Pas trop tardif (3h avant coucher)
• Glucides modérés pour sommeil
• Protéines pour récupération nocturne
• Exemple: Saumon + riz complet + légumes`
    }
  },
}

/**
 * Calcule les objectifs de macros pour un repas spécifique
 * basé sur les objectifs journaliers et les ratios de repas
 */
export function calculateMealMacroTargets(
  dailyMacros: { proteins: number; carbs: number; fats: number },
  mealType: string,
  userGoal: string
): { proteins: number; carbs: number; fats: number } {
  const mealRatios = MEAL_CALORIE_RATIOS[mealType] || { ratio: 0.25, tolerance: 0.15 }
  const goalStrategy = GOAL_MACRO_STRATEGIES[userGoal] || GOAL_MACRO_STRATEGIES.maintain

  // Base calculation from daily macros
  let proteins = Math.round(dailyMacros.proteins * mealRatios.ratio)
  let carbs = Math.round(dailyMacros.carbs * mealRatios.ratio)
  let fats = Math.round(dailyMacros.fats * mealRatios.ratio)

  // Adjust based on meal type and goal
  if (goalStrategy.priority === 'proteins') {
    // For weight loss: boost protein ratio in main meals
    if (mealType === 'lunch' || mealType === 'dinner') {
      proteins = Math.round(proteins * 1.2) // 20% more protein
      carbs = Math.round(carbs * 0.8)       // 20% less carbs
    }
  } else if (goalStrategy.priority === 'carbs' && mealType === 'breakfast') {
    // For energy goal: more carbs at breakfast
    carbs = Math.round(carbs * 1.15)
  }

  return { proteins, carbs, fats }
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
 * Utilise les system prompts spécifiques par objectif et les strategies par type de repas
 */
function buildStaticPrompt(
  context: MealGenerationContext,
  sourcePrompts: typeof SOURCE_BASE_PROMPTS['fresh'],
  mealPrompts: typeof MEAL_TYPE_PROMPTS['breakfast']
): OptimizedPromptResult {
  const { mealType, targetCalories, userGoal, dietType, allergies, existingMeals, macroTargets } = context

  // Get goal-specific strategy
  const goalStrategy = GOAL_MACRO_STRATEGIES[userGoal] || GOAL_MACRO_STRATEGIES.maintain

  // Get meal-specific strategy for this goal
  const mealSpecificStrategy = goalStrategy.mealTypeStrategy[mealType as keyof typeof goalStrategy.mealTypeStrategy] || ''

  // Build macro constraints string
  const macroConstraints = macroTargets
    ? `OBJECTIFS MACROS CE REPAS:
- Protéines: ~${macroTargets.proteins}g
- Glucides: ~${macroTargets.carbs}g
- Lipides: ~${macroTargets.fats}g`
    : ''

  // Build preferred/avoid foods hints
  const foodHints = goalStrategy.preferredFoods.length > 0
    ? `ALIMENTS À PRIVILÉGIER: ${goalStrategy.preferredFoods.slice(0, 8).join(', ')}
ALIMENTS À ÉVITER: ${goalStrategy.avoidFoods.slice(0, 5).join(', ')}`
    : ''

  // Use goal-specific system prompt instead of generic source prompt
  const systemPrompt = `${goalStrategy.systemPrompt}

${sourcePrompts.sourceGuidelines}

${mealPrompts.constraints}

${goalStrategy.mealGuidelines}

${mealSpecificStrategy}

${dietType ? `RÉGIME ALIMENTAIRE: ${dietType}` : ''}
${allergies?.length ? `ALLERGIES/INTOLÉRANCES: ${allergies.join(', ')}` : ''}`

  const userPrompt = `Génère un ${mealTypeFrench(mealType)} de ${targetCalories} kcal pour objectif: ${goalToFrench(userGoal)}.

CONTRAINTES STRICTES:
- Calories cibles: ${targetCalories} kcal (±50 kcal max)
- Focus macros: ${mealPrompts.macroFocus}
${macroConstraints}

${foodHints}

${existingMeals?.length ? `ÉVITER (déjà consommés): ${existingMeals.slice(-5).join(', ')}` : ''}

Exemples inspirants: ${sourcePrompts.examples.slice(0, 2).join(', ')}

RÉPONDS EN JSON STRICT:
{
  "title": "Nom appétissant du plat",
  "description": "Description courte et engageante",
  "ingredients": [{"name": "ingrédient", "amount": "quantité", "calories": X}],
  "instructions": ["Étape 1", "Étape 2", ...],
  "nutrition": {"calories": X, "proteins": X, "carbs": X, "fats": X, "fiber": X},
  "prepTime": X,
  "servings": 1
}`

  return {
    systemPrompt,
    userPrompt,
    sourceGuidelines: sourcePrompts.sourceGuidelines,
    confidence: 0.85, // Higher confidence with goal-specific prompts
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
