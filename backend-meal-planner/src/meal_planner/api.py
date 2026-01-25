"""
FastAPI endpoints pour le Meal Plan Solver.

Endpoints:
- POST /generate-plan : Génère un plan repas complet
- POST /compose-meal : Compose un seul repas
- GET /foods/search : Recherche d'aliments
- POST /validate-plan : Valide un plan existant
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .schemas import (
    UserConstraints, MealType, DietType, Allergen, FoodRole,
    MealPlan, ComposedMeal, FoodItem, SolverOutput,
)
from .solver import MealPlanSolver, MealTargets, SolverConfig
from .data_access import UnifiedFoodDataAccess


# =============================================================================
# APP SETUP
# =============================================================================

app = FastAPI(
    title="Meal Plan Solver API",
    description="API de génération de plans repas nutritionnellement valides",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instances globales
solver = MealPlanSolver()
data_access = UnifiedFoodDataAccess()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GeneratePlanRequest(BaseModel):
    """Requête pour générer un plan complet."""
    constraints: UserConstraints


class ComposeMealRequest(BaseModel):
    """Requête pour composer un seul repas."""
    meal_type: MealType
    target_calories: float
    target_proteins: Optional[float] = None
    target_carbs: Optional[float] = None
    target_fats: Optional[float] = None
    diet: Optional[DietType] = None
    exclude_allergens: Optional[list[Allergen]] = None


class FoodSearchRequest(BaseModel):
    """Requête de recherche d'aliments."""
    query: str
    limit: int = 20
    role: Optional[FoodRole] = None
    diet: Optional[DietType] = None
    exclude_allergens: Optional[list[Allergen]] = None


class FoodSearchResponse(BaseModel):
    """Réponse de recherche d'aliments."""
    results: list[FoodItem]
    total: int


class ValidatePlanRequest(BaseModel):
    """Requête de validation d'un plan."""
    plan: MealPlan


class ValidationResponse(BaseModel):
    """Réponse de validation."""
    is_valid: bool
    errors: list[str]
    warnings: list[str]


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health")
async def health_check():
    """Vérification de l'état du service."""
    return {"status": "healthy", "version": "0.1.0"}


@app.post("/generate-plan", response_model=SolverOutput)
async def generate_plan(request: GeneratePlanRequest):
    """
    Génère un plan repas complet.

    Le solveur:
    1. Calcule les cibles nutritionnelles par repas
    2. Sélectionne des aliments depuis CIQUAL/OFF
    3. Ajuste les quantités pour atteindre les cibles
    4. Valide le plan contre les contraintes
    """
    try:
        result = await solver.solve(request.constraints)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/compose-meal", response_model=ComposedMeal)
async def compose_meal(request: ComposeMealRequest):
    """
    Compose un seul repas avec des quantités calculées.

    Utile pour:
    - Remplacer un repas dans un plan existant
    - Générer des suggestions de repas individuels
    """
    try:
        targets = MealTargets(
            meal_type=request.meal_type,
            target_calories=request.target_calories,
            target_proteins=request.target_proteins,
            target_carbs=request.target_carbs,
            target_fats=request.target_fats,
        )

        meal = await solver.composer.compose_meal(
            targets=targets,
            diet=request.diet,
            exclude_allergens=request.exclude_allergens,
        )
        return meal
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/foods/search", response_model=FoodSearchResponse)
async def search_foods(request: FoodSearchRequest):
    """
    Recherche des aliments dans CIQUAL et Open Food Facts.

    Priorise CIQUAL (référence française) puis complète avec OFF.
    """
    try:
        results = await data_access.search(
            query=request.query,
            limit=request.limit,
            role=request.role,
            diet=request.diet,
            exclude_allergens=request.exclude_allergens,
        )
        return FoodSearchResponse(results=results, total=len(results))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/foods/{food_id}", response_model=FoodItem)
async def get_food(food_id: str):
    """Récupère un aliment par son ID."""
    food = await data_access.get_by_id(food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Aliment non trouvé")
    return food


@app.post("/validate-plan", response_model=ValidationResponse)
async def validate_plan(request: ValidatePlanRequest):
    """
    Valide un plan repas contre ses contraintes.

    Vérifie:
    - Calories dans la tolérance
    - Macros respectées
    - Allergènes exclus
    - Régime alimentaire respecté
    """
    plan = request.plan
    errors = []
    warnings = []

    # Vérifier les totaux journaliers
    tolerance = plan.constraints.daily_target.calorie_tolerance_pct / 100
    target = plan.constraints.daily_target.calories

    for day in plan.days:
        actual = day.daily_totals.calories
        deviation = abs(actual - target) / target

        if deviation > tolerance:
            errors.append(
                f"Jour {day.day + 1}: écart de {deviation * 100:.1f}% "
                f"({actual:.0f} vs {target:.0f} kcal)"
            )
        elif deviation > tolerance / 2:
            warnings.append(
                f"Jour {day.day + 1}: écart de {deviation * 100:.1f}% - proche de la limite"
            )

    # Vérifier la variété
    all_foods = []
    for day in plan.days:
        for meal in day.meals:
            all_foods.extend([c.food_id for c in meal.meal.components])

    if len(all_foods) > 0:
        unique_ratio = len(set(all_foods)) / len(all_foods)
        if unique_ratio < 0.5:
            warnings.append(f"Faible variété: {unique_ratio * 100:.0f}% d'aliments uniques")

    return ValidationResponse(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
