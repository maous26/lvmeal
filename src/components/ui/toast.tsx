'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])

    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-0 right-0 z-[100] p-4 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

const toastConfig: Record<ToastType, { icon: typeof CheckCircle; bgColor: string; iconColor: string }> = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-[var(--bg-elevated)] border-l-4 border-l-[var(--success)]',
    iconColor: 'text-[var(--success)]',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-[var(--bg-elevated)] border-l-4 border-l-[var(--error)]',
    iconColor: 'text-[var(--error)]',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-[var(--bg-elevated)] border-l-4 border-l-[var(--warning)]',
    iconColor: 'text-[var(--warning)]',
  },
  info: {
    icon: Info,
    bgColor: 'bg-[var(--bg-elevated)] border-l-4 border-l-[var(--info)]',
    iconColor: 'text-[var(--info)]',
  },
}

interface ToastItemProps {
  toast: Toast
  onDismiss: () => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = toastConfig[toast.type]
  const Icon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'pointer-events-auto w-full rounded-xl p-4 shadow-[var(--shadow-md)]',
        'border border-[var(--border-light)]',
        config.bgColor
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

// Convenience functions
export function toast(props: Omit<Toast, 'id'>) {
  // This is a placeholder - in real usage, you'd use the context
  console.log('Toast:', props)
}

toast.success = (title: string, description?: string) => {
  toast({ type: 'success', title, description })
}

toast.error = (title: string, description?: string) => {
  toast({ type: 'error', title, description })
}

toast.warning = (title: string, description?: string) => {
  toast({ type: 'warning', title, description })
}

toast.info = (title: string, description?: string) => {
  toast({ type: 'info', title, description })
}
