"""
LLM Writer - Génération de descriptions textuelles pour les plans repas.

IMPORTANT: Ce module NE MODIFIE PAS les quantités ou les compositions.
Il prend un plan déjà calculé et génère des descriptions appétissantes.

Le solveur a déjà:
1. Sélectionné les aliments
2. Calculé les quantités exactes
3. Validé les macros

Ce module ajoute UNIQUEMENT:
- Titres de repas accrocheurs
- Descriptions appétissantes
- Instructions de préparation
- Conseils nutritionnels
"""

from typing import Optional
from dataclasses import dataclass
from enum import Enum

from .schemas import (
    MealPlan, DailyPlan, ComposedMeal, MealComponent,
    MealType, FoodRole,
)


# =============================================================================
# CONFIGURATION
# =============================================================================

class WriterStyle(str, Enum):
    """Style de rédaction pour les descriptions."""
    SIMPLE = "simple"        # Direct, factuel
    APPETIZING = "appetizing"  # Gourmand, inspirant
    COACHING = "coaching"     # Motivant, éducatif
    PROFESSIONAL = "professional"  # Médical, précis


@dataclass
class WriterConfig:
    """Configuration du writer."""
    style: WriterStyle = WriterStyle.APPETIZING
    include_tips: bool = True
    include_prep_time: bool = True
    language: str = "fr"


# =============================================================================
# MEAL DESCRIPTIONS
# =============================================================================

# Templates de titres par type de repas et rôle principal
MEAL_TITLES = {
    MealType.BREAKFAST: {
        FoodRole.CARB: [
            "Petit-déjeuner énergisant",
            "Réveil gourmand",
            "Matin vitaminé",
        ],
        FoodRole.DAIRY: [
            "Petit-déjeuner lacté",
            "Douceur matinale",
            "Bowl protéiné",
        ],
        FoodRole.FRUIT: [
            "Fraîcheur du matin",
            "Petit-déjeuner fruité",
            "Vitamines au réveil",
        ],
    },
    MealType.LUNCH: {
        FoodRole.PROTEIN: [
            "Déjeuner équilibré",
            "Assiette complète",
            "Repas reconstituant",
        ],
        FoodRole.CARB: [
            "Déjeuner énergétique",
            "Midi réconfortant",
            "Plat du jour",
        ],
        FoodRole.VEGETABLE: [
            "Assiette végétale",
            "Déjeuner léger",
            "Fraîcheur du midi",
        ],
    },
    MealType.DINNER: {
        FoodRole.PROTEIN: [
            "Dîner protéiné",
            "Soirée reconstituante",
            "Repas du soir équilibré",
        ],
        FoodRole.VEGETABLE: [
            "Dîner léger",
            "Assiette du soir",
            "Soirée végétale",
        ],
    },
    MealType.SNACK: {
        FoodRole.FRUIT: [
            "Pause fruitée",
            "En-cas vitaminé",
            "Collation légère",
        ],
        FoodRole.DAIRY: [
            "Pause lactée",
            "En-cas protéiné",
            "Collation gourmande",
        ],
    },
}

# Descriptions par rôle alimentaire
ROLE_DESCRIPTIONS = {
    FoodRole.PROTEIN: "source de protéines pour vos muscles",
    FoodRole.CARB: "apport en glucides pour l'énergie",
    FoodRole.VEGETABLE: "riche en fibres et micronutriments",
    FoodRole.FAT: "bonnes graisses essentielles",
    FoodRole.FRUIT: "vitamines et antioxydants naturels",
    FoodRole.DAIRY: "calcium et protéines de qualité",
    FoodRole.DRINK: "hydratation et bien-être",
    FoodRole.SEASONING: "saveurs et aromates",
}


# =============================================================================
# LLM WRITER CLASS
# =============================================================================

