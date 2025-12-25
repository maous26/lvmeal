'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Star, Plus, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatNumber } from '@/lib/utils'
import type { FoodItem } from '@/types'

interface FoodSearchProps {
  onSelect: (food: FoodItem) => void
  onFavorite?: (food: FoodItem) => void
  favorites?: string[]
  recentFoods?: FoodItem[]
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

// Simulated API search - replace with actual API call
async function searchFoods(query: string): Promise<FoodItem[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Mock data
  const allFoods: FoodItem[] = [
    {
      id: 'ciqual-1',
      name: 'Poulet rôti',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 190, proteins: 28, carbs: 0, fats: 8 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-2',
      name: 'Saumon cuit au four',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 208, proteins: 20, carbs: 0, fats: 13 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-3',
      name: 'Riz blanc cuit',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 130, proteins: 2.7, carbs: 28, fats: 0.3 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-4',
      name: 'Pâtes cuites',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 131, proteins: 5, carbs: 25, fats: 1.1 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-5',
      name: 'Brocoli cuit',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 35, proteins: 3.7, carbs: 4, fats: 0.4 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-6',
      name: 'Avocat',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 160, proteins: 2, carbs: 8.5, fats: 14.7 },
      source: 'ciqual',
    },
    {
      id: 'off-1',
      name: 'Yaourt nature',
      brand: 'Danone',
      serving: 125,
      servingUnit: 'g',
      nutrition: { calories: 70, proteins: 4.5, carbs: 6, fats: 3.5 },
      source: 'openfoodfacts',
    },
    {
      id: 'off-2',
      name: 'Fromage blanc 0%',
      brand: 'Yoplait',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 46, proteins: 8, carbs: 4, fats: 0.1 },
      source: 'openfoodfacts',
    },
    {
      id: 'off-3',
      name: 'Lait demi-écrémé',
      brand: 'Lactel',
      serving: 250,
      servingUnit: 'ml',
      nutrition: { calories: 115, proteins: 8, carbs: 12, fats: 3.9 },
      source: 'openfoodfacts',
    },
    {
      id: 'off-4',
      name: 'Pain de mie complet',
      brand: 'Harry\'s',
      serving: 25,
      servingUnit: 'g',
      nutrition: { calories: 63, proteins: 2.5, carbs: 11, fats: 1 },
      source: 'openfoodfacts',
    },
    {
      id: 'ciqual-7',
      name: 'Œuf dur',
      serving: 50,
      servingUnit: 'g',
      nutrition: { calories: 78, proteins: 6.3, carbs: 0.6, fats: 5.3 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-8',
      name: 'Banane',
      serving: 120,
      servingUnit: 'g',
      nutrition: { calories: 105, proteins: 1.3, carbs: 27, fats: 0.4 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-9',
      name: 'Pomme',
      serving: 150,
      servingUnit: 'g',
      nutrition: { calories: 78, proteins: 0.4, carbs: 21, fats: 0.2 },
      source: 'ciqual',
    },
    {
      id: 'ciqual-10',
      name: 'Steak haché 5% MG',
      serving: 100,
      servingUnit: 'g',
      nutrition: { calories: 140, proteins: 26, carbs: 0, fats: 5 },
      source: 'ciqual',
    },
  ]

  const q = query.toLowerCase()
  return allFoods.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.brand?.toLowerCase().includes(q)
  )
}

export function FoodSearch({
  onSelect,
  onFavorite,
  favorites = [],
  recentFoods = [],
  placeholder = 'Rechercher un aliment...',
  autoFocus = false,
  className,
}: FoodSearchProps) {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<FoodItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showResults, setShowResults] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setIsLoading(true)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(async () => {
      const foods = await searchFoods(query)
      setResults(foods)
      setIsLoading(false)
      setShowResults(true)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  const isFavorite = (foodId: string) => favorites.includes(foodId)

  const displayResults = query.length >= 2 ? results : recentFoods

  return (
    <div className={cn('relative', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-tertiary)]" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          className="pl-10 pr-10"
          autoFocus={autoFocus}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--bg-secondary)]"
          >
            <X className="h-4 w-4 text-[var(--text-tertiary)]" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {showResults && (query.length >= 2 || recentFoods.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[60vh] overflow-y-auto rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-lg"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-primary)]" />
              </div>
            ) : displayResults.length > 0 ? (
              <div className="py-2">
                {query.length < 2 && recentFoods.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                      Récents
                    </p>
                  </div>
                )}
                {displayResults.map((food) => (
                  <motion.button
                    key={food.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors"
                    onClick={() => {
                      onSelect(food)
                      setQuery('')
                      setShowResults(false)
                    }}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {food.name}
                        </span>
                        {food.brand && (
                          <Badge variant="secondary" size="sm">
                            {food.brand}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-[var(--calories)]">
                          {formatNumber(food.nutrition.calories)} kcal
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          · {food.serving}{food.servingUnit}
                        </span>
                      </div>
                    </div>

                    {onFavorite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onFavorite(food)
                        }}
                        className="p-2 rounded-full hover:bg-[var(--bg-tertiary)]"
                      >
                        <Star
                          className={cn(
                            'h-4 w-4',
                            isFavorite(food.id)
                              ? 'fill-[var(--warning)] text-[var(--warning)]'
                              : 'text-[var(--text-tertiary)]'
                          )}
                        />
                      </button>
                    )}

                    <div className="p-2 rounded-full bg-[var(--accent-light)]">
                      <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="py-8 text-center">
                <p className="text-[var(--text-tertiary)]">Aucun résultat pour "{query}"</p>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close results */}
      {showResults && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowResults(false)}
        />
      )}
    </div>
  )
}
