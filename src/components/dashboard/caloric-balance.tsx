'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingUp, Calendar, Info, X, Check, Gift, CalendarDays, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'

interface DailyBalance {
  day: string // 'Lun', 'Mar', etc.
  date: string // '23/12'
  consumed: number
  target: number
  balance: number // target - consumed (positive = saved, negative = overspent)
}

interface CaloricBalanceProps {
  dailyBalances: DailyBalance[] // 7 days of data
  currentDay: number // 0-6 (which day we're on in the cycle)
  daysUntilNewWeek: number // Days until automatic reset
  weekStartDate?: string // YYYY-MM-DD format, the start date of the current cycle
  dailyTarget: number // User's daily calorie target (e.g., 2000 kcal)
  isFirstTimeSetup?: boolean // Show setup banner for first time users
  onConfirmStart?: () => void // Confirm start day (dismisses banner)
  onResetDay?: () => void // Reset cycle to start today (only available before confirmation)
  className?: string
}

// Maximum variance allowed per day (10% of daily target)
const MAX_VARIANCE_PERCENT = 0.10

// Check if a day exceeds the 10% variance limit
function isExceedingLimit(consumed: number, target: number): boolean {
  const variance = Math.abs(target - consumed)
  const maxVariance = target * MAX_VARIANCE_PERCENT
  return variance > maxVariance
}

// Clamp balance to ±10% of target
function clampBalance(balance: number, target: number): number {
  const maxVariance = target * MAX_VARIANCE_PERCENT
  return Math.max(-maxVariance, Math.min(maxVariance, balance))
}
const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// Generate the 7 days of the cycle based on start date
function getCycleDays(startDate?: string): { day: string; date: string }[] {
  const start = startDate ? new Date(startDate) : new Date()
  const days: { day: string; date: string }[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push({
      day: DAY_NAMES[d.getDay()],
      date: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
    })
  }

  return days
}

