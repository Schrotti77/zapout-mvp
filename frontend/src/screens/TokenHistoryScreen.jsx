/**
 * TokenHistoryScreen - Cashu Token History
 * Phase 3.5 Task 6: Show history of all token operations
 */

import { useState, useEffect } from 'react';
import { api, getErrorMessage } from '../lib/api.js';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorAlert } from '../components/ui/ErrorBanner';

const cardSmallStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
};

const actionColors = {
  mint: { bg: '#065f46', text: '#4ade80', icon: '🪙' },
  receive: { bg: '#1e40af', text: '#60a5fa', icon: '📥' },
  send: { bg: '#7c2d12', text: '#fb923c', icon: '📤' },
  split: { bg: '#4c1d95', text: '#c4b5fd', icon: '🔀' },
  melt: { bg: '#9f1239', text: '#fb7185', icon: '🔥' },
  refresh: { bg: '#1d4ed8', text: '#818cf8', icon: '🔄' },
};

export default function TokenHistoryScreen({ onBack, token }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const loadHistory = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getCashuHistory(LIMIT, currentOffset);
      const newHistory = result.history || [];
      if (reset) {
        setHistory(newHistory);
      } else {
        setHistory(prev => [...prev, ...newHistory]);
      }
      setHasMore(newHistory.length === LIMIT);
      setOffset(currentOffset + newHistory.length);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(true);
  }, []);

  const loadMore = () => {
    loadHistory(false);
  };

  const formatDate = dateStr => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const getActionLabel = action => {
    const labels = {
      mint: 'Mint',
      receive: 'Erhalten',
      send: 'Gesendet',
      split: 'Aufgeteilt',
      melt: 'Verbrannt',
      refresh: 'Aktualisiert',
    };
    return labels[action] || action;
  };

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
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>📜 Token Historie</h2>
        <span style={{ color: '#666666', fontSize: '14px' }}>{history.length} Einträge</span>
      </div>

      {isLoading && history.length === 0 && (
        <div style={{ marginTop: '20px' }}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      )}

      {error && (
        <ErrorAlert
          error={error}
          message={getErrorMessage(error)}
          onRetry={() => loadHistory(true)}
          className="mt-4"
        />
      )}

      {!isLoading && !error && history.length === 0 && (
        <div style={{ ...cardSmallStyle, textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>📜</p>
          <p style={{ color: '#666666', fontSize: '16px' }}>Noch keine Token-Aktionen</p>
          <p style={{ color: '#444444', fontSize: '14px', marginTop: '8px' }}>
            Deine Token-Historie wird hier erscheinen
          </p>
        </div>
      )}

      {/* History List */}
      <div style={{ marginTop: '20px' }}>
        {history.map(item => {
          const actionStyle = actionColors[item.action] || {
            bg: '#333333',
            text: '#ffffff',
            icon: '📄',
          };
          return (
            <div key={item.id} style={cardSmallStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: actionStyle.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                    }}
                  >
                    {actionStyle.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontWeight: '600', color: '#ffffff', fontSize: '14px' }}>
                        {getActionLabel(item.action)}
                      </span>
                      <span
                        style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: actionStyle.text,
                        }}
                      >
                        {item.amount} sats
                      </span>
                    </div>

                    {item.description && (
                      <p style={{ fontSize: '12px', color: '#888888', marginBottom: '4px' }}>
                        {item.description}
                      </p>
                    )}

                    <div
                      style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#666666' }}
                    >
                      <span>{formatDate(item.created_at)}</span>
                      {item.mint_url && (
                        <span title={item.mint_url}>🏦 {new URL(item.mint_url).hostname}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#1f1f1f',
            border: '1px solid #333333',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: '14px',
            cursor: 'pointer',
            marginTop: '16px',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? '⏳ Lädt...' : 'Mehr laden'}
        </button>
      )}
    </div>
  );
}
