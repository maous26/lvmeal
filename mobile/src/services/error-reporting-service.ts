/**
 * Error Reporting Service - Sentry Integration
 *
 * Centralized crash reporting and error tracking for LymIA app.
 * Captures errors, exceptions, and performance data.
 */

import * as Sentry from '@sentry/react-native'
import type { UserProfile } from '../types'

// ============= CONFIGURATION =============

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || ''

// ============= TYPES =============

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info'

export interface ErrorContext {
  feature?: string
  screen?: string
  action?: string
  userId?: string
  [key: string]: string | number | boolean | undefined
}

// ============= SERVICE CLASS =============

class ErrorReportingService {
  private initialized = false

  /**
   * Initialize Sentry SDK
   */
  initialize(): void {
    if (this.initialized) return

    if (!SENTRY_DSN) {
      console.warn('[ErrorReporting] No DSN configured, error reporting disabled')
      return
    }

    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        debug: __DEV__,
        environment: __DEV__ ? 'development' : 'production',
        enableAutoSessionTracking: true,
        sessionTrackingIntervalMillis: 30000,
        // Performance monitoring
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
        // Don't send events in development unless testing
        enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
        // Filter sensitive data
        beforeSend(event) {
          // Remove any PII from breadcrumbs
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
              if (breadcrumb.data) {
                // Remove sensitive fields
                const sensitiveFields = ['password', 'email', 'token', 'apiKey']
                sensitiveFields.forEach(field => {
                  if (breadcrumb.data?.[field]) {
                    breadcrumb.data[field] = '[REDACTED]'
                  }
                })
              }
              return breadcrumb
            })
          }
          return event
        },
      })

      this.initialized = true
      console.log('[ErrorReporting] Sentry initialized')
    } catch (error) {
      console.error('[ErrorReporting] Failed to initialize Sentry:', error)
    }
  }

  /**
   * Set user context for error reports
   */
  setUser(userId: string, profile?: Partial<UserProfile>): void {
    if (!this.initialized) return

    Sentry.setUser({
      id: userId,
      // Only include non-PII data
      ...(profile?.goal && { goal: profile.goal }),
      ...(profile?.activityLevel && { activityLevel: profile.activityLevel }),
    })

    console.log('[ErrorReporting] User context set:', userId)
  }

  /**
   * Clear user context (on logout)
   */
  clearUser(): void {
    if (!this.initialized) return

    Sentry.setUser(null)
    console.log('[ErrorReporting] User context cleared')
  }

  /**
   * Capture an exception
   */
  captureException(
    error: Error | unknown,
    context?: ErrorContext
  ): string | undefined {
    if (!this.initialized) {
      console.error('[ErrorReporting] Not initialized, logging locally:', error)
      return undefined
    }

    // Add context as extra data
    if (context) {
      Sentry.setContext('errorContext', context)
    }

    const eventId = Sentry.captureException(error)
    console.log('[ErrorReporting] Exception captured:', eventId)
    return eventId
  }

  /**
   * Capture a message (for non-exception errors)
   */
  captureMessage(
    message: string,
    severity: ErrorSeverity = 'error',
    context?: ErrorContext
  ): string | undefined {
    if (!this.initialized) {
      console.log('[ErrorReporting] Not initialized, logging locally:', message)
      return undefined
    }

    if (context) {
      Sentry.setContext('messageContext', context)
    }

    const level = this.mapSeverityToSentryLevel(severity)
    const eventId = Sentry.captureMessage(message, level)
    console.log('[ErrorReporting] Message captured:', eventId)
    return eventId
  }

  /**
   * Add breadcrumb for debugging trail
   */
  addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, string | number | boolean>
  ): void {
    if (!this.initialized) return

    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    })
  }

  /**
   * Set custom tag for filtering
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) return

    Sentry.setTag(key, value)
  }

  /**
   * Start a performance transaction
   */
  startTransaction(
    name: string,
    operation: string
  ): Sentry.Span | undefined {
    if (!this.initialized) return undefined

    return Sentry.startInactiveSpan({
      name,
      op: operation,
    })
  }

  /**
   * Wrap a function with error boundary
   */
  wrap<T extends (...args: unknown[]) => unknown>(
    fn: T,
    context?: ErrorContext
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args)
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.captureException(error, context)
            throw error
          })
        }
        return result
      } catch (error) {
        this.captureException(error, context)
        throw error
      }
    }) as T
  }

  /**
   * Capture error with feature context (convenience method)
   */
  captureFeatureError(
    feature: string,
    error: Error | unknown,
    additionalContext?: Record<string, string | number | boolean>
  ): void {
    this.captureException(error, {
      feature,
      ...additionalContext,
    })
  }

  // ============= HELPERS =============

  private mapSeverityToSentryLevel(severity: ErrorSeverity): Sentry.SeverityLevel {
    const map: Record<ErrorSeverity, Sentry.SeverityLevel> = {
      fatal: 'fatal',
      error: 'error',
      warning: 'warning',
      info: 'info',
    }
    return map[severity]
  }
}

// ============= SINGLETON EXPORT =============

export const errorReporting = new ErrorReportingService()

export default errorReporting
