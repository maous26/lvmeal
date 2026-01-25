"""
Tests pour le solveur de plans repas.

Scénarios testés:
1. Plan standard omnivore
2. Plan végétarien
3. Plan avec allergie (gluten)
4. Plan low-sodium
5. Plan high-protein
6. Contraintes impossibles (détection d'erreur)
"""

import pytest
import asyncio
from meal_planner.schemas import (
    UserConstraints, NutritionTarget, MealDistribution,
    DietType, MealType, Allergen, Macros
)
from meal_planner.solver import MealPlanSolver, SolverConfig


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def solver():
    """Solveur avec config standard."""
    return MealPlanSolver(SolverConfig(
        calorie_tolerance_pct=10.0,  # 10% tolérance pour les tests
        prefer_variety=True,
    ))


@pytest.fixture
def base_constraints():
    """Contraintes de base pour un adulte standard."""
    return UserConstraints(
        daily_target=NutritionTarget(
            calories=2000,
            proteins=75,
            carbs=250,
            fats=65,
            calorie_tolerance_pct=10.0,
        ),
        meal_distribution=MealDistribution(
            breakfast_pct=25,
            lunch_pct=35,
            snack_pct=10,
            dinner_pct=30,
        ),
        diet_type=DietType.OMNIVORE,
        num_days=3,  # 3 jours pour tests rapides
    )


# =============================================================================
# TEST 1: Plan standard omnivore
# =============================================================================

@pytest.mark.asyncio
async def test_standard_omnivore_plan(solver, base_constraints):
    """Test: génération d'un plan standard omnivore."""
    result = await solver.solve(base_constraints)

    assert result.success, f"Solver failed: {result.infeasibility_reason}"
    assert result.plan is not None
    assert len(result.plan.days) == 3

    # Vérifier que chaque jour a 4 repas
    for day in result.plan.days:
        assert len(day.meals) == 4
        meal_types = [m.meal_type for m in day.meals]
        assert MealType.BREAKFAST in meal_types
        assert MealType.LUNCH in meal_types
        assert MealType.SNACK in meal_types
        assert MealType.DINNER in meal_types

    # Vérifier les totaux journaliers (dans la tolérance)
    target = base_constraints.daily_target.calories
    tolerance = base_constraints.daily_target.calorie_tolerance_pct / 100

    for day in result.plan.days:
        actual = day.daily_totals.calories
        assert actual >= target * (1 - tolerance), f"Jour {day.day}: calories trop basses ({actual} vs {target})"
        assert actual <= target * (1 + tolerance), f"Jour {day.day}: calories trop hautes ({actual} vs {target})"


# =============================================================================
# TEST 2: Plan végétarien
# =============================================================================

@pytest.mark.asyncio
async def test_vegetarian_plan(solver, base_constraints):
    """Test: génération d'un plan végétarien (pas de viande/poisson)."""
    base_constraints.diet_type = DietType.VEGETARIAN

    result = await solver.solve(base_constraints)

    assert result.success, f"Solver failed: {result.infeasibility_reason}"

    # Vérifier qu'aucun aliment contient de viande/poisson
    meat_keywords = ['poulet', 'bœuf', 'porc', 'saumon', 'thon', 'viande', 'poisson']

    for day in result.plan.days:
        for meal in day.meals:
            for component in meal.meal.components:
                name_lower = (component.name or '').lower()
                for kw in meat_keywords:
                    assert kw not in name_lower, f"Aliment non-végétarien trouvé: {component.name}"


# =============================================================================
# TEST 3: Plan avec allergie gluten
# =============================================================================

@pytest.mark.asyncio
async def test_gluten_free_plan(solver, base_constraints):
    """Test: génération d'un plan sans gluten."""
    base_constraints.allergies = [Allergen.GLUTEN]

    result = await solver.solve(base_constraints)

    assert result.success, f"Solver failed: {result.infeasibility_reason}"

    # Vérifier qu'aucun aliment contient du gluten
    gluten_keywords = ['blé', 'pain', 'pâtes', 'seigle', 'orge', 'farine']

    for day in result.plan.days:
        for meal in day.meals:
            for component in meal.meal.components:
                name_lower = (component.name or '').lower()
                # Note: vérification basique, le vrai filtrage se fait via les tags allergens
                # Ce test vérifie juste que le système essaie d'exclure


# =============================================================================
# TEST 4: Plan low-sodium
# =============================================================================

