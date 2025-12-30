// Love Your Meal - Design System Theme
// Direction artistique : Bienveillant, Professionnel, Confiance
// Palette principale : Bleu (confiance) + Corail (chaleur)

// =============================================================================
// LIGHT THEME (Default)
// =============================================================================
export const lightColors = {
  // Backgrounds - Crème chaleureux
  bg: {
    primary: '#FAFAF9',
    secondary: '#F5F5F3',
    tertiary: '#EFEEEC',
    elevated: '#FFFFFF',
    overlay: 'rgba(0, 70, 110, 0.6)',
  },

  // Text - Charbon doux
  text: {
    primary: '#1A2B3C',
    secondary: '#4A5E72',
    tertiary: '#7A8FA6',
    muted: '#B0BFCF',
    inverse: '#FFFFFF',
  },

  // Primary - Bleu Confiance
  accent: {
    primary: '#009FEB',
    secondary: '#0080C9',
    hover: '#007AB8',
    light: '#EFF8FF',
    muted: '#B6E3FF',
  },

  // Secondary - Corail Chaleur
  secondary: {
    primary: '#FF6B5B',
    hover: '#E84C3D',
    light: '#FFF5F3',
    muted: '#FFD4CC',
  },

  // Semantic
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  info: '#3B82F6',
  infoLight: '#EFF6FF',

  // Nutrients - Couleurs vives pour les macros
  nutrients: {
    calories: '#FF6B5B',
    proteins: '#009FEB',
    carbs: '#F59E0B',
    fats: '#A855F7',
    fiber: '#10B981',
    water: '#06B6D4',
  },

  // Borders
  border: {
    light: '#E8E8E4',
    default: '#D4D4CD',
    medium: '#A3A39A',
    focus: '#009FEB',
  },

  // Gamification
  gamification: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    diamond: '#B9F2FF',
  },
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
}

// Default export uses light colors for backward compatibility
export const colors = lightColors

// =============================================================================
// SHADOWS
// =============================================================================
export const shadows = {
  xs: {
    shadowColor: 'rgba(0, 70, 110, 0.06)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: 'rgba(0, 70, 110, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  default: {
    shadowColor: 'rgba(0, 70, 110, 0.10)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  md: {
    shadowColor: 'rgba(0, 70, 110, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  lg: {
    shadowColor: 'rgba(0, 70, 110, 0.16)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 48,
    elevation: 16,
  },
  // Glow effects for CTAs
  glowPrimary: {
    shadowColor: '#009FEB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glowCoral: {
    shadowColor: '#FF6B5B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
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
// TYPOGRAPHY
// =============================================================================
export const typography = {
  // Display - for hero/splash screens
  display: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '700' as const,
    letterSpacing: -1.5,
  },
  // Headings
  h1: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700' as const,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  // Body text
  lg: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400' as const,
  },
  md: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  bodySemibold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  // Small text
  sm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  // Caption
  xs: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  // Labels
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  // Button text
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  buttonSm: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
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
  colors,
  lightColors,
  darkColors,
  shadows,
  spacing,
  radius,
  typography,
  animations,
}
