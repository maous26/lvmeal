import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PresignRequestSchema, validateRequest } from '@/lib/schemas'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limiter'

// R2 Configuration (from environment - server-side only)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'lym-photos'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

// Validate configuration
function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)
}

// Create S3 client for R2
function getR2Client(): S3Client | null {
  if (!isR2Configured()) {
    console.error('[R2] Missing configuration')
    return null
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
}

/**
 * POST /api/storage/presign
 * Generate a presigned URL for uploading or downloading files
 */
export async function POST(request: NextRequest) {
  // Rate limiting (storage endpoint)
  const clientId = getClientIdentifier(request)
  const rateLimit = checkRateLimit(`storage:${clientId}`, RATE_LIMITS.storage)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetTime),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    )
  }

  try {
    const body = await request.json()

    // Validate request body with Zod
    const validation = validateRequest(PresignRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid request: ${validation.error}` },
        { status: 400 }
      )
    }

    const { method, key, contentType } = validation.data

    const client = getR2Client()
    if (!client) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      )
    }

    // Create appropriate command
    const command = method === 'PUT'
      ? new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          ContentType: contentType || 'application/octet-stream',
        })
      : new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        })

    // Generate presigned URL (valid for 1 hour)
    const url = await getSignedUrl(client, command, { expiresIn: 3600 })

    // Generate public URL
    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : url.split('?')[0] // Fallback to base URL without query params

    return NextResponse.json({
      url,
      publicUrl,
      expiresIn: 3600,
    })
  } catch (error) {
    console.error('[R2] Presign error:', error)
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    )
  }
}
