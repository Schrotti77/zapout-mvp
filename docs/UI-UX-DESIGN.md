# ZapOut MVP - UI/UX Design System

> **Status:** Basis-Design implementiert (März 2026)
> **Version:** 1.0.0
> **Theme:** Dark Bitcoin Aesthetic

---

## Design-Prinzipien

1. **Dark Mode First** - Dunkles Theme als Standard (Bitcoin-Ästhetik)
2. **Consistency** - Einheitliche Farben, Buttons, Inputs auf allen Screens
3. **Simplicity** - Einfache, klare UI ohne Overload
4. **Bitcoin Orange** - Markenfarbe als Akzent (#f7931a)

---

## Farbpalette

### Primary Colors
| Name | Hex | Verwendung |
|------|-----|------------|
| Primary | `#f7931a` | Buttons, Links, Akzente |
| Primary Light | `#ffa333` | Hover-State |
| Primary Dark | `#e5820a` | Active-State |

### Background Colors
| Name | Hex | Verwendung |
|------|-----|------------|
| Background | `#0a0a0a` | App-Hintergrund |
| Surface | `#141414` | Cards, Container |
| Surface Light | `#1f1f1f` | Buttons, Input-Hintergrund |
| Border | `#222222` | Card-Ränder, Trennlinien |
| Border Light | `#2a2a2a` | Input-Ränder |

### Text Colors
| Name | Hex | Verwendung |
|------|-----|------------|
| Text Primary | `#ffffff` | Überschriften, wichtiger Text |
| Text Secondary | `#c0c0c0` | Body-Text |
| Text Muted | `#666666` | Platzhalter, Hinweise |

### Semantic Colors
| Name | Hex | Verwendung |
|------|-----|------------|
| Success | `#22c55e` | Erfolgreiche Aktionen |
| Warning | `#f59e0b` | Warnungen |
| Error | `#ef4444` | Fehler |

---

## Typography

### Font Family
- **System-Font:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto

### Font Sizes
| Element | Size | Weight |
|---------|------|--------|
| Page Title | 24px | 600 |
| Section Title | 16px | 600 |
| Card Title | 16px | 600 |
| Body | 14-16px | 400 |
| Small/Caption | 12px | 400 |
| Badge | 12px | 500 |

---

## Komponenten

### 1. Buttons

#### Primary Button
```css
background: linear-gradient(135deg, #f7931a 0%, #e5820a 100%);
color: #000000;
border-radius: 12px;
padding: 14px 24px;
font-size: 15px;
font-weight: 600;
box-shadow: 0 4px 12px rgba(247, 147, 26, 0.3);
```

**States:**
- Hover: Heller, mehr Schatten
- Active: Kein Schatten, leicht kleiner
- Disabled: 50% Opacity

#### Secondary Button
```css
background-color: #1f1f1f;
color: #ffffff;
border: 1px solid #333333;
border-radius: 12px;
padding: 14px 24px;
```

---

### 2. Input Fields
```css
width: 100%;
padding: 14px 16px;
background-color: #1a1a1a;
border: 1px solid #2a2a2a;
border-radius: 12px;
color: #ffffff;
font-size: 16px;
```

**States:**
- Focus: Orange Border (#f7931a) + Glow
- Placeholder: #666666

---

### 3. Cards
```css
background-color: #141414;
border: 1px solid #222222;
border-radius: 16px;
padding: 20px;
```

---

### 4. Navigation
- Fixed Bottom Navigation
- 7 Items: 💰 Zahlen | 🪙 Cashu | ⚡ Swap | 🏪 Händler | 🛍️ Produkte | ⚙️ Einst. | 🛒 Warenkorb
- Active: Primary Color (#f7931a)
- Inactive: #666666

---

## Screen Layout

### Standard Screen Structure
```
┌─────────────────────────────────┐
│         Header (Logo)           │  <- 56px, #0d0d0d bg
├─────────────────────────────────┤
│                                 │
│         Main Content            │  <- 20px padding, max-width 480px
│         (Screen-specific)        │
│                                 │
│                                 │
├─────────────────────────────────┤
│      Bottom Navigation Bar      │  <- Fixed, #0d0d0d bg
└─────────────────────────────────┘
```

---

## Screens

### 1. Register / Login
- Logo mit Gradient
- Email + Password Inputs
- Primary Button (Bitcoin Orange)

### 2. Dashboard (Zahlen)
- Today's Revenue Card
- Quick Amount Buttons (10€, 20€, 50€)
- Custom Amount Input
- Payment Request Button
- Recent Payments List

### 3. Cashu
- Balance Display (sats)
- Mint Quote Generator
- Quick Amount (100, 500, 1000 sats)
- Info Card about Cashu

### 4. Swap
- Swap Type Selector
- Amount Input
- Quick Amount Buttons

### 5. Merchant (Händler)
- Amount Input
- Quick Amount Buttons
- Payment Request Display (QR/Token)
- Status Display

### 6. Products (Produkte)
- Add Product Button
- Product Cards (Name, Description, Price, Actions)
- Product Form (Create/Edit)

### 7. Settings
- Account Info
- Logout Button

### 8. Cart (Drawer)
- Cart Items List
- Total Amount
- Checkout Button
- Clear Cart

---

## Dateien

### Frontend Struktur
```
frontend/
├── src/
│   ├── App.jsx                    # Main App mit Layout
│   ├── index.css                  # Global Styles + Theme
│   ├── components/
│   │   ├── CartDrawer.jsx         # Cart Modal
│   │   ├── PaymentModal.jsx       # Payment Modal
│   │   └── ui/
│   │       ├── Layout.jsx        # Layout Component
│   │       ├── Button.jsx        # Button Component
│   │       ├── Card.jsx          # Card Component
│   │       ├── Input.jsx         # Input Component
│   │       ├── Badge.jsx         # Badge Component
│   │       └── index.js          # Exports
│   ├── screens/
│   │   ├── MerchantScreen.jsx    # Merchant Payment
│   │   ├── SwapScreen.jsx        # Swap Interface
│   │   └── Products.jsx          # Product Management
│   └── theme/
│       └── index.js               # Theme Config
```

---

## To-Do / Verbesserungen

### Phase 1 - Quick Wins
- [ ] Animations verbessern (Page Transitions)
- [ ] Loading States für alle API-Calls
- [ ] Error States verbessern
- [ ] Leere States (no products, no payments)

### Phase 2 - UX
- [ ] Pull-to-Refresh
- [ ] Toast Notifications
- [ ] Better QR-Code Display
- [ ] Invoice Expiry Countdown

### Phase 3 - Features
- [ ] PWA Support
- [ ] i18n (Deutsch/English)
- [ ] Dark/Light Mode Toggle

---

## Nächste Schritte

1. **Testing** - Alle Screens auf Funktionalität prüfen
2. **Backend** - API Endpoints verifizieren
3. **Mobile** - Responsive Design testen
4. **Feedback** - User Feedback sammeln

---

*Erstellt: 2026-03-17*
*Letzte Änderung: 2026-03-17*
