'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, UtensilsCrossed, ChefHat, TrendingUp, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    href: '/',
    icon: Home,
    label: 'Accueil',
  },
  {
    href: '/meals',
    icon: UtensilsCrossed,
    label: 'Repas',
  },
  {
    href: '/recipes',
    icon: ChefHat,
    label: 'Recettes',
  },
  {
    href: '/progress',
    icon: TrendingUp,
    label: 'Progrès',
  },
  {
    href: '/profile',
    icon: User,
    label: 'Profil',
  },
]

export function BottomNav() {
  const pathname = usePathname()

  // Don't show on onboarding or auth pages
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/auth')) {
    return null
  }

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-[var(--bg-elevated)]/95 backdrop-blur-lg',
        'border-t border-[var(--border-light)]',
        'safe-bottom'
      )}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname?.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center',
                'w-16 h-full',
                'transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 rounded-lg'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[var(--accent-primary)] rounded-b-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon
                className={cn(
                  'h-5 w-5 mb-1 transition-colors duration-200',
                  isActive
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-tertiary)]'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium transition-colors duration-200',
                  isActive
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-tertiary)]'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
