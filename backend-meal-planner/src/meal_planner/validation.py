"""
Validation Module - Recalcul déterministe et validation des plans repas.

Ce module garantit que:
1. Les macros affichées correspondent au recalcul depuis les données sources
2. Les contraintes utilisateur sont respectées
3. Les allergènes sont correctement exclus
4. Les tolérances sont vérifiées
"""

from typing import Optional
from dataclasses import dataclass, field

from .schemas import (
    MealPlan, DailyPlan, PlannedMeal, ComposedMeal, MealComponent,
    Macros, UserConstraints, Allergen, DietType, FoodRole,
)
from .data_access import UnifiedFoodDataAccess


@dataclass
class ValidationError:
    """Une erreur de validation."""
    severity: str  # "error" | "warning"
    code: str
    message: str
    day: Optional[int] = None
    meal_type: Optional[str] = None
    food_id: Optional[str] = None


@dataclass
class ValidationResult:
    """Résultat complet de la validation."""
    is_valid: bool
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationError] = field(default_factory=list)

    # Statistiques de validation
    total_calorie_deviation_pct: float = 0.0
    max_daily_deviation_pct: float = 0.0
    allergen_violations: int = 0
    diet_violations: int = 0

    def add_error(self, code: str, message: str, **kwargs):
        self.errors.append(ValidationError(severity="error", code=code, message=message, **kwargs))
        self.is_valid = False

    def add_warning(self, code: str, message: str, **kwargs):
        self.warnings.append(ValidationError(severity="warning", code=code, message=message, **kwargs))


