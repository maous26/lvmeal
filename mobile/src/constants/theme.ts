// Presence - Design System Theme
// Direction artistique : iOS-Style Minimaliste
// Palette principale : Apple Green (#34C759) + Pure White/Black

// =============================================================================
// FONTS - Inter Typography (iOS System Font Style)
// =============================================================================
export const fonts = {
  // Inter for headings (clean, modern)
  serif: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  // Inter for body text (consistency)
  sans: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
}

// =============================================================================
// iOS PALETTE - Clean Apple-inspired colors
// =============================================================================
export const iosPalette = {
  green: '#34C759',        // Apple Green
  blue: '#007AFF',         // Apple Blue
  red: '#FF3B30',          // Apple Red
  orange: '#FF9500',       // Apple Orange
  yellow: '#FFCC00',       // Apple Yellow
  teal: '#5AC8FA',         // Apple Teal
  purple: '#AF52DE',       // Apple Purple
  pink: '#FF2D55',         // Apple Pink
  gray: '#8E8E93',         // Apple Gray
}

// =============================================================================
// LYM BRAND COLORS - Based on logo (flat sage green + orange accent)
// =============================================================================
export const lymBrand = {
  // Primary green - flat color matching logo (no gradient in logo)
  green: '#6B8E6B',        // Main sage green from logo
  greenLight: '#7A9E7E',   // Slightly lighter for hover/pressed states
  // Orange accent (from logo's Y)
  orange: '#E8A060',
  orangeLight: '#F0B070',
}

// Keep organicPalette for backward compatibility
export const organicPalette = {
  sage: '#34C759',         // Now Apple Green
  sand: '#F2F2F7',         // iOS Gray 6
  stone: '#8E8E93',        // iOS Gray
  moss: '#34C759',         // Now Apple Green
  clay: '#FF9500',         // Now Apple Orange
  ocean: '#007AFF',        // Now Apple Blue
  lavender: '#AF52DE',     // Now Apple Purple
  caramel: '#FF9500',      // Now Apple Orange
}

// =============================================================================
// LIGHT THEME (Default) - iOS Light Mode
// =============================================================================
export const lightColors = {
  // Backgrounds - Subtle blue-gray tint for warmth
  bg: {
    primary: '#F8F9FB',           // Very subtle blue-gray (was pure white)
    secondary: '#F0F1F5',         // Slightly darker blue-gray
    tertiary: '#E8E9ED',          // iOS System Gray 5 with blue tint
    elevated: '#FFFFFF',          // Cards stay pure white for contrast
    overlay: 'rgba(0, 0, 0, 0.4)',
  },

  // Text - iOS Label colors
  text: {
    primary: '#1D1D1F',           // Apple dark label
    secondary: '#3C3C43',         // iOS Secondary label (99% opacity)
    tertiary: '#8E8E93',          // iOS Tertiary label
    muted: '#AEAEB2',             // iOS System Gray 2
    inverse: '#FFFFFF',
  },

  // Primary - LYM Brand Green
  accent: {
    primary: '#6B8E6B',           // LYM Sage Green
    secondary: '#5A7D5A',         // Darker sage for press states
    hover: '#7A9E7E',             // Lighter sage for hover
    light: 'rgba(107, 142, 107, 0.12)', // Light sage tint
    muted: 'rgba(107, 142, 107, 0.3)',  // Muted sage
  },

  // Secondary - Apple Blue
  secondary: {
    primary: '#007AFF',           // Apple Blue
    hover: '#0066D6',             // Darker blue
    light: 'rgba(0, 122, 255, 0.12)', // Light blue tint
    muted: 'rgba(0, 122, 255, 0.3)',  // Muted blue
  },

  // Semantic - iOS System Colors
  success: '#34C759',             // Apple Green
  successLight: 'rgba(52, 199, 89, 0.12)',
  warning: '#FF9500',             // Apple Orange
  warningLight: 'rgba(255, 149, 0, 0.12)',
  error: '#FF3B30',               // Apple Red
  errorLight: 'rgba(255, 59, 48, 0.12)',
  info: '#007AFF',                // Apple Blue
  infoLight: 'rgba(0, 122, 255, 0.12)',

  // Nutrients - iOS-inspired vibrant colors
  nutrients: {
    calories: '#FF9500',          // Orange
    proteins: '#34C759',          // Green
    carbs: '#FFCC00',             // Yellow
    fats: '#AF52DE',              // Purple
    fiber: '#34C759',             // Green
    water: '#5AC8FA',             // Teal
  },

  // Borders - iOS Separator colors
  border: {
    light: '#E5E5E7',             // iOS Separator
    default: '#D1D1D6',           // iOS Opaque separator
    medium: '#C7C7CC',            // Darker separator
    focus: '#6B8E6B',             // LYM Sage Green focus
  },

  // Gamification - Metallic colors
  gamification: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    diamond: '#5AC8FA',
  },

  // Coach - iOS-style priority colors
  coach: {
    urgent: '#FF3B30',            // Red (P0)
    action: '#FF9500',            // Orange (P1)
    celebration: '#34C759',       // Green (P2)
    tip: '#007AFF',               // Blue (P3)
    categoryBg: {
      nutrition: 'rgba(255, 149, 0, 0.08)',
      hydration: 'rgba(90, 200, 250, 0.08)',
      sleep: 'rgba(175, 82, 222, 0.08)',
      sport: 'rgba(52, 199, 89, 0.08)',
      stress: 'rgba(255, 59, 48, 0.08)',
      progress: 'rgba(255, 204, 0, 0.08)',
      wellness: 'rgba(255, 45, 85, 0.08)',
      system: '#F2F2F7',
    },
    unreadBorder: 'rgba(29, 29, 31, 0.3)',
    readBorder: 'rgba(0, 0, 0, 0.08)',
  },

  // iOS palette reference
  organic: organicPalette,
}