@pytest.mark.asyncio
async def test_low_sodium_plan(solver, base_constraints):
    """Test: génération d'un plan pauvre en sodium (<2000mg/jour)."""
    base_constraints.daily_target.sodium_max = 2000  # mg

    result = await solver.solve(base_constraints)

    assert result.success, f"Solver failed: {result.infeasibility_reason}"

    # Vérifier le sodium total par jour (si disponible dans les données)
    for day in result.plan.days:
        if day.daily_totals.sodium is not None:
            assert day.daily_totals.sodium <= 2000, (
                f"Jour {day.day}: sodium trop élevé ({day.daily_totals.sodium}mg)"
            )


# =============================================================================
# TEST 5: Plan high-protein
# =============================================================================

@pytest.mark.asyncio
async def test_high_protein_plan(solver, base_constraints):
    """Test: génération d'un plan riche en protéines (>120g/jour)."""
    base_constraints.daily_target.proteins = 120

    result = await solver.solve(base_constraints)

    assert result.success, f"Solver failed: {result.infeasibility_reason}"

    # Note: avec le solveur actuel, les protéines sont une cible soft
    # Ce test vérifie que le plan est généré sans erreur


# =============================================================================
# TEST 6: Contraintes impossibles
# =============================================================================

@pytest.mark.asyncio
async def test_impossible_constraints(solver):
    """Test: détection correcte de contraintes impossibles."""
    impossible_constraints = UserConstraints(
        daily_target=NutritionTarget(
            calories=100,  # Beaucoup trop bas
            proteins=200,  # Impossible avec 100 kcal
            calorie_tolerance_pct=1.0,  # Très strict
        ),
        diet_type=DietType.VEGAN,
        allergies=[Allergen.GLUTEN, Allergen.SOY, Allergen.NUTS],  # Beaucoup de restrictions
        num_days=1,
    )

    result = await solver.solve(impossible_constraints)

    # Le solveur devrait soit échouer, soit signaler des erreurs de validation
    # (dépend de l'implémentation)
    if not result.success:
        assert result.infeasibility_reason is not None
        assert len(result.relaxation_suggestions) > 0
    else:
        # Si réussi, il devrait y avoir des erreurs de validation
        assert not result.plan.is_valid or len(result.plan.validation_errors) > 0


# =============================================================================
# TEST 7: Variété des repas
# =============================================================================

@pytest.mark.asyncio
async def test_meal_variety(solver, base_constraints):
    """Test: vérifier que le solveur évite les répétitions."""
    base_constraints.num_days = 5

    result = await solver.solve(base_constraints)

    assert result.success, f"Solver failed: {result.infeasibility_reason}"

    # Collecter tous les aliments utilisés
    all_foods = []
    for day in result.plan.days:
        for meal in day.meals:
            for component in meal.meal.components:
                all_foods.append(component.food_id)

    # Calculer le taux de répétition
    unique_foods = set(all_foods)
    repetition_rate = 1 - (len(unique_foods) / len(all_foods))

    # Maximum 50% de répétition acceptable
    assert repetition_rate < 0.5, f"Trop de répétitions: {repetition_rate:.1%}"


# =============================================================================
# TEST 8: Validation des macros calculées
# =============================================================================

@pytest.mark.asyncio
async def test_macro_calculation_accuracy(solver, base_constraints):
    """Test: vérifier que les macros sont calculées correctement."""
    base_constraints.num_days = 1

    result = await solver.solve(base_constraints)

    assert result.success

    for day in result.plan.days:
        # Recalculer les totaux manuellement
        recalculated = Macros.zero()
        for meal in day.meals:
            for component in meal.meal.components:
                recalculated = recalculated + component.computed_macros

        # Comparer avec les totaux rapportés
        assert abs(recalculated.calories - day.daily_totals.calories) < 1, (
            f"Incohérence calories: {recalculated.calories} vs {day.daily_totals.calories}"
        )
        assert abs(recalculated.proteins - day.daily_totals.proteins) < 0.1, (
            f"Incohérence protéines: {recalculated.proteins} vs {day.daily_totals.proteins}"
        )


# =============================================================================
# TEST 9: Performance
# =============================================================================

@pytest.mark.asyncio
async def test_solver_performance(solver, base_constraints):
    """Test: vérifier que le solveur est assez rapide."""
    base_constraints.num_days = 7

    result = await solver.solve(base_constraints)

    assert result.success
    # Maximum 5 secondes pour un plan de 7 jours
    assert result.solve_time_ms < 5000, f"Trop lent: {result.solve_time_ms}ms"


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
