import React from 'react';
import CartDrawer from '../CartDrawer';
import { useTranslation } from 'react-i18next';

// Consistent Layout for all screens - Dark Bitcoin Theme
const Layout = ({ children, title, screen, setScreen, cartOpen, setCartOpen, showNav = true }) => {
  const { t } = useTranslation();

  const navItems = [
    { screen: 'dashboard', icon: '💰', label: t('nav.home') },
    { screen: 'cashu', icon: '🪙', label: t('nav.cashu') },
    { screen: 'mint-manager', icon: '🏦', label: 'Mints' },
    { screen: 'token-history', icon: '📜', label: 'Historie' },
    { screen: 'swap', icon: '⚡', label: t('nav.swap') },
    { screen: 'merchant', icon: '🏪', label: t('nav.merchant') },
    { screen: 'products', icon: '🛍️', label: t('nav.products') },
    { screen: 'settings', icon: '⚙️', label: t('nav.settings') },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: '#0d0d0d',
          borderBottom: '1px solid #1a1a1a',
          padding: '16px',
          textAlign: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #f7931a, #ffa333)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {title || 'ZapOut'}
        </h1>
      </header>

      {/* Main Content */}
      <main
        style={{
          padding: '20px',
          paddingBottom: '100px',
          maxWidth: '480px',
          margin: '0 auto',
        }}
      >
        {children}
      </main>

      {/* Navigation */}
      {showNav && (
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#0d0d0d',
            borderTop: '1px solid #1a1a1a',
            display: 'flex',
            justifyContent: 'space-around',
            padding: '12px 4px',
            zIndex: 50,
          }}
        >
          {navItems.map(item => (
            <NavButton
              key={item.screen}
              icon={item.icon}
              label={item.label}
              active={screen === item.screen}
              onClick={() => setScreen(item.screen)}
            />
          ))}
          <NavButton icon="🛒" label={t('cart.title')} onClick={() => setCartOpen(true)} />
        </nav>
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} setScreen={setScreen} />
    </div>
  );
};

const NavButton = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'none',
      border: 'none',
      padding: '4px 8px',
      cursor: 'pointer',
      gap: '2px',
    }}
  >
    <span style={{ fontSize: '18px' }}>{icon}</span>
    <span
      style={{
        fontSize: '10px',
        color: active ? '#f7931a' : '#666666',
      }}
    >
      {label}
    </span>
  </button>
);

// Card component for consistent styling
export const ScreenCard = ({ children, className = '' }) => (
  <div
    style={{
      backgroundColor: '#141414',
      border: '1px solid #222222',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}
    className={className}
  >
    {children}
  </div>
);

// Section heading
export const SectionTitle = ({ children }) => (
  <h3
    style={{
      fontSize: '16px',
      fontWeight: '600',
      color: '#ffffff',
      marginTop: '24px',
      marginBottom: '12px',
    }}
  >
    {children}
  </h3>
);

// Page title
export const PageTitle = ({ children }) => (
  <h2
    style={{
      fontSize: '24px',
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: '20px',
    }}
  >
    {children}
  </h2>
);

// Badge variants
export const Badge = ({ children, variant = 'default' }) => {
  const styles = {
    default: { backgroundColor: '#2a2a2a', color: '#999999' },
    success: { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
    warning: { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
    error: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  };
  return (
    <span
      style={{
        ...styles[variant],
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '500',
      }}
    >
      {children}
    </span>
  );
};

export default Layout;
