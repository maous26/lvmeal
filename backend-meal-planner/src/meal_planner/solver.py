"""
Meal Plan Solver - Optimisation déterministe des quantités.

Ce solveur:
1. Reçoit des cibles nutritionnelles (calories, macros)
2. Sélectionne des aliments depuis CIQUAL/OFF/Gustar
3. Calcule les quantités EXACTES pour atteindre les cibles
4. Retourne un plan structuré et validé

Le LLM n'intervient PAS ici - que du calcul déterministe.
"""

import time
from typing import Optional
from dataclasses import dataclass

from .schemas import (
    UserConstraints, NutritionTarget, MealDistribution,
    MealType, FoodRole, DietType, Allergen, MealSourcePreference,
    Macros, FoodItem, FoodSource,
    MealComponent, ComposedMeal, PlannedMeal, DailyPlan, MealPlan,
    SolverOutput,
)
from .data_access import UnifiedFoodDataAccess


# =============================================================================
# SOLVER CONFIGURATION
# =============================================================================

@dataclass
class MealTargets:
    """Cibles nutritionnelles pour un repas spécifique."""
    meal_type: MealType
    target_calories: float
    target_proteins: Optional[float] = None
    target_carbs: Optional[float] = None
    target_fats: Optional[float] = None


@dataclass
class SolverConfig:
    """Configuration du solveur."""
    calorie_tolerance_pct: float = 5.0
    macro_tolerance_pct: float = 10.0
    max_components_per_meal: int = 5
    min_components_per_meal: int = 2
    prefer_variety: bool = True


# =============================================================================
# QUANTITY CALCULATOR
# =============================================================================

class QuantityCalculator:
    """
    Calcule les quantités d'ingrédients pour atteindre des cibles nutritionnelles.
    Utilise une approche de programmation linéaire simplifiée.
    """

    @staticmethod
    def calculate_grams_for_calories(
        food: FoodItem,
        target_calories: float,
        min_grams: Optional[float] = None,
        max_grams: Optional[float] = None,
    ) -> float:
        """
        Calcule les grammes nécessaires pour atteindre un nombre de calories.
        """
        if food.macros_per_100g.calories <= 0:
            return 0

        # Calcul de base
        grams = (target_calories / food.macros_per_100g.calories) * 100

        # Appliquer les limites
        if min_grams is not None:
            grams = max(grams, min_grams)
        if max_grams is not None:
            grams = min(grams, max_grams)

        return round(grams, 1)

    @staticmethod
    def compute_macros_for_grams(food: FoodItem, grams: float) -> Macros:
        """Calcule les macros pour une quantité donnée."""
        factor = grams / 100
        return food.macros_per_100g.scale(factor)

    @staticmethod
    def distribute_calories_by_roles(
        target_calories: float,
        roles: list[FoodRole],
    ) -> dict[FoodRole, float]:
        """
        Distribue les calories entre les rôles d'un repas.
        """
        # Distribution par défaut selon le rôle
        role_weights = {
            FoodRole.PROTEIN: 35,    # 35% des calories
            FoodRole.CARB: 40,       # 40% des calories
            FoodRole.VEGETABLE: 10,  # 10% des calories
            FoodRole.FAT: 15,        # 15% des calories
            FoodRole.FRUIT: 20,
            FoodRole.DAIRY: 25,
            FoodRole.DRINK: 5,
            FoodRole.SEASONING: 0,
        }

        total_weight = sum(role_weights.get(r, 10) for r in roles)
        distribution = {}

        for role in roles:
            weight = role_weights.get(role, 10)
            distribution[role] = (weight / total_weight) * target_calories

        return distribution


# =============================================================================
# MEAL COMPOSER
# =============================================================================

