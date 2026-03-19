import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import BasketListModal from '../components/BasketListModal';

const API_URL = 'http://localhost:8000';

// === DESIGN SYSTEM TOKENS (Digital Sovereignty - The Kinetic Vault) ===
const surface = '#131313';
const surfaceContainerLow = '#1C1B1B';
const surfaceContainerHigh = '#2A2A2A';
const surfaceContainerHighest = '#353534';
const primary = '#f7931a';
const primaryContainer = '#f7931a';
const onSurface = '#e5e2e1';
const onSurfaceVariant = '#dbc2ae';
const outline = '#554335';

const containerStyle = {
  minHeight: '100vh',
  backgroundColor: surface,
  color: onSurface,
  padding: '16px',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  padding: '12px 16px',
  backgroundColor: surfaceContainerLow,
  borderRadius: '16px',
  border: 'none', // No borders - tonal shifts only
};

const totalStyle = {
  fontSize: '24px',
  fontWeight: '700',
  color: primaryContainer,
  fontFamily: 'Manrope, system-ui, sans-serif',
};

const categoryBarStyle = {
  display: 'flex',
  gap: '8px',
  marginBottom: '16px',
  overflowX: 'auto',
  paddingBottom: '8px',
};

const categoryButton = active => ({
  padding: '10px 16px',
  borderRadius: '20px',
  border: 'none', // No borders
  backgroundColor: active ? surfaceContainerHigh : 'transparent',
  color: active ? primaryContainer : onSurfaceVariant,
  fontSize: '13px',
  fontWeight: active ? '600' : '400',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'Inter, system-ui, sans-serif',
});

const productGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '8px', // 2px void between keys per design system
  marginBottom: '16px',
};

const productButtonStyle = {
  aspectRatio: '1',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px',
  borderRadius: '12px',
  border: 'none', // Tonal depth, no borders
  backgroundColor: surfaceContainerHighest, // Closest to user
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
};

const productEmojiStyle = {
  fontSize: '32px',
  marginBottom: '4px',
};

const productNameStyle = {
  fontSize: '11px',
  color: '#ffffff',
  fontWeight: '500',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
};

const productPriceStyle = {
  fontSize: '13px',
  color: primaryContainer, // Bitcoin Orange
  fontWeight: '600',
  marginTop: '4px',
  fontFamily: 'Manrope, system-ui, sans-serif',
};

const cartStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: surfaceContainerLow, // Tonal depth
  borderTop: 'none', // No border - tonal shift
  padding: '16px',
  paddingBottom: '24px',
};

const cartItemsStyle = {
  maxHeight: '120px',
  overflowY: 'auto',
  marginBottom: '12px',
};

const cartItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: 'none', // No dividers - use spacing
  fontSize: '14px',
  color: onSurface,
};

const paymentButtonsStyle = {
  display: 'flex',
  gap: '12px',
};

