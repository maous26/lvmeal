/**
 * Authentication Middleware
 * Simple username/password auth for admin console
 */

import { Request, Response, NextFunction } from 'express'

declare module 'express-session' {
  interface SessionData {
    isAuthenticated: boolean
    username: string
  }
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!ADMIN_PASSWORD) {
  console.warn('[Auth] WARNING: ADMIN_PASSWORD not set in environment!')
}

/**
 * Check if request is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.isAuthenticated) {
    return next()
  }

  // Check if it's an API request
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Redirect to login page
  return res.redirect('/login')
}

/**
 * Login handler
 */
export function handleLogin(req: Request, res: Response) {
  const { username, password } = req.body

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true
    req.session.username = username
    return res.json({ success: true })
  }

  return res.status(401).json({ error: 'Invalid credentials' })
}

/**
 * Logout handler
 */
export function handleLogout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err)
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ success: true })
  })
}

/**
 * Check auth status
 */
export function checkAuth(req: Request, res: Response) {
  res.json({
    isAuthenticated: !!req.session?.isAuthenticated,
    username: req.session?.username || null,
  })
}
