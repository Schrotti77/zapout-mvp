# UI Design System: Digital Sovereignty

## The Kinetic Vault

> **North Star:** Building a digital interface that feels as heavy, secure, and permanent as a physical POS terminal carved from obsidian.

This design system rejects the flimsy, "app-like" feel of standard fintech. We embrace **Tonal Depth** over borders, **Intentional Asymmetry**, and Bitcoin Orange "Light Leaks" to guide the eye.

---

## Table of Contents

1. [Color Palette](#1-color-palette)
2. [Typography](#2-typography)
3. [Elevation & Depth](#3-elevation--depth)
4. [Components](#4-components)
5. [Motion & Interaction](#5-motion--interaction)
6. [Do's and Don'ts](#6-dos-and-donts)
7. [Tailwind Configuration](#7-tailwind-configuration)

---

## 1. Color Palette

### Surface Tokens (Tonal Depth)

| Token                       | Hex     | Usage                       |
| --------------------------- | ------- | --------------------------- |
| `surface`                   | #131313 | Base screen background      |
| `surface-container-low`     | #1C1B1B | Content sections            |
| `surface-container`         | #201f1f | Container backgrounds       |
| `surface-container-high`    | #2A2A2A | Interactive cards           |
| `surface-container-highest` | #353534 | Keypad keys, tappable areas |
| `surface-bright`            | #393939 | QR container                |
| `surface-variant`           | #353534 | Modals, overlays            |
| `surface-container-lowest`  | #0e0e0e | Recessed input wells        |

### Primary (Bitcoin Orange)

| Token                      | Hex     | Usage                                  |
| -------------------------- | ------- | -------------------------------------- |
| `primary`                  | #ffb874 | Light accent                           |
| `primary-container`        | #f7931a | **Primary action, Bitcoin hero color** |
| `primary-fixed`            | #ffdcbf | Button backgrounds                     |
| `on-primary`               | #4b2800 | Text on primary                        |
| `on-primary-container`     | #603500 | Text on primary-container              |
| `on-primary-fixed`         | #2d1600 | Text on primary-fixed                  |
| `on-primary-fixed-variant` | #6b3b00 | Secondary text on fixed                |

### Tertiary (Success/Status)

| Token                   | Hex     | Usage                      |
| ----------------------- | ------- | -------------------------- |
| `tertiary`              | #86cfff | Success state              |
| `tertiary-container`    | #00b6fe | Pending/pulsing state      |
| `on-tertiary`           | #00344c | Text on tertiary           |
| `on-tertiary-container` | #004462 | Text on tertiary-container |

### Secondary

| Token                    | Hex     | Usage                       |
| ------------------------ | ------- | --------------------------- |
| `secondary`              | #f5bb86 | Secondary elements          |
| `secondary-container`    | #684016 | Active key states           |
| `on-secondary`           | #4b2800 | Text on secondary           |
| `on-secondary-container` | #e6ad79 | Text on secondary-container |

### Neutrals

| Token                | Hex     | Usage                       |
| -------------------- | ------- | --------------------------- |
| `on-surface`         | #e5e2e1 | **Primary text**            |
| `on-surface-variant` | #dbc2ae | Secondary labels            |
| `outline`            | #a38d7b | Borders (use sparingly)     |
| `outline-variant`    | #554335 | Ghost borders (15% opacity) |

### Semantic

| Token             | Hex     | Usage            |
| ----------------- | ------- | ---------------- |
| `error`           | #ffb4ab | Error state      |
| `error-container` | #93000a | Error background |
| `on-error`        | #690005 | Text on error    |

---

## 2. Typography

### Font Stack

```css
font-family: 'Manrope' /* Headlines, Display */ 'Inter'; /* Body, Labels */
```

### Scale

| Style       | Font    | Size      | Weight | Usage                  |
| ----------- | ------- | --------- | ------ | ---------------------- |
| Display-LG  | Manrope | 3.5rem    | 800    | Total Amount on keypad |
| Display-MD  | Manrope | 2.5rem    | 700    | Large numbers          |
| Headline-LG | Manrope | 1.75rem   | 700    | Section titles         |
| Headline-SM | Manrope | 1.5rem    | 700    | Transaction statuses   |
| Title-LG    | Manrope | 1.25rem   | 700    | Card titles            |
| Title-MD    | Manrope | 1rem      | 600    | List item titles       |
| Body-LG     | Inter   | 1rem      | 400    | Primary body text      |
| Body-MD     | Inter   | 0.875rem  | 400    | Transaction history    |
| Label-LG    | Inter   | 0.875rem  | 600    | Button labels          |
| Label-MD    | Inter   | 0.75rem   | 500    | Timestamps, metadata   |
| Label-SM    | Inter   | 0.6875rem | 500    | Tertiary labels        |

### Hierarchy Strategy

- Primary text: `on-surface` (#e5e2e1)
- Secondary labels: `on-surface-variant` (#dbc2ae)
- This creates dramatic contrast - merchant scans **value** before **label**

### Asymmetry Rule

- Right-align currency symbols
- Left-align digits
- Creates professional, editorial look

---

## 3. Elevation & Depth

### Tonal Stacking (No Shadows for Sectioning)

```
┌─────────────────────────────────────┐  surface: #131313 (base)
│  ┌─────────────────────────────┐    │  surface-container-low: #1C1B1B
│  │  Content Section            │    │
│  │  ┌─────────────────────┐   │    │  surface-container-high: #2A2A2A
│  │  │  Interactive Card   │   │    │
│  │  │  ┌───────────────┐  │   │    │  surface-container-highest: #353534
│  │  │  │  Keypad Key   │  │   │    │
│  │  │  └───────────────┘  │   │    │
│  │  └─────────────────────┘   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Ambient Shadows (For Floating Elements Only)

```css
/* Warm glow for QR codes, floating modals */
.glow-orange {
  box-shadow: 0 0 40px 0 rgba(247, 147, 26, 0.15);
}

/* Alternative: 40px blur, 0% spread, 8% opacity surface-tint */
box-shadow: 0 40px 40px 0 rgba(255, 184, 116, 0.08);
```

### Ghost Border (15% Opacity)

```css
/* For buttons needing definition against similar surface */
border: 1px solid rgba(255, 184, 116, 0.15); /* primary at 15% */
```

---

## 4. Components

### 4.1 Numeric Keypad

```html
<div class="grid grid-cols-3 gap-1 bg-surface p-4">
  <button class="bg-surface-container-highest ...">1</button>
  <button class="bg-surface-container-highest ...">2</button>
  <!-- ... -->
</div>
```

**Rules:**

- Background: `surface-container-highest` (#353534)
- Active state: `secondary-container` (#684016) - instant transition
- Typography: `Headline-LG` (Manrope, 700)
- No borders - `gap: 2px` lets `surface` color act as void
- Scale to 98% on press

### 4.2 QR Code Container

```html
<div class="bg-surface-bright p-4 glow-orange">
  <!-- QR with 10% Bitcoin Orange tint in dark modules -->
</div>
```

**Rules:**

- Background: `surface-bright` (#393939)
- Add subtle orange tint to QR dark modules
- Apply `.glow-orange` shadow class

### 4.3 Status Indicators

**Pending (Pulsing):**

```css
background: rgba(0, 182, 254, 0.15); /* tertiary-container */
animation: pulse 2s infinite;
```

**Success:**

```css
background: #f7931a; /* primary-container */
color: #603500; /* on-primary-container */
```

### 4.4 Input Fields

```html
<div class="bg-surface-container-lowest p-4 rounded-lg">
  <!-- Recessed well effect, no bottom line -->
  <input class="bg-transparent ..." />
</div>
```

**Rules:**

- Background: `surface-container-lowest` (#0e0e0e)
- No bottom lines
- Recessed "well" effect

### 4.5 Lists (Transaction History)

```html
<div class="space-y-6">
  <!-- 8px base × 0.75 = 6 -->
  <div class="flex justify-between items-baseline">
    <span class="title-md">€24.50</span>
    <span class="label-sm text-on-surface-variant">14:32</span>
  </div>
</div>
```

**Rules:**

- **No dividers** - use spacing scale
- Amount: `title-md` with `on-surface`
- Timestamp: `label-sm` with `on-surface-variant`
- Create vertical rhythm through spacing

### 4.6 Action Buttons

**Primary:**

```html
<button class="bg-primary-container text-on-primary-container rounded-xl ...">Pay</button>
```

**Primary Gradient (Signature Texture):**

```css
background: linear-gradient(135deg, #ffb874 0%, #f7931a 100%);
```

**Secondary:**

```html
<button class="bg-surface-container-highest border border-primary/20 ...">Cancel</button>
```

**Rules:**

- Primary: `primary-container` bg, `xl` corner radius (0.75rem)
- Secondary: `surface-container-highest` + Ghost Border (primary 20%)

### 4.7 Modals (Glass Effect)

```html
<div class="bg-surface-variant/80 backdrop-blur-xl ...">
  <!-- Glass modal for invoice popup -->
</div>
```

**Rules:**

- Opacity: 80%
- Backdrop blur: 20px
- Background: `surface-variant` (#353534)

---

## 5. Motion & Interaction

### Haptic Mimicry

```css
button:active {
  transform: scale(0.98);
  transition: transform 150ms ease-out;
}
```

### Lightning Pulse (Broadcasting)

```css
@keyframes lightning-pulse {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.broadcasting {
  background: linear-gradient(
    90deg,
    surface-container-high 0%,
    rgba(247, 147, 26, 0.1) 50%,
    surface-container-high 100%
  );
  background-size: 200% 100%;
  animation: lightning-pulse 1.5s linear infinite;
}
```

### Status Transitions

```css
.pending {
  animation: pulse-glow 2s ease-in-out infinite;
}

.success {
  transition: all 300ms ease-out;
  background: #f7931a;
}
```

---

## 6. Do's and Don'ts

### ✅ Do

- Use **asymmetrical layouts** (currency right, digits left)
- Use `surface-container-highest` for tappable areas
- Prioritize **breathing room** (16px/4rem padding for main containers)
- Use **Bitcoin colors** (orange) for success states
- Let `on-surface-variant` create hierarchy contrast

### ❌ Don't

- Use **pure white** (#FFFFFF) - use `on-surface` (#e5e2e1)
- Use **standard "Success Green"** - use tertiary (#86CFFF) or primary palette
- Use **1px borders** to separate list items - use spacing
- Use **borders for sectioning** - use tonal shifts
- Use **fixed grids** - embrace intentional asymmetry

---

## 7. Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: '#131313',
        'surface-container-low': '#1C1B1B',
        'surface-container': '#201f1f',
        'surface-container-high': '#2A2A2A',
        'surface-container-highest': '#353534',
        'surface-bright': '#393939',
        'surface-variant': '#353534',
        'surface-container-lowest': '#0e0e0e',

        // Primary (Bitcoin Orange)
        primary: '#ffb874',
        'primary-container': '#f7931a',
        'on-primary': '#4b2800',
        'on-primary-container': '#603500',

        // Tertiary (Success/Status)
        tertiary: '#86cfff',
        'tertiary-container': '#00b6fe',

        // Neutrals
        'on-surface': '#e5e2e1',
        'on-surface-variant': '#dbc2ae',
        outline: '#a38d7b',
        'outline-variant': '#554335',

        // Error
        error: '#ffb4ab',
        'error-container': '#93000a',
      },
      fontFamily: {
        headline: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.75rem', // Heavy feel for buttons
      },
      boxShadow: {
        'glow-orange': '0 0 40px 0 rgba(247, 147, 26, 0.15)',
      },
    },
  },
};
```

### CSS Utilities

```css
/* Glass modal effect */
.glass {
  background: rgba(53, 53, 52, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* Ghost border */
.ghost-border {
  border: 1px solid rgba(255, 184, 116, 0.15);
}

/* Primary gradient button */
.btn-primary {
  background: linear-gradient(135deg, #ffb874 0%, #f7931a 100%);
  color: #603500;
}

/* Lightning pulse animation */
@keyframes lightning-pulse {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Status glow */
.status-pending {
  box-shadow: 0 0 20px 0 rgba(0, 182, 254, 0.3);
  animation: pulse 2s ease-in-out infinite;
}
```

---

## Implementation Checklist

- [ ] Update Tailwind config with color tokens
- [ ] Add Manrope + Inter fonts
- [ ] Create `glass` utility class
- [ ] Create `glow-orange` utility class
- [ ] Create `ghost-border` utility class
- [ ] Redesign POSScreen Keypad
- [ ] Redesign QR Code container
- [ ] Redesign Transaction List
- [ ] Add status indicator animations
- [ ] Test on mobile viewport

---

_Last updated: 2026-03-19_
