'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Star, Plus, Minus, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatNumber } from '@/lib/utils'
import type { FoodItem, MealItem } from '@/types'

interface FoodCardProps {
  food: FoodItem
  quantity?: number
  onAdd?: () => void
  onRemove?: () => void
  onQuantityChange?: (quantity: number) => void
  onFavorite?: () => void
  onInfo?: () => void
  isFavorite?: boolean
  showQuantityControls?: boolean
  compact?: boolean
  className?: string
}

export function FoodCard({
  food,
  quantity = 1,
  onAdd,
  onRemove,
  onQuantityChange,
  onFavorite,
  onInfo,
  isFavorite = false,
  showQuantityControls = false,
  compact = false,
  className,
}: FoodCardProps) {
  const calories = Math.round(food.nutrition.calories * quantity)
  const proteins = Math.round(food.nutrition.proteins * quantity)
  const carbs = Math.round(food.nutrition.carbs * quantity)
  const fats = Math.round(food.nutrition.fats * quantity)

  if (compact) {
    return (
      <Card padding="sm" className={cn('flex items-center gap-3', className)}>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--text-primary)] truncate text-sm">
            {food.name}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {formatNumber(calories)} kcal
          </p>
        </div>

        {showQuantityControls ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQuantityChange?.(Math.max(0, quantity - 1))}
              className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => onQuantityChange?.(quantity + 1)}
              className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={onAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </Card>
    )
  }

  return (
    <Card padding="default" className={cn('relative', className)}>
      <div className="flex items-start gap-3">
        {/* Food image placeholder */}
        {food.imageUrl && (
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
            <img
              src={food.imageUrl}
              alt={food.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[var(--text-primary)] truncate">
                  {food.name}
                </h3>
                {food.brand && (
                  <Badge variant="secondary" size="sm">
                    {food.brand}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                {food.serving}{food.servingUnit}
                {quantity > 1 && ` × ${quantity}`}
              </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {onFavorite && (
                <button
                  onClick={onFavorite}
                  className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <Star
                    className={cn(
                      'h-5 w-5',
                      isFavorite
                        ? 'fill-[var(--warning)] text-[var(--warning)]'
                        : 'text-[var(--text-tertiary)]'
                    )}
                  />
                </button>
              )}
              {onInfo && (
                <button
                  onClick={onInfo}
                  className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <Info className="h-5 w-5 text-[var(--text-tertiary)]" />
                </button>
              )}
            </div>
          </div>

          {/* Nutrition */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-[var(--calories)] tabular-nums">
                {formatNumber(calories)}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">kcal</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="text-[var(--proteins)]">P {proteins}g</span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span className="text-[var(--carbs)]">G {carbs}g</span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span className="text-[var(--fats)]">L {fats}g</span>
            </div>
          </div>

          {/* Actions */}
          {(showQuantityControls || onAdd) && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-light)]">
              {showQuantityControls ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onQuantityChange?.(Math.max(0, quantity - 1))}
                      className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      onClick={() => onQuantityChange?.(quantity + 1)}
                      className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {onRemove && (
                    <Button variant="ghost" size="sm" onClick={onRemove} className="text-[var(--error)]">
                      Retirer
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={onAdd} className="ml-auto">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Source badge */}
      <div className="absolute top-2 right-2">
        <Badge
          variant="secondary"
          size="sm"
          className="text-[10px] opacity-60"
        >
          {food.source === 'openfoodfacts' ? 'OFF' : food.source === 'ciqual' ? 'CIQUAL' : food.source.toUpperCase()}
        </Badge>
      </div>
    </Card>
  )
}

// List variant for meal items in cart
interface MealItemCardProps {
  item: MealItem
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
  className?: string
}

export function MealItemCard({
  item,
  onQuantityChange,
  onRemove,
  className,
}: MealItemCardProps) {
  return (
    <FoodCard
      food={item.food}
      quantity={item.quantity}
      onQuantityChange={onQuantityChange}
      onRemove={onRemove}
      showQuantityControls
      className={className}
    />
  )
}
