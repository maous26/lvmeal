"""
Pydantic schemas for the meal planner.

These schemas define the contract between:
- Input (user constraints)
- Data (ingredients/recipes)
- Output (validated meal plans)
"""

from datetime import date
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# =============================================================================
# ENUMS
# =============================================================================

class DietType(str, Enum):
    OMNIVORE = "omnivore"
    VEGETARIAN = "vegetarian"
    VEGAN = "vegan"
    PESCATARIAN = "pescatarian"
    KETO = "keto"
    PALEO = "paleo"
    LOW_CARB = "lowcarb"
    GLUTEN_FREE = "glutenfree"
    DAIRY_FREE = "dairyfree"


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    SNACK = "snack"
    DINNER = "dinner"


class Allergen(str, Enum):
    GLUTEN = "gluten"
    DAIRY = "dairy"
    EGGS = "eggs"
    NUTS = "nuts"
    PEANUTS = "peanuts"
    SOY = "soy"
    FISH = "fish"
    SHELLFISH = "shellfish"
    SESAME = "sesame"
    SULFITES = "sulfites"


class MealSourcePreference(str, Enum):
    """
    Préférence utilisateur pour la source des repas.
    Influence la stratégie de sélection des aliments par le solveur.
    """
    FRESH = "fresh"      # Priorité produits frais (CIQUAL) - fruits, légumes, viandes
    RECIPES = "recipes"  # Priorité recettes maison (Gustar) - plats élaborés
    QUICK = "quick"      # Priorité rapide/pratique (OFF) - produits du commerce
    BALANCED = "balanced"  # Mix intelligent des 3 sources (défaut)


# =============================================================================
# NUTRITION
# =============================================================================

class Macros(BaseModel):
    """Nutritional macros - all values per 100g or total depending on context."""
    calories: float = Field(ge=0, description="kcal")
    proteins: float = Field(ge=0, description="grams")
    carbs: float = Field(ge=0, description="grams")
    fats: float = Field(ge=0, description="grams")
    fiber: Optional[float] = Field(default=None, ge=0, description="grams")
    sodium: Optional[float] = Field(default=None, ge=0, description="mg")
    sugar: Optional[float] = Field(default=None, ge=0, description="grams")
    saturated_fat: Optional[float] = Field(default=None, ge=0, description="grams")

    def scale(self, factor: float) -> "Macros":
        """Scale all macros by a factor (e.g., for portion adjustment)."""
        return Macros(
            calories=self.calories * factor,
            proteins=self.proteins * factor,
            carbs=self.carbs * factor,
            fats=self.fats * factor,
            fiber=self.fiber * factor if self.fiber else None,
            sodium=self.sodium * factor if self.sodium else None,
            sugar=self.sugar * factor if self.sugar else None,
            saturated_fat=self.saturated_fat * factor if self.saturated_fat else None,
        )

    def __add__(self, other: "Macros") -> "Macros":
        """Add two Macros together."""
        return Macros(
            calories=self.calories + other.calories,
            proteins=self.proteins + other.proteins,
            carbs=self.carbs + other.carbs,
            fats=self.fats + other.fats,
            fiber=(self.fiber or 0) + (other.fiber or 0) if self.fiber or other.fiber else None,
            sodium=(self.sodium or 0) + (other.sodium or 0) if self.sodium or other.sodium else None,
            sugar=(self.sugar or 0) + (other.sugar or 0) if self.sugar or other.sugar else None,
            saturated_fat=(self.saturated_fat or 0) + (other.saturated_fat or 0) if self.saturated_fat or other.saturated_fat else None,
        )

    @classmethod
    def zero(cls) -> "Macros":
        """Return a zero-valued Macros object."""
        return cls(calories=0, proteins=0, carbs=0, fats=0)


# =============================================================================
# INGREDIENTS
# =============================================================================

