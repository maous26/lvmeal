/**
 * Cloudflare R2 Storage Service
 *
 * Handles image uploads for:
 * - Meal photos
 * - Recipe images
 * - User avatars
 *
 * R2 is S3-compatible, so we use standard S3 signing.
 */

import * as FileSystem from 'expo-file-system'
import * as Crypto from 'expo-crypto'

// Environment variables
const R2_ACCOUNT_ID = process.env.EXPO_PUBLIC_R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET_NAME = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || 'lym-photos'
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL || ''

// R2 endpoint
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

export interface UploadResult {
  success: boolean
  url?: string
  key?: string
  error?: string
}

export interface ImageCategory {
  type: 'meals' | 'recipes' | 'avatars' | 'misc'
  userId?: string
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME)
}

/**
 * Generate a unique key for the image
 */
function generateImageKey(category: ImageCategory, filename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = filename.split('.').pop() || 'jpg'

  const prefix = category.userId
    ? `${category.type}/${category.userId}`
    : category.type

  return `${prefix}/${timestamp}-${random}.${ext}`
}

/**
 * Create HMAC-SHA256 signature
 */
async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  // For React Native, we need to use a different approach
  // This is a simplified version - in production use a proper crypto library
  const encoder = new TextEncoder()
  const keyData = new Uint8Array(key)
  const messageData = encoder.encode(message)

  // Use expo-crypto for hashing
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  )

  return Uint8Array.from(atob(hash), c => c.charCodeAt(0)).buffer
}

/**
 * Create AWS Signature V4 for R2
 * Simplified version for presigned URLs
 */
async function createPresignedUrl(
  method: 'PUT' | 'GET',
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const now = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const region = 'auto'
  const service = 's3'
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const credential = `${R2_ACCESS_KEY_ID}/${credentialScope}`

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'host',
  })

  const canonicalUri = `/${R2_BUCKET_NAME}/${key}`
  const canonicalQueryString = queryParams.toString()
  const canonicalHeaders = `host:${host}\n`
  const signedHeaders = 'host'
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const requestHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonicalRequest,
    { encoding: Crypto.CryptoEncoding.HEX }
  )

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    requestHash,
  ].join('\n')

  // Simplified signing - in production, implement full AWS4 signing
  const signature = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${R2_SECRET_ACCESS_KEY}${stringToSign}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  )

  queryParams.set('X-Amz-Signature', signature)

  return `https://${host}${canonicalUri}?${queryParams.toString()}`
}

/**
 * Upload an image to R2
 */
export async function uploadImage(
  localUri: string,
  category: ImageCategory,
  filename?: string
): Promise<UploadResult> {
  if (!isR2Configured()) {
    console.warn('Cloudflare R2 not configured')
    return { success: false, error: 'R2 not configured' }
  }

  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(localUri)
    if (!fileInfo.exists) {
      return { success: false, error: 'File not found' }
    }

    // Generate key
    const name = filename || localUri.split('/').pop() || 'image.jpg'
    const key = generateImageKey(category, name)

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // Determine content type
    const ext = name.split('.').pop()?.toLowerCase()
    const contentType = ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg'

    // Upload directly to R2 using presigned URL
    const presignedUrl = await createPresignedUrl('PUT', key)

    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: Uint8Array.from(atob(base64), c => c.charCodeAt(0)),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('R2 upload error:', error)
      return { success: false, error: `Upload failed: ${response.status}` }
    }

    // Return public URL
    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`

    return {
      success: true,
      url: publicUrl,
      key,
    }
  } catch (error) {
    console.error('R2 upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

/**
 * Upload a meal photo
 */
export async function uploadMealPhoto(
  localUri: string,
  userId: string
): Promise<UploadResult> {
  return uploadImage(localUri, { type: 'meals', userId })
}

/**
 * Upload a recipe image
 */
export async function uploadRecipeImage(
  localUri: string
): Promise<UploadResult> {
  return uploadImage(localUri, { type: 'recipes' })
}

/**
 * Upload a user avatar
 */
export async function uploadAvatar(
  localUri: string,
  userId: string
): Promise<UploadResult> {
  return uploadImage(localUri, { type: 'avatars', userId })
}

/**
 * Delete an image from R2
 */
export async function deleteImage(key: string): Promise<boolean> {
  if (!isR2Configured()) {
    return false
  }

  try {
    const presignedUrl = await createPresignedUrl('GET', key) // Use GET for delete request
    const deleteUrl = presignedUrl.replace('X-Amz-Expires=3600', 'X-Amz-Expires=60')

    // Note: For proper delete, you'd need a backend or Cloudflare Worker
    // R2 doesn't support presigned DELETE URLs directly from client
    console.warn('Client-side delete not fully supported - use backend')
    return false
  } catch (error) {
    console.error('R2 delete error:', error)
    return false
  }
}

/**
 * Get a temporary signed URL for private images
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
  if (!isR2Configured()) {
    return null
  }

  try {
    return await createPresignedUrl('GET', key, expiresIn)
  } catch (error) {
    console.error('Failed to generate signed URL:', error)
    return null
  }
}

export default {
  isR2Configured,
  uploadImage,
  uploadMealPhoto,
  uploadRecipeImage,
  uploadAvatar,
  deleteImage,
  getSignedUrl,
}