class MealPlanWriter:
    """
    Génère des descriptions textuelles pour les plans repas.

    IMPORTANT: Ne modifie JAMAIS les quantités ou compositions.
    Travaille uniquement sur la présentation textuelle.
    """

    def __init__(self, config: WriterConfig = WriterConfig()):
        self.config = config
        self._title_index = 0  # Pour varier les titres

    def generate_plan_description(self, plan: MealPlan) -> dict:
        """
        Génère les descriptions pour un plan complet.

        Retourne un dict avec les descriptions (pas le plan modifié).
        """
        descriptions = {
            "plan_title": self._generate_plan_title(plan),
            "plan_intro": self._generate_plan_intro(plan),
            "days": [],
        }

        for day in plan.days:
            day_desc = self._generate_day_description(day, plan)
            descriptions["days"].append(day_desc)

        descriptions["plan_summary"] = self._generate_plan_summary(plan)

        return descriptions

    def generate_meal_description(self, meal: ComposedMeal) -> dict:
        """
        Génère la description pour un seul repas.
        """
        return {
            "title": self._generate_meal_title(meal),
            "description": self._generate_meal_text(meal),
            "components": [
                self._describe_component(comp) for comp in meal.components
            ],
            "nutrition_note": self._generate_nutrition_note(meal),
            "prep_tip": self._generate_prep_tip(meal) if self.config.include_prep_time else None,
        }

    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================

    def _generate_plan_title(self, plan: MealPlan) -> str:
        """Génère le titre du plan."""
        num_days = len(plan.days)
        target_cal = plan.constraints.daily_target.calories

        if target_cal < 1500:
            return f"Plan léger {num_days} jours - {target_cal:.0f} kcal/jour"
        elif target_cal > 2500:
            return f"Plan énergétique {num_days} jours - {target_cal:.0f} kcal/jour"
        else:
            return f"Plan équilibré {num_days} jours - {target_cal:.0f} kcal/jour"

    def _generate_plan_intro(self, plan: MealPlan) -> str:
        """Génère l'introduction du plan."""
        diet = plan.constraints.diet_type.value
        num_days = len(plan.days)

        intro_parts = [
            f"Voici votre plan alimentaire personnalisé sur {num_days} jours.",
        ]

        if diet != "omnivore":
            intro_parts.append(f"Ce plan respecte votre régime {diet}.")

        if plan.constraints.allergies:
            allergens = ", ".join(a.value for a in plan.constraints.allergies)
            intro_parts.append(f"Les allergènes suivants ont été exclus : {allergens}.")

        return " ".join(intro_parts)

    def _generate_day_description(self, day: DailyPlan, plan: MealPlan) -> dict:
        """Génère la description d'une journée."""
        day_desc = {
            "day_number": day.day + 1,
            "title": f"Jour {day.day + 1}",
            "meals": [],
            "daily_summary": None,
        }

        if day.is_cheat_day:
            day_desc["title"] += " - Journée plaisir 🎉"

        for planned_meal in day.meals:
            meal_desc = self.generate_meal_description(planned_meal.meal)
            day_desc["meals"].append(meal_desc)

        # Résumé journalier
        totals = day.daily_totals
        target = plan.constraints.daily_target.calories
        deviation = ((totals.calories - target) / target) * 100

        if abs(deviation) < 5:
            status = "✓ Objectif atteint"
        elif deviation > 0:
            status = f"⚠️ +{deviation:.0f}% au-dessus de l'objectif"
        else:
            status = f"⚠️ {deviation:.0f}% en-dessous de l'objectif"

        day_desc["daily_summary"] = {
            "calories": f"{totals.calories:.0f} kcal",
            "proteins": f"{totals.proteins:.0f}g",
            "carbs": f"{totals.carbs:.0f}g",
            "fats": f"{totals.fats:.0f}g",
            "status": status,
        }

        return day_desc

    def _generate_meal_title(self, meal: ComposedMeal) -> str:
        """Génère un titre accrocheur pour le repas."""
        # Trouver le rôle principal
        main_role = self._get_main_role(meal)

        # Chercher un titre approprié
        titles = MEAL_TITLES.get(meal.meal_type, {}).get(main_role, [])

        if titles:
            self._title_index = (self._title_index + 1) % len(titles)
            return titles[self._title_index]

        # Fallback
        return f"{meal.meal_type.value.capitalize()}"

    def _generate_meal_text(self, meal: ComposedMeal) -> str:
        """Génère la description textuelle du repas."""
        if not meal.components:
            return "Repas à composer selon vos envies."

        # Construire la description
        food_names = [comp.name_fr or comp.name for comp in meal.components]

        if len(food_names) == 1:
            return f"Un repas simple avec {food_names[0].lower()}."
        elif len(food_names) == 2:
            return f"Une association de {food_names[0].lower()} et {food_names[1].lower()}."
        else:
            last = food_names[-1]
            others = ", ".join(f.lower() for f in food_names[:-1])
            return f"Un repas composé de {others} et {last.lower()}."

    def _describe_component(self, comp: MealComponent) -> dict:
        """Décrit un composant du repas."""
        name = comp.name_fr or comp.name

        return {
            "name": name,
            "quantity": comp.display_quantity,
            "role": comp.role.value,
            "role_description": ROLE_DESCRIPTIONS.get(comp.role, ""),
            "calories": f"{comp.computed_macros.calories:.0f} kcal",
        }

    def _generate_nutrition_note(self, meal: ComposedMeal) -> str:
        """Génère une note nutritionnelle."""
        if self.config.style == WriterStyle.SIMPLE:
            return ""

        macros = meal.actual_macros

        # Identifier le point fort nutritionnel
        if macros.proteins > 25:
            return "💪 Riche en protéines pour la récupération musculaire."
        elif macros.calories < 300:
            return "🌿 Repas léger et digeste."
        elif macros.carbs > 50:
            return "⚡ Excellent apport énergétique pour vos activités."
        else:
            return "✓ Repas équilibré en macronutriments."

    def _generate_prep_tip(self, meal: ComposedMeal) -> Optional[str]:
        """Génère un conseil de préparation."""
        # Estimer le temps de préparation basé sur les composants
        num_components = len(meal.components)

        has_protein = any(c.role == FoodRole.PROTEIN for c in meal.components)
        has_carb = any(c.role == FoodRole.CARB for c in meal.components)

        if has_protein and has_carb:
            return "⏱️ Préparation : 15-20 min. Commencez par cuire les féculents."
        elif has_protein:
            return "⏱️ Préparation : 10-15 min. Privilégiez une cuisson douce."
        elif num_components <= 2:
            return "⏱️ Préparation : 5 min. Rapide et efficace !"
        else:
            return "⏱️ Préparation : 10 min environ."

    def _generate_plan_summary(self, plan: MealPlan) -> dict:
        """Génère le résumé final du plan."""
        avg = plan.weekly_averages
        target = plan.constraints.daily_target

        cal_deviation = ((avg.calories - target.calories) / target.calories) * 100

        return {
            "averages": {
                "calories": f"{avg.calories:.0f} kcal/jour",
                "proteins": f"{avg.proteins:.0f}g/jour",
                "carbs": f"{avg.carbs:.0f}g/jour",
                "fats": f"{avg.fats:.0f}g/jour",
            },
            "target_achievement": f"{100 - abs(cal_deviation):.0f}% de conformité",
            "recommendation": self._generate_recommendation(plan),
        }

    def _generate_recommendation(self, plan: MealPlan) -> str:
        """Génère une recommandation finale."""
        if plan.is_valid:
            return "✅ Ce plan respecte vos objectifs nutritionnels. Bon appétit !"
        else:
            return "⚠️ Quelques écarts ont été détectés. Consultez les détails par jour."

    def _get_main_role(self, meal: ComposedMeal) -> FoodRole:
        """Identifie le rôle principal du repas (plus de calories)."""
        if not meal.components:
            return FoodRole.CARB

        # Trouver le composant avec le plus de calories
        main_comp = max(meal.components, key=lambda c: c.computed_macros.calories)
        return main_comp.role


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def enrich_plan_with_descriptions(plan: MealPlan, config: WriterConfig = WriterConfig()) -> dict:
    """
    Fonction utilitaire pour enrichir un plan avec des descriptions.

    IMPORTANT: Retourne un nouveau dict, ne modifie pas le plan original.
    Les quantités et macros restent INCHANGÉES.
    """
    writer = MealPlanWriter(config)

    # Générer les descriptions
    descriptions = writer.generate_plan_description(plan)

    # Combiner avec le plan original (en tant que dict)
    result = {
        "plan": plan.model_dump(mode='json'),
        "descriptions": descriptions,
    }

    return result
