/**
 * LYM Admin Console
 * Web interface for managing subscriptions and users
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import path from 'path'
import apiRoutes from './routes/api'
import { requireAuth } from './middleware/auth'

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

// Trust proxy for Railway/Heroku (HTTPS termination via reverse proxy)
app.set('trust proxy', 1)

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers (relaxed for admin console)
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for simplicity
}))

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true,
}))

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // Allow cookie on redirects
  },
}))

// ============================================================================
// ROUTES
// ============================================================================

// API routes
app.use('/api', apiRoutes)

// Static files
app.use(express.static(path.join(__dirname, '../public')))

// Login page (public)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'))
})

// Dashboard (protected)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// Catch-all for SPA routes
app.get('*', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    LYM Admin Console                         ║
║                                                              ║
║  Server running on http://localhost:${PORT}                    ║
║                                                              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
╚══════════════════════════════════════════════════════════════╝
  `)
})