// =============================================================================
// DARK THEME - iOS Dark Mode
// =============================================================================
export const darkColors = {
  // Backgrounds - True black for OLED
  bg: {
    primary: '#000000',           // True black
    secondary: '#1C1C1E',         // iOS Dark elevated
    tertiary: '#2C2C2E',          // iOS Dark secondary
    elevated: '#1C1C1E',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },

  // Text - iOS Dark labels
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(235, 235, 245, 0.6)',  // iOS Dark secondary
    tertiary: '#8E8E93',
    muted: '#636366',
    inverse: '#1D1D1F',
  },

  // Primary - LYM Brand Green (brighter for dark mode)
  accent: {
    primary: '#7A9E7E',           // LYM Sage Green Light (more visible on dark)
    secondary: '#8CAE8C',         // Lighter sage for press states
    hover: '#9CBE9C',             // Even lighter for hover
    light: 'rgba(122, 158, 126, 0.2)', // Light sage tint
    muted: 'rgba(122, 158, 126, 0.4)',  // Muted sage
  },

  // Secondary - Apple Blue (Dark mode)
  secondary: {
    primary: '#0A84FF',           // iOS Dark blue
    hover: '#409CFF',
    light: 'rgba(10, 132, 255, 0.2)',
    muted: 'rgba(10, 132, 255, 0.4)',
  },

  // Semantic - iOS Dark System Colors
  success: '#30D158',
  successLight: 'rgba(48, 209, 88, 0.2)',
  warning: '#FF9F0A',
  warningLight: 'rgba(255, 159, 10, 0.2)',
  error: '#FF453A',
  errorLight: 'rgba(255, 69, 58, 0.2)',
  info: '#0A84FF',
  infoLight: 'rgba(10, 132, 255, 0.2)',

  // Nutrients - Adjusted for dark mode
  nutrients: {
    calories: '#FF9F0A',
    proteins: '#30D158',
    carbs: '#FFD60A',
    fats: '#BF5AF2',
    fiber: '#30D158',
    water: '#64D2FF',
  },

  // Borders - iOS Dark separators
  border: {
    light: '#38383A',
    default: '#48484A',
    medium: '#636366',
    focus: '#7A9E7E',             // LYM Sage Green Light focus
  },

  // Gamification
  gamification: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    diamond: '#64D2FF',
  },

  // Coach - Dark mode
  coach: {
    urgent: '#FF453A',
    action: '#FF9F0A',
    celebration: '#30D158',
    tip: '#0A84FF',
    categoryBg: {
      nutrition: 'rgba(255, 159, 10, 0.15)',
      hydration: 'rgba(100, 210, 255, 0.15)',
      sleep: 'rgba(191, 90, 242, 0.15)',
      sport: 'rgba(48, 209, 88, 0.15)',
      stress: 'rgba(255, 69, 58, 0.15)',
      progress: 'rgba(255, 214, 10, 0.15)',
      wellness: 'rgba(255, 55, 95, 0.15)',
      system: '#1C1C1E',
    },
    unreadBorder: 'rgba(255, 255, 255, 0.4)',
    readBorder: 'rgba(255, 255, 255, 0.1)',
  },

  // iOS palette reference
  organic: organicPalette,
}

