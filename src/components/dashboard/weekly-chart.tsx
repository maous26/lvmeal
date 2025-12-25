'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'

interface DayData {
  day: string
  shortDay: string
  calories: number
  target: number
  isToday?: boolean
}

interface WeeklyChartProps {
  data: DayData[]
  className?: string
}

export function WeeklyChart({ data, className }: WeeklyChartProps) {
  const maxValue = Math.max(...data.map((d) => Math.max(d.calories, d.target)))
  const averageCalories = Math.round(
    data.reduce((acc, d) => acc + d.calories, 0) / data.length
  )
  const averageTarget = data[0]?.target || 2000

  return (
    <Card className={className} padding="default">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Cette semaine</CardTitle>
          <div className="text-right">
            <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">
              {formatNumber(averageCalories)}
            </span>
            <span className="text-sm text-[var(--text-tertiary)]"> kcal/jour</span>
          </div>
        </div>
      </CardHeader>

      {/* Chart */}
      <div className="flex items-end justify-between gap-2 h-32 px-1">
        {data.map((day, index) => {
          const heightPercentage = (day.calories / maxValue) * 100
          const targetHeightPercentage = (day.target / maxValue) * 100
          const isOverTarget = day.calories > day.target
          const isUnderTarget = day.calories < day.target * 0.8

          return (
            <div
              key={day.day}
              className="flex-1 flex flex-col items-center gap-2"
            >
              {/* Bar container */}
              <div className="relative w-full h-24 flex items-end justify-center">
                {/* Target line */}
                <div
                  className="absolute w-full border-t border-dashed border-[var(--border-default)]"
                  style={{ bottom: `${targetHeightPercentage}%` }}
                />

                {/* Bar */}
                <motion.div
                  className={cn(
                    'w-full max-w-[24px] rounded-t-md',
                    day.isToday
                      ? 'bg-[var(--accent-primary)]'
                      : isOverTarget
                        ? 'bg-[var(--warning)]'
                        : isUnderTarget
                          ? 'bg-[var(--border-default)]'
                          : 'bg-[var(--accent-muted)]'
                  )}
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPercentage}%` }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.05,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                />
              </div>

              {/* Day label */}
              <span
                className={cn(
                  'text-xs font-medium',
                  day.isToday
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-tertiary)]'
                )}
              >
                {day.shortDay}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
          <span className="text-xs text-[var(--text-tertiary)]">Aujourd&apos;hui</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-px w-4 border-t border-dashed border-[var(--border-default)]" />
          <span className="text-xs text-[var(--text-tertiary)]">Objectif</span>
        </div>
      </div>
    </Card>
  )
}

// Simple sparkline variant
interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  className?: string
}

export function Sparkline({ data, color = 'var(--accent-primary)', height = 32, className }: SparklineProps) {
  if (data.length < 2) return null

  const maxValue = Math.max(...data)
  const minValue = Math.min(...data)
  const range = maxValue - minValue || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((value - minValue) / range) * 100
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height }}
    >
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  )
}
