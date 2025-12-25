'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, Check, X, RotateCcw, Clock, Users, ChefHat, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, formatNumber } from '@/lib/utils'
import { generateRecipe, type AIRecipeResult } from '@/app/actions/food-analysis'
import type { MealType, FoodItem } from '@/types'

interface AIMealGeneratorProps {
  mealType: MealType
  maxCalories?: number
  dietType?: string
  restrictions?: string[]
  onRecipeGenerated: (food: FoodItem) => void
  className?: string
}

type GeneratorState = 'idle' | 'generating' | 'result' | 'error'

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'petit-déjeuner',
  lunch: 'déjeuner',
  snack: 'collation',
  dinner: 'dîner',
}

const quickPrompts = [
  { label: 'Rapide & sain', prompt: 'Un repas rapide et équilibré, prêt en moins de 20 minutes' },
  { label: 'Riche en protéines', prompt: 'Un repas riche en protéines pour la récupération musculaire' },
  { label: 'Végétarien', prompt: 'Un repas végétarien savoureux et rassasiant' },
  { label: 'Low carb', prompt: 'Un repas pauvre en glucides mais satisfaisant' },
  { label: 'Comfort food', prompt: 'Un plat réconfortant gourmand mais pas trop calorique' },
  { label: 'Méditerranéen', prompt: 'Une recette méditerranéenne fraîche et saine' },
]

export function AIMealGenerator({
  mealType,
  maxCalories,
  dietType,
  restrictions,
  onRecipeGenerated,
  className,
}: AIMealGeneratorProps) {
  const [state, setState] = React.useState<GeneratorState>('idle')
  const [description, setDescription] = React.useState('')
  const [recipe, setRecipe] = React.useState<AIRecipeResult['recipe'] | null>(null)
  const [error, setError] = React.useState('')

  const handleGenerate = async (customDescription?: string) => {
    const desc = customDescription || description
    setState('generating')
    setError('')

    const result = await generateRecipe({
      mealType: mealTypeLabels[mealType],
      description: desc,
      maxCalories,
      dietType,
      restrictions,
    })

    if (result.success && result.recipe) {
      setRecipe(result.recipe)
      setState('result')
    } else {
      setError(result.error || 'Impossible de générer la recette')
      setState('error')
    }
  }

  const confirmRecipe = () => {
    if (!recipe) return

    const food: FoodItem = {
      id: `ai-recipe-${Date.now()}`,
      name: recipe.title,
      serving: recipe.servings,
      servingUnit: 'portion',
      nutrition: {
        calories: recipe.nutrition.calories,
        proteins: recipe.nutrition.proteins,
        carbs: recipe.nutrition.carbs,
        fats: recipe.nutrition.fats,
      },
      source: 'ai',
    }

    onRecipeGenerated(food)
    reset()
  }

  const reset = () => {
    setState('idle')
    setDescription('')
    setRecipe(null)
    setError('')
  }

  return (
    <div className={cn('space-y-4', className)}>
      <AnimatePresence mode="wait">
        {/* Idle state */}
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                Générer une recette IA
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
                Décrivez ce que vous avez envie de manger et l'IA créera une recette sur mesure
              </p>
            </div>

            {/* Quick prompts */}
            <div>
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase mb-2">
                Suggestions rapides
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleGenerate(item.prompt)}
                    className="px-3 py-1.5 rounded-full text-sm bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-amber-100 hover:text-amber-700 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom description */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border-light)]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[var(--bg-primary)] px-2 text-[var(--text-tertiary)]">ou décrivez</span>
                </div>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Décrivez votre ${mealTypeLabels[mealType]} idéal...\nEx: Un plat léger avec du poulet et des légumes de saison`}
                className="w-full h-24 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              <Button
                variant="default"
                onClick={() => handleGenerate()}
                disabled={!description.trim()}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Générer ma recette
              </Button>
            </div>

            {/* Info about calories */}
            {maxCalories && (
              <p className="text-xs text-[var(--text-tertiary)] text-center">
                La recette sera adaptée pour ne pas dépasser {maxCalories} kcal
              </p>
            )}
          </motion.div>
        )}

        {/* Generating state */}
        {state === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <motion.div
              className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              <ChefHat className="w-10 h-10 text-white" />
            </motion.div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
              <span className="font-semibold text-[var(--text-primary)]">Création en cours...</span>
            </div>
            <p className="text-sm text-[var(--text-tertiary)] max-w-xs mx-auto">
              L'IA prépare une recette personnalisée pour votre {mealTypeLabels[mealType]}
            </p>
          </motion.div>
        )}

        {/* Result state */}
        {state === 'result' && recipe && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Recipe header */}
            <Card padding="default" className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <ChefHat className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--text-primary)] text-lg">{recipe.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{recipe.description}</p>

                  <div className="flex items-center gap-4 mt-3 text-sm text-[var(--text-tertiary)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {recipe.prepTime} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {recipe.servings} pers.
                    </span>
                    <span className="flex items-center gap-1 text-[var(--calories)]">
                      <Flame className="w-4 h-4" />
                      {recipe.nutrition.calories} kcal
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Nutrition */}
            <Card padding="default" className="bg-[var(--bg-secondary)]">
              <p className="text-xs text-[var(--text-tertiary)] text-center mb-2">
                Valeurs nutritionnelles par portion
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-[var(--calories)]">{formatNumber(recipe.nutrition.calories)}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">kcal</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--proteins)]">{recipe.nutrition.proteins}g</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Prot.</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--carbs)]">{recipe.nutrition.carbs}g</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Gluc.</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--fats)]">{recipe.nutrition.fats}g</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Lip.</p>
                </div>
              </div>
            </Card>

            {/* Ingredients */}
            <Card padding="default">
              <h4 className="font-semibold text-[var(--text-primary)] mb-3">Ingrédients</h4>
              <ul className="space-y-2">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-primary)]">{ing.name}</span>
                    <span className="text-[var(--text-tertiary)]">{ing.amount}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Instructions */}
            <Card padding="default">
              <h4 className="font-semibold text-[var(--text-primary)] mb-3">Préparation</h4>
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-medium text-xs">
                      {i + 1}
                    </span>
                    <span className="text-[var(--text-secondary)]">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Autre recette
              </Button>
              <Button
                variant="default"
                onClick={confirmRecipe}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500"
              >
                <Check className="h-4 w-4 mr-2" />
                Ajouter au repas
              </Button>
            </div>
          </motion.div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-[var(--error)]/10 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-[var(--error)]" />
            </div>
            <p className="text-[var(--error)] font-medium mb-2">Erreur</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
