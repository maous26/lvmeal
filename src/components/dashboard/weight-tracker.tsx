'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Scale, TrendingDown, TrendingUp, Minus, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkline } from './weekly-chart'

interface WeightTrackerProps {
  currentWeight: number
  targetWeight: number
  startWeight: number
  recentWeights: { date: string; weight: number }[]
  lastUpdated?: string
  onAddEntry?: () => void
  className?: string
}

export function WeightTracker({
  currentWeight,
  targetWeight,
  startWeight,
  recentWeights,
  lastUpdated,
  onAddEntry,
  className,
}: WeightTrackerProps) {
  const totalToLose = startWeight - targetWeight
  const lost = startWeight - currentWeight
  const remaining = currentWeight - targetWeight
  const progressPercent = totalToLose > 0 ? Math.min(100, (lost / totalToLose) * 100) : 0

  // Trend calculation
  const trend = recentWeights.length >= 2
    ? currentWeight - recentWeights[recentWeights.length - 2]?.weight
    : 0

  const isLosingWeight = trend < 0
  const isGainingWeight = trend > 0
  const isStable = trend === 0

  const sparklineData = recentWeights.map((w) => w.weight)

  return (
    <Card className={className} padding="default">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Suivi du poids
        </h3>
        <Link
          href="/weight"
          className="text-sm text-[var(--accent-primary)] font-medium flex items-center hover:underline"
        >
          Détails
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex items-start gap-4">
        {/* Current weight display */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">
              {currentWeight.toFixed(1)}
            </span>
            <span className="text-lg text-[var(--text-tertiary)]">kg</span>
          </div>

          {/* Trend badge */}
          <div className="flex items-center gap-2 mt-2">
            {isLosingWeight && (
              <span className="inline-flex items-center gap-1 text-sm text-[var(--success)]">
                <TrendingDown className="h-4 w-4" />
                {Math.abs(trend).toFixed(1)} kg
              </span>
            )}
            {isGainingWeight && (
              <span className="inline-flex items-center gap-1 text-sm text-[var(--warning)]">
                <TrendingUp className="h-4 w-4" />
                +{trend.toFixed(1)} kg
              </span>
            )}
            {isStable && (
              <span className="inline-flex items-center gap-1 text-sm text-[var(--text-tertiary)]">
                <Minus className="h-4 w-4" />
                Stable
              </span>
            )}
          </div>

          {lastUpdated && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Dernière mesure : {lastUpdated}
            </p>
          )}
        </div>

        {/* Sparkline chart */}
        {sparklineData.length >= 2 && (
          <div className="w-24 h-12">
            <Sparkline
              data={sparklineData}
              color={isLosingWeight ? 'var(--success)' : isGainingWeight ? 'var(--warning)' : 'var(--text-tertiary)'}
            />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--text-secondary)]">
            Objectif : {targetWeight} kg
          </span>
          <span className="font-medium text-[var(--text-primary)] tabular-nums">
            {remaining > 0 ? `-${remaining.toFixed(1)} kg restant` : 'Objectif atteint !'}
          </span>
        </div>
        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[var(--accent-primary)] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
          <span>{startWeight} kg</span>
          <span>{targetWeight} kg</span>
        </div>
      </div>

      {/* Add entry button */}
      {onAddEntry && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4"
          onClick={onAddEntry}
        >
          <Scale className="h-4 w-4 mr-2" />
          Ajouter une pesée
        </Button>
      )}
    </Card>
  )
}

// Compact version
export function WeightTrackerCompact({
  currentWeight,
  targetWeight,
  trend,
  onAddEntry,
  className,
}: {
  currentWeight: number
  targetWeight: number
  trend?: number
  onAddEntry?: () => void
  className?: string
}) {
  const remaining = currentWeight - targetWeight
  const isLosingWeight = trend && trend < 0
  const isGainingWeight = trend && trend > 0

  return (
    <button
      onClick={onAddEntry}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl w-full text-left',
        'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]',
        'transition-colors duration-150',
        className
      )}
    >
      <div className="p-2 rounded-lg bg-[var(--bg-elevated)]">
        <Scale className="h-5 w-5 text-[var(--text-secondary)]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">
            {currentWeight.toFixed(1)}
          </span>
          <span className="text-sm text-[var(--text-tertiary)]">kg</span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          Objectif : {targetWeight} kg
        </p>
      </div>

      {trend !== undefined && trend !== 0 && (
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            isLosingWeight ? 'text-[var(--success)]' : 'text-[var(--warning)]'
          )}
        >
          {trend > 0 ? '+' : ''}{trend.toFixed(1)}
        </span>
      )}

      <Plus className="h-5 w-5 text-[var(--text-tertiary)]" />
    </button>
  )
}
