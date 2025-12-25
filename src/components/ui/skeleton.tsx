'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'text' | 'card'
  width?: string | number
  height?: string | number
}

function Skeleton({
  className,
  variant = 'default',
  width,
  height,
  ...props
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-[var(--bg-tertiary)]'

  const variantClasses = {
    default: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4 w-full',
    card: 'rounded-2xl',
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      {...props}
    />
  )
}

// Pre-built skeleton components for common use cases
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-light)]', className)}>
      <Skeleton variant="text" className="w-1/3 mb-4" />
      <Skeleton variant="text" className="w-full mb-2" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
  )
}

function SkeletonMealCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-elevated)]', className)}>
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton variant="text" className="w-24 mb-2" />
        <Skeleton variant="text" className="w-16 h-3" />
      </div>
      <Skeleton variant="default" width={60} height={24} className="rounded-full" />
    </div>
  )
}

function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="text" />
      ))}
    </div>
  )
}

function SkeletonAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className={className}
    />
  )
}

function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between">
        <Skeleton variant="text" className="w-24" />
        <Skeleton variant="text" className="w-16" />
      </div>
      <div className="flex items-end gap-2 h-40">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="default"
            className="flex-1"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonMealCard,
  SkeletonList,
  SkeletonAvatar,
  SkeletonChart,
}
