// Theme configuration for Tailwind CSS
// ZapOut Design System

export const theme = {
  // Colors
  colors: {
    primary: '#f7931a', // Bitcoin orange
    primaryDark: '#e8820a',
    primaryLight: '#fff3e0',

    background: '#0a0a0a', // Dark mode
    surface: '#141414',
    surfaceLight: '#1f1f1f',
    border: '#262626',

    text: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',

    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },

  // Spacing (8px grid)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  // Border radius
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  // Layout
  layout: {
    maxWidth: '480px',
    headerHeight: '56px',
    navHeight: '64px',
    padding: '16px',
  },
};

// Tailwind theme extension for index.css
export const tailwindTheme = `
@theme {
  --color-primary: #f7931a;
  --color-primary-dark: #e8820a;
  --color-primary-light: #fff3e0;

  --color-bg: #0a0a0a;
  --color-surface: #141414;
  --color-surface-light: #1f1f1f;
  --color-border: #262626;

  --color-text: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;

  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
}
`;

export default theme;
