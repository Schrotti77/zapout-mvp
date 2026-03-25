/**
 * MintManagerScreen - Manage Cashu Mints
 * Phase 3.5 Task 5: Multi-Mint UI for managing different mints
 */

import { useState, useEffect } from 'react';
import { api, getErrorMessage } from '../lib/api.js';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorAlert } from '../components/ui/ErrorBanner';

const cardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '16px',
};

const cardSmallStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '12px',
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
  backgroundColor: '#f7931a',
  color: '#000000',
  border: 'none',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  width: '100%',
};

const buttonSmallStyle = {
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer',
  border: 'none',
};

const buttonSecondaryStyle = {
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #333333',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer',
};

export default function MintManagerScreen({ onBack, token }) {
  const [mints, setMints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMintUrl, setNewMintUrl] = useState('');
  const [newMintName, setNewMintName] = useState('');
  const [addError, setAddError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [mintChecks, setMintChecks] = useState({}); // Store keyset info per mint

  const loadMints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getUserMints();
      setMints(result.mints || []);

      // Check keysets for each mint
      const checks = {};
      for (const mint of result.mints || []) {
        try {
          const keyset = await api.getMintKeysets(mint.url);
          checks[mint.url] = keyset;
        } catch {
          checks[mint.url] = { reachable: false };
        }
      }
      setMintChecks(checks);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMints();
  }, []);

  const handleAddMint = async e => {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);

    try {
      await api.addUserMint(newMintUrl, newMintName);
      setNewMintUrl('');
      setNewMintName('');
      setShowAddForm(false);
      loadMints();
    } catch (e) {
      setAddError(e);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMint = async mintId => {
    if (!confirm('Mint entfernen?')) return;
    try {
      await api.deleteUserMint(mintId);
      loadMints();
    } catch (e) {
      setError(e);
    }
  };

  const handleActivateMint = async (mintId, active) => {
    try {
      await api.activateUserMint(mintId, active);
      loadMints();
    } catch (e) {
      setError(e);
    }
  };

  const handlePreferMint = async mintId => {
    try {
      await api.preferUserMint(mintId);
      loadMints();
    } catch (e) {
      setError(e);
    }
  };

  // ===== VIEW: Add Mint Form =====
  if (showAddForm) {
    return (
      <div style={{ padding: '20px', paddingBottom: '100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => setShowAddForm(false)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#f7931a',
              fontSize: '24px',
              cursor: 'pointer',
              marginRight: '12px',
            }}
          >
            ←
          </button>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>
            ➕ Mint hinzufügen
          </h2>
        </div>

        <form onSubmit={handleAddMint}>
          <div style={cardStyle}>
            <label
              style={{ display: 'block', color: '#666666', fontSize: '12px', marginBottom: '8px' }}
            >
              Mint URL *
            </label>
            <input
              type="url"
              value={newMintUrl}
              onChange={e => setNewMintUrl(e.target.value)}
              style={inputStyle}
              placeholder="https://testnut.cashu.space"
              required
            />

            <label
              style={{ display: 'block', color: '#666666', fontSize: '12px', marginBottom: '8px' }}
            >
              Name (optional)
            </label>
            <input
              type="text"
              value={newMintName}
              onChange={e => setNewMintName(e.target.value)}
              style={inputStyle}
              placeholder="Mein Mint"
            />
          </div>

          {addError && (
            <ErrorAlert error={addError} message={getErrorMessage(addError)} className="mb-4" />
          )}

          <button
            type="submit"
            disabled={isAdding}
            style={{ ...buttonStyle, opacity: isAdding ? 0.7 : 1 }}
          >
            {isAdding ? '⏳ Wird hinzugefügt...' : '➕ Mint hinzufügen'}
          </button>
        </form>
      </div>
    );
  }

  // ===== VIEW: Mint List =====
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
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>
          🏦 Mints verwalten
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          style={{ ...buttonSmallStyle, backgroundColor: '#f7931a', color: '#000000' }}
        >
          ➕ Hinzufügen
        </button>
      </div>

      {isLoading && (
        <div style={{ marginTop: '20px' }}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      )}

      {error && (
        <ErrorAlert
          error={error}
          message={getErrorMessage(error)}
          onRetry={loadMints}
          className="mt-4"
        />
      )}

      {!isLoading && !error && mints.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>🏦</p>
          <p style={{ color: '#666666', fontSize: '16px' }}>Noch keine Mints konfiguriert</p>
          <p style={{ color: '#444444', fontSize: '14px', marginTop: '8px' }}>
            Füge einen Mint hinzu, um Cashu Tokens zu empfangen
          </p>
        </div>
      )}

      {/* Mint List */}
      <div style={{ marginTop: '20px' }}>
        {mints.map(mint => (
          <div key={mint.id} style={cardSmallStyle}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}
                >
                  <h4 style={{ fontWeight: '600', color: '#ffffff', fontSize: '16px' }}>
                    {mint.name || mint.url}
                  </h4>
                  {mint.is_preferred && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        backgroundColor: '#f7931a',
                        borderRadius: '4px',
                        color: '#000000',
                      }}
                    >
                      ⭐ Preferred
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: '12px',
                    color: '#666666',
                    wordBreak: 'break-all',
                    marginBottom: '8px',
                  }}
                >
                  {mint.url}
                </p>

                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888888' }}>
                  <span>💰 {mint.balance || 0} sats</span>
                  <span>
                    {mintChecks[mint.url]?.reachable !== false ? '🟢' : '🔴'}{' '}
                    {mintChecks[mint.url]?.reachable !== false ? 'Erreichbar' : 'Nicht erreichbar'}
                  </span>
                </div>

                {mintChecks[mint.url]?.keysets && (
                  <p style={{ fontSize: '11px', color: '#666666', marginTop: '4px' }}>
                    Keyset: {mintChecks[mint.url].keysets[0]?.id?.substring(0, 16)}...
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {!mint.is_preferred && (
                  <button
                    onClick={() => handlePreferMint(mint.id)}
                    style={{ ...buttonSecondaryStyle, color: '#f7931a' }}
                    title="Als Standard setzen"
                  >
                    ⭐
                  </button>
                )}
                <button
                  onClick={() => handleActivateMint(mint.id, !mint.is_active)}
                  style={{
                    ...buttonSecondaryStyle,
                    color: mint.is_active ? '#f97316' : '#4ade80',
                  }}
                  title={mint.is_active ? 'Deaktivieren' : 'Aktivieren'}
                >
                  {mint.is_active ? '🔴' : '🟢'}
                </button>
                <button
                  onClick={() => handleDeleteMint(mint.id)}
                  style={{ ...buttonSecondaryStyle, backgroundColor: '#7f1d1d', color: '#fca5a5' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Add Section */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#666666', marginBottom: '12px' }}>
          Beliebte Mints
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { name: 'Testnut', url: 'https://testnut.cashu.space' },
            { name: '8333.space', url: 'https://8333.space:3338' },
            { name: 'Cashu.me', url: 'https://cashu.me/mint' },
          ]
            .filter(m => !mints.find(existing => existing.url === m.url))
            .map(mint => (
              <button
                key={mint.url}
                onClick={() => {
                  setNewMintUrl(mint.url);
                  setNewMintName(mint.name);
                  setShowAddForm(true);
                }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #333333',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                ➕ {mint.name}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
