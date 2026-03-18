import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

const cardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '20px',
};

const cardSmallStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '12px',
};

const inputStyle = {
  width: '100%',
  padding: '14px',
  backgroundColor: '#0a0a0a',
  border: '1px solid #333333',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '16px',
  outline: 'none',
  marginBottom: '12px',
};

const buttonStyle = {
  width: '100%',
  backgroundColor: '#f7931a',
  color: '#000000',
  border: 'none',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  marginTop: '8px',
};

const buttonSecondaryStyle = {
  width: '100%',
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #333333',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '500',
  cursor: 'pointer',
  marginTop: '8px',
};

const buttonSmallStyle = {
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  border: 'none',
};

const PREDEFINED_CATEGORIES = [
  'Getränke',
  'Kaffee',
  'Essen',
  'Snacks',
  'Süssigkeiten',
  'Merchandise',
  'Dienstleistungen',
  'Sonstiges',
];

export default function Products({ onBack, setScreen, setCartOpen }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [customCategory, setCustomCategory] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_cents: '',
    category: 'Getränke',
    image_url: '',
    active: true,
  });

  const getToken = () => localStorage.getItem('zapout_token');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      setError('Bitte zuerst einloggen!');
      return;
    }
    const priceCents = Math.round(parseFloat(form.price_cents) * 100);

    const payload = { ...form, price_cents: priceCents };

    try {
      const url = editingId ? `${API_URL}/products/${editingId}` : `${API_URL}/products`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({
          name: '',
          description: '',
          price_cents: '',
          category: 'Allgemein',
          image_url: '',
          active: true,
        });
        fetchProducts();
      } else {
        setError('Fehler beim Speichern');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = product => {
    setForm({
      name: product.name,
      description: product.description || '',
      price_cents: (product.price_cents / 100).toFixed(2),
      category: product.category || 'Allgemein',
      image_url: product.image_url || '',
      active: product.active,
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async id => {
    if (!confirm('Produkt löschen?')) return;
    const token = getToken();
    try {
      await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddToCart = async product => {
    const token = getToken();
    if (!token) {
      setError('Bitte einloggen!');
      return;
    }
    try {
      await fetch(`${API_URL}/cart/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: product.id,
          quantity: 1,
        }),
      });
      // Show success
      const btn = document.getElementById(`cart-btn-${product.id}`);
      if (btn) {
        btn.textContent = '✅';
        setTimeout(() => (btn.textContent = '🛒'), 1500);
      }
    } catch (err) {
      setError('Fehler: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setCustomCategory('');
    setForm({
      name: '',
      description: '',
      price_cents: '',
      category: 'Getränke',
      image_url: '',
      active: true,
    });
  };

  // ===== VIEW: Product Form =====
  if (showForm) {
    return (
      <div style={{ padding: '20px', paddingBottom: '100px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '20px' }}>
          {editingId ? '✏️ Produkt bearbeiten' : '➕ Neues Produkt'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={cardStyle}>
            <label
              style={{ display: 'block', color: '#666666', fontSize: '12px', marginBottom: '8px' }}
            >
              Produktname *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
              placeholder="z.B. Kaffee"
              required
            />

            <label
              style={{
                display: 'block',
                color: '#666666',
                fontSize: '12px',
                marginBottom: '8px',
                marginTop: '4px',
              }}
            >
              Beschreibung
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              placeholder="Optional..."
              rows={2}
            />

            <label
              style={{
                display: 'block',
                color: '#666666',
                fontSize: '12px',
                marginBottom: '8px',
                marginTop: '4px',
              }}
            >
              Preis (€) *
            </label>
            <input
              type="number"
              value={form.price_cents}
              onChange={e => setForm({ ...form, price_cents: e.target.value })}
              step="0.01"
              style={inputStyle}
              placeholder="2.50"
              required
            />

            <label
              style={{
                display: 'block',
                color: '#666666',
                fontSize: '12px',
                marginBottom: '8px',
                marginTop: '4px',
              }}
            >
              Kategorie
            </label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {PREDEFINED_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="__custom__">+ Eigene Kategorie...</option>
            </select>

            {form.category === '__custom__' && (
              <input
                type="text"
                value={customCategory}
                onChange={e => {
                  setCustomCategory(e.target.value);
                  setForm({ ...form, category: e.target.value });
                }}
                style={inputStyle}
                placeholder="Kategoriename eingeben"
                autoFocus
              />
            )}

            <label
              style={{
                display: 'block',
                color: '#666666',
                fontSize: '12px',
                marginBottom: '8px',
                marginTop: '4px',
              }}
            >
              Bild-URL
            </label>
            <input
              type="text"
              value={form.image_url}
              onChange={e => setForm({ ...form, image_url: e.target.value })}
              style={inputStyle}
              placeholder="https://..."
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                style={{ width: '20px', height: '20px', accentColor: '#f7931a' }}
              />
              <label htmlFor="active" style={{ color: '#ffffff', fontSize: '14px' }}>
                Aktiv
              </label>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#7f1d1d',
                borderRadius: '12px',
                marginBottom: '16px',
              }}
            >
              <p style={{ color: '#fca5a5', fontSize: '14px' }}>{error}</p>
            </div>
          )}

          <button type="submit" style={buttonStyle}>
            {editingId ? '💾 Speichern' : '➕ Erstellen'}
          </button>

          <button type="button" onClick={resetForm} style={buttonSecondaryStyle}>
            Abbrechen
          </button>
        </form>
      </div>
    );
  }

  // ===== VIEW: Product List =====
  return (
    <div style={{ padding: '20px', paddingBottom: '100px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>🛍️ Produkte</h2>
        <span style={{ color: '#666666', fontSize: '14px' }}>{products.length} Produkte</span>
      </div>

      {/* Add Button */}
      <button onClick={() => setShowForm(true)} style={buttonStyle}>
        ➕ Neues Produkt
      </button>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666666' }}>⏳ Lädt...</div>
      )}

      {!loading && products.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</p>
          <p style={{ color: '#666666', fontSize: '16px' }}>Noch keine Produkte</p>
          <p style={{ color: '#444444', fontSize: '14px', marginTop: '8px' }}>
            Erstell dein erstes Produkt!
          </p>
        </div>
      )}

      {/* Product List */}
      <div style={{ marginTop: '20px' }}>
        {products.map(product => (
          <div key={product.id} style={cardSmallStyle}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontWeight: '600', color: '#ffffff', fontSize: '16px' }}>
                    {product.name}
                  </h4>
                  {product.category && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        backgroundColor: '#1f1f1f',
                        borderRadius: '4px',
                        color: '#f7931a',
                      }}
                    >
                      {product.category}
                    </span>
                  )}
                  {!product.active && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        backgroundColor: '#333',
                        borderRadius: '4px',
                        color: '#666',
                      }}
                    >
                      Inaktiv
                    </span>
                  )}
                </div>
                {product.description && (
                  <p style={{ fontSize: '14px', color: '#666666', marginTop: '4px' }}>
                    {product.description}
                  </p>
                )}
                <p
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#f7931a',
                    marginTop: '8px',
                  }}
                >
                  {(product.price_cents / 100).toFixed(2)} €
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  id={`cart-btn-${product.id}`}
                  onClick={() => handleAddToCart(product)}
                  style={{ ...buttonSmallStyle, backgroundColor: '#f7931a', color: '#000000' }}
                >
                  🛒
                </button>
                <button
                  onClick={() => handleEdit(product)}
                  style={{
                    ...buttonSmallStyle,
                    backgroundColor: '#1f1f1f',
                    color: '#ffffff',
                    border: '1px solid #333',
                  }}
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  style={{ ...buttonSmallStyle, backgroundColor: '#7f1d1d', color: '#fca5a5' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && !showForm && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#7f1d1d',
            borderRadius: '12px',
            marginTop: '16px',
          }}
        >
          <p style={{ color: '#fca5a5', fontSize: '14px' }}>{error}</p>
        </div>
      )}
    </div>
  );
}
