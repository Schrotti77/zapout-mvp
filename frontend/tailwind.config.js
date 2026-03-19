/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // === SURFACE TOKENS (Tonal Depth) ===
        surface: '#131313',
        'surface-container-low': '#1C1B1B',
        'surface-container': '#201f1f',
        'surface-container-high': '#2A2A2A',
        'surface-container-highest': '#353534',
        'surface-bright': '#393939',
        'surface-variant': '#353534',
        'surface-container-lowest': '#0e0e0e',

        // === PRIMARY (Bitcoin Orange) ===
        primary: '#ffb874',
        'primary-container': '#f7931a',
        'on-primary': '#4b2800',
        'on-primary-container': '#603500',
        'primary-fixed': '#ffdcbf',
        'on-primary-fixed': '#2d1600',
        'on-primary-fixed-variant': '#6b3b00',

        // === TERTIARY (Success/Status) ===
        tertiary: '#86cfff',
        'tertiary-container': '#00b6fe',
        'on-tertiary': '#00344c',
        'on-tertiary-container': '#004462',

        // === SECONDARY ===
        secondary: '#f5bb86',
        'secondary-container': '#684016',
        'on-secondary': '#4b2800',
        'on-secondary-container': '#e6ad79',

        // === NEUTRALS ===
        'on-surface': '#e5e2e1',
        'on-surface-variant': '#dbc2ae',
        outline: '#a38d7b',
        'outline-variant': '#554335',

        // === SEMANTIC ===
        error: '#ffb4ab',
        'error-container': '#93000a',
        'on-error': '#690005',

        // Legacy aliases (for compatibility)
        success: '#86cfff', // Use tertiary instead
        danger: '#ffb4ab', // Use error instead
        warning: '#f5bb86', // Use secondary instead
      },
      fontFamily: {
        headline: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.75rem', // Heavy feel for buttons
      },
      boxShadow: {
        'glow-orange': '0 0 40px 0 rgba(247, 147, 26, 0.15)',
        'glow-cyan': '0 0 20px 0 rgba(0, 182, 254, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
        'lightning-pulse': 'lightningPulse 1.5s linear infinite',
        'status-pulse': 'statusPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        lightningPulse: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        statusPulse: {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(0, 182, 254, 0.4)',
          },
          '50%': {
            boxShadow: '0 0 20px 10px rgba(0, 182, 254, 0)',
          },
        },
      },
    },
  },
  plugins: [],
};
