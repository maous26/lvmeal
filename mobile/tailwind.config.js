/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary - Sage Green (serenity, nature, trust)
        primary: {
          50: '#F2F7F3',
          100: '#E5EFE7',
          200: '#C7DCC9',
          300: '#A8C9AB',
          400: '#8CB790',
          500: '#7A9E7E',  // Main sage green
          600: '#6B8E6B',
          700: '#5A7D5A',
          800: '#476347',
          900: '#344A35',
          950: '#1E2D1F',
        },
        // Secondary - Warm Caramel (warmth, earth, comfort)
        secondary: {
          50: '#FBF7F2',
          100: '#F7EFE5',
          200: '#EEDCC5',
          300: '#E3C9A5',
          400: '#D4B188',
          500: '#C4956A',  // Main caramel
          600: '#B07D52',
          700: '#916542',
          800: '#724F34',
          900: '#553B27',
          950: '#2E1F14',
        },
        // Neutral - Warm sand/beige tones
        neutral: {
          50: '#FAF8F5',   // Primary background
          100: '#F3EFE9',  // Secondary background
          200: '#EBE5DC',  // Tertiary background
          300: '#DDD5CA',
          400: '#C4BAA8',
          500: '#A39A8C',
          600: '#7A7268',
          700: '#5C5550',
          800: '#3D3835',
          900: '#2C2520',  // Primary text
          950: '#1A1512',
        },
        // Success - Organic green
        success: {
          50: '#F2F7F3',
          100: '#E0ECE1',
          200: '#BFD9C1',
          300: '#9EC5A1',
          400: '#7FB383',
          500: '#5C9A5E',
          600: '#4A7C4C',
          700: '#3B613D',
          800: '#2D492E',
          900: '#1E301F',
        },
        // Warning - Caramel/amber
        warning: {
          50: '#FDF8F3',
          100: '#FAF0E3',
          200: '#F5E0C5',
          300: '#EDCFA3',
          400: '#E3BB81',
          500: '#D4A574',
          600: '#C08B56',
          700: '#9E6F42',
          800: '#7B5634',
          900: '#5A3F26',
        },
        // Error - Soft terracotta
        error: {
          50: '#FBF3F1',
          100: '#F7E6E3',
          200: '#EDC9C3',
          300: '#E0ACA3',
          400: '#D48F83',
          500: '#C87863',
          600: '#B56A56',
          700: '#965749',
          800: '#77453C',
          900: '#5D372F',
        },
        // Nutrients - Organic, muted palette
        nutrient: {
          calories: '#C4956A',  // Warm caramel
          proteins: '#7A9E7E',  // Sage green
          carbs: '#D4A574',     // Caramel
          fats: '#9B8BB8',      // Muted lavender
          fiber: '#8CAE8C',     // Light sage
          water: '#8EA4B8',     // Blue-gray
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['40px', { lineHeight: '46px', fontWeight: '700' }],
        'h1': ['32px', { lineHeight: '38px', fontWeight: '600' }],
        'h2': ['26px', { lineHeight: '32px', fontWeight: '600' }],
        'h3': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'h4': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['17px', { lineHeight: '26px', fontWeight: '400' }],
        'body': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '14px', fontWeight: '400' }],
      },
      borderRadius: {
        'sm': '8px',
        'DEFAULT': '12px',
        'md': '14px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(44, 37, 32, 0.06)',
        'medium': '0 4px 16px rgba(44, 37, 32, 0.08)',
        'strong': '0 8px 24px rgba(44, 37, 32, 0.12)',
        'glow-primary': '0 0 16px rgba(122, 158, 126, 0.25)',
        'glow-secondary': '0 0 16px rgba(196, 149, 106, 0.25)',
      },
    },
  },
  plugins: [],
}
