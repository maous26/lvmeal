"""
Data Access Layer - Interface unifiée vers CIQUAL, Open Food Facts, et Gustar.

Ce module fournit une abstraction pour accéder aux données alimentaires
depuis les différentes sources, avec un format normalisé.
"""

import json
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
import httpx
from functools import lru_cache

from .schemas import (
    FoodItem, FoodSource, FoodRole, GustartRecipe,
    Macros, DietType, MealType, Allergen, MealSourcePreference
)


# =============================================================================
# SOURCE STRATEGY
# =============================================================================

class SourceStrategy:
    """
    Poids de sélection pour chaque source de données.
    Réplique la logique de determineSourceStrategy() de l'app mobile.
    """
    gustar: float  # 0-1
    ciqual: float  # 0-1
    off: float     # 0-1

    def __init__(self, gustar: float, ciqual: float, off: float):
        self.gustar = gustar
        self.ciqual = ciqual
        self.off = off


def determine_source_strategy(
    preference: MealSourcePreference,
    meal_type: Optional[MealType] = None,
) -> SourceStrategy:
    """
    Détermine la stratégie de sélection de sources basée sur:
    - La préférence utilisateur (fresh, recipes, quick, balanced)
    - Le type de repas (petit-déj/collation = simple, déjeuner/dîner = élaboré)

    Règles:
    - Petit-déjeuner & Collation: produits simples (CIQUAL/OFF), moins de recettes
    - Déjeuner & Dîner: recettes possibles selon la préférence

    Returns:
        SourceStrategy avec les poids pour Gustar, CIQUAL et OFF
    """
    is_simple_meal = meal_type in [MealType.BREAKFAST, MealType.SNACK]
    is_main_meal = meal_type in [MealType.LUNCH, MealType.DINNER]

    if preference == MealSourcePreference.FRESH:
        # Produits frais prioritaires (CIQUAL)
        if is_simple_meal:
            return SourceStrategy(gustar=0, ciqual=0.90, off=0.10)
        else:
            return SourceStrategy(gustar=0.20, ciqual=0.70, off=0.10)

    elif preference == MealSourcePreference.RECIPES:
        # Recettes maison prioritaires (Gustar)
        if is_simple_meal:
            return SourceStrategy(gustar=0.10, ciqual=0.80, off=0.10)
        else:
            return SourceStrategy(gustar=0.70, ciqual=0.20, off=0.10)

    elif preference == MealSourcePreference.QUICK:
        # Produits rapides/pratiques (OFF)
        if is_simple_meal:
            return SourceStrategy(gustar=0.10, ciqual=0.30, off=0.60)
        else:
            return SourceStrategy(gustar=0.30, ciqual=0.30, off=0.40)

    else:  # BALANCED (défaut)
        # Mix équilibré intelligent
        if is_simple_meal:
            return SourceStrategy(gustar=0.10, ciqual=0.70, off=0.20)
        else:
            return SourceStrategy(gustar=0.40, ciqual=0.45, off=0.15)


# =============================================================================
# ABSTRACT DATA SOURCE
# =============================================================================