class MealComposer:
    """
    Compose un repas en sélectionnant des aliments et calculant les quantités.
    """

    def __init__(
        self,
        data_access: UnifiedFoodDataAccess,
        config: SolverConfig = SolverConfig(),
    ):
        self.data = data_access
        self.config = config
        self.calculator = QuantityCalculator()

    async def compose_meal(
        self,
        targets: MealTargets,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
        used_foods: Optional[set[str]] = None,
        source_preference: MealSourcePreference = MealSourcePreference.BALANCED,
    ) -> ComposedMeal:
        """
        Compose un repas complet pour atteindre les cibles nutritionnelles.

        La source_preference influence la sélection des aliments:
        - FRESH: Priorité CIQUAL (produits frais)
        - RECIPES: Priorité Gustar (recettes élaborées)
        - QUICK: Priorité OFF (produits rapides)
        - BALANCED: Mix intelligent selon le type de repas
        """
        if used_foods is None:
            used_foods = set()

        # 1. Déterminer les rôles nécessaires pour ce type de repas
        roles = self._get_roles_for_meal_type(targets.meal_type)

        # 2. Récupérer des aliments candidats pour chaque rôle
        #    La source_preference détermine le mix CIQUAL/Gustar/OFF
        foods_by_role = await self.data.get_foods_for_meal(
            target_calories=targets.target_calories,
            meal_type=targets.meal_type,
            diet=diet,
            exclude_allergens=exclude_allergens,
            source_preference=source_preference,
        )

        # 3. Distribuer les calories cibles entre les rôles
        calorie_distribution = self.calculator.distribute_calories_by_roles(
            targets.target_calories, roles
        )

        # 4. Sélectionner un aliment par rôle et calculer la quantité
        components: list[MealComponent] = []
        total_calories = 0

        for role in roles:
            if role not in foods_by_role or not foods_by_role[role]:
                continue

            # Sélectionner le meilleur aliment (éviter les doublons)
            food = self._select_food(foods_by_role[role], used_foods)
            if not food:
                continue

            # Calculer la quantité pour ce rôle
            role_target_cal = calorie_distribution.get(role, 0)
            grams = self.calculator.calculate_grams_for_calories(
                food,
                role_target_cal,
                min_grams=food.min_portion_g,
                max_grams=food.max_portion_g,
            )

            if grams <= 0:
                continue

            # Calculer les macros résultantes
            computed_macros = self.calculator.compute_macros_for_grams(food, grams)
            total_calories += computed_macros.calories

            component = MealComponent(
                food_id=food.id,
                source=food.source,
                name=food.name,
                name_fr=food.name_fr,
                grams=grams,
                computed_macros=computed_macros,
                role=role,
                image_url=food.image_url,
            )
            components.append(component)
            used_foods.add(food.id)

        # 5. Ajuster si nécessaire pour atteindre la cible
        components = self._adjust_quantities(components, targets.target_calories)

        # 6. Créer le repas composé
        target_macros = Macros(
            calories=targets.target_calories,
            proteins=targets.target_proteins or 0,
            carbs=targets.target_carbs or 0,
            fats=targets.target_fats or 0,
        )

        return ComposedMeal(
            meal_type=targets.meal_type,
            components=components,
            target_macros=target_macros,
        )

    def _get_roles_for_meal_type(self, meal_type: MealType) -> list[FoodRole]:
        """Retourne les rôles typiques pour un type de repas."""
        if meal_type == MealType.BREAKFAST:
            return [FoodRole.CARB, FoodRole.DAIRY, FoodRole.FRUIT]
        elif meal_type == MealType.SNACK:
            return [FoodRole.FRUIT, FoodRole.DAIRY]
        else:  # LUNCH, DINNER
            return [FoodRole.PROTEIN, FoodRole.CARB, FoodRole.VEGETABLE]

    def _select_food(
        self,
        candidates: list[FoodItem],
        used_foods: set[str],
    ) -> Optional[FoodItem]:
        """Sélectionne le meilleur aliment parmi les candidats."""
        for food in candidates:
            if food.id not in used_foods:
                return food
        # Si tous utilisés, prendre le premier quand même
        return candidates[0] if candidates else None

    def _adjust_quantities(
        self,
        components: list[MealComponent],
        target_calories: float,
    ) -> list[MealComponent]:
        """
        Ajuste les quantités pour atteindre exactement la cible calorique.
        """
        if not components:
            return components

        # Calculer le total actuel
        current_total = sum(c.computed_macros.calories for c in components)
        if current_total <= 0:
            return components

        # Calculer le facteur d'ajustement
        adjustment_factor = target_calories / current_total

        # Ajuster chaque composant
        adjusted = []
        for comp in components:
            new_grams = round(comp.grams * adjustment_factor, 1)

            # Recalculer les macros avec les nouvelles quantités
            # On doit récupérer le food pour recalculer
            new_macros = comp.computed_macros.scale(adjustment_factor)

            adjusted.append(MealComponent(
                food_id=comp.food_id,
                source=comp.source,
                name=comp.name,
                name_fr=comp.name_fr,
                grams=new_grams,
                computed_macros=new_macros,
                role=comp.role,
                image_url=comp.image_url,
            ))

        return adjusted


