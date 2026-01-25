/**
 * ShareModal - Modal de partage social pour recettes
 *
 * Permet le partage sur:
 * - Instagram Stories (image + sticker)
 * - Facebook
 * - Copier le lien
 * - Autres apps (share natif)
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Linking,
  Alert,
  Platform,
  Clipboard,
} from 'react-native'
import { X, Instagram, Facebook, Copy, Share2, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, fonts } from '../../constants/theme'
import { useGamificationStore, XP_REWARDS } from '../../stores/gamification-store'

export interface ShareableRecipe {
  id: string
  name: string
  calories: number
  proteins: number
  carbs?: number
  fats?: number
  prepTime: number
  imageUrl?: string
  isAI?: boolean
  source?: string
}

interface ShareModalProps {
  visible: boolean
  onClose: () => void
  recipe: ShareableRecipe | null
}

export function ShareModal({ visible, onClose, recipe }: ShareModalProps) {
  const { colors } = useTheme()
  const [copied, setCopied] = useState(false)

  if (!recipe) return null

  const gamification = useGamificationStore.getState()

  // Build share message
  const shareMessage = `${recipe.name}\n\n` +
    `${recipe.calories} kcal | ${recipe.proteins}g proteines\n` +
    `${recipe.prepTime} min de preparation\n\n` +
    `Decouvre mes recettes sur LYM!\n` +
    `#LYM #NutritionSaine #Recette #Healthy`

  // Short message for social
  const socialCaption = `${recipe.name} - ${recipe.calories} kcal | ${recipe.proteins}g prot\n\n#LYM #NutritionSaine #Recette`

  const awardXP = () => {
    gamification.addXP(XP_REWARDS.SHARE_RECIPE || 20, 'Recette partagee')
    gamification.incrementMetric('recipes_shared')
  }

  // Share to Instagram Stories
  const shareToInstagram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Instagram doesn't support direct text sharing, but we can:
    // 1. Copy the caption to clipboard
    // 2. Open Instagram app

    try {
      // Copy caption to clipboard for user to paste
      Clipboard.setString(socialCaption)

      // Check if Instagram is installed
      const instagramUrl = 'instagram://app'
      const canOpen = await Linking.canOpenURL(instagramUrl)

      if (canOpen) {
        // Open Instagram
        await Linking.openURL(instagramUrl)
        awardXP()

        // Show instructions
        Alert.alert(
          'Instagram ouvert',
          'Le texte a ete copie! Colle-le dans ta story ou publication.',
          [{ text: 'Compris!' }]
        )
      } else {
        // Instagram not installed - open web version or App Store
        const webUrl = 'https://www.instagram.com/'
        await Linking.openURL(webUrl)
      }
    } catch (error) {
      console.log('[ShareModal] Instagram share error:', error)
      Alert.alert('Erreur', "Impossible d'ouvrir Instagram")
    }

    onClose()
  }

  // Share to Facebook
  const shareToFacebook = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Facebook share URL with pre-filled text
      const encodedText = encodeURIComponent(shareMessage)
      const facebookUrl = `fb://share?quote=${encodedText}`
      const webFacebookUrl = `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}`

      const canOpen = await Linking.canOpenURL('fb://app')

      if (canOpen) {
        // Try native Facebook app first
        try {
          await Linking.openURL(facebookUrl)
          awardXP()
        } catch {
          // Fallback to web
          await Linking.openURL(webFacebookUrl)
          awardXP()
        }
      } else {
        // Open web version
        await Linking.openURL(webFacebookUrl)
        awardXP()
      }
    } catch (error) {
      console.log('[ShareModal] Facebook share error:', error)
      // Ultimate fallback: copy text
      Clipboard.setString(shareMessage)
      Alert.alert(
        'Texte copie',
        'Le message a ete copie. Tu peux le coller sur Facebook.',
        [{ text: 'OK' }]
      )
    }

    onClose()
  }

  // Copy to clipboard
  const copyToClipboard = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Clipboard.setString(shareMessage)
    setCopied(true)

    setTimeout(() => setCopied(false), 2000)

    awardXP()
  }

  // Native share sheet
  const shareNative = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const result = await Share.share({
        message: shareMessage,
        title: `Recette LYM: ${recipe.name}`,
      })

      if (result.action === Share.sharedAction) {
        awardXP()
      }
    } catch (error) {
      console.log('[ShareModal] Native share error:', error)
    }

    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              Partager la recette
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Recipe Preview */}
          <View style={[styles.recipePreview, { backgroundColor: colors.bg.secondary }]}>
            <Text style={[styles.recipeName, { color: colors.text.primary }]} numberOfLines={1}>
              {recipe.name}
            </Text>
            <Text style={[styles.recipeDetails, { color: colors.text.secondary }]}>
              {recipe.calories} kcal | {recipe.proteins}g prot | {recipe.prepTime} min
            </Text>
          </View>

          {/* Share Options */}
          <View style={styles.options}>
            {/* Instagram */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: '#E1306C15' }]}
              onPress={shareToInstagram}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#E1306C' }]}>
                <Instagram size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.optionText, { color: colors.text.primary }]}>
                Instagram
              </Text>
              <Text style={[styles.optionSubtext, { color: colors.text.tertiary }]}>
                Story ou Feed
              </Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: '#1877F215' }]}
              onPress={shareToFacebook}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#1877F2' }]}>
                <Facebook size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.optionText, { color: colors.text.primary }]}>
                Facebook
              </Text>
              <Text style={[styles.optionSubtext, { color: colors.text.tertiary }]}>
                Publier
              </Text>
            </TouchableOpacity>

            {/* Copy */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: colors.bg.secondary }]}
              onPress={copyToClipboard}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.accent.primary }]}>
                {copied ? (
                  <Check size={24} color="#FFFFFF" />
                ) : (
                  <Copy size={24} color="#FFFFFF" />
                )}
              </View>
              <Text style={[styles.optionText, { color: colors.text.primary }]}>
                {copied ? 'Copie!' : 'Copier'}
              </Text>
              <Text style={[styles.optionSubtext, { color: colors.text.tertiary }]}>
                Presse-papiers
              </Text>
            </TouchableOpacity>

            {/* More */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: colors.bg.secondary }]}
              onPress={shareNative}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.text.tertiary }]}>
                <Share2 size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.optionText, { color: colors.text.primary }]}>
                Autres
              </Text>
              <Text style={[styles.optionSubtext, { color: colors.text.tertiary }]}>
                WhatsApp, SMS...
              </Text>
            </TouchableOpacity>
          </View>

          {/* XP Reward Notice */}
          <View style={[styles.xpNotice, { backgroundColor: colors.accent.light }]}>
            <Text style={[styles.xpText, { color: colors.accent.primary }]}>
              +{XP_REWARDS.SHARE_RECIPE || 20} XP pour chaque partage
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
  },
  recipePreview: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  recipeName: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs,
  },
  recipeDetails: {
    ...typography.small,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  optionText: {
    ...typography.smallMedium,
    marginBottom: 2,
  },
  optionSubtext: {
    ...typography.caption,
    fontSize: 10,
  },
  xpNotice: {
    padding: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  xpText: {
    ...typography.small,
    fontWeight: '600',
  },
})

export default ShareModal
