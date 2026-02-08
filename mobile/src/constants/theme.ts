// LYM Design System
// Direction artistique : Outil de délégation de décision
// Positionnement : anti-food porn, soulagement, calme thérapeutique
// Références : Headspace (calme), Duolingo (progression), Notion (clarté)
// Palette : Base sable/beige chaud + accent vert sauge + caramel secondaire

// =============================================================================
// FONTS - Inter Typography (humanist sans-serif)
// =============================================================================
export const fonts = {
  // Inter for headings (clean, warm)
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
// LYM BRAND COLORS
// =============================================================================
export const lymBrand = {
  // Primary sage green - calm, organic, trustworthy
  sage: '#7A9E7E',
  sageDark: '#6B8E6B',
  sageLight: '#8CAE8C',
  // Secondary caramel - warmth, comfort, home
  caramel: '#C4956A',
  caramelLight: '#D4B188',
  // Tertiary terracotta - earth, grounding
  terracotta: '#C87863',
}

// Organic palette for backward compatibility
export const organicPalette = {
  sage: '#7A9E7E',
  sand: '#F3EFE9',
  stone: '#A39A8C',
  moss: '#6B8E6B',
  clay: '#C4956A',
  ocean: '#8EA4B8',
  lavender: '#9B8BB8',
  caramel: '#D4A574',
}

// iOS palette kept for components that need iOS-standard colors
export const iosPalette = {
  green: '#34C759',
  blue: '#007AFF',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  teal: '#5AC8FA',
  purple: '#AF52DE',
  pink: '#FF2D55',
  gray: '#8E8E93',
}

// =============================================================================
// LIGHT THEME (Default) - Warm Sand & Sage
// =============================================================================
export const lightColors = {
  // Backgrounds - Warm sand/beige
  bg: {
    primary: '#FAF8F5',           // Warm off-white
    secondary: '#F3EFE9',         // Light warm beige
    tertiary: '#EBE5DC',          // Medium beige
    elevated: '#FFFFFF',          // Cards - pure white for contrast
    overlay: 'rgba(44, 37, 32, 0.4)',
  },

  // Text - Warm brown tones (not cold black)
  text: {
    primary: '#2C2520',           // Warm dark brown
    secondary: '#5C5550',         // Warm medium brown
    tertiary: '#8A8480',          // Warm muted
    muted: '#AEA8A2',             // Light warm muted
    inverse: '#FFFFFF',
  },

  // Primary accent - Sage Green
  accent: {
    primary: '#7A9E7E',           // Sage green
    secondary: '#6B8E6B',         // Darker sage for press states
    hover: '#8CAE8C',             // Lighter sage for hover
    light: 'rgba(122, 158, 126, 0.12)', // Light sage tint
    muted: 'rgba(122, 158, 126, 0.25)', // Muted sage
  },

  // Secondary accent - Warm Caramel
  secondary: {
    primary: '#C4956A',           // Warm caramel
    hover: '#B07D52',             // Darker caramel
    light: 'rgba(196, 149, 106, 0.12)', // Light caramel tint
    muted: 'rgba(196, 149, 106, 0.25)', // Muted caramel
  },

  // Semantic - Organic, soft versions
  success: '#5C9A5E',
  successLight: 'rgba(92, 154, 94, 0.12)',
  warning: '#D4A574',
  warningLight: 'rgba(212, 165, 116, 0.12)',
  error: '#C87863',
  errorLight: 'rgba(200, 120, 99, 0.12)',
  info: '#8EA4B8',
  infoLight: 'rgba(142, 164, 184, 0.12)',

  // Nutrients - Muted organic
  nutrients: {
    calories: '#C4956A',          // Caramel
    proteins: '#7A9E7E',          // Sage
    carbs: '#D4A574',             // Warm caramel
    fats: '#9B8BB8',              // Muted lavender
    fiber: '#8CAE8C',             // Light sage
    water: '#8EA4B8',             // Blue-gray
  },

  // Borders - Warm, subtle
  border: {
    light: '#EBE5DC',             // Warm beige
    default: '#DDD5CA',           // Medium warm
    medium: '#C4BAA8',            // Stronger warm
    focus: '#7A9E7E',             // Sage green focus
  },

  // Gamification - Warm metallic
  gamification: {
    bronze: '#CD7F32',
    silver: '#B8B8B8',
    gold: '#D4A574',
    platinum: '#E5E4E2',
    diamond: '#8EA4B8',
  },

  // Coach - Warm priority colors
  coach: {
    urgent: '#C87863',            // Terracotta (P0)
    action: '#D4A574',            // Caramel (P1)
    celebration: '#7A9E7E',       // Sage (P2)
    tip: '#8EA4B8',               // Blue-gray (P3)
    categoryBg: {
      nutrition: 'rgba(196, 149, 106, 0.08)',
      hydration: 'rgba(142, 164, 184, 0.08)',
      sleep: 'rgba(155, 139, 184, 0.08)',
      sport: 'rgba(122, 158, 126, 0.08)',
      stress: 'rgba(200, 120, 99, 0.08)',
      progress: 'rgba(212, 165, 116, 0.08)',
      wellness: 'rgba(155, 139, 184, 0.08)',
      system: '#F3EFE9',
    },
    unreadBorder: 'rgba(44, 37, 32, 0.2)',
    readBorder: 'rgba(44, 37, 32, 0.06)',
  },

  // Organic palette reference
  organic: organicPalette,
}

// =============================================================================
// DARK THEME - Warm Dark (not true black)
// =============================================================================
export const darkColors = {
  // Backgrounds - Warm dark brown (not pure black)
  bg: {
    primary: '#1A1714',           // Warm near-black
    secondary: '#252019',         // Warm dark brown
    tertiary: '#312B23',          // Medium dark brown
    elevated: '#2A2520',          // Elevated dark
    overlay: 'rgba(0, 0, 0, 0.6)',
  },

  // Text - Light warm tones
  text: {
    primary: '#F5F0EB',           // Warm white
    secondary: 'rgba(245, 240, 235, 0.7)',
    tertiary: '#8A8480',
    muted: '#5C5550',
    inverse: '#2C2520',
  },

  // Primary accent - Sage Green (brighter for dark mode)
  accent: {
    primary: '#8CAE8C',           // Lighter sage
    secondary: '#9CBE9C',         // Even lighter
    hover: '#A4C6A4',             // Lightest for hover
    light: 'rgba(140, 174, 140, 0.2)',
    muted: 'rgba(140, 174, 140, 0.35)',
  },

  // Secondary accent - Caramel (brighter for dark mode)
  secondary: {
    primary: '#D4B188',           // Lighter caramel
    hover: '#E3C9A5',
    light: 'rgba(212, 177, 136, 0.2)',
    muted: 'rgba(212, 177, 136, 0.35)',
  },

  // Semantic - Dark mode adjusted
  success: '#6BAA6D',
  successLight: 'rgba(107, 170, 109, 0.2)',
  warning: '#E3BB81',
  warningLight: 'rgba(227, 187, 129, 0.2)',
  error: '#D48F83',
  errorLight: 'rgba(212, 143, 131, 0.2)',
  info: '#A0B8CC',
  infoLight: 'rgba(160, 184, 204, 0.2)',

  // Nutrients - Brighter for dark mode
  nutrients: {
    calories: '#D4B188',
    proteins: '#8CAE8C',
    carbs: '#E3BB81',
    fats: '#ADA0C8',
    fiber: '#9CBE9C',
    water: '#A0B8CC',
  },

  // Borders - Dark warm
  border: {
    light: '#312B23',
    default: '#3D3630',
    medium: '#524A40',
    focus: '#8CAE8C',
  },

  // Gamification
  gamification: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#E3BB81',
    platinum: '#E5E4E2',
    diamond: '#A0B8CC',
  },

  // Coach - Dark mode
  coach: {
    urgent: '#D48F83',
    action: '#E3BB81',
    celebration: '#8CAE8C',
    tip: '#A0B8CC',
    categoryBg: {
      nutrition: 'rgba(212, 177, 136, 0.15)',
      hydration: 'rgba(160, 184, 204, 0.15)',
      sleep: 'rgba(173, 160, 200, 0.15)',
      sport: 'rgba(140, 174, 140, 0.15)',
      stress: 'rgba(212, 143, 131, 0.15)',
      progress: 'rgba(227, 187, 129, 0.15)',
      wellness: 'rgba(173, 160, 200, 0.15)',
      system: '#252019',
    },
    unreadBorder: 'rgba(245, 240, 235, 0.3)',
    readBorder: 'rgba(245, 240, 235, 0.08)',
  },

  // Organic palette reference
  organic: organicPalette,
}

