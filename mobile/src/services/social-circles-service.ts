/**
 * Social Circles Service
 *
 * Provides social features for the LYM app:
 * - Circles (groups) with shared goals
 * - Member management and invitations
 * - Group challenges and leaderboards
 * - Activity feed
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getSupabaseClient, isSupabaseConfigured } from './supabase-client'

// ============================================================================
// TYPES
// ============================================================================

export type CircleType = 'friends' | 'family' | 'work' | 'fitness' | 'nutrition' | 'custom'

export type CirclePrivacy = 'public' | 'private' | 'secret'

export type MemberRole = 'owner' | 'admin' | 'member'

export type MemberStatus = 'active' | 'pending' | 'invited' | 'blocked'

export interface CircleMember {
  id: string
  userId: string
  displayName: string
  avatarUrl?: string
  role: MemberRole
  status: MemberStatus
  joinedAt: string
  lastActiveAt: string
  /** Stats visible to the group (based on privacy settings) */
  sharedStats?: {
    currentStreak?: number
    weeklyProgress?: number
    challengeRank?: number
  }
}

export interface Circle {
  id: string
  name: string
  description?: string
  type: CircleType
  privacy: CirclePrivacy
  imageUrl?: string
  /** Shared goal for the group */
  sharedGoal?: {
    type: 'streak' | 'calories' | 'weight_loss' | 'steps' | 'custom'
    target: number
    unit: string
    deadline?: string
  }
  members: CircleMember[]
  memberCount: number
  maxMembers: number
  createdAt: string
  createdBy: string
  settings: CircleSettings
  /** Current active challenge */
  activeChallenge?: CircleChallenge
  /** Invite code for private circles */
  inviteCode?: string
}

export interface CircleSettings {
  /** Allow members to see each other's detailed stats */
  shareDetailedStats: boolean
  /** Allow members to see weight data */
  shareWeight: boolean
  /** Allow members to see meal logs */
  shareMeals: boolean
  /** Allow chat in the circle */
  enableChat: boolean
  /** Notify on member achievements */
  achievementNotifications: boolean
  /** Notify on challenge updates */
  challengeNotifications: boolean
}

export interface CircleChallenge {
  id: string
  circleId: string
  name: string
  description: string
  type: 'streak' | 'calories_burned' | 'steps' | 'weight_loss' | 'meals_logged' | 'custom'
  target: number
  unit: string
  startDate: string
  endDate: string
  status: 'upcoming' | 'active' | 'completed'
  participants: ChallengeParticipant[]
  prizes?: ChallengePrize[]
  createdBy: string
}

export interface ChallengeParticipant {
  userId: string
  displayName: string
  progress: number
  rank: number
  joinedAt: string
  lastUpdatedAt: string
}

export interface ChallengePrize {
  rank: number
  title: string
  description: string
  badge?: string
}

export interface CircleActivity {
  id: string
  circleId: string
  userId: string
  userName: string
  type: 'joined' | 'achievement' | 'challenge_complete' | 'streak_milestone' | 'goal_reached' | 'message'
  content: string
  data?: Record<string, unknown>
  createdAt: string
  reactions?: { emoji: string; count: number; userIds: string[] }[]
}

