'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { motion, HTMLMotionProps } from 'framer-motion'

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'elevated' | 'outline' | 'ghost' | 'gradient' | 'glow'
  interactive?: boolean
  padding?: 'none' | 'sm' | 'default' | 'lg'
  glowColor?: 'primary' | 'secondary' | 'success'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  default: 'p-6',
  lg: 'p-8',
}

const variantClasses = {
  default: 'bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-[var(--shadow-default)]',
  elevated: 'bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]',
  outline: 'bg-transparent border-2 border-[var(--border-default)]',
  ghost: 'bg-[var(--bg-secondary)]',
  gradient: 'bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-secondary)] border border-[var(--border-light)] shadow-[var(--shadow-md)]',
  glow: 'bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]',
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', interactive = false, padding = 'default', glowColor = 'primary', children, ...props }, ref) => {
    const glowShadows = {
      primary: 'hover:shadow-[var(--glow-primary)]',
      secondary: 'hover:shadow-[var(--glow-secondary)]',
      success: 'hover:shadow-[var(--glow-success)]',
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-2xl relative overflow-hidden',
          variantClasses[variant],
          paddingClasses[padding],
          interactive && 'cursor-pointer transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 active:translate-y-0 active:shadow-[var(--shadow-md)]',
          variant === 'glow' && glowShadows[glowColor],
          className
        )}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        whileHover={interactive ? { scale: 1.02 } : undefined}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold text-[var(--text-primary)] tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-[var(--text-secondary)]', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-4', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