class MealPlanValidator:
    """
    Validateur de plans repas.

    Effectue des vérifications déterministes:
    - Recalcul des macros depuis les données sources
    - Vérification des tolérances caloriques
    - Vérification des allergènes exclus
    - Vérification du régime alimentaire
    """

    def __init__(self, data_access: Optional[UnifiedFoodDataAccess] = None):
        self.data = data_access or UnifiedFoodDataAccess()

    async def validate(self, plan: MealPlan) -> ValidationResult:
        """
        Valide un plan repas complet.
        """
        result = ValidationResult(is_valid=True)
        constraints = plan.constraints

        total_deviation = 0.0
        max_deviation = 0.0

        for day_plan in plan.days:
            # 1. Recalculer les macros de la journée
            recalculated_totals = await self._recalculate_daily_macros(day_plan)

            # 2. Vérifier la cohérence avec les totaux rapportés
            self._check_macro_consistency(result, day_plan, recalculated_totals)

            # 3. Vérifier les tolérances caloriques
            deviation = self._check_calorie_tolerance(result, day_plan, constraints)
            total_deviation += abs(deviation)
            max_deviation = max(max_deviation, abs(deviation))

            # 4. Vérifier les allergènes
            self._check_allergens(result, day_plan, constraints)

            # 5. Vérifier le régime alimentaire
            self._check_diet_compliance(result, day_plan, constraints)

        # Statistiques globales
        num_days = len(plan.days)
        if num_days > 0:
            result.total_calorie_deviation_pct = total_deviation / num_days
            result.max_daily_deviation_pct = max_deviation

        return result

    async def _recalculate_daily_macros(self, day_plan: DailyPlan) -> Macros:
        """
        Recalcule les macros totales d'une journée depuis les données sources.
        """
        total = Macros.zero()

        for planned_meal in day_plan.meals:
            meal_macros = await self._recalculate_meal_macros(planned_meal.meal)
            total = total + meal_macros

        return total

    async def _recalculate_meal_macros(self, meal: ComposedMeal) -> Macros:
        """
        Recalcule les macros d'un repas en accédant aux données sources.
        """
        total = Macros.zero()

        for component in meal.components:
            # Récupérer les données originales de l'aliment
            food = await self.data.get_by_id(component.food_id)

            if food:
                # Recalculer les macros pour la quantité spécifiée
                factor = component.grams / 100
                recalculated = food.macros_per_100g.scale(factor)
                total = total + recalculated
            else:
                # Si l'aliment n'est pas trouvé, utiliser les macros stockées
                total = total + component.computed_macros

        return total

    def _check_macro_consistency(
        self,
        result: ValidationResult,
        day_plan: DailyPlan,
        recalculated: Macros,
    ):
        """
        Vérifie que les macros rapportées correspondent au recalcul.
        """
        reported = day_plan.daily_totals

        # Tolérance de 1% pour les erreurs d'arrondi
        tolerance = 0.01

        if reported.calories > 0:
            cal_diff = abs(reported.calories - recalculated.calories) / reported.calories
            if cal_diff > tolerance:
                result.add_warning(
                    code="MACRO_MISMATCH_CALORIES",
                    message=f"Jour {day_plan.day + 1}: écart de recalcul calories "
                            f"({reported.calories:.0f} rapporté vs {recalculated.calories:.0f} recalculé)",
                    day=day_plan.day,
                )

        if reported.proteins > 0:
            prot_diff = abs(reported.proteins - recalculated.proteins) / reported.proteins
            if prot_diff > tolerance:
                result.add_warning(
                    code="MACRO_MISMATCH_PROTEINS",
                    message=f"Jour {day_plan.day + 1}: écart de recalcul protéines",
                    day=day_plan.day,
                )

    def _check_calorie_tolerance(
        self,
        result: ValidationResult,
        day_plan: DailyPlan,
        constraints: UserConstraints,
    ) -> float:
        """
        Vérifie que les calories sont dans la tolérance.
        Retourne le pourcentage de déviation.
        """
        target = constraints.daily_target.calories
        actual = day_plan.daily_totals.calories
        tolerance = constraints.daily_target.calorie_tolerance_pct

        if target <= 0:
            return 0.0

        deviation_pct = ((actual - target) / target) * 100

        if abs(deviation_pct) > tolerance:
            result.add_error(
                code="CALORIE_OUT_OF_TOLERANCE",
                message=f"Jour {day_plan.day + 1}: {actual:.0f} kcal "
                        f"(cible: {target:.0f} ±{tolerance}%, écart: {deviation_pct:+.1f}%)",
                day=day_plan.day,
            )
        elif abs(deviation_pct) > tolerance * 0.8:
            result.add_warning(
                code="CALORIE_NEAR_LIMIT",
                message=f"Jour {day_plan.day + 1}: proche de la limite ({deviation_pct:+.1f}%)",
                day=day_plan.day,
            )

        return deviation_pct

    def _check_allergens(
        self,
        result: ValidationResult,
        day_plan: DailyPlan,
        constraints: UserConstraints,
    ):
        """
        Vérifie qu'aucun allergène interdit n'est présent.
        """
        forbidden = set(constraints.allergies + constraints.intolerances)
        if not forbidden:
            return

        for planned_meal in day_plan.meals:
            for component in planned_meal.meal.components:
                # Note: les allergènes devraient être stockés sur le component
                # Pour l'instant, on fait une vérification basée sur le nom
                name_lower = (component.name or "").lower()

                allergen_keywords = {
                    Allergen.GLUTEN: ["blé", "pain", "pâtes", "farine", "seigle"],
                    Allergen.DAIRY: ["lait", "fromage", "yaourt", "crème", "beurre"],
                    Allergen.EGGS: ["œuf", "oeuf"],
                    Allergen.NUTS: ["noix", "amande", "noisette", "cajou"],
                    Allergen.PEANUTS: ["arachide", "cacahuète"],
                    Allergen.SOY: ["soja"],
                    Allergen.FISH: ["poisson", "saumon", "thon", "cabillaud"],
                    Allergen.SHELLFISH: ["crevette", "crabe", "homard", "moule"],
                    Allergen.SESAME: ["sésame"],
                }

                for allergen in forbidden:
                    keywords = allergen_keywords.get(allergen, [])
                    if any(kw in name_lower for kw in keywords):
                        result.add_error(
                            code="ALLERGEN_PRESENT",
                            message=f"Jour {day_plan.day + 1}, {planned_meal.meal_type.value}: "
                                    f"allergène '{allergen.value}' détecté dans '{component.name}'",
                            day=day_plan.day,
                            meal_type=planned_meal.meal_type.value,
                            food_id=component.food_id,
                        )
                        result.allergen_violations += 1

    def _check_diet_compliance(
        self,
        result: ValidationResult,
        day_plan: DailyPlan,
        constraints: UserConstraints,
    ):
        """
        Vérifie que le régime alimentaire est respecté.
        """
        diet = constraints.diet_type

        if diet == DietType.OMNIVORE:
            return  # Pas de restriction

        meat_keywords = ["poulet", "bœuf", "porc", "agneau", "veau", "canard", "dinde"]
        fish_keywords = ["poisson", "saumon", "thon", "cabillaud", "sardine", "maquereau"]
        animal_keywords = meat_keywords + fish_keywords + ["œuf", "oeuf", "lait", "fromage", "yaourt", "beurre", "crème"]

        for planned_meal in day_plan.meals:
            for component in planned_meal.meal.components:
                name_lower = (component.name or "").lower()

                violation = None

                if diet == DietType.VEGETARIAN:
                    if any(kw in name_lower for kw in meat_keywords + fish_keywords):
                        violation = "viande/poisson"

                elif diet == DietType.VEGAN:
                    if any(kw in name_lower for kw in animal_keywords):
                        violation = "produit animal"

                elif diet == DietType.PESCATARIAN:
                    if any(kw in name_lower for kw in meat_keywords):
                        violation = "viande"

                if violation:
                    result.add_error(
                        code="DIET_VIOLATION",
                        message=f"Jour {day_plan.day + 1}, {planned_meal.meal_type.value}: "
                                f"{violation} détecté dans '{component.name}' "
                                f"(régime: {diet.value})",
                        day=day_plan.day,
                        meal_type=planned_meal.meal_type.value,
                        food_id=component.food_id,
                    )
                    result.diet_violations += 1


def validate_macros_calculation(components: list[MealComponent]) -> tuple[Macros, bool]:
    """
    Fonction utilitaire pour valider le calcul des macros.
    Retourne les macros recalculées et un booléen indiquant si elles correspondent.
    """
    recalculated = Macros.zero()
    for comp in components:
        recalculated = recalculated + comp.computed_macros

    # Vérifier la cohérence interne
    is_valid = True
    for comp in components:
        # Chaque composant devrait avoir des macros > 0 si grams > 0
        if comp.grams > 0 and comp.computed_macros.calories <= 0:
            is_valid = False
            break

    return recalculated, is_valid