export function CaloricBalance({
  dailyBalances,
  currentDay,
  daysUntilNewWeek,
  weekStartDate,
  dailyTarget,
  isFirstTimeSetup = false,
  onConfirmStart,
  onResetDay,
  className,
}: CaloricBalanceProps) {
  // Generate dynamic days based on the cycle start date
  const cycleDays = getCycleDays(weekStartDate)
  const [showInfoModal, setShowInfoModal] = React.useState(false)

  // Calculate max credit based on 10% of daily target over 6 days
  // (Day 7 is when you use your credit)
  const maxDailyVariance = Math.round(dailyTarget * MAX_VARIANCE_PERCENT)
  const maxCredit = maxDailyVariance * 6

  // Calculate cumulative savings with 10% cap per day
  const cumulativeSavings = dailyBalances.slice(0, currentDay).reduce((acc, day) => {
    // Clamp each day's balance to ±10% of target
    const cappedBalance = clampBalance(day.balance, day.target || dailyTarget)
    return acc + cappedBalance
  }, 0)

  // Available credit (can be negative if overspent)
  const availableCredit = Math.round(cumulativeSavings)
  const creditPercentage = maxCredit > 0 ? Math.max(0, (availableCredit / maxCredit) * 100) : 0

  // Check for days exceeding the 10% limit
  const daysExceedingLimit = dailyBalances.slice(0, currentDay).filter(
    day => isExceedingLimit(day.consumed, day.target || dailyTarget)
  )
  const hasExceedingDays = daysExceedingLimit.length > 0

  // Determine status - always positive and encouraging
  const getStatus = () => {
    if (availableCredit >= maxCredit * 0.6) {
      return { label: 'Super !', variant: 'success' as const, icon: Sparkles }
    }
    if (availableCredit >= maxCredit * 0.3) {
      return { label: 'Bien parti', variant: 'info' as const, icon: TrendingUp }
    }
    if (availableCredit > 0) {
      return { label: 'En route', variant: 'info' as const, icon: Heart }
    }
    return { label: 'Nouveau cycle', variant: 'default' as const, icon: Calendar }
  }

  const status = getStatus()
  const StatusIcon = status.icon

  return (
    <>
    <Card className={className} padding="default" variant="gradient">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-5 w-5 text-[var(--accent-primary)]" />
            Solde Plaisir
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-1 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Info className="h-4 w-4 text-[var(--text-tertiary)]" />
            </button>
          </CardTitle>
          <Badge variant={status.variant}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      {/* First time setup banner */}
      {isFirstTimeSetup && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--info)]/10 border border-[var(--accent-primary)]/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Gift className="h-5 w-5 text-[var(--accent-primary)] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Votre cycle plaisir commence !
                </p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  Économisez un peu chaque jour pour vous faire plaisir le jour 7
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={onConfirmStart}
              className="flex-shrink-0"
            >
              <Check className="h-4 w-4 mr-1" />
              C'est parti !
            </Button>
          </div>
        </motion.div>
      )}

      {/* Credit display with glow effect */}
      <div className="relative text-center mb-6">
        <motion.div
          className="absolute inset-0 rounded-2xl blur-2xl opacity-20"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative">
          <p className="text-sm text-[var(--text-tertiary)] mb-1">
            Solde disponible
          </p>
          <div className="flex items-center justify-center gap-2">
            <motion.span
              className="text-4xl font-bold tabular-nums text-[var(--accent-primary)]"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {formatNumber(Math.max(0, availableCredit))}
            </motion.span>
            <span className="text-lg text-[var(--text-secondary)]">kcal</span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            sur {formatNumber(maxCredit)} kcal max possible
          </p>
        </div>
      </div>

      {/* Credit gauge */}
      <div className="relative mb-6">
        <div className="h-4 bg-[var(--bg-tertiary)] rounded-full overflow-hidden shadow-inner">
          {/* Credit fill */}
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, var(--accent-primary), var(--info))`,
              boxShadow: '0 0 15px rgba(0, 119, 182, 0.4)'
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(creditPercentage, 100)}%` }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>

        {/* Gauge labels */}
        <div className="flex justify-between mt-2">
          <span className="text-xs text-[var(--text-tertiary)]">0</span>
          <span className="text-xs text-[var(--text-tertiary)]">{formatNumber(Math.round(maxCredit / 2))}</span>
          <span className="text-xs text-[var(--text-tertiary)]">{formatNumber(maxCredit)}</span>
        </div>
      </div>

      {/* 7-day breakdown */}
      <div className="mb-6">
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Votre semaine
        </p>
        <div className="flex gap-1.5">
          {cycleDays.map((dayInfo, index) => {
            const dayData = dailyBalances[index]
            const isCurrentDay = index === currentDay
            const isPast = index < currentDay
            const isFuture = index > currentDay
            const consumed = dayData?.consumed ?? 0
            const target = dayData?.target ?? dailyTarget
            const isUnderTarget = consumed <= target

            // Calculate bar height based on consumption (target = 100%)
            const barHeight = Math.min((consumed / target) * 100, 100)

            return (
              <div key={`${dayInfo.day}-${dayInfo.date}`} className="flex-1 flex flex-col items-center">
                {/* Bar container */}
                <div className="relative h-16 w-full flex items-end justify-center mb-2">
                  {isPast && (
                    <motion.div
                      className={cn(
                        'w-full rounded-t-lg',
                        isUnderTarget
                          ? 'bg-gradient-to-t from-[var(--accent-primary)] to-[var(--info)]'
                          : 'bg-gradient-to-t from-[var(--accent-secondary)] to-[var(--accent-primary)]'
                      )}
                      style={{
                        boxShadow: '0 0 10px rgba(0, 119, 182, 0.3)'
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${barHeight}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    />
                  )}
                  {isCurrentDay && (
                    <motion.div
                      className="w-full rounded-lg border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      style={{ height: `${Math.max(barHeight, 20)}%` }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                  {isFuture && (
                    <div className="w-full h-full rounded-lg bg-[var(--bg-tertiary)] opacity-40" />
                  )}
                </div>

                {/* Day label with date */}
                <span className={cn(
                  'text-xs font-medium',
                  isCurrentDay ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                )}>
                  {dayInfo.day}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {dayInfo.date}
                </span>

                {/* Consumed calories */}
                {(isPast || isCurrentDay) && consumed > 0 && (
                  <span className={cn(
                    'text-[10px] tabular-nums',
                    isUnderTarget ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'
                  )}>
                    {formatNumber(consumed)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Info box - always encouraging */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--success)]/5 to-[var(--accent-primary)]/5 border border-[var(--success)]/10 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--success)] to-[var(--accent-primary)] shadow-sm">
            <Gift className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Jour plaisir le jour 7
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Chaque calorie économisée s'ajoute à votre solde pour un repas plaisir mérité !
            </p>
          </div>
        </div>
      </div>

      {/* Next cycle info */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
          <div>
            <span className="text-sm text-[var(--text-secondary)]">Nouveau cycle</span>
            <p className="text-xs text-[var(--text-tertiary)]">
              {daysUntilNewWeek > 0
                ? `Dans ${daysUntilNewWeek} jour${daysUntilNewWeek > 1 ? 's' : ''}`
                : 'Demain'
              }
            </p>
          </div>
        </div>
        <Badge variant="info" className="text-xs">
          Jour {currentDay + 1}/7
        </Badge>
      </div>
    </Card>

    {/* Info Modal */}
    <AnimatePresence>
      {showInfoModal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfoModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-primary)] rounded-t-2xl safe-area-inset max-h-[85vh] overflow-y-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[var(--border-default)]" />
            </div>

            <div className="px-5 pb-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--success)] to-[var(--accent-primary)] flex items-center justify-center">
                    <Gift className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Solde Plaisir
                  </h3>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="p-2 -mr-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                </button>
              </div>

              {/* Explanation sections */}
              <div className="space-y-4">
                {/* What is it */}
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-5 w-5 text-[var(--accent-primary)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Le principe</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Mangez un peu moins que votre objectif pendant 6 jours, et profitez d'un
                    <strong> repas plaisir</strong> le 7ème jour !
                  </p>
                  <div className="mt-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)]">
                      <strong>Exemple :</strong> Économisez {maxDailyVariance} kcal/jour pendant 6 jours =
                      <span className="text-[var(--success)] font-medium"> +{formatNumber(maxCredit)} kcal</span> pour vous faire plaisir !
                    </p>
                  </div>
                </div>

                {/* How it works */}
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-[var(--success)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Comment ça marche</h4>
                  </div>
                  <ul className="text-sm text-[var(--text-secondary)] space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-[var(--success)]">1.</span>
                      <span>Mangez légèrement sous votre objectif (jusqu'à {maxDailyVariance} kcal/jour)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[var(--success)]">2.</span>
                      <span>Votre solde s'accumule automatiquement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[var(--accent-primary)]">3.</span>
                      <span>Le jour 7 : utilisez votre solde pour un repas généreux !</span>
                    </li>
                  </ul>
                </div>

                {/* Plaisir day */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--success)]/10 to-[var(--accent-primary)]/10 border border-[var(--success)]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="h-5 w-5 text-[var(--success)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Votre jour plaisir</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Le <strong>7ème jour</strong>, profitez de votre solde accumulé.
                    Vous pourrez manger jusqu'à <strong>{formatNumber(dailyTarget + maxCredit)} kcal</strong> !
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    C'est votre récompense bien méritée.
                  </p>
                </div>

                {/* Cycle info */}
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-5 w-5 text-[var(--info)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Cycle de 7 jours</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Un nouveau cycle commence automatiquement chaque semaine.
                    Pas de pression, avancez à votre rythme !
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    Vous êtes au <strong>Jour {currentDay + 1}/7</strong>. Prochain cycle dans {daysUntilNewWeek} jour{daysUntilNewWeek > 1 ? 's' : ''}.
                  </p>
                </div>
              </div>

              {/* Close button */}
              <Button
                variant="default"
                size="lg"
                onClick={() => setShowInfoModal(false)}
                className="w-full mt-5"
              >
                Super, merci !
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  )
}
