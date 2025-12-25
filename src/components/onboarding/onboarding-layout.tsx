'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface OnboardingLayoutProps {
  children: React.ReactNode
  step: number
  totalSteps: number
  title?: string
  subtitle?: string
  onBack?: () => void
  onNext?: () => void
  onSkip?: () => void
  nextLabel?: string
  skipLabel?: string
  nextDisabled?: boolean
  loading?: boolean
  showProgress?: boolean
  className?: string
}

export function OnboardingLayout({
  children,
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  onNext,
  onSkip,
  nextLabel = 'Continuer',
  skipLabel = 'Passer',
  nextDisabled = false,
  loading = false,
  showProgress = true,
  className,
}: OnboardingLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-[var(--bg-primary)] flex flex-col', className)}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-lg safe-top">
        <div className="flex items-center justify-between h-16 px-4 max-w-lg mx-auto">
          {/* Back button */}
          {onBack && step > 1 ? (
            <button
              onClick={onBack}
              className={cn(
                'p-2 -ml-2 rounded-full',
                'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                'hover:bg-[var(--bg-secondary)]',
                'transition-colors duration-150'
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-9" />
          )}

          {/* Progress indicator */}
          {showProgress && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i + 1 === step
                      ? 'w-6 bg-[var(--accent-primary)]'
                      : i + 1 < step
                        ? 'w-1.5 bg-[var(--accent-primary)]'
                        : 'w-1.5 bg-[var(--border-default)]'
                  )}
                  initial={i + 1 === step ? { width: 6 } : {}}
                  animate={i + 1 === step ? { width: 24 } : {}}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          )}

          {/* Skip button */}
          {onSkip ? (
            <button
              onClick={onSkip}
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {skipLabel}
            </button>
          ) : (
            <div className="w-12" />
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col px-6 pb-8 max-w-lg mx-auto w-full">
        {/* Title section */}
        {(title || subtitle) && (
          <div className="pt-4 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {subtitle && (
                  <p className="text-sm text-[var(--accent-primary)] font-medium mb-2">
                    {subtitle}
                  </p>
                )}
                {title && (
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] text-balance">
                    {title}
                  </h1>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with action */}
        {onNext && (
          <div className="pt-6 mt-auto">
            <Button
              onClick={onNext}
              disabled={nextDisabled}
              loading={loading}
              className="w-full"
              size="lg"
            >
              {nextLabel}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

// Step indicator component
interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  labels?: string[]
  className?: string
}

export function StepIndicator({ currentStep, totalSteps, labels, className }: StepIndicatorProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {Array.from({ length: totalSteps }).map((_, i) => {
        const stepNumber = i + 1
        const isActive = stepNumber === currentStep
        const isCompleted = stepNumber < currentStep

        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isCompleted
                    ? 'bg-[var(--accent-primary)] text-white'
                    : isActive
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                )}
              >
                {isCompleted ? '✓' : stepNumber}
              </div>
              {labels?.[i] && (
                <span
                  className={cn(
                    'text-xs',
                    isActive || isCompleted
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)]'
                  )}
                >
                  {labels[i]}
                </span>
              )}
            </div>
            {i < totalSteps - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  isCompleted ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-light)]'
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
