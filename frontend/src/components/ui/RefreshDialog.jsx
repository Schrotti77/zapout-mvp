/**
 * RefreshDialog - Cashu Token Refresh Dialog
 * Used when a mint has rotated keys and tokens need to be refreshed
 */

import { useState } from 'react';
import { api, getErrorMessage } from '../../lib/api.js';
import { ErrorAlert } from './ErrorBanner';

const cardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '20px',
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

const buttonSecondaryStyle = {
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #333333',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '500',
  cursor: 'pointer',
  width: '100%',
};

export function RefreshDialog({ isOpen, onClose, tokens, mintUrl, onSuccess }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [refreshResult, setRefreshResult] = useState(null);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const result = await api.refreshTokens(tokens, mintUrl);
      setRefreshResult(result);
    } catch (e) {
      setRefreshError(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSuccess = () => {
    if (onSuccess && refreshResult) {
      onSuccess(refreshResult.new_token);
    }
    onClose();
  };

  const totalAmount = tokens?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div style={{ ...cardStyle, width: '100%', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          🔄 Tokens aktualisieren
        </h2>

        <p style={{ color: '#888888', fontSize: '14px', marginBottom: '20px' }}>
          Der Mint hat seine Schlüssel gewechselt. Deine Tokens müssen aktualisiert werden, um
          weiterhin gültig zu bleiben.
        </p>

        {/* Token Summary */}
        <div
          style={{
            backgroundColor: '#0a0a0a',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666666' }}>Tokens:</span>
            <span style={{ color: '#ffffff' }}>{tokens?.length || 0}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666666' }}>Gesamtbetrag:</span>
            <span style={{ color: '#f7931a', fontWeight: '600' }}>{totalAmount} sats</span>
          </div>
        </div>

        {/* Refresh Button */}
        {!refreshResult && (
          <>
            {refreshError && (
              <ErrorAlert
                error={refreshError}
                message={getErrorMessage(refreshError)}
                className="mb-4"
              />
            )}

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{ ...buttonStyle, opacity: isRefreshing ? 0.7 : 1 }}
            >
              {isRefreshing ? '⏳ Tokens werden aktualisiert...' : '🔄 Tokens aktualisieren'}
            </button>
          </>
        )}

        {/* Refresh Result */}
        {refreshResult && (
          <>
            <div
              style={{
                backgroundColor: '#0a0a0a',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <p
                style={{
                  color: '#4ade80',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '8px',
                }}
              >
                Tokens erfolgreich aktualisiert!
              </p>
              <p style={{ color: '#666666', fontSize: '14px' }}>
                {refreshResult.total_amount} sats wurden mit neuen Schlüsseln versehen.
              </p>
            </div>

            <button onClick={handleSuccess} style={buttonStyle}>
              ✅ Tokens speichern
            </button>
          </>
        )}

        <button onClick={onClose} style={{ ...buttonSecondaryStyle, marginTop: '12px' }}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

export default RefreshDialog;