class Ingredient(BaseModel):
    """
    An ingredient with nutritional data per 100g.
    This is the base data unit for calculations.
    """
    id: str = Field(description="Unique identifier (e.g., CIQUAL code)")
    name: str = Field(min_length=1)
    name_fr: Optional[str] = Field(default=None, description="French name")
    macros_per_100g: Macros = Field(description="Nutrition per 100g")
    allergens: list[Allergen] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list, description="e.g., 'protein', 'vegetable', 'fruit'")
    category: Optional[str] = Field(default=None, description="Food category")
    # Portion hints for the solver
    typical_portion_g: Optional[float] = Field(default=None, ge=0, description="Typical serving size in grams")
    min_portion_g: Optional[float] = Field(default=None, ge=0)
    max_portion_g: Optional[float] = Field(default=None, ge=0)


# =============================================================================
# FOOD SOURCES - Données provenant de CIQUAL, OFF, Gustar
# =============================================================================

class FoodSource(str, Enum):
    """Sources de données alimentaires."""
    CIQUAL = "ciqual"       # Base française officielle (aliments génériques)
    OFF = "off"             # Open Food Facts (produits de marque)
    GUSTAR = "gustar"       # Recettes complètes
    MANUAL = "manual"       # Entrée manuelle


class FoodRole(str, Enum):
    """Rôle d'un aliment dans un repas."""
    PROTEIN = "protein"      # Viande, poisson, œufs, légumineuses
    CARB = "carb"           # Féculents, céréales, pain
    VEGETABLE = "vegetable"  # Légumes
    FRUIT = "fruit"          # Fruits
    FAT = "fat"             # Huiles, beurre, avocat
    DAIRY = "dairy"          # Produits laitiers
    DRINK = "drink"          # Boissons
    SEASONING = "seasoning"  # Épices, condiments (calories négligeables)


class FoodItem(BaseModel):
    """
    Un aliment provenant d'une source (CIQUAL, OFF, Gustar).
    Représente un ingrédient ou un produit avec ses données nutritionnelles.
    """
    id: str = Field(description="ID unique (ex: ciqual_1234, off_barcode, gustar_recipe_id)")
    source: FoodSource
    name: str
    name_fr: Optional[str] = None
    brand: Optional[str] = Field(default=None, description="Marque (pour OFF)")

    # Données nutritionnelles par 100g
    macros_per_100g: Macros

    # Classification
    role: FoodRole = Field(description="Rôle principal dans un repas")
    category: Optional[str] = Field(default=None, description="Catégorie (ex: volaille, légume vert)")
    tags: list[str] = Field(default_factory=list)

    # Contraintes
    allergens: list[Allergen] = Field(default_factory=list)
    diet_compatible: list[DietType] = Field(default_factory=list, description="Régimes compatibles")

    # Portions typiques
    typical_portion_g: float = Field(default=100, ge=1)
    min_portion_g: float = Field(default=10, ge=1)
    max_portion_g: float = Field(default=500, ge=1)

    # Image (pour OFF et Gustar)
    image_url: Optional[str] = None


class GustartRecipe(BaseModel):
    """
    Une recette complète provenant de Gustar.
    Contrairement aux FoodItems, c'est une composition prête à l'emploi.
    """
    id: str
    source: FoodSource = FoodSource.GUSTAR
    name: str
    name_fr: Optional[str] = None
    description: Optional[str] = None

    # Nutrition TOTALE de la recette (pas par 100g)
    total_macros: Macros
    servings: int = Field(ge=1, default=1)

    # Macros par portion
    @property
    def macros_per_serving(self) -> Macros:
        return self.total_macros.scale(1 / self.servings)

    # Ingrédients (pour affichage, pas pour calcul - déjà intégrés dans total_macros)
    ingredients_list: list[str] = Field(default_factory=list, description="Liste textuelle des ingrédients")

    # Instructions
    steps: list[str] = Field(default_factory=list)

    # Métadonnées
    prep_time_min: Optional[int] = None
    cook_time_min: Optional[int] = None
    difficulty: Optional[str] = None
    cuisine_tags: list[str] = Field(default_factory=list)
    diet_tags: list[DietType] = Field(default_factory=list)
    meal_types: list[MealType] = Field(default_factory=list)
    allergens: list[Allergen] = Field(default_factory=list)
    image_url: Optional[str] = None


