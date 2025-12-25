'use client'

import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { WeeklyPlanGenerator } from '@/components/features/plan/WeeklyPlanGenerator'

export default function PlanPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-[var(--border-light)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Plan Repas</h1>
            <p className="text-xs text-[var(--text-secondary)]">Génération IA personnalisée</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <WeeklyPlanGenerator
          onPlanGenerated={(plan) => {
            console.log('Plan generated:', plan)
          }}
        />
      </main>
    </div>
  )
}
