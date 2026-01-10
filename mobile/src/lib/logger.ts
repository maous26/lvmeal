/**
 * Logger utility that only outputs in development mode
 *
 * Usage:
 * import { logger } from '@/lib/logger'
 * logger.log('[Component] message')
 * logger.warn('[Component] warning')
 * logger.error('[Component] error')
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

class Logger {
  private isDev: boolean

  constructor() {
    this.isDev = __DEV__
  }

  private output(level: LogLevel, ...args: unknown[]): void {
    if (this.isDev) {
      console[level](...args)
    }
  }

  log(...args: unknown[]): void {
    this.output('log', ...args)
  }

  info(...args: unknown[]): void {
    this.output('info', ...args)
  }

  warn(...args: unknown[]): void {
    this.output('warn', ...args)
  }

  error(...args: unknown[]): void {
    // Errors are always logged (for crash reporting)
    console.error(...args)
  }

  debug(...args: unknown[]): void {
    this.output('debug', ...args)
  }
}

export const logger = new Logger()

export default logger