# =============================================================================
# MEAL COMPOSITION - Repas composé par le solveur
# =============================================================================

class MealComponent(BaseModel):
    """
    Un composant d'un repas avec sa quantité calculée.
    Peut être un aliment simple (CIQUAL/OFF) ou une recette (Gustar).
    """
    # Source
    food_id: str
    source: FoodSource
    name: str
    name_fr: Optional[str] = None

    # Quantité CALCULÉE par le solveur
    grams: float = Field(gt=0, description="Quantité en grammes")
    servings: Optional[float] = Field(default=None, description="Nombre de portions (pour recettes Gustar)")

    # Macros pour cette quantité spécifique (calculées)
    computed_macros: Macros

    # Métadonnées
    role: FoodRole
    image_url: Optional[str] = None

    # Traçabilité
    @property
    def display_quantity(self) -> str:
        """Affichage lisible de la quantité."""
        if self.grams >= 1000:
            return f"{self.grams / 1000:.1f} kg"
        return f"{int(self.grams)} g"


class ComposedMeal(BaseModel):
    """
    Un repas entièrement composé par le solveur à partir des sources de données.
    Les quantités sont calculées pour atteindre les cibles nutritionnelles.
    """
    meal_type: MealType

    # Composants du repas (aliments/recettes avec quantités calculées)
    components: list[MealComponent] = Field(min_length=1)

    # Cibles nutritionnelles pour ce repas
    target_macros: Macros

    # Macros réellement atteintes (somme des composants)
    @property
    def actual_macros(self) -> Macros:
        result = Macros.zero()
        for comp in self.components:
            result = result + comp.computed_macros
        return result

    # Écart par rapport aux cibles
    @property
    def calorie_deviation_pct(self) -> float:
        if self.target_macros.calories == 0:
            return 0
        return ((self.actual_macros.calories - self.target_macros.calories)
                / self.target_macros.calories * 100)

    # Validation
    def is_within_tolerance(self, calorie_tolerance_pct: float = 5.0) -> bool:
        return abs(self.calorie_deviation_pct) <= calorie_tolerance_pct

    # Pour l'affichage (enrichi par LLM)
    display_name: Optional[str] = None
    display_description: Optional[str] = None


# =============================================================================
# CONSTRAINTS (User Input)
# =============================================================================

class NutritionTarget(BaseModel):
    """Daily nutrition target with tolerances."""
    calories: float = Field(gt=0)
    proteins: Optional[float] = Field(default=None, ge=0)
    carbs: Optional[float] = Field(default=None, ge=0)
    fats: Optional[float] = Field(default=None, ge=0)
    fiber_min: Optional[float] = Field(default=None, ge=0)
    sodium_max: Optional[float] = Field(default=None, ge=0, description="mg")

    # Tolerances (default ±5%)
    calorie_tolerance_pct: float = Field(default=5.0, ge=0, le=20)
    macro_tolerance_pct: float = Field(default=10.0, ge=0, le=30)

    @property
    def calorie_min(self) -> float:
        return self.calories * (1 - self.calorie_tolerance_pct / 100)

    @property
    def calorie_max(self) -> float:
        return self.calories * (1 + self.calorie_tolerance_pct / 100)


class MealDistribution(BaseModel):
    """How to distribute daily calories across meals."""
    breakfast_pct: float = Field(default=25.0, ge=0, le=100)
    lunch_pct: float = Field(default=35.0, ge=0, le=100)
    snack_pct: float = Field(default=10.0, ge=0, le=100)
    dinner_pct: float = Field(default=30.0, ge=0, le=100)

    @model_validator(mode='after')
    def validate_total(self) -> "MealDistribution":
        total = self.breakfast_pct + self.lunch_pct + self.snack_pct + self.dinner_pct
        if abs(total - 100.0) > 0.1:
            raise ValueError(f"Meal distribution must sum to 100%, got {total}%")
        return self