export interface CircleInvitation {
  id: string
  circleId: string
  circleName: string
  invitedBy: string
  invitedByName: string
  invitedAt: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CIRCLES_KEY = 'social_circles'
const MY_CIRCLES_KEY = 'my_circles'
const INVITATIONS_KEY = 'circle_invitations'
const ACTIVITIES_KEY = 'circle_activities'

const DEFAULT_CIRCLE_SETTINGS: CircleSettings = {
  shareDetailedStats: false,
  shareWeight: false,
  shareMeals: false,
  enableChat: true,
  achievementNotifications: true,
  challengeNotifications: true,
}

const MAX_FREE_CIRCLES = 3
const MAX_CIRCLE_MEMBERS = 50

// ============================================================================
// LOCAL STORAGE
// ============================================================================

let cachedCircles: Circle[] | null = null

async function loadCircles(): Promise<Circle[]> {
  if (cachedCircles) return cachedCircles

  try {
    const stored = await AsyncStorage.getItem(MY_CIRCLES_KEY)
    cachedCircles = stored ? JSON.parse(stored) : []
    return cachedCircles!
  } catch (error) {
    console.error('[Circles] Failed to load:', error)
    return []
  }
}

async function saveCircles(circles: Circle[]): Promise<void> {
  cachedCircles = circles
  await AsyncStorage.setItem(MY_CIRCLES_KEY, JSON.stringify(circles))
}

// ============================================================================
// CIRCLE MANAGEMENT
// ============================================================================

/**
 * Create a new circle
 */
export async function createCircle(
  data: Pick<Circle, 'name' | 'description' | 'type' | 'privacy'> & {
    settings?: Partial<CircleSettings>
    sharedGoal?: Circle['sharedGoal']
  },
  userId: string,
  userName: string
): Promise<Circle> {
  const circles = await loadCircles()

  // Check circle limit
  const ownedCircles = circles.filter((c) => c.createdBy === userId)
  if (ownedCircles.length >= MAX_FREE_CIRCLES) {
    throw new Error(`Maximum ${MAX_FREE_CIRCLES} circles allowed in free plan`)
  }

  const circle: Circle = {
    id: `circle_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: data.name,
    description: data.description,
    type: data.type,
    privacy: data.privacy,
    sharedGoal: data.sharedGoal,
    members: [
      {
        id: `member_${Date.now()}`,
        userId,
        displayName: userName,
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
    ],
    memberCount: 1,
    maxMembers: MAX_CIRCLE_MEMBERS,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    settings: { ...DEFAULT_CIRCLE_SETTINGS, ...data.settings },
    inviteCode: data.privacy === 'private' ? generateInviteCode() : undefined,
  }

  circles.push(circle)
  await saveCircles(circles)

  // Sync to cloud if available
  if (isSupabaseConfigured()) {
    await syncCircleToCloud(circle)
  }

  console.log('[Circles] Created:', circle.name)
  return circle
}

/**
 * Get all circles the user is a member of
 */
export async function getMyCircles(userId: string): Promise<Circle[]> {
  const circles = await loadCircles()
  return circles.filter((c) => c.members.some((m) => m.userId === userId && m.status === 'active'))
}

/**
 * Get a specific circle by ID
 */
export async function getCircle(circleId: string): Promise<Circle | null> {
  const circles = await loadCircles()
  return circles.find((c) => c.id === circleId) || null
}

/**
 * Update circle settings
 */
export async function updateCircle(
  circleId: string,
  updates: Partial<Pick<Circle, 'name' | 'description' | 'settings' | 'sharedGoal'>>,
  userId: string
): Promise<Circle> {
  const circles = await loadCircles()
  const index = circles.findIndex((c) => c.id === circleId)

  if (index === -1) {
    throw new Error('Circle not found')
  }

  const circle = circles[index]
  const member = circle.members.find((m) => m.userId === userId)

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    throw new Error('Permission denied')
  }

  circles[index] = {
    ...circle,
    ...updates,
    settings: { ...circle.settings, ...updates.settings },
  }

  await saveCircles(circles)
  return circles[index]
}

/**
 * Delete a circle (owner only)
 */
export async function deleteCircle(circleId: string, userId: string): Promise<void> {
  const circles = await loadCircles()
  const circle = circles.find((c) => c.id === circleId)

  if (!circle) {
    throw new Error('Circle not found')
  }

  if (circle.createdBy !== userId) {
    throw new Error('Only the owner can delete the circle')
  }

  const updatedCircles = circles.filter((c) => c.id !== circleId)
  await saveCircles(updatedCircles)

  // Delete from cloud
  if (isSupabaseConfigured()) {
    await deleteCircleFromCloud(circleId)
  }

  console.log('[Circles] Deleted:', circle.name)
}

// ============================================================================
// MEMBER MANAGEMENT
// ============================================================================

/**
 * Invite a user to a circle
 */
export async function inviteToCircle(
  circleId: string,
  inviteeEmail: string,
  inviterId: string,
  inviterName: string
): Promise<CircleInvitation> {
  const circle = await getCircle(circleId)
  if (!circle) {
    throw new Error('Circle not found')
  }

  const member = circle.members.find((m) => m.userId === inviterId)
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    throw new Error('Permission denied')
  }

  if (circle.memberCount >= circle.maxMembers) {
    throw new Error('Circle is full')
  }

  const invitation: CircleInvitation = {
    id: `invite_${Date.now()}`,
    circleId,
    circleName: circle.name,
    invitedBy: inviterId,
    invitedByName: inviterName,
    invitedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    status: 'pending',
  }

  // Store invitation
  const invitations = await getStoredInvitations()
  invitations.push(invitation)
  await AsyncStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations))

  // Send notification/email (would connect to notification service)
  console.log('[Circles] Invitation sent to:', inviteeEmail)

  return invitation
}

/**
 * Join a circle using invite code
 */
export async function joinCircleByCode(
  inviteCode: string,
  userId: string,
  userName: string
): Promise<Circle> {
  const circles = await loadCircles()
  const circle = circles.find((c) => c.inviteCode === inviteCode)

  if (!circle) {
    throw new Error('Invalid invite code')
  }

  if (circle.members.some((m) => m.userId === userId)) {
    throw new Error('Already a member')
  }

  if (circle.memberCount >= circle.maxMembers) {
    throw new Error('Circle is full')
  }

  const newMember: CircleMember = {
    id: `member_${Date.now()}`,
    userId,
    displayName: userName,
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  }

  circle.members.push(newMember)
  circle.memberCount++

  await saveCircles(circles)

  // Add activity
  await addCircleActivity(circle.id, userId, userName, 'joined', `${userName} a rejoint le cercle`)

  return circle
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string,
  userName: string
): Promise<Circle> {
  const invitations = await getStoredInvitations()
  const invitation = invitations.find((i) => i.id === invitationId)

  if (!invitation) {
    throw new Error('Invitation not found')
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation already processed')
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    invitation.status = 'expired'
    await AsyncStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations))
    throw new Error('Invitation expired')
  }

  // Add user to circle
  const circles = await loadCircles()
  const circleIndex = circles.findIndex((c) => c.id === invitation.circleId)

  if (circleIndex === -1) {
    throw new Error('Circle no longer exists')
  }

  const circle = circles[circleIndex]

  const newMember: CircleMember = {
    id: `member_${Date.now()}`,
    userId,
    displayName: userName,
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  }

  circle.members.push(newMember)
  circle.memberCount++

  // Update invitation status
  invitation.status = 'accepted'

  await Promise.all([
    saveCircles(circles),
    AsyncStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations)),
  ])

  // Add activity
  await addCircleActivity(circle.id, userId, userName, 'joined', `${userName} a rejoint le cercle`)

  return circle
}

/**
 * Leave a circle
 */
export async function leaveCircle(circleId: string, userId: string): Promise<void> {
  const circles = await loadCircles()
  const circleIndex = circles.findIndex((c) => c.id === circleId)

  if (circleIndex === -1) {
    throw new Error('Circle not found')
  }

  const circle = circles[circleIndex]
  const memberIndex = circle.members.findIndex((m) => m.userId === userId)

  if (memberIndex === -1) {
    throw new Error('Not a member')
  }

  const member = circle.members[memberIndex]

  // Owner cannot leave, must transfer or delete
  if (member.role === 'owner') {
    throw new Error('Owner cannot leave. Transfer ownership or delete the circle.')
  }

  circle.members.splice(memberIndex, 1)
  circle.memberCount--

  await saveCircles(circles)
  console.log('[Circles] Member left:', circle.name)
}

/**
 * Update member role
 */
export async function updateMemberRole(
  circleId: string,
  targetUserId: string,
  newRole: MemberRole,
  requesterId: string
): Promise<void> {
  const circles = await loadCircles()
  const circle = circles.find((c) => c.id === circleId)

  if (!circle) {
    throw new Error('Circle not found')
  }

  const requester = circle.members.find((m) => m.userId === requesterId)
  if (!requester || requester.role !== 'owner') {
    throw new Error('Only owner can change roles')
  }

  const target = circle.members.find((m) => m.userId === targetUserId)
  if (!target) {
    throw new Error('Member not found')
  }

  // If transferring ownership
  if (newRole === 'owner') {
    requester.role = 'admin'
    target.role = 'owner'
    circle.createdBy = targetUserId
  } else {
    target.role = newRole
  }

  await saveCircles(circles)
}

// ============================================================================
// CHALLENGES
// ============================================================================

/**
 * Create a challenge in a circle
 */
export async function createChallenge(
  circleId: string,
  data: Pick<CircleChallenge, 'name' | 'description' | 'type' | 'target' | 'unit' | 'startDate' | 'endDate'> & {
    prizes?: ChallengePrize[]
  },
  userId: string
): Promise<CircleChallenge> {
  const circles = await loadCircles()
  const circleIndex = circles.findIndex((c) => c.id === circleId)

  if (circleIndex === -1) {
    throw new Error('Circle not found')
  }

  const circle = circles[circleIndex]
  const member = circle.members.find((m) => m.userId === userId)

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    throw new Error('Permission denied')
  }

  if (circle.activeChallenge && circle.activeChallenge.status === 'active') {
    throw new Error('A challenge is already active')
  }

  const challenge: CircleChallenge = {
    id: `challenge_${Date.now()}`,
    circleId,
    name: data.name,
    description: data.description,
    type: data.type,
    target: data.target,
    unit: data.unit,
    startDate: data.startDate,
    endDate: data.endDate,
    status: new Date(data.startDate) > new Date() ? 'upcoming' : 'active',
    participants: [],
    prizes: data.prizes,
    createdBy: userId,
  }

  circle.activeChallenge = challenge
  await saveCircles(circles)

  console.log('[Circles] Challenge created:', challenge.name)
  return challenge
}

/**
 * Join a challenge
 */
export async function joinChallenge(
  circleId: string,
  userId: string,
  userName: string
): Promise<void> {
  const circles = await loadCircles()
  const circle = circles.find((c) => c.id === circleId)

  if (!circle || !circle.activeChallenge) {
    throw new Error('Challenge not found')
  }

  if (circle.activeChallenge.status !== 'active' && circle.activeChallenge.status !== 'upcoming') {
    throw new Error('Challenge not available')
  }

  if (circle.activeChallenge.participants.some((p) => p.userId === userId)) {
    throw new Error('Already participating')
  }

  circle.activeChallenge.participants.push({
    userId,
    displayName: userName,
    progress: 0,
    rank: circle.activeChallenge.participants.length + 1,
    joinedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  })

  await saveCircles(circles)
}

/**
 * Update challenge progress
 */
export async function updateChallengeProgress(
  circleId: string,
  userId: string,
  progress: number
): Promise<ChallengeParticipant[]> {
  const circles = await loadCircles()
  const circle = circles.find((c) => c.id === circleId)

  if (!circle || !circle.activeChallenge) {
    throw new Error('Challenge not found')
  }

  const participant = circle.activeChallenge.participants.find((p) => p.userId === userId)
  if (!participant) {
    throw new Error('Not a participant')
  }

  participant.progress = progress
  participant.lastUpdatedAt = new Date().toISOString()

  // Recalculate ranks
  const sorted = [...circle.activeChallenge.participants].sort((a, b) => b.progress - a.progress)
  sorted.forEach((p, index) => {
    p.rank = index + 1
  })

  await saveCircles(circles)

  return circle.activeChallenge.participants
}

/**
 * Get leaderboard for a challenge
 */
export async function getChallengeLeaderboard(circleId: string): Promise<ChallengeParticipant[]> {
  const circle = await getCircle(circleId)

  if (!circle || !circle.activeChallenge) {
    return []
  }

  return [...circle.activeChallenge.participants].sort((a, b) => b.progress - a.progress)
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

/**
 * Add an activity to the circle feed
 */
export async function addCircleActivity(
  circleId: string,
  userId: string,
  userName: string,
  type: CircleActivity['type'],
  content: string,
  data?: Record<string, unknown>
): Promise<CircleActivity> {
  const activity: CircleActivity = {
    id: `activity_${Date.now()}`,
    circleId,
    userId,
    userName,
    type,
    content,
    data,
    createdAt: new Date().toISOString(),
    reactions: [],
  }

  const activities = await getCircleActivities(circleId)
  activities.unshift(activity)

  // Keep only last 100 activities per circle
  const trimmed = activities.slice(0, 100)
  await saveCircleActivities(circleId, trimmed)

  return activity
}

/**
 * Get activities for a circle
 */
export async function getCircleActivities(
  circleId: string,
  limit: number = 20
): Promise<CircleActivity[]> {
  try {
    const key = `${ACTIVITIES_KEY}_${circleId}`
    const stored = await AsyncStorage.getItem(key)
    const activities = stored ? JSON.parse(stored) : []
    return activities.slice(0, limit)
  } catch (error) {
    console.error('[Circles] Failed to load activities:', error)
    return []
  }
}

async function saveCircleActivities(circleId: string, activities: CircleActivity[]): Promise<void> {
  const key = `${ACTIVITIES_KEY}_${circleId}`
  await AsyncStorage.setItem(key, JSON.stringify(activities))
}

/**
 * Add reaction to an activity
 */
export async function addReaction(
  circleId: string,
  activityId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const activities = await getCircleActivities(circleId, 100)
  const activity = activities.find((a) => a.id === activityId)

  if (!activity) return

  if (!activity.reactions) {
    activity.reactions = []
  }

  const existingReaction = activity.reactions.find((r) => r.emoji === emoji)
  if (existingReaction) {
    if (!existingReaction.userIds.includes(userId)) {
      existingReaction.userIds.push(userId)
      existingReaction.count++
    }
  } else {
    activity.reactions.push({
      emoji,
      count: 1,
      userIds: [userId],
    })
  }

  await saveCircleActivities(circleId, activities)
}

// ============================================================================
// DISCOVERY & SEARCH
// ============================================================================

/**
 * Discover public circles
 */
export async function discoverPublicCircles(
  filter?: { type?: CircleType; hasActiveChallenge?: boolean }
): Promise<Circle[]> {
  const circles = await loadCircles()

  return circles.filter((c) => {
    if (c.privacy !== 'public') return false
    if (filter?.type && c.type !== filter.type) return false
    if (filter?.hasActiveChallenge && (!c.activeChallenge || c.activeChallenge.status !== 'active')) {
      return false
    }
    return true
  })
}

/**
 * Search circles by name
 */
export async function searchCircles(query: string): Promise<Circle[]> {
  const circles = await loadCircles()
  const lowerQuery = query.toLowerCase()

  return circles.filter(
    (c) =>
      c.privacy === 'public' &&
      (c.name.toLowerCase().includes(lowerQuery) ||
        (c.description && c.description.toLowerCase().includes(lowerQuery)))
  )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function getStoredInvitations(): Promise<CircleInvitation[]> {
  try {
    const stored = await AsyncStorage.getItem(INVITATIONS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Get pending invitations for a user
 */
export async function getPendingInvitations(userId: string): Promise<CircleInvitation[]> {
  const invitations = await getStoredInvitations()
  const now = new Date()

  return invitations.filter(
    (i) => i.status === 'pending' && new Date(i.expiresAt) > now
  )
}

// ============================================================================
// CLOUD SYNC
// ============================================================================

async function syncCircleToCloud(circle: Circle): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return

  try {
    await client.from('circles').upsert({
      id: circle.id,
      data: circle,
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Circles] Cloud sync failed:', error)
  }
}

async function deleteCircleFromCloud(circleId: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return

  try {
    await client.from('circles').delete().eq('id', circleId)
  } catch (error) {
    console.error('[Circles] Cloud delete failed:', error)
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const socialCirclesService = {
  // Circle management
  createCircle,
  getMyCircles,
  getCircle,
  updateCircle,
  deleteCircle,

  // Members
  inviteToCircle,
  joinCircleByCode,
  acceptInvitation,
  leaveCircle,
  updateMemberRole,
  getPendingInvitations,

  // Challenges
  createChallenge,
  joinChallenge,
  updateChallengeProgress,
  getChallengeLeaderboard,

  // Activities
  addCircleActivity,
  getCircleActivities,
  addReaction,

  // Discovery
  discoverPublicCircles,
  searchCircles,
}

export default socialCirclesService
