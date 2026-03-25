import { useState, useEffect } from 'react';
import PaymentModal from './PaymentModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function CartDrawer({ isOpen, onClose, setScreen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handlePaymentStatusChange = status => {
    if (status === 'paid') {
      setShowPaymentModal(false);
    }
  };

  const getToken = () => localStorage.getItem('zapout_token');

  useEffect(() => {
    if (isOpen) fetchCart();
  }, [isOpen]);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async itemId => {
    const token = getToken();
    await fetch(`${API_URL}/cart/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchCart();
  };

  const clearCart = async () => {
    if (!confirm('Warenkorb leeren?')) return;
    const token = getToken();
    await fetch(`${API_URL}/cart`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchCart();
  };

  const checkout = async () => {
    setCheckingOut(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/cart/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCheckoutResult(data);
        setShowPaymentModal(true); // Show payment modal
        fetchCart(); // Refresh to show empty cart
      } else {
        alert('Fehler beim Checkout');
      }
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  const closeResult = () => {
    setCheckoutResult(null);
    onClose();
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setCheckoutResult(null);
    onClose();
  };

  const total = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: isOpen ? 'flex' : 'none',
      alignItems: 'flex-end',
    },
    drawer: {
      background: '#fff',
      width: '100%',
      maxHeight: '80vh',
      borderRadius: '20px 20px 0 0',
      padding: '20px',
      overflowY: 'auto',
      animation: 'slideUp 0.3s ease',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
    },
    title: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
    closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' },
    item: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #eee',
    },
    itemInfo: { flex: 1 },
    itemName: { fontWeight: 'bold', margin: 0 },
    itemPrice: { color: '#666', fontSize: '14px' },
    itemQty: { color: '#999', fontSize: '12px' },
    itemTotal: { fontWeight: 'bold', color: '#f7931a', marginRight: '12px' },
    delBtn: {
      background: '#fee',
      color: '#c00',
      border: 'none',
      padding: '8px',
      borderRadius: '8px',
      cursor: 'pointer',
    },
    total: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '20px',
      paddingTop: '20px',
      borderTop: '2px solid #eee',
    },
    totalLabel: { fontSize: '18px', fontWeight: 'bold' },
    totalValue: { fontSize: '24px', fontWeight: 'bold', color: '#f7931a' },
    checkoutBtn: {
      width: '100%',
      background: '#f7931a',
      color: '#fff',
      border: 'none',
      padding: '16px',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: '16px',
    },
    clearBtn: {
      background: '#666',
      color: '#fff',
      border: 'none',
      padding: '10px',
      borderRadius: '8px',
      cursor: 'pointer',
      marginTop: '10px',
      width: '100%',
    },
    empty: { textAlign: 'center', color: '#666', padding: '40px' },
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.drawer}>
        <div style={styles.header}>
          <h2 style={styles.title}>🛒 Warenkorb ({itemCount})</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <p>Laden...</p>
        ) : items.length === 0 ? (
          <div style={styles.empty}>
            <p>Dein Warenkorb ist leer 🛒</p>
          </div>
        ) : (
          <>
            {items.map(item => (
              <div key={item.id} style={styles.item}>
                <div style={styles.itemInfo}>
                  <p style={styles.itemName}>{item.name || 'Unbekannt'}</p>
                  <p style={styles.itemPrice}>
                    €{(item.price_cents / 100).toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <span style={styles.itemTotal}>
                  €{((item.price_cents * item.quantity) / 100).toFixed(2)}
                </span>
                <button style={styles.delBtn} onClick={() => removeItem(item.id)}>
                  🗑️
                </button>
              </div>
            ))}

            <div style={styles.total}>
              <span style={styles.totalLabel}>Gesamt</span>
              <span style={styles.totalValue}>€{(total / 100).toFixed(2)}</span>
            </div>

            <button style={styles.checkoutBtn} onClick={checkout} disabled={checkingOut}>
              {checkingOut ? 'Lädt...' : 'Zur Kasse →'}
            </button>

            {/* Checkout Success */}
            {checkoutResult && (
              <div style={{ ...styles.drawer, marginTop: '20px', background: '#f0fff4' }}>
                <h3 style={{ color: '#22c55e', marginTop: 0 }}>✅ Bestellung erstellt!</h3>
                <p>
                  <strong>Payment ID:</strong> #{checkoutResult.payment_id}
                </p>
                <p>
                  <strong>Betrag:</strong> €{(checkoutResult.amount_cents / 100).toFixed(2)} (
                  {checkoutResult.amount_sats} sats)
                </p>

                {checkoutResult.items && checkoutResult.items.length > 0 && (
                  <div style={{ margin: '10px 0' }}>
                    <strong>Produkte:</strong>
                    <ul style={{ margin: '5px 0' }}>
                      {checkoutResult.items.map((item, i) => (
                        <li key={i} style={{ fontSize: '14px' }}>
                          {item.name} × {item.quantity || item.qty}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  style={{
                    background: '#fff',
                    padding: '12px',
                    borderRadius: '8px',
                    marginTop: '10px',
                  }}
                >
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>
                    Zahle jetzt mit Lightning:
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {checkoutResult.invoice?.bolt11 ||
                      checkoutResult.invoice?.message ||
                      'Invoice wird erstellt...'}
                  </p>
                </div>

                <button
                  style={{ ...styles.checkoutBtn, background: '#22c55e', marginTop: '12px' }}
                  onClick={closeResult}
                >
                  ✓ Fertig
                </button>
              </div>
            )}
            <button style={styles.clearBtn} onClick={clearCart}>
              🗑️ Leeren
            </button>
          </>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && checkoutResult && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={closePaymentModal}
          orderData={checkoutResult}
          onStatusChange={handlePaymentStatusChange}
        />
      )}
    </div>
  );
}
