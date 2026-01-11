// Love Your Meal - Design System Theme
// Direction artistique : Organic Luxury - Nature, Bien-être, Élégance
// Palette principale : Vert Mousse (sérénité) + Terre Cuite (chaleur)

// =============================================================================
// FONTS - Organic Luxury Typography
// =============================================================================
export const fonts = {
  // Serif pour titres luxueux (Playfair Display)
  serif: {
    regular: 'PlayfairDisplay_400Regular',
    medium: 'PlayfairDisplay_500Medium',
    semibold: 'PlayfairDisplay_600SemiBold',
    bold: 'PlayfairDisplay_700Bold',
  },
  // Sans-serif pour corps de texte (Inter)
  sans: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
}

// =============================================================================
// ORGANIC PALETTE - Couleurs naturelles et apaisantes
// =============================================================================
export const organicPalette = {
  sage: '#7A9E7E',       // Vert Sauge - doux et apaisant
  sand: '#E2DCCA',       // Sable Chaud - neutre chaleureux
  stone: '#8B8680',      // Pierre - gris terreux
  moss: '#4A6741',       // Mousse - vert profond luxueux
  clay: '#B8856C',       // Argile - terre naturelle
  ocean: '#2D7A9C',      // Bleu Océan - profond et calme
  lavender: '#9B7BB8',   // Lavande - douceur
  caramel: '#D4A574',    // Caramel - chaleur douce
}

// =============================================================================
// LIGHT THEME (Default)
// =============================================================================
export const lightColors = {
  // Backgrounds - Crème chaud organique
  bg: {
    primary: '#FDFCFA',      // Crème chaud
    secondary: '#F7F5F2',    // Beige pâle
    tertiary: '#F0EDE8',     // Sable très clair
    elevated: '#FFFFFF',
    overlay: 'rgba(74, 103, 65, 0.6)', // Overlay vert mousse
  },

  // Text - Charbon doux avec teinte chaude
  text: {
    primary: '#2D3A2E',      // Charbon avec teinte verte
    secondary: '#4A5E4C',    // Gris-vert moyen
    tertiary: '#7A8B7C',     // Gris-vert clair
    muted: '#A8B5AA',        // Gris-vert désaturé
    inverse: '#FFFFFF',
  },

  // Primary - Vert Mousse (luxe naturel)
  accent: {
    primary: '#4A6741',      // Vert Mousse profond
    secondary: '#5C7A52',    // Vert Mousse clair
    hover: '#3D5636',        // Vert Mousse foncé
    light: '#EDF3EC',        // Vert très pâle
    muted: '#B8CBB4',        // Vert désaturé
  },

  // Secondary - Terre Cuite (chaleur naturelle)
  secondary: {
    primary: '#C87863',      // Terre Cuite
    hover: '#B56A56',        // Terre Cuite foncé
    light: '#FBF5F3',        // Terre Cuite très pâle
    muted: '#E5CFC9',        // Terre Cuite désaturé
  },

  // Semantic - Ajustés pour palette organique
  success: '#5C8A5E',        // Vert naturel
  successLight: '#EDF5EE',
  warning: '#D4A574',        // Caramel
  warningLight: '#FDF8F3',
  error: '#C75D5D',          // Rouge terre
  errorLight: '#FDF2F2',
  info: '#2D7A9C',           // Océan
  infoLight: '#EEF6F9',

  // Nutrients - Palette organique douce
  nutrients: {
    calories: '#C87863',     // Terre cuite
    proteins: '#4A6741',     // Mousse
    carbs: '#D4A574',        // Caramel doux
    fats: '#9B7BB8',         // Lavande
    fiber: '#7A9E7E',        // Sauge
    water: '#6BA3BE',        // Océan clair
  },

  // Borders - Teintes chaudes
  border: {
    light: '#EDE9E3',        // Beige très clair
    default: '#D8D2C8',      // Sable moyen
    medium: '#B5AFA5',       // Pierre claire
    focus: '#4A6741',        // Vert mousse
  },

  // Gamification - Teintes naturelles
  gamification: {
    bronze: '#B8856C',       // Argile
    silver: '#A8B5AA',       // Sauge désaturé
    gold: '#D4A574',         // Caramel
    platinum: '#E2DCCA',     // Sable
    diamond: '#7A9E7E',      // Sauge
  },

  // Coach - Palette bienveillante (jamais culpabilisante)
  // P0-P3 utilisent des teintes douces au lieu de rouges agressifs
  coach: {
    // Priority colors - palette douce et organique
    urgent: '#A85C5C',       // Prune douce (P0) - alerte sans agressivité
    action: '#8B6B61',       // Terre sienne (P1) - action chaleureuse
    celebration: '#5C8A5E',  // Vert naturel (P2) - célébration positive
    tip: '#6B8A9B',          // Bleu gris (P3) - conseil apaisant
    // Category backgrounds
    categoryBg: {
      nutrition: '#F5F0E8',  // Crème chaud
      hydration: '#EEF6F9',  // Bleu très pâle
      sleep: '#F3F0F8',      // Lavande pâle
      sport: '#EDF5EE',      // Vert très pâle
      stress: '#F8F5F0',     // Beige chaud
      progress: '#FDF8F3',   // Caramel pâle
      wellness: '#FBF5F3',   // Rose terre pâle
      system: '#F5F5F5',     // Gris neutre
    },
    // State colors
    unreadBorder: 'rgba(74, 103, 65, 0.4)',  // Vert mousse semi-transparent
    readBorder: 'rgba(0, 0, 0, 0.08)',       // Gris très léger
  },

  // Organic specific
  organic: organicPalette,
}