const primaryButtonStyle = {
  flex: 1,
  padding: '16px',
  borderRadius: '12px',
  border: 'none',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const lightningButtonStyle = {
  ...primaryButtonStyle,
  // Bitcoin Orange Gradient per Design System
  background: 'linear-gradient(135deg, #ffb874 0%, #f7931a 100%)',
  color: '#603500', // on-primary-container
  boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
};

const cashuButtonStyle = {
  ...primaryButtonStyle,
  backgroundColor: surfaceContainerHighest,
  color: onSurface,
  // Ghost border - primary at 20%
  border: '1px solid rgba(255, 184, 116, 0.2)',
};

export default function POSScreen({ onBack }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [vatBreakdown, setVatBreakdown] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [btcPrice, setBtcPrice] = useState(null);
  const [tipPercent, setTipPercent] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [showBasketModal, setShowBasketModal] = useState(false);

  const tipOptions = [
    { label: '0%', value: 0 },
    { label: '+10%', value: 10 },
    { label: '+15%', value: 15 },
    { label: '+20%', value: 20 },
  ];

  // Fetch products
  useEffect(() => {
    const token = localStorage.getItem('zapout_token');
    fetch(`${API_URL}/products`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProducts(data.filter(p => p.active !== false));
        }
      })
      .catch(console.error);
  }, []);

  // Fetch BTC price
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur')
      .then(r => r.json())
      .then(data => {
        if (data.bitcoin?.eur) {
          setBtcPrice(data.bitcoin.eur);
        }
      })
      .catch(() => {
        // Fallback price if API fails
        setBtcPrice(50000);
      });
  }, []);

  const categories = ['all', ...new Set(products.map(p => p.category || 'Sonstiges'))];

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter(p => (p.category || 'Sonstiges') === selectedCategory);

  const totalCents = cart.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const tipCents = tipPercent > 0 ? Math.round((totalCents * tipPercent) / 100) : 0;
  const grandTotalCents = totalCents + tipCents;
  const totalSats = btcPrice ? Math.round((grandTotalCents / 100 / btcPrice) * 100000000) : 0;

  const addToCart = product => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price_cents: product.price_cents,
          quantity: 1,
          vat_rate: product.vat_rate || 19,
        },
      ];
    });
  };

  const removeFromCart = productId => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.product_id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prev.filter(item => item.product_id !== productId);
    });
  };

  const clearCart = () => {
    setCart([]);
    setTipPercent(0);
    setCustomTip('');
  };

  const handleLoadBasket = (items, total) => {
    setCart(items);
    // VAT breakdown will be recalculated via currentVatBreakdown
  };

  const formatPrice = cents => {
    return (cents / 100).toFixed(2) + ' €';
  };

  // Calculate VAT breakdown from cart items
  const calculateVatBreakdown = items => {
    const rates = {};
    items.forEach(item => {
      const rate = item.vat_rate || 19;
      const subtotal = item.price_cents * item.quantity;
      const net = Math.round(subtotal / (1 + rate / 100));
      const vat = subtotal - net;
      if (!rates[rate]) {
        rates[rate] = { net: 0, vat: 0, subtotal: 0 };
      }
      rates[rate].net += net;
      rates[rate].vat += vat;
      rates[rate].subtotal += subtotal;
    });
    return rates;
  };

  const currentVatBreakdown = calculateVatBreakdown(cart);

  const handlePayment = async method => {
    if (cart.length === 0) return;

    setLoading(true);
    setPaymentMethod(method);

    const token = localStorage.getItem('zapout_token');

    try {
      // Create payment request
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_cents: grandTotalCents,
          tip_cents: tipCents,
          currency: 'eur',
          method: method,
          items: cart,
        }),
      });

      const data = await response.json();
      setPaymentRequest(data);
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const closePayment = () => {
    setPaymentMethod(null);
    setPaymentRequest(null);
  };

  const completeSale = () => {
    // Add to cart in backend
    const token = localStorage.getItem('zapout_token');
    cart.forEach(async item => {
      await fetch(`${API_URL}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: item.product_id,
          quantity: item.quantity,
        }),
      });
    });

    // Clear local cart, tip and close payment modal
    clearCart();
    setTipPercent(0);
    setCustomTip('');
    closePayment();
  };

  const [tokenInput, setTokenInput] = useState('');
  const [tokenVerified, setTokenVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Verify/Swap Cashu token
  const verifyCashuToken = async () => {
    if (!tokenInput.trim()) return;

    setVerifying(true);
    const token = localStorage.getItem('zapout_token');

    try {
      // Use /cashu/swap which handles both trusted mints and auto-swap
      const response = await fetch(`${API_URL}/cashu/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          token: tokenInput.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTokenVerified(true);
        // Show swap info if applicable
        if (data.message && data.message.includes('Swapped')) {
          alert(`✅ ${data.message}`);
        }
      } else {
        alert(data.message || 'Token ist ungültig');
      }
    } catch (error) {
      console.error('Token verify/swap error:', error);
      alert('Token-Verifizierung fehlgeschlagen');
    } finally {
      setVerifying(false);
    }
  };

  // Cashu Payment View
  if (paymentMethod === 'cashu') {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>💰</div>
          <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
            {formatPrice(grandTotalCents)}
          </div>
          {tipCents > 0 && (
            <div style={{ fontSize: '14px', color: '#f7931a', marginBottom: '8px' }}>
              (inkl. Trinkgeld: +{formatPrice(tipCents)})
            </div>
          )}
          <div style={{ fontSize: '14px', color: '#666666', marginBottom: '24px' }}>
            {t('pos.payWithCashu') || 'Bezahle mit Cashu Token'}
          </div>

          {tokenVerified ? (
            <div style={{ color: '#22c55e', fontSize: '16px', marginBottom: '24px' }}>
              ✅ Token akzeptiert!
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: '350px', padding: '0 16px' }}>
              <textarea
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder={t('pos.tokenPlaceholder') || 'Cashu Token hier einfügen...'}
                style={{
                  width: '100%',
                  height: '120px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #333',
                  backgroundColor: '#141414',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  resize: 'none',
                  marginBottom: '16px',
                }}
              />
              <button
                onClick={verifyCashuToken}
                disabled={verifying || !tokenInput.trim()}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: verifying || !tokenInput.trim() ? '#333' : '#f7931a',
                  color: '#000000',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: verifying || !tokenInput.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {verifying ? '⏳ Prüfe Token...' : '✓ Token einlösen'}
              </button>
            </div>
          )}

          <div style={{ marginTop: '24px' }}>
            <button
              onClick={completeSale}
              disabled={!tokenVerified}
              style={{
                padding: '12px 24px',
                backgroundColor: tokenVerified ? '#22c55e' : '#333',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                cursor: tokenVerified ? 'pointer' : 'not-allowed',
              }}
            >
              {t('pos.completeSale') || 'Verkauf abschließen'}
            </button>
          </div>

          <button
            onClick={closePayment}
            style={{
              marginTop: '12px',
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#666666',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel') || 'Abbrechen'}
          </button>
        </div>
      </div>
    );
  }

  // Lightning Payment Modal
  if (paymentRequest) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚡</div>
          <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
            {formatPrice(grandTotalCents)}
          </div>
          {tipCents > 0 && (
            <div style={{ fontSize: '14px', color: '#f7931a', marginBottom: '8px' }}>
              (inkl. Trinkgeld: +{formatPrice(tipCents)})
            </div>
          )}
          <div style={{ fontSize: '14px', color: '#666666', marginBottom: '24px' }}>
            ₿ {totalSats.toLocaleString()} sats
          </div>

          {paymentRequest.bolt11 ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                marginBottom: '24px',
              }}
            >
              <QRCodeSVG value={paymentRequest.bolt11} size={200} level={'M'} />
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                marginBottom: '24px',
              }}
            >
              <QRCodeSVG
                value={paymentRequest.token || JSON.stringify(paymentRequest)}
                size={200}
                level={'M'}
              />
            </div>
          )}

          {paymentRequest.bolt11 && (
            <div
              style={{
                fontSize: '12px',
                color: '#666666',
                wordBreak: 'break-all',
                maxWidth: '300px',
                marginBottom: '24px',
              }}
            >
              {paymentRequest.bolt11.substring(0, 50)}...
            </div>
          )}

          <div style={{ color: '#22c55e', fontSize: '14px', marginBottom: '24px' }}>
            ⏳ Warten auf Bezahlung...
          </div>

          <button
            onClick={completeSale}
            style={{
              padding: '12px 24px',
              backgroundColor: '#222222',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {t('pos.manuallyCompleted') || 'Manuell als bezahlt markieren'}
          </button>

          <button
            onClick={closePayment}
            style={{
              marginTop: '12px',
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#666666',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel') || 'Abbrechen'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, paddingBottom: '200px' }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ←
          </button>
          <span style={{ fontSize: '18px', fontWeight: '600' }}>{t('pos.pos') || 'Kasse'}</span>
        </div>
        <div style={totalStyle}>{formatPrice(totalCents)}</div>
      </div>

      {/* Categories */}
      <div style={categoryBarStyle}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={categoryButton(selectedCategory === cat)}
          >
            {cat === 'all' ? '🍽️ Alle' : cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div style={productGridStyle}>
        {filteredProducts.map(product => (
          <button key={product.id} onClick={() => addToCart(product)} style={productButtonStyle}>
            <div style={productEmojiStyle}>
              {product.name.match(/[^\w\s]/) ? product.name.match(/[^\w\s]/)[0] : '📦'}
            </div>
            <div style={productNameStyle}>{product.name}</div>
            <div style={productPriceStyle}>{formatPrice(product.price_cents)}</div>
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            color: '#666666',
            padding: '40px',
          }}
        >
          {t('pos.noProducts') || 'Keine Produkte vorhanden'}
          <br />
          <button
            onClick={onBack}
            style={{
              marginTop: '16px',
              padding: '12px 24px',
              backgroundColor: '#f7931a',
              color: '#000000',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            {t('pos.addProducts') || 'Produkte hinzufügen'}
          </button>
        </div>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <div style={cartStyle}>
          <div style={cartItemsStyle}>
            {cart.map(item => (
              <div key={item.product_id} style={cartItemStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    style={{
                      backgroundColor: '#222222',
                      border: 'none',
                      color: '#ffffff',
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    -
                  </button>
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                </div>
                <div style={{ color: '#f7931a', fontWeight: '500' }}>
                  {formatPrice(item.price_cents * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{t('pos.total') || 'Gesamt'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '14px', color: '#666666' }}>
                ₿ {totalSats.toLocaleString()} sats
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#f7931a' }}>
                {formatPrice(grandTotalCents)}
              </div>
            </div>
          </div>

          {/* MwSt Breakdown */}
          {Object.keys(currentVatBreakdown).length > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px 0', borderTop: '1px solid #222' }}>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                inkl. MwSt:
              </div>
              {Object.entries(currentVatBreakdown).map(([rate, data]) => (
                <div
                  key={rate}
                  style={{
                    fontSize: '12px',
                    color: '#888',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{rate}% MwSt</span>
                  <span>{formatPrice(data.vat)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tip Buttons */}
          {cart.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>
                Trinkgeld (optional)
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {tipOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTipPercent(opt.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: tipPercent === opt.value ? '2px solid #f7931a' : '1px solid #333',
                      backgroundColor: tipPercent === opt.value ? '#1a1a1a' : '#0a0a0a',
                      color: tipPercent === opt.value ? '#f7931a' : '#666',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="€"
                  value={customTip}
                  onChange={e => {
                    setCustomTip(e.target.value);
                    setTipPercent(0);
                  }}
                  style={{
                    width: '60px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    backgroundColor: '#0a0a0a',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                {tipPercent > 0 && (
                  <span style={{ fontSize: '12px', color: '#f7931a', alignSelf: 'center' }}>
                    +{formatPrice(tipCents)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={paymentButtonsStyle}>
            <button
              onClick={() => handlePayment('lightning')}
              disabled={loading}
              style={lightningButtonStyle}
            >
              ⚡ Lightning
            </button>
            <button
              onClick={() => handlePayment('cashu')}
              disabled={loading}
              style={cashuButtonStyle}
            >
              💰 Cashu
            </button>
          </div>

          <button
            onClick={clearCart}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '8px',
              backgroundColor: 'transparent',
              color: '#666666',
              border: 'none',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {t('pos.clearCart') || 'Warenkorb leeren'}
          </button>

          <button
            onClick={() => setShowBasketModal(true)}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '8px',
              backgroundColor: '#1a1a1a',
              color: '#f7931a',
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            🧺 Gespeicherte Warenkörbe
          </button>
        </div>
      )}

      {/* Basket List Modal */}
      {showBasketModal && (
        <BasketListModal
          onClose={() => setShowBasketModal(false)}
          onLoadBasket={handleLoadBasket}
          cartItems={cart}
          cartTotal={grandTotalCents}
        />
      )}
    </div>
  );
}
