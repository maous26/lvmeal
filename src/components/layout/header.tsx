'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, Bell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage, getInitials } from '@/components/ui/avatar'

interface HeaderProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  backHref?: string
  onBack?: () => void
  showNotifications?: boolean
  showSettings?: boolean
  showProfile?: boolean
  user?: {
    name?: string
    image?: string
  }
  rightContent?: React.ReactNode
  transparent?: boolean
  className?: string
}

export function Header({
  title,
  subtitle,
  showBack,
  backHref,
  onBack,
  showNotifications,
  showSettings,
  showProfile,
  user,
  rightContent,
  transparent = false,
  className,
}: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Don't show on onboarding pages (they have their own headers)
  if (pathname?.startsWith('/onboarding')) {
    return null
  }

  // Default back handler - go to previous page or home
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  const BackButton = showBack ? (
    backHref ? (
      <Link
        href={backHref}
        className={cn(
          'p-2 -ml-2 rounded-full',
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          'hover:bg-[var(--bg-secondary)]',
          'transition-colors duration-150'
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
    ) : (
      <button
        onClick={handleBack}
        className={cn(
          'p-2 -ml-2 rounded-full',
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          'hover:bg-[var(--bg-secondary)]',
          'transition-colors duration-150'
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
    )
  ) : null

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'sticky top-0 z-40',
        'safe-top',
        !transparent && 'bg-[var(--bg-primary)]/95 backdrop-blur-lg border-b border-[var(--border-light)]',
        className
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 max-w-lg mx-auto">
        {/* Left section */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {BackButton}

          {showProfile && user && (
            <Link href="/profile" className="flex items-center gap-3 min-w-0">
              <Avatar size="sm">
                {user.image && <AvatarImage src={user.image} alt={user.name || ''} />}
                <AvatarFallback>{getInitials(user.name || 'U')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {subtitle && (
                  <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>
                )}
                {title && (
                  <h1 className="text-base font-semibold text-[var(--text-primary)] truncate">
                    {title}
                  </h1>
                )}
              </div>
            </Link>
          )}

          {!showProfile && title && (
            <div className="min-w-0">
              {subtitle && (
                <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>
              )}
              <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">
                {title}
              </h1>
            </div>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1">
          {rightContent}

          {showNotifications && (
            <Link
              href="/notifications"
              className={cn(
                'relative p-2 rounded-full',
                'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                'hover:bg-[var(--bg-secondary)]',
                'transition-colors duration-150'
              )}
            >
              <Bell className="h-5 w-5" />
              {/* Notification dot */}
              {/* <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-[var(--error)] rounded-full" /> */}
            </Link>
          )}

          {showSettings && (
            <Link
              href="/settings"
              className={cn(
                'p-2 rounded-full',
                'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                'hover:bg-[var(--bg-secondary)]',
                'transition-colors duration-150'
              )}
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </motion.header>
  )
}
