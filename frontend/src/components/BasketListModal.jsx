import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const modalStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px',
};

const contentStyle = {
  backgroundColor: '#1a1a1a',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '500px',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = {
  padding: '20px',
  borderBottom: '1px solid #333',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const titleStyle = {
  color: '#fff',
  fontSize: '18px',
  fontWeight: '600',
  margin: 0,
};

const closeButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#888',
  fontSize: '24px',
  cursor: 'pointer',
  padding: '4px 8px',
};

const bodyStyle = {
  padding: '20px',
  overflow: 'auto',
  flex: 1,
};

const basketCardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
};

const basketNameStyle = {
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '8px',
};

const basketInfoStyle = {
  color: '#888',
  fontSize: '14px',
  marginBottom: '4px',
};

const buttonRowStyle = {
  display: 'flex',
  gap: '8px',
  marginTop: '12px',
};

const primaryButtonStyle = {
  flex: 1,
  backgroundColor: '#f7931a',
  color: '#000',
  border: 'none',
  padding: '10px 16px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
};

const dangerButtonStyle = {
  backgroundColor: '#dc2626',
  color: '#fff',
  border: 'none',
  padding: '10px 16px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
};

const emptyStyle = {
  textAlign: 'center',
  color: '#666',
  padding: '40px 20px',
  fontSize: '14px',
};

export default function BasketListModal({ onClose, onLoadBasket, cartItems = [], cartTotal = 0 }) {
  const [baskets, setBaskets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [basketName, setBasketName] = useState('');
  const [saving, setSaving] = useState(false);

  const getToken = () => localStorage.getItem('zapout_token');

  useEffect(() => {
    fetchBaskets();
  }, []);

  const fetchBaskets = async () => {
    try {
      const res = await fetch(`${API_URL}/baskets`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBaskets(data.baskets || []);
      }
    } catch (err) {
      console.error('Failed to fetch baskets:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveBasket = async () => {
    if (!basketName.trim() || cartItems.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/baskets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: basketName.trim(),
          items: cartItems,
          total_cents: cartTotal,
        }),
      });
      if (res.ok) {
        setBasketName('');
        setShowSaveForm(false);
        fetchBaskets();
      }
    } catch (err) {
      console.error('Failed to save basket:', err);
    } finally {
      setSaving(false);
    }
  };

  const loadBasket = async basketId => {
    try {
      const res = await fetch(`${API_URL}/baskets/${basketId}/load`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        onLoadBasket(data.items, data.total_cents);
        onClose();
      }
    } catch (err) {
      console.error('Failed to load basket:', err);
    }
  };

  const deleteBasket = async basketId => {
    if (!confirm('Warenkorb wirklich löschen?')) return;
    try {
      const res = await fetch(`${API_URL}/baskets/${basketId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        fetchBaskets();
      }
    } catch (err) {
      console.error('Failed to delete basket:', err);
    }
  };

  const formatDate = dateStr => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatPrice = cents => {
    return `${(cents / 100).toFixed(2)} €`;
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Gespeicherte Warenkörbe</h2>
          <button style={closeButtonStyle} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={bodyStyle}>
          {/* Save Current Cart Button */}
          {cartItems.length > 0 && !showSaveForm && (
            <button
              style={{ ...primaryButtonStyle, marginBottom: '16px' }}
              onClick={() => setShowSaveForm(true)}
            >
              💾 Aktuellen Warenkorb speichern ({formatPrice(cartTotal)})
            </button>
          )}

          {/* Save Form */}
          {showSaveForm && (
            <div style={{ ...basketCardStyle, marginBottom: '16px' }}>
              <div style={{ color: '#fff', fontSize: '14px', marginBottom: '12px' }}>
                Warenkorb speichern als:
              </div>
              <input
                type="text"
                placeholder="z.B. Stammtisch, Tisch 3, Kaffee-Special..."
                value={basketName}
                onChange={e => setBasketName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  marginBottom: '12px',
                  boxSizing: 'border-box',
                }}
              />
              <div style={buttonRowStyle}>
                <button
                  style={{ ...dangerButtonStyle, flex: 1, backgroundColor: '#333' }}
                  onClick={() => setShowSaveForm(false)}
                >
                  Abbrechen
                </button>
                <button
                  style={{ ...primaryButtonStyle, flex: 1 }}
                  onClick={saveBasket}
                  disabled={saving || !basketName.trim()}
                >
                  {saving ? 'Speichern...' : '💾 Speichern'}
                </button>
              </div>
            </div>
          )}

          {/* Basket List */}
          {loading ? (
            <div style={emptyStyle}>Lädt...</div>
          ) : baskets.length === 0 ? (
            <div style={emptyStyle}>
              Keine gespeicherten Warenkörbe.
              <br />
              <br />
              Füge Produkte zum Warenkorb hinzu und speichere ihn hier.
            </div>
          ) : (
            baskets.map(basket => (
              <div key={basket.id} style={basketCardStyle}>
                <div style={basketNameStyle}>🧺 {basket.name}</div>
                <div style={basketInfoStyle}>
                  {basket.items.length} Artikel · {formatPrice(basket.total_cents)}
                </div>
                <div style={basketInfoStyle}>Zuletzt: {formatDate(basket.updated_at)}</div>
                <div style={buttonRowStyle}>
                  <button style={primaryButtonStyle} onClick={() => loadBasket(basket.id)}>
                    ↩️ Laden
                  </button>
                  <button style={dangerButtonStyle} onClick={() => deleteBasket(basket.id)}>
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