// Default export uses light colors for backward compatibility
export const colors = lightColors

// =============================================================================
// BLOB COLOR PALETTES - Simplified for iOS style (minimal use)
// =============================================================================
export type BlobPaletteId = 'default' | 'sunset' | 'ocean'

export interface BlobPalette {
  id: BlobPaletteId
  name: string
  description: string
  colors: {
    topRight: string
    middleLeft: string
    bottomRight: string
    topLeft: string
  }
}

export const blobPalettes: Record<BlobPaletteId, BlobPalette> = {
  default: {
    id: 'default',
    name: 'Nature',
    description: 'Vert Apple et bleu',
    colors: {
      topRight: '#34C759',
      middleLeft: '#007AFF',
      bottomRight: '#5AC8FA',
      topLeft: '#E8F5E9',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'Orange et rose',
    colors: {
      topRight: '#FF9500',
      middleLeft: '#FF2D55',
      bottomRight: '#FFCC00',
      topLeft: '#FFF3E0',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Bleu et turquoise',
    colors: {
      topRight: '#007AFF',
      middleLeft: '#5AC8FA',
      bottomRight: '#64D2FF',
      topLeft: '#E3F2FD',
    },
  },
}

// =============================================================================
// SHADOWS - Subtle iOS-style shadows (no colored glow)
// =============================================================================
export const shadows = {
  xs: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  default: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  // Kept for backward compatibility - now just subtle shadows
  glowPrimary: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  glowSecondary: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  glass: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
}

// =============================================================================
// SPACING - Consistent with iOS HIG
// =============================================================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  default: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
}

// =============================================================================
// BORDER RADIUS - iOS-style (flatter, less rounded)
// =============================================================================
export const radius = {
  xs: 4,
  sm: 6,
  default: 8,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 20,
  full: 9999,
}

// =============================================================================
// TYPOGRAPHY - Inter (iOS-style clean typography)
// =============================================================================
export const typography = {
  // Display - for hero/splash screens
  display: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '700' as const,
    fontFamily: fonts.serif.bold,
    letterSpacing: -0.8,
  },
  // Headings
  h1: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700' as const,
    fontFamily: fonts.serif.bold,
    letterSpacing: -0.4,
  },
  h2: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600' as const,
    fontFamily: fonts.serif.semibold,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    fontFamily: fonts.serif.semibold,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    fontFamily: fonts.serif.semibold,
    letterSpacing: 0,
  },
  // Body text
  lg: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  md: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
  },
  bodySemibold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
  },
  // Small text
  sm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
  },
  // Caption
  xs: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
  },
  // Labels
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
    letterSpacing: 0,
  },
  // Button text
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0,
  },
  buttonSm: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0,
  },
}

// =============================================================================
// NUTRI-SCORE / NOVA CLASSIFICATION COLORS
// =============================================================================
export const nutriScoreColors = {
  // Nutri-Score (A-E)
  A: '#038141',
  B: '#85BB2F',
  C: '#FECB02',
  D: '#EE8100',
  E: '#E63E11',
  // NOVA Classification (1-4)
  nova1: '#038141',
  nova2: '#85BB2F',
  nova3: '#FECB02',
  nova4: '#E63E11',
}

// =============================================================================
// COMPONENT SIZE STANDARDS
// =============================================================================
export const componentSizes = {
  // Avatar/Icon containers
  avatar: {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
  },
  // Icon sizes
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
  },
  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  // Button heights
  button: {
    sm: 36,
    md: 44,
    lg: 52,
  },
}

// =============================================================================
// ANIMATIONS
// =============================================================================
export const animations = {
  duration: {
    fast: 150,
    default: 250,
    slow: 400,
    slower: 600,
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
}

export default {
  fonts,
  colors,
  lightColors,
  darkColors,
  shadows,
  spacing,
  radius,
  typography,
  animations,
  nutriScoreColors,
  componentSizes,
}
