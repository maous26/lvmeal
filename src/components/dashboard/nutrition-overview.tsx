'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Flame, Beef, Wheat, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ProgressRing, MultiProgressRing } from '@/components/ui/progress-ring'
import { formatNumber } from '@/lib/utils'

interface NutritionData {
  calories: { current: number; target: number }
  proteins: { current: number; target: number }
  carbs: { current: number; target: number }
  fats: { current: number; target: number }
}

interface NutritionOverviewProps {
  data: NutritionData
  className?: string
}

export function NutritionOverview({ data, className }: NutritionOverviewProps) {
  const macros = [
    {
      label: 'Protéines',
      value: data.proteins.current,
      max: data.proteins.target,
      color: 'var(--proteins)',
      bgColor: 'rgba(0, 119, 182, 0.1)',
      icon: Beef,
      unit: 'g',
    },
    {
      label: 'Glucides',
      value: data.carbs.current,
      max: data.carbs.target,
      color: 'var(--carbs)',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      icon: Wheat,
      unit: 'g',
    },
    {
      label: 'Lipides',
      value: data.fats.current,
      max: data.fats.target,
      color: 'var(--fats)',
      bgColor: 'rgba(168, 85, 247, 0.1)',
      icon: Droplets,
      unit: 'g',
    },
  ]

  const caloriePercentage = Math.min(100, (data.calories.current / data.calories.target) * 100)
  const remaining = Math.max(0, data.calories.target - data.calories.current)

  return (
    <Card
      variant="gradient"
      className={cn('overflow-hidden', className)}
      padding="lg"
    >
      {/* Decorative background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-light)] via-transparent to-[var(--accent-secondary-light)] opacity-50" />

      <div className="relative flex items-center gap-6">
        {/* Main calorie ring with glow effect */}
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-full blur-xl opacity-30"
            style={{ backgroundColor: 'var(--calories)' }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <ProgressRing
            value={data.calories.current}
            max={data.calories.target}
            size="xl"
            color="var(--calories)"
          >
            <div className="text-center">
              <motion.span
                className="text-3xl font-bold text-[var(--text-primary)] tabular-nums"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              >
                {formatNumber(data.calories.current)}
              </motion.span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                / {formatNumber(data.calories.target)} kcal
              </p>
            </div>
          </ProgressRing>
        </div>

        {/* Macros breakdown with enhanced styling */}
        <div className="flex-1 space-y-4">
          {macros.map((macro, index) => {
            const Icon = macro.icon
            const percentage = Math.min(100, (macro.value / macro.max) * 100)

            return (
              <motion.div
                key={macro.label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <div
                  className="p-2.5 rounded-xl shadow-sm"
                  style={{ backgroundColor: macro.bgColor }}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: macro.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      {macro.label}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                      {formatNumber(macro.value)}<span className="text-[var(--text-tertiary)] font-normal">/{formatNumber(macro.max)}{macro.unit}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden shadow-inner">
                    <motion.div
                      className="h-full rounded-full shadow-sm"
                      style={{
                        backgroundColor: macro.color,
                        boxShadow: `0 0 10px ${macro.color}40`
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.3 + index * 0.1 }}
                    />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Bottom status with enhanced styling */}
      <motion.div
        className="relative mt-6 pt-4 border-t border-[var(--border-light)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Flame className="h-5 w-5 text-[var(--calories)]" />
            </motion.div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {remaining > 0 ? 'Restant aujourd\'hui' : 'Objectif dépassé'}
            </span>
          </div>
          <span
            className={cn(
              'text-lg font-bold tabular-nums px-3 py-1 rounded-full',
              remaining > 0
                ? 'text-[var(--success)] bg-[var(--success)]/10'
                : 'text-[var(--error)] bg-[var(--error)]/10'
            )}
          >
            {remaining > 0 ? `${formatNumber(remaining)} kcal` : `+${formatNumber(Math.abs(remaining))} kcal`}
          </span>
        </div>
      </motion.div>
    </Card>
  )
}

// Compact version for smaller displays
export function NutritionOverviewCompact({ data, className }: NutritionOverviewProps) {
  const macros = [
    { value: data.proteins.current, max: data.proteins.target, color: 'var(--proteins)', label: 'P' },
    { value: data.carbs.current, max: data.carbs.target, color: 'var(--carbs)', label: 'G' },
    { value: data.fats.current, max: data.fats.target, color: 'var(--fats)', label: 'L' },
  ]

  return (
    <Card className={cn('', className)} padding="default">
      <div className="flex items-center justify-between">
        <MultiProgressRing
          rings={macros}
          size="md"
          centerContent={
            <div className="text-center">
              <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {formatNumber(data.calories.current)}
              </span>
              <p className="text-[10px] text-[var(--text-tertiary)]">kcal</p>
            </div>
          }
        />

        <div className="flex-1 ml-4 space-y-2">
          {macros.map((macro, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: macro.color }}
                />
                <span className="text-xs text-[var(--text-secondary)]">{macro.label}</span>
              </div>
              <span className="text-xs font-medium text-[var(--text-primary)] tabular-nums">
                {formatNumber(macro.value)}g
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
