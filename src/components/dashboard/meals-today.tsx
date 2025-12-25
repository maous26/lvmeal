'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sun, Coffee, Cookie, Moon, Plus, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'

interface MealData {
  type: MealType
  logged: boolean
  calories?: number
  items?: string[]
  time?: string
}

interface MealsTodayProps {
  meals: MealData[]
  className?: string
}

const mealConfig: Record<MealType, { label: string; icon: typeof Sun; time: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: Coffee, time: '07:00 - 10:00' },
  lunch: { label: 'Déjeuner', icon: Sun, time: '12:00 - 14:00' },
  snack: { label: 'Collation', icon: Cookie, time: '16:00 - 18:00' },
  dinner: { label: 'Dîner', icon: Moon, time: '19:00 - 21:00' },
}

export function MealsToday({ meals, className }: MealsTodayProps) {
  const loggedCount = meals.filter((m) => m.logged).length
  const totalCalories = meals.reduce((acc, m) => acc + (m.calories || 0), 0)

  return (
    <Card className={className} padding="none">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-[var(--border-light)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Repas du jour
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {loggedCount}/4 repas · {formatNumber(totalCalories)} kcal
            </p>
          </div>
          <Link
            href="/meals"
            className="text-sm text-[var(--accent-primary)] font-medium hover:underline"
          >
            Tout voir
          </Link>
        </div>
      </div>

      {/* Meals list */}
      <div className="divide-y divide-[var(--border-light)]">
        {meals.map((meal, index) => {
          const config = mealConfig[meal.type]
          const Icon = config.icon

          return (
            <motion.div
              key={meal.type}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={meal.logged ? `/meals?view=${meal.type}` : `/meals/add?type=${meal.type}`}
                className={cn(
                  'flex items-center gap-4 p-4',
                  'hover:bg-[var(--bg-secondary)] transition-colors duration-150'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl',
                    meal.logged
                      ? 'bg-[var(--accent-light)]'
                      : 'bg-[var(--bg-secondary)]'
                  )}
                >
                  {meal.logged ? (
                    <Check className="h-5 w-5 text-[var(--accent-primary)]" />
                  ) : (
                    <Icon className="h-5 w-5 text-[var(--text-tertiary)]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'font-medium',
                        meal.logged
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                      )}
                    >
                      {config.label}
                    </span>
                    {meal.logged && meal.calories && (
                      <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
                        {formatNumber(meal.calories)} kcal
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)] mt-0.5 truncate">
                    {meal.logged && meal.items?.length
                      ? meal.items.slice(0, 2).join(', ') + (meal.items.length > 2 ? '...' : '')
                      : config.time}
                  </p>
                </div>

                {/* Action */}
                {meal.logged ? (
                  <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" />
                ) : (
                  <div className="p-2 rounded-full bg-[var(--accent-light)]">
                    <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
                  </div>
                )}
              </Link>
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}

// Quick add floating button variant
export function QuickAddMealButton({ className }: { className?: string }) {
  return (
    <Link
      href="/meals/add"
      className={cn(
        'fixed bottom-20 right-4 z-40',
        'flex items-center justify-center',
        'w-14 h-14 rounded-full',
        'bg-[var(--accent-primary)] text-white',
        'shadow-lg hover:shadow-xl',
        'transition-all duration-200 hover:scale-105',
        className
      )}
    >
      <Plus className="h-6 w-6" />
    </Link>
  )
}