# =============================================================================
# MAIN SOLVER
# =============================================================================

class MealPlanSolver:
    """
    Solveur principal pour générer des plans repas complets.
    """

    def __init__(self, config: SolverConfig = SolverConfig()):
        self.config = config
        self.data = UnifiedFoodDataAccess()
        self.composer = MealComposer(self.data, config)

    async def solve(self, constraints: UserConstraints) -> SolverOutput:
        """
        Génère un plan repas complet respectant les contraintes.
        """
        start_time = time.time()
        iterations = 0

        try:
            # 1. Calculer les cibles quotidiennes
            daily_targets = self._compute_daily_targets(constraints)

            # 2. Générer le plan jour par jour
            days: list[DailyPlan] = []
            used_foods: set[str] = set()

            for day_index in range(constraints.num_days):
                iterations += 1

                # Vérifier si c'est un jour "cheat meal"
                is_cheat_day = (
                    constraints.include_cheat_meal and
                    constraints.cheat_meal_day == day_index
                )

                # Ajuster les cibles pour le cheat day
                day_targets = daily_targets
                if is_cheat_day:
                    day_targets = self._adjust_for_cheat_day(daily_targets)

                # Générer les repas de la journée
                meals: list[PlannedMeal] = []
                daily_total = Macros.zero()

                for meal_type, meal_target in day_targets.items():
                    meal_targets = MealTargets(
                        meal_type=meal_type,
                        target_calories=meal_target['calories'],
                        target_proteins=meal_target.get('proteins'),
                        target_carbs=meal_target.get('carbs'),
                        target_fats=meal_target.get('fats'),
                    )

                    composed_meal = await self.composer.compose_meal(
                        targets=meal_targets,
                        diet=constraints.diet_type,
                        exclude_allergens=list(set(constraints.allergies + constraints.intolerances)),
                        used_foods=used_foods if self.config.prefer_variety else None,
                        source_preference=constraints.meal_source_preference,
                    )

                    planned_meal = PlannedMeal(
                        day=day_index,
                        meal=composed_meal,
                    )
                    meals.append(planned_meal)
                    daily_total = daily_total + composed_meal.actual_macros

                # Créer le plan de la journée
                daily_plan = DailyPlan(
                    day=day_index,
                    meals=meals,
                    daily_totals=daily_total,
                    is_cheat_day=is_cheat_day,
                )
                days.append(daily_plan)

            # 3. Calculer les totaux et moyennes
            weekly_totals = Macros.zero()
            for day in days:
                weekly_totals = weekly_totals + day.daily_totals

            weekly_averages = weekly_totals.scale(1 / len(days)) if days else Macros.zero()

            # 4. Valider le plan
            is_valid, validation_errors = self._validate_plan(days, constraints)

            # 5. Créer le plan final
            plan = MealPlan(
                id=f"plan_{int(time.time())}",
                created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                constraints=constraints,
                days=days,
                weekly_totals=weekly_totals,
                weekly_averages=weekly_averages,
                is_valid=is_valid,
                validation_errors=validation_errors,
            )

            solve_time = (time.time() - start_time) * 1000

            return SolverOutput(
                success=True,
                plan=plan,
                solve_time_ms=solve_time,
                iterations=iterations,
            )

        except Exception as e:
            solve_time = (time.time() - start_time) * 1000
            return SolverOutput(
                success=False,
                infeasibility_reason=str(e),
                relaxation_suggestions=[
                    "Essayez d'augmenter la tolérance calorique",
                    "Réduisez les restrictions alimentaires",
                ],
                solve_time_ms=solve_time,
                iterations=iterations,
            )

    def _compute_daily_targets(
        self,
        constraints: UserConstraints,
    ) -> dict[MealType, dict]:
        """Calcule les cibles par repas basées sur les contraintes."""
        dist = constraints.meal_distribution
        daily = constraints.daily_target

        targets = {}

        # Petit-déjeuner
        targets[MealType.BREAKFAST] = {
            'calories': daily.calories * dist.breakfast_pct / 100,
            'proteins': (daily.proteins or 0) * dist.breakfast_pct / 100 if daily.proteins else None,
            'carbs': (daily.carbs or 0) * dist.breakfast_pct / 100 if daily.carbs else None,
            'fats': (daily.fats or 0) * dist.breakfast_pct / 100 if daily.fats else None,
        }

        # Déjeuner
        targets[MealType.LUNCH] = {
            'calories': daily.calories * dist.lunch_pct / 100,
            'proteins': (daily.proteins or 0) * dist.lunch_pct / 100 if daily.proteins else None,
            'carbs': (daily.carbs or 0) * dist.lunch_pct / 100 if daily.carbs else None,
            'fats': (daily.fats or 0) * dist.lunch_pct / 100 if daily.fats else None,
        }

        # Collation
        targets[MealType.SNACK] = {
            'calories': daily.calories * dist.snack_pct / 100,
            'proteins': (daily.proteins or 0) * dist.snack_pct / 100 if daily.proteins else None,
            'carbs': (daily.carbs or 0) * dist.snack_pct / 100 if daily.carbs else None,
            'fats': (daily.fats or 0) * dist.snack_pct / 100 if daily.fats else None,
        }

        # Dîner
        targets[MealType.DINNER] = {
            'calories': daily.calories * dist.dinner_pct / 100,
            'proteins': (daily.proteins or 0) * dist.dinner_pct / 100 if daily.proteins else None,
            'carbs': (daily.carbs or 0) * dist.dinner_pct / 100 if daily.carbs else None,
            'fats': (daily.fats or 0) * dist.dinner_pct / 100 if daily.fats else None,
        }

        return targets

    def _adjust_for_cheat_day(
        self,
        targets: dict[MealType, dict],
    ) -> dict[MealType, dict]:
        """Ajuste les cibles pour un jour plaisir (+30% calories)."""
        adjusted = {}
        for meal_type, target in targets.items():
            adjusted[meal_type] = {
                'calories': target['calories'] * 1.3,
                'proteins': target.get('proteins'),
                'carbs': target.get('carbs'),
                'fats': target.get('fats'),
            }
        return adjusted

    def _validate_plan(
        self,
        days: list[DailyPlan],
        constraints: UserConstraints,
    ) -> tuple[bool, list[str]]:
        """Valide le plan contre les contraintes."""
        errors = []
        tolerance = constraints.daily_target.calorie_tolerance_pct

        for day in days:
            target = constraints.daily_target.calories
            actual = day.daily_totals.calories
            deviation = abs(actual - target) / target * 100

            if deviation > tolerance:
                errors.append(
                    f"Jour {day.day + 1}: écart de {deviation:.1f}% "
                    f"({actual:.0f} vs {target:.0f} kcal cible)"
                )

        return len(errors) == 0, errors