class FoodDataSource(ABC):
    """Interface abstraite pour une source de données alimentaires."""

    @abstractmethod
    async def search(
        self,
        query: str,
        limit: int = 20,
        role: Optional[FoodRole] = None,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Recherche des aliments par texte."""
        pass

    @abstractmethod
    async def get_by_id(self, food_id: str) -> Optional[FoodItem]:
        """Récupère un aliment par son ID."""
        pass

    @abstractmethod
    async def get_by_role(
        self,
        role: FoodRole,
        limit: int = 20,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Récupère des aliments par leur rôle (protéine, légume, etc.)."""
        pass


# =============================================================================
# CIQUAL DATA SOURCE
# =============================================================================

class CiqualDataSource(FoodDataSource):
    """
    Accès aux données CIQUAL (base française officielle).
    Charge les données depuis un fichier JSON local.
    """

    def __init__(self, data_path: Optional[str] = None):
        self.data_path = data_path or self._find_ciqual_path()
        self._data: Optional[list[dict]] = None
        self._index: dict[str, dict] = {}

    def _find_ciqual_path(self) -> str:
        """Trouve le fichier CIQUAL dans le projet."""
        possible_paths = [
            Path(__file__).parent.parent.parent.parent / "data" / "ciqual.json",
            Path(__file__).parent.parent.parent.parent.parent / "data" / "ciqual.json",
            Path(__file__).parent.parent.parent.parent.parent / "mobile" / "src" / "data" / "ciqual.json",
        ]
        for p in possible_paths:
            if p.exists():
                return str(p)
        raise FileNotFoundError("CIQUAL data file not found")

    def _load_data(self) -> list[dict]:
        """Charge les données CIQUAL depuis le fichier JSON."""
        if self._data is None:
            with open(self.data_path, 'r', encoding='utf-8') as f:
                self._data = json.load(f)
            # Créer un index par code
            for item in self._data:
                code = item.get('code') or item.get('alim_code')
                if code:
                    self._index[str(code)] = item
        return self._data

    def _item_to_food(self, item: dict) -> FoodItem:
        """Convertit un item CIQUAL en FoodItem."""
        code = str(item.get('code') or item.get('alim_code', ''))
        name = item.get('alim_nom_fr') or item.get('name', '')

        # Extraire les macros (CIQUAL utilise des noms de colonnes spécifiques)
        macros = Macros(
            calories=float(item.get('energie_kcal') or item.get('calories') or 0),
            proteins=float(item.get('proteines') or item.get('proteins') or 0),
            carbs=float(item.get('glucides') or item.get('carbs') or 0),
            fats=float(item.get('lipides') or item.get('fats') or 0),
            fiber=float(item.get('fibres') or item.get('fiber') or 0) if item.get('fibres') or item.get('fiber') else None,
            sodium=float(item.get('sodium') or 0) * 1000 if item.get('sodium') else None,  # g -> mg
            sugar=float(item.get('sucres') or item.get('sugar') or 0) if item.get('sucres') or item.get('sugar') else None,
        )

        # Déterminer le rôle basé sur la catégorie
        role = self._determine_role(item)

        # Régimes compatibles (simplification)
        diet_compatible = self._determine_diets(item, role)

        return FoodItem(
            id=f"ciqual_{code}",
            source=FoodSource.CIQUAL,
            name=name,
            name_fr=name,
            macros_per_100g=macros,
            role=role,
            category=item.get('alim_grp_nom_fr') or item.get('group'),
            tags=self._extract_tags(item),
            allergens=self._extract_allergens(item),
            diet_compatible=diet_compatible,
            typical_portion_g=self._typical_portion(role),
        )

    def _determine_role(self, item: dict) -> FoodRole:
        """Détermine le rôle d'un aliment basé sur sa catégorie CIQUAL."""
        group = (item.get('alim_grp_nom_fr') or item.get('group') or '').lower()
        subgroup = (item.get('alim_ssgrp_nom_fr') or item.get('subgroup') or '').lower()
        name = (item.get('alim_nom_fr') or item.get('name') or '').lower()

        # Protéines
        if any(kw in group for kw in ['viande', 'poisson', 'œuf', 'oeuf', 'légumineuse']):
            return FoodRole.PROTEIN
        if any(kw in name for kw in ['poulet', 'bœuf', 'porc', 'saumon', 'thon', 'œuf', 'tofu', 'lentille']):
            return FoodRole.PROTEIN

        # Glucides / Féculents
        if any(kw in group for kw in ['céréale', 'pain', 'pâte', 'riz', 'pomme de terre']):
            return FoodRole.CARB
        if any(kw in name for kw in ['riz', 'pâtes', 'pain', 'quinoa', 'semoule']):
            return FoodRole.CARB

        # Légumes
        if 'légume' in group or 'légume' in subgroup:
            return FoodRole.VEGETABLE

        # Fruits
        if 'fruit' in group:
            return FoodRole.FRUIT

        # Produits laitiers
        if any(kw in group for kw in ['lait', 'fromage', 'yaourt', 'produit laitier']):
            return FoodRole.DAIRY

        # Matières grasses
        if any(kw in group for kw in ['huile', 'matière grasse', 'beurre']):
            return FoodRole.FAT

        # Boissons
        if 'boisson' in group:
            return FoodRole.DRINK

        # Condiments / Assaisonnements
        if any(kw in group for kw in ['condiment', 'épice', 'sauce']):
            return FoodRole.SEASONING

        # Défaut basé sur les macros
        macros = item
        proteins = float(macros.get('proteines') or macros.get('proteins') or 0)
        carbs = float(macros.get('glucides') or macros.get('carbs') or 0)
        fats = float(macros.get('lipides') or macros.get('fats') or 0)

        if proteins > 15:
            return FoodRole.PROTEIN
        if carbs > 40:
            return FoodRole.CARB
        if fats > 30:
            return FoodRole.FAT

        return FoodRole.VEGETABLE  # Défaut

    def _determine_diets(self, item: dict, role: FoodRole) -> list[DietType]:
        """Détermine les régimes compatibles."""
        diets = [DietType.OMNIVORE]
        group = (item.get('alim_grp_nom_fr') or item.get('group') or '').lower()
        name = (item.get('alim_nom_fr') or item.get('name') or '').lower()

        # Végétarien (pas de viande/poisson)
        is_meat = any(kw in group + name for kw in ['viande', 'poisson', 'bœuf', 'porc', 'poulet', 'saumon', 'thon'])
        if not is_meat:
            diets.append(DietType.VEGETARIAN)

        # Végan (pas de produits animaux)
        is_animal = is_meat or any(kw in group + name for kw in ['lait', 'fromage', 'œuf', 'oeuf', 'yaourt', 'beurre', 'crème'])
        if not is_animal:
            diets.append(DietType.VEGAN)

        # Pescatarien
        is_meat_not_fish = any(kw in group + name for kw in ['viande', 'bœuf', 'porc', 'poulet', 'agneau'])
        if not is_meat_not_fish:
            diets.append(DietType.PESCATARIAN)

        # Keto / Low-carb (faible en glucides)
        carbs = float(item.get('glucides') or item.get('carbs') or 0)
        if carbs < 10:
            diets.extend([DietType.KETO, DietType.LOW_CARB])

        return diets

    def _extract_tags(self, item: dict) -> list[str]:
        """Extrait des tags de l'item."""
        tags = []
        group = item.get('alim_grp_nom_fr') or item.get('group') or ''
        subgroup = item.get('alim_ssgrp_nom_fr') or item.get('subgroup') or ''
        if group:
            tags.append(group.lower())
        if subgroup:
            tags.append(subgroup.lower())
        return tags

    def _extract_allergens(self, item: dict) -> list[Allergen]:
        """Extrait les allergènes potentiels."""
        allergens = []
        name = (item.get('alim_nom_fr') or item.get('name') or '').lower()
        group = (item.get('alim_grp_nom_fr') or item.get('group') or '').lower()

        if any(kw in name + group for kw in ['gluten', 'blé', 'seigle', 'orge', 'pain', 'pâte']):
            allergens.append(Allergen.GLUTEN)
        if any(kw in name + group for kw in ['lait', 'fromage', 'yaourt', 'crème', 'beurre']):
            allergens.append(Allergen.DAIRY)
        if 'œuf' in name or 'oeuf' in name:
            allergens.append(Allergen.EGGS)
        if any(kw in name for kw in ['noix', 'amande', 'noisette', 'pistache', 'cajou']):
            allergens.append(Allergen.NUTS)
        if 'arachide' in name or 'cacahuète' in name:
            allergens.append(Allergen.PEANUTS)
        if 'soja' in name:
            allergens.append(Allergen.SOY)
        if any(kw in name + group for kw in ['poisson', 'saumon', 'thon', 'cabillaud']):
            allergens.append(Allergen.FISH)
        if any(kw in name for kw in ['crevette', 'crabe', 'homard', 'moule', 'huître']):
            allergens.append(Allergen.SHELLFISH)
        if 'sésame' in name:
            allergens.append(Allergen.SESAME)

        return allergens

    def _typical_portion(self, role: FoodRole) -> float:
        """Retourne une portion typique selon le rôle."""
        portions = {
            FoodRole.PROTEIN: 150,
            FoodRole.CARB: 150,
            FoodRole.VEGETABLE: 150,
            FoodRole.FRUIT: 150,
            FoodRole.DAIRY: 125,
            FoodRole.FAT: 15,
            FoodRole.DRINK: 250,
            FoodRole.SEASONING: 5,
        }
        return portions.get(role, 100)

    async def search(
        self,
        query: str,
        limit: int = 20,
        role: Optional[FoodRole] = None,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Recherche dans CIQUAL."""
        data = self._load_data()
        query_lower = query.lower()
        results = []

        for item in data:
            name = (item.get('alim_nom_fr') or item.get('name') or '').lower()
            if query_lower not in name:
                continue

            food = self._item_to_food(item)

            # Filtrer par rôle
            if role and food.role != role:
                continue

            # Filtrer par régime
            if diet and diet not in food.diet_compatible:
                continue

            # Exclure allergènes
            if exclude_allergens:
                if any(a in food.allergens for a in exclude_allergens):
                    continue

            results.append(food)
            if len(results) >= limit:
                break

        return results

    async def get_by_id(self, food_id: str) -> Optional[FoodItem]:
        """Récupère par ID (format: ciqual_CODE)."""
        self._load_data()
        code = food_id.replace('ciqual_', '')
        item = self._index.get(code)
        if item:
            return self._item_to_food(item)
        return None

    async def get_by_role(
        self,
        role: FoodRole,
        limit: int = 20,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Récupère des aliments par rôle."""
        data = self._load_data()
        results = []

        for item in data:
            food = self._item_to_food(item)

            if food.role != role:
                continue

            if diet and diet not in food.diet_compatible:
                continue

            if exclude_allergens:
                if any(a in food.allergens for a in exclude_allergens):
                    continue

            results.append(food)
            if len(results) >= limit:
                break

        return results


# =============================================================================
# OPEN FOOD FACTS DATA SOURCE
# =============================================================================

class OpenFoodFactsDataSource(FoodDataSource):
    """
    Accès aux données Open Food Facts (produits de marque).
    Utilise l'API REST.
    """

    BASE_URL = "https://world.openfoodfacts.org"
    SEARCH_URL = f"{BASE_URL}/cgi/search.pl"

    def __init__(self, timeout: float = 8.0):
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    def _product_to_food(self, product: dict) -> Optional[FoodItem]:
        """Convertit un produit OFF en FoodItem."""
        nutriments = product.get('nutriments', {})

        # Vérifier qu'on a les données minimales
        calories = nutriments.get('energy-kcal_100g') or nutriments.get('energy_100g', 0)
        if not calories:
            return None

        name = product.get('product_name_fr') or product.get('product_name', '')
        if not name:
            return None

        macros = Macros(
            calories=float(calories),
            proteins=float(nutriments.get('proteins_100g', 0)),
            carbs=float(nutriments.get('carbohydrates_100g', 0)),
            fats=float(nutriments.get('fat_100g', 0)),
            fiber=float(nutriments.get('fiber_100g', 0)) if nutriments.get('fiber_100g') else None,
            sodium=float(nutriments.get('sodium_100g', 0)) * 1000 if nutriments.get('sodium_100g') else None,
            sugar=float(nutriments.get('sugars_100g', 0)) if nutriments.get('sugars_100g') else None,
            saturated_fat=float(nutriments.get('saturated-fat_100g', 0)) if nutriments.get('saturated-fat_100g') else None,
        )

        # Déterminer le rôle (simplifié pour OFF)
        categories = (product.get('categories', '') or '').lower()
        role = self._determine_role_from_categories(categories, macros)

        return FoodItem(
            id=f"off_{product.get('code', product.get('_id', ''))}",
            source=FoodSource.OFF,
            name=name,
            name_fr=name,
            brand=product.get('brands'),
            macros_per_100g=macros,
            role=role,
            category=product.get('categories_tags', [''])[0] if product.get('categories_tags') else None,
            tags=product.get('categories_tags', [])[:5],
            allergens=self._extract_allergens(product),
            diet_compatible=self._determine_diets(product),
            image_url=product.get('image_front_small_url') or product.get('image_url'),
        )

    def _determine_role_from_categories(self, categories: str, macros: Macros) -> FoodRole:
        """Détermine le rôle basé sur les catégories OFF."""
        if any(kw in categories for kw in ['meat', 'fish', 'egg', 'viande', 'poisson']):
            return FoodRole.PROTEIN
        if any(kw in categories for kw in ['bread', 'pasta', 'rice', 'cereal', 'pain', 'pâte', 'riz']):
            return FoodRole.CARB
        if any(kw in categories for kw in ['vegetable', 'légume']):
            return FoodRole.VEGETABLE
        if any(kw in categories for kw in ['fruit']):
            return FoodRole.FRUIT
        if any(kw in categories for kw in ['dairy', 'milk', 'cheese', 'lait', 'fromage']):
            return FoodRole.DAIRY
        if any(kw in categories for kw in ['oil', 'butter', 'huile', 'beurre']):
            return FoodRole.FAT
        if any(kw in categories for kw in ['beverage', 'drink', 'boisson']):
            return FoodRole.DRINK

        # Basé sur les macros
        if macros.proteins > 15:
            return FoodRole.PROTEIN
        if macros.carbs > 40:
            return FoodRole.CARB
        return FoodRole.VEGETABLE

    def _extract_allergens(self, product: dict) -> list[Allergen]:
        """Extrait les allergènes depuis OFF."""
        allergens = []
        allergens_tags = product.get('allergens_tags', [])

        mapping = {
            'en:gluten': Allergen.GLUTEN,
            'en:milk': Allergen.DAIRY,
            'en:eggs': Allergen.EGGS,
            'en:nuts': Allergen.NUTS,
            'en:peanuts': Allergen.PEANUTS,
            'en:soybeans': Allergen.SOY,
            'en:fish': Allergen.FISH,
            'en:crustaceans': Allergen.SHELLFISH,
            'en:sesame-seeds': Allergen.SESAME,
            'en:sulphur-dioxide-and-sulphites': Allergen.SULFITES,
        }

        for tag in allergens_tags:
            if tag in mapping:
                allergens.append(mapping[tag])

        return allergens

    def _determine_diets(self, product: dict) -> list[DietType]:
        """Détermine les régimes compatibles."""
        diets = [DietType.OMNIVORE]
        labels = product.get('labels_tags', [])

        if 'en:vegetarian' in labels:
            diets.append(DietType.VEGETARIAN)
        if 'en:vegan' in labels:
            diets.extend([DietType.VEGETARIAN, DietType.VEGAN])
        if 'en:gluten-free' in labels:
            diets.append(DietType.GLUTEN_FREE)

        return list(set(diets))

    async def search(
        self,
        query: str,
        limit: int = 20,
        role: Optional[FoodRole] = None,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Recherche dans Open Food Facts."""
        client = await self._get_client()

        params = {
            'search_terms': query,
            'search_simple': 1,
            'action': 'process',
            'json': 1,
            'page_size': min(limit * 2, 50),  # Demander plus car on va filtrer
            'lc': 'fr',
            'countries_tags': 'france',
            'sort_by': 'unique_scans_n',
            'fields': 'code,product_name,product_name_fr,brands,nutriments,categories,categories_tags,allergens_tags,labels_tags,image_front_small_url',
        }

        try:
            response = await client.get(self.SEARCH_URL, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"[OFF] Search error: {e}")
            return []

        results = []
        for product in data.get('products', []):
            food = self._product_to_food(product)
            if not food:
                continue

            # Filtrer par rôle
            if role and food.role != role:
                continue

            # Filtrer par régime
            if diet and diet not in food.diet_compatible:
                continue

            # Exclure allergènes
            if exclude_allergens:
                if any(a in food.allergens for a in exclude_allergens):
                    continue

            results.append(food)
            if len(results) >= limit:
                break

        return results

    async def get_by_id(self, food_id: str) -> Optional[FoodItem]:
        """Récupère par barcode."""
        client = await self._get_client()
        barcode = food_id.replace('off_', '')

        try:
            response = await client.get(f"{self.BASE_URL}/api/v2/product/{barcode}.json")
            response.raise_for_status()
            data = response.json()
            if data.get('status') == 1:
                return self._product_to_food(data.get('product', {}))
        except Exception as e:
            print(f"[OFF] Get by ID error: {e}")

        return None

    async def get_by_role(
        self,
        role: FoodRole,
        limit: int = 20,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Recherche par rôle (utilise des mots-clés)."""
        role_queries = {
            FoodRole.PROTEIN: "poulet viande poisson",
            FoodRole.CARB: "pâtes riz pain",
            FoodRole.VEGETABLE: "légumes salade",
            FoodRole.FRUIT: "fruits",
            FoodRole.DAIRY: "yaourt fromage lait",
            FoodRole.FAT: "huile beurre",
            FoodRole.DRINK: "boisson jus",
        }
        query = role_queries.get(role, "")
        return await self.search(query, limit, role, diet, exclude_allergens)


# =============================================================================
# GUSTAR DATA SOURCE (Enriched Recipes)
# =============================================================================

class GustartDataSource(FoodDataSource):
    """
    Accès aux recettes enrichies de Gustar.
    Ces recettes sont des plats complets avec macros calculées.
    """

    def __init__(self, data_path: Optional[str] = None):
        self.data_path = data_path or self._find_gustar_path()
        self._data: Optional[list[dict]] = None
        self._index: dict[str, dict] = {}

    def _find_gustar_path(self) -> str:
        """Trouve le fichier enriched-recipes.json dans le projet."""
        possible_paths = [
            Path(__file__).parent.parent.parent.parent / "mobile" / "src" / "data" / "enriched-recipes.json",
            Path(__file__).parent.parent.parent.parent.parent / "mobile" / "src" / "data" / "enriched-recipes.json",
            Path(__file__).parent.parent.parent / "data" / "enriched-recipes.json",
        ]
        for p in possible_paths:
            if p.exists():
                return str(p)
        raise FileNotFoundError("Gustar enriched-recipes.json not found")

    def _load_data(self) -> list[dict]:
        """Charge les recettes enrichies depuis le fichier JSON."""
        if self._data is None:
            try:
                with open(self.data_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                self._data = content.get('recipes', [])
                # Créer un index par ID
                for item in self._data:
                    recipe_id = item.get('id', '')
                    if recipe_id:
                        self._index[recipe_id] = item
            except FileNotFoundError:
                self._data = []
        return self._data

    def _item_to_food(self, item: dict) -> FoodItem:
        """Convertit une recette Gustar en FoodItem."""
        recipe_id = item.get('id', '')
        name_fr = item.get('titleFr', item.get('originalTitle', ''))
        servings = item.get('servings', 1) or 1

        nutrition = item.get('nutrition', {})

        # Les macros sont PAR PORTION dans le fichier Gustar enrichi
        # On les convertit en macros par 100g en estimant qu'une portion = ~300g
        portion_weight_g = 300  # Estimation standard
        factor = 100 / portion_weight_g

        macros = Macros(
            calories=float(nutrition.get('calories', 0)) * factor,
            proteins=float(nutrition.get('proteins', 0)) * factor,
            carbs=float(nutrition.get('carbs', 0)) * factor,
            fats=float(nutrition.get('fats', 0)) * factor,
            fiber=float(nutrition.get('fiber', 0)) * factor if nutrition.get('fiber') else None,
            sodium=float(nutrition.get('sodium', 0)) * factor if nutrition.get('sodium') else None,
            sugar=float(nutrition.get('sugar', 0)) * factor if nutrition.get('sugar') else None,
            saturated_fat=float(nutrition.get('saturatedFat', 0)) * factor if nutrition.get('saturatedFat') else None,
        )

        # Déterminer le rôle basé sur le type de repas et le contenu
        meal_type = item.get('mealType', 'dinner')
        role = self._determine_role(item, meal_type)

        # Régimes compatibles basé sur healthScore et titre
        diet_compatible = self._determine_diets(item)

        return FoodItem(
            id=f"gustar_{hash(recipe_id) % 1000000}",  # ID court
            source=FoodSource.GUSTAR,
            name=name_fr,
            name_fr=name_fr,
            macros_per_100g=macros,
            role=role,
            category=meal_type,
            tags=self._extract_tags(item),
            allergens=self._extract_allergens(item),
            diet_compatible=diet_compatible,
            typical_portion_g=portion_weight_g,
            min_portion_g=portion_weight_g * 0.5,
            max_portion_g=portion_weight_g * 1.5,
            image_url=item.get('imageUrl'),
        )

    def _determine_role(self, item: dict, meal_type: str) -> FoodRole:
        """Détermine le rôle principal d'une recette."""
        title = (item.get('titleFr', '') or '').lower()

        # Protéines
        if any(kw in title for kw in ['poulet', 'bœuf', 'porc', 'saumon', 'thon', 'viande', 'poisson', 'œuf', 'tofu']):
            return FoodRole.PROTEIN

        # Fruits
        if any(kw in title for kw in ['fruit', 'smoothie', 'pomme', 'banane', 'fraise']):
            return FoodRole.FRUIT

        # Produits laitiers
        if any(kw in title for kw in ['yaourt', 'fromage', 'lait', 'crème']):
            return FoodRole.DAIRY

        # Légumes
        if any(kw in title for kw in ['salade', 'légume', 'soupe', 'brocoli', 'carotte']):
            return FoodRole.VEGETABLE

        # Glucides
        if any(kw in title for kw in ['pâtes', 'riz', 'pain', 'céréale', 'quinoa']):
            return FoodRole.CARB

        # Basé sur le type de repas
        if meal_type == 'breakfast':
            return FoodRole.CARB
        elif meal_type == 'snack':
            return FoodRole.FRUIT
        else:
            return FoodRole.PROTEIN

    def _determine_diets(self, item: dict) -> list[DietType]:
        """Détermine les régimes compatibles."""
        diets = [DietType.OMNIVORE]
        title = (item.get('titleFr', '') or '').lower()
        description = (item.get('descriptionFr', '') or '').lower()
        combined = f"{title} {description}"

        # Végan
        if 'végan' in combined or 'vegan' in combined:
            diets.extend([DietType.VEGETARIAN, DietType.VEGAN])
        # Végétarien
        elif 'végétarien' in combined or 'vegetarian' in combined:
            diets.append(DietType.VEGETARIAN)
        # Pas de viande = probablement végétarien
        elif not any(kw in combined for kw in ['poulet', 'bœuf', 'porc', 'viande', 'poisson', 'saumon', 'thun']):
            diets.append(DietType.VEGETARIAN)

        # Low-carb basé sur les macros
        nutrition = item.get('nutrition', {})
        carbs = nutrition.get('carbs', 0)
        if carbs < 20:
            diets.append(DietType.LOW_CARB)
        if carbs < 10:
            diets.append(DietType.KETO)

        return diets

    def _extract_tags(self, item: dict) -> list[str]:
        """Extrait des tags de la recette."""
        tags = []
        meal_type = item.get('mealType', '')
        if meal_type:
            tags.append(meal_type)
        difficulty = item.get('difficulty', '')
        if difficulty:
            tags.append(difficulty)
        health_score = item.get('healthScore', 0)
        if health_score >= 80:
            tags.append('très sain')
        elif health_score >= 60:
            tags.append('sain')
        return tags

    def _extract_allergens(self, item: dict) -> list[Allergen]:
        """Extrait les allergènes potentiels basé sur les ingrédients."""
        allergens = []
        ingredients = item.get('ingredientsFr', [])
        ingredients_text = ' '.join(
            (ing.get('name', '') if isinstance(ing, dict) else str(ing)).lower()
            for ing in ingredients
        )
        title = (item.get('titleFr', '') or '').lower()
        combined = f"{title} {ingredients_text}"

        if any(kw in combined for kw in ['gluten', 'blé', 'farine', 'pain', 'pâte']):
            allergens.append(Allergen.GLUTEN)
        if any(kw in combined for kw in ['lait', 'fromage', 'crème', 'yaourt', 'beurre']):
            allergens.append(Allergen.DAIRY)
        if 'œuf' in combined or 'oeuf' in combined:
            allergens.append(Allergen.EGGS)
        if any(kw in combined for kw in ['noix', 'amande', 'noisette']):
            allergens.append(Allergen.NUTS)
        if 'arachide' in combined or 'cacahuète' in combined:
            allergens.append(Allergen.PEANUTS)
        if 'soja' in combined:
            allergens.append(Allergen.SOY)
        if any(kw in combined for kw in ['poisson', 'saumon', 'thun']):
            allergens.append(Allergen.FISH)

        return allergens

    def _get_meal_type(self, item: dict) -> Optional[MealType]:
        """Convertit le mealType Gustar en MealType enum."""
        meal_type_str = item.get('mealType', '').lower()
        mapping = {
            'breakfast': MealType.BREAKFAST,
            'lunch': MealType.LUNCH,
            'snack': MealType.SNACK,
            'dinner': MealType.DINNER,
        }
        return mapping.get(meal_type_str)

    async def search(
        self,
        query: str,
        limit: int = 20,
        role: Optional[FoodRole] = None,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Recherche dans les recettes Gustar."""
        data = self._load_data()
        query_lower = query.lower()
        results = []

        for item in data:
            title = (item.get('titleFr', '') or '').lower()
            description = (item.get('descriptionFr', '') or '').lower()

            if query_lower not in title and query_lower not in description:
                continue

            food = self._item_to_food(item)

            # Filtrer par rôle
            if role and food.role != role:
                continue

            # Filtrer par régime
            if diet and diet not in food.diet_compatible:
                continue

            # Exclure allergènes
            if exclude_allergens:
                if any(a in food.allergens for a in exclude_allergens):
                    continue

            results.append(food)
            if len(results) >= limit:
                break

        return results

    async def get_by_id(self, food_id: str) -> Optional[FoodItem]:
        """Récupère par ID (format: gustar_HASH)."""
        self._load_data()

        # Chercher par hash
        for recipe_id, item in self._index.items():
            if f"gustar_{hash(recipe_id) % 1000000}" == food_id:
                return self._item_to_food(item)

        return None

    async def get_by_role(
        self,
        role: FoodRole,
        limit: int = 20,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """Récupère des recettes par rôle."""
        data = self._load_data()
        results = []

        for item in data:
            food = self._item_to_food(item)

            if food.role != role:
                continue

            if diet and diet not in food.diet_compatible:
                continue

            if exclude_allergens:
                if any(a in food.allergens for a in exclude_allergens):
                    continue

            results.append(food)
            if len(results) >= limit:
                break

        return results

    async def get_by_meal_type(
        self,
        meal_type: MealType,
        limit: int = 20,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
        min_health_score: int = 0,
    ) -> list[FoodItem]:
        """Récupère des recettes par type de repas."""
        data = self._load_data()
        results = []

        for item in data:
            item_meal_type = self._get_meal_type(item)
            if item_meal_type != meal_type:
                continue

            # Filtrer par healthScore
            health_score = item.get('healthScore', 0)
            if health_score < min_health_score:
                continue

            food = self._item_to_food(item)

            if diet and diet not in food.diet_compatible:
                continue

            if exclude_allergens:
                if any(a in food.allergens for a in exclude_allergens):
                    continue

            results.append(food)
            if len(results) >= limit:
                break

        return results

    def get_recipe_details(self, recipe_id: str) -> Optional[GustartRecipe]:
        """Récupère les détails complets d'une recette Gustar."""
        self._load_data()
        item = self._index.get(recipe_id)
        if not item:
            # Chercher par hash
            for rid, data in self._index.items():
                if f"gustar_{hash(rid) % 1000000}" == recipe_id:
                    item = data
                    break

        if not item:
            return None

        nutrition = item.get('nutrition', {})
        servings = item.get('servings', 1) or 1

        return GustartRecipe(
            id=recipe_id,
            source=FoodSource.GUSTAR,
            name=item.get('originalTitle', ''),
            name_fr=item.get('titleFr', ''),
            description=item.get('descriptionFr', ''),
            total_macros=Macros(
                calories=float(nutrition.get('calories', 0)) * servings,
                proteins=float(nutrition.get('proteins', 0)) * servings,
                carbs=float(nutrition.get('carbs', 0)) * servings,
                fats=float(nutrition.get('fats', 0)) * servings,
                fiber=float(nutrition.get('fiber', 0)) * servings if nutrition.get('fiber') else None,
                sodium=float(nutrition.get('sodium', 0)) * servings if nutrition.get('sodium') else None,
                sugar=float(nutrition.get('sugar', 0)) * servings if nutrition.get('sugar') else None,
            ),
            servings=servings,
            ingredients_list=[
                f"{ing.get('amount', '')} {ing.get('unit', '')} {ing.get('name', '')}".strip()
                for ing in item.get('ingredientsFr', [])
            ],
            steps=item.get('instructionsFr', []),
            prep_time_min=item.get('prepTime'),
            cook_time_min=item.get('cookTime'),
            difficulty=item.get('difficulty'),
            meal_types=[self._get_meal_type(item)] if self._get_meal_type(item) else [],
            image_url=item.get('imageUrl'),
        )


# =============================================================================
# UNIFIED DATA ACCESS
# =============================================================================

class UnifiedFoodDataAccess:
    """
    Accès unifié à toutes les sources de données alimentaires.
    Priorise: CIQUAL (référence) > Gustar (recettes) > OFF (marques)
    """

    def __init__(self):
        self.ciqual = CiqualDataSource()
        self.off = OpenFoodFactsDataSource()
        self.gustar = GustartDataSource()

    async def search(
        self,
        query: str,
        limit: int = 20,
        sources: Optional[list[FoodSource]] = None,
        role: Optional[FoodRole] = None,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
    ) -> list[FoodItem]:
        """
        Recherche unifiée sur toutes les sources.
        Par défaut: CIQUAL d'abord, puis Gustar, puis OFF si besoin.
        """
        if sources is None:
            sources = [FoodSource.CIQUAL, FoodSource.GUSTAR, FoodSource.OFF]

        results = []

        if FoodSource.CIQUAL in sources:
            ciqual_results = await self.ciqual.search(
                query, limit, role, diet, exclude_allergens
            )
            results.extend(ciqual_results)

        # Compléter avec Gustar si pas assez de résultats
        remaining = limit - len(results)
        if remaining > 0 and FoodSource.GUSTAR in sources:
            gustar_results = await self.gustar.search(
                query, remaining, role, diet, exclude_allergens
            )
            results.extend(gustar_results)

        # Compléter avec OFF si pas assez de résultats
        remaining = limit - len(results)
        if remaining > 0 and FoodSource.OFF in sources:
            off_results = await self.off.search(
                query, remaining, role, diet, exclude_allergens
            )
            results.extend(off_results)

        return results[:limit]

    async def get_foods_for_meal(
        self,
        target_calories: float,
        meal_type: MealType,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
        preferred_roles: Optional[list[FoodRole]] = None,
        source_preference: MealSourcePreference = MealSourcePreference.BALANCED,
    ) -> dict[FoodRole, list[FoodItem]]:
        """
        Récupère des aliments adaptés pour composer un repas.
        Retourne des options par rôle pour que le solveur puisse choisir.

        La stratégie de sélection est déterminée par:
        - source_preference: préférence utilisateur (fresh/recipes/quick/balanced)
        - meal_type: type de repas (influence le mix de sources)

        Les poids de la stratégie déterminent combien d'aliments de chaque source
        sont inclus dans les résultats.
        """
        # Définir les rôles nécessaires selon le type de repas
        if preferred_roles is None:
            if meal_type == MealType.BREAKFAST:
                preferred_roles = [FoodRole.CARB, FoodRole.DAIRY, FoodRole.FRUIT]
            elif meal_type == MealType.SNACK:
                preferred_roles = [FoodRole.FRUIT, FoodRole.DAIRY]
            else:  # LUNCH, DINNER
                preferred_roles = [FoodRole.PROTEIN, FoodRole.CARB, FoodRole.VEGETABLE, FoodRole.FAT]

        # Obtenir la stratégie de source basée sur les préférences
        strategy = determine_source_strategy(source_preference, meal_type)

        # Calculer le nombre d'items à récupérer de chaque source (sur 15 total)
        total_per_role = 15
        ciqual_limit = max(1, int(total_per_role * strategy.ciqual))
        gustar_limit = max(0, int(total_per_role * strategy.gustar))
        off_limit = max(0, int(total_per_role * strategy.off))

        foods_by_role: dict[FoodRole, list[FoodItem]] = {}

        # Récupérer les aliments de chaque source selon les poids
        for role in preferred_roles:
            role_foods: list[FoodItem] = []

            # CIQUAL (produits frais)
            if ciqual_limit > 0:
                ciqual_foods = await self.ciqual.get_by_role(
                    role, limit=ciqual_limit, diet=diet, exclude_allergens=exclude_allergens
                )
                role_foods.extend(ciqual_foods)

            # Gustar (recettes) - uniquement pour les repas principaux ou si préférence recipes
            if gustar_limit > 0 and (
                meal_type in [MealType.LUNCH, MealType.DINNER] or
                source_preference == MealSourcePreference.RECIPES
            ):
                gustar_foods = await self.gustar.get_by_meal_type(
                    meal_type=meal_type,
                    limit=gustar_limit,
                    diet=diet,
                    exclude_allergens=exclude_allergens,
                    min_health_score=60,
                )
                role_foods.extend(gustar_foods)

            # OFF (produits commerciaux) - si préférence quick ou si le poids est significatif
            # Note: OFF nécessite une requête réseau, donc on l'utilise avec parcimonie
            if off_limit >= 3 and source_preference == MealSourcePreference.QUICK:
                # Pour l'instant, on ne fait pas d'appel OFF pour éviter la latence
                # Les données CIQUAL et Gustar suffisent généralement
                pass

            if role_foods:
                foods_by_role[role] = role_foods

        return foods_by_role

    async def get_by_id(self, food_id: str) -> Optional[FoodItem]:
        """Récupère un aliment par son ID (auto-détecte la source)."""
        if food_id.startswith('ciqual_'):
            return await self.ciqual.get_by_id(food_id)
        elif food_id.startswith('off_'):
            return await self.off.get_by_id(food_id)
        elif food_id.startswith('gustar_'):
            return await self.gustar.get_by_id(food_id)
        return None

    async def get_gustar_recipes_for_meal(
        self,
        meal_type: MealType,
        limit: int = 10,
        diet: Optional[DietType] = None,
        exclude_allergens: Optional[list[Allergen]] = None,
        min_health_score: int = 60,
    ) -> list[FoodItem]:
        """
        Récupère des recettes Gustar complètes pour un type de repas.
        Utile pour proposer des plats prêts à l'emploi.
        """
        return await self.gustar.get_by_meal_type(
            meal_type=meal_type,
            limit=limit,
            diet=diet,
            exclude_allergens=exclude_allergens,
            min_health_score=min_health_score,
        )

    def get_gustar_recipe_details(self, recipe_id: str) -> Optional[GustartRecipe]:
        """Récupère les détails complets d'une recette Gustar (ingrédients, étapes, etc.)."""
        return self.gustar.get_recipe_details(recipe_id)