// Default export uses light colors
export const colors = lightColors

// =============================================================================
// BLOB COLOR PALETTES - Warm, subtle gradients
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
    name: 'Sauge',
    description: 'Vert sauge et sable chaud',
    colors: {
      topRight: '#8CAE8C',
      middleLeft: '#C4956A',
      bottomRight: '#8EA4B8',
      topLeft: '#F3EFE9',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Crépuscule',
    description: 'Caramel et terracotta',
    colors: {
      topRight: '#D4A574',
      middleLeft: '#C87863',
      bottomRight: '#C4956A',
      topLeft: '#FBF7F2',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Brume',
    description: 'Bleu-gris et sauge',
    colors: {
      topRight: '#8EA4B8',
      middleLeft: '#7A9E7E',
      bottomRight: '#A0B8CC',
      topLeft: '#F3EFE9',
    },
  },
}

// =============================================================================
// SHADOWS - Subtle, warm-toned
// =============================================================================
export const shadows = {
  xs: {
    shadowColor: '#2C2520',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#2C2520',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  default: {
    shadowColor: '#2C2520',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  md: {
    shadowColor: '#2C2520',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: '#2C2520',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  // Glow effects - warm, subtle
  glowPrimary: {
    shadowColor: '#7A9E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  glowSecondary: {
    shadowColor: '#C4956A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  glass: {
    shadowColor: '#2C2520',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
}

// =============================================================================
// SPACING - Generous, breathing rhythm
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
// BORDER RADIUS - Soft, rounded (nothing pointy)
// =============================================================================
export const radius = {
  xs: 6,
  sm: 8,
  default: 12,
  md: 14,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
}

// =============================================================================
// TYPOGRAPHY - Inter (humanist sans-serif, strict hierarchy)
// =============================================================================
export const typography = {
  // Display - rare, for splash/hero only
  display: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700' as const,
    fontFamily: fonts.sans.bold,
    letterSpacing: -0.8,
  },
  // Headings - used sparingly, always purposeful
  h1: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: -0.4,
  },
  h2: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0,
  },
  // Body text - readable, comfortable
  lg: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  md: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
  },
  bodySemibold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
  },
  // Small text
  sm: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  smallMedium: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
  },
  // Caption - minimal
  xs: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
    fontFamily: fonts.sans.regular,
  },
  captionMedium: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
  },
  // Labels - directive, clear
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    fontFamily: fonts.sans.medium,
    letterSpacing: 0,
  },
  // Buttons - confident, readable
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0,
  },
  buttonSm: {
    fontSize: 13,
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
  A: '#038141',
  B: '#85BB2F',
  C: '#FECB02',
  D: '#EE8100',
  E: '#E63E11',
  nova1: '#038141',
  nova2: '#85BB2F',
  nova3: '#FECB02',
  nova4: '#E63E11',
}

// =============================================================================
// COMPONENT SIZE STANDARDS
// =============================================================================
export const componentSizes = {
  avatar: {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 52,
  },
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
  },
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  button: {
    sm: 36,
    md: 44,
    lg: 52,
  },
}

// =============================================================================
// ANIMATIONS - Slow, predictable, never decorative
// =============================================================================
export const animations = {
  duration: {
    fast: 200,
    default: 300,
    slow: 500,
    slower: 700,
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
