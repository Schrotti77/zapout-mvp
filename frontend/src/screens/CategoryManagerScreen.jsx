/**
 * CategoryManagerScreen - CRUD for POS product categories
 *
 * Features:
 * - List all categories with product counts
 * - Create new category
 * - Edit category (name, icon, color)
 * - Delete category (products keep category name)
 * - Drag to reorder (future)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Design tokens
const surface = '#131313';
const surfaceContainerLow = '#1C1B1B';
const surfaceContainerHigh = '#2A2A2A';
const surfaceContainerHighest = '#353534';
const primary = '#f7931a';
const onSurface = '#e5e2e1';
const onSurfaceVariant = '#dbc2ae';
const error = '#f44336';

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
  marginBottom: '24px',
};

const cardStyle = {
  backgroundColor: surfaceContainerLow,
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const iconButtonStyle = {
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '24px',
  cursor: 'pointer',
  flexShrink: 0,
};

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  backgroundColor: surfaceContainerHigh,
  border: '1px solid #333',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '16px',
  outline: 'none',
  marginBottom: '12px',
};

// Preset icons for quick selection
const PRESET_ICONS = ['🍽️', '☕', '🍺', '🍕', '🎫', '🎁', '📦', '🛒', '🍴', '🚗', '🎮', '📱'];

// Preset colors
const PRESET_COLORS = [
  '#f7931a',
  '#22c55e',
  '#3b82f6',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#eab308',
];

export default function CategoryManagerScreen({ onBack }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#f7931a');
  const [saving, setSaving] = useState(false);

  // Load categories
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('zapout_token');
    try {
      const res = await fetch(`${API_URL}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setIcon('📦');
    setColor('#f7931a');
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleEdit = cat => {
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(cat.icon || '📦');
    setColor(cat.color || '#f7931a');
    setShowForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    const token = localStorage.getItem('zapout_token');

    try {
      const url = editingCategory
        ? `${API_URL}/categories/${editingCategory.id}`
        : `${API_URL}/categories`;
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), icon, color }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to save category');
      }

      resetForm();
      loadCategories();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async cat => {
    if (!confirm(`Kategorie "${cat.name}" löschen? Produkte behalten ihren Namen.`)) return;

    const token = localStorage.getItem('zapout_token');
    try {
      const res = await fetch(`${API_URL}/categories/${cat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete category');
      loadCategories();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={containerStyle}>
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
          <span style={{ fontSize: '18px', fontWeight: '600' }}>Kategorien</span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: primary,
            color: '#000',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          + Neu
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            backgroundColor: '#2a1a1a',
            border: `1px solid ${error}`,
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '16px',
            color: error,
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Category Form Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) resetForm();
          }}
        >
          <div
            style={{
              backgroundColor: surfaceContainerLow,
              borderRadius: '24px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
            }}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
              {editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Icon selector */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    color: onSurfaceVariant,
                    marginBottom: '8px',
                    display: 'block',
                  }}
                >
                  Icon
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PRESET_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      style={{
                        ...iconButtonStyle,
                        backgroundColor:
                          icon === ic ? surfaceContainerHighest : surfaceContainerHigh,
                        border: icon === ic ? `2px solid ${primary}` : '2px solid transparent',
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selector */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    color: onSurfaceVariant,
                    marginBottom: '8px',
                    display: 'block',
                  }}
                >
                  Farbe
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PRESET_COLORS.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setColor(col)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        border: color === col ? '3px solid #fff' : '2px solid transparent',
                        backgroundColor: col,
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Name input */}
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Kategoriename (z.B. Getränke)"
                style={inputStyle}
                autoFocus
              />

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid #333',
                    backgroundColor: 'transparent',
                    color: onSurface,
                    fontSize: '16px',
                    cursor: 'pointer',
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: saving ? '#666' : primary,
                    color: '#000',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? '...' : editingCategory ? 'Speichern' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>Laden...</div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
          <p>Keine Kategorien vorhanden</p>
          <p style={{ fontSize: '14px', color: '#555' }}>
            Erstelle Kategorien um deine Produkte zu organisieren
          </p>
        </div>
      ) : (
        <div>
          {categories.map(cat => (
            <div key={cat.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    ...iconButtonStyle,
                    backgroundColor: cat.color || surfaceContainerHigh,
                    fontSize: '24px',
                  }}
                >
                  {cat.icon || '📦'}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '500' }}>{cat.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Sortierung: {cat.sort_order || 0}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleEdit(cat)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    backgroundColor: 'transparent',
                    color: '#888',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #442222',
                    backgroundColor: 'transparent',
                    color: '#f44336',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
