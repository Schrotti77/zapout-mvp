import { useState, useEffect } from 'react';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '../hooks/useProducts';
import { api } from '../lib/api.js';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorAlert } from '../components/ui/ErrorBanner';
import { getErrorMessage } from '../lib/api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  // React Query hooks
  const { data: products = [], isLoading, error, refetch } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [customCategory, setCustomCategory] = useState('');
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_cents: '',
    category: 'Getränke',
    image_url: '',
    active: true,
    vat_rate: 19,
  });

  const handleSubmit = async e => {
    e.preventDefault();
    setFormError(null);
    const priceCents = Math.round(parseFloat(form.price_cents) * 100);
    const payload = { ...form, price_cents: priceCents };

    try {
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, ...payload });
      } else {
        await createProduct.mutateAsync(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({
        name: '',
        description: '',
        price_cents: '',
        category: 'Allgemein',
        image_url: '',
        active: true,
        vat_rate: 19,
      });
    } catch (err) {
      setFormError(err);
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
      vat_rate: product.vat_rate || 19,
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async id => {
    if (!confirm('Produkt löschen?')) return;
    try {
      await deleteProduct.mutateAsync(id);
    } catch (err) {
      setFormError(err);
    }
  };

  const handleAddToCart = async product => {
    const token = localStorage.getItem('zapout_token');
    if (!token) {
      alert('Bitte einloggen!');
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
      alert('Fehler: ' + err.message);
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

            {/* MwSt Satz */}
            <label
              style={{ color: '#888', fontSize: '12px', marginBottom: '4px', display: 'block' }}
            >
              MwSt-Satz
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {[0, 7, 19].map(rate => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setForm({ ...form, vat_rate: rate })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: form.vat_rate === rate ? '2px solid #f7931a' : '1px solid #333',
                    backgroundColor: form.vat_rate === rate ? '#1a1a1a' : '#0a0a0a',
                    color: form.vat_rate === rate ? '#f7931a' : '#666',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {rate === 0 ? '0% (befreit)' : rate === 7 ? '7% (ermäßigt)' : '19% (normal)'}
                </button>
              ))}
            </div>

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

          {formError && (
            <ErrorAlert error={formError} message={getErrorMessage(formError)} className="mb-4" />
          )}

          <button
            type="submit"
            style={{
              ...buttonStyle,
              opacity: createProduct.isPending || updateProduct.isPending ? 0.7 : 1,
            }}
            disabled={createProduct.isPending || updateProduct.isPending}
          >
            {createProduct.isPending || updateProduct.isPending
              ? '⏳ Speichert...'
              : editingId
                ? '💾 Speichern'
                : '➕ Erstellen'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#666666', fontSize: '14px' }}>{products.length} Produkte</span>
          <button
            onClick={() => setScreen && setScreen('categories')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #333',
              backgroundColor: 'transparent',
              color: '#888',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            📂 Kategorien
          </button>
        </div>
      </div>

      {/* Add Button */}
      <button onClick={() => setShowForm(true)} style={buttonStyle}>
        ➕ Neues Produkt
      </button>

      {isLoading && (
        <div style={{ marginTop: '20px' }}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      )}

      {!isLoading && error && (
        <ErrorAlert
          error={error}
          message={getErrorMessage(error)}
          onRetry={refetch}
          className="mt-4"
        />
      )}

      {!isLoading && !error && products.length === 0 && (
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
                  disabled={deleteProduct.isPending}
                  style={{
                    ...buttonSmallStyle,
                    backgroundColor: '#7f1d1d',
                    color: '#fca5a5',
                    opacity: deleteProduct.isPending ? 0.7 : 1,
                  }}
                >
                  {deleteProduct.isPending ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Global error - handled by isLoading check above */}
    </div>
  );
}