// =============================================================================
// DARK THEME
// =============================================================================
export const darkColors = {
  // Backgrounds - Bleu nuit profond
  bg: {
    primary: '#0D1520',
    secondary: '#151D2B',
    tertiary: '#1E2836',
    elevated: '#263140',
    overlay: 'rgba(0, 0, 0, 0.75)',
  },

  // Text - Clair pour dark mode
  text: {
    primary: '#F7FAFC',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    muted: '#64748B',
    inverse: '#1A2B3C',
  },

  // Primary - Bleu plus lumineux pour dark mode
  accent: {
    primary: '#38BDF8',
    secondary: '#0EA5E9',
    hover: '#7DD3FC',
    light: '#1E3A5F',
    muted: '#0C4A6E',
  },

  // Secondary - Corail ajusté pour dark mode
  secondary: {
    primary: '#FF8577',
    hover: '#FF6B5B',
    light: '#3D2420',
    muted: '#7C3D35',
  },

  // Semantic
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#78350F',
  error: '#F87171',
  errorLight: '#7F1D1D',
  info: '#60A5FA',
  infoLight: '#1E3A8A',

  // Nutrients - Ajustés pour dark mode
  nutrients: {
    calories: '#FF8577',
    proteins: '#38BDF8',
    carbs: '#FBBF24',
    fats: '#C084FC',
    fiber: '#34D399',
    water: '#22D3EE',
  },

  // Borders
  border: {
    light: '#1E2836',
    default: '#334155',
    medium: '#475569',
    focus: '#38BDF8',
  },

  // Gamification
  gamification: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    diamond: '#B9F2FF',
  },

  // Coach - Dark mode palette (softer contrast)
  coach: {
    // Priority colors - darker tones for dark mode
    urgent: '#D18A8A',       // Rose-prune clair (P0)
    action: '#C9A090',       // Terre sienne clair (P1)
    celebration: '#7DBF80',  // Vert lumineux (P2)
    tip: '#8BB0C4',          // Bleu gris clair (P3)
    // Category backgrounds
    categoryBg: {
      nutrition: '#2A2520',
      hydration: '#1E2A30',
      sleep: '#252030',
      sport: '#1E2520',
      stress: '#2A2825',
      progress: '#2A2520',
      wellness: '#2A2225',
      system: '#202025',
    },
    // State colors
    unreadBorder: 'rgba(56, 189, 248, 0.4)',
    readBorder: 'rgba(255, 255, 255, 0.1)',
  },

  // Organic specific (same as light for consistency)
  organic: organicPalette,
}

// Default export uses light colors for backward compatibility
export const colors = lightColors

// =============================================================================
// SHADOWS - Teintes organiques vertes/terreuses
// =============================================================================
export const shadows = {
  xs: {
    shadowColor: 'rgba(74, 103, 65, 0.06)',  // Vert mousse
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: 'rgba(74, 103, 65, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  default: {
    shadowColor: 'rgba(74, 103, 65, 0.10)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  md: {
    shadowColor: 'rgba(74, 103, 65, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  lg: {
    shadowColor: 'rgba(74, 103, 65, 0.16)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 48,
    elevation: 16,
  },
  // Glow effects organiques
  glowPrimary: {
    shadowColor: '#4A6741',    // Vert mousse
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  glowSecondary: {
    shadowColor: '#C87863',    // Terre cuite
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  // Glass card shadow
  glass: {
    shadowColor: 'rgba(74, 103, 65, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 6,
  },
}

// =============================================================================
// SPACING
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
// BORDER RADIUS
// =============================================================================
export const radius = {
  xs: 4,
  sm: 6,
  default: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
}

// =============================================================================
// TYPOGRAPHY - Organic Luxury (Playfair Display + Inter)
// =============================================================================
export const typography = {
  // Display - for hero/splash screens (Serif luxueux)
  display: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '700' as const,
    fontFamily: fonts.serif.bold,
    letterSpacing: -0.5,
  },
  // Headings (Serif luxueux)
  h1: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700' as const,
    fontFamily: fonts.serif.bold,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600' as const,
    fontFamily: fonts.serif.semibold,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    fontFamily: fonts.serif.semibold,
    letterSpacing: 0,
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    fontFamily: fonts.serif.semibold,
    letterSpacing: 0,
  },
  // Body text (Sans-serif Inter)
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
    letterSpacing: 0.2,
  },
  // Button text
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0.3,
  },
  buttonSm: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0.2,
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
}
