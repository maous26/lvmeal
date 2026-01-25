#!/usr/bin/env python3
"""
Démonstration du Meal Plan Solver.

Ce script génère un plan repas pour un utilisateur avec des contraintes spécifiques.
"""

import asyncio
import json
import sys
from pathlib import Path

# Ajouter le chemin du module
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from meal_planner.schemas import (
    UserConstraints, NutritionTarget, MealDistribution,
    DietType, MealType, Allergen,
)
from meal_planner.solver import MealPlanSolver, SolverConfig
from meal_planner.validation import MealPlanValidator


async def main():
    """Génère un plan repas de démonstration."""

    print("=" * 60)
    print("🍽️  MEAL PLAN SOLVER - Démonstration")
    print("=" * 60)

    # Définir les contraintes utilisateur
    constraints = UserConstraints(
        daily_target=NutritionTarget(
            calories=1800,
            proteins=80,
            carbs=200,
            fats=60,
            calorie_tolerance_pct=10.0,  # ±10%
        ),
        meal_distribution=MealDistribution(
            breakfast_pct=25,   # 450 kcal
            lunch_pct=35,       # 630 kcal
            snack_pct=10,       # 180 kcal
            dinner_pct=30,      # 540 kcal
        ),
        diet_type=DietType.OMNIVORE,
        allergies=[],
        intolerances=[],
        num_days=3,
        include_cheat_meal=False,
    )

    print("\n📋 CONTRAINTES UTILISATEUR:")
    print(f"  - Calories: {constraints.daily_target.calories} kcal/jour")
    print(f"  - Protéines: {constraints.daily_target.proteins}g")
    print(f"  - Glucides: {constraints.daily_target.carbs}g")
    print(f"  - Lipides: {constraints.daily_target.fats}g")
    print(f"  - Régime: {constraints.diet_type.value}")
    print(f"  - Tolérance: ±{constraints.daily_target.calorie_tolerance_pct}%")
    print(f"  - Nombre de jours: {constraints.num_days}")

    # Créer le solveur
    solver = MealPlanSolver(SolverConfig(
        calorie_tolerance_pct=10.0,
        prefer_variety=True,
    ))

    print("\n⚙️  Génération du plan...")

    # Générer le plan
    result = await solver.solve(constraints)

    if not result.success:
        print(f"\n❌ ERREUR: {result.infeasibility_reason}")
        print("💡 Suggestions:")
        for suggestion in result.relaxation_suggestions:
            print(f"   - {suggestion}")
        return

    print(f"\n✅ Plan généré en {result.solve_time_ms:.0f}ms ({result.iterations} itérations)")

    # Afficher le plan
    plan = result.plan

    print("\n" + "=" * 60)
    print("📅 PLAN REPAS")
    print("=" * 60)

    for day_plan in plan.days:
        print(f"\n📆 JOUR {day_plan.day + 1}" + (" 🎉 (Cheat Day)" if day_plan.is_cheat_day else ""))
        print("-" * 40)

        for planned_meal in day_plan.meals:
            meal = planned_meal.meal
            print(f"\n  🍽️  {meal.meal_type.value.upper()}")
            print(f"      Cible: {meal.target_macros.calories:.0f} kcal")

            for comp in meal.components:
                print(f"      • {comp.name}: {comp.display_quantity}")
                print(f"        ({comp.computed_macros.calories:.0f} kcal, "
                      f"{comp.computed_macros.proteins:.0f}g prot)")

            actual = meal.actual_macros
            deviation = meal.calorie_deviation_pct
            status = "✓" if abs(deviation) <= 10 else "⚠️"
            print(f"      → Total: {actual.calories:.0f} kcal ({deviation:+.1f}%) {status}")

        print(f"\n  📊 TOTAL JOUR: {day_plan.daily_totals.calories:.0f} kcal")
        print(f"      Protéines: {day_plan.daily_totals.proteins:.0f}g")
        print(f"      Glucides: {day_plan.daily_totals.carbs:.0f}g")
        print(f"      Lipides: {day_plan.daily_totals.fats:.0f}g")

    # Moyennes hebdomadaires
    print("\n" + "=" * 60)
    print("📈 MOYENNES HEBDOMADAIRES")
    print("=" * 60)
    print(f"  Calories: {plan.weekly_averages.calories:.0f} kcal/jour")
    print(f"  Protéines: {plan.weekly_averages.proteins:.0f}g/jour")
    print(f"  Glucides: {plan.weekly_averages.carbs:.0f}g/jour")
    print(f"  Lipides: {plan.weekly_averages.fats:.0f}g/jour")

    # Validation
    print("\n" + "=" * 60)
    print("🔍 VALIDATION")
    print("=" * 60)

    validator = MealPlanValidator()
    validation = await validator.validate(plan)

    if validation.is_valid:
        print("  ✅ Plan VALIDE")
    else:
        print("  ❌ Plan INVALIDE")
        for error in validation.errors:
            print(f"    - {error.message}")

    if validation.warnings:
        print("  ⚠️  Avertissements:")
        for warning in validation.warnings:
            print(f"    - {warning.message}")

    print(f"\n  Statistiques:")
    print(f"    - Déviation moyenne: {validation.total_calorie_deviation_pct:.1f}%")
    print(f"    - Déviation max: {validation.max_daily_deviation_pct:.1f}%")

    # Export JSON
    print("\n" + "=" * 60)
    print("💾 EXPORT JSON")
    print("=" * 60)

    # Convertir en dict pour export
    plan_dict = plan.model_dump(mode='json')

    output_path = Path(__file__).parent / "output_plan.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(plan_dict, f, indent=2, ensure_ascii=False)

    print(f"  Plan exporté vers: {output_path}")
    print(f"  Taille: {output_path.stat().st_size} bytes")


if __name__ == "__main__":
    asyncio.run(main())
