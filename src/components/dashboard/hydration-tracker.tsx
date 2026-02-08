'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Droplets, Plus, Minus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface HydrationTrackerProps {
  current: number // in ml
  target: number // in ml
  onAdd?: (amount: number) => void
  onRemove?: (amount: number) => void
  className?: string
}

// Wave SVG animation component
function WaveAnimation({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl">
      {/* Background wave (slower) */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: `${Math.min(100, percentage + 5)}%` }}
        initial={{ height: 0 }}
        animate={{ height: `${Math.min(100, percentage + 5)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <svg
          className="absolute bottom-0 w-[200%] h-full"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          style={{ opacity: 0.3 }}
        >
          <motion.path
            fill={color}
            d="M0,160L48,176C96,192,192,224,288,229.3C384,235,480,213,576,186.7C672,160,768,128,864,138.7C960,149,1056,203,1152,208C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            animate={{
              d: [
                "M0,160L48,176C96,192,192,224,288,229.3C384,235,480,213,576,186.7C672,160,768,128,864,138.7C960,149,1056,203,1152,208C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                "M0,192L48,181.3C96,171,192,149,288,160C384,171,480,213,576,218.7C672,224,768,192,864,181.3C960,171,1056,181,1152,186.7C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                "M0,160L48,176C96,192,192,224,288,229.3C384,235,480,213,576,186.7C672,160,768,128,864,138.7C960,149,1056,203,1152,208C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
              ],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </svg>
      </motion.div>

      {/* Foreground wave (faster) */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: `${percentage}%` }}
        initial={{ height: 0 }}
        animate={{ height: `${percentage}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <svg
          className="absolute bottom-0 w-[200%] h-full"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          style={{ opacity: 0.6 }}
        >
          <motion.path
            fill={color}
            d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,213.3C960,203,1056,181,1152,176C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            animate={{
              d: [
                "M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,213.3C960,203,1056,181,1152,176C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                "M0,192L48,197.3C96,203,192,213,288,202.7C384,192,480,160,576,165.3C672,171,768,213,864,218.7C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                "M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,213.3C960,203,1056,181,1152,176C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
              ],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </svg>
      </motion.div>
    </div>
  )
}

// Bubble animation
function Bubbles({ isActive }: { isActive: boolean }) {
  const bubbles = React.useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: Math.random() * 6 + 4,
      left: Math.random() * 80 + 10,
      delay: Math.random() * 2,
      duration: Math.random() * 2 + 3,
    })),
    []
  )

  if (!isActive) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full bg-white/30"
          style={{
            width: bubble.size,
            height: bubble.size,
            left: `${bubble.left}%`,
            bottom: 0,
          }}
          animate={{
            y: [0, -150],
            opacity: [0, 0.6, 0],
            scale: [1, 1.2, 0.8],
          }}
          transition={{
            duration: bubble.duration,
            repeat: Infinity,
            delay: bubble.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}

export function HydrationTracker({
  current,
  target,
  onAdd,
  onRemove,
  className,
}: HydrationTrackerProps) {
  const [showAddAnimation, setShowAddAnimation] = React.useState(false)
  const [selectedAmount, setSelectedAmount] = React.useState<number | null>(null)
  const percentage = Math.min(100, (current / target) * 100)
  const glasses = Math.floor(current / 250)
  const remainingMl = Math.max(0, target - current)
  const remainingGlasses = Math.ceil(remainingMl / 250)
  const isComplete = current >= target

  const quickAddOptions = [
    { amount: 150, label: 'Tasse', icon: '☕' },
    { amount: 250, label: 'Verre', icon: '🥛' },
    { amount: 500, label: 'Bouteille', icon: '🍶' },
  ]

  const handleAdd = (amount: number) => {
    setSelectedAmount(amount)
    setShowAddAnimation(true)
    onAdd?.(amount)
    setTimeout(() => {
      setShowAddAnimation(false)
      setSelectedAmount(null)
    }, 1000)
  }

  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      <div className="relative">
        {/* Water container with waves */}
        <div className="relative h-44 bg-gradient-to-b from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900 overflow-hidden">
          <WaveAnimation percentage={percentage} color="rgb(56, 189, 248)" />
          <Bubbles isActive={showAddAnimation || percentage > 0} />

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            {/* Add animation */}
            <AnimatePresence>
              {showAddAnimation && selectedAmount && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.8 }}
                  className="absolute top-4 bg-white/90 dark:bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg"
                >
                  <span className="text-lg font-bold text-sky-500">
                    +{selectedAmount}ml
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main stats */}
            <motion.div
              className="text-center"
              initial={{ scale: 1 }}
              animate={{ scale: showAddAnimation ? 1.05 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Droplets className={cn(
                  "h-6 w-6 transition-colors",
                  isComplete ? "text-emerald-500" : "text-sky-500"
                )} />
                {isComplete && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-emerald-500"
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                )}
              </div>
              <div className="flex items-baseline justify-center gap-1">
                <motion.span
                  key={current}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "text-4xl font-bold tabular-nums",
                    isComplete ? "text-emerald-600" : "text-sky-600"
                  )}
                >
                  {(current / 1000).toFixed(1)}
                </motion.span>
                <span className="text-lg text-[var(--text-tertiary)]">
                  / {(target / 1000).toFixed(1)} L
                </span>
              </div>
              <p className={cn(
                "text-sm mt-1 font-medium",
                isComplete ? "text-emerald-600" : "text-sky-600/80"
              )}>
                {isComplete
                  ? 'Objectif atteint !'
                  : `Encore ${remainingGlasses} verre${remainingGlasses > 1 ? 's' : ''} à boire`
                }
              </p>
            </motion.div>

            {/* Glasses indicator */}
            <div className="flex gap-1 mt-3">
              {Array.from({ length: Math.min(8, Math.ceil(target / 250)) }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-colors duration-300",
                    i < glasses
                      ? isComplete ? "bg-emerald-400" : "bg-sky-400"
                      : "bg-white/40"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick add buttons */}
        <div className="p-4 bg-[var(--bg-primary)]">
          <div className="flex gap-2">
            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Retirer 250ml d'eau"
              onClick={() => onRemove?.(250)}
              disabled={current <= 0}
              className="text-[var(--text-tertiary)] shrink-0"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </Button>

            {/* Quick add options */}
            <div className="flex-1 grid grid-cols-3 gap-2">
              {quickAddOptions.map((option) => (
                <motion.button
                  key={option.amount}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAdd(option.amount)}
                  aria-label={`Ajouter ${option.amount}ml (${option.label})`}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl",
                    "bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:hover:bg-sky-900/50",
                    "transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  )}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
                    {option.amount}ml
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Custom add button */}
            <Button
              variant="default"
              size="icon"
              aria-label="Ajouter 250ml d'eau"
              onClick={() => handleAdd(250)}
              className="bg-sky-500 hover:bg-sky-600 text-white shrink-0"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

// Compact inline version - redesigned
export function HydrationTrackerCompact({
  current,
  target,
  onAdd,
  className,
}: Omit<HydrationTrackerProps, 'onRemove'>) {
  const [isPressed, setIsPressed] = React.useState(false)
  const percentage = Math.min(100, (current / target) * 100)
  const isComplete = current >= target

  return (
    <motion.button
      onClick={() => onAdd?.(250)}
      onTapStart={() => setIsPressed(true)}
      onTap={() => setIsPressed(false)}
      onTapCancel={() => setIsPressed(false)}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-xl overflow-hidden h-14',
        'bg-gradient-to-r from-sky-100 to-cyan-100',
        'dark:from-sky-900/40 dark:to-cyan-900/40',
        'hover:from-sky-200 hover:to-cyan-200',
        'dark:hover:from-sky-900/60 dark:hover:to-cyan-900/60',
        'transition-all duration-200',
        className
      )}
    >
      {/* Animated water level background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-sky-300/50 to-cyan-300/50 dark:from-sky-600/30 dark:to-cyan-600/30"
        initial={{ x: '-100%' }}
        animate={{ x: `${percentage - 100}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Content */}
      <div className="relative flex items-center gap-3 w-full">
        <motion.div
          animate={{
            rotate: isPressed ? [0, -10, 10, -10, 0] : 0,
            scale: isPressed ? 1.1 : 1
          }}
          transition={{ duration: 0.3 }}
        >
          <Droplets className={cn(
            "h-5 w-5",
            isComplete ? "text-emerald-500" : "text-sky-500"
          )} />
        </motion.div>

        {/* Mini wave indicator */}
        <div className="flex-1 h-2 bg-white/40 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              isComplete
                ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                : "bg-gradient-to-r from-sky-400 to-cyan-400"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="flex items-center gap-1">
          <motion.span
            key={current}
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={cn(
              "text-sm font-bold tabular-nums",
              isComplete ? "text-emerald-600" : "text-sky-600"
            )}
          >
            {(current / 1000).toFixed(1)}L
          </motion.span>
        </div>

        <Plus className="h-4 w-4 text-sky-500" />
      </div>
    </motion.button>
  )
}