class UserConstraints(BaseModel):
    """All user constraints for meal plan generation."""
    # Nutrition
    daily_target: NutritionTarget
    meal_distribution: MealDistribution = Field(default_factory=MealDistribution)

    # Diet
    diet_type: DietType = Field(default=DietType.OMNIVORE)
    allergies: list[Allergen] = Field(default_factory=list)
    intolerances: list[Allergen] = Field(default_factory=list)

    # Preferences
    disliked_ingredients: list[str] = Field(default_factory=list, description="Ingredient IDs to exclude")
    preferred_ingredients: list[str] = Field(default_factory=list, description="Ingredient IDs to prioritize")
    preferred_cuisines: list[str] = Field(default_factory=list)

    # Practical
    max_prep_time_weekday_min: Optional[int] = Field(default=30, ge=0)
    max_prep_time_weekend_min: Optional[int] = Field(default=60, ge=0)
    cooking_skill: str = Field(default="intermediate", pattern="^(beginner|intermediate|advanced)$")

    # Source preferences (influences data source selection)
    meal_source_preference: MealSourcePreference = Field(
        default=MealSourcePreference.BALANCED,
        description="Préférence pour la source des repas (fresh=CIQUAL, recipes=Gustar, quick=OFF, balanced=mix)"
    )

    # Plan parameters
    num_days: int = Field(default=7, ge=1, le=14)
    include_cheat_meal: bool = Field(default=False, description="Include a 'repas plaisir'")
    cheat_meal_day: Optional[int] = Field(default=None, ge=0, le=6, description="0=Monday, 6=Sunday")


# =============================================================================
# MEAL PLAN OUTPUT
# =============================================================================

class PlannedMeal(BaseModel):
    """
    Un repas planifié avec sa composition calculée par le solveur.
    Contient les aliments/recettes sélectionnés depuis CIQUAL/OFF/Gustar
    avec les quantités ajustées pour atteindre les cibles nutritionnelles.
    """
    day: int = Field(ge=0, description="0-indexed day of the plan")

    # Le repas composé avec tous ses composants et quantités calculées
    meal: ComposedMeal

    # Raccourcis
    @property
    def meal_type(self) -> MealType:
        return self.meal.meal_type

    @property
    def computed_macros(self) -> Macros:
        return self.meal.actual_macros

    @property
    def target_macros(self) -> Macros:
        return self.meal.target_macros

    # Validation
    def is_valid(self, tolerance_pct: float = 5.0) -> bool:
        return self.meal.is_within_tolerance(tolerance_pct)


class DailyPlan(BaseModel):
    """All meals for a single day."""
    day: int
    date: Optional[date] = None
    meals: list[PlannedMeal]
    daily_totals: Macros
    is_cheat_day: bool = False


class MealPlan(BaseModel):
    """Complete meal plan output."""
    id: str
    created_at: str

    # Input reference
    constraints: UserConstraints

    # Output
    days: list[DailyPlan]
    weekly_totals: Macros
    weekly_averages: Macros

    # Validation
    is_valid: bool
    validation_errors: list[str] = Field(default_factory=list)

    # Metadata
    solver_stats: Optional[dict] = Field(default=None, description="Solver performance info")


# =============================================================================
# SOLVER INPUT/OUTPUT
# =============================================================================

class SolverInput(BaseModel):
    """Input to the constraint solver."""
    constraints: UserConstraints
    available_recipes: list[str] = Field(description="Recipe IDs available for selection")
    start_date: Optional[date] = None


class SolverOutput(BaseModel):
    """Raw output from the constraint solver (before LLM enrichment)."""
    success: bool
    plan: Optional[MealPlan] = None

    # If failed
    infeasibility_reason: Optional[str] = None
    relaxation_suggestions: list[str] = Field(default_factory=list)

    # Stats
    solve_time_ms: float
    iterations: int


# =============================================================================
# VALIDATION
# =============================================================================

class ValidationResult(BaseModel):
    """Result of validating a meal plan against constraints."""
    is_valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    # Detailed breakdown
    daily_validation: list[dict] = Field(default_factory=list)
    constraint_violations: list[dict] = Field(default_factory=list)
