'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Sparkles, TrendingDown, AlertTriangle, Calendar, Info, X, Check, PiggyBank, Gift, CalendarDays } from 'lucide-react'
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

  // Determine status
  const getStatus = () => {
    if (hasExceedingDays) {
      return { label: 'Dépassement', variant: 'error' as const, icon: AlertTriangle }
    }
    if (availableCredit >= maxCredit * 0.6) {
      return { label: 'Épargne élevée', variant: 'success' as const, icon: Sparkles }
    }
    if (availableCredit >= maxCredit * 0.3) {
      return { label: 'Bon crédit', variant: 'info' as const, icon: Wallet }
    }
    if (availableCredit > 0) {
      return { label: 'Crédit faible', variant: 'warning' as const, icon: TrendingDown }
    }
    if (availableCredit < 0) {
      return { label: 'En déficit', variant: 'error' as const, icon: AlertTriangle }
    }
    return { label: 'Pas de crédit', variant: 'default' as const, icon: AlertTriangle }
  }

  const status = getStatus()
  const StatusIcon = status.icon

  return (
    <>
    <Card className={className} padding="default" variant="gradient">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[var(--accent-primary)]" />
            Banque calorique
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
              <PiggyBank className="h-5 w-5 text-[var(--accent-primary)] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Cycle démarré aujourd'hui
                </p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  Cliquez sur <Info className="h-3 w-3 inline" /> pour comprendre le fonctionnement
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
              OK
            </Button>
          </div>
          {/* Discrete link to change start day */}
          {onResetDay && (
            <div className="mt-2 pt-2 border-t border-[var(--accent-primary)]/10">
              <button
                onClick={onResetDay}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors underline underline-offset-2"
              >
                Changer le jour de départ
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Alert for days exceeding 10% limit */}
      {hasExceedingDays && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/20"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-[var(--error)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--error)]">
                Dépassement de la limite de 10%
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {daysExceedingLimit.length} jour{daysExceedingLimit.length > 1 ? 's' : ''} avec un écart supérieur à {maxDailyVariance} kcal.
                Essayez de rester dans la limite de ±10% ({formatNumber(dailyTarget - maxDailyVariance)} - {formatNumber(dailyTarget + maxDailyVariance)} kcal).
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Credit display with glow effect */}
      <div className="relative text-center mb-6">
        <motion.div
          className="absolute inset-0 rounded-2xl blur-2xl opacity-20"
          style={{ backgroundColor: availableCredit >= 0 ? 'var(--accent-primary)' : 'var(--error)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative">
          <p className="text-sm text-[var(--text-tertiary)] mb-1">
            {availableCredit >= 0 ? 'Crédit disponible' : 'Déficit à combler'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <motion.span
              className={cn(
                "text-4xl font-bold tabular-nums",
                availableCredit >= 0 ? "text-[var(--accent-primary)]" : "text-[var(--error)]"
              )}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {availableCredit < 0 ? '-' : ''}{formatNumber(Math.abs(availableCredit))}
            </motion.span>
            <span className="text-lg text-[var(--text-secondary)]">kcal</span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            sur {formatNumber(maxCredit)} kcal max (±{Math.round(MAX_VARIANCE_PERCENT * 100)}% × 6 jours)
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
              background: availableCredit >= 0
                ? `linear-gradient(90deg, var(--accent-primary), var(--info))`
                : `linear-gradient(90deg, var(--error), var(--warning))`,
              boxShadow: availableCredit >= 0
                ? '0 0 15px rgba(0, 119, 182, 0.4)'
                : '0 0 15px rgba(239, 68, 68, 0.4)'
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
          Consommation par jour
          <span className="text-xs text-[var(--text-tertiary)] ml-2">
            (limite: ±{maxDailyVariance} kcal)
          </span>
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
            const exceeds10Percent = isPast && isExceedingLimit(consumed, target)

            // Calculate bar height based on consumption (target = 100%)
            const barHeight = Math.min((consumed / target) * 100, 120) // Allow overflow up to 120%

            return (
              <div key={`${dayInfo.day}-${dayInfo.date}`} className="flex-1 flex flex-col items-center">
                {/* Bar container with target line */}
                <div className="relative h-16 w-full flex items-end justify-center mb-2">
                  {/* Target line indicator */}
                  {isPast && (
                    <div className="absolute bottom-[100%] left-0 right-0 h-px bg-[var(--text-tertiary)]/30 z-10" style={{ bottom: '100%' }} />
                  )}

                  {/* 10% limit indicators */}
                  {isPast && (
                    <>
                      <div className="absolute left-0 right-0 h-px bg-[var(--warning)]/40 z-10" style={{ bottom: '90%' }} />
                      <div className="absolute left-0 right-0 h-px bg-[var(--warning)]/40 z-10" style={{ bottom: '110%' }} />
                    </>
                  )}

                  {isPast && (
                    <motion.div
                      className={cn(
                        'w-full rounded-t-lg',
                        exceeds10Percent
                          ? 'bg-gradient-to-t from-[var(--error)] to-[var(--warning)]'
                          : isUnderTarget
                            ? 'bg-gradient-to-t from-[var(--accent-primary)] to-[var(--info)]'
                            : 'bg-gradient-to-t from-[var(--warning)] to-[var(--accent-secondary)]'
                      )}
                      style={{
                        boxShadow: exceeds10Percent
                          ? '0 0 10px rgba(239, 68, 68, 0.4)'
                          : isUnderTarget
                            ? '0 0 10px rgba(0, 119, 182, 0.3)'
                            : '0 0 10px rgba(245, 158, 11, 0.3)'
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.min(barHeight, 100)}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    />
                  )}
                  {isCurrentDay && (
                    <motion.div
                      className="w-full h-full rounded-lg border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                  {isFuture && (
                    <div className="w-full h-full rounded-lg bg-[var(--bg-tertiary)] opacity-50" />
                  )}

                  {/* Exceeding limit indicator */}
                  {exceeds10Percent && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                      <AlertTriangle className="h-3 w-3 text-[var(--error)]" />
                    </div>
                  )}
                </div>

                {/* Day label with date */}
                <span className={cn(
                  'text-xs font-medium',
                  exceeds10Percent ? 'text-[var(--error)]' : isCurrentDay ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                )}>
                  {dayInfo.day}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {dayInfo.date}
                </span>

                {/* Consumed calories */}
                {isPast && (
                  <span className={cn(
                    'text-[10px] tabular-nums',
                    exceeds10Percent ? 'text-[var(--error)] font-semibold' : isUnderTarget ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                  )}>
                    {formatNumber(consumed)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Info box */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--accent-primary)]/5 to-[var(--accent-secondary)]/5 border border-[var(--accent-primary)]/10 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {availableCredit >= 0 ? 'Faites-vous plaisir le jour 7' : 'Réduisez votre consommation'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {availableCredit >= 0
                ? `Épargnez jusqu'à ${maxDailyVariance} kcal/jour (10%) pour obtenir un bonus de ${formatNumber(maxCredit)} kcal max.`
                : `Vous avez ${formatNumber(Math.abs(availableCredit))} kcal à rattraper. Restez sous votre objectif les prochains jours.`
              }
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Comment ça marche ?
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
                {/* What is caloric balance */}
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    <PiggyBank className="h-5 w-5 text-[var(--accent-primary)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Le solde calorique</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Votre <strong>solde calorique</strong> représente les calories que vous avez "épargnées"
                    en mangeant moins que votre objectif quotidien.
                  </p>
                  <div className="mt-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)]">
                      <strong>Exemple :</strong> Avec un objectif de {formatNumber(dailyTarget)} kcal, si vous consommez {formatNumber(dailyTarget - maxDailyVariance)} kcal,
                      vous épargnez <span className="text-[var(--success)] font-medium">+{maxDailyVariance} kcal</span> (10% max).
                    </p>
                  </div>
                </div>

                {/* The 10% rule */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--warning)]/10 to-[var(--accent-primary)]/10 border border-[var(--warning)]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">La règle des 10%</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Votre écart journalier est limité à <strong>±10%</strong> de votre objectif,
                    soit <strong>±{maxDailyVariance} kcal</strong> par jour.
                  </p>
                  <ul className="text-xs text-[var(--text-tertiary)] mt-2 space-y-1">
                    <li>• Restez entre <strong>{formatNumber(dailyTarget - maxDailyVariance)}</strong> et <strong>{formatNumber(dailyTarget + maxDailyVariance)}</strong> kcal</li>
                    <li>• Au-delà, vous serez alerté(e) pour ajuster</li>
                    <li>• Maximum cumulable : <strong>{formatNumber(maxCredit)} kcal</strong> (6 × 10%)</li>
                  </ul>
                </div>

                {/* How savings work */}
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-[var(--success)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Comment ça marche</h4>
                  </div>
                  <ul className="text-sm text-[var(--text-secondary)] space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-[var(--success)]">+</span>
                      <span>Jours 1-6 : épargnez jusqu'à <strong>{maxDailyVariance} kcal/jour</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[var(--accent-primary)]">★</span>
                      <span>Jour 7 : profitez de votre crédit accumulé !</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[var(--error)]">−</span>
                      <span>Surplus ? Il sera à rattraper les jours suivants</span>
                    </li>
                  </ul>
                </div>

                {/* Plaisir days */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--success)]/10 to-[var(--accent-primary)]/10 border border-[var(--success)]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="h-5 w-5 text-[var(--success)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Jour plaisir</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Le <strong>7ème jour</strong>, si vous avez un solde positif,
                    vous pouvez consommer jusqu'à <strong>{formatNumber(dailyTarget + maxCredit)} kcal</strong> !
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    C'est le moment de profiter de vos efforts sans culpabilité.
                  </p>
                </div>

                {/* Automatic cycle */}
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-5 w-5 text-[var(--info)]" />
                    <h4 className="font-semibold text-[var(--text-primary)]">Cycle de 7 jours</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Votre banque fonctionne sur un cycle de <strong>7 jours</strong>.
                    À la fin du cycle, elle se réinitialise automatiquement.
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    Vous êtes au <strong>Jour {currentDay + 1}/7</strong>. Nouveau cycle dans {daysUntilNewWeek} jour{daysUntilNewWeek > 1 ? 's' : ''}.
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
                J'ai compris !
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  )
}
